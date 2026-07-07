# Proxy Settings

Exposes a full proxy configuration UI that lets the user set the system proxy
without leaving the browser. Supports all proxy modes that Chromium's
`net::ProxyConfig` understands: system default, direct (no proxy),
auto-detect (WPAD), PAC script URL, manual single-proxy list, and
manual per-scheme proxy lists. Bypass rules and reverse-bypass are also
configurable.

The feature is available at two URLs:
- `chrome://proxy/` — the standalone legacy page (Bromite origin)
- `chrome://custom-settings/proxy` — the React custom settings UI
- `chrome://settings/customProxy` — the Polymer settings UI

## Build flag

Controlled by `enable_proxy_settings = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).
At the C++ level this surfaces as `BUILDFLAG(ENABLE_PROXY_SETTINGS)` from
`custom/buildflags/custom_features_buildflags.h`.

The Grit preprocessor variable `_enable_proxy_settings` (set in
[`src/custom/custom_grit_args.gni`](../src/custom/custom_grit_args.gni))
gates the HTML/TS template expansions in the Polymer settings UI.

## How it works

### JS → C++ messages

All three surfaces (`chrome://proxy/`, `chrome://custom-settings/`, and
`chrome://settings/`) share the same three `chrome.send()` messages handled by
`ProxySettingsHandler`:

| Message | Payload | Effect |
|---|---|---|
| `enableNotifyUIWithState` | — | Subscribe to config changes; immediately fires `onProxyConfigChanged` with the current state |
| `apply` | `[ProxyConfig]` | Parse the config object and write it to the `proxy_config::prefs::kProxy` pref |
| `clear` | — | Reset the pref to `ProxyConfigDictionary::CreateSystem()` (OS default) |

### C++ → JS callback

After every `apply`, `clear`, and on subscription, the handler calls:

```js
ProxyConfigView.getInstance().onProxyConfigChanged(state)
```

where `state` is either `{ pending: true }` (config not yet available) or
`{ pending: false, config: { ... } }` with the full `ProxyConfig` object.

### Proxy config object shape

```ts
interface ProxyConfig {
  auto_detect?: boolean;
  pac_url?: string;           // present iff mode == 'use-pac-url'
  pac_mandatory?: boolean;
  rules?: {
    type?: string;            // 'none' | 'direct' | 'list' | 'list_per_scheme'
    single_proxies?: string;
    proxies_for_http?: string;
    proxies_for_https?: string;
    proxies_for_ftp?: string;
    fallback_proxies?: string;
    bypass_rules?: string;
    reverse_bypass?: boolean;
  };
}
```

### Config → pref write

`ProxySettingsHandler::apply()` converts the config to a
`ProxyConfigDictionary` and writes it to `proxy_config::prefs::kProxy`
(`"proxy"`) in the local state `PrefService`. Chromium's network stack
observes this pref and picks up the change without a restart.

## C++ handler

`ProxySettingsHandler` (`custom/browser/ui/webui/proxy_settings_handler.h/cc`)
is a `content::WebUIMessageHandler` that also implements
`net::ProxyConfigService::Observer` to push config-change notifications to the
page. It is registered on:

- `chrome://proxy/` via `ProxyConfigUI` (legacy standalone page)
- `chrome://custom-settings/` via `CustomSettingsUI` (React settings)
- `chrome://settings/` via patch to `settings_ui.cc` (Polymer settings)

## Settings UI

### React (`chrome://custom-settings/proxy`)

| File | Role |
|---|---|
| [`src/custom/components/custom_settings/components/ProxyPage.tsx`](../src/custom/components/custom_settings/components/ProxyPage.tsx) | Full proxy form: mode radio buttons, conditional input sections, Apply/Reset/Clear buttons |
| [`src/custom/components/custom_settings/App.tsx`](../src/custom/components/custom_settings/App.tsx) | Route `'proxy'` → `<ProxyPage />`, `SUB_TO_PARENT` entry maps it to the Privacy & Security hub |
| [`src/custom/components/custom_settings/components/HubPages.tsx`](../src/custom/components/custom_settings/components/HubPages.tsx) | Hub card in `PrivacyAndSecurityHub` navigates to `'proxy'` |

