# Smart Proxy Routing

Gated by `BUILDFLAG(ENABLE_SMART_PROXY_ROUTING)`. Per-domain proxy routing
rules stored in prefs. The browser dynamically generates a PAC (Proxy
Auto-Config) script from the rule list and applies it via the existing
Chromium proxy config system — no changes to the network stack. A toolbar
button reflects active/inactive state; full rule management lives at
`chrome://custom-settings/proxy-routing`.

## Build / activation

| Where | What |
|---|---|
| [`custom_browser_config.gni`](../src/custom/custom_browser_config.gni) | `enable_smart_proxy_routing = true` — gates source compilation and the buildflag |
| [`custom_branding_flags`](../src/custom/custom_browser_config.gni) | Emits `BUILDFLAG(ENABLE_SMART_PROXY_ROUTING)` into `branding_buildflags.h` for universal `#if`-gating |
| [`browser/ui/sources.gni`](../src/custom/browser/ui/sources.gni) | `if (enable_smart_proxy_routing)` block adds button + bubble `.cc`/`.h` pairs to `custom_browser_ui_sources` |
| Keyed service | `ProxyRoutingManager` — one per regular profile, lazy via `ProxyRoutingManagerFactory::GetForProfile(profile)`. OTR/incognito profiles are redirected to their parent profile's instance via `GetBrowserContextToUse`. Registered in `custom_browser_context_keyed_service_factories.cc` |
| Pref registration | `ProxyRoutingManager::RegisterProfilePrefs()` called from the patched `chrome/browser/prefs/browser_prefs.cc` under the buildflag gate |
| Toolbar wiring | `BrowserView::AddCustomViews()` in the patched `browser_view.cc` — instantiates `ProxyRoutingButton` |
| WebUI registration | [`custom_webui_controller_factory.cc`](../src/custom/browser/ui/webui/custom_webui_controller_factory.cc) — `chrome://proxy-routing-status` → `ProxyRoutingStatusUI` |
| URL constants | [`custom/common/webui_url_constants.h`](../src/custom/common/webui_url_constants.h) — `kChromeUIProxyRoutingStatusHost` / `kChromeUIProxyRoutingStatusURL` |

## Architecture

```
ProxyRoutingManager (KeyedService, per-profile)
  │  Stores: rules (ProxyRoutingRule[]) in kCustomProxyRoutingRules pref
  │           enabled (bool) in kProxyRoutingEnabled pref
  │  On rule or enabled-state change:
  │    1. Generates PAC script string from the active, enabled rules
  │    2. Encodes it as a data: URI
  │    3. Writes {mode=PAC_SCRIPT, pac_url=data:...} to kProxy pref
  │       → ProxySettingsHandler picks this up and applies it to the profile
  │  Notifies Observer list on every state change.
  │
  ├──► ProxyRoutingButton (ToolbarButton subclass)
  │      Observes ProxyRoutingManager via ScopedObservation.
  │      Icon: kGlobeIcon (inactive) / kSecurityIcon (active).
  │      Click → ProxyRoutingBubble::ShowBubble / close if already open.
  │
  │      └─► ProxyRoutingBubble (BubbleDialogDelegateView)
  │            ~320×200px, TOP_RIGHT anchor on the button.
  │            Hosts views::WebView loading chrome://proxy-routing-status.
  │            RegisterWindowClosingCallback → notifies button to clear bubble_.
  │
  │            └─► ProxyRoutingStatusUI (WebUIController)
  │                  Registers ProxyRoutingStatusHandler.
  │
  │                  └─► ProxyRoutingStatusHandler (WebUIMessageHandler)
  │                        Observes ProxyRoutingManager.
  │                        Exposes toggle and status query to the React bubble.
  │
  └──► ProxyRoutingPage (React, chrome://custom-settings/proxy-routing)
         Full rule management UI (table, add/edit/delete).
         Talks to ProxyRoutingSettingsHandler (extension of CustomSettingsHandler).
```

