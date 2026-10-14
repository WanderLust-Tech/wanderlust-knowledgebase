# Privacy Shield

A unified toolbar button that surfaces the status of all seven browser-level
privacy and security features in a single bubble panel, with per-feature
toggles. Clicking any toggle writes the corresponding pref immediately —
no page reload or settings navigation required.

---

## Build flag

Gated by `BUILDFLAG(ENABLE_PRIVACY_SHIELD)`. Controlled by `enable_privacy_shield = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

---

## What it does

The Privacy Shield button (shield icon) lives in the bottombar alongside the
existing custom toolbar buttons. Clicking it opens a 360×400 px bubble panel
showing seven feature rows, each with a label, a one-line description, and an
on/off toggle. Below the toggles a five-cell stats strip shows live per-tab
counts for the current page:

| Feature | Pref written | Default |
|---|---|---|
| Ad Blocker | `custom.enable_ad_block` | `true` |
| Force Private Mode | `custom.force_incognito` | `false` |
| Strip Referrer | `custom.strip_referrer` | `false` |
| Block Ping/Beacon | `custom.block_ping_beacon` | `false` |
| Disable WebGL | `custom.disable_webgl` | `false` |
| Session Cookies | `custom.session_only_cookies` | `false` |
| Connection Control | `custom.connection_control.enabled` | `false` |

As of v1.8.49, "Block Ping/Beacon" cancels `<a ping>`/`navigator.sendBeacon()`
requests (see [security-privacy-features.md](security-privacy-features.md)'s
"Ping/Beacon Blocking" section) — off by default, since some sites use
`sendBeacon` for functional, not just analytics, pings.

The stats strip shows five counters for the active tab, reset on each top-level
navigation:

| Stat | Source |
|---|---|
| Ads blocked | `AdBlockTabHelper::count()` |
| Params stripped | `PrivacyStatsTabHelper::params_stripped_count()` |
| Referrers stripped | `PrivacyStatsTabHelper::referrers_stripped_count()` |
| Pings blocked | `PrivacyStatsTabHelper::pings_blocked_count()` |
| Trackers on page | `TrackingRelationshipService::GetTrackerCountForSite(host)` |

The header shows a live count of how many features are currently active. The
footer links to `chrome://settings/privacy` for deeper configuration.

State changes made in the bubble are reflected in any other open settings panel
immediately (both sides observe the same prefs via `PrefChangeRegistrar`).

---

## Per-site ad blocking (v1.11.9)

When the active tab is an `http(s)` page, a row at the top of the bubble reads
**"Ad blocking on this site"**, shows the page's host, and has a toggle for the
*effective* state on that host:

- Switching it sets an override for **exactly that host** — on *or* off,
  whatever the global Ad Blocker switch says. It is the escape hatch for a site
  that breaks with ad blocking on, and it also lets you keep blocking on a few
  sites with the global switch off.
- Once an override exists the row says "always on / off for this site" and shows
  **Use default**, which removes the override so the site follows the global
  switch again.
- The page that is already loaded keeps its old filtering; the row says
  *Reload the page to apply*.
- The override covers **ad blocking and element-hiding only**. Strip Referrer,
  Ping/Beacon blocking, WebGL, cookies and the rest stay global in this bubble.
- It is per **host**, not per registrable domain: `www.example.com` and
  `example.com` are different entries.
- The row is hidden on `chrome://`, `file:` and other non-http(s) pages, and in
  incognito windows.

Overrides are stored in the existing per-domain shields setting
(`custom.domain_shields`). Hand-written wildcard entries such as `*.example.com`
are honoured but never edited by the bubble; an entry the bubble creates goes
first in the list so it wins over them. "Use default" removes only the exact-host
entry (and that host from the older `custom.ad_block_exceptions` list), so a
hand-written wildcard that still matches keeps applying.

---

## Architecture

```
PrivacyShieldButton (ToolbarButton subclass)
│  Icon: kSecurityIcon.
│  Click → opens / closes PrivacyShieldBubble.
│  Destructor closes the bubble if it is still open.
│
└─► PrivacyShieldBubble (BubbleDialogDelegateView)
      360×400 px, TOP_RIGHT anchor, no title bar / close button.
      Hosts views::WebView loading chrome://privacy-shield.
      RegisterWindowClosingCallback → clears button's bubble_ pointer.
│
      └─► PrivacyShieldUI (WebUIController)
            chrome://privacy-shield
            Registers PrivacyShieldHandler.
            CSP: script-src chrome://resources 'self'
                 style-src  chrome://resources 'self' 'unsafe-inline'
│
            └─► PrivacyShieldHandler (WebUIMessageHandler)
                  On JS ready: registers PrefChangeRegistrar for all 7 prefs.
                  Fires privacyShieldStatusChanged on any pref change.
                  Queries per-tab stats from AdBlockTabHelper,
                  PrivacyStatsTabHelper, and TrackingRelationshipService
                  via chrome::FindBrowserWithProfile() → active WebContents.
                  │
                  ├── privacyShieldGetStatus()  → ShieldStatus dict
                  └── privacyShieldSetFeature(feature, enabled) → void

React app (custom_privacy_shield component)
  chrome://privacy-shield/custom_privacy_shield.js
  Sends privacyShieldGetStatus on mount.
  Listens for privacyShieldStatusChanged for live updates.
  Renders a toggle row per feature; each toggle calls privacyShieldSetFeature.
```

