# Chromium 143 → 144 Migration Notes

> **Branch:** `master`
> **Chromium tag:** `143.0.7499.194` → `144.0.7559.135`
> **Date:** September 2026
> **Patch rebase scope:** patches with `.rej` files or missing `.patchinfo`, fanned out across parallel Workflow runs (12 agents, then 11 agents for a follow-up batch)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Retired / Relocated Patches](#2-retired--relocated-patches)
3. [depot_tools StrEnum Regression (Recurring)](#3-depot_tools-strenum-regression-recurring)
4. [Key M144 Upstream API Changes](#4-key-m144-upstream-api-changes)
5. [Post-Rebase Compile & Link Fixes](#5-post-rebase-compile--link-fixes)
6. [Post-Rebase Runtime Fixes](#6-post-rebase-runtime-fixes)
7. [Known Remaining Issues](#7-known-remaining-issues)

---

## 1. Overview

The M143 → M144 upgrade followed the now-familiar two-phase shape: a parallelized patch rebase, followed by a much longer, sequential build-fix tail. An initial heuristic pass ("does ~90% of a patch's added content already appear in the file?") flagged 14 patches as already-applied; rigorous hunk-by-hunk verification against each `.rej` file showed only 5 of those 14 were genuinely complete, and the other 9 went back into the real rebase queue. Two patches were dropped as no-longer-applicable and three more were retired outright because upstream deleted the feature they touched (see §2).

Once `apply_patches` reported clean, a full `npm run build` surfaced a long tail of further fixes — this migration's build-fix phase was unusually large even by this project's own recent history, spanning genuine Skia/BoringSSL/grit infrastructure breakage (§5) as well as two runtime crashes and one layout regression that only a running build could surface at all (§6). As in the 142→143 migration, **a clean patch-application report and a clean compile both said nothing about whether the browser could actually launch and render correctly** — this round drove that lesson further than any prior one, since both remaining bugs were only caught by manually launching the built browser after a "successful" build.

---

## 2. Retired / Relocated Patches

### 2.1 Retired — feature removed upstream

- **`chrome-browser-ash-scalable_iph-BUILD.gn.patch`**: `chrome/browser/ash/scalable_iph/` is ChromeOS-only (`ash::` namespace, `BUILDFLAG(IS_CHROMEOS)`-gated) and was never compiled into this fork's Windows-only build in the first place. Retired outright — nothing to port.
- **`chrome-browser-ui-views-tabs-compound_tab_container.{cc,h}.patch`**, **`...tab_strip_scroll_container.{cc,h}.patch`**: upstream deleted the entire "Tab Scrolling" feature these files implemented. Verified zero functionality loss before retiring — the fork's own tab-container hooks (tab shapes, tab strip logo, vertical tabs) already live in `tab_container_impl.{cc,h}`, which upstream kept, so nothing the fork relied on disappeared with these files.

### 2.2 Relocated — content ported to a new path

- **`chrome-browser-ui-webui-searchbox-composebox_handler.cc.patch`** → `chrome/browser/ui/webui/cr_components/composebox/composebox_handler.cc` (upstream moved the file into a `cr_components/` subdirectory).
- A new patch, **`chrome-browser-ui-webui-searchbox-omnibox_composebox_handler.cc.patch`**, was added for a brand-new upstream file (`omnibox_composebox_handler.cc`) that needed a fork-specific fix (§5.4) — not a relocation, but new fork content in a file that didn't exist before M144.

---

## 3. depot_tools StrEnum Regression (Recurring)

The `ImportError: cannot import name 'StrEnum' from 'enum'` depot_tools bug (root cause: upstream depot_tools commit `08c69adf5` deleting the root `.vpython3` spec `gclient.py` needs, causing vpython3 to fall back to a pre-3.11 Python without `StrEnum`) recurred for this sync, exactly as it had for the 143 sync. Re-applied the same fix (roll the vendored `depot_tools` back to the last commit before the deleting commit, clear the `vpython-root.0` cache, `DEPOT_TOOLS_UPDATE=0`), and this time wrote it up as a reusable skill (`.claude/skills/fix-depot-tools-vpython/SKILL.md`) so the next occurrence — upstream has not fixed this as of this migration — doesn't need re-deriving from scratch. The skill also documents a follow-on gap this round exposed: `DEPOT_TOOLS_UPDATE=0` short-circuits `update_depot_tools.bat`'s one-time Python bootstrap entirely, so a fresh checkout can be missing `python3_bin_reldir.txt`; the fix is to run `bootstrap\win_tools.bat` directly, which doesn't touch git state.

---

## 4. Key M144 Upstream API Changes

| Change | Old (M143 or earlier) | New (M144) |
|---|---|---|
| `SkPath` mutation methods | `addRRect`/`addRoundRect`/`moveTo`/`lineTo`/`arcTo`/`offset`/`transform`/`incReserve`/`close` all callable directly on `SkPath` | Hidden behind `SK_HIDE_PATH_EDIT_METHODS` (now defined in Chromium's own `skia/config/SkUserConfig.h`). Build paths via `SkPathBuilder` instead (same method names, plus `.detach()`/`.snapshot()` to get the final immutable `SkPath`); simple single-shape cases can use a static factory instead (`SkPath::RRect(rrect)` in place of `SkPath path; path.addRRect(rrect);`). `SkPathBuilder`'s `arcTo` only has the `SkPoint`-based overload, not `SkPath`'s scalar-args convenience overload — pass `SkVector(rx, ry)`/`SkPoint(x, y)` and `SkPathBuilder::kSmall_ArcSize` (a distinct nested enum from `SkPath::kSmall_ArcSize`) |
| `history::HistoryServiceObserver::OnURLVisited` | `(HistoryService*, const URLRow&, const VisitRow&)` | `(HistoryService*, const VisitedURLInfo&)` — a single struct bundling the old `url_row`/`visit_row` plus a new response-code category and an optional navigation id |
| `net::ClientSocketPoolManager` setters | `set_max_sockets_per_group(pool_type, count)` and `set_max_sockets_per_pool(pool_type, count)`, both usable from production code | `set_max_sockets_per_group` renamed `set_max_sockets_per_group_for_test` (still public/callable, but the name now says what it's for); `set_max_sockets_per_pool` renamed `set_max_sockets_per_proxy_chain` (still production-usable — the getter `max_sockets_per_pool` similarly became `max_sockets_per_proxy_chain`, returning `size_t` where the old getter's callers had assumed `int`, so mixed ternaries against a pref's `int` value need an explicit `static_cast<int>`) |
| `views::View::InvalidateLayout` | `InvalidateLayout()` (no parameters) | Gained a `bool avoid_propagate_during_layout = false` parameter. `base::BindRepeating(&View::InvalidateLayout, base::Unretained(this))` used to bind to a `RepeatingClosure`; now it binds to `RepeatingCallback<void(bool)>` (an unbound-args callback) instead, which no longer matches APIs expecting a plain closure (e.g. `PrefChangeRegistrar::Add`) — bind the default explicitly: `base::BindRepeating(&View::InvalidateLayout, base::Unretained(this), false)` |
| `tabs::TabAlert` enum values | `AUDIO_PLAYING`, `AUDIO_MUTING`, etc. (SCREAMING_CASE) | Renamed to `kAudioPlaying`, `kAudioMuting`, etc. (standard Chromium enum-value style). Also, `SetTabAudioMuted` (declared in `chrome/browser/ui/tabs/tab_muted_utils.h`) stopped being transitively reachable through `tab_utils.h` — needs its own explicit include now |
| `NavigateParams::window_action` | `NavigateParams::SHOW_WINDOW` (a bare enum value on the class) | `NavigateParams::WindowAction::kShowWindow` — the field's type became a proper scoped `enum class WindowAction { kNoAction, kShowWindow, kShowWindowInactive }` |
| `network::mojom::TrustedHeaderClient::OnHeadersReceived` | `(headers, remote_endpoint, callback)` | Gained a 3rd parameter: `(headers, remote_endpoint, const std::optional<net::SSLInfo>& ssl_info, callback)`. Upstream's own implementers (e.g. `extensions::WebRequestProxyingWebSocket`) just accept and ignore it |
| `chrome/browser/extensions/permissions/{scripting_permissions_modifier,site_permissions_helper}.h` | Valid include paths | Both moved to `extensions/browser/permissions/` — same class names/constructors, just a new location |
| `UnpackedInstaller::CompletionCallback` | `void(const Extension*, const base::FilePath&, const std::string& error)` | Error message parameter is now `const std::u16string&` — convert with `base::UTF16ToUTF8()` at the top of the handler if downstream code (regex matching, etc.) still expects UTF-8 |
| `download::DownloadDangerType` | (existing values) | Gained `DOWNLOAD_DANGER_TYPE_FORCE_SAVE_TO_GDRIVE` (deep-scanning-identified sensitive content, forced to Drive when Safe Browsing's extension is installed) — any exhaustive `switch` over this enum with `-Werror,-Wswitch` needs a new `case`; grouped with `DOWNLOAD_DANGER_TYPE_SENSITIVE_CONTENT_BLOCK` in both fork call sites that hit this, matching how upstream's own `download_bubble_security_view_info.cc` buckets the two together |
| `mojo::Remote<T>` | Reachable transitively via other headers in some TUs | At least one fork file (`remote_ntp_icon_parser.cc`) lost transitive reachability and needed an explicit `#include "mojo/public/cpp/bindings/remote.h"` — a reminder that "it compiled before" is not a guarantee for unrelated-looking header trims elsewhere in the tree |
| `features::kTabbedBrowserUseNewLayout` | `FEATURE_DISABLED_BY_DEFAULT` in M143 (per the 142→143 migration notes) | **`FEATURE_ENABLED_BY_DEFAULT` in M144.** Every normal (`is_type_normal()`) browser window now uses `BrowserViewTabbedLayoutImpl` instead of `BrowserViewLayoutImplOld` — see §6.2 for what this broke |
| Chromium-style `override`/`virtual` lint | Some laxity | `virtual ~Foo();` overriding a virtual base destructor now trips `[chromium-style] Overriding method must be marked with 'override' or 'final'` — use `~Foo() override;` instead of `virtual ~Foo();` when overriding |

---

## 5. Post-Rebase Compile & Link Fixes

### 5.1 LLVM out-of-memory during jumbo Blink compilation

The default (unthrottled) `autoninja -C out/Debug chrome -k 1 -l32` parallelism crashed ~12 heavy jumbo-merged Blink inline-layout translation units (`inline_item_result.obj`, `line_breaker.obj`, etc.) with `LLVM ERROR: out of memory`, despite the build machine having 32 cores and ~64GB RAM. `config.py`'s own memory-aware job-count calculation is computed but never actually passed to the real `autoninja` invocation `npm run build` uses — a pre-existing tooling gap, out of scope to fix here. Worked around by running a direct, reduced-parallelism `ninja.exe -C out/Debug chrome -k 0 -j 8` recovery pass first (ninja's incrementality meant this only needed to fill in the OOM'd objects), then resuming the normal `npm run build` once past that cluster.

### 5.2 `SkPath` direct-mutation calls, five files

Chromium's own `skia/config/SkUserConfig.h` now defines `SK_HIDE_PATH_EDIT_METHODS` (see §4), which upstream's own code has already migrated off of, but which broke five fork files still using the old direct-mutation API: `ui/views/controls/image_view.cc` (a simple `addRRect` → `SkPath::RRect()` swap), `chrome/browser/ui/views/tabs/tab_style_views.cc` (the fork's `CustomTabStyleViews::GetPath()`, migrated to `SkPathBuilder` across all three of its code paths — conveniently, this same file's untouched upstream `TabStyleViewsImpl::GetPath()` had already been migrated, giving an exact idiom to mirror), `custom/browser/ui/views/frame/vertical_tab_button.cc` (another simple `addRRect` swap), `custom/browser/ui/views/bottombar/bottombar_view.cc`, and `custom/browser/ui/views/panels/panel_frame_view.cc` (this one's `GetWindowMask(const gfx::Size&, SkPath* window_mask)` override signature is fixed by the base class, so it builds via a local `SkPathBuilder` and assigns `*window_mask = path.detach()` at the end instead of mutating through the pointer directly).

### 5.3 libtorrent / BoringSSL clash

`custom/third_party/libtorrent`'s `hasher.hpp`, `aux_/hasher512.hpp`, and `src/random.cpp` each wrapped their OpenSSL includes in a redundant `extern "C" { #include <openssl/sha.h> }` (or `rand.h`/`err.h`) block — redundant because `openssl/sha.h` already self-guards its own declarations with `#if defined(__cplusplus) extern "C" { ... }`. This became a hard build break in M144 because BoringSSL's `openssl/base.h` (pulled in transitively by `sha.h`/`rand.h`) does an unconditional `#include <memory>` *before* its own C++-affordance `extern "C++"` block — and libc++'s `<memory>` is full of templates, which cannot have C language linkage. Every TU that hit one of these three files failed with `templates must have C++ linkage`, pointing at unrelated-looking libc++ internals (`__memory/assume_aligned.h`, etc.) until traced back to the outer `extern "C"` wrapper. Fixed by removing the redundant wrapper in all three files; libtorrent's own upstream (and BoringSSL's own headers) already handle the C linkage correctly on their own.

### 5.4 `OmniboxClient` pure-virtual ripple, again

As flagged as a lesson in the 142→143 migration notes, the fork's own `GetTabService()`/`GetToolbarService()` additions to `OmniboxClient` need an override in every subclass, including unpatched upstream ones. This round it was a brand-new M144 file, `chrome/browser/ui/webui/searchbox/omnibox_composebox_handler.cc`'s anonymous-namespace `OmniboxPopupComposeboxClient`. Fixed the same way as before: `nullptr`-returning overrides mirroring the fork's own `ComposeboxOmniboxClient`/`LensComposeboxOmniboxClient`.

### 5.5 `resource_ids_custom.spec`: 8 grit resource-ID gaps, and a real discovery about `update_resource_ids`

Five new M144 GRD files had no entry at all (`autofill_alternative_state_name_map_resources.grd`, `regional_capabilities_internals/resources.grd`, `legion_internals/resources.grd`, `updater/resources.grd`, `actor/resources/common_resources.grd`), and three existing entries had outgrown their reserved `META.sizes` cap (`omnibox/resources.grd` needed 34 includes against a reserved 30; `tab_strip_internals/resources.grd` needed 6 against 5; `contextual_tasks/resources.grd` needed 34 against 10) — all caught as `grit.exception.IdRangeOverflow` or a missing-first-id `KeyError` during the `chrome_extra_paks` build step.

Fixing the three overflow cases surfaced a real discovery about how this file's build-time transform actually works, beyond what the 142→143 migration had already reverse-engineered about `META.sizes` being a per-file ceiling, not a reserved range (see that migration's §4): **`tools/gritsettings` `update_resource_ids` — the tool that turns `resource_ids_custom.spec` into `gen/tools/gritsettings/default_resource_ids` — recomputes final IDs from the file's declared values via a DAG/topological pass, and its correctness assumption is that IDs increase monotonically down the file** (with an explicit "jump"/"join" `META` mechanism for the few legitimate exceptions, like two GRD files sharing one ID range because only one is ever built). Relocating an overflowing entry's declared ID far away (e.g. into a distant "everything else" section) while leaving its physical position in the file unchanged breaks that assumption — the file's own next entry then looks like a backward jump the tool doesn't recognize, and `update_resource_ids` fails with `ValueError: Cannot jump to unvisited: <id>`. The fix that actually works is to *physically move* the entry (delete it from its cramped original position, re-declare it wherever there's a large enough gap) rather than just changing its declared number in place.

### 5.6 `chrome_paks.gni`: `history_resources.pak` and `management_resources.pak` each listed twice

A block explaining why `history`/`management`/`password_manager`/`settings` resources are "NOT excluded despite `ENABLE_CUSTOM_WEBUI`" (added during the 142→143 migration, per that migration's own §3) re-listed `history_resources.pak` and `management_resources.pak`, both of which were *already* present in the main unconditional `sources` list a few lines above — an accidental duplicate rather than an intentional re-affirmation. `pak_util.py repack`'s final data-pack merge step doesn't deduplicate its input list, so every one of `history`'s ~49 resource IDs showed up as `KeyError: Duplicate resource IDs`. Fixed by removing the two duplicate lines (leaving `password_manager_resources.pak`/`settings_resources.pak`, which really were only listed once).

---

## 6. Post-Rebase Runtime Fixes

Both of the following were invisible to `npm run build` succeeding — the browser linked cleanly and only revealed the problem when actually launched.

### 6.1 Duplicate `WebUIConfig` registration crash at startup

`content::WebUIConfigMap::AddWebUIConfigImpl`'s `CHECK(it.second) << url;` (fires when two `WebUIConfig`s register the same host) crashed on every launch, inside `RegisterChromeWebUIConfigs()`. Root cause: `chrome_web_ui_configs.cc` registers upstream's `ManagementUIConfig` (host `"management"`) and `PasswordManagerUIConfig` (host `"password-manager"`) **unconditionally**, while the fork's own `custom::CustomManagementUIConfig`/`custom::CustomPasswordManagerUIConfig` (same hosts) register a few lines later whenever `ENABLE_CUSTOM_WEBUI` is on — so both fired. Every *other* sibling replacement in this file (bookmarks, downloads, feedback, history, tab-search, certificate-manager, settings, sync-confirmation, terms, credits, chrome-urls, flags, extensions, whats-new) already has the correct `#if !BUILDFLAG(ENABLE_CUSTOM_WEBUI)` guard around its upstream registration — these two were just missing it, most likely because the rebase's context-shift around a newly-inserted `LegionInternalsUIConfig` registration line (new in M144) landed the fix in the wrong spot, or dropped it. Fixed by adding the missing guards. Cross-referenced every custom/upstream host-name collision in the file (not just these two) by extracting every `kChromeUI*Host` string literal from `custom/common/webui_url_constants.h` and grepping for the same literal across `chrome/common/`, `chrome/browser/ui/webui/`, and `components/*/content/common/` — confirmed no other unguarded duplicate remains.

### 6.2 Bottom bar no longer positioned at the bottom of the window

With `features::kTabbedBrowserUseNewLayout` now enabled by default (§4), every normal browser window's layout runs through `BrowserViewTabbedLayoutImpl::CalculateProposedLayout` instead of `BrowserViewLayoutImplOld::Layout`. The fork's bottom-bar positioning logic (`LayoutBottombar`, added during the 142→143 migration when `browser_view_layout` first split into an Old/Impl architecture) only ever existed in the Old implementation — the new one had zero awareness of `bottom_container`/`bottombar` at all, so the bar was simply never positioned and rendered wherever its initial `AddChildView` call happened to place it.

Ported the equivalent logic into `BrowserViewTabbedLayoutImpl::CalculateProposedLayout`, adapted to the new implementation's declarative `ProposedLayout`/`AddChild` builder style (as opposed to the old implementation's imperative `SetBounds()` calls): claims a bottom-aligned strip of `params.visual_client_area` for `bottom_container`, positions `bottombar` inside it at local coordinates, hides the now-irrelevant `bottom_contents_separator` (a child of `bottom_container`, so it can't be positioned in browser-view-absolute coordinates — same reasoning the old implementation used), and insets the remaining visual client area so the content view sizes correctly above the bar.

---

## 7. Known Remaining Issues

| Issue | Status | Notes |
|---|---|---|
| Third-party lib patch re-application always reports "failed" | Known, harmless (recurring every migration) | `libtorrent` and `search_engines_data` have no reset-to-HEAD step in their apply path. Verify content with `grep`, not the `apply_patches` report, for these two libs. |
| depot_tools StrEnum bug | Recurring, now has a reusable skill | Upstream depot_tools has not fixed the underlying `.vpython3` regression as of this migration (see §3) — the fix has now recurred across two consecutive rebases. |
| `update_resource_ids`'s monotonic-ID assumption | Now documented (§5.5) | Wasn't written down anywhere before this migration; link back here if a future rebase's `resource_ids_custom.spec` fix produces `ValueError: Cannot jump to unvisited`. |
| New-layout-implementation coverage for other custom containers | Resolved in v1.11.1 | `kTabbedBrowserUseNewLayout`'s default flip also left Sidebar, Vertical Tabs, and Split View completely unlaid-out — all three share one coupled function (`CustomLayoutContainers`) with the bottom bar's same "only wired into `BrowserViewLayoutImplOld`" gap. Reported after manual testing (not caught proactively) and ported into `BrowserViewTabbedLayoutImpl` in v1.11.1 — see that changelog entry. |
| Two-phase character of this migration | Consistent with prior rebases | Same shape flagged in the 142→143 notes: patch-rebase failures are mechanical and parallelizable; the build-fix tail is sequential and unpredictable in length — and this round adds a third phase on top, a runtime-verification pass that a clean build cannot substitute for. |
