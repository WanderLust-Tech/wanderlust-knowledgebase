# Integrated BitTorrent Client

Gated by `BUILDFLAG(ENABLE_BITTORRENT_CLIENT)`. Adds a native magnet-link and
`.torrent` file handler backed by **libtorrent-rasterbar 2.0.10**, a per-profile
`BittorrentService`, a `chrome://bittorrent` WebUI, settings surfaces in both the
Polymer and React settings pages, and OS-level `.torrent` file association
management. A per-profile preference (`bittorrent.enabled`) lets users disable
the feature at runtime without a rebuild.

## Build / activation

| Where | What |
|---|---|
| [`custom_browser_config.gni`](../src/custom/custom_browser_config.gni) | `enable_bittorrent_client = true` — gates compilation |
| [`buildflags/BUILD.gn`](../src/custom/buildflags/BUILD.gn) | Emits `BUILDFLAG(ENABLE_BITTORRENT_CLIENT)` via `custom_features_buildflags.h` |
| [`browser/sources.gni`](../src/custom/browser/sources.gni) | Adds all bittorrent service sources; `bittorrent_engine` target for exception-enabled TorrentEngine |
| [`browser/bittorrent/BUILD.gn`](../src/custom/browser/bittorrent/BUILD.gn) | `source_set("bittorrent_engine")` compiled with C++ exceptions re-enabled so libtorrent/Boost headers work |
| [`browser/ui/sources.gni`](../src/custom/browser/ui/sources.gni) | Adds `views/toolbar/bittorrent_button.{cc,h}` |
| [`browser/ui/webui/BUILD.gn`](../src/custom/browser/ui/webui/BUILD.gn) | Adds WebUI controller + handler; dep on `//custom/components/custom_bittorrent:resources` |
| [`components/custom_bittorrent/BUILD.gn`](../src/custom/components/custom_bittorrent/BUILD.gn) | `build_react_webui` bundles the React manager UI |
| [`components/resources/BUILD.gn`](../src/custom/components/resources/BUILD.gn) | Merges `custom_bittorrent_resources.pak` into the main custom pak |
| [`tools/gritsettings/resource_ids_custom.spec`](../src/custom/tools/gritsettings/resource_ids_custom.spec) | Assigns resource ID range `31820` |
| [`third_party/libtorrent/BUILD.gn`](../src/custom/third_party/libtorrent/BUILD.gn) | Compiles libtorrent-rasterbar 2.0.10 as a static library with exceptions + SSE4.2 |
| [`third_party/boost_headers/`](../src/custom/third_party/boost_headers/) | Boost 1.81.0 headers (vendored via `script/download_boost.py`) |
| [`DEPS`](../src/custom/DEPS) | `third_party/libtorrent/src` (v2.0.10), `third_party/asio/src` (1.30.2), hook to download Boost 1.81.0 |
| [`browser/ui/views/bottombar/bottombar_view.{cc,h}`](../src/custom/browser/ui/views/bottombar/bottombar_view.h) | `bittorrent_button_` member + `Init()` block under `ENABLE_BITTORRENT_CLIENT` |

## Architecture

```
User action (click magnet link / open .torrent / type URL)
   │
   ▼
MagnetNavigationThrottle  (content::NavigationThrottle)
   Intercepts:
     • magnet: scheme URIs  → BittorrentService::AddMagnetLink()
     • file:// URLs ending in .torrent → BittorrentService::AddTorrentFile()
   Redirects tab to chrome://bittorrent, returns CANCEL_AND_IGNORE
   ─────────────────────────────────────────────────────────────
   Also registered in CustomSettingsHandler so the settings page
   can call btSetDefaultTorrentHandler to register the OS file
   association (HKCU .torrent → WanderlustBrowser.Torrent.1).
   When the OS opens a .torrent file it launches:
     browser.exe "C:\path\file.torrent"
   StartupBrowserCreator opens file:/// which the throttle catches.

TorrentDownloadInterceptor  (DownloadManager::Observer + DownloadItem::Observer)
   Watches every profile download for application/x-bittorrent MIME or
   .torrent extension.  On COMPLETE: AddTorrentFile(), removes shelf entry,
   deletes the temporary .torrent file, redirects tab to chrome://bittorrent.

BittorrentService  (KeyedService, per-profile)
   │  AddMagnetLink(uri)  ──► TorrentEngine::AddMagnetLink()
   │  AddTorrentFile(path)──► TorrentEngine::AddTorrentFile()
   │  Pause / Resume / Remove
   │  SetObserver() — notifies BittorrentHandler on UI thread
   │  Pref-driven config forwarded to engine via ApplyConfig()
   │
   ├── TorrentEngine  (libtorrent session on a dedicated thread)
   │     Owns lt::session; polls alerts every 500 ms via base::RepeatingTimer
   │     post_torrent_updates() → state_update_alert → live progress
   │     Handles: add_torrent_alert, state_changed_alert,
   │              torrent_finished_alert, torrent_error_alert,
   │              torrent_removed_alert, state_update_alert
   │     Dispatches TorrentUpdate structs to UI thread via callback
   │
   ├── TorrentSession  (per-transfer value type)
   │     info_hash, name, TorrentState, bytes, rates, peers, save_path
   │
   └── BittorrentServiceFactory  (BrowserContextKeyedServiceFactory)

BittorrentUI  (content::WebUIController, chrome://bittorrent)
   └── BittorrentHandler  (content::WebUIMessageHandler)
         JS → C++: btGetSessions, btAddMagnet, btAddFile,
                   btPause, btResume, btRemove, btOpenFolder,
                   btIsDefaultTorrentHandler,
                   btSetDefaultTorrentHandler,
                   btUnregisterTorrentHandler
         C++ → JS: btSessionUpdated (TorrentInfo), btSessionRemoved (hash)

BittorrentButton  (ToolbarButton, top toolbar)
   Visibility driven by bittorrent.enabled pref.
   Navigates to chrome://bittorrent on click.

BottombarView  (bottom bar)
   bittorrent_button_ — ShowSingletonTab(chrome://bittorrent)
   Uses kDownloadToolbarButtonIcon placeholder; always visible when feature is on.
```

