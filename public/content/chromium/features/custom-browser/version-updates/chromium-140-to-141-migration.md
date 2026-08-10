# Chromium 140 → 141 Migration Notes

> **Branch:** `master`
> **Chromium tag:** `140.0.7339.210` → `141.0.7390.125`
> **Date:** August 2026
> **Patch rebase scope:** 68 failed patches (65 `.rej` files + 3 silent failures)

---

## Table of Contents

1. [Overview](#1-overview)
2. [The apply_patches Data-Loss Incident](#2-the-apply_patches-data-loss-incident)
3. [Retired / Removed Patches](#3-retired--removed-patches)
4. [Manual Fixes — Patch Context Shifts](#4-manual-fixes--patch-context-shifts)
5. [Key M141 Upstream API Changes](#5-key-m141-upstream-api-changes)
6. [Post-Rebase Compile Fixes](#6-post-rebase-compile-fixes)
7. [Known Remaining Issues](#7-known-remaining-issues)

---

## 1. Overview

The M140 → M141 upgrade required rebasing **68 failed patches** (out of 711 total, after 2 retirements). `npm run apply_patches` initially reported these as `.rej` files or silent failures (no `.patchinfo`). The work was parallelized across 8 concurrent agent clusters (~8-9 files each), each independently reading the patch, the `.rej`, and the current M141 source to determine what was genuinely missing versus already present.

After all fixes: `npm run apply_patches` → **"306 applied cleanly, 0 applied with conflicts, 0 failed, 405 skipped"**, and a full `npm run build` succeeds (`Successfully built target 'chrome'`).

---

## 2. The apply_patches Data-Loss Incident

This migration surfaced a serious, previously-undocumented footgun in the patch tooling that cost significant rework. It is recorded here in detail so it is never repeated.

**What happened:** Partway through the rebase, `npm run apply_patches` was run as a "let's check progress" sanity check while ~60 files still had fixes in progress. This appeared harmless but **silently wiped every one of those fixes**.

**Root cause:** For every file whose `.patchinfo` is missing or whose stored checksum doesn't match the file's current content, `apply_patches` does not attempt a forward-patch against the file's *current* state. Instead it:
1. Runs `git checkout HEAD -- <file>` to reset the file to the last-committed (pristine, unpatched) state.
2. Reapplies the **raw stored `.patch`** from scratch.

Any manual fix that went beyond exactly what the stored patch's original hunks could reproduce — a hand-relocated hunk, a new include inserted at a new location because upstream moved the anchor, a renumbered enum value — was discarded the instant this ran, because the stored patch on disk still reflected the *pre-rebase* (M140-shaped) diff.

**How it was caught:** The user asked, after being told the rebase looked complete: *"did you update the patchinfo files before trying to rerun apply patches? If there is a patchinfo file it should not attempt to apply that patch again"* — a single sharp diagnostic question that correctly identified the mechanism before the mistake was otherwise noticed.

**Recovery:** Verified via `git diff` in `src/` (itself a git repo, detached HEAD at the Chromium tag) that affected files had reverted to pristine M141 + raw-patch state. Re-dispatched the same 8 agent clusters with two added safeguards in every prompt:
- Do **not** create or edit `.patchinfo` files.
- Do **not** run `npm run apply_patches` yourself at any point.

The `.rej` files regenerated in bit-for-bit identical failure states on the redo pass, confirming the fixes were reproducible.

**The corrected, safe order of operations** (now the standing rule for every future rebase):
1. Assess: count `.rej` files and patches missing `.patchinfo`.
2. Fix every real gap by editing the actual vanilla source files directly under `src/` — never touch `.patch` files, never hand-write `.patchinfo`.
3. Delete stale `.rej` files as each fix lands.
4. Run `npm run update_patches` **exactly once**, only after all fixes are believed complete. This diffs current-vs-pristine and regenerates fresh, self-consistent patch+patchinfo pairs non-destructively — it never resets a file.
5. Rebuild (`npm run build`) and iteratively fix any real compile errors that surface (see §6) — these are a separate class of problem from patch-application gaps. Re-run `update_patches` again if any such fix touches a vanilla (non-`custom/`) file.
6. Only after a clean build, run `npm run apply_patches` once as the final verification.

**A secondary, pre-existing quirk** surfaced during the final verification: `custom/third_party/libtorrent/src` and `custom/.../search_engines_data` are their own nested git repos (not part of the main `src` tree). Their patch-application path has **no reset-to-HEAD step** before reapplying — so `apply_patches` always reports them as failed ("already applied," context no longer matches) once their patch has ever been applied, even though the content is correct. This is unrelated to any specific Chromium version; verify these two libs by `grep`-checking for the expected content rather than trusting the apply_patches report.

---

## 3. Retired / Removed Patches

### 3.1 `profile_info_watcher` — superseded by `HistorySignInStateWatcher`

**Patches deleted:**
- `chrome-browser-ui-webui-profile_info_watcher.cc.patch`
- `chrome-browser-ui-webui-profile_info_watcher.h.patch`

**Why:** Upstream renamed/relocated `chrome/browser/ui/webui/profile_info_watcher.{cc,h}` to `chrome/browser/ui/webui/history/history_sign_in_state_watcher.{h,cc}` as `HistorySignInStateWatcher`, with a substantially different implementation (no `profile_`/`PrefService`/`signin_allowed_pref_` members). Both custom patches targeting the old path were confirmed to be functionally **inert even before this rebase** — pure `//`-commented markers with zero real effect — so there was nothing meaningful to port to the new class.

### 3.2 `accelerator_table.cc` — relocated, not retired

`chrome/browser/ui/views/accelerator_table.cc` moved to `chrome/browser/ui/accelerator_table.cc` (one directory up). The fork's patch already targeted the new path and content correctly — confirmed unaffected by the rebase.

### 3.3 Auto-retired by `update_patches` — content now matches pristine

Two patches were automatically dropped by `npm run update_patches` because their target files had zero diff against the M141 pristine base:
- `chrome-browser-ui-views-tabs-dragging-tab_drag_controller.cc.patch` — the `IDR_*`/`chrome_unscaled_resources` usage this patch touched was deleted by upstream as dead code; nothing to preserve.
- `chrome-browser-ui-webui-new_tab_page-composebox-composebox_handler.cc.patch` — the fix this patch carried (`TabService*`/`ToolbarService*` overrides) had already been correctly relocated to the sibling file `composebox_omnibox_client.h` in an earlier migration; this file's own patch was dead weight.

---

## 4. Manual Fixes — Patch Context Shifts

The bulk of the 68 failures were parallelized across 8 agent clusters (browser-core UI, blink/mojom/misc, profiles/extensions, browser_view/tabstrip, resources/GN/WebUI, net/blink/misc, plus two single-file follow-ups). Representative fixes:

- **`chrome/browser/platform_util_win.cc`** — `#include "build/branding_buildflags.h"` re-added after upstream's include reshuffle; separately, a missing `#endif` for the `#if BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)`/`#else` block only surfaced as a hard compile error later (see §6) — a reminder that "the buildflag logic looks present" is not the same as "the `#if`/`#endif` count balances."
- **`chrome/browser/chrome_browser_main.cc`** — the `#if BUILDFLAG(CUSTOM_CACHE)` clear-on-exit block re-inserted immediately before the new `TRACE_EVENT_END("toplevel", ...)` line (upstream renamed `TRACE_EVENT_NESTABLE_ASYNC_END0` → `TRACE_EVENT_END`).
- **`chrome/browser/ui/browser_commands.h`/`.cc`** — `ShowRSSInfobar`, `ToggleReuseWindowForPopups`, `ViewFormattedSource` re-anchored after upstream's `ShowTranslateBubble(Browser*)` → `ShowTranslateBubble(BrowserWindowInterface* bwi)` signature change moved the insertion point.
- **`chrome/browser/extensions/api/tabs/windows_event_router.cc`** — `WindowController::GetBrowser()` → `GetBrowserWindowInterface()`.
- **iOS `ios_most_visited_sites_factory.cc`** — `ChromeBrowserState` → `ProfileIOS`, `GetForBrowserState` → `GetForProfile`, header moved to `.../history/model/history_service_factory.h`.
- **Enum renumbering** (values are persisted to UMA logs and must never be reused):
  - `third_party/blink/.../css_property_id.mojom`'s `kBbSimpleOverflowClip` moved `882` → `883` (upstream claimed 882 for new `kBlockEllipsis`).
  - `tools/metrics/histograms/metadata/sync/enums.xml`'s 6 custom `TabVerticalTabBar*` entries moved `100331-100336` → `100332-100337` (upstream claimed 100331 for new `SplitViewDragAndDropEnabled`). Same pattern mirrored in `chrome/browser/sync/prefs/chrome_syncable_prefs_database.cc`.
- **`chrome/browser/ui/views/frame/browser_view.h`** — upstream relocated `watermark_view_` into a new `ContentsContainerView` class, freeing its old declaration slot; the fork's split-view member block (`toolbar_web_view_`, `toolbar_split_view_`, `split_divider_view_`, `split_divider_x_`, `title_logo_view_`, `split_view_active_`) was re-anchored there. `contents_separator_` was renamed `top_container_separator_`; a new `contents_border_widget_`/`LayoutContentBorder()` feature moved to `ContentsContainerView` upstream, making the fork's old dead declaration for it removable.
- **`browser_view.cc`** (cross-cutting, not in any single agent's original file list) — required creating `bottom_contents_separator_` as a hidden child of `bottom_container_`, nulling it in the destructor, and passing it into the new `BrowserViewLayout` constructor parameter.
- **Resource ID growth** — new upstream grit target `chrome/browser/resources/tab_strip_api` added an entry to vanilla `tools/gritsettings/resource_ids.spec` (`includes: [5065]`, size 15); the fork's own separate `custom/tools/gritsettings/resource_ids_custom.spec` needed a matching entry (see §6.7 for a related, subtler ID-overflow bug this pattern caused).

---

## 5. Key M141 Upstream API Changes

Systemic changes that recurred across many files, worth knowing before the *next* migration too:

| Change | Old (M140) | New (M141) |
|---|---|---|
| `BASE_FEATURE` macro | 3-arg: `BASE_FEATURE(kName, "StringName", default)` | 2-arg: `BASE_FEATURE(Name, default)` — string name and `k`-prefix auto-generated |
| Trace events | `TRACE_EVENT_NESTABLE_ASYNC_END0(...)` | `TRACE_EVENT_END(...)` |
| Window→Browser accessor | `WindowController::GetBrowser()` | `GetBrowserWindowInterface()` |
| Translate bubble | `ShowTranslateBubble(Browser*)` | `ShowTranslateBubble(BrowserWindowInterface* bwi)` |
| iOS profile type | `ChromeBrowserState` / `GetForBrowserState` | `ProfileIOS` / `GetForProfile` |
| Accelerator table location | `chrome/browser/ui/views/accelerator_table.cc` | `chrome/browser/ui/accelerator_table.cc` |
| Profile info watcher | `ProfileInfoWatcher` (`profile_info_watcher.{cc,h}`) | `HistorySignInStateWatcher` (`.../history/history_sign_in_state_watcher.{h,cc}`), different shape entirely |
| `views::WidgetDelegateView()` | private ctor (unchanged since M137) | still private-ctor-gated — re-checked, not newly broken |

---

## 6. Post-Rebase Compile Fixes

After `apply_patches` reported 0 failed, a full build surfaced 15 additional real errors — Chromium 141 API changes that broke custom code directly rather than via patch context. Fixed in the order encountered:

### 6.1 `MV2ExperimentStage::kNone` removed

**File:** `chrome/browser/extensions/manifest_v2_experiment_manager.cc`

Upstream removed the `kNone` enum value entirely (fallback stage is now `kWarning`). The fork's `#if BUILDFLAG(CUSTOM_BROWSER)` branch (which permanently allows MV2 extensions, suppressing deprecation) still returned `kNone`. Confirmed via the enum's other switch statements that `kWarning` is the fully-permissive stage (never disables, never blocks re-enable) — the correct functional equivalent, with only a cosmetic Chromium warning banner as the difference:
```cpp
// Before:
return MV2ExperimentStage::kNone;
// After:
return MV2ExperimentStage::kWarning;
```

### 6.2 `base::ByteCount` — new strong type for byte counts

M141 introduced `base::ByteCount` (`base/byte_count.h`), a wrapper class replacing raw `int64_t`/`size_t` byte counts across several APIs. Affected in this rebase:
- `base::SysInfo::AmountOfPhysicalMemory()` / `AmountOfAvailablePhysicalMemory()` now return `ByteCount`, not `size_t`. Fixed in `custom/base/wanderlust_platform_util.cc` and `custom/chrome/browser/performance/performance_manager.cc` (`AmountOfPhysicalMemoryMB()` no longer exists — use `.InMiB()`).
- `ui::FormatBytes()` / `ui::FormatSpeed()` now take `base::ByteCount` directly. Fixed in `custom/browser/ui/views/download/download_options_item_view.cc`, `custom/browser/download/download_options_item_model.cc` (×2), and the patched vanilla `chrome/browser/download/download_ui_model.cc` (×2) — wrap raw integers with `base::ByteCount(n)`, and add `#include "base/byte_count.h"` where missing.

### 6.3 `-Wexit-time-destructors` newly enforced

Any `static` (non-function-local) variable with a non-trivial destructor now fails the build. Three fork-owned sites hit this:
- **`custom/components/privacy_guard/core/url_purify_default_rules.cc`** — a `static std::vector<URLPurifyRule> rules{...}` converted to `static const base::NoDestructor<std::vector<URLPurifyRule>> rules({...}); return *rules;`, matching the sibling function's existing `NoDestructor` pattern in the same file.
- **`custom/chrome/browser/features/ie_compatibility_manager.cc`** — a namespace-scope `const std::map<...> kIEUserAgents` converted to `const base::NoDestructor<std::map<...>> kIEUserAgents({...})`, with call sites changed from `.find()`/`.at()` to `->find()`/`->at()`.
- **`custom/chrome/browser/features/custom_feature_manager.h`/`.cc`** — the static class member `static base::Lock instance_lock_;` replaced with a `static base::Lock& GetInstanceLock()` accessor backed by a function-local `static base::NoDestructor<base::Lock>`, since a static Lock *member* can't be converted to NoDestructor without an accessor indirection. All 3 `base::AutoLock` call sites updated.

For **vendored third-party code** (`custom/third_party/libtorrent`), the fix was different: rather than editing vendored `.cpp` files, `-Wno-exit-time-destructors` was added to the existing `cflags_cc` suppression list in `custom/third_party/libtorrent/BUILD.gn`, matching the fork's established convention there (several other Clang warnings were already suppressed the same way for this library).

### 6.4 `BrowserView::tabstrip_` member removed

**File:** `chrome/browser/ui/views/frame/browser_view.cc`

`TabStripRegionView` now owns the `TabStrip` internally; the old `tabstrip_` member is gone. Two functions (`UpdateTabStripVisibility()`, `UpdateTabsVisibility()`) still referenced it directly. Fixed by switching to the `tabstrip()` accessor (`return tab_strip_region_view_->tab_strip();`), already defined in `browser_view.h`.

### 6.5 `tabs::TabAlertController` replaces free functions

**File:** `custom/browser/ui/views/frame/vertical_tab_bar.cc`

The free functions `GetTabAlertStatesForTab(tab)` and `GetTabAlertStateText(alert)` no longer exist. Replaced with the `TabAlertController` API (confirmed via sibling upstream files `tab.cc` and `multi_contents_view_mini_toolbar.cc`):
```cpp
// Before:
std::vector<tabs::TabAlert> alerts = GetTabAlertStatesForTab(tab);
...
alert_description = GetTabAlertStateText(alert);

// After:
tabs::TabAlertController* alert_controller = tabs::TabAlertController::From(tab);
std::vector<tabs::TabAlert> alerts =
    alert_controller ? alert_controller->GetAllActiveAlerts() : std::vector<tabs::TabAlert>();
...
alert_description = tabs::TabAlertController::GetTabAlertStateText(alert);
```
Required adding `#include "chrome/browser/ui/tabs/alert/tab_alert_controller.h"`.

### 6.6 `profiles::OpenBrowserWindowForProfile()` — new parameter

**File:** `custom/browser/ui/webui/profile_picker/custom_profile_picker_handler.cc`

Gained a `bool open_command_line_urls` parameter inserted before the trailing `Profile*`:
```cpp
// Before:
profiles::OpenBrowserWindowForProfile(callback, /*always_create=*/true, /*is_new_profile=*/true, profile);
// After:
profiles::OpenBrowserWindowForProfile(callback, /*always_create=*/true, /*is_new_profile=*/true,
                                       /*open_command_line_urls=*/false, profile);
```

### 6.7 Stale include-ID allocations in the fork's own gritsettings spec

**File:** `custom/tools/gritsettings/resource_ids_custom.spec`

`tools/gritsettings/BUILD.gn` uses `custom/tools/gritsettings/resource_ids_custom.spec` **instead of**, not merged with, vanilla `tools/gritsettings/resource_ids.spec` when `is_custom_browser` — it's a full forked copy with the same numeric ID offsets. Six entries in the custom copy had a smaller `META.sizes.includes` allocation than vanilla now has (vanilla grew these in a Chromium version prior to 141, but the custom fork's copy was never updated to match):

| `.grd` | Custom (stale) | Vanilla (current) |
|---|---|---|
| `privacy_sandbox/internals/resources.grd` | 80 | 100 |
| `settings/resources.grd` | 502 | 600 |
| `side_panel/read_anything/resources.grd` | 50 | 75 |
| `webui_browser/resources.grd` | 5 | 40 |
| `autofill_ml_internals/resources.grd` | 10 | 20 |
| `ui/file_manager/file_manager_gen_resources.grd` | 10 | 2000 |

Only `privacy_sandbox/internals` (size 80, needed 81) actually failed the build this time — a grit `IdRangeOverflow: Generated .grd file used more IDs (81) than were allocated for it (80)` — but all 6 were fixed proactively (bumped to match vanilla exactly) to avoid a repeat build failure the moment ninja happened to reach one of the other 5 targets. **Rule for the next migration:** diff the two spec files' `META.sizes` values directly rather than waiting for each one to surface as a separate build failure one ninja invocation at a time.

### 6.8 Misc single-file fixes

- **`chrome/browser/platform_util_win.cc`** — missing `#endif` for the `#if BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)`/`#else` block, not caught by the patch-rebase pass since the surrounding content "looked" present (see §2's lesson about `#if`/`#endif` balance).
- **`chrome/browser/ui/views/toolbar/toolbar_view.h`** — `BUILDFLAG(ENABLE_READER_MODE)` used without the flag ever being added to `custom_browser_config.gni`'s `custom_branding_flags` list (it only existed in the separate `custom/buildflags/BUILD.gn` → `custom_features_buildflags.h`, which this file doesn't transitively include). Added the missing `if (is_custom_browser && custom_enable_reader_mode) { custom_branding_flags += ["ENABLE_READER_MODE=1"] } else { ... =0 }` block to `custom_browser_config.gni`, mirroring the sibling `ENABLE_SIDEBAR` block.
- **`chrome/browser/ui/views/tabs/tab_container_impl.cc`** — `views::BoxLayout` used in `UpdateLayoutOrientation()` (vertical-tabs custom code) without `#include "ui/views/layout/box_layout.h"`.
- **`custom/browser/ui/controls/single_split_view.cc`** — `ui::Cursor`/`ui::mojom::CursorType` used without `#include "ui/base/cursor/cursor.h"` and `#include "ui/base/cursor/mojom/cursor_type.mojom-shared.h"`.
- **`custom/chrome/browser/features/custom_reader_mode_manager.cc`** — `web_contents->GetController().Reload(...)` needed `#include "content/public/browser/navigation_controller.h"` (only a forward-declaring header was included before).
- **`custom/browser/ntp/remote_ntp_service.cc`** — `MostVisitedSites::EnableCustomLinks(bool)` removed; replaced with `EnableTileTypes(EnableTileTypesOptions().with_custom_links(bool))`, matching the pattern used in `new_tab_page_ui.cc` and `most_visited_sites_bridge.cc`.
- **`chrome/browser/ui/webui/new_tab_page/composebox/composebox_omnibox_client.h`** — `[chromium-style]` error: "virtual methods with non-empty bodies shouldn't be declared inline" for the `GetTabService()`/`GetToolbarService()` stubs added in a previous migration (see the M140 doc, §7.7). Chromium's style-check plugin newly flags this specific pattern in header files. Moved both bodies out-of-line into `composebox_omnibox_client.cc` (which had no prior patch of its own — `update_patches` created a brand new one for it).

---

## 7. Known Remaining Issues

| Issue | Status | Notes |
|---|---|---|
| Third-party lib patch re-application always reports "failed" | Known, harmless | `libtorrent` and `search_engines_data` have no reset-to-HEAD step in their apply path (§2). Verify content with `grep`, not the apply_patches report, for these two libs. |
| `kBbSimpleOverflowClip` / `TabVerticalTabBar*` enum stability | Mitigated | Reassigned to 883 / 100332-100337 in M141. Check again on the next milestone if upstream claims these slots before then. |
| `resource_ids_custom.spec` drift from vanilla | Fixed proactively | All 6 known-stale entries bumped to match vanilla (§6.7). Diff the two spec files directly on the next migration rather than waiting for build failures. |
| Premature `apply_patches` mid-rebase | Process fix | See §2 — the corrected 6-step order is now the standing procedure; never run `apply_patches` before `update_patches` during an active rebase. |
