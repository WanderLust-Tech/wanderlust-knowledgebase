# Changelog

This is a history of the WanderLust custom Chromium fork (`custom-core`,
the repo mounted at `src/custom` inside the full Chromium checkout),
covering both the versioned era (`custom_product_version`, starting at
1.7.25) and everything that came before it. It's compiled from the
project's real git history (308 commits, 2025-08-14 → 2026-08-07), not
hand-maintained release notes — so entries before 1.7.25 are grouped by
theme and by Chromium rebase, rather than listed one-per-commit.

For the versioning scheme itself (why it's `MAJOR.MINOR.BUILD.0`, what
each part counts) see [Custom Browser Build System](../development/custom-browser-build-system).

## Versioned releases (1.7.25 → 1.8.43)

Each release below is one commit — this fork bumps `custom_product_version`
once per feature/fix commit, so version and commit map 1:1 for this era.
1.7.38 is the one exception so far: three small, related pieces of update-
system work landed as separate commits without a version bump each, so
this entry bundles all three under one release instead of three. 1.8.0
bundles a whole Chromium rebase plus everything QA testing turned up
immediately afterward, for the same reason.

### 1.8.43 — 2026-08-21

Adds Website Restrictions to Parental Controls — a basic "Net Nanny"-style
site blocker: a domain blocklist/allowlist plus forced SafeSearch and
YouTube Restricted Mode. Category-based filtering is a deliberate later
step, not part of this pass.

- New `ParentalControlsThrottle` (a `blink::URLLoaderThrottle`, registered
  in `CustomContentBrowserClient::CreateURLLoaderThrottles()`) enforces
  the domain list for frame-level navigations only, independent of the
  PIN's own unlock state — editing the list is what's PIN-gated, not the
  enforcement itself.
- Deliberately doesn't reuse the existing power-user `ContentPolicyManager`/
  `ContentPolicyThrottle` URL-filter engine (Settings → Security &
  Privacy) — mixing simple parent-facing domain entries into that shared,
  order-sensitive rules array would be fragile.
- SafeSearch/YouTube Restricted needed zero new C++: `settings.
  force_google_safesearch` and `settings.force_youtube_restrict` are
  already-registered, already-enforced vanilla Chromium prefs (via
  `GoogleURLLoaderThrottle`) — the new UI just reads/writes them through
  the existing generic pref bridge.
- Found (but didn't fix, out of scope) a likely pre-existing gap in
  `ContentPolicyThrottle`: its destination-to-content-type mapping never
  handles `RequestDestination::kDocument` (top-level navigation), only
  `kFrame`/`kIframe` (nested frames) — so its own block rules probably
  never stop a direct top-level page load, only frame embeds.

### 1.8.42 — 2026-08-20

Adds Parental Controls PIN lock for history erasure and settings —
PIN-gates deleting browsing history (both `chrome://history` and the
sidebar history panel) and the "clear browsing data on exit" settings
toggle, so a shared device can't have its history wiped or that setting
flipped without the PIN.

- New `ParentalControlsService` (a `KeyedService`, registered in
  `custom_browser_context_keyed_service_factories.cc`) backs the PIN
  itself and a 10-minute sliding idle-unlock window — once unlocked,
  gated actions stay available until 10 minutes of inactivity pass, not
  a single one-shot check per action.
- `CustomParentalControlsHandler` is the new WebUI message-handler
  surface; `CustomHistoryHandler`, `SidebarDOMHandler`, and
  `CustomSettingsUI` each gained a small hook into it to gate their
  respective delete/toggle actions.
- "Forgot PIN?" resets via Windows Hello device reauth, reusing the same
  `device_reauth::DeviceAuthenticator` pattern already used for
  revealing saved passwords — no separate recovery-flow plumbing needed.

### 1.8.41 — 2026-08-20

Fixes `chrome://history` and `chrome://bookmarks`'s background not
filling the viewport — introduced by the previous entry's real
implementation of both pages.

- The background color was applied to the same element as the
  centering `max-w-*`/`mx-auto` classes, so the margins outside the
  constrained content column fell through to the unstyled white body.
- Split into an outer full-bleed dark/light background `div` wrapping
  the centered content, matching `custom_downloads`' existing pattern.

### 1.8.40 — 2026-08-20

Implements real `chrome://history` and `chrome://bookmarks` pages —
both were bare placeholder `WebUIController`s with no backend wiring
until now.

- New `CustomHistoryHandler`: `HistoryService`-backed search,
  date-range filter, host-only filter, batch delete, and live updates.
- New `CustomBookmarksHandler`: `BookmarkModel`-backed tree with
  add/rename/move/delete and full drag-and-drop reordering in the React
  UI.
- Both mirror `SidebarDOMHandler`'s already-proven IPC patterns rather
  than inventing a new message protocol.

### 1.8.39 — 2026-08-20

Fixes dark/light-mode text contrast across custom WebUI pages — a full
sweep of every custom React WebUI page turned up three related bug
patterns.

- Six placeholder pages (`custom_history`, `custom_bookmarks`,
  `custom_certificate_manager`, `custom_chrome_urls`, `custom_tab_search`,
  `custom_print`) had `dark:text-white` with no `bg-*`/`dark:bg-*` at
  all — the same bug `chrome://terms` had before its earlier (1.8.32)
  fix, so dark mode left white text on a still-white page.
- ~25 files across `custom_settings`, `custom_password_manager`, and
  `custom_reader` had secondary/body text (`text-gray-600`,
  `text-gray-900`, hover states) with no `dark:text-*` pairing, so it
  stayed dark-on-dark once the page background correctly switched to
  navy in dark mode.
- 32 `custom_settings` pages had a bare `<h2>` page title with no color
  class at all, going dark-on-dark for the same reason — brought in
  line with the working `text-navy-700 dark:text-white` convention used
  elsewhere in the same app.
- Two related instances the sweep surfaced, fixed alongside the rest:
  `AccountPage.tsx` was written dark-theme-only (`bg-white/5`,
  `text-gray-400/300`, unthemed text) and was washed out in light mode —
  added light-mode counterparts throughout. `custom_sidebar`'s
  `NotesPage.tsx` had a fully inverted pairing (`text-gray-300
  dark:text-gray-600` — too light for light mode *and* too dark for
  dark mode); fixed to a tone legible in both.
- Every affected React WebUI bundle rebuilt clean (0 errors) to verify
  no syntax regressions from the fix.

### 1.8.38 — 2026-08-20

Fixes the "Add to Wanderlust Sidebar" `.lnk` shell verb from v1.8.36,
which was silently broken end to end — the registered shell command used
space-separated switch syntax (`--add-to-sidebar "%1"`).

- `base::CommandLine::IsSwitch()` splits argv tokens on `=` — it doesn't
  pair a bare `--add-to-sidebar` flag with a following positional
  argument as its value. So `HasSwitch("add-to-sidebar")` was true but
  `GetSwitchValuePath("add-to-sidebar")` was always empty,
  `ResolveLnkToSidebarApp()` failed on the empty path, and `AddApp()`
  never ran.
- Explains both reported symptoms: clicking the context-menu entry while
  the browser was already running silently did nothing (the
  `ProcessSingleton` path just returned early), and on cold start the
  `.lnk` path opened/downloaded as a normal startup file argument
  instead, since it was never consumed as a switch value and fell
  through to Chromium's default "open this" handling.
- Fixed by joining the switch and its value into one token:
  `--add-to-sidebar="%1"`. Self-healing: since
  `EnsureSidebarAppsContextMenuRegistered()` already compares against the
  registry's existing command string on every launch, installs with the
  old broken verb correct themselves on the next browser start with no
  manual registry cleanup needed.

### 1.8.37 — 2026-08-20

Fixes `chrome://settings`'s "Check for updates" button, which could only
ever report that an update was available — it never actually downloaded
or installed one.

- `OnUpdateCheckResult()` stopped at `status_ = kUpdateAvailable` without
  ever calling `DownloadUpdate()`. The only other caller of
  `DownloadUpdate()`/`InstallUpdate()` in the whole browser,
  `UpdateNotificationBubble`, was unreachable dead code — its owner
  (`UpdateNotificationManager`) is never instantiated anywhere, just a
  stale "will be initialized by browser UI" comment.
- Chains `OnUpdateCheckResult()` into `DownloadUpdate()` and
  `OnUpdaterProcessComplete()` into `InstallUpdate()`, but only for
  user-initiated checks — the periodic 6-hour background timer check
  stays report-only on purpose (it exists so the tray icon can show a
  badge, not to silently download and restart the browser on a timer),
  per `UpdateCheckTrafficAnnotation`'s own description.
- Previously, an update would only ever actually get applied by the
  independent background Scheduled Task/Service on its own schedule,
  regardless of whether the user clicked the button.

### 1.8.36 — 2026-08-20

Implements Sidebar Apps (the "Add to Wanderlust Sidebar" `.lnk`
right-click verb) — `docs/sidebar-apps.md` fully specified this feature,
but no code existed for it at all, so the context-menu entry never
appeared.

- New `SidebarApp` struct + `SidebarAppRegistry` (a prefs-backed
  `KeyedService`, mirroring `SidebarPinnedPanelsService`'s
  JSON-string-pref pattern) for the data model.
- `sidebar_app_resolver_win.cc` resolves a `.lnk` shortcut to its target
  exe, icon location, and display name via `IShellLink`/`IPersistFile`.
- Shell-verb registration under
  `HKEY_CURRENT_USER\Software\Classes\lnkfile\shell` runs as a self-heal
  check on every browser launch (`PostProfileInit`), not just from an
  installer, so it applies to existing installs immediately without a
  reinstall — idempotent via a single registry read that short-circuits
  the already-registered case.
- Handles `--add-to-sidebar` for both cold start and the
  browser-already-running case (patched
  `ProcessSingletonNotificationCallbackImpl` in vanilla
  `chrome_browser_main.cc`).
- Reuses `SidebarTopPane`'s existing pinned-button infrastructure (same
  pattern as Web Panels) — pinned apps get their own button cluster
  below Web Panels, real icons via `SHGetFileInfo` on a thread-pool
  task, and a right-click "Remove from Sidebar" context menu.

### 1.8.35 — 2026-08-19

Adds real favicons and an unpin option for Web Panels sidebar buttons,
which previously always showed a generic globe icon with no way to
remove them except through Settings → Sidebar → Web Panels.