## libtorrent integration

libtorrent-rasterbar 2.0.10 is vendored at
[`third_party/libtorrent/src/`](../src/custom/third_party/libtorrent/src/) and
compiled as `//custom/third_party/libtorrent:libtorrent`.

Key build decisions:

| Decision | Reason |
|---|---|
| `configs -= ["no_exceptions"]` + `configs += ["exceptions"]` on the libtorrent target | libtorrent uses `try/catch` throughout; Boost auto-detects `-fno-exceptions` and changes ABI |
| `TorrentEngine` compiled in its own `source_set("bittorrent_engine")` with exceptions re-enabled | `torrent_engine.cc` includes libtorrent/Boost headers — must be in an exceptions-enabled TU |
| Boost 1.81.0 headers vendored separately | Boost 1.81 is the sweet spot: fixes C++17 `std::unary_function` removal (1.76 issue) and `alignment_dummy` incomplete type (Clang 16 tightening), while not having the `apply_visitor` void-deduction regression introduced in 1.82 |
| Patch to `boost/variant/detail/apply_visitor_unary.hpp` | Boost 1.81 `apply_visitor` still uses ternary result deduction which fails when some socket-type visitor branches return `error_code` and others return `void` (Boost.Asio socket method ABI change). Patch replaces ternary with `std::conditional` |
| `-msse4.2` in cflags | `crc32c.cpp` uses `_mm_crc32_u32`; all modern x86-64 CPUs support it, guarded by runtime CPUID check |
| `BOOST_ASIO_ENABLE_CANCELIO` on Windows | Required by libtorrent on Windows for `cancel()` |
| `try_signal` submodule initialised + `try_signal_win.cc` | `try_signal.cpp` defines `catch_error` for POSIX only; Windows SEH implementation added |

### Progress updates

libtorrent 2.0.x removed `stats_alert`. The correct pattern is:

```cpp
// TorrentEngine::PollAlerts() — fires every 500 ms on the engine thread
session_->post_torrent_updates();   // queues a state_update_alert
session_->pop_alerts(&alerts);
// ProcessAlert handles lt::state_update_alert → DispatchStatusUpdate for each
// active torrent → TorrentEngine::UpdateCallback → BittorrentService::OnEngineUpdate
// → BittorrentHandler::OnSessionUpdated → FireWebUIListener("btSessionUpdated")
```

## .torrent file association (Windows)

[`torrent_file_handler.{cc,h}`](../src/custom/browser/bittorrent/torrent_file_handler.h)
writes to `HKCU\Software\Classes` (no elevation required):

| Registry key | Value |
|---|---|
| `HKCU\Software\Classes\WanderlustBrowser.Torrent.1` | `BitTorrent Torrent File` |
| `HKCU\Software\Classes\WanderlustBrowser.Torrent.1\shell\open\command` | `"browser.exe" "%1"` |
| `HKCU\Software\Classes\.torrent` | `WanderlustBrowser.Torrent.1` |

The open command uses a **positional argument** (same pattern as Chrome's PDF
handler), not a custom switch. This means when a `.torrent` file is opened:

1. The OS launches `browser.exe "C:\path\file.torrent"`
2. `StartupBrowserCreator` navigates to `file:///C:/path/file.torrent`
3. `MagnetNavigationThrottle` intercepts the `file://` URL (extension `.torrent`)
4. Calls `BittorrentService::AddTorrentFile(path)`
5. Redirects the tab to `chrome://bittorrent`

