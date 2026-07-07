# Autoscroll (Middle-Click Scroll)

Controls whether middle-click autoscroll is available to the user. When
disabled, clicking the middle mouse button on a page no longer activates the
scroll-anchor cursor mode that lets the user pan by moving the mouse.

## Build flag

Controlled by `enable_autoscroll_disabled = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).
Enabled (i.e. the feature can be disabled at runtime) by default. At the C++
level this surfaces as `BUILDFLAG(ENABLE_AUTOSCROLL_DISABLED)` from
`custom/buildflags/custom_features_buildflags.h`.

## Preference

| Detail | Value |
|---|---|
| Pref name | `custom.webkit.autoscroll_disabled` |
| C++ constant | `prefs::kCustomWebKitAutoscrollDisabled` in `custom/common/custom_pref_names.h` |
| Type | Boolean |
| Default | `pref_defaults.autoscroll_disabled` (resolved at registration time in `prefs_tab_helper.cc`) |

The pref is registered per-profile in `chrome/browser/ui/prefs/prefs_tab_helper.cc`
(via patch), watched by `pref_watcher.cc` so changes propagate to `WebPreferences`
without a restart, and allow-listed in `settings_private/prefs_util.cc` so the
settings WebUI can read and write it.

## How it works

The pref flows through Chromium's WebPreferences pipeline:

1. `prefs_tab_helper.cc` reads `kCustomWebKitAutoscrollDisabled` and writes it
   into `blink::web_pref::WebPreferences::autoscroll_disabled` (a field added
   via patch to `web_preferences.h` / `web_preferences.mojom`).
2. The `WebPreferences` struct is serialised over Mojo and delivered to the
   renderer.
3. In `third_party/blink/renderer/core/exported/web_view_impl.cc` (patched):
   ```cpp
   #if BUILDFLAG(CUSTOM_BROWSER)
   RuntimeEnabledFeatures::SetMiddleClickAutoscrollEnabled(
       !prefs.autoscroll_disabled);
   #endif
   ```
   When the pref is `true`, Blink's `MiddleClickAutoscroll` runtime feature is
   switched off for that WebContents.

Changes to the pref take effect immediately on the next WebPreferences update
(no reload required).

## Settings UI

The toggle lives in **Settings → Others → Web content**.

| File | Role |
|---|---|
| [`src/custom/browser/resources/settings/others_page/others_page.html`](../src/custom/browser/resources/settings/others_page/others_page.html) | `<settings-checkbox>` bound to `prefs.custom.webkit.autoscroll_disabled` |
| `chrome/browser/ui/webui/settings/settings_localized_strings_provider.cc` (patch) | Registers `customWebContentGroupName` / `customWebContentAutoscrollDisabled` i18n keys |
| [`src/custom/app/generated_resources.grdp`](../src/custom/app/generated_resources.grdp) | `IDS_OPTIONS_WEB_CONTENT_GROUP_NAME` ("Web content"), `IDS_OPTIONS_WEB_CONTENT_AUTOSCROLL_DISABLED` ("Disable autoscroll") |

## Key files

| File | Role |
|---|---|
| [`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni) | `enable_autoscroll_disabled` flag |
| [`src/custom/buildflags/BUILD.gn`](../src/custom/buildflags/BUILD.gn) | Emits `BUILDFLAG(ENABLE_AUTOSCROLL_DISABLED)` |
| [`src/custom/common/custom_pref_names.h`](../src/custom/common/custom_pref_names.h) | `kCustomWebKitAutoscrollDisabled` constant |
| `src/custom/patches/chrome-browser-ui-prefs-prefs_tab_helper.cc.patch` | Pref registration + WebPreferences write |
| `src/custom/patches/chrome-browser-ui-prefs-pref_watcher.cc.patch` | Live-update on pref change |
| `src/custom/patches/chrome-browser-extensions-api-settings_private-prefs_util.cc.patch` | Allow-list for settings WebUI |
| `src/custom/patches/third_party-blink-renderer-core-exported-web_view_impl.cc.patch` | `SetMiddleClickAutoscrollEnabled` call |
| `src/custom/patches/third_party-blink-public-common-web_preferences-web_preferences.h.patch` | `autoscroll_disabled` field in `WebPreferences` |
| `src/custom/patches/third_party-blink-public-mojom-webpreferences-web_preferences.mojom.patch` | Mojo serialisation of the field |