- `SidebarContainerView` now looks up each pinned site's favicon via the
  same local `FaviconService` bookmarks/most-visited/vertical-tabs
  already use (no network fetch), pushing the resolved icon into the
  matching button via a new `SidebarTopPane::SetPinnedPanelIcon()`.
  Deliberately doesn't persist through `SetPanelFaviconUrl()` — that
  notifies observers, which would re-enter `RefreshPinnedPanelButtons()`
  → re-request every favicon → notify again, an unbounded loop since the
  same URL always resolves the same way. Sites never visited before
  still fall back to the globe.
- Pinned panel buttons get their own "Unpin from Sidebar" context menu
  (new `IDS_SIDEBAR_UNPIN_PANEL` string), wired to the already-functional
  `SidebarPinnedPanelsService::RemovePanel()` — previously only
  reachable from the Settings page's Remove button.

### 1.8.34 — 2026-08-19

Fixes case-sensitive RSS reader search — `RequestFeedContentBySearch`
matched item titles with plain `std::u16string::find()`, an exact-case
substring search.

- Replaced with `base::i18n::StringSearchIgnoringCaseAndAccents`, the
  same idiom used elsewhere in Chromium (task manager filtering,
  bookmark search), which also handles accented characters correctly,
  not just ASCII case.

### 1.8.33 — 2026-08-19

Adds `chrome://settings/manageProfile` for real profile-editing menu
items — vanilla Chromium's "Edit" pencil in the profile menu, the app
menu's "Customize profile" item, and the profile-picker card's "Edit"
option all navigate here, but it was previously unrecognized by the
Settings React router and silently fell back to the "You and
Wanderlust" page.

- New `manageProfile` route (deep-link only, not in the sidebar,
  matching vanilla) backed by `ManageProfilePage.tsx`, which reuses the
  same `CustomProfileCustomizationHandler` backend as the standalone
  `chrome://profile-customization` first-run wizard — minus that page's
  Skip/Done-to-profile-picker flow, since edits here just save in place
  like every other settings field.

### 1.8.32 — 2026-08-19

Fixes `chrome://terms` dark mode and a `chrome://credits`
content-blocked error.

- `chrome://terms` had no background color set anywhere, so
  `dark:text-white` rendered as white text on the default white canvas
  in dark mode — added `bg-white dark:bg-navy-900` plus missing `dark:`
  variants on secondary text/border colors.
- `chrome://credits`'s React shell embeds `full.html` in an `<iframe>`,
  but only `AddFrameAncestor()` (granting `full.html` permission to be
  embedded) was set — nothing overrode `ChildSrc`/`FrameSrc` on the
  shell itself, so it inherited Chromium's default `child-src 'none'`
  and the iframe was blocked before `frame-ancestors` was ever
  consulted. Added a `ChildSrc` override scoped to `chrome://credits/`.

### 1.8.31 — 2026-08-18

Moves Advanced preferences (the about:config-equivalent
profile-preference editor) off `chrome://settings/advanced-prefs` to
its own dedicated, unlisted host, `chrome://advanced-prefs` —
deliberately not linked from the Settings nav or the omnibox `settings:`
quick actions, since this is an expert-only surface a casual user
shouldn't stumble into.

- New standalone WebUI (`CustomAdvancedPrefsUI`/
  `CustomAdvancedPrefsUIConfig`), following the same pattern as
  `chrome://password-manager` — its own `WebUIDataSource`-backed React
  bundle, reusing `AdvancedPrefsHandler` unchanged (now attached only
  here, removed from `CustomSettingsUI`).
- Removed from `custom_settings/App.tsx`'s `ROUTES`/`SIDEBAR` and from
  the omnibox's `settings:` quick-action mirror list.

### 1.8.30 — 2026-08-17

Closes `shareable-theme-json.md`'s named follow-up: `cornerRadius`/
`focusShadow` were stored and round-tripped losslessly through the theme
JSON schema since v1.8.4, but only ever rendered inside
`chrome://profile-customization`'s own preview card — not in
`custom_settings`, the fork's other React WebUI surface.

- No C++ changes needed — both fields already live inside the same JSON
  string stored at pref `wanderlust.theme.custom_json`, which
  `custom_settings` can already read via its own generic `usePref()` bridge
  (`customGetPrefs`/`customObservePrefs`), a different path than
  profile-customization's dedicated `getCustomTheme` message but the same
  underlying data. Read-only — never calls the setter, so
  `CustomSettingsHandler`'s generic (unvalidated) `customSetPref` write path
  is never exercised for this pref.
- `App.tsx`'s root component now sets two CSS custom properties,
  `--wanderlust-corner-radius`/`--wanderlust-focus-shadow`, on
  `document.documentElement` whenever the pref changes. Defaults (`20px`,
  `none`) exactly match the pre-existing hardcoded look, so an unthemed
  profile is pixel-identical to before.
- `custom_settings/styles/tailwind.css` consumes them two ways: overriding
  `.rounded-\[20px\]` — pathfinder-ui's vendored `Card` component's own
  hardcoded className, matched via plain CSS cascade rather than editing
  third-party source — so every `Card`/`Section`/`HubCard` across all ~40
  settings pages picks up the theme's corner radius from one rule; and a
  `:focus-visible` selector across every native focusable element
  (buttons, links, inputs, selects, switches, checkboxes) site-wide for the
  focus shadow, regardless of whether the element is pathfinder-vendored or
  hand-rolled.
- Native Chrome window chrome (title bar, tab strip, frame) still can't
  pick up this geometry — `ui::ColorId`/`ColorProvider` has no equivalent to
  `AddColorMixers` for border-radius/box-shadow, and that remains
  explicitly out of scope, unchanged from the original v1.8.4 pass.

### 1.8.29 — 2026-08-17

Closes `legacy-browser-gap-closures.md`'s last open item — `TabService`'s
saved-tab-sessions pref and Super Drag's three dict prefs had no
schema-version discriminator, unlike `page_notes`/`workspaces`/the
sidebar's pinned-panels store. Along the way, at the user's request,
properly fixed a real, previously-deferred build-breaking layering
violation that had been blocking a clean `chrome/browser:browser` link
since 1.8.16.

- `TabService` (`browser/tab/tab_service.cc`): each saved vertical-tab-bar
  session now carries a `schemaVersion` field, per-item versioned exactly
  like `Workspace::ToValue`/`FromValue` — an absent field reads as version
  1, a newer-than-understood version is silently skipped rather than
  risking misinterpretation.
- Super Drag (`browser/super_drag/super_drag_service.cc`): `kSuperDragRelations`/
  `SearchEngines`/`Exceptions` are flat lookup dicts, not lists of records,
  so they get whole-dict versioning (closer to Page Notes' file-level
  `"version"`) via a reserved `"schemaVersion"` sibling key. The two call
  sites that previously enumerated every dict key (`IsURLAllowed`,
  `ResetToDefault`) now skip that reserved key. Found and fixed a real bug
  along the way: `ResetToDefault` computed a zeroed-out copy of
  `kSuperDragSearchEngines` but wrote back the original, unzeroed dict —
  "Reset to default" silently did nothing to search-engine assignments.
  (Also fixed a doc inaccuracy: the third schema-version precedent example
  was mislabeled "the sidebar's recently-closed-panel store" — that list
  is Chromium's native `TabRestoreService` with no custom persisted shape;
  the real versioned store is `SidebarPinnedPanelsService`'s pinned panels.)
- **Bonus fix, at the user's request**: `CustomSearchProvider` (the
  RSS-in-omnibox provider, `custom/components/omnibox/browser`) reached
  directly into `chrome/browser`-layer `RSSService`/`RSSServiceFactory`/
  `ChromeAutocompleteProviderClient::GetProfile()` via an illegal
  `static_cast<ChromeAutocompleteProviderClient*>` — components/ can never
  depend on chrome/, so this only surfaced as an undefined-symbol link
  failure at full-browser link time (deferred since 1.8.17). Fixed by
  adding two new components/-safe virtuals to the real
  `AutocompleteProviderClient` base interface —
  `IsRSSOmniboxSearchEnabled()` and `GetRSSOmniboxCandidates()` — defaulting
  to `false`/empty like the base class's existing optional-accessor
  convention (e.g. `GetDocumentSuggestionsService()`), with
  `ChromeAutocompleteProviderClient` bridging the real RSS lookup from the
  chrome/ layer. `CustomSearchProvider` now only ever talks to the abstract
  client interface. Required patching two upstream Chromium files
  (`components/omnibox/browser/autocomplete_provider_client.{h,cc}`) in
  addition to this fork's existing patches on
  `chrome_autocomplete_provider_client.{h,cc}` — `npm run update_patches`
  run afterward to capture the new/changed patches.

### 1.8.28 — 2026-08-17

Adds RSS starter feeds and feed health tracking — both confirmed genuinely
missing gaps in the doc's own 2026-07-22 proposal review: brand-new
profiles got zero feeds and zero onboarding, and a silently-broken feed was
indistinguishable from a healthy-but-quiet one, in both the DB and the
sidebar. Per user decision (AskUserQuestion), starter feeds are an
interactive picker rather than a silent auto-subscribe, matching the doc's
own "shown when a profile has zero subscriptions" wording.

- New `StarterFeedPicker` replaces the bare "Select a feed to read
  articles" message when a profile has zero subscriptions —a ~9-feed
  curated, category-tagged list (Tech/News/Science/Culture), not the
  original proposal's ML-recommendation version. No new C++ needed: it
  reuses the existing `addFeed` WebUI message (the same path a
  manually-typed feed uses) and the existing `readerFeedsChanged` listener
  already refreshes the feed list, so the picker just stops rendering once
  feeds exist. Left deliberately separate from the older, stale
  `kRSSPrepopulated` array (Japanese Infoseek/Kinza portal feeds), which
  still only feeds the unrelated destructive "Reset…" flow, untouched.
- `RSSChannelInfo` gains `consecutive_failures`/`last_success`.
  `RSSImpl::RequestRSSCallback` previously discarded `RSSFetcher::GetStatus()`
  entirely — a failed fetch still bumped `date_modified` and wrote
  `item_num = 0`, identical to "fetched fine, zero new items." It now
  branches on fetch status to update these fields correctly, and
  `ReaderDOMHandler::ChannelToDict()` derives a `broken` boolean
  (3 consecutive failures) that `Sidebar.tsx` renders as a subtle ⚠ next to
  the feed's title — a single indicator, not the proposal's full
  analytics-dashboard version.
