# Changelog

This is a history of the WanderLust custom Chromium fork (`custom-core`,
the repo mounted at `src/custom` inside the full Chromium checkout),
covering both the versioned era (`custom_product_version`, starting at
1.7.25) and everything that came before it. It's compiled from the
project's real git history (302 commits, 2025-08-14 → 2026-08-02), not
hand-maintained release notes — so entries before 1.7.25 are grouped by
theme and by Chromium rebase, rather than listed one-per-commit.

For the versioning scheme itself (why it's `MAJOR.MINOR.BUILD.0`, what
each part counts) see [Custom Browser Build System](../development/custom-browser-build-system).

## Versioned releases (1.7.25 → 1.7.35)

Each release below is one commit — this fork bumps `custom_product_version`
once per feature/fix commit, so version and commit map 1:1 for this era.

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
