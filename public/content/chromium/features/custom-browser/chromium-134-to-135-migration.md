# Chromium 134 → 135 Migration Notes

> **Branch:** `master`  
> **Chromium tag:** `refs/tags/135.0.7049.117` → custom version `135.1.0.0`  
> **Date:** June 2026

---

## Table of Contents

1. [Sync & Init Infrastructure](#1-sync--init-infrastructure)
2. [Patch Rebase (68 .rej files + 5 missing-target patches)](#2-patch-rebase)
3. [Build System](#3-build-system)
4. [C++ API Changes](#4-c-api-changes)
5. [Third-Party Libraries](#5-third-party-libraries)
6. [Runtime Fixes](#6-runtime-fixes)
7. [Tool & Script Updates](#7-tool--script-updates)
8. [Known Remaining Issues](#8-known-remaining-issues)

---

## 1. Sync & Init Infrastructure

### 1.1 Incomplete `src/.git` after interrupted clone
gclient's initial clone downloads the full pack file (~68 GB) then writes
`HEAD` and `config` in a separate step. An interrupted run left
`src/.git/objects/pack/` intact but missing `HEAD` and `config`, causing all
subsequent gclient invocations to fail with:

```
fatal: not a git repository: 'C:\code\custom-browser\src\.git'
```

**Fix:** `src/custom/build/commands/scripts/sync.py` — added
`_repair_incomplete_git_repo()` called at the top of `sync_chromium()`.
If `.git` exists, `packed-refs` is present (data downloaded) but `HEAD` is
absent, the function recreates both missing files so gclient can continue
without re-downloading.

### 1.2 Hook path on Windows
The `PostToolUse` hook `check_vanilla_edit.py` was crashing with a mangled
path when editing files inside `src/` because the hook command contained
backslashes that `shlex.split()` (POSIX mode) treated as escape characters.

**Fix:** Changed the hook command in `.claude/settings.local.json` to use
forward slashes:
```
"command": "python C:/code/custom-browser/.claude/hooks/check_vanilla_edit.py"
```

---

## 2. Patch Rebase

All 68 `.rej` files from the 135 sync were resolved manually, plus 5 patches
whose target files moved or were renamed.

### 2.1 Systematic patterns

| Pattern | Cause | Files affected |
|---|---|---|
| New `import("//ui/webui/webui_features.gni")` before `assert` | Upstream added import | `android_webview/BUILD.gn` |
| `//chrome/app/theme:chrome_unscaled_resources` removed from unconditional deps | Replaced by `is_custom_browser` conditional | ~20 `BUILD.gn` files |
| `//chrome/app/theme:theme_resources` removed from unconditional deps | Same | ~10 `BUILD.gn` files |
| Missing `deps += custom_browser_deps` | New variable not wired up | `chrome/browser/BUILD.gn` |
| Garbled comment text (mojibake) in `.rej` | UTF-8 encoding issue in patch files | `browser_process_impl.cc`, `chrome_browser_main.cc` |

### 2.2 Files that moved between 134 and 135

| Old path (134) | New path (135) | What changed |
|---|---|---|
| `chrome/browser/background/background_mode_manager.cc` | `chrome/browser/background/extensions/background_mode_manager.cc` | Moved to `extensions/` subdirectory |
| `chrome/browser/extensions/extension_system_impl.cc` | `chrome/browser/extensions/chrome_extension_system.cc` | Renamed as part of ExtensionSystem refactor |
| `chrome/browser/ui/extensions/extension_install_ui.cc` | `chrome/browser/ui/extensions/extension_install_ui_desktop.cc` | Split into platform-specific files |
| `components/webui/flags/resources/resources.grd` | New file (split from `components/flags_ui/`) | Flags UI moved under `components/webui/` |
| `chrome/browser/resources/glic/fre/resources.grd` | New file | GLIC First Run Experience resources added |

### 2.3 `chrome/VERSION`
Updated from `134.0.6998.95` to `135.1.0.0` following the convention
`MAJOR.1.0.0` (custom release increments MINOR to 1).

---

## 3. Build System

### 3.1 GRIT `output_all_resource_defines` attribute removed
Chromium 135 removed this attribute from the `<grit>` element. It appeared in
5 custom GRD files and caused an `UnexpectedAttribute` parse error.

**Fix:** Stripped the attribute from all 5 files:
- `custom/app/theme/custom_unscaled_resources.grd`
- `custom/browser/resources/custom_resources.grd`
- `custom/common/extensions/api/custom_api_resources.grd`
- `custom/demos/demo_shell/demo_shell_resources.grd`
- `custom/ui/resources/custom_ui_resources.grd`

### 3.2 Resource ID allocation (`resource_ids_custom.spec`)
Several GRD files gained new resources in 135, overflowing their allocated
ranges. Updated `META.sizes` values in `custom/tools/gritsettings/resource_ids_custom.spec`:

| GRD | Old size | New size | Actual count |
|---|---|---|---|
| `generated_resources.grd` | 13 300 | 13 500 | 13 309 |
| `commerce/product_specifications/resources.grd` | 60 | 70 | 61 |
| `data_sharing_internals/resources.grd` | 5 | 10 | 7 |

### 3.3 New GRD files added in 135
Two new generated GRDs lacked entries in the spec:

| GRD | Added at ID | Notes |
|---|---|---|
| `components/webui/flags/resources/resources.grd` | 7 475 | Flags UI relocated from `components/flags_ui/` |
| `chrome/browser/resources/glic/fre/resources.grd` | 4 027 | GLIC First-Run Experience |

### 3.4 `is_custom_based` build flag alias
Several patches used `is_custom_based` (older variable name) alongside the
current `is_custom_browser`. Added `is_custom_based = true` as a legacy alias
in `custom/custom_browser_config.gni` to keep both names working.

---

## 4. C++ API Changes

### 4.1 `base::FilePath::StringPieceType` → `StringViewType`
Chromium replaced `StringPiece` with `std::string_view` throughout. Every use
of `FilePath::StringPieceType` must become `FilePath::StringViewType`.

**Files fixed:**
- `chrome/browser/profiles/profile_impl.h` / `.cc`
- `custom/browser/bittorrent/torrent_download_interceptor.cc`
- `custom/browser/ntp/remote_ntp_browsertest.cc`

### 4.2 `views::ImageView::SetImage()` — `gfx::ImageSkia` → `ui::ImageModel`
`SetImage` now takes `const ui::ImageModel&`. All `gfx::ImageSkia` values must
be wrapped:
```cpp
// Before
image_view->SetImage(skia_image);
// After
image_view->SetImage(ui::ImageModel::FromImageSkia(skia_image));
```

**Files fixed:**
- `chrome/browser/ui/views/frame/browser_view.cc` (tabstrip logo)
- `custom/browser/ui/views/frame/vertical_tab_button.h` / `.cc`
- `custom/browser/ui/views/infobars/rss_infobar_contents_view.cc`

### 4.3 `views::View::GetClassName()` return type `std::string` → `std::string_view`
`GetClassName()` now returns `std::string_view`. Storing it in `std::string`
triggers a `no viable conversion` error.

**Fix:** Change `const std::string name = view->GetClassName()` to
`const std::string_view name = …` and use `std::string_view::npos` in `find()`
calls.

**File fixed:** `custom/browser/ui/views/frame/vertical_tab_bar.cc`

### 4.4 `views::View::NotifyAccessibilityEvent()` → `NotifyAccessibilityEventDeprecated()`
The un-suffixed overload was removed.

**File fixed:** `custom/browser/ui/views/download/download_options_item_view.cc`

### 4.5 `GetAccessibleNodeData()` — now `const`, `override` fails on non-`const` override
The base-class signature became `virtual void GetAccessibleNodeData(...) const`.
Custom subclasses that declared it non-`const` with `override` fail to compile.

**Fix:** Remove `override` from the non-`const` declaration (keeps the method,
stops the error). Affected files:
- `custom/browser/ui/views/bottombar/bottombar_view.h`
- `custom/browser/ui/views/download/download_options_item_view.h`

### 4.6 `cc::LayerImpl::AppendQuads()` — new `AppendQuadsContext` parameter
Signature changed from:
```cpp
virtual void AppendQuads(viz::CompositorRenderPass*, cc::AppendQuadsData*);
```
to:
```cpp
virtual void AppendQuads(const AppendQuadsContext&,
                         viz::CompositorRenderPass*,
                         cc::AppendQuadsData*);
```

**File fixed:** `custom/cc/layers/wanderlust_watermark_layer_impl.h` / `.cc`

### 4.7 `CloseTabSource` enum — `CLOSE_TAB_FROM_MOUSE` → `CloseTabSource::kFromMouse`
Old-style unscoped enum values removed.

**File fixed:** `chrome/browser/ui/views/tabs/tab.cc`

### 4.8 `TabStyle::GetTargetActiveOpacity()` removed from base class
`override` on the non-virtual method caused a hard error.

**Fix:** Remove `override`. **File:** `chrome/browser/ui/views/tabs/tab_style_views.cc`

### 4.9 `SupportsUnretained` requires complete types
Chromium 135's `base::BindOnce` now static-asserts that all raw pointer
arguments are fully defined at the bind site.

**Fix:** Added `#include "ui/aura/window.h"` under `#if defined(USE_AURA)` in
`chrome/browser/ui/views/profiles/profile_menu_view.cc`.

### 4.10 `bookmark_bubble_sign_in_delegate.h` removed
The file was deleted upstream.

**Fix:** Removed the include from `custom/browser/ui/views/bottombar/bottombar_view.cc`.

### 4.11 `std::u16string_view` + `char16_t` — no implicit concatenation
Concatenating a `string_view` with a `char16_t` literal requires explicit
`std::u16string()` construction on one operand.

**File fixed:** `custom/browser/ui/views/download/download_options_item_view.cc`

---

## 5. Third-Party Libraries

### 5.1 libtorrent `try_signal` submodule
libtorrent v2.0.10's `deps/try_signal` is a nested git submodule. gclient does
not recurse into git submodules, so it was empty after sync.

**Fix (immediate):** `git submodule update --init deps/try_signal` inside
`custom/third_party/libtorrent/src/`.

**Fix (permanent):** Added an explicit entry to `custom/DEPS`:
```python
"third_party/libtorrent/src/deps/try_signal": {
    "url": "https://github.com/arvidn/try_signal.git@105cce59...",
},
```

### 5.2 Boost.Variant — Clang 17+ void-ternary error
Boost < 1.74's `apply_visitor_unary.hpp` uses `decltype(true ? A : void)` to
deduce common types. Clang 17 (used by Chromium 135) rejects this.

**Fix:** Patched `boost/variant/detail/apply_visitor_unary.hpp` to add a
`common_deduced_type<A, B>` helper that handles void via explicit specialisations
instead of a ternary expression. (Backport of the Boost 1.74 fix.)

### 5.3 libtorrent `polymorphic_socket` — void-returning methods
After the Boost fix, `TORRENT_FWD_CALL` on void-returning socket wrapper
methods (close, open, bind, set_option, etc.) still caused errors because the
Boost deduction inferred `error_code` as the common return type.

**Fix:** Added `TORRENT_FWD_CALL_VOID` macro in
`custom/third_party/libtorrent/src/include/libtorrent/aux_/polymorphic_socket.hpp`.
The new macro omits `return` from the lambda so Boost always deduces `void`.
Applied to all 14 void-returning wrapper methods.

---

## 6. Runtime Fixes

### 6.1 `BrowserView` constructor — `bottombar_` never assigned
`bottombar_` and `split_divider_view_`/`toolbar_web_view_` were declared in
`browser_view.h` but never assigned in the constructor, leaving them `nullptr`.
This caused:
- Crash in `BottombarView::Init()` at startup (null dereference)
- Silent no-op for all split-view operations

**Fix:** Added the `AddChildView` calls to `BrowserView::BrowserView()`:
```cpp
// After toolbar_ = top_container_->AddChildView(...)
#if BUILDFLAG(BOTTOM_BAR)
  bottombar_ = bottom_container_->AddChildView(
      std::make_unique<BottombarView>(browser_.get(), this));
  bottom_contents_separator_ =
      bottom_container_->AddChildView(std::make_unique<ContentsSeparator>());
#endif

// After set_contents_view(contents_container_)
#if BUILDFLAG(ENABLE_SPLIT_VIEW)
  toolbar_web_view_ = AddChildView(std::make_unique<SplitViewWebView>(...));
  split_divider_view_ = AddChildView(std::make_unique<SplitViewDivider>(...));
#endif
```

---

## 7. Tool & Script Updates

### 7.1 `update_patches` — third-party library support
`updatePatches.py` previously only diffed the Chromium `src` git repo.
Libraries in `custom/third_party/` are separate git checkouts and were ignored.

**Fix:** Added `THIRD_PARTY_REPOS` dict and a second loop in `run_command`:
```python
THIRD_PARTY_REPOS = {
    'libtorrent': 'third_party/libtorrent/src',
    'try_signal':  'third_party/libtorrent/src/deps/try_signal',
    'asio':        'third_party/asio/src',
}
```
Patches are stored in `custom/patches/third_party/<lib_name>/`.

`apply_patches` in `utils.py` was extended with a matching second pass that
applies these patches against each library's own git root.

### 7.2 Sync — auto-repair of interrupted `src/.git`
`sync.py::sync_chromium()` now calls `_repair_incomplete_git_repo()` before
invoking gclient. If the pack data was downloaded but `HEAD`/`config` are
absent, the function restores them so the next sync continues from where it
left off rather than re-downloading ~68 GB.

---

## 8. Known Remaining Issues

| Issue | Status | Notes |
|---|---|---|
| `is_custom_based` vs `is_custom_browser` | Mitigated | Added alias; long-term should unify to `is_custom_browser` |
| Boost < 1.74 in third_party | Patched | Consider upgrading `download_boost.py` to Boost 1.81+ |
| `GetAccessibleNodeData` non-`const` methods | Compile fix only | Should be made `const` to properly override the base |
| Resource ID spec gaps (overlapping IDs) | Tolerated | `update_resource_ids` should be run to reallocate cleanly |
| `INFOBARS_SHOW` histogram value renumbered to 1932 | Done | UMA histogram data will have a gap from 1922 |
