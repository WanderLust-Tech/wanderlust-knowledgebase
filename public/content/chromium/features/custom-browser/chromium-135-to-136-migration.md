# Chromium 135 → 136 Migration Notes

> **Branch:** `master`  
> **Chromium tag:** `refs/tags/135.0.7049.117` → `136.0.7103.116`  
> **Date:** June 2026  
> **Commits:** `a5caec18` (tag bump) · `4f11cc69` (patch rebase + custom code)

---

## Table of Contents

1. [Sync & Init](#1-sync--init)
2. [Patch Rebase](#2-patch-rebase)
3. [Build System](#3-build-system)
4. [C++ API Changes](#4-c-api-changes)
5. [Removed Upstream Headers](#5-removed-upstream-headers)
6. [New Assets](#6-new-assets)
7. [Patch Cleanup](#7-patch-cleanup)
8. [Known Remaining Issues](#8-known-remaining-issues)

---

## 1. Sync & Init

### 1.1 Tag bump

`src/custom/package.json` — updated the Chromium tag:

```diff
-"tag": "135.0.7049.117",
+"tag": "136.0.7103.116",
```

No infrastructure issues this cycle. The 135 `_repair_incomplete_git_repo()` fix from the previous upgrade handled the sync cleanly.

---

## 2. Patch Rebase

Systematic context shifts across ~250 patches were resolved. Upstream line-number drift from upstream additions/removals caused the bulk of failures; no entirely new concepts were needed for most hunks.

### 2.1 Deleted upstream functionality (patches removed)

| Deleted patch | Reason |
|---|---|
| `chrome-browser-ui-extensions-extension_install_ui.cc.patch` | `extension_install_ui.cc` removed upstream — split into desktop/non-desktop variants in M135 |
| `chrome-browser-ui-webui-about-about_ui.cc copy.patch` / `.h copy.patch` | Obsolete copy; canonical patch retained |
| `chrome-browser-ui-toolbar-web_app_toolbar_button_container.cc.patch` | Container class removed upstream |
| `browser_command-browser_command_handler.cc.patch` | Handler class removed upstream |
| `chrome-browser-ui-webui-settings-read_anything-read_anything_toolbar.html.patch` | read_anything toolbar HTML restructured; patch no longer applies |

---

## 3. Build System

### 3.1 Resource ID allocation (`resource_ids_custom.spec`)

Several GRDs changed size or were added in 135/136:

| GRD | Change | Notes |
|---|---|---|
| `chrome/browser/resources/glic/resources.grd` | Size 17 → 25 | GLIC grew in M136 |
| `chrome/browser/resources/side_panel/history/resources.grd` | **New** at ID 4855 | Side-panel history added in M135, separate from `history_clusters` |
| `chrome/browser/resources/signin/history_sync_optin/resources.grd` | **New** at ID 4986 | History sync opt-in flow added in M135 |
| `components/data_sharing/data_sharing_internals/resources.grd` | **New** at ID 7312 | `data_sharing_internals` moved from `chrome/browser` to `components` |

### 3.2 Settings WebUI build gate

`browser/resources/settings/BUILD.gn` now branches on `enable_custom_webui`. When the React WebUI is active the `preprocess` target becomes an empty group (no-op) instead of calling `preprocess_if_expr`:

```gn
if (!enable_custom_webui) {
  preprocess_if_expr("preprocess") { ... }
} else {
  group("preprocess") { }   # empty group keeps deps from breaking
}
```

### 3.3 `custom_grit_args.gni` — new define

Added `_enable_custom_webui` to `custom_grit_defines` so GRD/TS files can conditionalize on the React WebUI flag:

```diff
+"_enable_custom_webui=${enable_custom_webui}",
```

### 3.4 `browser_view.h.patch` — `__has_include` buildflags guard

The patch now wraps the custom-features buildflag include with a `__has_include` guard. This lets the header compile in unit-test targets that don't pull in the full custom overlay:

```cpp
#if __has_include("custom/buildflags/custom_features_buildflags.h")
#include "custom/buildflags/custom_features_buildflags.h"
#else
#ifndef BUILDFLAG_INTERNAL_BOTTOM_BAR
#define BUILDFLAG_INTERNAL_BOTTOM_BAR() (0)
#endif
// ... other fallback defines
#endif
```

---

## 4. C++ API Changes

### 4.1 `views::CreateThemedSolid*` → `views::CreateSolid*`

The "Themed" variants that accepted a `ColorId` were merged into the plain overloads. The call signature is identical; only the function name changed.

```cpp
// Before (M135)
SetBackground(views::CreateThemedSolidBackground(kColorToolbar));
SetBorder(views::CreateThemedSolidSidedBorder(insets, kColorToolbarSeparator));

// After (M136)
SetBackground(views::CreateSolidBackground(kColorToolbar));
SetBorder(views::CreateSolidSidedBorder(insets, kColorToolbarSeparator));
```

**Files fixed:**
- `custom/browser/ui/views/frame/sidebar_container_view.cc` (3 sites)
- `custom/browser/ui/views/frame/sidebar_top_pane.cc` (2 sites)
- `custom/browser/ui/views/frame/vertical_tab_bar.cc` (2 sites)

### 4.2 `views::Widget::InitParams` — ownership argument required

The single-argument constructor was removed. The ownership enum must now be passed explicitly as the first argument.

```cpp
// Before (M135)
views::Widget::InitParams params(views::Widget::InitParams::TYPE_WINDOW);

// After (M136)
views::Widget::InitParams params(
    views::Widget::InitParams::NATIVE_WIDGET_OWNS_WIDGET,
    views::Widget::InitParams::TYPE_WINDOW);
```

**Files fixed:**
- `custom/browser/ui/views/panels/panel_stack_view.cc`
- `custom/browser/ui/views/panels/panel_view.cc`

### 4.3 `install_static::kInstallModes` — moved from `.cc` to header as `inline constexpr`

Chromium M135 added a `static_assert` in `chrome/install_static/install_modes.h` that calls `kInstallModes.size()`. This requires the array definition to be visible at include time, so it can no longer live in a `.cc` file.

**Fix:** Delete the `.cc` definition; redeclare in the header as `inline constexpr` using `std::to_array<>`:

```cpp
// In custom_install_modes.h
inline constexpr auto kInstallModes = std::to_array<InstallConstants>({
    {
        .size = sizeof(InstallConstants),
        .index = CUSTOM_INDEX,
        // ... all fields ...
    },
});
```

The `.cc` file now only contains `kProductPathName`, `kProductPathNameLength`, and `kSafeBrowsingName`.

**Files changed:** `install_static/custom_install_modes.h` (rewrote), `install_static/custom_install_modes.cc` (stripped to 3 constants)

### 4.4 `safe_browsing::DeepScanningRequest::ShouldUploadBinary()` removed

The method was removed in M135. The call in `DownloadOptionsItemView::UpdateLabels()` selected between two string IDs based on the binary-upload check; without it both cases collapse to the generic scanning prompt.

**Fix:** Use `IDS_PROMPT_DEEP_SCANNING_DOWNLOAD` unconditionally:

```cpp
// Before
const int id = (model_->GetDownloadItem() &&
                safe_browsing::DeepScanningRequest::ShouldUploadBinary(
                    model_->GetDownloadItem()))
                   ? IDS_PROMPT_DEEP_SCANNING_DOWNLOAD
                   : IDS_PROMPT_DEEP_SCANNING_APP_DOWNLOAD;

// After
const int id = IDS_PROMPT_DEEP_SCANNING_DOWNLOAD;
```

**File fixed:** `custom/browser/ui/views/download/download_options_item_view.cc`

### 4.5 `views::BubbleDialogDelegateView` — friend declarations require global scope

`BubbleDialogDelegateView` uses `::ClassName` forward-declarations in its `friend` list, which requires all friended classes to live in the global namespace. `UpdateNotificationBubble` was declared inside `namespace custom`, triggering a hard error when the friend list was tightened in M136.

**Fix in `update_notification_ui.h`:** Move `UpdateNotificationBubble` out of `namespace custom`. `UpdateNotificationManager` remains inside `namespace custom`.

```cpp
// UpdateNotificationBubble is in global scope so BubbleDialogDelegateView
// can friend it.
class UpdateNotificationBubble : public views::BubbleDialogDelegateView,
                                 public custom::UpdateObserver { ... };

namespace custom {
class UpdateNotificationManager : public UpdateObserver { ... };
}
```

**New patch added:** `patches/ui-views-bubble-bubble_dialog_delegate_view.h.patch` — adds forward declarations and `friend` entries for `UpdateNotificationBubble`, `SuperDragBubble`, and `custom::adblock::AdBlockBubbleView`.

**New patch added:** `patches/ui-views-window-dialog_delegate.h.patch` — friends `ConfirmInClosingTabsDialog`.

### 4.6 Extension bindings: `GetOrCreateCustom()` → `GetOrCreateGlobalObjectProperty()`

Chromium M136 refactored the private `GetOrCreateChrome(v8_context)` helper into a generic `GetOrCreateGlobalObjectProperty(v8_context, "chrome")`. The custom `GetOrCreateCustom()` function (which mirrored Chrome's original implementation) was removed from the patch and replaced with the same generic call:

```cpp
// Before
v8::Local<v8::Object> custom = GetOrCreateCustom(v8_context);

// After
v8::Local<v8::Object> custom =
    GetOrCreateGlobalObjectProperty(v8_context, "custom");
```

The `GetOrCreateCustom()` function body (~40 lines) was deleted from `native_extension_bindings_system.cc.patch` since the upstream generic function now handles it.

**File fixed:** `patches/extensions-renderer-native_extension_bindings_system.cc.patch`

### 4.7 Missing `#include "chrome/app/chrome_command_ids.h"` in `rss_icon_view.cc`

Upstream header reorganisation removed a transitive inclusion of `chrome_command_ids.h`. Added the direct include.

**File fixed:** `custom/browser/ui/views/rss/rss_icon_view.cc`

---

## 5. Removed Upstream Headers

These includes were left in custom source files from M135; they compile-fail in M136 because the headers no longer exist.

| Removed include | File | Notes |
|---|---|---|
| `chrome/browser/ui/views/download/bubble/download_toolbar_button_view.h` | `bottombar_view.cc` | `DownloadToolbarButtonView` removed in M135 |
| `chrome/browser/ui/views/send_tab_to_self/send_tab_to_self_toolbar_icon_view.h` | `bottombar_view.cc` | `SendTabToSelf` toolbar icon removed in M135 |

Both includes were commented out (not deleted) as markers for the removal.

---

## 6. New Assets

Added Chromium M135/136 autofill identity-document save icons. These are required for the "save to autofill" flow when the user is prompted to save a driver's licence, passport, or vehicle title from a form.

| Asset | Sizes |
|---|---|
| `save_drivers_license.png` / `_dark.png` | 1× and 2× |
| `save_passport.png` / `_dark.png` | 1× and 2× |
| `save_vehicle.png` / `_dark.png` | 1× and 2× |

Source: `app/theme/default_{100,200}_percent/common/`. Entries were added to `app/theme/theme_resources.grd`.

---

## 7. Patch Cleanup

~25 "copy" patches (`*-BUILD.gn copy.patch`, etc.) were deleted. These were leftover duplicates from before the patch naming convention was stabilised. The canonical `.patch` files were kept.

Complete list of deleted copy patches:
`chrome-BUILD.gn copy`, `chrome-browser-ui-BUILD.gn copy`, `chrome-browser-navigator.cc copy`, `chrome-common-BUILD.gn copy`, `chrome-common-chrome_constants.cc copy`, `chrome-common-chrome_paths.cc copy`, `chrome-common-chrome_paths_linux.cc copy`, `chrome-chrome_paks.gni copy`, `chrome-installer-mini_installer-BUILD.gn copy`, `chrome-test-BUILD.gn copy`, `tabs-tab_hover_card_bubble_view.cc copy`, `browser_navigator.cc copy`, `about_ui.cc copy`, `about_ui.h copy`, `extensions-strings-BUILD.gn copy`, `tools-grit-grit_args.gni copy`, `components-strings-BUILD.gn copy`, `components-url_formatter-BUILD.gn copy`, `components-vector_icons-BUILD.gn copy`, `ios-build-chrome_build.gni copy`, `ios-chrome-app-resources-BUILD.gn copy`, `ios-chrome-browser-shared-model-paths-paths.mm copy`, `policy-core-common-policy_paths.cc copy`, `er-ui-browser_navigator.cc copy`.

---

## 8. Known Remaining Issues

| Issue | Status | Notes |
|---|---|---|
| `DeepScanningRequest::ShouldUploadBinary` gone | Mitigated | Both deep-scan prompt strings now map to the same ID; consider whether `IDS_PROMPT_DEEP_SCANNING_APP_DOWNLOAD` can be removed |
| `UpdateNotificationBubble` in global namespace | Done | Works, but the class conceptually belongs in `namespace custom`; revisit if Chromium ever opens up the friend mechanism |
| `kInstallModes` in header | Done | Requires the full include chain (`chrome_dll_resource.h`, `chrome_icon_resources_win.h`) in translation units that include `custom_install_modes.h` — watch for incremental-build slowdowns |
| iOS `kShortcutMinimumIndex` patch deleted | Done | Upstream tile constant moved; if iOS NTP shows only 4 shortcuts, this patch needs re-adding against the new file location |
