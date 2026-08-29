# Chromium 141 → 142 Migration Notes

> **Branch:** `master`
> **Chromium tag:** `141.0.7390.125` → `142.0.7444.177`
> **Date:** August 2026
> **Patch rebase scope:** 76 failed patches (74 `.rej` files + 2 silent failures)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Retired / Relocated Patches](#2-retired--relocated-patches)
3. [Manual Fixes — Patch Context Shifts](#3-manual-fixes--patch-context-shifts)
4. [Key M142 Upstream API Changes](#4-key-m142-upstream-api-changes)
5. [Post-Rebase Compile Fixes](#5-post-rebase-compile-fixes)
6. [Cross-Agent Coordination Issues](#6-cross-agent-coordination-issues)
7. [Known Remaining Issues](#7-known-remaining-issues)

---

## 1. Overview

The M141 → M142 upgrade required rebasing **76 failed patches** (out of 729 total, after 2 retirements and 6 relocations). `npm run apply_patches` initially reported these as `.rej` files or silent failures (no `.patchinfo`). Following the corrected 6-step order established during the M140 → M141 migration (assess → fix source directly → delete `.rej` → `update_patches` once → rebuild and fix compile errors → `apply_patches` once as final verification), the work was parallelized across 8 concurrent agent clusters (~9-11 files each, grouped by subsystem: extensions, views/frame UI, browser-core UI, misc UI/resources, resources/misc chrome, themes/paks/safe_browsing, omnibox/components, net/blink/ios/tools), each independently reading the patch, the `.rej`, and the current M142 source to determine what was genuinely missing versus already present. One file (`chrome_content_browser_client.cc`) was fixed by hand ahead of dispatch since its gap (a single renamed include) was trivial to spot immediately.

After all fixes and a subsequent build-fix pass (§5): `npm run apply_patches` → **"6 applied cleanly, 0 applied with conflicts, 0 failed, 723 skipped"**, and a full `npm run build` succeeds (`Successfully built target 'chrome'`).

A recurring theme this migration, more pronounced than in M140→M141: **a clean patch application is not proof the patched code still works.** Several patches applied with zero context conflicts (no `.rej`, matched cleanly) yet called upstream APIs that had been renamed or removed entirely elsewhere in the same file or a sibling file — invisible to the patch tool, only surfaced by actually compiling. See §5.

---

## 2. Retired / Relocated Patches

### 2.1 Retired — feature removed upstream

- **`chrome-browser-apps-app_service-BUILD.gn.patch`**: upstream's "Introduce publishers target" refactor (crbug 441649482) removed `//chrome/app/theme:chrome_unscaled_resources[_grit]` entirely from the non-ChromeOS `app_service`/`unit_tests` deps this patch targeted; the only remaining occurrence is inside an `is_chromeos`-gated block, irrelevant to this Windows-only fork. Left unmodified rather than force something in.
- **`third_party-blink-common-fingerprinting_protection-canvas_noise_token.cc.patch`**: the file it targeted no longer exists. Traced the successor architecture: `CanvasNoiseToken`'s global-lock singleton (`Get()`/`Set()`) was replaced by a value-type `blink::NoiseToken`, stored per-`Page`/`ExecutionContext` and propagated via IPC (`content/browser/fingerprinting_protection/canvas_noise_token_data.{h,cc}`) — `CanvasNoiseTokenData::session_token_` is now default-member-initialized as `blink::NoiseToken session_token_{base::RandUint64()}` and *is* wired through renderer IPC. The gap the fork's original patch was working around (self-seeding a random token because the real IPC seeding path didn't exist yet) no longer exists upstream. Left the patch file untouched — see §4 for the 3 downstream call sites this broke.

### 2.2 Relocated — content ported to a new path

- **`components-omnibox-browser-omnibox_edit_model.cc.patch`** → `chrome/browser/ui/omnibox/omnibox_edit_model.cc` (upstream commit `db80bb9bf9466`, "Move omnibox base classes that are no longer used on iOS to //chrome"). The custom `OpenMatch` tab-disposition logic, which depends on the custom-only `TabService` class, was additionally wrapped in `#if BUILDFLAG(CUSTOM_BROWSER)` during the port — the original patch had left it unguarded, an oversight worth correcting while already there.
- **`components-safe_browsing-content-browser-web_ui-safe_browsing_ui.cc.patch`** → `.../safe_browsing_ui_handler.cc` (upstream split `SafeBrowsingUIHandler` out into its own file, commit `641e4e46425a0`).
- **`chrome-browser-resources-history-side_bar.html.patch`** → `side_bar.html.ts` (upstream converted the file from static `.html` to a lit `getHtml()` template).
- **`chrome-browser-resources-settings-privacy_page-privacy_page.html.patch`** and **`...-privacy_page.ts.patch`** → `privacy_page_index.html`/`.ts` (Settings re-architecture moved the ads-subpage gating into a new view-manager file; the unrelated privacy-guide-link hunk had already landed correctly in the original `privacy_page.html`).
- **`chrome-browser-chrome_browser_interface_binders_webui.cc.patch`** → split across two new files, `chrome_browser_interface_binders_webui_parts_desktop.cc` and `..._parts_features.cc` (upstream's platform/feature split). The original file is now pure orchestration with none of the guarded content, so its own diff goes empty on `update_patches`.

---

## 3. Manual Fixes — Patch Context Shifts

The bulk of the 76 failures were parallelized across 8 agent clusters. A striking pattern emerged: for roughly a third of the assigned files, the *substantive* logic hunk had already applied cleanly via context-fuzz during the initial failed `apply_patches` run, and only a small, easily-missed accompanying hunk — usually a single `#include` — had actually been rejected. Representative fixes:

- **10 extensions files** (`api_browser_context_keyed_service_factories.cc`, `proxy_api_helpers.cc`, `component_extensions_allowlist/allowlist.cc`, `component_loader.cc`, `extension_install_prompt.{cc,h}`, `extension_tab_util.cc`, `extension_view_host.cc`, `install_signer.cc`, `install_verifier.cc`) — same shape every time: the behavior hunk was already present; the include hunk (often `build/branding_buildflags.h` or `custom/grit/custom_resources.h`, sitting just above a new `static_assert(BUILDFLAG(ENABLE_EXTENSIONS_CORE))` line upstream inserted) needed manual re-insertion.
- **`chrome/browser/ui/browser.cc`** — `CanCloseAsQuit()`/`CanCloseInClosingTabs()` early-return guards re-inserted into the refactored `HandleBeforeClose()` lambda, adapted to upstream's new `BrowserWindowInterface::ClosingStatus` return type.
- **`chrome/browser/ui/views/frame/browser_view.cc`** — constructor signature changed from `BrowserView(std::unique_ptr<Browser>)` to `BrowserView(Browser*)`; gained a new `main_container_` concept and a `BrowserViewLayoutDelegateImplBase::CreateDelegate(*this)` factory call (see §6 for the fallout). Re-inserted the entire missing ctor block (bottom bar/sidebar/vertical-tab-bar/split-view child-view creation, title-logo view, etc.) and several dropped call sites (`GetSavedWindowPlacement`, `GetAccessiblePanes`, `bottombar_->Init()`).
- **`chrome/browser/ui/views/frame/browser_view_layout.cc`** — the entire `Layout()` compact-row/zen-mode/vertical-tabs branching and `CustomLayoutContainers()` were absent; reinstated, with `main_container_->SetBoundsRect()` running first ahead of the custom container positioning (flagged for a closer look — see §7).
- **`components/history/core/browser/history_service.h`** — anchor member `origin_queried_closure_for_testing_` was removed/renamed upstream; the `HistoryBackend* history_backend()` accessor re-anchored to the last remaining public member.
- **Enum renumbering** (values are persisted to UMA logs and must never be reused):
  - `third_party/blink/.../css_property_id.mojom`'s `kBbSimpleOverflowClip` moved `882` → `887` (upstream claimed 883-886 for 4 new entries).
  - `tools/metrics/histograms/metadata/sync/enums.xml`'s 6 custom `TabVerticalTabBar*` entries moved `100332-100337` → `100338-100343` (upstream claimed 100332-100337 for new iOS promo counters). A 7th related pref, `WorkspacesList` (`100344`), was added to `chrome_syncable_prefs_database.cc` by one agent cluster without a matching `enums.xml` entry from a different cluster — caught and reconciled centrally (see §6).
- **`chrome/renderer_context_menu/render_view_context_menu.cc`** — upstream's UMA histogram map added a new `IDC_CONTENT_CONTEXT_GLICSHAREIMAGE` entry at value 157, colliding with the fork's reserved slot; inserted `IDC_CONTENT_CONTEXT_OPEN_IN_SPLIT_VIEW` at 158 and bumped the sentinel to `{0, 159}`.

---

## 4. Key M142 Upstream API Changes

Systemic changes that recurred across many files, worth knowing before the *next* migration too:

| Change | Old (M141) | New (M142) |
|---|---|---|
| Canvas/hardware-concurrency fingerprint noise | `blink::CanvasNoiseToken::Get()` (global singleton) | Class removed entirely; replaced with a self-seeded `static const uint64_t token = base::RandUint64();` at each of the fork's 3 call sites (`navigator_concurrent_hardware.cc`, `base_rendering_context_2d.cc`, `analyser_node.cc`) — upstream's own replacement (`blink::NoiseToken`, IPC-propagated per-page) does the equivalent job natively now, but isn't exposed to these call sites' scope |
| Screen singleton accessor | `display::Screen::GetScreen()` | `display::Screen::Get()` |
| Browser window/frame accessor | `BrowserView::frame()` returning `BrowserFrame*` | `BrowserView::browser_widget()` returning `BrowserWidget*` (a `using BrowserFrame = BrowserWidget;` temporary alias exists but is marked for removal) |
| Widget frame-view factory hook | `virtual std::unique_ptr<views::NonClientFrameView> CreateNonClientFrameView(Widget*)` | `virtual std::unique_ptr<views::FrameView> CreateFrameView(Widget*)` (`NonClientFrameView` is now a type alias for `FrameView`) |
| Native type header | `ui/gfx/native_widget_types.h` | `ui/gfx/native_ui_types.h` |
| Dark-mode detection | `ui::NativeTheme::ShouldUseDarkColors()` | Removed; use `preferred_color_scheme() == ui::NativeTheme::PreferredColorScheme::kDark` |
| Effective-URL hook | `virtual GURL ContentBrowserClient::GetEffectiveURL(...)` | `virtual std::optional<GURL> GetEffectiveURL(...)`, returning `std::nullopt` instead of the unmodified input URL |
| JSON dict parsing | `base::JSONReader::ReadDict(json)` (2nd `options` arg defaulted) | `options` is now a required 2nd argument — pass `base::JSON_PARSE_CHROMIUM_EXTENSIONS` explicitly to match the old default |
| `AddressCountryCode` visibility | Usable unqualified in some `.cc` files | Requires explicit `autofill::` qualification |
| `WebNavigationTabObserver` full definition | Reachable transitively via `web_navigation_api.h`'s forward declaration | Needs its own direct `#include "chrome/browser/extensions/api/web_navigation/web_navigation_tab_observer.h"` |
| `BASE_FEATURE` in `chrome/common/chrome_features.cc` | `HttpsFirstModeV2ForTypicallySecureUsers`, `KAnonymityService` (no `k` prefix) | `kHttpsFirstModeV2ForTypicallySecureUsers`, `kKAnonymityService` |
| `BASE_FEATURE` 3-arg → 2-arg drift continues | A few stragglers (`content_settings/core/common/features.cc`, `optimization_guide_features.cc`, `performance_manager/features.cc`, `search/ntp_features.cc`, `services/network/public/cpp/features.cc`) still had 3-arg forms in the fork's `#if BUILDFLAG(CUSTOM_BROWSER)` overrides | Adapted to the 2-arg auto-named form, matching the M140→M141 migration's note that this drift is ongoing |
| `plus_addresses` directory layout | `components/plus_addresses/resources/...` | `components/plus_addresses/core/browser/resources/...` (affects the fork's `resource_ids_custom.spec` entries, not just includes) |
| libc++/Clang thread-safety analysis | Two-`unique_lock`-with-`adopt_lock` idiom for locking two mutexes analyzed successfully | No longer verifiable by the newer toolchain's TSA for `session_settings::operator=` in vendored libtorrent; needed `std::scoped_lock` instead (the vendored code's own comment already suggested this "in C++17") |

---

## 5. Post-Rebase Compile Fixes

After `apply_patches` reported 0 failed, a full build surfaced a long tail of real errors across 9 rebuild-fix cycles — a mix of Chromium API drift that broke custom code directly (not caught by patch-context rebasing, since the patches themselves applied cleanly) and pure build-infrastructure gaps. Fixed in the order encountered:

### 5.1 GN visibility gap — `//custom/browser/mail:mail_service`

`components/os_crypt/sync/BUILD.gn`'s `visibility` allowlist (a vanilla, never-before-patched file) didn't include the fork's mail client target, which depends on it for credential storage. Added `"//custom/browser/mail:mail_service"` to the list — the first GN-gen-time failure of the whole rebase, before any compilation even started.

### 5.2 New upstream GRD files missing resource IDs

Two brand-new upstream `.grd` files needed entries in `custom/tools/gritsettings/resource_ids_custom.spec` (which is used *instead of*, not merged with, vanilla's spec):
- `chrome/browser/actor/resources/browser_resources.grd` (shares an id with `.../internal/browser_resources.grd`, matching the existing `glic` sharing pattern) — `structures: [2620]`, appended after the `glic` block since GRIT's id-assigner requires strictly ascending ids matching file order (an initial attempt to insert it earlier in the file, alphabetically, failed with `ValueError: Cannot jump to unvisited: 2540`).
- `<(SHARED_INTERMEDIATE_DIR)/chrome/browser/resources/contextual_tasks/resources.grd` — `includes: [3770]`, fit cleanly into an existing gap between `connectors_internals` (3760) and `data_sharing` (3780) that vanilla's own spec already reserved.

Separately, a proactive diff of the two spec files (comparing every `.grd` key, per the M140→M141 doc's own recommendation in its §6.7) found the fork's `plus_addresses` entries pointing at the pre-restructure path (`components/plus_addresses/resources/...` instead of `.../core/browser/resources/...`) — fixed before it could surface as a build failure. A handful of other vanilla-only entries (ash/ios/chromeos-specific, plus `chrome_unscaled_resources.grd`/`theme_resources.grd` which this fork replaces with its own custom-branded GRDs entirely) were confirmed out of scope for this Windows desktop build and left alone.

### 5.3 `CanvasNoiseToken` removal fallout (3 files)

See §2.1/§4. `navigator_concurrent_hardware.cc`, `base_rendering_context_2d.cc`, and `analyser_node.cc` all called the now-deleted `blink::CanvasNoiseToken::Get()`. Each swapped to a function/file-local `static const uint64_t token = base::RandUint64();`, preserving the original per-renderer-process-session semantics (the removed class was itself just a self-seeded singleton, per the M140→M141 migration's own §6.3-adjacent history of this exact code).

### 5.4 `Screen::GetScreen()` rename fallout (9 files)

See §4. Found via a full-tree grep after fixing the first occurrence (`content/browser/web_contents/web_contents_view_aura.cc`, itself a patched vanilla file): 8 more fork-owned files under `custom/` (`splash_screen_window.cc`, `undocked_sidebar_widget.cc`, `panel_view.cc`, `vertical_tab_bar.cc`, `display_settings_provider.cc`, `super_drag_delegate.cc`, `mouse_gesture_widget_delegate_view_win.cc`, and the demo binaries) all called the old name — none of them go through the patch pipeline (they're new files, not diffs against vanilla), so nothing about the patch rebase would ever have caught them.

### 5.5 `BrowserView::frame()` → `browser_widget()` rename fallout (3 files)

`custom/browser/ui/views/frame/bottom_container_view.cc`, `.../bottombar/bottombar_view.cc`, and `custom/browser/boss_key/boss_key_observer.cc` all called `->frame()`. Renamed to `->browser_widget()`, and (in `boss_key_observer.cc`) the local variable's declared type from `BrowserFrame*` to `BrowserWidget*` directly rather than relying on the temporary compatibility alias.

### 5.6 `CreateNonClientFrameView` → `CreateFrameView` rename fallout (2 files)

`custom/browser/ui/views/sidebar/undocked_sidebar_widget.{h,cc}` and `custom/browser/ui/views/panels/panel_view.{h,cc}` both overrode the old hook. Renamed both the declaration and definition, matching the new signature (`std::unique_ptr<views::FrameView>`).

### 5.7 `-Wshadow` false positive at template-instantiation point

`custom/browser/ui/views/frame/sidebar_container_view.cc` had two functions with a local variable literally named `web_contents` in the same scope where `extensions::WebNavigationTabObserver::CreateForWebContents(...)` was first ODR-used in this translation unit — `WebContentsUserData<T>::CreateForWebContents`'s own constructor parameter (also named `web_contents`, in the vanilla, un-owned header) triggered Clang's `-Wshadow` at the instantiation point rather than inside the template body itself. Fixed by renaming the fork's own locals (`tab_contents`, `owned_web_contents`) rather than touching vanilla code — a pure naming-collision artifact of first-instantiation diagnostics, not a real bug. Also needed the direct `web_navigation_tab_observer.h` include (§4) in both this file and `custom/browser/sidebar/sidebar_web_contents_delegate.cc`.

### 5.8 `chromium-style` complex-constructor check, newly stricter

`custom/browser/net/resource_context_data.h`'s `RequestIDGenerator() = default;` — inline in the header — was flagged `[chromium-style] Complex constructor has an inlined body`, apparently because the class's `int64_t id_ = 0;` non-static data member initializer now makes the plugin (recompiled against the newer bundled Clang) consider the constructor non-trivial. Moved the constructor definition out-of-line into `resource_context_data.cc` (`RequestIDGenerator::RequestIDGenerator() = default;`), leaving only the declaration in the header — the standard Chromium fix for this diagnostic category.

### 5.9 libtorrent thread-safety-analysis regression

See §4. `custom/third_party/libtorrent/src/include/libtorrent/aux_/session_settings.hpp`'s `operator=` used `std::lock(rhs.m_mutex, m_mutex)` followed by two separate `std::unique_lock<std::mutex>(..., std::adopt_lock)` objects to lock two mutexes jointly — a pattern the newer libc++/Clang toolchain's thread-safety analysis could no longer verify (`error: mutex '...' is not held on every path through here`). The code's own pre-existing comment ("in C++17, use a single std::scoped_lock instead") pointed straight at the fix: replaced the three-line lock dance with `std::scoped_lock l(rhs.m_mutex, m_mutex);`.

### 5.10 `BrowserViewLayoutDelegateImpl` missing 4 custom overrides

**Files:** `chrome/browser/ui/views/frame/browser_view_layout_delegate_impl.{h,cc}` (brand-new upstream files, no prior fork patch)

Upstream split `BrowserViewLayoutDelegateImpl` out of `browser_view.cc` into these two new files (with an `Old`/`New`/`Base` split for a side-by-side rollout). The fork's 4 custom pure-virtual delegate methods (`IsBottombarVisible`, `IsCompactLayoutEnabled`, `IsZenModeActive`, `IsZenModeHiding` — already correctly declared in the patched `browser_view_layout_delegate.h`) had no implementation anywhere in the new files, which would have failed to link/compile the moment `BrowserViewLayoutDelegateImplBase::CreateDelegate()` tried to instantiate the (abstract, until fixed) concrete subclasses — a genuine gap not caught by any individual agent cluster, since no existing patch targeted these new files for any of them to find. Fixed by adding forwarding overrides to `BrowserViewLayoutDelegateImplBase`, matching the existing pattern (every other override forwards to `browser_view_->Xxx()`):
```cpp
bool BrowserViewLayoutDelegateImplBase::IsCompactLayoutEnabled() const {
  return browser_view_->IsCompactLayoutEnabled();
}
```
`IsCompactLayoutEnabled()` itself didn't exist on `BrowserView` at all (only the `kCompactLayout` pref existed, invalidating layout on change with no cached bool) — added as a new `const` accessor reading the pref live via `browser()->profile()->GetPrefs()->GetBoolean(...)` (not `GetProfile()`, which isn't `const`-callable). `update_patches` correctly picked up both new files as fresh diffs with no manual patch-file surgery needed.

---

## 6. Cross-Agent Coordination Issues

Running 8 independent agent clusters in parallel, each scoped to a disjoint file list, surfaced two cases where a fix in one cluster's files had a dependency on another cluster's files that neither could see:

- **`enums.xml` / `chrome_syncable_prefs_database.cc` enum mismatch** (§3): one cluster renumbered `chrome_syncable_prefs_database.cc`'s 7 `syncable_prefs_ids` values (6 `TabVerticalTabBar*` + `WorkspacesList`) to `100338-100344`; a different cluster, working from stale information about the first cluster's progress, added only 6 matching `enums.xml` entries (`100338-100343`), missing `WorkspacesList`. Caught by comparing both files' final state after all clusters reported done, and reconciled by adding the missing `100344` entry.
- **`BrowserViewLayoutDelegateImpl` gap** (§5.10): flagged explicitly by the cluster that found it ("worth a dedicated patch/pass since there was no pre-existing custom patch for these two new files") rather than silently worked around, since the files weren't in that cluster's assigned scope. Fixed centrally after all clusters completed.

Neither issue would have been caught by patch-level verification alone (`apply_patches` reporting 0 failed) — both only surfaced via the full build in §5, reinforcing that a build pass is not optional after a multi-agent patch rebase, however clean the patch-application report looks.

---

## 7. Known Remaining Issues

| Issue | Status | Notes |
|---|---|---|
| Third-party lib patch re-application always reports "failed" | Known, harmless (recurring from M140→M141) | `libtorrent` and `search_engines_data` have no reset-to-HEAD step in their apply path. Verify content with `grep`, not the apply_patches report, for these two libs. |
| `kBbSimpleOverflowClip` / `TabVerticalTabBar*` enum stability | Mitigated | Reassigned to 887 / 100338-100344 in M142. Check again on the next milestone if upstream claims these slots before then. |
| `CustomLayoutContainers()` vs. the new `main_container_` concept | Unverified, not yet a known bug | `browser_view_layout.cc`'s custom compact/zen-mode/vertical-tabs layout branch positions `contents_container_` directly, while normal (non-custom) layout now nests it under a new `main_container_`. The rebase kept `main_container_->SetBoundsRect()` running first for safety and the build compiles clean, but this coordinate-space interaction between old custom code and the new concept hasn't been runtime-verified (bottom bar, vertical tab bar, split view). |
| `resource_ids_custom.spec` drift from vanilla | Mitigated, not exhaustively verified | `plus_addresses` path fixed and 2 new GRDs added proactively (§5.2); the M140→M141 migration's recommendation to diff the two spec files' `META.sizes` values directly (not just key presence) wasn't repeated this round — worth doing on the next migration too. |