- The `channels` table schema bumped 3 → 4. Critical constraint discovered
  and avoided: `RSSDatabase::InitImpl` razes any database below
  `kDeprecatedVersionNumber + 1` — naively bumping that value alongside the
  version would have wiped every existing user's subscriptions on upgrade.
  The fix keeps `kDeprecatedVersionNumber` at its existing value (2) and
  runs an in-place `ALTER TABLE channels ADD COLUMN` migration for existing
  v3 databases instead.

### 1.8.27 — 2026-08-17

Adds a toolbar button for `chrome://tracking-dashboard`, which until now was
reachable only by typing the URL directly. The doc's own "Future
enhancements" table already scoped the fix — a badge showing the tracker
count for the current tab, opening the dashboard on click, "same pattern as
`PrivacyShieldButton`" — and named the exact backend call to reuse
(`TrackingRelationshipService::GetTrackerCountForSite()`), already proven in
production feeding the Privacy Shield bubble's own "Trackers on page" stat.

- New `custom::TrackingDashboardButton`
  (`browser/ui/views/toolbar/tracking_dashboard_button.{h,cc}`), added to
  the bottombar next to `PrivacyShieldButton`. Unlike Privacy Shield's
  button — which opens a bubble embedding a `WebView` — this one opens
  `chrome://tracking-dashboard` as a plain tab via `ShowSingletonTab`, since
  the dashboard is explicitly a full-tab page, not a bubble.
- Per user decision (AskUserQuestion), the badge is a real numeric count
  overlay rather than a simple presence indicator, matching the doc's
  literal description. No numeric-badge precedent existed on a bottombar
  `ToolbarButton` in this fork, so `TrackingCountBadgeView` /
  `CircleBadgeImageSource` adapt vanilla Chromium's download-count badge
  (`chrome/browser/ui/views/download/bubble/download_toolbar_ui_controller.cc`),
  trimmed of the progress-ring/animation machinery a static badge doesn't
  need.
- The button observes the `TabStripModel` (rebind on active-tab change),
  the bound `WebContents` (recompute on navigation), and
  `TrackingRelationshipService` itself (recompute when new relationships
  are recorded) to keep the badge's per-tab count live — genuinely new
  wiring in this fork, since `PrivacyShieldButton` has no per-tab observer
  of its own (its stats are computed on-demand inside its WebUI handler
  instead).
- New pref `toolbar.show_tracking_dashboard_button` (default `true`),
  registered and wired exactly like `toolbar.show_privacy_shield_button` —
  including matching that pref's precedent of having no Settings-UI
  exposure yet. `BottombarView::OnButtonStateChanged()` was extended to
  apply the new button's visibility on pref changes (Privacy Shield's own
  button has a pre-existing gap here, left untouched — only the new button
  gets live-toggle behavior).
- Gated by the existing `BUILDFLAG(ENABLE_TRACKING_DASHBOARD)` flag (no new
  build flag needed) — the backend `TrackingRelationshipService` itself
  remains unconditional, as it already was.

### 1.8.26 — 2026-08-16

Adds background auto-refresh for the Ad Blocker's EasyList/EasyPrivacy
filter lists and URL Purify's per-site tracking-parameter rules — both
were static snapshots baked in at build time, refreshed only via the
manual `npm run update_easylist` dev script. Two decisions shaped scope:
this covers **both** subsystems (not Ad Blocker alone), and integrity
checking is a **sanity-check gate** (reject an implausibly small fetch),
not full signature verification — matching the fork's existing precedent
of trusting HTTPS transport for `RSSFetcher`/`UpdateManager` fetches.

- `BlockersWorker` gains `ReloadFromText()`, hot-swapping its
  `AdBlockClient` engine under the existing `init_lock_` once a freshly
  parsed list clears a 50%-of-current-filter-count sanity floor. New
  `AdBlockListUpdater` fetches EasyList + EasyPrivacy independently via
  `SimpleURLLoader` (same spoofed UA as `tools/download_easylist.py`,
  which easylist.to 403s otherwise), concatenates them, and on success
  writes an atomic disk cache (`WanderLustAdBlockCache.txt` under
  `chrome::DIR_USER_DATA`) that `BlockersWorker::InitAdBlock()` now
  prefers over the bundled snapshot at startup — closing the gap its own
  long-standing `TODO` comment described.
- `URLPurifier` (`url_purify_work.cc`) gains a `base::Lock`-guarded
  `ReloadPerSiteRules()`; only the fetched **per-site** provider list is
  ever replaced, the hand-maintained generic `global_` rules (`utm_*`,
  `fbclid`, `gclid`, etc.) are untouched by design. New
  `url_purify_rule_loader.{h,cc}` parses ClearURLs' `data.min.json`
  format into the existing `URLPurifyRule` shape; new
  `UrlPurifyRuleUpdater` fetches it, applies the same sanity gate (rule
  count vs. current count), and caches the raw JSON to disk the same way.
