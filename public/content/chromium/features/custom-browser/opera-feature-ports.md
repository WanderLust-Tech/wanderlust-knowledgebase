# Opera Feature Ports

Features ported from the Opera 16 (Chromium-based) source release. Opera 16 was the first
Chromium-based Opera browser; its modifications were surgical patches on top of the content
layer and a proprietary `libopera.a` shell. The features below are the subset that are
applicable and self-contained enough for our build.

---

## Source analysis

`D:\Code\_To_Use\_chromium\opera\OPERA16_CHROMIUM_FEATURES.md`

---

## 1. Search in Error Pages

Opera embedded a search box on DNS and connection error pages so users can immediately
search rather than navigating back to the address bar.

**Build flag:** `BUILDFLAG(CUSTOM_BROWSER)`

**Behaviour:** When Chromium shows a network error page (DNS failure, connection refused,
connection timeout, etc.) and the error is not an offline/cached-page error, a search form
appears below the reload button. Submitting the form navigates to
`https://www.google.com/search?q=<query>`.

Not shown for:
- Offline errors (dino page)
- POST-request failures
- Pages blocked by extension
- HTTP error codes (4xx/5xx) — the server responded, so the user knows the site exists
- Subframes (the search box only makes sense in the main frame)

**Call chain:**

```
Network navigation failure
  └─► LocalizedError::GetPageState()     components/error_page/common/localized_error.cc
        #if BUILDFLAG(CUSTOM_BROWSER)
        Sets strings: showSearchBox=true, searchBoxUrl, searchBoxPlaceholder
        (only when !is_offline_error && !is_blocked_by_extension && !is_post
         && error_domain == kNetErrorDomain)

  └─► neterror.ts → getHtml()            components/neterror/resources/neterror.ts
        Renders #error-search-box <form> when data.showSearchBox is true
        @submit → errorSearchSubmit() → window.location.href = url + encodeURIComponent(query)

  └─► neterror.css                       components/neterror/resources/neterror.css
        Styles #error-search-box: flex layout, input focus ring, dark-mode support
```

**Files modified:**

| File | Change |
|---|---|
| `components/error_page/common/localized_error.cc` | Injects `showSearchBox`, `searchBoxUrl`, `searchBoxPlaceholder` into `PageState.strings` for net errors |
| `components/neterror/resources/neterror.ts` | Adds `showSearchBox?`/`searchBoxUrl?`/`searchBoxPlaceholder?` to `TemplateData`; adds `errorSearchSubmit` handler; renders `#error-search-box` in template |
| `components/neterror/resources/neterror.css` | Styles for `#error-search-box`, dark-mode support |

---

## 2. Disabled Feature Flags (Opera-style)

Opera explicitly disabled several Chrome features in its build config to reduce attack
surface and binary size. Applicable flags for this build:

| GN arg | Value | Status |
|---|---|---|
| `enable_nacl` | `false` | **Already set** in `src/out/Debug/args.gn` |
| `enable_supervised_users` | would be `false` | **Cannot disable** — `assert(enable_supervised_users)` in `chrome/browser/BUILD.gn` |
| `enable_one_click_signin` | would be `false` | **Removed** from modern Chromium |
| `enable_google_now` | would be `false` | **Removed** from modern Chromium |

No changes needed beyond what is already in `args.gn`.

---

---

## 3. Download Enhancement Manager

Already implemented as `TorrentDownloadInterceptor`.

**Files:**
- `custom/browser/bittorrent/torrent_download_interceptor.h/.cc` — `DownloadManager::Observer` that watches every created download. On `COMPLETE` state for any `.torrent`/`application/x-bittorrent` item: calls `BittorrentService::AddTorrentFile()`, defers `item->Remove()` to unwind the observer stack, deletes the temp file from disk, and navigates the originating tab to `chrome://bittorrent`.

No additional handlers are needed — PDF opens via Chromium's built-in viewer; there are no other file types requiring custom routing.

---

## 4. Per-Site Preferences (UA Overrides)

Already implemented as `UAOverrideService` + `UAOverrideThrottle`.

**Files:**
- `custom/browser/net/ua_override/ua_override_service.h/.cc` — `KeyedService` that parses `custom.ua_overrides` (`kCustomUAOverrides`) from profile prefs. Rules are a JSON array: `[{"domain": "*.netflix.com", "ua": "Mozilla/5.0 ..."}, ...]`. Domain supports `*` globs via `base::MatchPattern`. `GetRules()` returns a snapshot safe to pass to the IO thread.
- `custom/browser/net/ua_override/ua_override_throttle.h/.cc` — `URLLoaderThrottle` that matches the request host against the rule snapshot and injects `User-Agent:` / `Sec-CH-UA*` headers before the request goes out.
- `custom/browser/custom_content_browser_client.cc` — wires the throttle into `CreateURLLoaderThrottles()` at line 525.

Pref key: `prefs::kCustomUAOverrides` (`custom.ua_overrides`)  
Global mode key: `prefs::kCustomGlobalUAMode` (`custom.user_agent.global_mode`) — values: `"default"` | `"firefox"` | `"chrome_stable"`.

---

## Features analysed but not ported

| Opera Feature | Reason skipped |
|---|---|
| Browser Embedding Architecture (#1) | We patch in-tree, not a content-shell embed |
| Custom WebUI Scheme (#2) | We use `chrome://`; custom scheme not a goal |
| Memory Allowance System (#3) | High difficulty; superseded by Chromium's MemoryCoordinator |
| GPU Bitmap Pool (#4) | Superseded by Viz compositor |
| Accelerated Widget Manager (#5) | Superseded by `ui::Compositor`/`viz::Display` |
| JS Plugins Thread (#6) | No JSAPI plugin system in this build |
| Custom Spellchecker (#7) | Chromium already ships Hunspell; no delta |
| External Media Player (#8) | TV/embedded target only |
| Android Selection Popup (#11) | Android only |
| Scroll Offset Sampler (#12) | No scroll analytics use case |
| Mouse Listener (#13) | No gesture/hover overlay use case |
| User Agent Customization (#14) | Covered by Bloomberg port |
| Build/Version System (#15) | Already in place |
| Locale/Resource System (#16) | Not doing custom localization |
| NativeFDParcelable (#19) | Android only |
| WebDriver (#20) | ChromeDriver already works |