## How PAC generation works

Each enabled `ProxyRoutingRule` becomes one `shExpMatch` clause in the generated
`FindProxyForURL` function. Rules are applied in order; the first match wins.
Non-matching requests fall through to `DIRECT`.

Example — two rules produce:

```javascript
function FindProxyForURL(url, host) {
  if (shExpMatch(host, "*.corp.example.com")) return "PROXY 10.0.0.1:8080";
  if (shExpMatch(host, "internal.acme.com"))  return "PROXY 192.168.1.1:3128";
  return "DIRECT";
}
```

This string is base64-encoded into a `data:application/x-ns-proxy-autoconfig`
URI and written to the `kProxy` preference. Chromium's existing proxy machinery
— `ProxyConfigServiceImpl` → `PacFileFetcher` → `ProxyResolver` — handles it
from there without any custom code.

When `ProxyRoutingManager::SetEnabled(false)` is called (or all rules are
removed), it clears the `kProxy` pref back to `{mode: SYSTEM}`, restoring the
OS default.

## Rule data model

```
ProxyRoutingRule {
  id:      string   // UUID — stable identifier for edit/delete
  pattern: string   // domain glob, e.g. "*.corp.example.com"
  proxy:   string   // "PROXY host:port" or "DIRECT"
  enabled: bool     // per-rule toggle; disabled rules are excluded from PAC
}
```

Stored as a `base::Value::List` of dicts under the pref key
`custom.proxy_routing_rules`. `ProxyRoutingRule::ToValue()` /
`ProxyRoutingRule::FromValue()` handle serialization.

## JS ↔ C++ message protocol

### Status bubble (`chrome://proxy-routing-status`)

| Direction | Message | Payload | Notes |
|---|---|---|---|
| JS → C++ | `proxyRoutingGetStatus` | — | Returns `{enabled, activeRuleCount}` to the JS callback |
| JS → C++ | `proxyRoutingToggle` | `{enabled}` | Calls `SetEnabled()` on the manager; triggers PAC apply or clear |
| C++ → JS | `proxyRoutingStatusChanged` | `{enabled, activeRuleCount}` | Fired on every `OnProxyRoutingChanged()` observer notification |

### Settings page (`chrome://custom-settings/proxy-routing`)

| Direction | Message | Payload | Notes |
|---|---|---|---|
| JS → C++ | `proxyRoutingGetRules` | — | Returns `ProxyRoutingRule[]` |
| JS → C++ | `proxyRoutingAddRule` | `{pattern, proxy}` | Generates a UUID `id`, appends, regenerates PAC |
| JS → C++ | `proxyRoutingUpdateRule` | `{id, pattern, proxy, enabled}` | Replaces the matching rule by `id`, regenerates PAC |
| JS → C++ | `proxyRoutingDeleteRule` | `{id}` | Removes the rule, regenerates PAC |
| JS → C++ | `proxyRoutingReorderRules` | `{ids[]}` | Reorders rules to match the given ID list; PAC order affects match priority |

## File map

### Service layer

| File | Purpose |
|---|---|
| [`browser/net/proxy_routing_manager.{cc,h}`](../src/custom/browser/net/proxy_routing_manager.cc) | `KeyedService`. Stores rules + enabled state. PAC generation. Observer list (`base::ObserverList<Observer>`). `RegisterProfilePrefs()` |
| [`browser/net/proxy_routing_manager_factory.{cc,h}`](../src/custom/browser/net/proxy_routing_manager_factory.cc) | `BrowserContextKeyedServiceFactory`. `GetForProfile()` creates lazily (use in constructors/setup). `GetForProfileIfExists()` returns null without creating — safe to call during teardown or from reactive paths like `UpdateIcon()`. `GetBrowserContextToUse()` redirects OTR profiles to their parent via `GetBrowserContextRedirectedInIncognito`. |

### C++ Views layer