- New `FilterListUpdateService` orchestrates both updaters behind one
  `custom.filter_list_refresh.enabled` local-state pref (default `true`,
  process-wide since neither engine is per-profile) and a 96-hour default
  interval (`custom.filter_list_refresh.interval_hours`, matching
  EasyList's own `! Expires:` header). Persisted last-fetch timestamps
  mean a restart doesn't redundantly re-fetch if the interval hasn't
  elapsed; each resource gets its own `base::OneShotTimer`, re-armed after
  every fetch so an overdue check fires immediately rather than waiting
  out a fixed period.
- New build flag `enable_filter_list_auto_refresh`, auto-narrowed to
  compile in only when both `enable_ad_blocker` and `enable_privacy_guard`
  are also on (`FilterListUpdateService` owns one updater per feature).
  Wired into `CustomFeatureManager` via the established
  `InitializeXSystem()`/`ShutdownXSystem()` convention.
- New Settings → Privacy and security → "Filter list updates" section
  with an **Automatically update filter lists** toggle, bound through a
  dedicated `customGetFilterListAutoRefreshEnabled`/
  `customSetFilterListAutoRefreshEnabled` message pair rather than the
  generic per-profile `usePref()` protocol, since the backing pref is
  local state (same rationale as `UAGlobalModeSection`).
- Deliberately out of scope for v1: signature/content-integrity
  verification beyond the sanity gate, and the `AdBlockClient`
  `serialize()`/`deserialize()` binary cache format — v1 caches raw
  text/JSON, re-parsed once at next startup.

### 1.8.25 — 2026-08-16

Decides and ships Vertical Tabs' arrow-key activation semantics
(Edge-style: arrows auto-switch tabs) — the last "Needs a decision" item
on the documentation-audit backlog.

- `VerticalTabButton::OnKeyPressed`'s arrow-nav branch (Up/Down/K/J/Home/End)
  now calls `NotifyClick(event)` right after `RequestFocus()`, firing the
  same `PressedCallback` a real click/Enter/Space already did — arrow keys
  now switch the active tab, not just move keyboard focus.
- `VerticalTabBar::FocusAndMaybeExtendSelection` (the vim-motion path,
  used by counted jumps like `5j`) got the matching fix: activates the
  landed-on tab when not in vim visual-select mode, and is explicitly
  skipped while `vim_visual_mode_` is active, since j/k there instead
  extends a multi-select range and must not switch the active tab on
  every intermediate step.
- Set `VerticalTabButton`'s accessible role to `ax::mojom::Role::kTab`
  (matching vanilla `Tab`'s own role) to match the auto-activation
  semantics assistive tech expects from a tablist widget — it previously
  had no explicit role, defaulting to plain-button semantics.
- Known, accepted trade-off: holding an arrow key down triggers OS
  key-repeat, firing rapid tab activations rather than a silent focus
  move. No debouncing added — matches how "Edge-style" switching behaves
  in practice; flagged as a possible follow-up if it causes visible jank.

### 1.8.24 — 2026-08-16

Deletes the dead `adblock_settings` native handler and its legacy
frontend — another "Needs a decision" backlog item resolved by deletion.

- Investigation found this was neither "native-only" nor "incomplete" as
  the backlog framed it, but genuinely dead vendored code:
  `AdblockSettingsUI` referenced a `chrome://` host registered nowhere in
  the tree, wasn't listed in any `BUILD.gn`, and its header had a
  class-name typo (`AdBlockSettingsUI` vs. the real `AdblockSettingsUI`)
  that would have failed to compile had it ever been wired in.
- Its two messages didn't touch the real ad-block engine at all:
  `settingAdblock` just flipped the same `kEnableAdBlock` pref the
  already-working "Block ads and trackers" toggle (`PrivacyPage.tsx`)
  already controls, and `settingPopupBlocker` wrote a raw byte to a file
  in the user-data dir — a hack its own code comment admitted was "a bad
  design," not real popup-blocker integration.
- Decided to delete rather than finish: the only non-duplicated
  capability ("smart adblock" tri-state, real popup blocking) had zero
  working backend to build on, making "finish" a rewrite from scratch.
- Removed `custom/browser/ui/webui/adblock_settings/` and
  `custom/browser/resources/settings/adblock_settings/` entirely (4
  files). Confirmed zero references anywhere else in the tree — no
  `BUILD.gn`/`sources.gni` ever included these files, so there was no
  build wiring to clean up and no build verification needed.

### 1.8.23 — 2026-08-16

Deletes the orphaned `vertical_tabs_page.tsx` React page — the last "Needs
a decision" item resolved this pass on the documentation-audit backlog.

- Investigation found the component itself was closer to a stub than
  `pages-inventory.md` claimed ("not a stub") — it was
  `<div><h1>Vertical Tabs UI</h1></div>`, ~40 of its 77 lines commented-out
  boilerplate copied from an unrelated page template. No `.cc` file
  anywhere registered a `WebUIConfig`/`WebUIController`/`chrome://` host
  for it, confirming it was genuinely unreachable.
- Decided to delete rather than finish: Vertical Tabs configuration
  already has a complete, working home in `chrome://settings`
  (`TabsPage.tsx`'s "Vertical tab bar" section, bound to real prefs) —
  finishing this page would have meant building real content from scratch
  to duplicate a surface that already ships, not closing a genuine gap.
- Removed `custom/components/vertical_tabs_ui/` entirely (5 files) and
  every dangling reference: dep + pak-source lines in
  `custom/components/resources/BUILD.gn`, the `<include>` in
  `custom_components_resources.grd`, the dep in `browser/ui/sources.gni`,
  a stale reserved-ID entry in `resources/resource_ids.spec`, and a dead
  `VerticalTabsUIConfig::IsWebUIEnabled` comment fragment left in the
  unrelated `remote_ntp_internals_ui_config.cc` — the one clue to what was
  once intended (a `WebUIConfig` gating on `TabService`, never finished).
- GN gen and the `custom/components/resources:resources` target both
  build clean; no functional change, since nothing could reach this page
  before or after.

### 1.8.22 — 2026-08-16

Fixes `chrome.windows.create({type:'detached_panel'})`, which previously
always errored — a gap uncovered while fixing Panels session restore in
v1.8.20, and now itself resolved.

- `kDetachedPanel` was never actually missing from `windows.json` — this
  fork's own patch already re-adds it (contrary to what `panels.md` used
  to say). The real gap was `tabs_api_non_android.cc`'s `CreateType`
  switch never having a consuming `case` for it, so it fell to `default:`
  and returned `kInvalidWindowTypeError`.
- Added the case alongside the existing `kPanel` one, introducing a
  `panel_create_mode` local (previously the `CreatePanel()` call site
  hardcoded `PanelManager::CREATE_AS_DOCKED`) so `kPanel` still requests
  `CREATE_AS_DOCKED` while the new `kDetachedPanel` case requests
  `CREATE_AS_DETACHED`.
- Separate, unrelated fix from the v1.8.20 session-restore work, despite
  both having been tracked under the same stale `TODO(panels-revival)`
  comment — that comment's file reference (`tabs_api.cc`) was also
  outdated, since the file was renamed to `tabs_api_non_android.cc`
  upstream.

### 1.8.21 — 2026-08-16

Removes `PrivateDnsManager::ResolveDoH()`, a dead `TODO` stub — the last
"known bug" on the documentation-audit backlog, resolved by deletion
rather than implementation.

- `ResolveDoH()` (`custom/chrome/browser/network/private_dns_manager.cc`)
  always returned failure and had zero callers anywhere in the tree — it
  was `private`, and even `PrivateDnsManager`'s own resolution path
  (`ResolvePlatformDns()`) never called it internally. Real
  DNS-over-HTTPS in this fork is handled entirely by vanilla Chromium's
  own `SecureDnsConfig`/`StubResolverConfigReader` machinery via the
  `kDnsOverHttpsMode` pref, confirmed by the same 2026-07-31 audit that
  first flagged this stub.
- Deleted outright rather than implemented: a working custom DoH
  resolution path would have been pure redundant complexity duplicating
  an already-functional stock feature, not a gap worth closing.
- `PrivateDnsManager`'s lifecycle (`Initialize()`/`Shutdown()`, wired to
  real feature flags in `CustomFeatureManager`) is untouched — only the
  dead resolution stub was removed, not the class.

### 1.8.20 — 2026-08-15

Wires up Panels session restore for real and preserves docked/stacked
layout across it — the last "known bug" on the documentation-audit
backlog, though it turned out to be a bigger gap than described:
`PanelManager::SaveSessionToPrefs`/`RestoreSessionFromPrefs`/`RegisterPrefs`
were entirely dead code (pref never registered, functions never called
from anywhere), so panels didn't persist across a restart at all — not
"restores as detached" as the doc said, just didn't restore.

- `PanelManager::RegisterPrefs` is now called from `custom_prefs.cc`'s
  `RegisterLocalState`.
- `SaveSessionToPrefs` now fires incrementally from `CreatePanel`/
  `OnPanelClosed`, matching the function's own original design-intent
  comment, rather than needing a new shutdown hook — simpler and
  crash-safe (no state lost if the process is killed instead of exited
  cleanly).
- `RestoreSessionFromPrefs` now runs once at startup, from
  `CustomBrowserMainExtraPartsProfiles::PostProfileInit` (guarded to the
  initial profile only, since this is a local-state pref, not per-profile).
- The saved JSON format gained two optional fields — `collection_type`
  (`detached`/`docked`/`stacked`) and, for stacked panels, a save-local
  `stack_id` grouping key. Both are optional, so pre-fix saved sessions
  (missing these keys) still parse and restore detached exactly as they
  did before — no migration needed.
- Docked panels now restore docked. Stacked panels restore into the same
  stack, in the same top-to-bottom order, via `PanelManager::CreateStack`/
  `MovePanelToCollection` — the same primitives live drag-to-stack already
  used. This is a genuinely new capability, not just a bugfix: there was
  previously no programmatic way to recreate a stack at all.
- Corrected two other stale claims in `panels.md` found along the way:
  `kDetachedPanel` was described as "removed from upstream `windows.json`"
  — it's actually already back in the schema (this fork's own patch
  re-added it); what's missing is a consuming switch `case` in
  `tabs_api_non_android.cc`, a separate, still-open, extension-API-only
  gap left out of scope for this fix (unrelated to session restore,
  despite both being tracked under the same stale `TODO(panels-revival)`
  comment).

### 1.8.19 — 2026-08-15

Fixes Super Drag's link-vs-search gesture ambiguity — dragging a link onto
a gesture slot with a search engine assigned used to always navigate to
the link's href instead of searching, the last "known bug" on the
documentation-audit backlog.

- `SuperDragDelegate::OnDragDrop` (`custom/browser/super_drag/
  super_drag_delegate.cc`) only ever checked
  `GetTemplateURLFromString(motion_list_)` (does this gesture slot have a
  search engine assigned?) inside the text-fallback branch, reached only
  when the dragged content had no URL at all. Content type (link vs. text)
  was the sole discriminant; the slot's own configured intent was never
  consulted before the navigate branch fired.
