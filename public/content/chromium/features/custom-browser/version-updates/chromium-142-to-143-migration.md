# Chromium 142 → 143 Migration Notes

> **Branch:** `master`
> **Chromium tag:** `142.0.7444.177` → `143.0.7499.194`
> **Date:** September 2026
> **Patch rebase scope:** 86 failed patches (out of 740 total: 72 `.rej` files + 14 silent failures)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Retired / Relocated Patches](#2-retired--relocated-patches)
3. [Manual Fixes — Patch Context Shifts](#3-manual-fixes--patch-context-shifts)
4. [Key M143 Upstream API Changes](#4-key-m143-upstream-api-changes)
5. [Post-Rebase Compile & Link Fixes](#5-post-rebase-compile--link-fixes)
6. [Cross-Agent Coordination Issues](#6-cross-agent-coordination-issues)
7. [Known Remaining Issues](#7-known-remaining-issues)

---

## 1. Overview

The M142 → M143 upgrade required rebasing **86 failed patches**. 16 turned out to already be fully applied (stale `.rej` files left over from an earlier interrupted run — deleted once confirmed via content diff, not just re-stamped blind). The remaining 70 (56 `.rej` context shifts + 14 files with no `.patchinfo` at all, mostly relocated-by-upstream targets) were fanned out across 12 parallel agents (~6 files each, grouped by directory locality) via a Workflow run, each independently reading the patch, the `.rej`, and the current M143 source.

`npm run apply_patches` then reported **338 applied cleanly, 0 conflicts, 0 failed, 401 skipped** for the main tree (plus the usual 4 known-false-positive nested-repo failures in libtorrent/search_engines_data — see §7). That result was **not** the end of the work: a full `npm run build` then surfaced roughly 20 further build-and-link-fix cycles, more than half of them bugs that had nothing to do with the version bump at all — see §5. This migration's real lesson, sharper than in any prior one: **a clean `apply_patches` report only proves the patches applied; it says nothing about whether the resulting tree compiles, links, or was ever actually built before.**

---

## 2. Retired / Relocated Patches

### 2.1 Retired — feature removed upstream

- **`services-accessibility-features-v8_manager.cc.patch`**: the whole `services/accessibility/features/` directory (including `V8Manager`/`V8Environment`) was deleted upstream (Chrome OS Accessibility Service removal). Traced the gating buildflag before assuming this needed porting: `supports_os_accessibility_service = is_fuchsia || is_chromeos` in `services/accessibility/buildflags.gni` — this code was **never compiled into any build this fork produces** (Windows/`target_os="win"` only), even before the removal. The patch added a `custom` V8 object-template binding alongside `chrome`'s; since nothing in the fork ever built that binding, there is nothing to port anywhere. Retired outright.

### 2.2 Retired — merged into another patch's target

- **`chrome-browser-ui-webui-new_tab_page-composebox-composebox_omnibox_client.h.patch`**: `ComposeboxOmniboxClient` lost its own standalone header entirely — it's now an anonymous-namespace class defined inline in `composebox_handler.cc` (see §2.3). The header patch's only content (`GetTabService()`/`GetToolbarService()` override declarations) is already present verbatim at the new location, folded into the `.cc` patch that replaced it. Nothing left to reapply.

### 2.3 Relocated — content ported to a new path

- **`chrome-browser-extensions-install_signer.cc.patch`**, **`...install_verifier.{cc,h}.patch`** → `extensions/browser/install_signer.cc`, `extensions/browser/install_verifier.{cc,h}` (upstream commit "Move InstallVerifier and related install* files to //extensions").
- **`chrome-browser-ui-views-frame-browser_view_layout.{cc,h}.patch`** and its delegate/delegate-impl siblings → `chrome/browser/ui/views/frame/layout/`. Upstream split `BrowserViewLayout` into an abstract base plus two concrete subclasses, `BrowserViewLayoutImplOld` (active by default — `features::kUseNewTabbedBrowserLayout` is `FEATURE_DISABLED_BY_DEFAULT`) and `BrowserViewLayoutImpl` (the experimental replacement). All of the fork's `Layout()` logic (compact-row, zen mode, bottom bar, download shelf, sidebar/vertical-tab-bar containers, tabstrip logo) was re-applied to `browser_view_layout_impl_old.cc`, adapted to a new `views()` accessor into a `BrowserViewLayoutViews` struct (replacing raw member pointers) and a cached `vertical_layout_rect_` (replacing an assumption that the sidebar/vertical-tab-bar/bottom-bar siblings share one flat coordinate space with `BrowserView`). One piece of the original patch was dropped as obsolete rather than ported: a `main_container_`-renarrowing hit-test workaround no longer applies now that sidebar/vertical-tab-bar/bottom-bar are added to `BrowserView` *after* `main_container_`, so z-order alone handles what the workaround used to. Two `TabStrip::SetBackgroundOffset()` calls were also dropped — the method no longer exists anywhere in `chrome/browser/ui/views/tabs/`.
- **`chrome-browser-ui-webui-new_tab_page-composebox-composebox_omnibox_client.cc.patch`** → inlined into `composebox_handler.cc` (upstream: "[M143] Remove base composebox handler"), which was itself later moved from `chrome/browser/ui/webui/new_tab_page/composebox/` to `chrome/browser/ui/webui/searchbox/composebox_handler.cc` (a second, unrelated directory-rename commit).
- **`components-os_crypt-sync-keychain_password_mac.mm.patch`** → `components/os_crypt/common/keychain_password_mac.mm` (upstream: "Move os_crypt/sync and os_crypt/async shared code to os_crypt/common").
- **`chrome-browser-resources-settings-privacy_page-security_page.html.patch`** → `.../privacy_page/security/security_page.html` (upstream: "Setting code health: move security files into new security/ folder"). Context around the target lines was byte-identical, even at the same line numbers — a pure directory move.
- **`chrome-browser-resources-settings-site_settings-site_settings_prefs_browser_proxy.ts.patch`** → renamed `site_settings_browser_proxy.ts` in the same directory (upstream: "[AI-Fixit][Settings] Rename site_settings_prefs_browser_proxy"; class renamed `SiteSettingsBrowserProxy`/`Impl`).

---

## 3. Manual Fixes — Patch Context Shifts

As in prior migrations, a large fraction of the 56 `.rej` failures turned out to be "everything except one small hunk had already fuzz-applied cleanly" — usually a single dropped `#include`, sitting just above or below wherever upstream had inserted new unrelated code at the same anchor point. Representative fixes, beyond the routine include-only ones:

- **`chrome/browser/extensions/api/tabs/tabs_api_non_android.cc`** — final panel-creation branch re-anchored after upstream's `Browser::CreationStatus`/`CreateParams` → `BrowserWindowInterface::CreationStatus`/`BrowserWindowCreateParams`/`CreateBrowserWindow()` rename; logic unchanged.
- **`chrome/browser/ui/browser.h`** — forward declares for `ChromeMouseGestureHostObserver`/`SuperDragDelegate`/`ui::DropTargetEvent`/`ui::MouseEvent` had to move: the original anchor, `namespace views { class View; }`, no longer exists in this file. Re-anchored after the `web_modal` forward-declare block.
- **`chrome/browser/ui/browser_navigator.cc`** — the container-routing `SiteInstance::CreateForFixedStoragePartition`/`ContainerServiceFactory` logic in `CreateTargetContents()` had regressed to plain opener-or-new-tab logic (silently dropped, not just context-shifted); re-added the full if/else-if/else chain, adapted to `params.browser->profile()` → `params.browser->GetProfile()`.
- **`chrome/browser/ui/views/frame/browser_view.cc`** — the single largest file in this rebase (27 hunks). Upstream restructured `BrowserView`'s constructor to parent `tab_strip_region_view_` directly under `this` via a new `tab_strip_region_insertion_index_`, instead of under `top_container_`. Re-applied file-scope `ZenMouseObserver`/`MRUCtrlReleaseHandler` classes, the anonymous-namespace `SplitViewDivider` view, all constructor wiring (bottom bar/sidebar/vertical-tab-bar/split-view/title-logo), `MRUTabActivated()`, the `IsMinimalBrowsingModeEnabled()` guards (adapted to the renamed `ImmersiveModeController::From(browser())` accessor — see §4), and the `AddedToWidget()` layout-struct/setter wiring in the new `BrowserViewLayoutViews`-struct-plus-setters idiom. Two more call sites still using the *old* bare `immersive_mode_controller()` accessor (in `FocusBottombar()` and `IsBottombarVisible()`) were missed in this pass and only caught later, during compilation (§5).
- **`chrome/browser/resources/BUILD.gn`**, **`chrome/chrome_paks.gni`**, **`chrome/browser/ui/BUILD.gn`** — the dedup/re-inclusion blocks that exclude upstream WebUIControllers (`bookmarks`/`certificate_manager`/`downloads`/`extensions`/`feedback`/`tab_search`/`whats_new`) under `enable_custom_webui` needed re-application after upstream inserted unrelated new entries at the same anchors (`reload_button:resources`, `//components/browser_apis/tab_strip/resources`), and after `chrome/browser/resources/BUILD.gn` picked up a stray duplicate `password_manager:resources`/`settings:resources` pair from a prior partial apply.
- **`custom/tools/gritsettings/resource_ids_custom.spec`** — needed four separate fixes, none of them simple context shifts: `chrome/app/generated_resources.grd`'s declared `sizes.messages` cap (`13700`) was exceeded by exactly one new upstream string (bumped to `14000` for headroom), and three brand-new upstream GRDs (`chrome/browser/resources/glic/shared/resources.grd`, `chrome/browser/resources/reload_button/resources.grd`, `components/browser_apis/tab_strip/resources/resources.grd`) had no entry at all. See §4 for what this rebase learned about how this file's numbering actually works, which is what made picking safe values for the three new entries possible.
- **`chrome/browser/ui/views/tabs/tab_style_views.cc`** — `TabStyleViews::GetPath()`'s signature changed (see §4); `CustomTabStyleViews::GetPath()`'s override and its two internal call sites (previously passing a bare `bool`/positional args) were updated to the new `TabPathFlags` struct and its designated-initializer calling convention, matching the pattern already used by the untouched upstream `TabStyleViewsImpl` sibling class in the same file. `CustomTabStyleViews` also needed a new `GetHoverControllerForTesting()` override — a newly non-defaulted pure virtual on `TabStyleViews` that this subclass had never implemented.

---

## 4. Key M143 Upstream API Changes

Systemic changes that recurred across many files — some in patched vanilla code, most in the fork's own unpatched `custom/` sources that simply hadn't been recompiled against them yet:

| Change | Old (M142 or earlier) | New (M143) |
|---|---|---|
| `GURL` accessors | `host()`/`path()`/`scheme()`/`query()`/`ref()` returned (or bound cleanly to) `std::string` | All return `std::string_view`. `std::string x = url.host();`, `const std::string& x = url.host();`, passing the result to a `const std::string&` parameter, or concatenating with a raw string literal (`"foo" + url.host()`) all now fail to compile — wrap in `std::string(...)` (or use `base::StrCat({...})` for concatenation) |
| `base::JSONReader::Read` | 1-arg overload existed | Strictly requires the `options` int as a 2nd argument — pass `base::JSON_PARSE_RFC` unless a specific parse flag is needed |
| `views::NonClientFrameView` | Class name (M142: aliased to `FrameView`, marked for removal) | Alias removed — the real, and only, name is now `views::FrameView`. Same interface (`GetBoundsForClientView`/`GetWindowBoundsForClientBounds`/`NonClientHitTest`/`GetWindowMask`/`ResetWindowControls`/`UpdateWindowIcon`/`UpdateWindowTitle`/`SizeConstraintsChanged`, unchanged signatures) |
| `chrome/browser/ui/views/frame/browser_frame.h` / `BrowserFrame` | M142's temporary `using BrowserFrame = BrowserWidget;` alias | Removed entirely, header and all — nothing named `BrowserFrame` exists anymore. Use `BrowserWidget`/`browser_widget()` directly; several fork files still had the now-nonexistent include, unused, and just needed deleting |
| `BrowserView::immersive_mode_controller()` | Bare accessor on `BrowserView` | Removed — use the static `ImmersiveModeController::From(browser())` factory (already the pattern most of `browser_view.cc` had migrated to; 2 call sites were missed during rebasing) |
| `TabStyleViews::GetPath` | `(PathType, float scale, bool force_active = false, RenderUnits render_units = kPixels)` | `(PathType, float scale, const TabPathFlags& flags)` — a new struct bundling `force_active`, `render_units`, and a new `should_paint_extension` field; callers use designated-init (`{.force_active = is_active}`) |
| `TabMutedReason` enum values | `AUDIO_INDICATOR`, etc. (SCREAMING_CASE) | Renamed to `kAudioIndicator` etc., matching Chromium's standard enum-value style |
| `content::DropData` | `.url` (`GURL`) / `.url_title` (`std::u16string`) | Replaced by `.url_infos` (`std::vector<ui::ClipboardUrlInfo>`, each with its own `.url`/`.title`) — supports multiple dragged URLs. Guard with `!drop_data.url_infos.empty()` before indexing `.front()` |
| `content::RenderWidgetHostView::CopyFromSurface` callback | `base::OnceCallback<void(const SkBitmap&)>` | `base::OnceCallback<void(const viz::CopyOutputBitmapWithMetadata&)>` — access the bitmap via `result.bitmap` |
| `AutocompleteController` constructor | `(std::unique_ptr<AutocompleteProviderClient>, int provider_types_bitmask)` | `(std::unique_ptr<AutocompleteProviderClient>, const AutocompleteControllerConfig&)` — wrap the old bitmask as `AutocompleteControllerConfig{.provider_types = ...}` |
| `infobars::InfoBarManager::Observer::OnManagerShuttingDown` | Existed | Renamed `OnManagerWillBeDestroyed(InfoBarManager*)` |
| `base::MemoryPressureListener::MEMORY_PRESSURE_LEVEL_*` | Never valid — a longstanding fork bug, unrelated to this version bump, only now hit by compilation | These are free constants in `base::`, not nested under `MemoryPressureListener` — use `base::MEMORY_PRESSURE_LEVEL_CRITICAL` |
| `BrowserList::GetLastActive()` | Member accessor on `BrowserList` | Removed (`BrowserList` now only exposes `SetLastActive()`) — use `chrome::FindLastActive()` from `chrome/browser/ui/browser_finder.h` |
| `ui/gfx/icon_util.h` | Valid include path | Moved to `ui/gfx/win/icon_util.h` |
| `GURL::path_piece()` / `host_piece()` / etc. | Existed alongside `path()`/`host()` | Removed — the non-`_piece()` accessors already return `string_view` directly now (see the first row of this table), making the `_piece()` variants redundant |
| `resource_ids_custom.spec` "size" semantics | Undocumented in this fork | Reverse-engineered this rebase: a declared `META.sizes` value is a **per-file safety ceiling**, checked at grit-build time against that file's own actual assigned-id count. It is **not** a reserved address range other entries must respect — adjacent entries routinely start before the previous entry's `start + declared size` already ends, and that's fine as long as real usage doesn't collide. Only the *exact next entry's literal start value* matters for collision-freedom |

---

## 5. Post-Rebase Compile & Link Fixes

`apply_patches` reporting 0 failed was the *start* of the real debugging, not the end — roughly 20 `npm run build` cycles followed, fixing one or a handful of errors at a time. Grouped by theme rather than chronologically:

### 5.1 GN/resource-ID gaps (gn-gen-time, before any compilation)

- **`net/BUILD.gn`** (a vanilla, never-before-patched file) had no dependency on `//custom/buildflags:custom_browser_buildflags`, so `net/dns/host_resolver.h`'s `#include "custom/buildflags/custom_browser_buildflags.h"` (added by an existing, cleanly-applying patch) couldn't find its generated header. Added the dep to `component("net")`'s `public_deps`.
- **`custom/branding/BUILD.gn`**'s `components_strings` target was missing the newly-added upstream `contextual_tasks_strings.grdp` from its `grdp_files` list — `custom/branding/createBrandedGrd.py` asserts every real `<part>` referenced by `components/components_strings.grd` is present in that list.
- The four `resource_ids_custom.spec` gaps from §3.

### 5.2 A systemic, pre-existing bug across `custom/`, exposed by finally compiling this code for real

Roughly 50 call sites across `custom/` had never been adapted to `base::JSONReader::Read` requiring an explicit `options` argument, or to `GURL`'s accessors returning `string_view` (§4) — both facts that have been true in Chromium for a long time, not new in M143. Batch-fixed with a small script matching the recurring shapes (direct positional args, `const std::string&` reference bindings, and raw-string-literal concatenation needing `base::StrCat`). The sheer count strongly suggests large parts of `custom/` have never actually been through a complete, successful build before this migration — worth keeping in mind before assuming any given `custom/` file "already works" just because a patch or a prior commit touched it.

### 5.3 `browser_view.h`/`browser_view.cc`/`browser_window.h` cross-file gap

`browser_window.h`'s own rebase correctly added 9 new pure virtuals to `BrowserWindow` (`FocusBottombar`, `IsBottombarVisible`/`IsBottombarShowing`, `IsSidebarVisible`, `UpdateSidebarVisibility`/`UpdateSidebarPosition`, `IsVerticalTabBarVisible`, `UpdateVerticalTabBarVisibility`, `UpdateTabsVisibility`) — but `browser_view.h`, the concrete `BrowserView` implementation (patched independently, in a different rebase batch), never got matching `override` declarations for any of them, even though `browser_view.cc` already defined bodies for all of them. `BrowserView` was an abstract class until this was fixed by adding the 9 declarations (plus 2 plain, non-override `IsCompactLayoutEnabled()`/`IsMinimalBrowsingModeEnabled()` accessors that only existed as a raw pref check, never as named methods). Separately — and unrelated to this version bump at all — `bottom_container_` itself (the raw_ptr member, as opposed to its accessor and forward declaration) had never been declared anywhere in `browser_view.h`, in any prior version of this patch; only surfaced now because `BOTTOM_BAR` finally got compiled in this build.

### 5.4 Genuinely pre-existing gaps, unrelated to M143, only now surfacing

- **`chrome/browser/platform_util_win.cc`**'s stored patch was **literally truncated** — it ends mid-`#if`/`#else` with no matching `#endif` anywhere in the file. Added the missing `#endif`.
- **`chrome/browser/extensions/extension_view_host.cc`**, **`chrome/installer/util/shell_util.cc`**, **`chrome/browser/ui/views/tabs/tab.cc`**, **`chrome/browser/ui/tabs/tab_strip_model.cc`**, **`chrome/browser/renderer_context_menu/render_view_context_menu.cc`** — each missing one or two `#include`s the stored patch never added in the first place (`ui/base/resource/resource_bundle.h` + `custom/grit/custom_resources.h`; `custom/installer/util/set_as_default_util.h`; `custom/browser/tab/tab_service.h` + `tab_service_factory.h` twice over; `components/content_settings/core/browser/content_settings_utils.h` + `host_content_settings_map.h`).
- **`chrome/browser/ui/webui/chrome_web_ui_controller_factory.cc`**'s *favicon-lookup* function (a separate function from the WebUI-factory-registration one this rebase already fixed) called `BookmarksUI`/`DownloadsUI`/`extensions::ExtensionsUI::GetFaviconResourceBytes()` unconditionally — even though their `.cc` sources are excluded from the build entirely under `ENABLE_CUSTOM_WEBUI`. This is a **link**-time failure (undefined symbol), not a compile-time one, so it slipped past every earlier build-fix pass until the linker finally ran. Guarded all three call sites with `#if !BUILDFLAG(ENABLE_CUSTOM_WEBUI)` (extensions' also needs `&& !BUILDFLAG(ENABLE_CUSTOM_WEBUI)` alongside its existing `ENABLE_EXTENSIONS_CORE` guard).
- **`custom/app/custom_main_delegate.cc`** was never added to the Windows `shared_library("chrome_dll")` target's `sources` in `chrome/BUILD.gn` — only to the `is_linux || is_chromeos` branch of the separate `"chrome"` executable target. A `# TODO: (KP) Add buildflag for custom branding` comment sat at exactly the spot the fix belongs. Also a link-time-only failure (`undefined symbol: custom::CustomMainDelegate::CustomMainDelegate(...)`).

### 5.5 `OmniboxClient` interface ripple (self-inflicted, but worth flagging for future custom interface changes)

The fork's own `components-omnibox-browser-omnibox_client.h` patch adds `GetTabService()`/`GetToolbarService()` pure virtuals to `OmniboxClient`. Every subclass anywhere in the tree needs an override — including ones the fork doesn't otherwise patch. Two were missed on the first pass: `LensComposeboxOmniboxClient` (`chrome/browser/ui/lens/lens_composebox_handler.cc`) and `ContextualTasksOmniboxClient` (`chrome/browser/contextual_tasks/contextual_tasks_composebox_handler.cc`) — both plain, unpatched upstream files that only failed once ninja got far enough to compile them. Fixed by adding matching `nullptr`-returning overrides, mirroring the fork's own `ComposeboxOmniboxClient`/`RealboxOmniboxClient`. **Lesson for any future custom addition to a widely-subclassed interface: grep the whole tree for every subclass before considering the change done, not just the ones with existing patches** — `git grep` for `: public OmniboxClient` / `: public ContextualOmniboxClient` / `: public SearchboxOmniboxClient` would have caught both up front.

---

## 6. Cross-Agent Coordination Issues

- The parallel rebase batch that fixed `browser_view.cc` and the batch that fixed the newly-split `browser_view_layout.{h,cc}`/`layout/*.{h,cc}` files each independently adapted the `bottom_contents_separator` wiring for the other's file, and each correctly *flagged* (in its own report) that the other file needed a follow-up — but neither could make the fix itself, since it was outside its assigned scope. Reconciled centrally after both batches reported done (added `layout_views.bottom_contents_separator = bottom_contents_separator_;` to `browser_view.cc`'s struct-population block), the same shape as the 1.9.0 migration's `WorkspacesList` enum mismatch.
- Neither agent, nor the `apply_patches` pass, could have caught that `browser_window.h` (fixed by a different batch entirely) had grown 9 new pure virtuals `browser_view.h` itself needed to mirror (§5.3) — that only surfaced via the full build, reinforcing 1.9.0's own conclusion, again: a clean patch-application report proves nothing about whether the tree actually compiles.

---

## 7. Known Remaining Issues

| Issue | Status | Notes |
|---|---|---|
| Third-party lib patch re-application always reports "failed" | Known, harmless (recurring every migration) | `libtorrent` and `search_engines_data` have no reset-to-HEAD step in their apply path. Verify content with `grep`, not the `apply_patches` report, for these two libs. |
| `resource_ids_custom.spec`'s real semantics | Now documented (§4) | Wasn't written down anywhere in the fork's own docs before this migration — link back here if a future migration hits the same overflow-or-missing-entry error class, rather than re-deriving it from scratch. |
| Two-phase character of this migration | Worth planning for explicitly next time | This round's real gating sequence was: rebase 70 patches → `apply_patches` clean (modulo the known 4 false positives) → **only then** discover the `browser_view.h`/`browser_window.h` cross-gap and ~15 more genuinely pre-existing (non-M143) bugs, reachable only once the tree compiled end-to-end for the first time in a while. Budget for these as two distinct phases with very different failure characters, not one — patch-rebase failures are mechanical and parallelizable; the build-fix tail is sequential, unpredictable in length, and where most of the *interesting* bugs turned out to live. |
| `custom/` build health generally | Improved, not guaranteed | This migration fixed every JSONReader/GURL call site *it happened to reach* by compiling. Files still gated behind flags that default off (or are simply never linked into this build config) may still contain the same class of bug, undetected until something changes their reachability. |
