# Security & Privacy Features

Six browser-level security and privacy controls (originally five, ported from the
Aviator Chromium fork, WhiteHat Security, base v37, extended with WanderLust
infrastructure), plus additional hardening defaults. All six are compiled together
under `BUILDFLAG(ENABLE_PRIVACY_GUARD)` (`enable_privacy_guard = true` in
[`custom_browser_config.gni`](../src/custom/custom_browser_config.gni)) and are
controlled at runtime by per-profile prefs — there is no per-feature compile flag.
The [Privacy Shield](privacy-shield.md) (`BUILDFLAG(ENABLE_PRIVACY_SHIELD)`) and
[Tracking Dashboard](tracking-dashboard.md) (`BUILDFLAG(ENABLE_TRACKING_DASHBOARD)`)
are separate features with their own flags.

> **Quick access:** The [Privacy Shield](privacy-shield.md) toolbar button
> surfaces all six toggles in a single bubble panel without navigating to settings.

---

## 1. Connection Control

A per-profile network firewall. Evaluates every outgoing URL request against an
ordered list of allow/deny rules before it reaches the network. Implemented as a
`blink::URLLoaderThrottle` so it intercepts all request types (navigation,
subresource, fetch, XHR) at the earliest possible point.

### Prefs

| Pref key | Type | Default | Purpose |
|---|---|---|---|
| `custom.connection_control.enabled` | bool | `false` | Master on/off switch |
| `custom.connection_control.rules` | string (JSON) | `"[]"` | Serialised `ConnectionControlRule[]` |

### Rule data model

```
ConnectionControlRule {
  id:           string   // opaque identifier
  action:       "allow" | "deny"
  protocol:     "http" | "https" | "any"
  host_pattern: string   // glob, e.g. "*.corp.example.com"; empty = match all
  port:         int      // 0 = match any port
  scope:        "private" | "public" | "any"   // RFC 1918 private vs public IP
  enabled:      bool     // per-rule toggle
}
```

Rules are evaluated in order. The first match wins. If no rule matches, the
request is allowed. Internal schemes (`chrome://`, `wanderlust://`,
`chrome-extension://`, `file://`) are always exempt.

#### Scope: private vs public

The `scope` field uses `IsPrivateIPAddress()` to classify the resolved host:

| Prefix | Scope |
|---|---|
| `10.0.0.0/8` | private |
| `172.16.0.0/12` | private |
| `192.168.0.0/16` | private |
| `127.0.0.0/8`, `::1` | private (loopback) |
| `169.254.0.0/16`, `fe80::/10` | private (link-local) |
| everything else | public |

### Architecture

```
ConnectionControlManagerFactory (BrowserContextKeyedServiceFactory)
  └─► ConnectionControlManager (KeyedService, per-profile)
        │  Reads rules from prefs on creation and on every pref change.
        │  Provides GetRules() — a thread-safe snapshot for throttles.
        │
        └─► ConnectionControlThrottle (blink::URLLoaderThrottle)
              Created per-request in CustomContentBrowserClient::CreateURLLoaderThrottles().
              Receives a rules snapshot at construction time (UI-thread safe).
              WillStartRequest() → calls IsUrlBlocked(url, rules_).
              If blocked → CancelWithError(net::ERR_BLOCKED_BY_CLIENT, "ConnectionControl").
```

### File map

| File | Purpose |
|---|---|
| [`browser/security/connection_control/connection_control_manager.{cc,h}`](../src/custom/browser/security/connection_control/connection_control_manager.cc) | `KeyedService`. Owns the rule snapshot, RFC1918 helper, JSON parse, `IsUrlBlocked()` |
| [`browser/security/connection_control/connection_control_manager_factory.{cc,h}`](../src/custom/browser/security/connection_control/connection_control_manager_factory.cc) | `ProfileKeyedServiceFactory`. Returns `nullptr` for guest/OTR profiles |
| [`browser/security/connection_control/connection_control_throttle.{cc,h}`](../src/custom/browser/security/connection_control/connection_control_throttle.cc) | `URLLoaderThrottle`. Stateless except for the captured rules snapshot |
| [`browser/security/connection_control/BUILD.gn`](../src/custom/browser/security/connection_control/BUILD.gn) | `source_set("connection_control")` |

### Integration points

| File | What it changes |
|---|---|
| [`browser/custom_content_browser_client.cc`](../src/custom/browser/custom_content_browser_client.cc) | `CreateURLLoaderThrottles()` — checks `kCustomConnectionControlEnabled`; if true, inserts `ConnectionControlThrottle` at the front of the throttle list |
| [`browser/custom_browser_context_keyed_service_factories.cc`](../src/custom/browser/custom_browser_context_keyed_service_factories.cc) | Calls `ConnectionControlManagerFactory::GetInstance()` at startup |
| [`browser/prefs/custom_prefs.cc`](../src/custom/browser/prefs/custom_prefs.cc) | Registers both prefs via `RegisterProfilePrefs()` |

### Testing