- `OnDragDrop` now checks the slot's search-engine assignment *before*
  navigating: if the target slot has one, the drop searches using the
  dragged text (a link's visible label, falling back to the link's URL
  string if there's no text) with that engine — regardless of whether the
  dragged content was a link or plain text.
- The mid-drag bubble preview (`OnDragUpdated`) had the identical bug —
  silently skipping the "search with X" hint whenever a link was being
  dragged — and got the same fix, so the preview now matches what
  actually happens on drop.

### 1.8.18 — 2026-08-15

Fixes the ad blocker's two documented "silently inert" gaps — `/regex/`
EasyList rules and unrecognized `$important`/`$redirect=` modifiers — the
last "known bug" on the documentation-audit backlog.

- **`/regex/` rules now actually match.** They previously parsed fine but
  only ever evaluated behind `#ifdef ENABLE_REGEX`, a macro that was never
  defined anywhere in the build, so matching always returned `false`. Now
  compiled with `std::regex` (ECMAScript grammar), lazily and cached per
  `Filter` object rather than recompiled on every request.
- Since this code compiles with C++ exceptions disabled (Chromium's
  default) and `std::regex`'s constructor throws on a malformed pattern, a
  new `IsLikelyValidRegexPattern()` precheck (unbalanced groups/character
  classes, dangling trailing escape, repetition operator with nothing to
  repeat) runs first — a pattern that fails it is treated as permanently
  non-matching instead of risking an uncaught `std::regex_error` aborting
  the whole browser process. Deliberately best-effort, not exhaustive; a
  pattern that's still malformed despite passing the precheck could in
  principle still abort — accepted rather than restructuring the build to
  re-enable exceptions for one file.
- **`$important`/`$redirect=` rules are now marked unsupported and
  skipped**, extending the existing `FOUnsupported` bitmask (`$ping` was
  already handled this way) instead of silently applying the rule's other
  semantics as if the modifier weren't there. Actually implementing
  `$important`'s override-priority behavior or `$redirect=`'s resource
  substitution remains unimplemented — this only stops pretending those
  rules work normally.
- Other still-unrecognized modifiers (`$badfilter`, `$csp=`, `$websocket`,
  `$genericblock`, `$popup`, `$1p`/`$strict1p`) are unchanged — only
  `$important`/`$redirect=` were named in the original bug report.

### 1.8.17 — 2026-08-14

Closes the three documented v1 gaps in Container Tabs: isolation no longer
gets silently dropped on session restore, SavedTabGroups reopen, or tab
discard/reactivate — the last "known bug" on the documentation-audit
backlog.

- **Session restore / "reopen closed tab"**: a closing tab's container ID is
  now captured into `sessions::tab_restore::Tab::extra_data`
  (`BrowserLiveTabContext::GetExtraDataForTab`) and read back out in
  `CreateRestoredTab()` to rebuild the same fixed `StoragePartition`.
- **SavedTabGroups reopen**: `ContainerService` gained a local-only (not
  synced) `{saved_tab_guid: container_id}` map, populated when a container
  tab is saved into a group and read back on reopen. Deliberately kept
  local rather than added as a synced field on `SavedTabGroupTab` — avoids
  a sync schema/protobuf change; the trade-off is a saved group reopened on
  a different device won't carry its container assignment there.
- **Discard → reactivate**: `TabLifecycleUnit::FinishDiscard()` now reads
  the discarded tab's container before destroying it and rebuilds the
  replacement `WebContents` in the same partition, instead of always
  falling back to the default one.
- Along the way, found (but deliberately deferred) a real layering bug from
  the previous release: `CustomSearchProvider` (RSS-in-omnibox, shipped in
  1.8.16) calls `ChromeAutocompleteProviderClient::GetProfile()` and
  `RSSService`/`RSSServiceFactory` methods, all of which live in
  `chrome/browser`, from `components/omnibox/browser` — a layer `chrome/browser`
  depends on, not the reverse. This only surfaces at full-browser link time
  (a scoped `components/omnibox/browser` build doesn't need the symbols to
  resolve), which is why it wasn't caught in 1.8.16. Tracked as a follow-up;
  not fixed in this release.

### 1.8.16 — 2026-08-14

Ships the "Quick Actions" piece of Enhanced Omnibox, plus a real bug fix
that was blocking it — the last "known bug" left on the documentation-audit
backlog.

- New `settings:` quick-action provider
  (`custom/components/omnibox/browser/settings_quick_action_provider.{h,cc}`,
  `AutocompleteProvider::TYPE_SETTINGS_QUICK_ACTION`, gated behind
  `enable_settings_quick_action`). Typing `settings:` or `settings ` followed
  by any part of a settings section's name (e.g. `settings: passwords`)
  fuzzy-matches against a table mirrored from `App.tsx`'s `ROUTES` and
  navigates straight to that `chrome://settings/<section>` sub-page.
- Deliberately did *not* build `tab:`/`bookmark:` prefixes — stock
  Chromium's `OpenTabProvider` and `BookmarkProvider` already match any
  typed text against open tabs/bookmarks with no prefix, and
  `AutocompleteResult::ConvertOpenTabMatches()` already attaches a
  "Switch to tab" action to any match. Building custom versions would
  have duplicated existing behavior.
- Fixed the RSS-in-omnibox provider (`CustomSearchProvider`), which turned
  out to be dead code: it was added to the default provider bitmask
  (`TYPE_CUSTOM_SEARCH`) via an old patch but never actually instantiated in
  `AutocompleteController`, and its matching logic was commented-out
  pseudocode referencing undefined symbols (`ce_rss`, `ce::` namespace)
  left over from an unrelated ancestor codebase. Rewrote it against the
  fork's real, current RSS backend (`RSSService`/`RSSFeed`/`RSSCache`) using
  the modern `FindTermMatches`/`ClassifyTermMatches` highlighting API, and
  wired its registration into `AutocompleteController::InitializeSyncProviders()`
  alongside the new settings provider.
- Also fixed a latent bug found in the course of this: `autocomplete_provider.h`
  used `BUILDFLAG(ENABLE_RSS_READER)` without ever including
  `custom/buildflags/custom_features_buildflags.h` — harmless as long as
  nothing forced that header to compile standalone, but it broke as soon as
  the new `ENABLE_SETTINGS_QUICK_ACTION` check was added next to it.
- URL Formatting and Security Indicators — the other two sub-features
  originally documented under Enhanced Omnibox — remain unimplemented.

### 1.8.15 — 2026-08-14

Adds settings toggles for the Instagram Downloader — the last item on
the current documentation-audit backlog.

- New "Instagram" section in Settings > Other settings with two
  checkboxes: the Save-button feature
  (`custom.instagram_downloader.enabled`) and "you liked this" thumbnail
  badges (`custom.instagram_downloader.show_like_status`). Neither had
  any settings-page presence before — both are plain boolean prefs read
  directly in `InstagramDownloaderTabHelper`, so zero new C++.
- Exposed both toggles together rather than just the requested
  like-status one — they're documented as independent siblings sharing
  one passive-capture content script, and leaving the download-button
  master toggle invisible while only exposing the secondary one would
  have been an incomplete settings surface for a single feature.

This closes out the "quick wins" batch from the 2026-08-13 documentation
audit — see that day's entries for Content Policy Chain, Origin
Permission Grants, Site Injection, User-Agent Overrides, Timezone
Override, and Local Font Fingerprint Protection.

### 1.8.14 — 2026-08-14

Adds a settings toggle for Local Font Fingerprint Protection.

- New "Restrict local font access" toggle in Settings > Privacy and
  security's existing Fingerprint resistance section, alongside canvas
  noise/screen metrics/letterboxing. The backend
  (`privacy_guard.font_fingerprint_protection`, threaded through
  `OverrideWebPreferences()` into
  `WebPreferences::local_fonts_fingerprint_protection`) was already
  fully built — pref-only, no UI. Zero new C++; a single `usePref()` +
  `Toggle`, matching its three neighboring toggles exactly. Applies
  immediately, no restart needed.

### 1.8.13 — 2026-08-14

Adds a Timezone Override settings UI to Settings > Privacy and security.

- The backend was already fully built and working —
  `HandleGetTimezone`/`HandleSetTimezone` in `CustomSettingsHandler`,
  backed by `TimeZoneMonitor` — it just had no React page calling it;
  the only prior way to exercise it was `cr.sendWithPromise`/
  `chrome.send` calls typed directly into the `chrome://settings`
  DevTools console. Zero new C++ for this one.
- New `TimezoneOverrideSection` in `PrivacyPage.tsx`, placed right below
  Fingerprint resistance since it serves the same purpose (reducing
  `Date`/`Intl` fingerprinting surface). A select lists "System default"
  plus ~50 IANA zones; changes apply immediately, no restart needed.
- Uses the dedicated `customGetTimezone`/`customSetTimezone` messages
  rather than the generic settings pref protocol, since the get call
  also returns the available-zones list and the set call has a side
  effect beyond the pref write (rebinding `TimeZoneMonitor`).

### 1.8.12 — 2026-08-14

Adds a settings UI for User-Agent Overrides to Settings > Security &
Privacy.

- **"User-Agent compatibility mode"**: a Default/Firefox/Chrome-stable
  select for `custom.user_agent.global_mode`. This is a local-state pref
  (applies to every profile on the machine), which the generic settings
  pref protocol can't reach since it only reads `Profile::GetPrefs()` —
  added two small dedicated messages instead of generalizing the shared
  protocol and risking every other pref-bound toggle in Settings.
- **"Per-site User-Agent overrides"**: a rule table (domain glob + UA
  string) using the same pref-blob pattern as Connection Control/Content
  Policy Chain, since `custom.ua_overrides` is an ordinary
  `PrefChangeRegistrar`-backed profile pref.
- Both were previously only configurable by hand-editing the relevant
  preferences file while the browser was closed; both now apply
  immediately with no restart.

### 1.8.11 — 2026-08-14

Adds a rule-editor UI for Site Injection to Settings > Security &
Privacy.

- Lets users add/edit/delete per-site CSS/JS injection rules (address,
  type, inject timing, and the actual content in a textarea) instead of
  hand-editing `rules.ini` and payload files in the profile directory.
- `SiteInjectionManager` only ever supported a one-shot startup parse
  with no mutation API, and discarded each rule's address/filename
  after bucketing it into `GetRulesForUrl()`'s lookup maps. Rather than
  duplicate `rules.ini`'s format in the WebUI handler, refactored the
  manager to expose it as two shared static methods —
  `ParseRuleEntries()`/`SerializeRuleEntries()` — so the runtime loader
  and the new settings editor can't drift apart on the file format.
  Rules are identified by position in the file (it has no id field);
  deletes and type changes check whether another rule still shares a
  payload file before removing it.
- Edits take effect on next restart — there's still no file-watcher/
  hot-reload, a separate and bigger gap than this UI addressed. Same
  caveat the "Disable WebGL"/"Session-Only Cookies" toggles on the same
  page already carry.

### 1.8.10 — 2026-08-13

Adds a settings UI for Origin Permission Grants to Settings > Security &
Privacy.

- Lets users pre-grant or pre-deny a permission (camera, microphone,
  notifications, location, JavaScript, pop-ups, clipboard) for a
  specific origin, skipping the normal prompt — previously only
  configurable by hand-editing the Preferences file while the browser
  was closed.
- Architecturally different from the other three sections on this page:
  `OriginPermissionService` applies grants straight to
  `HostContentSettingsMap` via `SetGrant()`/`RemoveGrant()` rather than
  watching a blob pref, so this uses real WebUI messages
  (`customGetOriginPermissionGrants`/`customSetOriginPermissionGrant`/
  `customRemoveOriginPermissionGrant`) calling the service's actual API,
  broadcasting a change event the same way Site Settings' per-host
  exceptions already do — writing the raw pref directly would have
  silently not taken effect until a restart.

### 1.8.9 — 2026-08-13

Adds a rule-editor UI for Content Policy Chain to Settings > Security &
Privacy.

- The backend (`content_policy_manager.cc`, `content_policy_throttle.cc`)
  already worked — a per-profile engine blocking/allowing specific
  resource types (scripts, images, fonts, etc.) by hostname pattern —
  but rules could only be edited by hand-editing the profile's
  `Preferences` file while the browser was closed.
- New `ContentPolicySection` in `SecurityPage.tsx` mirrors the existing
  Connection Control / Referrer Control sections in the same file: a
  rule table with per-rule Action (block/allow), Host pattern, and
  Content types (checkboxes over the `content_types` bitmask), live
  toggle, no restart needed. Purely additive React — the manager already
  re-parses rules from the pref automatically on change, so no new C++
  was needed.
- Found and identified while auditing the docs for outstanding work —
  see the 1.8.8 doc-correction commit for the same Connection Control /
  Referrer Control confusion this pattern originally came from.

### 1.8.8 — 2026-08-13

Adds a "Manage offline speech-to-text" section to Settings > Accessibility,
so websites' speech recognition (dictation, voice search, etc.) can run
fully offline and free instead of falling back to Google's paid cloud
speech API.

- **Why not a Windows-native speech API**: investigated using
  `Windows.Media.SpeechRecognition` (WinRT) directly, since this fork only
  ships Windows builds. Ruled out for two independent reasons: it requires
  MSIX package identity (this browser ships as a traditional unpackaged
  Win32 EXE — Microsoft's own docs say the API simply refuses to run
  without one), and it's capture-only (no way to feed it audio Chromium's
  own pipeline already captured; it always opens the mic itself).
- **What shipped instead**: Chromium already has its own on-device speech
  engine — SODA (Speech On-Device API) — as a free, fully local alternative
  to the cloud engine, and `SpeechRecognitionManagerImpl` already always
  prefers it over the paid cloud path whenever a matching language pack is
  installed (`media::kOnDeviceWebSpeech` is on by default on Windows). The
  only real gap: nothing proactively installs a language pack for this
  purpose — only the unrelated "Live captions" toggle does, as a side
  effect. Extended `CustomSettingsHandler` (`custom_settings_handler.cc`)
  to list/install/remove SODA language packs directly via the existing
  `speech::SodaInstaller` singleton, with live download-progress reporting
  mirroring the update-progress pattern already used for the About page.
  New section lives in `AccessibilityPage.tsx`, right below Live Captions
  since both share the same underlying installer.
- No changes to Chromium's speech engine-selection logic or any vanilla
  file at all — entirely additive within `src/custom`.

### 1.8.7 — 2026-08-13

Fixes `chrome://credits` rendering as a blank white page, and dark mode
not applying to `chrome://feedback`/`chrome://apps`.