`SHChangeNotify(SHCNE_ASSOCCHANGED)` is called after both register and unregister
so the shell picks up the change immediately.

Three messages are registered in **both** `BittorrentHandler` (for
`chrome://bittorrent`) and `CustomSettingsHandler` (for `chrome://settings`):

| Message | Effect |
|---|---|
| `btIsDefaultTorrentHandler` | Resolves `bool` — checks current HKCU association |
| `btSetDefaultTorrentHandler` | Writes the registry keys above |
| `btUnregisterTorrentHandler` | Removes our ProgID and clears the `.torrent` default |

## TorrentSession states

| State | Meaning |
|---|---|
| `kQueued` | Metadata not yet fetched; engine initialising |
| `kDownloading` | Actively downloading pieces |
| `kSeeding` | All pieces complete; uploading to peers |
| `kPaused` | User-paused; no network activity |
| `kCompleted` | Seeding stopped |
| `kError` | Engine reported an unrecoverable error |

## Preferences

| Pref key | Type | Default | Description |
|---|---|---|---|
| `bittorrent.enabled` | bool | `true` | Master on/off |
| `bittorrent.enable_dht` | bool | `true` | DHT peer discovery |
| `bittorrent.enable_pex` | bool | `true` | Peer Exchange |
| `bittorrent.enable_encryption` | bool | `true` | MSE/PE stream encryption |
| `bittorrent.max_download_kbps` | int | `0` | Download cap in KiB/s; `0` = unlimited |
| `bittorrent.max_upload_kbps` | int | `0` | Upload cap in KiB/s; `0` = unlimited |
| `bittorrent.max_connections` | int | `200` | Global peer connection limit |
| `bittorrent.download_path` | string | `""` | Save directory; empty → `<Profile>/Torrents` |

Constants in [`custom_pref_names.h`](../src/custom/common/custom_pref_names.h).
Registered by `BittorrentServiceFactory::RegisterProfilePrefs` via
`BrowserContextDependencyManager`.

## Settings pages

### React — `chrome://settings/bittorrent`

[`BittorrentPage.tsx`](../src/custom/components/custom_settings/components/BittorrentPage.tsx)

| Section | Controls |
|---|---|
| **General** | Master enable/disable toggle |
| **File association** | Shows current OS default status; **Set as default** / **Remove** buttons that call `btSetDefaultTorrentHandler` / `btUnregisterTorrentHandler` |
| **Protocol** | DHT, PEX, MSE/PE encryption toggles |
| **Bandwidth** | Max download / upload KiB/s number inputs (0 = unlimited) |
| **Connections** | Max peer connections |
| **Storage** | Download folder picker |

### Polymer — `chrome://settings/customOthers`

Checkboxes for `bittorrent.enabled`, DHT, PEX, encryption. Sub-options appear
inside a `<template is="dom-if">` when the master toggle is on.

## `chrome://bittorrent` WebUI

### JS → C++ messages

| Message | Args | Effect |
|---|---|---|
| `btGetSessions` | `[callbackId]` | Resolves `TorrentInfo[]` |
| `btAddMagnet` | `[magnetUri]` | `BittorrentService::AddMagnetLink` |
| `btAddFile` | `[]` | Opens OS `.torrent` file picker (Phase 3) |
| `btPause` | `[infoHash]` | Pauses session |
| `btResume` | `[infoHash]` | Resumes session |
| `btRemove` | `[infoHash, deleteFiles]` | Removes; optionally deletes data |
| `btOpenFolder` | `[infoHash]` | Opens save path in platform file manager |
| `btIsDefaultTorrentHandler` | `[callbackId]` | Resolves `bool` |
| `btSetDefaultTorrentHandler` | `[]` | Registers OS file association |
| `btUnregisterTorrentHandler` | `[]` | Removes OS file association |

### `TorrentInfo` JSON shape

```jsonc
{
  "infoHash":        "40-hex SHA-1",
  "name":            "Ubuntu 24.04 LTS",
  "totalBytes":      1234567890,
  "downloadedBytes": 600000000,
  "uploadedBytes":   50000000,
  "downloadRate":    1048576,      // bytes/s, live from state_update_alert
  "uploadRate":      131072,
  "connectedPeers":  42,
  "state":           "downloading", // queued|downloading|seeding|paused|completed|error
  "savePath":        "C:/Users/user/Torrents",
  "addedTime":       1748736000000  // ms since Unix epoch
}
```

## Patched upstream files

| File | Change |
|---|---|
| `chrome/browser/ui/webui/chrome_web_ui_configs.cc` | `BittorrentUIConfig` registration under `ENABLE_BITTORRENT_CLIENT` |
| `chrome/browser/ui/webui/chrome_web_ui_controller_factory.cc` | Factory entry for `kChromeUIBittorrentHost` |
| `chrome/common/webui_url_constants.cc` | `kChromeUIBittorrentHost` added to `ChromeURLHosts()` so the URL validates |
| `boost/variant/detail/apply_visitor_unary.hpp` | Patched in-tree to use `std::conditional` deduction (see libtorrent section) |