1. Enable the feature: set `custom.connection_control.enabled = true`.
2. Add a rule: action=`deny`, scope=`private`, protocol=`any`, port=`0`
   (deny all traffic to private IPs).
3. Navigate to `http://192.168.1.1` (your router's admin page) → should receive
   `ERR_BLOCKED_BY_CLIENT`.
4. Add an allow rule above the deny rule with `host_pattern=192.168.1.1` →
   router page should load again.
5. Disable the feature (`enabled = false`) → all traffic flows normally regardless
   of rules.

What "broken" looks like:

| Symptom | Likely cause |
|---|---|
| All traffic blocked even with `enabled=false` | Throttle is being inserted unconditionally — check the `GetBoolean(kCustomConnectionControlEnabled)` guard in `CreateURLLoaderThrottles()` |
| Rules not persisted | `RegisterProfilePrefs()` not called before profile creation |
| `chrome://` URLs blocked | Internal scheme exemption missing in `IsUrlBlocked()` |

### Recommended rule presets

#### Analytics blocking

Connection Control can block analytics and tracking domains with deny rules.
Example rules to add via the UI or pref editor:

| field | value |
|---|---|
| Action | `deny` |
| Protocol | `any` |
| Host pattern | `*.google-analytics.com` |
| Port | `0` (any) |
| Scope | `public` |

Add similar rules for `googletagmanager.com`, `doubleclick.net`, and
`connect.facebook.net` as needed. Requests from internal scheme pages
(`chrome://`, `wanderlust://`, `chrome-extension://`) are always exempt from
Connection Control rules — analytics on privileged pages is already blocked
by the separate internal-scheme analytics throttle wired into
`CreateURLLoaderThrottles()`.

---

## 2. Referrer Control

Strips the `Referer` HTTP header from all outgoing requests unless the
destination host matches a user-configured exception list. Implemented as a
`blink::URLLoaderThrottle` that runs alongside (but after) Connection Control.

### Prefs

| Pref key | Type | Default | Purpose |
|---|---|---|---|
| `custom.strip_referrer` | bool | `false` | Master on/off switch |
| `custom.referrer_exceptions` | string (JSON) | `"[]"` | JSON array of glob patterns that are exempt |

### How stripping works

When active and the destination host is **not** in the exception list:

1. `request->referrer` is set to `GURL()` (empty).
2. `request->referrer_policy` is set to `net::ReferrerPolicy::NO_REFERRER`.
3. `request->headers.RemoveHeader("Referer")` removes any already-set value.

All three steps are needed: the URL clears the value the browser computes from
the policy; the policy prevents the renderer from re-adding it for
same-origin navigations; the header removal handles any value already set by
earlier pipeline stages.

### Exception list matching

Patterns support shell-style globs via `base::MatchPattern`:

| Pattern | Matches |
|---|---|
| `example.com` | `example.com` exactly |
| `*.example.com` | `sub.example.com`, `deep.sub.example.com` |
| `internal.*` | `internal.corp`, `internal.net` |

Matching is case-insensitive. Host comparison only — port and path are ignored.

### File map

| File | Purpose |
|---|---|
| [`browser/net/referrer_control/referrer_control_throttle.{cc,h}`](../src/custom/browser/net/referrer_control/referrer_control_throttle.cc) | `URLLoaderThrottle`. `IsExempt()`, `ParseExceptions()`, header stripping in `WillStartRequest()` |
| [`browser/net/referrer_control/BUILD.gn`](../src/custom/browser/net/referrer_control/BUILD.gn) | `source_set("referrer_control")` |

### Integration points

| File | What it changes |
|---|---|
| [`browser/custom_content_browser_client.cc`](../src/custom/browser/custom_content_browser_client.cc) | `CreateURLLoaderThrottles()` — checks `kCustomStripReferrer`; if true, parses `kCustomReferrerExceptions` and appends `ReferrerControlThrottle` |
| [`browser/prefs/custom_prefs.cc`](../src/custom/browser/prefs/custom_prefs.cc) | Registers both prefs |

### Testing

1. Enable: `custom.strip_referrer = true`, exceptions = `[]`.
2. Visit `https://developer.mozilla.org/` by clicking a link from another page.
3. In DevTools → Network, click the request and inspect Request Headers —
   `Referer` should be absent.
4. Add `developer.mozilla.org` to exceptions → `Referer` should reappear.

---

## 3. Force Incognito

Redirects every new browser window and startup to an off-the-record (OTR)
profile, effectively making incognito the only mode. The regular profile still
exists and owns all persistent data (bookmarks, history, extensions) — only the
window/session is incognito.

### Pref

| Pref key | Type | Default | Purpose |
|---|---|---|---|
| `custom.force_incognito` | bool | `false` | When true, all windows open as OTR |

### Hooks

#### Startup (`startup_browser_creator.cc` patch)

```cpp
// After the profile is resolved for the launch:
if (profile->GetPrefs()->GetBoolean(prefs::kCustomForceIncognito) &&
    !profile->IsOffTheRecord()) {
  profile = profile->GetPrimaryOTRProfile(/*create_if_needed=*/true);
}
```

The patched code runs just before `LaunchBrowser()` receives the profile
pointer. Once redirected, `LaunchBrowser` creates the window against the OTR
profile as if the user had clicked "New Incognito Window".

#### New window (`browser_commands.cc` patch)

```cpp
// In NewWindow(), after the Mac/extensions early-returns:
#if BUILDFLAG(CUSTOM_BROWSER)
if (profile->GetOriginalProfile()->GetPrefs()->GetBoolean(
        prefs::kCustomForceIncognito)) {
  NewEmptyWindow(profile->GetOriginalProfile()->GetPrimaryOTRProfile(
      /*create_if_needed=*/true));
  return;
}
#endif
```

Intercepts `Ctrl+N` / File → New Window before a regular window is created.

> **OTR-safety rule:** always call `GetOriginalProfile()` before
> `GetPrimaryOTRProfile()`. If the current browser is already incognito (which
> it will be after startup force-redirect), `profile` is already an OTR profile
> and calling `GetPrimaryOTRProfile()` directly on it crashes — OTR profiles
> have no OTR children. Rooting the call through `GetOriginalProfile()` first
> is safe in both regular and already-incognito contexts.

### Integration points (patches)

| File | What it changes |
|---|---|
| [`chrome/browser/ui/startup/startup_browser_creator.cc`](../src/chrome/browser/ui/startup/startup_browser_creator.cc) | Profile redirect in `LaunchBrowser()` |
| [`chrome/browser/ui/browser_commands.cc`](../src/chrome/browser/ui/browser_commands.cc) | Window redirect in `NewWindow()` |

After editing either patched file, run `npm run update_patches`.

### KeyedService factory OTR requirement

Any `BrowserContextKeyedServiceFactory` whose service is used by the browser
UI (tab strip, toolbar, sidebar, etc.) **must** override
`GetBrowserContextToUse()` to redirect OTR profiles to the original profile.
Without this override the default Chromium behaviour returns `nullptr` for
incognito contexts, causing a null-pointer crash when the UI tries to use the
service in a force-incognito window.

The correct implementation (see `tab_service_factory.cc`,
`toolbar_service_factory.cc`, etc.):

```cpp
// .h
content::BrowserContext* GetBrowserContextToUse(
    content::BrowserContext* context) const override;

// .cc — include chrome/browser/profiles/incognito_helpers.h
content::BrowserContext* XxxFactory::GetBrowserContextToUse(
    content::BrowserContext* context) const {
  return const_cast<content::BrowserContext*>(
      GetBrowserContextRedirectedInIncognito(context));
}
```

Two gotchas with `GetBrowserContextRedirectedInIncognito`:
- It lives in the **global namespace**, not `chrome::` — do not prefix it.
- It returns **`const content::BrowserContext*`**; the override requires
  non-const, so `const_cast` is required.

### Caveats

- The regular profile's data (history, passwords, etc.) is still written to disk
  by any process that bypasses these two hooks (e.g. background sync, extensions
  accessing the non-OTR profile directly). This feature is a UI-level gate, not
  a data-isolation guarantee.
- `GetPrimaryOTRProfile(create_if_needed=true)` returns the same OTR profile on
  every call for the same parent — all force-incognito windows share one OTR
  profile and therefore share the same session cookies.

---

## 4. Disable WebGL

Appends `--disable-webgl` to the command line of every renderer process when
the pref is set. This prevents WebGL fingerprinting without requiring changes to
content settings or JavaScript.

### Pref

| Pref key | Type | Default | Purpose |
|---|---|---|---|
| `custom.disable_webgl` | bool | `false` | When true, WebGL is disabled in all renderers |

### How it works

`CustomContentBrowserClient::AppendExtraCommandLineSwitches()` is called by the
browser process for each new renderer process before it launches. The hook
resolves the renderer's profile and appends the switch if the pref is set:

```cpp
#if BUILDFLAG(CUSTOM_BROWSER)
{
  auto* webgl_process = content::RenderProcessHost::FromID(child_process_id);
  auto* webgl_profile = webgl_process
      ? Profile::FromBrowserContext(webgl_process->GetBrowserContext())
      : nullptr;
  if (webgl_profile &&
      webgl_profile->GetPrefs()->GetBoolean(prefs::kCustomDisableWebGL)) {
    command_line->AppendSwitch(switches::kDisableWebGL);
  }
}
#endif
```

The inner `{}` scope and distinct variable names (`webgl_process`,
`webgl_profile`) are required to avoid shadowing the `profile` variable
declared in the adjacent `REMOTE_NTP` block.

### Integration points

| File | What it changes |
|---|---|
| [`browser/custom_content_browser_client.cc`](../src/custom/browser/custom_content_browser_client.cc) | `AppendExtraCommandLineSwitches()` — WebGL switch injection |
| [`browser/prefs/custom_prefs.cc`](../src/custom/browser/prefs/custom_prefs.cc) | Registers `kCustomDisableWebGL` |

### Testing

1. Enable: `custom.disable_webgl = true`.
2. Navigate to `chrome://gpu` — the WebGL entry should show **Software only,
   hardware acceleration unavailable** or similar disabled state.
3. Open the DevTools console and run `document.createElement('canvas').getContext('webgl')` — should return `null`.
4. Disable the pref and **restart the browser** (the switch is per-process; existing
   renderers are unaffected until they are respawned).

---

## 5. Session-Only Cookies

Forces all cookies to be treated as session cookies (cleared when the browser
closes), regardless of the `Max-Age` or `Expires` attributes set by the server.
Implemented via Chromium's content settings — specifically
`CONTENT_SETTING_SESSION_ONLY` on the `COOKIES` content type.

### Pref

| Pref key | Type | Default | Purpose |
|---|---|---|---|
| `custom.session_only_cookies` | bool | `false` | When true, all cookies expire at session end |

### How it works

`ApplyPrivacyDefaults(Profile*)` is called from
`CustomMainExtraParts::PostProfileInit()` (runs once per profile after prefs are
available). If the pref is set it calls:

```cpp
HostContentSettingsMapFactory::GetForProfile(profile)
    ->SetDefaultContentSetting(ContentSettingsType::COOKIES,
                               CONTENT_SETTING_SESSION_ONLY);
```

`CONTENT_SETTING_SESSION_ONLY` is the same value that the Chrome privacy
settings UI applies when the user chooses "Keep cookies until I quit Chrome".
Chromium's cookie store honours it natively — no custom network stack changes
required.

### File map

| File | Purpose |
|---|---|
| [`browser/privacy/custom_privacy_defaults.{cc,h}`](../src/custom/browser/privacy/custom_privacy_defaults.cc) | `ApplyPrivacyDefaults(Profile*)` — applies all profile-level privacy defaults at startup |

These files are compiled directly into `custom_browser_sources` (not via a
separate GN dep target) to avoid duplicate symbol linking.

### Integration points

| File | What it changes |
|---|---|
| [`browser/custom_main_extra_parts.cc`](../src/custom/browser/custom_main_extra_parts.cc) | Calls `custom::ApplyPrivacyDefaults(profile)` in `PostProfileInit()` |
| [`browser/prefs/custom_prefs.cc`](../src/custom/browser/prefs/custom_prefs.cc) | Registers `kCustomSessionOnlyCookies` |
| [`browser/sources.gni`](../src/custom/browser/sources.gni) | Lists `privacy/custom_privacy_defaults.{cc,h}` in `custom_browser_sources` |

### Caveats

- Setting is applied **once at profile startup**. Changing the pref at runtime
  requires a browser restart to take effect (the content setting is not
  re-applied dynamically).
- `CONTENT_SETTING_SESSION_ONLY` does not affect cookies already stored in the
  profile from a previous session where the setting was off — those are cleared
  only when the browser exits under the new setting.
- Site-specific exceptions set via `chrome://settings/content/cookies` override
  the default, so a site with an explicit `ALLOW` exception will still set
  persistent cookies.

---

## 6. Local Font Fingerprint Protection

Restricts the set of fonts the browser exposes to web content. Browsers normally
report every font installed on the OS to JavaScript (`FontFace` / CSS font
enumeration). This lets sites build a persistent, device-unique fingerprint.
When enabled, the Blink renderer's `localFontsFingerprintProtection` setting
is activated, which limits font enumeration to a standard web-safe set and
hides OS-specific fonts from JavaScript.

### Pref

| Pref key | Type | Default | Purpose |
|---|---|---|---|
| `privacy_guard.font_fingerprint_protection` | bool | `false` | When true, restricts local font enumeration in all renderers |

### How it works

The feature threads through four layers:

1. **Pref → `WebPreferences`** — `CustomContentBrowserClientParts::OverrideWebPreferences()`
   reads `kFontFingerprintProtection` and writes it to `web_prefs->local_fonts_fingerprint_protection`.

2. **`WebPreferences` → renderer** — `WebView::ApplyWebPreferences()` (in the patched
   `web_view_impl.cc`) calls `settings->SetLocalFontsFingerprintProtection(prefs.local_fonts_fingerprint_protection)`.
   This call is wrapped in `#if BUILDFLAG(CUSTOM_BROWSER)`.

3. **`WebSettings` → `WebSettingsImpl`** — `WebSettingsImpl::SetLocalFontsFingerprintProtection(bool)`
   delegates to `settings_->SetLocalFontsFingerprintProtection(enabled)`.

4. **Blink `Settings`** — The `localFontsFingerprintProtection` entry in
   `settings.json5` auto-generates `Settings::SetLocalFontsFingerprintProtection()`,
   which the Blink layout engine queries when enumerating available fonts for a page.

> **Why the Blink patches were needed:** `settings.json5` generates the internal
> `Settings` setter automatically, but the public `WebSettings` abstract interface
> and its `WebSettingsImpl` implementation must be wired manually. Those two layers
> were missing, causing a compile error (`no member named 'SetLocalFontsFingerprintProtection'
> in 'blink::WebSettings'`) the first time `web_view_impl.cc` tried to call the method.

### File map

| File | Purpose |
|---|---|
| [`browser/custom_content_browser_client_parts.cc`](../src/custom/browser/custom_content_browser_client_parts.cc) | `OverrideWebPreferences()` — reads pref, sets `web_prefs->local_fonts_fingerprint_protection` under `ENABLE_PRIVACY_GUARD` |
| [`third_party/blink/public/web/web_settings.h`](../src/third_party/blink/public/web/web_settings.h) | Abstract `WebSettings` interface — adds `virtual void SetLocalFontsFingerprintProtection(bool) = 0` |
| [`third_party/blink/renderer/core/exported/web_settings_impl.h`](../src/third_party/blink/renderer/core/exported/web_settings_impl.h) | `WebSettingsImpl` — adds `void SetLocalFontsFingerprintProtection(bool) override` |
| [`third_party/blink/renderer/core/exported/web_settings_impl.cc`](../src/third_party/blink/renderer/core/exported/web_settings_impl.cc) | Implements override: `settings_->SetLocalFontsFingerprintProtection(enabled)` |

The three Blink files are vanilla Chromium and have corresponding patch files in
`src/custom/patches/`:

- `third_party-blink-public-web-web_settings.h.patch`
- `third_party-blink-renderer-core-exported-web_settings_impl.h.patch`
- `third_party-blink-renderer-core-exported-web_settings_impl.cc.patch`

### Integration points

| File | What it changes |
|---|---|
| [`browser/custom_content_browser_client_parts.cc`](../src/custom/browser/custom_content_browser_client_parts.cc) | Bridges pref → `WebPreferences` in `OverrideWebPreferences()` |
| [`browser/prefs/custom_prefs.cc`](../src/custom/browser/prefs/custom_prefs.cc) | Registers `kFontFingerprintProtection` under `ENABLE_PRIVACY_GUARD` |
| `third_party/blink/renderer/core/exported/web_view_impl.cc` (patch) | Calls `settings->SetLocalFontsFingerprintProtection()` in `ApplyWebPreferences()` |

### Testing

1. Enable: `privacy_guard.font_fingerprint_protection = true`.
2. Navigate to any page and open the DevTools console.
3. Run:
   ```js
   const fonts = await document.fonts.query({});
   [...fonts].map(f => f.family)
   ```
   The returned list should contain only standard web-safe families, not
   OS-specific fonts (e.g. "Segoe UI" on Windows should be absent).
4. Disable the pref and restart — the full OS font list should reappear.

---

## Letterboxing (viewport quantization)

> Added after the six numbered features above (canvas fingerprint noise and
> screen-metrics normalization were too, but neither has its own numbered
> section here — all three live together in `PrivacyPage.tsx`'s "Fingerprint
> resistance" section rather than each getting a fully numbered slot in this
> doc).

Pads the actual *rendered* web-content viewport into fixed-size buckets
(Tor/Mullvad Browser-style), so `window.innerWidth`/`innerHeight` and CSS
media queries report a common bucket value shared by many users instead of
the real one. This is distinct from `privacy_guard.screen_metrics_normalize`
(feature 6's sibling pref, registered alongside it), which only overrides
the JS-visible `screen.width`/`screen.height` object values — it never
touches the real rendered viewport size. Toggling both together is
recommended: otherwise a site can cross-check `screen.width` against
`window.innerWidth` as a tell that only one is faked.

### Prefs

| Pref key | Type | Default | Purpose |
|---|---|---|---|
| `privacy_guard.letterboxing_enabled` | bool | `false` | Master toggle |
| `privacy_guard.letterboxing_bucket_width` | int | `200` | Bucket size for the quantized viewport width, in px |
| `privacy_guard.letterboxing_bucket_height` | int | `100` | Bucket size for the quantized viewport height, in px |

### How it works

Unlike font/canvas/screen-metrics protection (all Blink-`Settings`-level),
letterboxing is a **Views-layout** feature — no `RenderWidgetHostView`-level
patch is needed or would even help, since nothing in vanilla Chromium
exposes a "cap viewport at a bucket, independent of container" primitive
(Window Controls Overlay and Picture-in-Picture are both structurally
different and don't apply).

It's implemented in `MultiContentsView::CalculateProposedLayout()` — the
vanilla Chromium code that decides each tab pane's final rect *after*
DevTools (handled one layer up, in `ContentsLayoutManager`) and split-view
insets have already taken their share. `ApplyLetterboxing()` reads the
three prefs above and, if enabled, quantizes a pane's rect down to the
nearest bucket multiple, centers it, and returns the smaller rect — applied
independently to both panes in split view, so the quantized value stays
correct rather than becoming `total_width − other_pane_width`. The margin
left over renders through `MultiContentsView`'s own solid background
(`kColorToolbar`), invisible whenever the pref is off since the
`ContentsContainerView` children then cover 100% of the available rect.

A `PrefChangeRegistrar` on the three prefs calls `InvalidateLayout()` so
toggling the setting (or the bucket size) takes effect immediately, without
needing a window resize to trigger a fresh layout pass.

**Known v1 limitations:**
- Does not apply in fullscreen (matches existing sidebar/vertical-tab-bar
  precedent, which also skip themselves in fullscreen).
- No visual reveal animation for the letterbox bars appearing/disappearing.

### File map

| File | Purpose |
|---|---|
| [`browser/prefs/custom_prefs.cc`](../src/custom/browser/prefs/custom_prefs.cc) | Registers all three prefs under `ENABLE_PRIVACY_GUARD`, alongside `kScreenMetricsNormalize` |
| [`common/custom_pref_names.h`](../src/custom/common/custom_pref_names.h) | Pref key constants |
| `chrome/browser/ui/views/frame/multi_contents_view.h` / `.cc` (patched) | `ApplyLetterboxing()`, `OnLetterboxingPrefChanged()`, the `PrefChangeRegistrar` member, and the call sites in `CalculateProposedLayout()` |
| [`components/custom_settings/components/PrivacyPage.tsx`](../src/custom/components/custom_settings/components/PrivacyPage.tsx) | "Letterbox the page viewport" toggle, in the "Fingerprint resistance" section |

The two `multi_contents_view.*` edits are vanilla Chromium files with
corresponding patches in `src/custom/patches/`:

- `chrome-browser-ui-views-frame-multi_contents_view.h.patch`
- `chrome-browser-ui-views-frame-multi_contents_view.cc.patch`

### Testing

1. Enable `privacy_guard.letterboxing_enabled`, open DevTools console.
2. Resize the window through several bucket boundaries; confirm
   `window.innerWidth`/`innerHeight` snap to multiples of the configured
   bucket size, with visible solid-color bars filling the remainder.
3. Open DevTools **docked** and confirm the page viewport is still a clean
   bucket multiple (not `total_width − devtools_width`).
4. Enable split view and confirm both panes quantize independently.
5. Also enable `privacy_guard.screen_metrics_normalize` and confirm
   `screen.width` matches `window.innerWidth`.

---

## Shared infrastructure

All six features share the same pref registration path.

### Pref constants ([`custom/common/custom_pref_names.h`](../src/custom/common/custom_pref_names.h))

```cpp
inline constexpr char kCustomForceIncognito[]          = "custom.force_incognito";
inline constexpr char kCustomConnectionControlRules[]  = "custom.connection_control.rules";
inline constexpr char kCustomConnectionControlEnabled[]= "custom.connection_control.enabled";
inline constexpr char kCustomStripReferrer[]           = "custom.strip_referrer";
inline constexpr char kCustomReferrerExceptions[]      = "custom.referrer_exceptions";
inline constexpr char kCustomDisableWebGL[]            = "custom.disable_webgl";
inline constexpr char kCustomSessionOnlyCookies[]      = "custom.session_only_cookies";
inline constexpr char kFontFingerprintProtection[]     = "privacy_guard.font_fingerprint_protection";
```

`custom_pref_names.h` is a header-only file included directly via the `src/`
include path. There is **no** separate `//custom/common:custom_pref_names` GN
target — do not add one.

### GN build targets

| Target | Provides |
|---|---|
| `//custom/browser/security/connection_control:connection_control` | `ConnectionControlManager`, factory, throttle |
| `//custom/browser/net/referrer_control:referrer_control` | `ReferrerControlThrottle` |
| `privacy/custom_privacy_defaults.{cc,h}` | Compiled into `custom_browser_sources` directly |

Both `:connection_control` and `:referrer_control` are listed in
`custom_browser_deps` in [`browser/sources.gni`](../src/custom/browser/sources.gni).
The privacy files are in `custom_browser_sources` (not a dep target) to avoid
duplicate symbol compilation.

---

## Hardening defaults

Behavioural changes applied unconditionally at startup — no user-visible pref.

### Update check interval

`update_manager.cc` sets `kDefaultUpdateCheckInterval = base::Hours(6)` (down
from the upstream default of 24 hours). This ensures security patches reach
users within hours of release rather than the next day.

### Guest mode disabled

`RegisterLocalState()` in `custom_prefs.cc` sets the default value of
`prefs::kBrowserGuestModeEnabled` to `false` via `SetDefaultPrefValue()`.
Guest sessions bypass all custom privacy/security features (force-incognito,
connection control, referrer stripping, etc.); disabling guest mode prevents
accidental circumvention. Users can re-enable guest mode in settings if needed.

### DNS-over-HTTPS set to "automatic" (matches upstream Chromium's own default)

**Corrected 2026-07-31** — this section previously described a `"secure"`
(hardcoded Cloudflare 1.1.1.1) default that was never actually in effect.
A patch to `DefaultDnsOverHttpsConfigSource`'s constructor did set
`prefs::kDnsOverHttpsMode` to `"secure"` under `#if BUILDFLAG(CUSTOM_BROWSER)`,
but `custom_prefs.cc`'s `RegisterLocalState()` — which runs *after* that
constructor per its own code comment — unconditionally overrode the same
pref's default back to `"automatic"`, and `SetDefaultPrefValue()` calls
aren't additive, so the later call always won. The two pieces of code
contradicted each other; only the `custom_prefs.cc` one was ever live. The
patch has been removed (`default_dns_over_https_config_source.cc` is back
to plain vanilla Chromium) so there's a single source of truth.

Real, current behavior: `RegisterLocalState()` in `custom_prefs.cc` sets
the default value of `prefs::kDnsOverHttpsMode` to `"automatic"` via
`SetDefaultPrefValue()` — DNS lookups upgrade to DoH when the resolver
supports it, with a silent fallback to plain DNS otherwise. This is
identical to vanilla Chromium's own default for this pref (Chromium has
shipped Secure DNS "Automatic" mode broadly since ~2020) — this fork
isn't overriding anything here so much as making sure the default stays
`"automatic"` explicitly rather than depending on whatever
`DefaultDnsOverHttpsConfigSource` happens to ship next. Users can change
the provider, force `"secure"` mode with a specific DoH provider, or
disable DoH entirely in Settings → Privacy and Security → Security → Use
secure DNS.

> **Implementation note:** `kDnsOverHttpsMode` is a **local-state** pref
> (registered by `DefaultDnsOverHttpsConfigSource::RegisterPrefs` via
> `SystemNetworkContextManager::RegisterPrefs`). The override lives in
> `custom_prefs.cc`'s `RegisterLocalState()`, not in a
> `RegisterProfilePrefs()` call.

**Related, also corrected 2026-07-31:** the `custom_dns_over_https_support`
GN flag (and its `ENABLE_DNS_OVER_HTTPS`/`CUSTOM_DNS_OVER_HTTPS_SUPPORT`
buildflags/defines, and the `DnsOverHttpsSupport` `base::Feature`) has been
deleted entirely — it never gated anything in the first place
(`BUILDFLAG(ENABLE_DNS_OVER_HTTPS)` had zero references anywhere in the
tree, and `IsFeatureEnabled("DnsOverHttpsSupport")` was never called). The
real DoH behavior described above was never conditioned on this flag.
Encrypted Client Hello (ECH) was also investigated as part of this
cleanup and found to require no fork-side work: this fork has zero
ECH-specific code anywhere — ECH is purely vanilla Chromium's own
built-in feature, shipping exactly as upstream ships it.

### WebRTC IP handling policy

`RegisterProfilePrefs()` in `custom_prefs.cc` sets the default value of
`prefs::kWebRTCIPHandlingPolicy` to `"default_public_interface_only"` via
`SetDefaultPrefValue()`. This exposes only the device's public-facing IP to
WebRTC peers, preventing local LAN address leakage while keeping WebRTC
functional. The upstream Chromium default is `"default"` (exposes all
interfaces including private LAN addresses).

### Chromium base version on About page

`HandleGetAboutInfo()` in `custom_settings_handler.cc` appends
`chromiumVersion: CHROME_VERSION_STRING` (from `chrome/common/chrome_version.h`)
to the about-page JSON. The About page in `custom_settings` renders this as a
"Chromium" row in the version table when the field is present.

### Bundled extensions mechanism (currently unused)

`extensions::kOurExtensionIds[]` / `kOurExtensionFilenames[]`
(`custom/extensions/common/custom_extension.h`/`.cc`) is generic
infrastructure for shipping first-party extensions that auto-install on
first run and are hidden/non-removable from the user's perspective, at two
layers:

1. **`chrome://extensions` page** — `ShouldDisplayInExtensionSettings()` in the
   patched `extensions/browser/ui_util.cc` returns `false` for any bundled ID,
   hiding the extension from the upstream extensions page.

2. **`chrome://custom-settings/extensions`** (the custom React WebUI, see
   [pages-inventory.md](custom-webui/pages-inventory.md)) — `CustomExtensionsHandler`'s
   `IsBundledInternalExtension()` gates `HandleRemoveExtension` /
   `HandleSetExtensionEnabled`, making bundled IDs immune to user action, and
   `mayDisable` reflects the lock in the UI.

As of 2026-07-21, `kOurNumExtensions = 0` and both arrays are empty — the
only extension ever shipped this way (a test "Adblock for Youtube" CRX) was
removed for being outdated and untested, along with the `.crx` file itself
and its entry in `browser/extensions/sources.gni`. The mechanism above is
left in place, dormant, ready to hold a future first-party bundled
extension without needing any of the five patched-upstream-file
special-casings above to change — they all loop
`for (i = 0; i < kOurNumExtensions; ++i)`, so an empty list makes every one
of them an unconditional no-op.

### Battery Status API disabled

`content/browser/browser_interface_binders.cc` (patched) never serves real
battery data to web pages in `BUILDFLAG(CUSTOM_BROWSER)` builds — charge
level and charging state are a fingerprinting vector that persists across
cookie clears, unlike most other signals this browser already resists.

**How it works:** `PopulateFrameBinders()` registers a `BindBatteryMonitor`
handler for `device::mojom::BatteryMonitor` unconditionally (both builds),
but the function body differs: the non-custom build binds the real
`device::mojom::BatteryMonitor` service as upstream does; the
`CUSTOM_BROWSER` build's version is an empty stub that lets the
`mojo::PendingReceiver` go out of scope, closing the connection immediately
with no data ever served.

> **Why the binder must stay registered even though it does nothing:**
> `navigator.getBattery()` (`third_party/blink/renderer/modules/battery/
> navigator_battery.idl`) has no `RuntimeEnabled` feature-flag guard — it's
> gated only by `[SecureContext]`, so it's callable from any HTTPS page in
> every build, this fork included. An earlier version of this patch simply
> omitted the `map->Add<device::mojom::BatteryMonitor>(...)` registration
> for `CUSTOM_BROWSER` builds instead of stubbing it — which crashed the
> renderer outright (`RESULT_CODE_KILLED_BAD_MESSAGE`, "no binder found for
> interface ... for the frame/document scope") on any page whose JS called
> `navigator.getBattery()`, including some YouTube ads/analytics script
> that runs specifically on video and video-preview pages. Chromium treats
> a renderer requesting a completely unregistered interface as a sign of a
> misbehaving process and kills it outright — a much harsher failure mode
> than a normal refused/closed Mojo connection, which
> `blink::BatteryDispatcher` already handles gracefully (its pending
> `QueryNextStatus()` callback is just dropped). Fixed 2026-07-21 by
> keeping the registration but stubbing the implementation instead of
> removing the registration.

### Telemetry pruning (opt-in, default off)

Build-time file deletion and domain substitution inspired by ungoogled-chromium.
Controlled by `"telemetry_hardening_enabled": false` in `package.json` config.
When enabled, `applyTelemetryPruning.py` runs after patch application and before
`gn gen`:

- **File pruning** — deletes source files listed in
  `custom/build/telemetry/pruning.list` (UMA observer, crash uploader,
  variations field trial creator, etc.) before compilation.
- **Domain substitution** — applies regex replacements from
  `custom/build/telemetry/domain_substitution.list`, replacing Google telemetry
  endpoint domains with non-routable `.invalid` equivalents.

See `src/custom/build/commands/lib/applyTelemetryPruning.py` for implementation
and the `harden` / `harden:dry-run` npm scripts for manual invocation.

---

---

## Future enhancements

Potential improvements identified from analysis of open-source privacy-browser
projects (Breeze-Core, PMC, Aviator). Ordered roughly by implementation effort.

| Enhancement | Where to add | Description |
|---|---|---|
| **Per-tab stats in Privacy Shield** ✅ | `privacy_shield_handler.cc`, `PrivacyStatsTabHelper` | **Done.** Ads blocked, params stripped, referrers stripped, and trackers on page are now shown in the shield bubble for the active tab. |
| **Filter list curation** | `custom/components/privacy_guard/core/url_purify_default_rules.cc` | The URL Purify rule set currently ships a static list. Periodically syncing against the upstream ClearURLs `data.min.json` rule list (via a component updater or a build-time fetch) would keep tracking parameter coverage current without requiring a full browser release. |
| **uBlock filter list freshness** | `custom/browser/net/blockers/` | The bundled ad-block filter rules in `bundled_filter_rules.cc` are static at build time. Adding a background fetch of EasyList / EasyPrivacy from a CDN with signature verification would keep block coverage current between releases. The throttle already evaluates a `flat_set<std::string>` host map; freshness is a loader concern only. |
| **Referrer policy grades** | `referrer_control_throttle.h/.cc` | Instead of a binary strip/keep, expose three modes: *strip-all*, *same-origin only* (send referrer only when first- and third-party share a host), and *off*. This would allow users who need referrers for login flows to choose a less invasive mode. |
| **Connection Control rule import/export** | `custom/browser/security/connection_control/` | Allow exporting the current rule set as JSON and importing from a file or URL. This makes it easier to share corporate allowlists and deny rules across managed deployments. |
| **Tracking dashboard toolbar button** | New `TrackingDashboardButton` toolbar view | A badge showing the tracker count for the current tab (using `TrackingRelationshipService::GetTrackerCountForSite()`), opening the full dashboard on click. Same pattern as `PrivacyShieldButton`. |

---

## Related docs

- [privacy-shield.md](privacy-shield.md) — unified toolbar toggle panel for all six features
- [tracking-dashboard.md](tracking-dashboard.md) — passive third-party tracker relationship visualiser
- [de-googling.md](de-googling.md) — telemetry pruning, feature flag overrides, and pref defaults that reduce Google data flows