- **`chrome://credits` renderer crash**: this page reuses Chromium's real
  license-manifest generator (`about_ui::GetCredits()`), and in an
  official/Release build that manifest is the full one — every
  third-party license in Chromium plus this fork's own `third_party/`
  additions, around **15 MB** of HTML. The old implementation fetched
  that whole string through the WebUI `chrome.send`/`cr.sendWithPromise`
  message channel and assigned it to an `<iframe srcDoc>` attribute,
  duplicating the string several times over in memory (browser-process
  `base::Value` → JSON IPC payload → renderer JS string → srcdoc
  parse) — reliably crashing the renderer before it painted anything.
  Reproduced against the installed 1.8.6 build via the DevTools
  protocol: an explicit `Inspector.targetCrashed` for the page's target.
  Fixed by having `CustomCreditsUI` serve the manifest as a real
  navigable resource at `chrome://credits/full.html` (`SetRequestFilter`
  + `AddFrameAncestor`) instead, so the page just does a normal
  `<iframe src=...>` navigation — the same way Blink loads any other
  large page, rather than juggling one giant in-memory string. Removed
  the now-unused `CustomCreditsHandler` and its `cr.ts` shim.
- **`chrome://feedback`/`chrome://apps` dark mode**: both pages set
  `dark:text-white` on their root element but never set a background
  color at all, so switching to dark mode just turned the text white on
  top of an unchanged white page. Added `bg-white dark:bg-navy-900`
  wrappers matching `chrome://settings`'s existing pattern, plus dark
  variants on a few form fields/cards that were missing them.

### 1.8.6 — 2026-08-12

Restores "Bookmark All Tabs" to the tab right-click context menu.

- **Root cause**: upstream Chromium removed `IDC_BOOKMARK_ALL_TABS` from
  `TabMenuModel`/`TabStripModel::ContextMenuCommand` years ago — it only
  survived in the app menu's Bookmarks submenu (`bookmark_sub_menu_model.cc`),
  the Windows title-bar system menu, and the macOS menu bar. Right-clicking
  a tab (even with 2+ tabs open) never showed it, in any Chromium version
  this fork is based on, patched or not.
- **Fix**: added it back as a genuine tab-menu item, following the exact
  pattern this fork already uses for its other custom tab-menu commands
  (`chrome/browser/ui/tabs/tab_menu_model.cc`'s `CopyAllURLs`,
  `CloneTabToNewWindow`, etc.) — a new `CommandBookmarkAllTabs` entry in
  `TabStripModel::ContextMenuCommand`, delegate methods
  (`TabStripModelDelegate::BookmarkAllTabs()`/`CanBookmarkAllTabs()`) that
  forward to the already-existing `chrome::BookmarkAllTabs()`/
  `CanBookmarkAllTabs()` (no new business logic needed, just wiring), and
  the menu item itself. Enablement matches real Chromium behavior exactly
  — grayed out with only one tab open.
- Six vanilla-Chromium files patched: `tab_strip_model.h`/`.cc`,
  `tab_strip_model_delegate.h`, `browser_tab_strip_model_delegate.h`/`.cc`,
  `tab_menu_model.cc`. Verified with a full `chrome` build.

### 1.8.5 — 2026-08-11

Fixes the About page's "Check for updates" button: it correctly detected a
newer version being available, but never actually downloaded or installed
it.

- **`UpdateManager::DownloadUpdate()`/`InstallUpdate()` were placeholder
  stubs** (`src/custom/chrome/browser/autoupdate/update_manager.cc`) —
  `DownloadUpdate()` faked a progress loop with no real network activity,
  and `InstallUpdate()` just flipped a status flag with a comment saying
  "In production, this would launch installer and restart browser."
  `DownloadUpdate()` now locates `custom-omaha-client`'s persistent
  `<AppName>Update.exe` (wherever its own self-install put it — Program
  Files or LocalAppData) and launches `"<updater> --update"` as a real
  subprocess, streaming its `#progress:NN%` stdout into the existing
  in-page progress UI via a pipe read on a background thread-pool task.
  `InstallUpdate()` now calls `chrome::AttemptRestart()` — the new
  version's files are already on disk once the subprocess succeeds, so the
  only remaining step is relaunching to pick them up. Reports a clear
  `OnUpdateError` instead of silently no-op'ing if no updater binary is
  found (e.g. an install predating `custom-omaha-client`'s self-install
  feature). See [Omaha Update Client](omaha-update-client) for the
  updater-side half of this (self-install, orphan detection) — released
  the same day as this tool's own 1.2.0.0.

### 1.8.4 — 2026-08-11

Adds a shareable theme JSON format, the last of four features/fixes
prompted by the same feature-comparison review as 1.8.1–1.8.3, and the
biggest of the four — the review itself flagged it as higher-effort,
needing a new schema, loader, and import/export UI.

- **Shareable theme JSON**: a lightweight, hand-authorable light/dark JSON
  theme format (five named colors: background/element/border/accent/
  titlebar), applied directly onto Chrome's real `ui::ColorId` tokens via a
  new `CustomJsonThemeSupplier`, bypassing `ThemeService`'s usual
  single-seed-color M3/HCT palette pipeline entirely. `chrome://profile-
  customization` gained an in-app 8-swatch editor with a live preview,
  plus Export/Import JSON and Reset. Full architecture and schema details:
  [Shareable Theme JSON](shareable-theme-json). `cornerRadius`/`focusShadow`
  round-trip through the format but are previewed only on that page for
  now — see the doc's "Known limitation" section for why, and the deferred
  follow-up to extend them into `custom_settings`.

### 1.8.3 — 2026-08-10

Adds responsive layout to the Settings WebUI, one of four issues flagged by
the same feature-comparison review as 1.8.1/1.8.2/1.8.4 — this one wasn't
from the comparison's feature list itself, but a real gap surfaced while
verifying its claims against the actual settings code.

- **Settings sidebar collapses on narrow windows**: the 256px settings
  sidebar no longer permanently occupies part of the viewport below the
  `md:` breakpoint — it becomes an off-canvas drawer, opened via a new
  hamburger button and closed via a backdrop tap or by picking a page.
  Unaffected at `md:` and up, where it stays the original always-visible
  static column.
- **Rule-editor forms reflow to one column on narrow windows**: the
  Containers, Workspaces, Security (Connection Control), and Smart Proxy
  Routing pages' add/edit forms were hard-locked to a 2-column grid with
  no narrower fallback. They now drop to a single column below `sm:`,
  matching the responsive convention already used by
  AutofillPage/PasswordsPage/SuperDragPage elsewhere in this WebUI.

### 1.8.2 — 2026-08-10

Adds real favicon-based color tinting to the vertical tab bar, the second
of two features prompted by the same feature-comparison review as 1.8.1.

- **Favicon dominant-color tab tinting**: the vertical tab bar's 3px color
  stripe now reflects each tab's actual favicon color, extracted via
  Chromium's existing `color_utils::CalculateKMeanColorOfBitmap` utility
  (the same one used internally for favicon/theme contrast decisions
  elsewhere in Chromium). Slots in as a middle priority tier: a manual
  tab-group color still wins if set, the real favicon color is used when
  one's been extracted, and the old hostname-heuristic category color
  (YouTube → red, GitHub → green, etc.) remains the fallback for tabs
  with no favicon yet. Per-tab results are cached and only recomputed
  when the favicon bitmap actually changes, not on every loading-spinner
  flicker.

### 1.8.1 — 2026-08-10

Adds one-click home page presets, prompted by a feature-comparison review
against another Chromium-adjacent browser.

- **Home page quick-pick presets**: Settings → Appearance's home page field
  now offers one-click buttons for Google/Bing/DuckDuckGo/Yahoo alongside
  the existing free-text URL field, reducing setup friction for
  non-power-users. The clicked preset's button highlights; typing a custom
  URL that doesn't match any preset clears the highlight.

### 1.8.0 — 2026-08-09

Rebases the fork's entire patch stack onto Chromium 141.0.7390.125 (from
140.0.7339.210), and fixes three runtime crashes plus a data-loss bug that
manual QA testing surfaced immediately afterward.

- **Chromium 141 patch rebase**: all ~68 failed/rejected patches resolved
  (context shifts, retired upstream files, enum renumbering, API renames).
  See [Chromium 140 → 141 migration notes](version-updates/chromium-140-to-141-migration)
  for the full breakdown, including a critical process-safety lesson
  learned mid-rebase: `npm run apply_patches` resets a file to pristine and
  reapplies the raw stored patch whenever its `.patchinfo` is stale, which
  can silently wipe manual fixes that go beyond the stored patch's literal
  hunks — never run it before `npm run update_patches` during an active
  rebase.
- **Fixed a `workspaces.list` sync-preferences crash**: the pref was
  registered as `SYNCABLE_PREF` but never added to
  `ChromeSyncablePrefsDatabase`'s allowlist, crashing on every new-profile
  creation in DCHECK builds.
- **Fixed 29 `KeyedService` factories never actually registered at
  startup**: a whole aggregator function
  (`custom::EnsureBrowserContextKeyedServiceFactoriesBuilt`, covering
  TabService, RSS, Sidebar, Accelerator, Toolbar, BossKey, Timezone,
  ClearData, AiAgent, CloudSync, Bittorrent, ProxyRouting, and more) was
  never called from anywhere — each factory was instead constructed lazily
  on first use, which Chromium treats as a hard startup-registration error.
  Also found and registered three factories missing even from that
  function entirely (`WorkspaceServiceFactory`, `ContainerServiceFactory`,
  `SidebarPinnedPanelsServiceFactory` — the last one being the original
  crash report that led to this discovery).
- **Fixed a canvas-fingerprint-noise crash**: the "Add noise to canvas
  readback" privacy setting called an upstream Chromium API
  (`blink::CanvasNoiseToken::Get()`) whose paired `Set()` initializer is
  never called anywhere in this Chromium milestone — vanilla or fork. Now
  self-seeds with a random value on first use instead of DCHECK-crashing
  (or, in non-DCHECK builds, silently applying the same fixed, predictable
  noise pattern on every install forever).
- **Fixed "Restart & Clear Cache"**: its `BrowsingDataRemover::Observer`
  was passed to `RemoveAndReply()` without ever calling `AddObserver()`
  first (a hard DCHECK requirement), and self-deleted without
  deregistering — both fixed.