---

## File map

| Path | Purpose |
|---|---|
| `custom/common/webui_url_constants.h` | `kChromeUIPrivacyShieldHost` / `kChromeUIPrivacyShieldURL` |
| `custom/common/custom_pref_names.h` | `kToolbarShowPrivacyShieldButton` |
| `custom/browser/prefs/custom_prefs.cc` | Registers `kToolbarShowPrivacyShieldButton` (default `true`) |
| `custom/browser/ui/webui/privacy_shield/privacy_shield_ui.h/.cc` | WebUIController + config |
| `custom/browser/ui/webui/privacy_shield/privacy_shield_handler.h/.cc` | WebUIMessageHandler — pref reads/writes, per-tab stats, live push |
| `custom/browser/privacy_stats/privacy_stats_tab_helper.h/.cc` | Per-tab params/referrer strip counter; resets on primary-frame navigation |
| `custom/browser/ui/views/privacy_shield/privacy_shield_bubble.h/.cc` | `BubbleDialogDelegateView` |
| `custom/browser/ui/views/toolbar/privacy_shield_button.h/.cc` | `ToolbarButton` subclass |
| `custom/browser/ui/views/bottombar/bottombar_view.h/.cc` | Button instantiation + pref watcher |
| `custom/browser/ui/sources.gni` | Adds bubble + button `.cc` pairs to `custom_browser_ui_sources` |
| `custom/browser/ui/webui/BUILD.gn` | Adds handler + UI `.cc` pairs to the webui target |
| `custom/components/custom_privacy_shield/` | React app bundle |
| `custom/patches/chrome-browser-ui-webui-chrome_web_ui_configs.cc.patch` | Registers `PrivacyShieldUIConfig` |

---

## Toolbar visibility

The button's visibility is controlled by `prefs::kToolbarShowPrivacyShieldButton`
(bool, default `true`). Toggling it hides/shows the button without requiring a
restart, via `BooleanPrefMember show_privacy_shield_button_` in `BottombarView`.

---

## JS ↔ C++ message protocol

```typescript
// JS → C++
window.cr.sendWithPromise<ShieldStatus>('privacyShieldGetStatus')

// JS → C++ (fire-and-forget)
window.chrome.send('privacyShieldSetFeature', [feature: string, enabled: bool])

// JS → C++ (fire-and-forget). Per-site ad blocking for the ACTIVE TAB'S host
// (the host is read in C++, never taken from JS): true/false sets the
// override, null clears it.
window.chrome.send('privacyShieldSetSiteAdBlock', [enabled: boolean | null])

// C++ → JS (pushed whenever any of the 7 prefs changes)
cr.addWebUIListener('privacyShieldStatusChanged', (status: ShieldStatus) => {})

// ShieldStatus shape
interface ShieldStatus {
  // Feature toggle states
  adBlockEnabled:    boolean;
  forceIncognito:    boolean;
  stripReferrer:     boolean;
  blockPingBeacon:   boolean;
  disableWebGL:      boolean;
  sessionCookies:    boolean;
  connectionControl: boolean;
  // Per-tab stats for the currently active tab (reset on navigation)
  adBlockCount:          number;
  paramsStrippedCount:   number;
  referrersStrippedCount: number;
  pingsBlockedCount:     number;
  trackersOnPageCount:   number;
  // Per-site ad blocking for the active tab (v1.11.9)
  siteHost:            string;   // '' => the row is hidden
  siteAdBlock:         boolean;  // effective state for siteHost
  siteAdBlockOverride: 'on' | 'off' | 'inherit';
}
```

The `feature` string in `privacyShieldSetFeature` must be one of:
`adBlock`, `forceIncognito`, `stripReferrer`, `blockPingBeacon`,
`disableWebGL`, `sessionCookies`, `connectionControl`.

---

## Related docs

- [security-privacy-features.md](security-privacy-features.md) — the seven features the shield controls
- [smart-proxy-routing.md](smart-proxy-routing.md) — similar toolbar button / bubble / WebUI pattern
