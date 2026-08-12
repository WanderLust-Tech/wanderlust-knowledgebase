# Omaha Update Client — Changelog

`custom-omaha-client` didn't track its own release version until now — see
[Omaha Update Client](omaha-update-client) for the tool's overall
architecture. Everything before `1.0.0.0` is grouped as pre-versioned
history rather than listed per-commit, since no version constant existed
to hang entries off of.

## Pre-versioned history

- **Install wizard**: the `--install-ui` first-run experience was rebuilt
  from a single static progress dialog into a three-screen wizard
  (Welcome → Eula → Progress) — install-location picker, gated
  Terms-of-Service consent, and a full-width bottom progress bar with an
  auto-cycling GDI+ image carousel or (behind a separate, off-by-default
  build flag) a looping WebView2 video. See
  [Omaha Update Client](omaha-update-client) for the details and known
  gaps (the install-path picker is currently cosmetic only).

## Versioned releases

### 1.2.5.0 — 2026-08-12

Adds a real, branded icon -- every prior build shipped with the generic
default Windows icon, both for the `.exe` file itself (as shown in
Explorer) and the wizard window/taskbar/Alt-Tab.

- **Root cause**: no `.rc` resource script existed anywhere in this repo,
  so nothing ever embedded an icon resource into the built exe. Separately,
  `InstallWindowParams::icon_resource_id` (which `install_window.cc`'s
  `Run()` uses to load a window icon, falling back to the generic
  `IDI_APPLICATION` if it's 0) was never actually set by any caller --
  `main.cc`'s only `InstallWindowParams` construction left it at its
  default.
- **Fix**: added `src/app.rc` (embeds `src/app.ico` -- copied from
  `custom-browser`'s `custom/app/theme/wanderlust/win/app.ico`, the same
  source `ui/logo_data.cc`'s PNG frame was extracted from) as resource ID
  `IDI_APP_ICON` (`src/resource.h`), and pass that ID as
  `icon_resource_id` in `main.cc`. This repo's own hand-written GN
  toolchain (`build/toolchain/win/BUILD.gn`) had no resource-compiler step
  at all -- added a `tool("rc")` invoking `rc.exe` (already on PATH via
  `build.ps1`'s vcvarsall environment) to compile `.rc` -> `.res` for the
  link step.
- Verified: extracted the compiled exe's icon directly (confirms the real
  Wanderlust logo, not the generic default) and confirmed the running
  wizard window has a genuinely non-null icon handle via `WM_GETICON`,
  consistent with the new resource loading correctly.

### 1.2.4.0 — 2026-08-12

Fully eliminates the console-window flash on a double-click launch that
the 1.2.2.0 fix only reduced.

- **Why 1.2.2.0 wasn't enough**: that fix hid the console as early as
  possible inside `main()` (`GetConsoleProcessList` + `ShowWindow`), but
  Windows can paint a freshly-allocated console window during process
  startup *before* `main()` ever runs -- no code inside `main()` can win
  that race. The only real fix is preventing the console from being
  created at all, which is a property of the exe's subsystem, not
  something `main()` can control after the fact.
- **Fix**: linked as a GUI-subsystem exe (`/SUBSYSTEM:WINDOWS`, new
  `win_gui_subsystem` config in `build/config/BUILD.gn`) so Windows never
  auto-allocates a console in the first place. To keep `--check`/`--update`
  working normally from an actual terminal, `main()` re-attaches to a
  parent console (`AttachConsole(ATTACH_PARENT_PROCESS)`) -- but *only* if
  `GetStdHandle(STD_OUTPUT_HANDLE)` is null, i.e. nothing was already set
  up. This matters: an earlier attempt at this exact fix (reverted, see
  1.2.2.0's entry) unconditionally reattached and clobbered explicit
  redirection -- breaking `custom-browser`'s own pipe-based subprocess
  launch of this tool. The null-check makes it safe.
- **Verified thoroughly** this time: explicit file redirection
  (`> file.txt`, standing in for pipe redirection) untouched; PowerShell
  and Git Bash direct invocation still print output correctly; and for the
  actual double-click scenario, window enumeration by process ID shows
  *only* the wizard window (`OmahaInstallWindow`) plus the standard
  invisible utility windows every process gets (GDI+, IME) -- no
  `ConsoleWindowClass` window exists at all, not even briefly.

### 1.2.3.0 — 2026-08-12

Fixes the background updater redundantly re-downloading and reinstalling
the current release forever.

- **Root cause**: `WinService::DoUpdateLoop()` hardcoded
  `Version::Parse("0.0.0.0")` (the fresh-install sentinel) on every loop
  iteration, and the Scheduled Task's registered command (plain
  `--update`, no `--version`) fell back to the same sentinel -- neither
  background path had any way to know what was actually installed. Always
  telling the server "nothing is installed" made it look like an update
  was always needed, every 4 hours, forever.
- **Persistence**: `client_identity.h`'s state file gains
  `SetInstalledVersion`/`GetInstalledVersion`, recorded right after every
  successful install (`cmd_update`, `cmd_install_ui`,
  `WinService::DoUpdateLoop`). `main()` (when `--version` isn't explicitly
  passed) and the service loop now read this instead of assuming a fresh
  install.
- **Defense in depth**: `OmahaClient::CheckForUpdate()` now downgrades an
  `UpdateAvailable` response to `NoUpdate` client-side whenever the offered
  version isn't strictly greater than the current one, regardless of what
  the server said -- protects every caller uniformly, even against a
  server-side bug.
- Verified live via `--check` (read-only) against the real server:
  installed version far higher than latest → `no_update`; far lower →
  `update_available`; and the exact equal-version boundary → `no_update`.

### 1.2.2.0 — 2026-08-12

Fixes a visible console-window flash when the background updater runs
unattended.

- **The Scheduled Task fallback ran in the interactive session** (`/RU
  <user> /IT`, chosen specifically to avoid a password prompt) — so every 4
  hours, a plain console-subsystem exe with no inherited console got a
  fresh one auto-allocated by Windows and flashed briefly on screen. The
  Windows Service path was already invisible (Session 0 has no visible
  desktop), and the actual downloaded installer already runs silently
  (`/silent /install` + `CREATE_NO_WINDOW`) — this was the one real gap.
- **Fix**: at startup, `main.cc` checks `GetConsoleProcessList()` — if this
  process is the *only* one attached to its console (nobody else asked to
  see it, e.g. Task Scheduler or a double-click with no inherited
  terminal), hide that window immediately via `ShowWindow(SW_HIDE)`. If a
  parent shell is also attached (run interactively), leave it alone.
  Deliberately *not* the more common `/SUBSYSTEM:WINDOWS` +
  `AttachConsole` approach -- that was tried first and broke interactive
  use entirely, since PowerShell/cmd don't reliably wait for or reattach
  consoles to GUI-subsystem child processes. Verified from both PowerShell
  and Git Bash (output/exit codes unaffected) and via `Start-Process` with
  no inherited console (completes normally, no visible window). Side
  effect: also cleans up the console flash that briefly preceded the
  `--install-ui` wizard window on a double-click launch (1.2.1.0).

### 1.2.1.0 — 2026-08-11

Three independent pieces of work: a visual overhaul of the install wizard,
making this tool a persistent background updater rather than a one-shot
installer, and a real end-user behavior fix in how it's launched.

- **No command flag defaults to `--install-ui`**: a real end user
  downloading and double-clicking a stub installer never passes
  command-line arguments — that previously dumped a usage message and
  exited 1 (a console-subsystem exe would just flash a window shut with
  nothing visibly having happened). Now defaults to `--install-ui` (falls
  back to a silent `--update` on POSIX). Also adds `--help`/`-h`, since the
  old "no args = usage" behavior was the only way to see the command list.
- **Custom-drawn install wizard**: replaced the stock `WS_CAPTION` window
  chrome with a borderless `WS_POPUP` + hand-painted title bar (icon, app
  name, close button — `ui/close_button.h/.cc`, `WM_NCHITTEST` fakes
  drag-by-caption, `DwmSetWindowAttribute` for Windows 11 rounded corners),
  and replaced stock `BUTTON`/`BS_AUTOCHECKBOX` controls with flat, rounded,
  accent-colored ones (`ui/modern_button.h/.cc`, `ui/modern_checkbox.h/.cc`)
  sharing one palette + cached Segoe UI font (`ui/ui_theme.h/.cc`) — a
  WPF/Fluent-like look. Still pure Win32/GDI, no new dependency. See
  [Omaha Update Client](omaha-update-client) for details.
- **Background updater self-install**: `--install-ui` (and standalone
  `--register-updater`) now copies this tool to a permanent location and
  registers it so update checks keep happening even when the browser isn't
  running — mirroring how Google Update persists itself after installing
  Chrome. Tries a machine-wide install (Program Files + a Windows Service,
  needs Administrator) first, falling back to a per-user one (LocalAppData
  + a Scheduled Task via `schtasks.exe`, no admin needed) on any failure.
  New files: `updater_self_install.h/.cc`, `updater_self_install_win.cc`,
  `updater_self_install_posix.cc` (stub), `scheduled_task_win.h/.cc`.
- **Orphan detection / self-uninstall**: since that persistent copy lives
  in a sibling `Update\` folder outside the browser's own versioned install
  tree, a normal browser uninstall doesn't touch it. Rather than patch
  `custom-browser`'s Chromium-owned uninstaller, `--install-ui` now records
  the real browser exe path (`client_identity.h`'s new
  `SetBrowserExePath`/`GetBrowserExePath`), and every background check
  (`WinService::DoUpdateLoop`, or each Scheduled Task `--update` run) calls
  the new `IsBrowserUninstalled()` first — if that recorded path is gone,
  it removes the Service/Task and self-deletes instead of running forever
  as an orphan. Best-effort and delayed (next scheduled check, up to ~4
  hours), not instant. New standalone `--uninstall` command exposes this
  directly.
- **`custom-browser`'s `UpdateManager` now actually calls this tool**:
  superseding the 1.1.0.0 entry below ("it does not call this CLI tool") —
  `DownloadUpdate()`/`InstallUpdate()` were stubs that never fetched or
  installed anything; they now launch `"<updater> --update"` as a
  subprocess and stream its `#progress:NN%` output into the About page's
  progress UI, then call `chrome::AttemptRestart()`. `custom-browser`
  bumped to 1.8.5 alongside this.

### 1.1.0.0 — 2026-08-07

Adds staged-rollout / A-B testing support, and a stable per-install
identity to make it work.

- **Persisted install ID** (`src/client_identity.h/.cc`): a stable GUID,
  generated once on first run and cached in a small state file
  (`%LOCALAPPDATA%\<app_name>\update_client_state.json` on Windows,
  `~/.config/<app_name>/update_client_state.json` elsewhere) — unlike the
  Omaha `sessionId` (regenerated every check), this stays the same across
  repeated update checks. Sent as `installId` in the update-check request
  (`update_request.h/.cc`). UUID generation was factored out of
  `OmahaClient::MakeSessionId()` into a shared `src/uuid.h/.cc` so both
  call sites use the same code.
- **Explicit fresh-install signal**: `--version`'s default changed from
  `"1.0.0.0"` to `"0.0.0.0"` (matching `Version`'s own default-constructed
  value) — `wanderlust-api` now treats that sentinel as "brand-new install,
  nothing to compare against" and always returns the selected release
  rather than running a version comparison. `win_service.cc`'s matching
  hardcoded default got the same fix.
- **Server-side rollout/A-B engine** (`wanderlust-api`): `BrowserReleases`
  gained a `RolloutWeight` (0-100) and `ExperimentName` per release, so
  multiple active releases can target the same appId/platform/arch
  simultaneously. A new `ReleaseRolloutSelector` deterministically buckets
  each install (via `installId`, not `sessionId`) into exactly one
  candidate using a weighted waterfall — same install always gets the same
  variant. A single release at the default weight of 100 covers every
  bucket, so this is fully backward compatible. See
  `wanderlust-api/UPDATE_PROTOCOL.md` for the full algorithm.
- **`custom-browser`'s `UpdateManager` gets the same treatment**: since it
  has its own separate, in-process Omaha implementation (it does not call
  this CLI tool — see [Omaha Update Client](omaha-update-client)), it also
  needed a persisted install ID to participate in the same rollout/A-B
  rules for existing installs, not just fresh ones. Added a new Local
  State pref (`custom.auto_update.install_id`, generated via
  `base::Uuid::GenerateRandomV4()` on first read) and threaded it into the
  same `installId` request field.

### 1.0.0.0 — 2026-08-06

Introduces this changelog and the tool's first formal version.

- **New `omaha_client_version` GN arg** (`src/BUILD.gn`, default
  `"1.0.0.0"`), threaded through `config.h` as `Config::client_version` —
  the same `declare_args()` → `defines` → `#ifndef`-guarded-default pattern
  already used for `omaha_server_url`/`omaha_app_id`/`omaha_app_name`.
  Exposed via a new `omaha_client --client-version` command.
- **Reported to the update server**: every Omaha update-check request now
  carries `clientVersion` (top-level, alongside `protocol`/`sessionId`/
  `isMachine`) so `wanderlust-api` can see which updater builds are out in
  the wild. `wanderlust-api`'s `OmahaController` logs it (`ILogger`
  injected for the first time in that controller) — see
  `wanderlust-api/UPDATE_PROTOCOL.md` for the updated request schema. This
  is purely additive: older clients that don't send `clientVersion` are
  unaffected, and the field isn't used in any update-decision logic, only
  logged for observability.