- **Removed "View Formatted Source"** (added in 1.7.37): stock Chromium's
  own `view-source:` does the same job and renders better, so the custom
  CDP-based pretty-printer and its `chrome://formatted-source` WebUI were
  removed entirely rather than maintained alongside a redundant native
  feature.
- **Added a full manual QA checklist** covering every custom feature across
  the fork — see [Full Feature QA Checklist](qa-testing-checklist).

### 1.7.38 — 2026-08-07

Fixes a stale server URL, adds stable per-install identity to the
in-browser update checker, and pulls the stub installer/updater into this
repo's own build system.

- **Fixed `custom_omaha_public_url`**: was pointing at an unused
  `omaha.wander-lust.tech` placeholder (never actually stood up); corrected
  to `https://api.wander-lust.tech`, the real `wanderlust-api` server this
  fork's `UpdateManager` and `custom-omaha-client` both talk to. Also fixed
  `custom_default_sites_url`, which was still pointing at a leftover
  `browser.viasat.com` URL from this fork's upstream base rather than
  `ntp.wander-lust.tech`.
- **Stable per-install ID for update rollout/A-B bucketing**:
  `UpdateManager`'s update-check request now includes an `installId` — a
  UUIDv4 generated once on first run and persisted in Local State (not
  per-profile, since it must survive profile deletion and identify the
  installation rather than any one profile), reloaded on every subsequent
  check. This is what lets `wanderlust-api`'s new `IReleaseRolloutSelector`
  deterministically bucket a given install into the same staged-rollout/
  A-B variant across repeated checks, instead of every check looking like
  a new anonymous client. See `custom-omaha-client`'s own changelog for the
  matching client-side work and the server-side rollout engine itself.
- **`custom-omaha-client` is now a DEPS dependency** (`third_party/omaha_client`,
  opt-in via `npm run build_omaha_client` rather than an automatic sync
  hook, since it needs a real MSVC dev environment). A new
  `build/commands/lib/buildOmahaClient.py` reads this fork's own
  `custom_omaha_public_url`/`custom_windows_app_guid`/`custom_browser_name`
  and passes them straight into the stub installer's build, so its server
  URL/app GUID/app name can never again drift out of sync with the
  browser's the way `custom_omaha_public_url` just had to be fixed above.

### 1.7.37 — 2026-08-05

A per-window "reuse this window for popups" toggle for kiosk/signage
deployments, and a "View Formatted Source" app-menu action that
pretty-prints the current page's live DOM.

- **Reuse this window for popups**: a new checkable app-menu item
  (`IDC_REUSE_WINDOW_FOR_POPUPS`) toggles a per-`Browser` (not
  per-profile, not per-tab) runtime flag — the same shape as the existing
  `split_view_active_` toggle. When on, `Browser::AddNewContents` rewrites
  any `NEW_POPUP`/`NEW_WINDOW` disposition down to `NEW_FOREGROUND_TAB`
  in the *same* window, so `window.open()` and `target=_blank` links stop
  spawning new OS windows — useful for kiosk/signage setups where a
  second window is unwanted. Mirrors an existing Mac-only fullscreen
  rewrite already in `AddNewContents` for the same disposition check.
- **View Formatted Source**: a new app-menu action
  (`IDC_CUSTOM_VIEW_FORMATTED_SOURCE`) that grabs the active page's
  *live* rendered `document.documentElement.outerHTML` (via a one-shot
  `content::DevToolsAgentHost`/CDP `Runtime.evaluate` call — not
  `view-source:`, which only re-fetches the original response bytes) and
  opens it, pretty-printed, at a new `chrome://formatted-source/?id=...`
  WebUI page. Content is handed off through a one-shot, in-memory,
  UUID-keyed store (`FormattedSourceContentStore`) rather than passed via
  URL, so arbitrarily large pages don't blow out a query string, and the
  content is consumed exactly once. **Known gap**: the page is wired to
  load DevTools' own `formatter_worker` pretty-printer client-side, but
  that GN target's compiled output turned out to be a non-bundled ES
  module with unresolved imports into the rest of devtools-frontend
  rather than a self-contained script — integrating it needs a real
  bundling step this pass didn't have budget for. Until then, the page
  gracefully falls back to showing the raw (unformatted) HTML in a
  monospace block, clearly labeled, instead of failing silently.

### 1.7.36 — 2026-08-04

Sidebar Web Panels, per-site letterboxing, and Container Tabs.

- **Sidebar Web Panels**: pin any site into a persistent, resizable side
  panel (its own `WebContents`, independent navigation from the main
  tab), managed alongside the sidebar's existing History/Bookmarks
  panels.
- **Letterboxing**: per-site viewport-size pinning to reduce fingerprint
  entropy from window-size signals, in the same privacy-hardening family
  as this fork's other anti-fingerprinting work.
- **Container Tabs**: Firefox-style named identity containers, isolating
  cookies/storage per container so the same site can hold separate
  logged-in sessions in different tabs.

### 1.7.35 — 2026-08-02

A real system tray icon, automatic settings backup/restore, and the
update-check stub replaced with a real network call.

- **System tray icon**: an always-present Windows notification-area icon
  (`SystemTrayManager`, new `chrome/browser/system_tray` target) shows an
  update-available badge (driven by `UpdateManager`), download-completion
  balloons, and a right-click quick-actions menu. The
  browser/window-touching parts of the action delegate live in
  `browser/ui/system_tray_action_delegate` rather than the `system_tray`
  target itself, to avoid a dependency cycle back through
  `chrome/browser/ui`.
