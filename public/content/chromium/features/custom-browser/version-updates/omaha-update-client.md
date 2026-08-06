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
by JSON parsers.

| Command | What it does |
|---|---|
| `--check` | Check for an update, print the result, exit. |
| `--update` | Check → download → silent install, in one step (used headlessly). |
| `--install-ui` | Graphical first-run wizard (Windows only; falls back to `--update` on POSIX) — see below. |
| `--install-service` / `--uninstall-service` | Register/remove the Windows background service. |
| `--run-as-service` | Entered by the SCM, not called manually. |

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

The graphical first-run path shows a small three-screen Win32 wizard — raw
Win32 controls, no UI framework, matching this repo's zero-dependency
philosophy. `InstallWindow` (`src/ui/install_window.h/.cc`) is the wizard
chrome: it owns a persistent, full-width, bottom-flush progress bar and a
Back/primary/Cancel nav row, and switches between three screens (each
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
