# Chromium 136 → 137 Migration Notes

> **Branch:** `master`  
> **Chromium tag:** `refs/tags/136.0.7103.116` → `137.0.7151.122`  
> **Date:** June 2026  
> **Commits:** `5d739c4` (tag bump) · *(patch rebase + custom code — pending commit)*

---

## Table of Contents

1. [Sync & Init](#1-sync--init)
2. [Patch Rebase](#2-patch-rebase)
3. [Build System](#3-build-system)
4. [C++ API Changes](#4-c-api-changes)
5. [Removed / Moved Upstream Headers](#5-removed--moved-upstream-headers)
6. [New Assets](#6-new-assets)
7. [Known Remaining Issues](#7-known-remaining-issues)

---

## 1. Sync & Init

### 1.1 Tag bump

`src/custom/DEPS` — updated the Chromium tag:

```diff
-"tag": "136.0.7103.116",
+"tag": "137.0.7151.122",
```

No infrastructure issues this cycle.

---

## 2. Patch Rebase

Systematic context offsets re-aligned across ~250 patches (upstream line-number drift from M137 additions/removals). No entirely new concepts were needed for most hunks.

### 2.1 Moved upstream file (patch relocated)

`ntp_background_service.cc` moved from `chrome/browser/search/background/` to `components/themes/` in M137.

| Old patch | New patch |
|---|---|
| `chrome-browser-search-background-ntp_background_service.cc.patch` | `components-themes-ntp_background_service.cc.patch` |

The patch content (commented-out `FetchCollectionInfo` early-return guard) is identical; only the file path changed.

### 2.2 New patch

`ui-views-widget-widget_delegate.h.patch` — created to friend custom `WidgetDelegateView` subclasses (see [§4.1](#41-views-widgetdelegateview-default-constructor-made-private)).

---

## 3. Build System

### 3.1 Resource ID allocation (`resource_ids_custom.spec`)

| GRD | Change | Notes |
|---|---|---|
| `chrome/browser/resources/new_tab_footer/resources.grd` | **New** at ID 4390 (20 includes) | `new_tab_footer` WebUI added in M137 |
| NTP background service GRD | Size 15 → 25 includes | Grew in M137 |
| Custom strings GRD | messages 622 → 650 | New M137 strings pulled in |

### 3.2 `feature_first_run` BUILD.gn patch

A new patch `chrome-browser-ui-feature_first_run-BUILD.gn.patch` was added to wire the `autofill_ai_first_run_dialog` target into the custom build. This target references `IDR_AUTOFILL_AI_FFR_BANNER` / `IDR_AUTOFILL_AI_FFR_BANNER_DARK` which required new assets (see [§6](#6-new-assets)).

---

## 4. C++ API Changes

### 4.1 `views::WidgetDelegateView` default constructor made private

M137 made `WidgetDelegateView()` private (accessible only to an explicit `friend` list in `widget_delegate.h`). All custom subclasses that inherit from it and call the default constructor implicitly needed to be friended.

**New patch:** `ui-views-widget-widget_delegate.h.patch`

For each class, two changes were required in `widget_delegate.h`:
1. A global-namespace forward declaration in the block at the top of the file.
2. A `friend class ::ClassName;` entry in `WidgetDelegateView`'s private section.

| Class | Location | Notes |
|---|---|---|
| `PanelView` | `custom/browser/ui/views/panels/panel_view.h` | |
| `PanelStackWindow` | `custom/browser/ui/views/panels/panel_stack_view.cc` | Defined in anonymous namespace — had to move to global namespace first (see §4.2) |
| `UndockedSidebarWidget` | `custom/browser/ui/views/sidebar/undocked_sidebar_widget.h` | |
| `MouseGestureWidgetDelegateViewWin` | `custom/browser/mouse_gesture/mouse_gesture_widget_delegate_view_win.h` | |

### 4.2 `PanelStackWindow` — moved out of anonymous namespace

`PanelStackWindow` was defined inside `namespace { }` in `panel_stack_view.cc`. Anonymous-namespace classes cannot be referenced by name from outside the TU, so `friend class ::PanelStackWindow` in `widget_delegate.h` would fail to resolve it.

**Fix:** Removed the `namespace { }` wrapper. The class and all its method implementations are now at global scope in `panel_stack_view.cc`.

### 4.3 `TabSlotView::ViewType::kGroupHeader` renamed to `kTabGroupHeader`

The `kGroupHeader` enumerator in `TabSlotView::ViewType` was renamed to `kTabGroupHeader` in M137.

```cpp
// Before (M136)
TabSlotView::ViewType::kGroupHeader

// After (M137)
TabSlotView::ViewType::kTabGroupHeader
```

**File fixed:** `patches/chrome-browser-ui-views-tabs-tab_strip_layout_helper.cc.patch` (2 occurrences)

The patch also added the missing `TabLayoutConstants` struct definition that the rebase workflow had dropped:

```cpp
struct TabLayoutConstants {
  int tab_height;
  int tab_overlap;
};
```

### 4.4 `browser_view.h` — forward declarations replace heavy includes (clang signal crashes)

Including `split_view_web_view.h` → `webview.h` → `web_contents_delegate.h` in the broadly-included `browser_view.h` created preprocessed files of ~26 MB. Clang plugins crashed with a frontend signal on 35+ translation units that transitively include `browser_view.h`.

**Fix:** Replaced the two includes in the `ENABLE_SPLIT_VIEW` block with forward declarations:

```cpp
#if BUILDFLAG(ENABLE_SPLIT_VIEW)
// Forward declarations only — full headers included in browser_view.cc to
// avoid pulling webview.h (→ web_contents_delegate.h) into all dependents.
class SplitViewWebView;
namespace views { class SingleSplitView; }
#endif
```

Full includes (`split_view_web_view.h`) were then added only in the TUs that actually dereference the pointer:

| File | Reason full include needed |
|---|---|
| `chrome/browser/ui/browser_navigator.cc` | Calls `GetVisible()` and `LoadInitialURL()` — member access requires complete type |
| `chrome/browser/ui/views/frame/browser_view_layout.cc` | Upcasts `SplitViewWebView*` → `views::View*` — inheritance check requires complete type |

**Files fixed:**
- `patches/chrome-browser-ui-views-frame-browser_view.h.patch`
- `patches/chrome-browser-ui-browser_navigator.cc.patch`
- `patches/chrome-browser-ui-views-frame-browser_view_layout.cc.patch`

### 4.5 `BrowserContext::GetBrowsingDataRemover` is now an instance method

`content::BrowserContext::GetBrowsingDataRemover()` was changed from a static
method that accepted a `BrowserContext*` argument to a non-static member
function.

```cpp
// Before (M136)
content::BrowserContext::GetBrowsingDataRemover(browser_->profile())
    ->RemoveAndReply(…);

// After (M137)
browser_->profile()->GetBrowsingDataRemover()
    ->RemoveAndReply(…);
```

**File fixed:** `chrome/browser/ui/toolbar/app_menu_model.cc` (the
`IDC_CUSTOM_RESTART_CLEAR_CACHE` handler in `ExecuteCommand`).

### 4.6 Missing `CustomDownloadManager` include

The `BUILDFLAG(CUSTOM_BROWSER)` block in `chrome_download_manager_delegate.cc` that calls `custom::CustomDownloadManager::GetInstance()` was missing its include.

**Fix:** Added inside a `BUILDFLAG(CUSTOM_BROWSER)` guard after the upstream includes:

```cpp
#if BUILDFLAG(CUSTOM_BROWSER)
#include "custom/chrome/browser/features/custom_download_manager.h"
#endif
```

**File fixed:** `patches/chrome-browser-download-chrome_download_manager_delegate.cc.patch`

---

## 5. Removed / Moved Upstream Headers

### 5.1 `chrome/browser/search/background/ntp_background_data.h` — removed

This header was removed in M137. Its types (`CollectionInfo`, `BackgroundInfo`, etc.) were consolidated into `components/themes/`.

**Fix:** The include in `custom/browser/ntp/remote_ntp_theme_provider.cc` was unused (none of the types from that header were referenced in the file). It was simply deleted.

### 5.2 `chrome/browser/search/background/ntp_background_service.cc` — moved to `components/themes/`

See [§2.1](#21-moved-upstream-file-patch-relocated) — patch relocated, content unchanged.

---

## 6. New Assets

Chromium M137 added autofill AI "Feature First Run" banner images, required by the `autofill_ai_first_run_dialog` flow.

| Asset | Sizes |
|---|---|
| `autofill_ai_ffr_banner.png` | 1× and 2× |
| `autofill_ai_ffr_banner_dark.png` | 1× and 2× |

**Source:** Copied from `chrome/app/theme/default_{100,200}_percent/common/` into the corresponding `custom/app/theme/default_{100,200}_percent/common/` directories (grit resolves `chrome_scaled_image` paths relative to the custom GRD file location).

**GRD entry added** to `custom/app/theme/theme_resources.grd` inside the existing `<if expr="not is_android">` block:

```xml
<structure type="chrome_scaled_image" name="IDR_AUTOFILL_AI_FFR_BANNER"
           file="common/autofill_ai_ffr_banner.png" />
<structure type="chrome_scaled_image" name="IDR_AUTOFILL_AI_FFR_BANNER_DARK"
           file="common/autofill_ai_ffr_banner_dark.png" />
```

> **Note:** The custom build uses `custom/app/theme/theme_resources.grd` as the grit input (not `chrome/app/theme/theme_resources.grd`). New upstream image resources must be mirrored into both the custom GRD and the custom theme asset directories.

---

## 7. Known Remaining Issues

| Issue | Status | Notes |
|---|---|---|
| `WidgetDelegateView` friend list is growing | Mitigated | Each new custom `WidgetDelegateView` subclass requires a friend entry + forward declaration in the Chromium header. Consider whether any of these classes could use `WidgetDelegate` + a separate `View` instead. |
| `PanelStackWindow` in global namespace | Done | Was in anonymous namespace; moved to global to satisfy `::PanelStackWindow` friend resolution. No functional impact since the class is only used within `panel_stack_view.cc`. |
| `ntp_background_data.h` types unused in `remote_ntp_theme_provider.cc` | Done | Include deleted. If `CollectionInfo` / `BackgroundInfo` types are needed in future, include from `components/themes/ntp_background_data.h`. |