- **Settings backup/restore**: `SettingsBackupService` pushes this fork's
  curated pref set to the signed-in cloud provider automatically (2s
  debounced, alongside `CloudSyncManager`'s existing bookmark sync) —
  restore is deliberately never automatic, only the explicit "Restore"
  button in Settings applies a snapshot. A local export/import path is
  also exposed for users without cloud sync configured.
- **`UpdateManager`'s check is real now**: replaced the `rand() % 10` stub
  with an actual `network::SimpleURLLoader` POST to wanderlust-api's real
  `/v4/update` Omaha endpoint, and fixed version comparison to read
  `CUSTOM_PRODUCT_VERSION` (this fork's own version) instead of the
  now-pinned-to-upstream `CHROME_VERSION_STRING` — comparing fork versions
  against fork versions. Also fixed `Shutdown()` actually stopping
  `update_check_timer_`, which previously kept ticking past teardown.
- Fixed the same shutdown-ordering bug (already seen in `RSSImpl`) in
  `TabService`: its auto-archive timer could fire after `profile_` was
  nulled out.

### 1.7.34 — 2026-08-01

Real backends for Credits/Apps/Feedback, shared-notes auth, tab
auto-archive, and housekeeping.

- `chrome://credits` now reuses `about_ui::GetCredits()` — the same
  build-time-generated license manifest vanilla Chromium's own
  `chrome://credits` displays — via a new `CustomCreditsHandler`,
  rendered in a sandboxed `<iframe srcDoc>`.
- `chrome://apps` now lists/launches/uninstalls real installed web apps
  via `web_app::WebAppProvider` (`CustomAppsHandler`), porting the
  web-app half of upstream's `AppHomePageHandler` into this fork's IPC
  convention (the legacy Chrome Apps half is deliberately not ported).
- `chrome://feedback` submits anonymously to wanderlust-api's
  `POST /api/feedback`, attaching the active tab's URL and OS/version
  info gathered server-side.
- Page Notes' shared-annotation writes now actually authenticate:
  instead of wiring Chromium's native Gaia/OAuth2 token service, the
  client reuses whichever cloud-sync provider (Google or Microsoft) is
  already signed in, exchanging its access token for a wanderlust-api
  JWT. Also fixed the wire protocol to match the real
  `SharedAnnotationsController` endpoint.
- New `tab.auto_archive_after_days` pref + a `TabService` periodic sweep
  discards (not closes) background tabs inactive for N days, reusing the
  same tab-discard path the vertical tab bar's manual "discard inactive"
  action already used.
- Housekeeping: fixed a stale directory listing in browser_api's
  CLAUDE.md, removed 7 dead "tracked under Tier-N" comments, added a
  per-entry schema-version field to Workspaces' pref.

### 1.7.33 — 2026-08-01

Sidebar Recently Closed/Open Tabs panel, AI agent quick actions, and
Workspaces/Spaces.

- Sidebar gains a Recently Closed + Open Tabs panel, backed by a ported
  `TabRestoreService`/`BrowserList` watcher.
- AI Page Assistant gains "Summarize this page" / "Extract key points"
  quick-action buttons and a copy-to-clipboard button on replies.
- Workspaces/Spaces: a new per-profile `WorkspaceService` groups real
  saved tab groups, a sidebar panel, and a proxy-rule subset under a
  named workspace. Switching applies profile-wide: assigned tab groups
  collapse/expand/reopen across every open window via the real
  `TabGroupVisualData`/`ChangeTabGroupVisuals` mechanism, the sidebar
  panel switches, and (if enabled) proxy routing scopes to the
  workspace's rules. Reachable from the vertical tab bar's "Sort tabs
  by" right-click menu and `chrome://settings/workspaces`.

### 1.7.32 — 2026-08-01

Real backends for `chrome://intro` and `chrome://whats-new`, an OAuth
missing-client-id guard, and removal of a contradictory DoH patch.

- `chrome://intro`'s import step is ported near-verbatim from upstream's
  real `ImportDataHandler`, reusing unmodified Chromium import machinery
  (`ImporterList`, `ExternalProcessImporterHost`, `ProfileWriter`).
- `chrome://whats-new` now fetches real changelog entries from
  wanderlust-api's public `GET /api/whatsnew`, falling back to a
  hardcoded entry list on any network failure.
- Google/Microsoft sign-in now fail fast with an in-browser message when
  the OAuth client ID buildflag is empty, instead of opening a tab the
  provider's own server then rejects.
- Removed a patch that unconditionally forced DoH into "secure" mode
  regardless of this fork's own (defaulted-off, unused) DoH support
  flag — deleted the contradictory patch, the flag, and the dead
  feature it gated.

### 1.7.31 — 2026-07-31

Housekeeping: removed dead security/policy duplicate files, fixed stale
build-flag comments, bundled real EasyList+EasyPrivacy ad-block data.

- Deleted nine confirmed-dead files: a stale duplicate copy of the
  policy manager trio (canonical copies elsewhere untouched) and an
  unused/superseded native policy-config WebUI.
- Fixed comments left over from an earlier flag flip that no longer
  matched reality; flagged `enable_custom_cc` as dead (referenced
  nowhere in the tree).
- The ad-block filter-list downloader now fetches both EasyList and
  EasyPrivacy (previously EasyList only), with a browser-like
  User-Agent to work around bot-blocking. Regenerated the bundled
  filter rules from the real feeds, replacing a hand-curated placeholder
  list.

### 1.7.30 — 2026-07-30

`chrome://management` gets a real backend.

- New `CustomManagementHandler` surfaces real managed-account/browser
  state, force-installed extensions, reporting info, managed websites,
  and managed applications — the first fork handler to read real
  `policy::PolicyService`/enterprise-policy state (as opposed to this
  fork's own local-pref security scaffolding).

### 1.7.29 — 2026-07-30

`chrome://sync-confirmation` gets a real backend.

- New one-shot handler returns sign-in/sync state, enables sync via
  `SyncUserSettings`, or signs out via `IdentityManager` — deliberately
  simplified vs. upstream (no consent-audit recording, no native dialog
  plumbing; this page is a plain tab).

### 1.7.28 — 2026-07-30

Extracted the password-manager backend into its own handler and added a
standalone `chrome://password-manager` page.

- Moved all password functionality (list/remove, CSV import/export with
  OS reauth, view/copy, add/edit, weak/reused checkup, leak check) out
  of the ~76-message `CustomSettingsHandler` monolith into a focused
  `CustomPasswordManagerHandler`, mirroring upstream's own
  one-handler-per-page pattern. The same handler now backs both the
  standalone page and the Settings Passwords sub-page.

### 1.7.26 — 2026-07-30

Profile picker and profile customization pages, with real backend
handlers.

- `chrome://profile-picker`: enumerate/launch/switch/create/rename/
  delete local profiles. "Sign in with Google" is a documented no-op —
  full Dice sign-in is out of scope.
- `chrome://profile-customization`: edit the profile's name, avatar, and
  a preset theme-color swatch row.
- Fixed two unguarded blocking calls found while building this
  (`CreateMultiProfileAsync` runs finalization on a sequence that
  disallows blocking by default), and a null-deref crash in the RSS
  backend's shutdown path uncovered by the picker's delete flow.

### 1.7.25 — 2026-07-29

Decoupled this fork's product version from `chrome/VERSION`.

This is the release that introduced `custom_product_version` itself.
Previously `chrome/VERSION`'s `MAJOR.MINOR.BUILD.PATCH` had been fully
repurposed for the fork's own versioning, which broke Chromium's
version-relative build tooling and reported a fake Chromium version in
the User-Agent. From this commit on, `chrome/VERSION` stays pinned to
the real upstream Chromium release (140.0.7339.210) for UA/site
compatibility, while an independent `custom_product_version` — MINOR =
Chromium-rebase counter, BUILD = feat/fix commit count since the last
rebase — drives everything user-facing (About page, installer version
resources, installed-directory naming). This is the same split real
Chromium forks (Brave, Vivaldi, etc.) use.

## Foundation era (pre-1.7.25)

Everything below predates versioned releases — roughly 217 commits from
the project's first commit through the day before 1.7.25 landed. Grouped
by theme and ordered against the six Chromium rebases that structure this
period, newest first.

### Chromium 140.0.7339.210 (current base) — late June through July 2026

The current base: rebased to `140.0.7339.210` on 2026-07-02, then
~30 commits of fixes and features on top before versioning began.

- **NTP mojo bridge matured into a full round-trip**: live bookmark bar
  sync, open tabs, recent sessions, history, and bookmark-subfolder
  support pushed from the browser process to the remote NTP.
- **Ad blocker hardened**: cosmetic filters, LevelDB tracker persistence,
  panel session restore, unlimited bookmark nesting, and a fix removing
  blocking file I/O from the ad-block worker's init path.
- **Vertical tab bar**: Tree mode, an extension API, named sessions, and
  density presets.
- **Bookmark cloud sync** (Microsoft/Google) added to the People settings
  page; NTP seeded with bundled popular-sites JSON and real browser
  branding.
- **chrome://extensions** expanded from a list view to a full detail
  view: permissions, site access, pack/update, shortcuts, error display,
  and a pill-style enable/disable toggle — with the legacy
  `custom_settings_ui_old` page and a testing-only bundled extension
  removed.
- **New surface**: an AI Page Assistant sidebar pane backed by the
  Claude API, and an Instagram post/reel downloader with like-status
  badges.
- A cluster of small fixes: extension infobar auto-remove on unload,
  registrable-domain tracking checks, sidebar string localization, a
  privacy-shield feature-name mismatch, missing mouse-gesture prefs, a
  `BatteryMonitor` binder fix preventing a renderer kill on
  `getBattery()`, an NTP-in-split-view load-order bug, dead
  `ExtensionInfoBarDelegate` code removed, undocked-sidebar multi-monitor
  persistence + edge snapping, and several installer/icon/filename
  correctness fixes (rebranded shortcut names, Refresh icon variants,
  a double-dot filename typo, a missing `menu_model_` construction).

### Chromium 138 → 139 (`37e10a4`…`1b3384a`) — late June 2026

Two rebases in quick succession (138.0.7204.185, then 139.0.7258.157),
with feature work landing between and after them.

- **NTP settings**: a full sidebar panel with full browser-renderer
  round-trip, then expanded with Unsplash wallpaper source + topic
  picker, wallpaper effects, clock style, and weather.
- **Compact layout and Zen mode** settings UI, with a live pref observer.
- Privacy/security hardening pass: bang shortcuts, layout prefs, an MV2
  extension allowlist, GCM push messaging disabled, network isolation,
  and client-hints hardening.
- A reader-mode toolbar button, and a fix hardening SuperDrag against a
  use-after-free and stray internal-page activation.

### Chromium 135 → 136 → 137 (`a46848e`…`1597c40`) — June 2026

Three rebases inside one week (135.0.7049.117, 136.0.7103.116,
137.0.7151.122), the densest rebase stretch in the project's history,
followed by roughly two weeks of new feature work on the fresh base.

- **Privacy Shield**: a toolbar button and Tracking Relationship
  Dashboard, with per-tab privacy stats wired into the UI, later
  extended with per-domain overrides for ad block/referrer/fingerprint
  policy.
- **Page Notes**: a sidebar panel with live URL tracking and shared
  annotations (the feature whose backend auth was finished much later,
  in 1.7.34).
- Proxy routing manager and a most-visited top-sites feature.
- Fingerprinting hardening: font fingerprint protection, a UA-override
  service, and an advanced-prefs UI exposing the new hardening knobs.
- `chrome://flags` reimplemented as a WebUI with a C++ DOM handler and
  React frontend; a timezone service; expanded tab-strip behavior
  (double-click close, mouse-wheel switching, keep-last-tab); a search
  box on network-error pages.

### Pre-rebase feature buildout — May 2026

The single largest feature month (44 commits) — this is where most of
the fork's now-signature UI-level features first appeared, before any
Chromium rebase had happened.

- System-level infrastructure: ActiveX/plugin management, a performance
  optimization system, system lifecycle management, a private DNS
  manager and network event monitor, XPath-based login detection.
- **Custom Settings migrated to React + Tailwind** and split into hub
  pages with card-based navigation — the direct predecessor of today's
  `custom_settings` WebUI.
- **Custom sidebar WebUI** (bookmarks/history/RSS), later made
  undockable with auto-hide and edge-snapping.
- **Ad blocker** UI integration, **Split View**, a **Proxy Settings**
  page, **URL Purification** in Privacy Guard, an **EPUB reader**, and a
  built-in **BitTorrent client**.
- **Cloud account sign-in and bookmark sync** (the precursor to the
  Google/Microsoft cloud-sync providers used throughout later releases).
- Vertical tab bar gained drag-and-drop reordering, a context menu, and
  dynamic tab-shape/position preferences with live updates.

### Custom WebUI and reader groundwork — March–April 2026

- **pathfinder-ui** (the shared React component library) integrated into
  the Chromium WebUI build for the first time, alongside the first
  custom settings page built with React/TypeScript.
- Vertical tab support added directly to `TabStrip`; a Custom Reader Mode
  with enhanced scroll management.
- A large RSS refactor/hardening pass (InfoBar rework, DB thread
  retrieval, cleanup of unused code across the fetcher/OPML/database
  classes).
- Enabling passes for custom branding, extension infobars, bundled
  extensions, and custom WebUI across several build configs; an
  enterprise authentication manager and browser-lock UI; an IE
  compatibility layer; a comprehensive auto-update system.

### Core scaffolding dump — late February 2026

Two days (2026-02-24 and 02-25) account for the bulk of this fork's
`custom/browser/` scaffolding landing in one continuous push — the
architectural skeleton nearly everything since builds on:
`CustomMainDelegate`, `AcceleratorService`, Boss Key, `ClearDataService`,
download-shelf options, the original custom sidebar + RSS API, mouse
gestures, custom request/WebSocket proxying, Remote NTP (IPC, iOS/Android
sources, renderer integration, API allow-list), Sparkle auto-update
integration, `CustomPrivacyGuardService`, vertical tab tree UI, RSS
OPML import/export, `SidebarService`, Super Drag, `TabService`, panel
task management, `ToolbarService`, and the first custom reader + settings
UI components. Preceded by a week of branding/resource-ID/build-flag
groundwork (`is_custom_based` → `is_custom_browser` rename, gritsettings
resource IDs, chrome_paths/policy_paths branding) starting 2026-02-06,
itself preceded by an isolated pair of branding-verification commits on
2026-01-25 — the only activity in an otherwise 4-month gap after the
project's original bootstrap.

### Project bootstrap — August 2025

The original 21 commits: repo init, `package.json` and a `sync.py` for
managing the underlying Chromium checkout, `depot_tools` config, a
Python-based build system wrapping GN/Ninja, and the original patch
application system (patches are still how this fork layers changes over
vanilla Chromium source today) — including format-on-apply sorting for
custom browser headers, the last commit before the four-month gap
leading into 2026.
