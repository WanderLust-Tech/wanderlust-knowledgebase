# Chromium 139 → 140 Migration Notes

> **Branch:** `master`  
> **Chromium tag:** `refs/tags/139.x` → `140.x`  
> **Date:** July 2026  
> **Patch rebase scope:** 89 failed patches (81 `.rej` files + 8 silent failures)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Patch Rebase Summary](#2-patch-rebase-summary)
3. [Retired Patches](#3-retired-patches)
4. [Already-Applied Patches (Stamping Only)](#4-already-applied-patches-stamping-only)
5. [Manual Fixes](#5-manual-fixes)
6. [Key M140 Upstream Changes](#6-key-m140-upstream-changes)
7. [Post-Rebase Compile and Link Fixes](#7-post-rebase-compile-and-link-fixes)
8. [Known Remaining Issues](#8-known-remaining-issues)

---

## 1. Overview

The M139 → M140 upgrade required rebasing **89 failed patches** (out of ~691 total). The failures broke down into three categories:

| Category | Count | Action |
|---|---|---|
| Already applied (patchinfo missing) | 20 | Stamp patchinfo only |
| Retired (upstream file removed/moved/merged) | 8 | Delete patch |
| Automated context-shift rebase | 57 | Workflow fan-out (parallel agents) |
| Manual fixes (API changes) | 4 | Manual analysis and rewrite |
| **Total** | **89** | |

After all fixes: `npm run apply_patches` → **"Patches to apply: 0, Already applied: 691, Obsolete: 0 — All patches are up to date!"**

---

## 2. Patch Rebase Summary

The vast majority of the 89 failures were ordinary context shifts — line-number drift caused by M140 additions and removals in the surrounding code. These 57 patches were handled by a parallel workflow that spawned one agent per patch, each reading the current upstream file, locating the correct insertion point, and stamping the patchinfo.

The remaining failures required manual analysis and are documented in §3–§5.

---

## 3. Retired Patches

Eight patches were deleted because their target files no longer exist or their functionality is superseded in M140.

### 3.1 Download shelf UI — removed from upstream

**Patches deleted:**
- `chrome-browser-download-download_shelf.cc.patch`
- `chrome-browser-download-download_shelf_context_menu.cc.patch`
- `chrome-browser-ui-views-download-download_item_view.cc.patch`

**Why:** Chrome M140 completed the migration to the download bubble UI and removed the old download shelf entirely. `download_shelf.cc`, `download_shelf_context_menu.cc`, and the old `DownloadItemView` no longer exist in the source tree. Our custom download shelf (`BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)`) is a separate implementation that was already correctly isolated behind the buildflag — these patches were modifying the old upstream shelf code that is now gone.

### 3.2 NaCl infobar delegate — removed from upstream

**Patch deleted:**
- `chrome-browser-nacl_host-nacl_infobar_delegate.cc.patch`

**Why:** `chrome/browser/nacl_host/` was completely removed from M140 as part of the ongoing NaCl deprecation. Our patch only added a custom infobar button on the NaCl deprecation notice — with the whole host directory gone, there is nothing left to patch.

### 3.3 Permission UI selectors — moved or removed

**Patches deleted:**
- `chrome-browser-permissions-contextual_notification_permission_ui_selector.cc.patch`
- `chrome-browser-permissions-prediction_based_permission_ui_selector.cc.patch`

**Why:**
- `contextual_notification_permission_ui_selector.cc` was removed entirely from M140; its responsibilities were consolidated into other selectors.
- `prediction_based_permission_ui_selector.cc` moved from `chrome/browser/permissions/` to `chrome/browser/permissions/prediction_service/`. The patch was a commented-out stub (no active custom logic), so it was retired rather than relocated.

### 3.4 iOS widget extensions — consolidated

**Patches deleted:**
- `ios-chrome-content_widget_extension-strings-BUILD.gn.patch`
- `ios-chrome-search_widget_extension-strings-BUILD.gn.patch`

**Why:** M140 merged `content_widget_extension` and `search_widget_extension` into a single `widget_kit_extension` directory. The custom branding strings (`is_custom_based` check) that these patches added are already present in `ios/chrome/widget_kit_extension/strings/BUILD.gn` — the merged file already contains our changes. Both patches are retired.

### 3.5 Settings basic_page templates — architecture deprecated

**Patches deleted:**
- `chrome-browser-resources-settings-basic_page-basic_page.html.patch`
- `chrome-browser-resources-settings-basic_page-basic_page.ts.patch`

**Why:** M140 completely rewrote `basic_page.html` and `basic_page.ts`. The old approach used `dom-if` + `settings-section` components hosted in `basic_page` to render custom settings sections. In M140, `basic_page` is reduced to a thin wrapper — it now only contains the Privacy section (with a `<!-- TODO: Remove -->` comment). All top-level settings pages must live in `settings_main.html` using `cr-view-manager`. See §5.2 for what replaced these patches.

---

## 4. Already-Applied Patches (Stamping Only)

Twenty patches had their content already present in the M140 source files — the upstream merge had applied the custom changes but the patchinfo checksums were not regenerated. These were stamped with fresh patchinfos using MD5 checksums of the patch file and target file.

| Patch |
|---|
| `chrome-browser-BUILD.gn.patch` |
| `chrome-browser-download-chrome_download_manager_delegate.cc.patch` |
| `chrome-browser-download-download_ui_model.h.patch` |
| `chrome-browser-extensions-BUILD.gn.patch` |
| `chrome-browser-search-instant_service.h.patch` |
| `chrome-browser-shortcuts-BUILD.gn.patch` |
| `chrome-browser-signin-signin_util.cc.patch` |
| `chrome-browser-ui-browser_command_controller.cc.patch` |
| `chrome-browser-ui-browser_commands.cc.patch` |
| `chrome-browser-ui-views-frame-browser_view.h.patch` |
| `chrome-browser-ui-views-frame-tab_strip_region_view.cc.patch` |
| `chrome-browser-ui-views-location_bar-location_bar_view.cc.patch` |
| `chrome-browser-ui-views-tabs-tab.cc.patch` |
| `chrome-BUILD.gn.patch` |
| `chrome-common-webui_url_constants.cc.patch` |
| `chrome-installer-setup-BUILD.gn.patch` |
| `components-safe_browsing-content-browser-web_ui-safe_browsing_ui.cc.patch` |
| `content-browser-renderer_host-render_frame_host_impl.cc.patch` |
| `mojo-public-tools-bindings-mojom.gni.patch` |
| `net-base-features.cc.patch` |

---

## 5. Manual Fixes

Four patches failed because M140 changed the surrounding API substantially enough that a simple context-shift was not sufficient.

### 5.1 CSS property ID enum conflict (`css_property_id.mojom`)

**File:** `src/third_party/blink/public/mojom/use_counter/metrics/css_property_id.mojom`

**Problem:** Our custom `kBbSimpleOverflowClip` property was assigned value `870`. In M140, value `870` was taken by the newly-deprecated `kAnimationTriggerBehavior`, and values 871–881 were also consumed by other M140 additions. The patch failed to apply because the enum block around value 870 no longer matched.

**Fix:** Reassigned `kBbSimpleOverflowClip` to value `882` (the next free slot after all M140 additions):

```diff
-kBbSimpleOverflowClip = 870,
+kBbSimpleOverflowClip = 882,
```

This value was inserted immediately before the `// Add new features above this line` comment at the end of the enum.

**Rule:** When rebasing CSS property ID patches, always check the current highest value in the enum and assign the next free slot. Never reuse a deprecated value even if its slot appears free — Chromium's UMA infrastructure treats enum values as stable identifiers.

---

### 5.2 Settings UI — migration from `basic_page` to `settings_main`

**Files changed:**
- `src/chrome/browser/resources/settings/settings_main/settings_main.html` *(new patch)*
- `src/chrome/browser/resources/settings/settings_main/settings_main.ts` *(new patch)*

**Problem:** M140 rewrote the settings architecture. The old approach inserted custom settings sections into `basic_page.html` via Polymer `<settings-section>` elements inside `<dom-if>` templates. In M140, `basic_page` is deprecated — it only contains the Privacy section with a `<!-- TODO: Remove -->` comment. All top-level settings pages now live in `settings_main.html` inside a `<cr-view-manager>` using `slot="view"` divs with the `renderPlugin_()` pattern.

**Fix:** Migrated all custom settings sections from `basic_page.html`/`basic_page.ts` to `settings_main.html`/`settings_main.ts`.

In `settings_main.html`, the following block was added before `</cr-view-manager>`:

```html
<if expr="_is_custom_browser and not _enable_custom_webui">
  <if expr="_enable_tab_shapes">
  <template is="dom-if" if="[[showPage_(pageVisibility_.customTab)]]">
    <div slot="view" id="customTab">
      <template is="dom-if" if="[[renderPlugin_(routes_.CUSTOM_TAB, lastRoute_, inSearchMode_)]]">
        <settings-custom-tab-page prefs="{{prefs}}"></settings-custom-tab-page>
      </template>
    </div>
  </template>
  </if>
  <if expr="_enable_sidebar">
  <template is="dom-if" if="[[showPage_(pageVisibility_.customSidebar)]]">
    <div slot="view" id="customSidebar">
      ...
    </div>
  </template>
  </if>
  <!-- + RSS, mouse gestures, super drag, accelerator, toolbar, others -->
</if>
```

In `settings_main.ts`, the corresponding JS module imports were added:

```typescript
// <if expr="_is_custom_browser and not _enable_custom_webui">
// <if expr="_enable_tab_shapes">
import '../tab_page/tab_page.js';
// </if>
// <if expr="_enable_rss_reader">
import '../rss_page/rss_page.js';
// </if>
// <if expr="_enable_mouse_gestures">
import '../mouse_gesture_page/mouse_gesture_page.js';
import '../super_drag_page/super_drag_page.js';
import '../accelerator_page/accelerator_page.js';
// </if>
// <if expr="_enable_sidebar">
import '../sidebar_page/sidebar_page.js';
// </if>
import '../others_page/others_page.js';
import '../toolbar_page/toolbar_page.js';
// </if>
```

**Key insight:** `showPage_()` in `settings_main.ts` returns `visibility !== false`, so undefined entries in `pageVisibility_` are treated as visible. Custom sections that aren't listed in the `PageVisibility` interface still render correctly without modifying the interface.

---

### 5.3 Downloads API — `IsDownloadBubbleEnabled()` removed

**File:** `src/chrome/browser/extensions/api/downloads/downloads_api.cc`

**Problem:** M140 removed `IsDownloadBubbleEnabled()` from `download_bubble_prefs.h` entirely (the bubble is now always enabled). Our patch to `DownloadsSetShelfEnabledFunction::Run()` and `DownloadsSetUiOptionsFunction::Run()` had a conditional path:

```cpp
// Old M139 code (no longer compiles in M140):
if (!download::IsDownloadBubbleEnabled(profile)) {
    browser->window()->IsDownloadShelfVisible() ...
}
```

Both the `IsDownloadBubbleEnabled()` guard and the old `IsDownloadShelfVisible()` else-branch were gone.

**Fix:** Replaced the removed API with an explicit check for the download bubble controller, with our custom download shelf as the fallback:

```cpp
// New M140 code:
if (browser->window()->GetDownloadBubbleUIController()) {
    browser->window()->GetDownloadBubbleUIController()->HideDownloadUi();
}
#if BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)
else if (browser->window()->IsDownloadOptionsShelfVisible()) {
    browser->window()->GetDownloadOptionsShelf()->Close();
}
#endif
```

This pattern was applied in both `DownloadsSetShelfEnabledFunction::Run()` and `DownloadsSetUiOptionsFunction::Run()`.

Additionally, the include for the custom buildflag was missing from the file — `BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)` was used without its header:

```cpp
// Added after #include "build/build_config.h":
#include "custom/buildflags/custom_features_buildflags.h"
```

**Note:** The profile-aware `IsDownloadBubbleEnabled(Profile* profile)` function we maintain in `chrome/browser/download/bubble/download_bubble_prefs.cc` under `#if BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)` is unaffected — that is our own function, not the removed upstream one.

---

## 6. Key M140 Upstream Changes

Summary of the M140 changes that caused the most patch failures:

### 6.1 Download shelf removal

Chrome M140 finalized the removal of the old download shelf. Affected files:
- `chrome/browser/download/download_shelf.cc` — deleted
- `chrome/browser/download/download_shelf_context_menu.cc` — deleted
- `chrome/browser/ui/views/download/download_item_view.cc` — deleted

The download bubble (`chrome/browser/ui/views/download/bubble/`) is now the only download UI. `IsDownloadBubbleEnabled()` was removed because it always returns true. Custom browser download shelf is unaffected as it is gated behind `BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)` in separate files.

### 6.2 Settings architecture — `basic_page` deprecated

`chrome/browser/resources/settings/basic_page/` is now a thin wrapper around the Privacy section only. The M140 `basic_page.html` is only 12 lines. All other settings sections must be placed in `settings_main/settings_main.html` using the `cr-view-manager` + `slot="view"` pattern with `renderPlugin_()`.

### 6.3 NaCl host removal

`chrome/browser/nacl_host/` was completely removed. NaCl had been deprecated since Chrome 95 and the removal was completed in M140. Any patches that modified files in this directory must be retired.

### 6.4 Permission UI selector consolidation

- `contextual_notification_permission_ui_selector.cc` — removed entirely
- `prediction_based_permission_ui_selector.cc` — moved to `chrome/browser/permissions/prediction_service/`

### 6.5 iOS widget extension consolidation

`content_widget_extension` and `search_widget_extension` were merged into `widget_kit_extension`. Patches targeting the old extension directories must be relocated or retired.

### 6.6 CSS property enum growth

M140 added a large number of new CSS property enum entries, filling values 870–881. Any custom enum values assigned below 882 need to be reassigned to avoid conflicts with the deprecated and new M140 entries.

---

## 7. Post-Rebase Compile and Link Fixes

After `apply_patches` succeeded, a full build surface over a dozen additional errors caused by M140 API changes that broke our custom code directly (not via patch context). These are documented in order of appearance.

### 7.1 `DownloadUIModel` constructor — requires `StatusTextBuilder` argument

**Files:** `src/custom/browser/download/download_options_item_model.cc`

**Error:** `DownloadOptionsItemModel` constructor did not initialize the `DownloadUIModel` base class.

**Root cause:** M140 changed `DownloadUIModel` to take a `std::unique_ptr<StatusTextBuilderBase>` in its constructor. Previously the base class had a default constructor.

**Fix:**
```cpp
DownloadOptionsItemModel::DownloadOptionsItemModel(DownloadItem* download)
    : DownloadUIModel(std::make_unique<DownloadUIModel::StatusTextBuilder>()),
      download_(download) {
```

---

### 7.2 `ShouldShowInShelf` / `ShouldRemoveFromShelfWhenComplete` — removed from base class

**Files:**
- `src/custom/browser/ui/views/download/download_options_item_view.cc`
- `src/custom/browser/download/download_options_shelf.cc`
- `src/chrome/browser/download/download_ui_controller.cc` (patched upstream)

**Error:** Calling `model_->ShouldShowInShelf()` and `model_->ShouldRemoveFromShelfWhenComplete()` on a `DownloadUIModel*` pointer.

**Root cause:** M140 moved these methods off the `DownloadUIModel` base class; they now exist only on the concrete `DownloadOptionsItemModel` (and the standard `DownloadItemModel`).

**Fix:** Cast to the concrete type at each call site:
```cpp
auto* options_model = static_cast<DownloadOptionsItemModel*>(model_.get());
if (!options_model->ShouldShowInShelf()) { ... }
if (options_model->ShouldRemoveFromShelfWhenComplete()) { ... }
```

In `download_ui_controller.cc` the `DownloadItemModel(item).ShouldShowInShelf()` guard was removed entirely — the custom shelf now always shows the download.

---

### 7.3 `IDS_ACCNAME_DOWNLOADS_BAR` undeclared

**File:** `src/custom/app/generated_resources.grdp`

**Error:** `IDS_ACCNAME_DOWNLOADS_BAR` used in `download_options_shelf_view.cc` but not declared.

**Root cause:** M140 removed this string from the upstream `generated_resources.grd` (the old download shelf was deleted).

**Fix:** Added to our custom GRD:
```xml
<message name="IDS_ACCNAME_DOWNLOADS_BAR"
         desc="Accessible name for the custom download options shelf.">
  Downloads bar
</message>
```

---

### 7.4 `VIEW_ID_DOWNLOAD_SHELF` undeclared

**File:** `src/custom/browser/ui/views/download/download_options_shelf_view.cc`

**Error:** `VIEW_ID_DOWNLOAD_SHELF` undeclared.

**Root cause:** Removed from upstream `view_ids.h` along with the download shelf.

**Fix:** Replaced with `VIEW_ID_DOWNLOAD_OPTIONS_SHELF`, which was already defined in our custom `view_ids.h`.

---

### 7.5 `custom/grit/custom_ui_resources.h` not found in panel code

**File:** `src/chrome/browser/ui/BUILD.gn` (patched upstream)

**Error:** `custom/grit/custom_ui_resources.h` not found during compilation of `panel_frame_view.cc`.

**Root cause:** A dropped include hunk in `chrome/browser/ui/BUILD.gn` — the `is_custom_browser` deps block was missing `"//custom/ui/resources:custom_ui_resources"`.

**Fix:** Added to the `is_custom_browser` block in `chrome/browser/ui/BUILD.gn`:
```gn
if (is_custom_browser) {
  deps += [ "//custom/ui/resources:custom_ui_resources" ]
}
```
Re-stamped patchinfo.

---

### 7.6 `WidgetFocusManager` / `WidgetFocusChangeListener` — removed from M140

**Files:**
- `src/custom/browser/ui/views/panels/panel_stack_view.h`
- `src/custom/browser/ui/views/panels/panel_stack_view.cc`

**Error:** `ui/views/focus/widget_focus_manager.h` not found.

**Root cause:** `WidgetFocusManager` and `WidgetFocusChangeListener` were removed entirely from M140 views.

**Fix:** Removed all references from `PanelStackView`:
- Removed `#include "ui/views/focus/widget_focus_manager.h"`
- Removed `public views::WidgetFocusChangeListener` from base class list
- Removed `OnNativeFocusChanged` declaration and implementation
- Removed `AddFocusChangeListener` / `RemoveFocusChangeListener` calls

---

### 7.7 `ComposeboxOmniboxClient` abstract — missing pure virtual overrides

**File:** `src/chrome/browser/ui/webui/new_tab_page/composebox/composebox_handler.cc`

**Error:** Cannot instantiate abstract class `ComposeboxOmniboxClient` — pure virtuals `GetTabService()` and `GetToolbarService()` not overridden.

**Root cause:** M140 added `GetTabService()` and `GetToolbarService()` as pure virtuals to `OmniboxClient`. Each concrete subclass must implement them. The fix belongs on the concrete class, not on the abstract intermediate base `SearchboxOmniboxClient`.

**Fix:** Added stubs directly to `ComposeboxOmniboxClient` (matching the `LensOmniboxClient` pattern):
```cpp
TabService* GetTabService() override { return nullptr; }
ToolbarService* GetToolbarService() override { return nullptr; }
```

**Key insight:** Adding these on `SearchboxOmniboxClient` (the intermediate base) does not fix the error — `ComposeboxOmniboxClient` overrides it and the vtable still shows it as pure virtual. Each concrete subclass must provide its own implementation.

---

### 7.8 Dropped patch hunk — `custom` namespace missing in download delegate

**File:** `src/chrome/browser/download/chrome_download_manager_delegate.cc` (patched upstream)

**Error:** `custom` namespace undeclared.

**Root cause:** A patch hunk adding `#include "custom/chrome/browser/features/custom_download_manager.h"` was silently dropped because M140 changed the surrounding code enough to break context matching. The patchinfo was stamped but the include was never inserted.

**Fix:** Manually inserted the guarded include:
```cpp
#if BUILDFLAG(CUSTOM_BROWSER)
#include "custom/chrome/browser/features/custom_download_manager.h"
#endif
```
Re-stamped patchinfo.

---

### 7.9 `download::IsDownloadBubbleEnabled` — moved header

**File:** `src/chrome/browser/download/download_ui_controller.cc` (patched upstream)

**Error:** `download::IsDownloadBubbleEnabled` undeclared.

**Root cause:** The function signature changed and the include was missing. Our custom `IsDownloadBubbleEnabled(Profile*)` lives in `chrome/browser/download/bubble/download_bubble_prefs.h` in namespace `download`.

**Fix:** Added the include under the `CUSTOM_DOWNLOAD_SHELF` guard:
```cpp
#if BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)
#include "chrome/browser/download/bubble/download_bubble_prefs.h"
#endif
```
Re-stamped patchinfo.

---

### 7.10 `DownloadShelfContextMenuAction` — merged into `DownloadUiContextMenuAction`

**File:** `src/chrome/browser/download/download_stats.cc` (patched upstream)

**Error:** `DownloadShelfContextMenuAction` undeclared.

**Root cause:** M140 merged `DownloadShelfContextMenuAction` into `DownloadUiContextMenuAction`.

**Fix:** Replaced all `DownloadShelfContextMenuAction::` with `DownloadUiContextMenuAction::`. Re-stamped patchinfo.

---

### 7.11 Unhandled switch cases for custom download commands

**File:** `src/chrome/browser/download/download_ui_context_menu.cc` (upstream, no prior patch)

**Error:** `HIDE_DOWNLOAD_ITEM_VIEW`, `DELETE_LIST`, `DELETE_FILE` not handled in `GetLabelForCommandId` switch.

**Root cause:** M140 changed the switch to be exhaustive; our custom `DownloadCommands` enum values were added without corresponding labels.

**Fix:** Added a new patch to `download_ui_context_menu.cc` with `NOTREACHED()` cases guarded by the buildflag:
```cpp
#if BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)
case DownloadCommands::HIDE_DOWNLOAD_ITEM_VIEW:
case DownloadCommands::DELETE_LIST:
case DownloadCommands::DELETE_FILE:
#endif
  NOTREACHED();
```

---

### 7.12 `RedirectInfo::ComputeRedirectInfo` — new `original_initiator` parameter

**File:** `src/custom/browser/net/custom_proxying_url_loader_factory.cc`

**Error:** Too few arguments to `RedirectInfo::ComputeRedirectInfo`.

**Root cause:** M140 added `const std::optional<url::Origin>& original_initiator` as a new parameter before `http_status_code`.

**Fix:**
```cpp
original_request.referrer_policy, original_request.referrer.spec(),
original_request.request_initiator,   // ← new M140 parameter
response_code, new_url, referrer_policy_header,
```

---

### 7.13 `chrome/browser/download/download_shelf.h` — deleted

**File:** `src/custom/chrome/browser/features/custom_download_manager.cc`

**Error:** `download_shelf.h` not found.

**Root cause:** The upstream download shelf and its header were removed in M140.

**Fix:** Replaced the include with our custom shelf header and updated types:
```cpp
// Before:
#include "chrome/browser/download/download_shelf.h"
DownloadShelf* shelf = browser->window()->GetDownloadShelf();

// After:
#include "custom/browser/download/download_options_shelf.h"
DownloadOptionsShelf* shelf = browser->window()->GetDownloadOptionsShelf();
```

---

### 7.14 `gin::Wrappable` — cppgc migration and `WrapperInfo` format change

**Files:**
- `src/custom/renderer/ntp/remote_ntp_extension.cc`
- `src/gin/public/wrappable_pointer_tags.h` (patched upstream)

This was the largest single set of changes. M140 migrated `gin::Wrappable` from raw heap allocation to cppgc (Chromium's garbage-collected heap).

**Errors:**
- `-Wmissing-braces` on all 9 `kWrapperInfo` definitions
- Abstract class errors (missing `wrapper_info()` override)
- `operator new` deleted for `gin::Wrappable`-derived types
- `CppHeap` incomplete type

**Root cause:** Three simultaneous breaking changes:

1. **`WrapperInfo` format changed** — now requires double braces and a unique pointer tag:
   ```cpp
   // M139:
   gin::WrapperInfo Foo::kWrapperInfo = {gin::kEmbedderNativeGin};
   // M140:
   gin::WrapperInfo Foo::kWrapperInfo = {{gin::kEmbedderNativeGin}, gin::kFooTag};
   ```

2. **`wrapper_info()` is now a pure virtual** — each concrete subclass must implement:
   ```cpp
   const gin::WrapperInfo* wrapper_info() const override { return &kWrapperInfo; }
   ```

3. **`operator new` deleted** — `gin::Wrappable` subclasses can no longer be heap-allocated with `new`. Must use `cppgc::MakeGarbageCollected<T>()` and retrieve the V8 wrapper via `GetWrapper()`:
   ```cpp
   // M139:
   auto* obj = new MyBindings();
   v8::Local<v8::Object> wrapper;
   gin::CreateHandle(isolate, obj).ToV8();

   // M140:
   auto& alloc = isolate->GetCppHeap()->GetAllocationHandle();
   auto* obj = cppgc::MakeGarbageCollected<MyBindings>(alloc);
   v8::Local<v8::Object> wrapper;
   if (!obj->GetWrapper(isolate).ToLocal(&wrapper)) return;
   ```

**Fix for `wrappable_pointer_tags.h`:** Added 9 new tags for our NTP bindings before `kLastPointerTag`:
```cpp
kRemoteNtpBindings,    kNtpSearchBindings,   kNtpThemeBindings,
kNtpNetworkBindings,   kNtpSettingsBindings, kNtpBookmarksBindings,
kNtpSessionsBindings,  kNtpTabsBindings,     kNtpHistoryBindings,
kLastPointerTag = kNtpHistoryBindings,
```

**Fix for `remote_ntp_extension.cc`:**
- Updated all 9 `kWrapperInfo` definitions to the new double-brace + tag format
- Added `wrapper_info()` override to all 9 binding classes
- Rewrote `Install()` to use `cppgc::MakeGarbageCollected` + `GetWrapper()`
- Added includes: `v8/include/cppgc/allocation.h`, `v8/include/v8-cppgc.h`

**Rule:** Whenever a new `gin::Wrappable` subclass is added, it needs a unique `WrappablePointerTag` entry in `gin/public/wrappable_pointer_tags.h`.

---

### 7.15 Linker errors — missing `BrowserView` download shelf implementations

**Files:**
- `src/chrome/browser/ui/views/frame/browser_view.cc` (patched upstream)
- `src/chrome/browser/ui/browser_commands.cc` (patched upstream)

**Errors (link phase):**
```
lld-link: error: undefined symbol: BrowserView::IsDownloadOptionsShelfVisible()
lld-link: error: undefined symbol: BrowserView::GetDownloadOptionsShelf()
lld-link: error: undefined symbol: chrome::ShowRSSInfobar(Browser*)
```

**Root cause:** The patch hunks adding these implementations were silently dropped. The context lines for `IsDownloadOptionsShelfVisible` and `GetDownloadOptionsShelf` in `browser_view.cc` referenced `IsDownloadShelfVisible()` — a function removed from M140. The `ShowRSSInfobar` hunk in `browser_commands.cc` shifted beyond the context window.

Both patchinfos had been stamped as "applied" during the initial rebase workflow, but the content was never inserted.

**Fix for `browser_view.cc`:** Added after `ShowOneClickSigninConfirmation()`:
```cpp
#if BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)
void BrowserView::SetDownloadOptionsShelfVisible(bool visible) {
  DCHECK(download_options_shelf_);
  InvalidateLayout();
}

bool BrowserView::IsDownloadOptionsShelfVisible() const {
  return download_options_shelf_ && download_options_shelf_->IsShowing();
}

DownloadOptionsShelf* BrowserView::GetDownloadOptionsShelf() {
  if (!download_options_shelf_) {
    download_options_shelf_ =
        AddChildView(std::make_unique<DownloadOptionsShelfView>(browser_.get(), this));
    GetBrowserViewLayout()->set_download_options_shelf(download_options_shelf_);
  }
  return download_options_shelf_;
}
#endif
```

Note: `SetDownloadOptionsShelfVisible` was simplified — `ToolbarSizeChanged()` was removed in M140; `InvalidateLayout()` is the replacement.

**Fix for `browser_commands.cc`:** Added after `ShowTranslateBubble()`:
```cpp
void ShowRSSInfobar(Browser* browser) {
  WebContents* web_contents =
      browser->tab_strip_model()->GetActiveWebContents();
  browser->window()->ShowRSSInfobar(web_contents, web_contents->GetURL());
}
```

Both patchinfos re-stamped.

---

## 8. Known Remaining Issues

| Issue | Status | Notes |
|---|---|---|
| `kBbSimpleOverflowClip` enum value stability | Mitigated | Assigned value 882 in M140. Check again on next milestone if M141 adds new properties before 882. |
| Custom settings page visibility | Working | `showPage_()` returns `true` for undefined `pageVisibility_` properties — custom pages are always shown. If page-level visibility control is needed, add entries to the `PageVisibility` interface in `page_visibility.ts`. |
| `IsDownloadBubbleEnabled` removed | Fixed | Replaced with explicit `GetDownloadBubbleUIController()` check + custom shelf fallback. Profile-aware version in `download_bubble_prefs.cc` is unaffected. |
| NaCl infobar | Retired | NaCl host completely removed. If NaCl deprecation notices return in a different form, a new patch will be needed. |
| Stamped-but-not-applied patches | Mitigated | The initial rebase workflow incorrectly stamped several patches (§7.8, §7.15) as "already applied" when their content was never inserted. These were caught at compile/link time. When future migrations show "0 failed" but builds break, check whether stamped patches are actually present in their target files. |