| File | Purpose |
|---|---|
| [`ui/views/toolbar/proxy_routing_button.{cc,h}`](../src/custom/browser/ui/views/toolbar/proxy_routing_button.cc) | `ToolbarButton` subclass. `ScopedObservation<ProxyRoutingManager>`. Updates icon on `OnProxyRoutingChanged()`. Opens/closes `ProxyRoutingBubble` |
| [`ui/views/proxy_routing/proxy_routing_bubble.{cc,h}`](../src/custom/browser/ui/views/proxy_routing/proxy_routing_bubble.cc) | `BubbleDialogDelegateView`. Hosts `views::WebView → chrome://proxy-routing-status`. Static `ShowBubble()` factory; private ctor (friended in `bubble_dialog_delegate_view.h`) |

### WebUI / handler layer

| File | Purpose |
|---|---|
| [`ui/webui/proxy_routing/proxy_routing_status_ui.{cc,h}`](../src/custom/browser/ui/webui/proxy_routing/proxy_routing_status_ui.cc) | `WebUIController` for the status bubble. Registers `ProxyRoutingStatusHandler` |
| [`ui/webui/proxy_routing/proxy_routing_status_handler.{cc,h}`](../src/custom/browser/ui/webui/proxy_routing/proxy_routing_status_handler.cc) | `WebUIMessageHandler`. Toggle + status query. Observes `ProxyRoutingManager` for `FireWebUIListener` notifications |
| [`ui/webui/custom_settings/proxy_routing_settings_handler.{cc,h}`](../src/custom/browser/ui/webui/custom_settings/proxy_routing_settings_handler.cc) | CRUD handler for the settings page. Extends `CustomSettingsHandler` comms |

### React front-end

| File | Purpose |
|---|---|
| [`components/custom_settings/pages/ProxyRoutingPage.tsx`](../src/custom/components/custom_settings/pages/ProxyRoutingPage.tsx) | Full settings page. Pathfinder `DataTable` (rule list), `Switch` (per-rule enabled toggle), `Button` (add/edit/delete), `Dropdown` (proxy type). Route: `/proxy-routing` |
| Status bubble React component | `components/proxy_routing_status/` — `Switch` for global toggle, rule count badge |

### Patches into vanilla Chromium

| File | What it changes |
|---|---|
| [`chrome/browser/ui/views/frame/browser_view.cc`](../src/chrome/browser/ui/views/frame/browser_view.cc) | Instantiates `ProxyRoutingButton` in `AddCustomViews()`, gated on `ENABLE_SMART_PROXY_ROUTING` |
| [`chrome/browser/ui/webui/chrome_web_ui_configs.cc`](../src/chrome/browser/ui/webui/chrome_web_ui_configs.cc) | Registers `ProxyRoutingStatusUIConfig` for `kChromeUIProxyRoutingStatusHost`, gated on the buildflag |
| [`chrome/browser/prefs/browser_prefs.cc`](../src/chrome/browser/prefs/browser_prefs.cc) | Calls `ProxyRoutingManager::RegisterProfilePrefs()` under the buildflag gate |
| [`custom/browser/custom_browser_context_keyed_service_factories.cc`](../src/custom/browser/custom_browser_context_keyed_service_factories.cc) | Calls `ProxyRoutingManagerFactory::GetInstance()` to ensure factory registration at startup |
| [`ui/views/bubble/bubble_dialog_delegate_view.h`](../src/ui/views/bubble/bubble_dialog_delegate_view.h) | Adds `friend class ::custom::ProxyRoutingBubble;` and the matching forward declaration |
| [`chrome/browser/ui/webui/settings/custom_settings_handler.cc`](../src/chrome/browser/ui/webui/settings/custom_settings_handler.cc) | Routes `proxy_routing*` messages to `ProxyRoutingSettingsHandler` under the buildflag gate |

## Interaction with existing proxy settings

