# User-Agent Overrides

Two complementary UA control features: a **global compatibility mode** that
applies a Firefox or Chrome-stable UA string to all requests, and **per-site
rules** that override the UA for specific host patterns via a URLLoaderThrottle.
Both are gated by `BUILDFLAG(CUSTOM_BROWSER)` with no separate enable flag.

---

## Build flag

Gated by `BUILDFLAG(CUSTOM_BROWSER)`. Controlled by `custom_browser = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

---

## 1. Global UA Compatibility Mode

A process-wide UA string substitution. When active, every outbound request
reports the configured UA regardless of site or request type.

### Pref

| Pref key | Type | Default | Registry |
|---|---|---|---|
| `custom.user_agent.global_mode` | string | `"default"` | local state |

Valid values: `"default"` (Chromium UA pass-through), `"firefox"`, `"chrome_stable"`.

> Local-state pref — applies to all profiles on the machine; not synced.

### How it works

`CustomContentBrowserClient::GetUserAgent()` overrides the Chromium virtual method:

```cpp
std::string CustomContentBrowserClient::GetUserAgent() {
  const std::string& mode =
      g_browser_process->local_state()->GetString(prefs::kCustomGlobalUAMode);
  if (mode == "firefox")       return kUAFirefox;
  if (mode == "chrome_stable") return kUAChromeStable;
  return ChromeContentBrowserClient::GetUserAgent();
}
```

Pinned UA strings (update periodically to stay within a plausible browser version range):

| Mode | UA string |
|---|---|
| `firefox` | `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0` |
| `chrome_stable` | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36` |

---

## 2. Per-Site UA Overrides

Rewrites the `User-Agent` request header for hosts that match user-defined glob
rules. Implemented as a `blink::URLLoaderThrottle` so it intercepts all request
types (navigation, subresource, fetch, XHR) at the earliest point in the
request pipeline.

### Pref

| Pref key | Type | Default | Registry |
|---|---|---|---|
| `custom.ua_overrides` | string (JSON) | `"[]"` | profile |

Format: a JSON array of `{domain, ua}` objects. The `domain` field supports
`*` wildcards via `base::MatchPattern` (e.g. `"*.netflix.com"`).

```json
[
  {"domain": "*.netflix.com", "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0"},
  {"domain": "discord.com",   "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"}
]
```

Rules are matched in order. The first matching rule wins. An empty array
disables the throttle entirely (no `UAOverrideThrottle` is created).

### Architecture

```
UAOverrideServiceFactory (ProfileKeyedServiceFactory)
  │  ProfileSelection: kOriginalOnly
  │  Created at startup in EnsureBrowserContextKeyedServiceFactoriesBuilt().
  │
  └─► UAOverrideService (KeyedService, per-profile)
        │  Reads kCustomUAOverrides pref at construction and on every pref change.
        │  Caches parsed rules in rules_ (std::vector<Rule>).
        │
        GetRules()                    → snapshot of rules_ [UI thread]
        static MatchRule(host, rules) → optional<string> [any thread]
        static ParseRules(json)       → vector<Rule>

CustomContentBrowserClient::CreateURLLoaderThrottles():
  1. Gets UAOverrideService for the request's profile.
  2. If service has non-empty rules, snapshots them via GetRules().
  3. Creates UAOverrideThrottle(rules_snapshot) — one per request.

UAOverrideThrottle (blink::URLLoaderThrottle, per-request, immutable)
  WillStartRequest():
    if MatchRule(request->url.host(), rules_)
      → request->headers.SetHeader("User-Agent", *ua)
```

Rule snapshots are captured on the UI thread and moved into the throttle. The
throttle is then immutable and safe on any sequence.

Per-site overrides are applied **after** the global mode — if a rule matches, it
overrides whatever `GetUserAgent()` returned.

### File map

| File | Purpose |
|---|---|
| [`custom/browser/net/ua_override/ua_override_service.h/.cc`](../src/custom/browser/net/ua_override/ua_override_service.cc) | `KeyedService`. Holds the rule list, parses JSON, re-reads on pref change via `PrefChangeRegistrar` |
| [`custom/browser/net/ua_override/ua_override_service_factory.h/.cc`](../src/custom/browser/net/ua_override/ua_override_service_factory.cc) | `ProfileKeyedServiceFactory` |
| [`custom/browser/net/ua_override/ua_override_throttle.h/.cc`](../src/custom/browser/net/ua_override/ua_override_throttle.cc) | `URLLoaderThrottle`. Stateless except for the captured rule snapshot |
| [`custom/browser/net/ua_override/BUILD.gn`](../src/custom/browser/net/ua_override/BUILD.gn) | `source_set("ua_override")` |

### Integration points

| File | What it changes |
|---|---|
| [`custom/browser/custom_content_browser_client.cc`](../src/custom/browser/custom_content_browser_client.cc) | `GetUserAgent()` — global mode; `CreateURLLoaderThrottles()` — inserts `UAOverrideThrottle` when rules are non-empty |
| [`custom/browser/prefs/custom_prefs.cc`](../src/custom/browser/prefs/custom_prefs.cc) | Registers `kCustomGlobalUAMode` (local state) and `kCustomUAOverrides` (profile) |
| [`chrome/browser/profiles/chrome_browser_main_extra_parts_profiles.cc`](../src/chrome/browser/profiles/chrome_browser_main_extra_parts_profiles.cc) | `EnsureBrowserContextKeyedServiceFactoriesBuilt()` — calls `UAOverrideServiceFactory::GetInstance()` to register the factory before the registration window closes |

---

## Testing

### Global mode

1. Set `custom.user_agent.global_mode = "firefox"` (local-state pref).
2. Navigate to any page. Open DevTools → Network → select the document request
   → Request Headers → `User-Agent`.
3. Should show the pinned Firefox UA string.
4. Reset to `"default"` → Chromium UA returns.

### Per-site rules

1. Set `custom.ua_overrides = [{"domain": "*.example.com", "ua": "TestAgent/1.0"}]`.
2. Navigate to `https://example.com/`.
3. DevTools → Network → document request → `User-Agent` should be `TestAgent/1.0`.
4. Navigate to a non-matching host → original UA (or global mode UA if set).

What "broken" looks like:

| Symptom | Likely cause |
|---|---|
| Rules ignored after pref change | `PrefChangeRegistrar` not firing — check `OnRulesChanged` is wired in the constructor |
| Throttle never inserted for any host | `rules_` empty because JSON parse failed — validate double-quoted strings and array format |
| All sites get override | Domain glob too broad (e.g. `"*"`) — verify `MatchPattern` call in `UAOverrideService::MatchRule` |
| DCHECK crash at startup: "factory registered after main registration function" | `UAOverrideServiceFactory::GetInstance()` not called in `EnsureBrowserContextKeyedServiceFactoriesBuilt()` |

---

## Related docs

- [security-privacy-features.md](security-privacy-features.md) — Connection Control and Referrer Control (same `URLLoaderThrottle` pattern)
- [content-policy-chain.md](content-policy-chain.md) — URLLoaderThrottle pipeline overview
- [cyberfox-features.md](cyberfox-features.md) — origin analysis (features 4 and 5)
