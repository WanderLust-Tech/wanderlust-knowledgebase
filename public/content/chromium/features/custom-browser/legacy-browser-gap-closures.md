# Legacy FoldingBrowser gap closures (2026-08-02)

`FEATURE_DEEP_DIVE_ROADMAP.md`'s section 4 ("Legacy FoldingBrowser — ideas
still worth porting") mined a 2018-2023 CefSharp predecessor project for
config/settings-protection ideas that might still be missing from this
fork. A direct code audit against that list found 6 real gaps; this
session closed 5 of them. This doc records what changed and what's still
open, so the remaining item doesn't get lost.

## What was found (audit, 2026-08-02)

Verified against the actual code, not just the roadmap doc's claims:

- **System tray icon** — did not exist. `StartupBehavior::kMinimized //
  Start minimized to system tray` in `system_lifecycle_manager.h` was a
  dead enum comment, never wired to any Win32 tray API.
- **Settings backup/restore** — did not exist. No export/import mechanism
  anywhere; only the opposite direction (`chrome://settings/reset`)
  existed.
- **Missing-runtime-prerequisite detection** — did not exist on either
  side of the fork. `custom-omaha-client`'s `--install-ui` flow had no
  OS-version or disk-space check before downloading/installing.
- **First-run wizard** — existed (`chrome://intro`) but was two screens
  with no step indicator and no confirmation before the destructive
  import action.
- **Schema/version fields on local settings stores** — partially done.
  `page_notes`, `workspaces`, and the sidebar's pinned-panels store
  (`SidebarPinnedPanelsService`/`kSidebarPinnedPanels` — corrected here from
  an earlier, inaccurate "recently-closed-panel" label; that list is
  actually backed by Chromium's native `TabRestoreService` with no custom
  persisted shape at all) already had one; `TabService`'s saved-sessions
  pref and Super Drag's three dict prefs did not. **Closed 2026-08-17
  (v1.8.29)** — see "Schema-version fields, closed" below.
- Already satisfied, no action needed: per-user settings storage location
  (audited — all writes are `HKCU` or profile-relative, none are
  install-directory-relative or `HKLM`), and JS-based page-readiness
  detection (the features this would apply to already use real
  `DidFinishNavigation`/`DocumentOnLoadCompletedInPrimaryMainFrame`
  signals, no fixed-timeout hacks found).

## What closed each gap

- **System tray icon** — `SystemTrayManager`
  (`custom/chrome/browser/system_tray/`), built on vanilla Chromium's
  previously-unused `StatusTray`/`StatusIcon` API. Always-present icon
  with an update-available badge, download-completion balloon, and a
  quick-actions menu (New window/Settings/Downloads/Quit). Wired through
  `CustomFeatureManager`; the Browser/Navigate-touching menu actions live
  in a separate `SystemTrayActionDelegate`
  (`custom/browser/ui/system_tray_action_delegate.h`) registered from
  `BrowserView::Init()`, specifically to avoid a
  `features → system_tray → chrome/browser/ui → chrome/browser →
  features` build-graph cycle.
  - Required fixing `UpdateManager::PerformUpdateCheck()` first — it was
    a stub that faked a random version instead of making a real network
    call, and compared against `CHROME_VERSION_STRING` (the pinned
    Chromium base version) instead of `custom_product_version`. Now
    issues a real Omaha-protocol request to wanderlust-api's `/v4/update`.
  - Also fixed `CustomFeatureManager::ShutdownAutoUpdateSystem()`, which
    only logged and never actually stopped `UpdateManager`'s timer.
- **Settings backup/restore** — new **Backup & Restore** page at
  `chrome://settings`. Automatic cloud backup reuses the same Google
  Drive/OneDrive app-data backends bookmark sync already has
  (`SettingsBackupService`, debounced push-only, mirroring
  `BookmarkSyncService`'s pattern); restore is always an explicit,
  confirmed action, never silent. Local export/import to a JSON file
  works with no sign-in at all. Backed-up pref set + a schema-version
  field live in `custom/browser/backup/settings_backup.h`.
- **Missing-runtime-prerequisite detection** — added to
  `custom-omaha-client` (a separate repo): `CheckPrerequisites()` checks
  Windows 10+ and available disk space before `--install-ui`/`--update`
  proceed. Also closed an adjacent, previously-unverified gap found during
  the same pass: the server-provided `sha256` for a downloaded update
  package was parsed but never checked — a corrupted or tampered download
  would have been silently installed. Now verified via Windows CNG/BCrypt
  before handing the path to the installer.
- **First-run wizard** — `chrome://intro` (`custom_intro/App.tsx`) now
  shows a "Step N of 2" indicator, disables the Import button when
  nothing is selected, and requires an explicit confirmation (naming
  exactly what will be imported and from where, calling out passwords
  specifically) before the import actually runs.

## Schema-version fields, closed (2026-08-17, v1.8.29)

`TabService`'s saved-tab-sessions pref (`kTabVerticalTabBarSavedSessions`)
and Super Drag's three structured dict prefs (`kSuperDragRelations`,
`kSuperDragSearchEngines`, `kSuperDragExceptions`) now carry a
`schemaVersion` field, closing the "Still open" item from the original
2026-08-02 audit.

- **`TabService`** (`browser/tab/tab_service.cc`) — per-item versioning,
  identical to `Workspace::ToValue`/`FromValue`: each saved session gets a
  `kSavedSessionSchemaVersion = 1` stamp, and
  `GetVerticalTabBarSavedSessions()` (previously a raw, unvalidated
  `Clone()`) now silently drops any entry whose version is newer than this
  build understands, treating an absent key as version 1.
- **Super Drag** (`browser/super_drag/super_drag_service.cc`) — whole-dict
  versioning instead (closer to Page Notes' file-level `"version"` than
  Workspace's per-item one), since these three prefs are flat
  gesture/origin → value lookup maps, not lists of independent records.
  `kSuperDragSchemaVersion = 1` is stamped as a reserved `"schemaVersion"`
  sibling key; the two call sites that previously enumerated every key in
  `kSuperDragExceptions`/`kSuperDragSearchEngines`
  (`IsURLAllowed`/`ResetToDefault`) were updated to skip that reserved key,
  so it's never misread as a real origin/gesture entry or zeroed out on
  reset. Along the way, fixed a real pre-existing bug in `ResetToDefault`:
  it computed a zeroed-out copy of `kSuperDragSearchEngines` but then wrote
  back the original, unzeroed dict — "Reset to default" never actually
  reset any search-engine assignment.
- Neither store gained migration logic — both are pure forward-compat
  insurance, matching every existing precedent (`page_notes`/`workspaces`/
  sidebar have all only ever shipped version 1, so there's nothing to
  migrate *from* yet).
