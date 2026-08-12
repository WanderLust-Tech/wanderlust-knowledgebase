# Omaha Update Client

`custom-omaha-client` is a standalone C++17 tool (repo `custom-omaha-client`,
separate from the `custom-browser` checkout) that implements the Omaha 4
JSON update protocol for the WanderLust browser. Zero external runtime
dependencies — WinHTTP on Windows, a `curl(1)` shim on Linux/macOS, no
third-party JSON library (an inline recursive-descent parser). Built with
GN + Ninja, the same workflow as Chromium itself. The browser invokes it as
a subprocess (see `custom-browser`'s `src/custom/chrome/browser/autoupdate/`)
to check for, download, and apply updates.

---

## Protocol sketch

Request (POST to the configured server URL):

```json
{
  "request": {
    "protocol": "4.0",
    "sessionId": "{UUID}",
    "isMachine": false,
    "os": { "platform": "win", "version": "10.0.22621", "arch": "x64" },
    "apps": [{
      "appId": "{GUID}",
      "version": "1.0.0.0",
      "lang": "en",
      "installSource": "update",
      "updateCheck": {}
    }]
  }
}
```

Response:

```json
{
  "response": {
    "apps": [{
      "updateCheck": {
        "status": "ok",
        "manifest": {
          "version": "2.0.0.0",
          "packages": [{ "name": "setup.exe", "hash_sha256": "...", "size": 12345678, "url": "https://dl.../setup.exe" }]
        }
      }
    }]
  }
}
```

`status` is `"ok"`, `"noupdate"`, or `"error"`. The server side lives in
`wanderlust-api` — see its `UPDATE_PROTOCOL.md` for the admin API
(`POST /api/releases`), DB migration, and version-comparison rules.

## CLI commands

All output is JSON on stdout (exit 0 = success, exit 1 = error); lines
prefixed `#progress:NN%` interleave during download and should be filtered
by JSON parsers. Running with **no command flag at all defaults to
`--install-ui`** (falls back to a silent `--update` on POSIX) — the same
way a real installer behaves when a user just double-clicks the downloaded
exe with no arguments, rather than dumping a usage message and exiting.
`--help`/`-h` prints usage and exits 0.

| Command | What it does |
|---|---|
| `--check` | Check for an update, print the result, exit. |
| `--update` | Check → download → silent install, in one step (used headlessly). Also self-checks whether the browser is still installed — see [Background updater](#background-updater-self-install) below. |
| `--install-ui` | Graphical first-run wizard (Windows only; falls back to `--update` on POSIX) — see below. Calls `--register-updater`'s logic automatically after a successful install. |
| `--install-service` / `--uninstall-service` | Register/remove the Windows background service directly, pointing at wherever this exe is *currently* running from. |
| `--run-as-service` | Entered by the SCM, not called manually. |
| `--register-updater` | Copy self to a permanent location and register for background updates (service, or a Scheduled Task fallback if not elevated) — see [Background updater](#background-updater-self-install). |
| `--uninstall` | Remove whichever background-updater mechanism is registered and delete the copied binary. |

Common flags: `--version`, `--server-url`, `--app-id`, `--proxy`,
`--download-dir`, `--browser-exe`.

## Architecture

```
src/
  main.cc                 CLI entry point, command dispatch
  omaha_client.{h,cc}     Orchestrator: CheckForUpdate → DownloadUpdate → Install
  update_request.{h,cc}   Builds the Omaha JSON v4 request
  update_response.{h,cc}  Parses the response; UpdateStatus enum
  http_client.h           Platform-agnostic HTTP interface (HttpClient::Create() factory)
  win_http_client.{h,cc}  WinHTTP implementation
  posix_http_client.cc    curl(1) shim
  downloader.{h,cc}       Download with progress callback; verifies SHA-256 via BCrypt on Windows
  installer.{h,cc}        Spawns the real installer process
  win_service.{h,cc}      Windows SCM service integration
  scheduled_task_win.{h,cc}          Per-user fallback: schtasks.exe wrapper
  updater_self_install.{h,cc}        Self-install orchestration + IsBrowserUninstalled() (shared)
  updater_self_install_win.cc        Windows: copy + register (service or task) + self-uninstall
  updater_self_install_posix.cc      POSIX stub (not yet implemented)
  client_identity.{h,cc}  Persisted install id + recorded browser exe path (orphan detection)
  json.{h,cc}             Inline JSON builder + parser (no external dependency)
  result.h                Result<T> — this codebase never throws
  ui/                     Windows install wizard (see below)
```

`Result<T>` (`.ok`/`.value`/`.error`) is used everywhere instead of
exceptions. Build-time config (`omaha_server_url`, `omaha_app_id`,
`omaha_app_name`) is threaded from `declare_args()` in `src/BUILD.gn`
through `defines` into `#ifndef`-guarded fallbacks in `src/config.h` — never
hardcoded.

## The install wizard (`--install-ui`)

The graphical first-run path shows a small three-screen Win32 wizard — pure
Win32/GDI, no UI framework dependency, matching this repo's zero-dependency
philosophy, but **custom-drawn** rather than stock system chrome:

- The window is a borderless `WS_POPUP` with its own painted title bar
  (icon, app name, a custom close button — `WM_NCHITTEST` fakes the
  drag-by-caption behavior; see `ui/close_button.h/.cc`) instead of the
  standard `WS_CAPTION`, plus `DwmSetWindowAttribute` for Windows 11 rounded
  corners.
- Buttons and the EULA checkbox are flat, rounded, accent-colored
  owner-drawn controls (`ui/modern_button.h/.cc`, `ui/modern_checkbox.h/.cc`)
  instead of stock `BUTTON`/`BS_AUTOCHECKBOX`, sharing one color palette and
  cached Segoe UI font (`ui/ui_theme.h/.cc`) — a WPF/Fluent-like look rather
  than the plain system-themed one this wizard had before.

`InstallWindow` (`src/ui/install_window.h/.cc`) is the wizard chrome: it
owns the title bar, a persistent full-width bottom-flush progress bar, and
a Back/primary/Cancel nav row, and switches between three screens (each
implementing `InstallScreen`, `src/ui/install_screen.h`):

1. **Welcome** (`welcome_screen.h/.cc`) — brand logo + app name top-left, and
   an install-location field (`install_path_util.h/.cc`, defaulting to a
   display-only mirror of `chrome/installer/util/helper.cc`'s real default
   path logic) with a "Browse..." folder picker (`IFileOpenDialog`).
2. **Eula** (`eula_screen.h/.cc`, `eula_text.h/.cc`) — scrollable Terms of
   Service text; the Install button stays disabled until the consent
   checkbox is checked. This is also the point where the download+install
   worker thread first starts (deferred from window creation, unlike the
   old single-screen dialog which started downloading immediately).
3. **Progress** (`progress_screen.h/.cc`) — shown while the worker thread
   downloads and silently runs the real installer. Its media area is either:
   - an auto-cycling GDI+ image carousel (`carousel_control.h/.cc`,
     `carousel_images.h/.cc`), gated by the `enable_installer_carousel` GN
     arg (default **on**) — GDI+ ships with Windows, no new dependency; or
   - a looping video hosted in an embedded WebView2 control
     (`video_control.h/.cc`, `video_html.h/.cc`), gated by
     `enable_installer_video` (default **off**) — pulls in the vendored
     `third_party/webview2` SDK (see its README for provenance/re-vendoring)
     and requires the WebView2 Runtime, which isn't guaranteed present on
     every install-time machine (the control fails soft to a placeholder
     background if it's missing).

   Both flags are independently toggleable at `gn gen` time so each mode
   can be built/tested in isolation.

## Background updater (self-install)

`--install-ui` (and standalone `--register-updater`) makes this tool
persistent after a successful browser install, mirroring how Google Update
persists itself after installing Chrome — so update checks keep happening
even when the browser isn't running. `InstallSelfAsBackgroundUpdater()`
(`updater_self_install.h` + `updater_self_install_win.cc`) tries two paths,
in order:

1. **Machine-wide** (needs Administrator): copies the running exe to
   `%ProgramFiles%\<AppName>\Update\<AppName>Update.exe` and registers a
   Windows Service (`WinService::InstallAt`, service name `OmahaClientSvc`,
   `SERVICE_AUTO_START`, runs as `LocalSystem`) whose `DoUpdateLoop` checks
   every 4 hours.
2. **Per-user fallback** (no admin needed — the common case for a plain,
   non-elevated `--install-ui` run): copies to
   `%LOCALAPPDATA%\<AppName>\Update\<AppName>Update.exe` and registers a
   Scheduled Task (`ScheduledTaskUpdater::InstallAt`, `scheduled_task_win.cc`,
   task name `WanderlustUpdateTask`) via `schtasks.exe` that re-runs
   `--update` every 4 hours. Registered with `/RU <user> /IT` (Interactive
   Token), which runs only while that user is logged in and never prompts
   for a password.

`InstallSelfAsBackgroundUpdater()` tries machine-wide first and falls back
automatically on *any* failure — including the Program Files write itself
failing under a standard token — so there's no separate elevation check;
attempting the operation and catching the failure is the check.

### Orphan detection (self-uninstall)

This mechanism lives in a **sibling** `Update\` folder, outside the
browser's own versioned `Application\<version>\` install tree — so a normal
browser uninstall never touches it, exactly like how Google Update's
`Update\` folder can survive a Chrome uninstall unless Chrome's installer
explicitly tears it down too. Rather than patch `custom-browser`'s
Chromium-owned `chrome/installer/setup/uninstall.cc` to add that hook (a
new patch to hand-rebase on every future Chromium version bump), this
repo self-detects the orphaned state instead:

- `--install-ui` records the real, launchable browser exe path it was given
  (`client_identity.h`'s `SetBrowserExePath`, in the same per-app state
  file as the persisted install id).
- Every background check — `WinService::DoUpdateLoop`'s loop tick, or each
  Scheduled Task `--update` run — calls `IsBrowserUninstalled()`: true only
  if a path was recorded *and* it no longer exists on disk. No recorded
  path means "don't know," and it's conservative: never fires on ambiguity.
- If orphaned, `UninstallSelfAsBackgroundUpdater()` removes whichever
  mechanism is registered (tries both — the one never registered is a
  harmless no-op) and self-deletes: a detached `cmd.exe` waits a moment for
  this process to exit (it can't delete its own running exe directly), then
  deletes the exe and its now-empty parent folder.

This trades instant cleanup for zero Chromium patches: removal happens on
the *next* scheduled check, up to ~4 hours after the browser was
uninstalled, not the moment uninstall finishes.

### `custom-browser` actually applies the download (as of 1.8.5 / this tool's 1.2.0.0)

`custom-browser`'s own `UpdateManager` (`src/custom/chrome/browser/
autoupdate/update_manager.cc`) has a separate, direct HTTP implementation
of the same Omaha-protocol check (it does not shell out to this tool for
*checking*) — but its `DownloadUpdate()`/`InstallUpdate()` used to be
placeholder stubs that never fetched or installed anything. They now
locate this tool's persistent `<AppName>Update.exe` copy (the exact
dual-path lookup above) and launch `"<updater> --update"` as a subprocess,
streaming its `#progress:NN%` stdout lines into the About page's in-app
progress UI; `InstallUpdate()` then calls `chrome::AttemptRestart()`, since
`--update` already did check+download+install atomically. See the
[Auto-Update Management System section of custom-browser's CLAUDE.md](https://github.com/WanderLust-Tech/custom-browser)
for the implementation details.

### Known, deliberately accepted gaps

- **Install path is cosmetic only.** The real Chromium installer this
  client silently launches (`chrome/installer/util/helper.cc` in
  `custom-browser`) hardcodes its target directory to
  `{Program Files | %LocalAppData%}\<Brand>\Application` — there is no
  command-line switch or preference key it honors for an arbitrary custom
  path, and this fork hasn't patched that logic. The Welcome screen's
  picker is real (browses, updates the display), but the chosen path isn't
  threaded into the installer invocation yet — `main.cc` logs it as a
  diagnostic breadcrumb only. Making it functional would require new
  patches to `chrome/installer/util/helper.cc` and
  `chrome/installer/setup/installer_state.cc`.
- **Placeholder content.** No real EULA copy, feature-carousel imagery, or
  product video exists anywhere in this repo family yet — the shipped
  placeholders are clearly marked with `TODO(wanderlust)` comments
  (`eula_text.cc`, `carousel_images.cc`, `video_html.cc`) rather than
  faked as real.

### Verification

No automated UI test harness exists for this client — verification is
build + manual smoke test: build all four
`enable_installer_carousel`/`enable_installer_video` combinations, then
click through Welcome → Eula → Progress checking the path picker, the
consent gate, and that the bottom bar/carousel or video render and update.

For the background updater: `--register-updater` (non-elevated, to exercise
the Scheduled Task fallback) or elevated (for the Service path), then
confirm via `Get-Service OmahaClientSvc` / `schtasks /Query /TN
WanderlustUpdateTask` and that the copied exe exists at the expected
location. For orphan detection: after registering, hand-edit the state
file's `browser_exe` field to a nonexistent path and run `--update` (or
wait for the service loop) — confirm the mechanism and copied exe both get
removed. Clean up test artifacts afterward (`--uninstall-service` elevated,
`schtasks /Delete /TN WanderlustUpdateTask /F`, remove the `Update\`
folder) — none of this is covered by the QA checklist's automated tooling.