### Polymer (`chrome://settings/customProxy`)

| File | Role |
|---|---|
| [`src/custom/browser/resources/settings/proxy_page/proxy_page.html`](../src/custom/browser/resources/settings/proxy_page/proxy_page.html) | Polymer template with `dom-if` sections for each proxy mode |
| [`src/custom/browser/resources/settings/proxy_page/proxy_page.ts`](../src/custom/browser/resources/settings/proxy_page/proxy_page.ts) | `SettingsCustomProxyPageElement` — sets up the `ProxyConfigView` singleton, delegates all `chrome.send()` calls |
| `chrome/browser/resources/settings/basic_page/basic_page.html` (patch) | Adds `<settings-custom-proxy-page>` section under `_enable_proxy_settings` |
| `chrome/browser/resources/settings/basic_page/basic_page.ts` (patch) | Imports `proxy_page.js` under `_enable_proxy_settings` |
| `chrome/browser/resources/settings/settings_menu/settings_menu.html` (patch) | Adds "Proxy settings" nav item with globe icon |
| `chrome/browser/resources/settings/route.ts` (patch) | Adds `r.CUSTOM_PROXY = r.BASIC.createSection('/customProxy', 'customProxy')` |
| `chrome/browser/resources/settings/icons.html` (patch) | Adds `custom-proxy` SVG icon |

### Localized strings

Strings follow the `customProxy*` JS key / `IDS_OPTIONS_PROXY_*` C++ constant
naming convention.

| File | Role |
|---|---|
| [`src/custom/app/generated_resources.grdp`](../src/custom/app/generated_resources.grdp) | `IDS_OPTIONS_PROXY_*` string constants |
| `chrome/browser/ui/webui/settings/settings_localized_strings_provider.cc` (patch) | `AddProxyStrings()` registers all `customProxy*` keys; called under `BUILDFLAG(ENABLE_PROXY_SETTINGS)` |

## Key files

| File | Role |
|---|---|
| [`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni) | `enable_proxy_settings` flag |
| [`src/custom/custom_grit_args.gni`](../src/custom/custom_grit_args.gni) | `_enable_proxy_settings` Grit define |
| [`src/custom/buildflags/BUILD.gn`](../src/custom/buildflags/BUILD.gn) | Emits `BUILDFLAG(ENABLE_PROXY_SETTINGS)` |
| [`src/custom/browser/ui/webui/proxy_settings_handler.h`](../src/custom/browser/ui/webui/proxy_settings_handler.h) | Handler declaration |
| [`src/custom/browser/ui/webui/proxy_settings_handler.cc`](../src/custom/browser/ui/webui/proxy_settings_handler.cc) | Handler implementation — `OnApply`, `OnClear`, `OnEnableNotifyUIWithState`, `encodeConfig`, `apply` |
| [`src/custom/browser/ui/webui/proxy_config_ui.cc`](../src/custom/browser/ui/webui/proxy_config_ui.cc) | Standalone `chrome://proxy/` WebUI controller |
| [`src/custom/browser/ui/webui/settings/custom_settings_ui.cc`](../src/custom/browser/ui/webui/settings/custom_settings_ui.cc) | Registers handler on `chrome://custom-settings/` |
| `src/custom/patches/chrome-browser-ui-webui-settings-settings_ui.cc.patch` | Registers handler on `chrome://settings/` |
| `src/custom/patches/net-proxy_resolution-proxy_config.h.patch` | Adds `ProxyRules::ToString()` declaration under `ENABLE_PROXY_SETTINGS` |
| `src/custom/patches/net-proxy_resolution-proxy_config.cc.patch` | Implements `ProxyRules::ToString()` |
| [`src/custom/browser/resources/settings/proxy_page/proxy_page.ts`](../src/custom/browser/resources/settings/proxy_page/proxy_page.ts) | Polymer element |
| [`src/custom/components/custom_settings/components/ProxyPage.tsx`](../src/custom/components/custom_settings/components/ProxyPage.tsx) | React component |