Smart Proxy Routing writes to the same `kProxy` pref that
`chrome://proxy` / `chrome://custom-settings/proxy` writes to. If the user
has configured a manual proxy in the settings page **and** then enables Smart
Proxy Routing, the routing manager will overwrite that config with the generated
PAC. When routing is disabled, the manager restores `mode: SYSTEM` — not the
previously configured manual proxy.

For this reason the `ProxyRoutingSettingsHandler` shows a warning when enabling
routing if a non-system proxy is already configured.

## Threading

`ProxyRoutingManager` lives on the UI thread (as a `BrowserContextKeyedService`).
All pref reads/writes, PAC generation, and observer notifications happen there.
The PAC string itself is applied via the pref system synchronously on the UI
thread; `ProxyConfigServiceImpl` picks up the change on its sequence (typically
IO) via the pref-change notification.

## Testing

1. Build with `enable_smart_proxy_routing = true` (default).
2. Open any page. A globe icon should appear in the toolbar (inactive state).
3. Navigate to `chrome://custom-settings/proxy-routing`.
4. Add a rule: pattern `*.httpbin.org`, proxy `PROXY 127.0.0.1:8888`.
5. Run a local HTTP proxy on port 8888 (e.g. `mitmproxy -p 8888`).
6. Navigate to `https://httpbin.org/ip` — the IP in the response should be your
   proxy's outbound IP, not your machine's.
7. Open `chrome://net-internals/#proxy` → confirm the PAC script is active and
   the generated function contains the `shExpMatch` clause for `*.httpbin.org`.
8. Click the toolbar button → status bubble shows "Active · 1 rule".
9. Toggle off in the bubble → toolbar icon reverts to inactive; net-internals
   shows `mode: SYSTEM`.
10. Disable the rule via the per-rule toggle in settings → PAC is regenerated
    without that clause; traffic to httpbin.org goes direct again.

What "broken" looks like:

| Symptom | Likely cause |
|---|---|
| Button not in toolbar | `enable_smart_proxy_routing = false`, or `AddCustomViews()` patch missing, or `ENABLE_SMART_PROXY_ROUTING` buildflag not in `custom_branding_flags` |
| Toolbar button always shows inactive | `ProxyRoutingManager` not registered — check `custom_browser_context_keyed_service_factories.cc` |
| PAC not applied | `kProxy` pref write succeeds but `ProxyConfigServiceImpl` isn't watching this pref — verify `chrome/browser/prefs/browser_prefs.cc` patch |
| Rules not persisted across restarts | `kCustomProxyRoutingRules` pref not registered — `RegisterProfilePrefs()` must be called before any profile is created |
| Settings page route not found | `ProxyRoutingPage` not added to the custom-settings router, or the route path doesn't match `kChromeUIProxyRoutingPath` |
| net-internals shows no PAC | The `data:` URI encoding is wrong — check `ProxyRoutingManager::GeneratePacScript()` output with a `DLOG` |
| `AssertHashEqConsistent` crash / CHECK in `base.dll` inside abseil hash internals during window close or profile teardown | `GetForProfile(create=true)` was called on a profile whose `SupportsUserData::user_data_` map was already mid-teardown, triggering abseil's consistency check on the now-freed key slot. Fix: use `GetForProfileIfExists` (`create=false`) in any code path that runs reactively or during teardown — specifically `UpdateIcon()` and the button destructor. See also: `GetBrowserContextToUse` must be present to prevent OTR profiles from receiving their own independent service instance with a shorter, mismatched lifetime. |

## Known gaps

- **No import/export.** Rules can only be added via the UI form. A future
  iteration could accept a JSON file or a raw PAC script.
- **No pattern validation.** The `pattern` field is passed directly to
  `shExpMatch` in the generated PAC. An invalid glob will silently never match.
  Adding client-side validation against the `shExpMatch` grammar would prevent
  silent misconfigurations.
- **Overrides manual proxy config.** See the section above. A future improvement
  would merge the generated PAC with any existing PAC-URL or manual rules rather
  than replacing them entirely.
