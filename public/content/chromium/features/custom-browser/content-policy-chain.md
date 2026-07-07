# Content Policy Chain

Per-content-type URL filtering by hostname pattern. Allows rules that block or allow
specific resource types (scripts, images, fonts, etc.) from specific hosts.
Ported from Gecko's pluggable `nsIContentPolicy` chain (Timberwolf F3).

---

## Build flag

Gated by `BUILDFLAG(ENABLE_CONTENT_POLICY_CHAIN)`. Controlled by `enable_content_policy_chain = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

---

## What it does

When enabled, every outgoing resource request is checked against an ordered list of
rules. Each rule matches a hostname glob pattern and a content-type bitmask. The
first matching enabled rule determines whether the request is allowed or blocked.
Requests to non-HTTP/HTTPS URLs are always allowed.

---

## Content type bitmask

| Flag | Bit | Covers |
|---|---|---|
| `kScript` | `1 << 0` | `<script>`, workers, service workers |
| `kStylesheet` | `1 << 1` | `<link rel=stylesheet>`, `<style>` |
| `kImage` | `1 << 2` | `<img>`, CSS `url()` images |
| `kFont` | `1 << 3` | `@font-face` loads |
| `kMedia` | `1 << 4` | `<audio>`, `<video>`, `<track>` |
| `kXhr` | `1 << 5` | `fetch()`, `XMLHttpRequest` (`RequestDestination::kEmpty`) |
| `kFrame` | `1 << 6` | `<iframe>`, `<frame>` |
| `kOther` | `1 << 7` | Everything else |
| `kAll` | `0xFFFFFFFF` | Match any type |

A rule's `content_types = 0` is treated as `kAll`.

---

## Rule data model

```
ContentPolicyRule {
  id:            string         // opaque identifier (UUID)
  pattern:       string         // hostname glob: "*.ads.com", "example.com", "*"
  content_types: uint32_t       // bitmask of flags above; 0 = all types
  action:        "block" | "allow"
  enabled:       bool           // per-rule toggle
}
```

Rules are evaluated in order. The first matching enabled rule wins. If no rule
matches, the request is **allowed** (default-allow policy).

### Pattern matching

| Pattern | Matches |
|---|---|
| `*` or `""` | Any host |
| `*.example.com` | Any subdomain of `example.com` (not bare `example.com`) |
| `example.com` | Only `example.com` exactly |

---

## Architecture

```
ContentPolicyManagerFactory (ProfileKeyedServiceFactory)
  │  Regular profiles: kOwnInstance
  │  Guest / Ash internals: kNone
  │
  └─► ContentPolicyManager (KeyedService, per-profile)
        │  Reads kCustomContentPolicyRules pref on creation and on pref change.
        │  GetSnapshot() → thread-safe copy of rules[] for throttles.
        │  static ShouldLoad(url, bits, rules) → bool
        │
        ContentPolicyThrottle (blink::URLLoaderThrottle)
          Created per-request in CustomContentBrowserClient::CreateURLLoaderThrottles()
          only when kCustomContentPolicyEnabled is true and manager has rules.
          WillStartRequest():
            1. Map request->destination → content_type bitmask bit.
            2. Call ShouldLoad(request->url, bits, rules_).
            3. If blocked → CancelWithError(ERR_BLOCKED_BY_CLIENT, "ContentPolicy").
```

---

## Prefs

| Pref key | Type | Default | Purpose |
|---|---|---|---|
| `custom.content_policy.enabled` | bool | `false` | Master on/off switch |
| `custom.content_policy.rules` | string (JSON) | `"[]"` | Serialised `ContentPolicyRule[]` |

### JSON storage format

```json
[
  {
    "id": "rule-uuid",
    "pattern": "*.doubleclick.net",
    "content_types": 255,
    "action": "block",
    "enabled": true
  }
]
```

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/content_policy/content_policy_manager.h/.cc` | `KeyedService`; rule struct, `ShouldLoad()`, `ParseRules()`, pref observer |
| `custom/browser/content_policy/content_policy_manager_factory.h/.cc` | `ProfileKeyedServiceFactory` |
| `custom/browser/content_policy/content_policy_throttle.h/.cc` | `URLLoaderThrottle`; destination→bitmask mapping, cancel on block |
| `custom/common/custom_pref_names.h` | `kCustomContentPolicyRules`, `kCustomContentPolicyEnabled` |
| `custom/browser/prefs/custom_prefs.cc` | Pref registration |
| `custom/browser/sources.gni` | Source listing |
| `custom/browser/custom_browser_context_keyed_service_factories.cc` | Factory registration |
| `custom/browser/custom_content_browser_client.cc` | Throttle wired in `CreateURLLoaderThrottles()` after tracking throttle |

---

## Integration notes

The throttle is added **last** in `CreateURLLoaderThrottles()` (after connection control,
referrer control, ad block, and tracking throttles). Unlike connection control which
inserts at `throttles.begin()`, content policy appends with `push_back` — it runs after
all other custom throttles but before SafeBrowsing.

An empty rule list skips throttle creation entirely. The throttle receives an immutable
snapshot of rules at construction — pref changes take effect only for new requests.

---

## Related docs

- [security-privacy-features.md](security-privacy-features.md) — connection control and other request-blocking features