## File map

| File | Purpose |
|---|---|
| [`browser/bittorrent/torrent_session.{cc,h}`](../src/custom/browser/bittorrent/torrent_session.h) | Per-transfer value type |
| [`browser/bittorrent/torrent_engine.{cc,h}`](../src/custom/browser/bittorrent/torrent_engine.h) | libtorrent session wrapper; dedicated engine thread; alert polling |
| [`browser/bittorrent/bittorrent_service.{cc,h}`](../src/custom/browser/bittorrent/bittorrent_service.h) | `KeyedService` — owns engine, sessions, pref config |
| [`browser/bittorrent/bittorrent_service_factory.{cc,h}`](../src/custom/browser/bittorrent/bittorrent_service_factory.h) | Factory + pref registration |
| [`browser/bittorrent/magnet_navigation_throttle.{cc,h}`](../src/custom/browser/bittorrent/magnet_navigation_throttle.h) | Intercepts `magnet:` URIs **and** `file://*.torrent` navigations |
| [`browser/bittorrent/torrent_download_interceptor.{cc,h}`](../src/custom/browser/bittorrent/torrent_download_interceptor.h) | `DownloadManager::Observer` — routes completed `.torrent` downloads |
| [`browser/bittorrent/torrent_file_handler.{cc,h}`](../src/custom/browser/bittorrent/torrent_file_handler.h) | Windows registry `.torrent` file association (HKCU, no elevation) |
| [`browser/ui/views/toolbar/bittorrent_button.{cc,h}`](../src/custom/browser/ui/views/toolbar/bittorrent_button.h) | Top toolbar button; pref-driven visibility; opens `chrome://bittorrent` |
| [`browser/ui/views/bottombar/bottombar_view.{cc,h}`](../src/custom/browser/ui/views/bottombar/bottombar_view.h) | Bottom bar button (`bittorrent_button_`); `ShowSingletonTab` to `chrome://bittorrent` |
| [`browser/ui/webui/bittorrent/bittorrent_ui.{cc,h}`](../src/custom/browser/ui/webui/bittorrent/bittorrent_ui.h) | WebUI controller + `DefaultWebUIConfig` |
| [`browser/ui/webui/bittorrent/bittorrent_handler.{cc,h}`](../src/custom/browser/ui/webui/bittorrent/bittorrent_handler.h) | All JS↔C++ messages + live session observer |
| [`components/custom_bittorrent/App.tsx`](../src/custom/components/custom_bittorrent/App.tsx) | React torrent manager UI |
| [`components/custom_bittorrent/cr.ts`](../src/custom/components/custom_bittorrent/cr.ts) | WebUI messaging bridge |
| [`components/custom_settings/components/BittorrentPage.tsx`](../src/custom/components/custom_settings/components/BittorrentPage.tsx) | React settings page incl. file-association toggle |
| [`third_party/libtorrent/BUILD.gn`](../src/custom/third_party/libtorrent/BUILD.gn) | GN build for libtorrent-rasterbar 2.0.10 |
| [`third_party/libtorrent/try_signal_win.cc`](../src/custom/third_party/libtorrent/try_signal_win.cc) | Windows `catch_error` SEH filter (missing from upstream try_signal on `_WIN32`) |
| [`script/download_boost.py`](../src/custom/script/download_boost.py) | Downloads Boost 1.81.0 headers to `third_party/boost_headers/` |
| [`common/custom_pref_names.h`](../src/custom/common/custom_pref_names.h) | `kBittorrent*` pref key constants |
| [`common/webui_url_constants.h`](../src/custom/common/webui_url_constants.h) | `kChromeUIBittorrentHost` / `kChromeUIBittorrentURL` |

## Implementation roadmap

| Phase | Status | Scope |
|---|---|---|
| **Phase 1** | ✅ Done | Feature gate, build system, service skeleton, prefs, WebUI controller + handler, React manager UI, settings pages, resource IDs |
| **Phase 2** | ✅ Done | libtorrent-rasterbar engine integration; live progress via `state_update_alert`; magnet + `.torrent` file interception; Windows file association; settings file-association toggle; toolbar button navigates to `chrome://bittorrent`; bottom bar button (`ShowSingletonTab`) |
| **Phase 3** | Planned | BitTorrent v2 / hybrid torrent support; `btAddFile` OS picker; WebTorrent (WebRTC peers); sequential downloading for media streaming; VPN-aware routing |
| **Phase 4** | Planned | Enterprise policy; DMCA compliance tooling; advanced bandwidth scheduler; macOS / Linux file association; cloud storage sync |
