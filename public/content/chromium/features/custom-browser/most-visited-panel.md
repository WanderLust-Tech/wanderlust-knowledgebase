# Most-Visited Panel

Gated by `remote_ntp` (the same flag that enables the remote NTP). A toolbar
button opens a compact `~380×300px` bubble panel showing the user's top sites
as a Pathfinder card grid — the same tile data as the remote NTP, accessible
from any page without navigating away.

## Build / activation

| Where | What |
|---|---|
| [`custom_browser_config.gni`](../src/custom/custom_browser_config.gni) | `remote_ntp = true` — gates all most-visited panel sources |
| [`browser/ui/sources.gni`](../src/custom/browser/ui/sources.gni) | `if (remote_ntp)` block adds button + bubble `.cc`/`.h` pairs to `custom_browser_ui_sources` |
| Toolbar wiring | `BrowserView::AddCustomViews()` in the patched `browser_view.cc` — instantiates `MostVisitedButton` |
| WebUI registration | [`custom_webui_controller_factory.cc`](../src/custom/browser/ui/webui/custom_webui_controller_factory.cc) — `chrome://top-sites` → `MostVisitedUI` |
| URL constant | [`custom/common/webui_url_constants.h`](../src/custom/common/webui_url_constants.h) — `kChromeUITopSitesHost` / `kChromeUITopSitesURL` |

## Architecture

```
MostVisitedButton (ToolbarButton subclass)
  │  Lives in the main toolbar (right of address bar).
  │  Click → ShowBubble / close if already open.
  │
  └─► MostVisitedBubble (BubbleDialogDelegateView)
        │  ~380×300px, TOP_RIGHT anchor on the button.
        │  No title bar, no close button.
        │  Hosts a views::WebView loading chrome://top-sites.
        │  RegisterWindowClosingCallback → notifies button to clear bubble_ ptr.
        │
        └─► MostVisitedUI (WebUIController)
              │  SetupWebUIDataSource → serves the Pathfinder React bundle.
              │  Registers MostVisitedHandler as WebUIMessageHandler.
              │
              └─► MostVisitedHandler (WebUIMessageHandler)
                    │  Bridges JS ↔ RemoteNtpService.
                    │  Observes RemoteNtpService for tile changes.
                    │
                    └─► RemoteNtpService (existing KeyedService)
                          Tile storage, thumbnail cache, remove-tile logic.
```

## JS ↔ C++ message protocol

| Direction | Message | Payload | Notes |
|---|---|---|---|
| JS → C++ | `topSitesGetTiles` | — | Returns `RemoteNtpTile[]` to the JS callback |
| JS → C++ | `topSitesOpenUrl` | `{url, newTab}` | Navigates current tab (`false`) or opens background tab (`true`) |
| JS → C++ | `topSitesRemoveTile` | `{url}` | Calls `RemoteNtpService::RemoveCustomTile()` |
| C++ → JS | `tilesUpdated` | `tiles[]` | Fired when `RemoteNtpService` notifies of a tile change |

## File map

### C++ Views layer

| File | Purpose |
|---|---|
| [`ui/views/toolbar/most_visited_button.{cc,h}`](../src/custom/browser/ui/views/toolbar/most_visited_button.cc) | `ToolbarButton` subclass. Opens/closes `MostVisitedBubble`. Stores a raw pointer to the live bubble, cleared via the close callback |
| [`ui/views/most_visited/most_visited_bubble.{cc,h}`](../src/custom/browser/ui/views/most_visited/most_visited_bubble.cc) | `BubbleDialogDelegateView`. Hosts the `views::WebView`. Static `ShowBubble()` factory; private ctor (friended in `bubble_dialog_delegate_view.h`) |

### WebUI / handler layer

| File | Purpose |
|---|---|
| [`ui/webui/most_visited/most_visited_ui.{cc,h}`](../src/custom/browser/ui/webui/most_visited/most_visited_ui.cc) | `WebUIController`. Calls `SetupWebUIDataSource`, registers `MostVisitedHandler` |
| [`ui/webui/most_visited/most_visited_handler.{cc,h}`](../src/custom/browser/ui/webui/most_visited/most_visited_handler.cc) | `WebUIMessageHandler`. Implements the JS message dispatch table, observes `RemoteNtpService` |

### React front-end

| File | Purpose |
|---|---|
| [`components/custom_top_sites/App.tsx`](../src/custom/components/custom_top_sites/App.tsx) | Root component |
| [`components/custom_top_sites/TopSiteGrid.tsx`](../src/custom/components/custom_top_sites/TopSiteGrid.tsx) | Pathfinder `Card` grid — 4 columns, favicon + title. Left-click → `topSitesOpenUrl`. Middle-click → new tab. Right-click context menu → Open / Open in new tab / Remove |
| [`components/custom_top_sites/main.tsx`](../src/custom/components/custom_top_sites/main.tsx) | `createRoot` mount |
| [`components/custom_top_sites/BUILD.gn`](../src/custom/components/custom_top_sites/BUILD.gn) | React bundle via `build_react_webui.gni` |

### Patches into vanilla Chromium

| File | What it changes |
|---|---|
| [`chrome/browser/ui/views/frame/browser_view.cc`](../src/chrome/browser/ui/views/frame/browser_view.cc) | Instantiates `MostVisitedButton` in `AddCustomViews()`, gated on `remote_ntp` |
| [`chrome/browser/ui/webui/chrome_web_ui_configs.cc`](../src/chrome/browser/ui/webui/chrome_web_ui_configs.cc) | Registers `MostVisitedUIConfig` for `kChromeUITopSitesHost` |
| [`ui/views/bubble/bubble_dialog_delegate_view.h`](../src/ui/views/bubble/bubble_dialog_delegate_view.h) | Adds `friend class ::custom::MostVisitedBubble;` and the matching forward declaration |

## Relationship to RemoteNtpService

The panel reuses `RemoteNtpService` directly — it is not a separate data layer.
The service already manages tiles, thumbnail caching, `RemoveCustomTile()`, and
change notifications. `MostVisitedHandler` is a thin observer that converts
service callbacks into `FireWebUIListener` calls and handles the JS message
dispatch. No new prefs, no new network requests.

If `RemoteNtpService` is unavailable for the profile (e.g. incognito), the
handler returns an empty tile list. The React component renders an empty-state
message in that case.

## Testing

1. Build with `remote_ntp = true` (default).
2. Open any page. A "Top Sites" icon should appear in the toolbar.
3. Click the icon → bubble appears with a 4-column grid of top-site tiles.
4. Click a tile → current tab navigates to that URL. Bubble closes.
5. Middle-click (or "Open in new tab" from right-click menu) → new background
   tab opens. Bubble stays open.
6. Right-click → Remove → tile disappears, grid reflows immediately.
7. Click the button again while the bubble is open → bubble closes.
8. Open a new tab (NTP). The same tiles should appear there — confirming shared
   state from `RemoteNtpService`.

What "broken" looks like:

| Symptom | Likely cause |
|---|---|
| Button not in toolbar | `remote_ntp` build flag is false, or `AddCustomViews()` patch missing |
| Bubble opens blank | `MostVisitedUI` not registered in `chrome_web_ui_configs.cc`, or React bundle not built |
| Tiles don't load | `RemoteNtpService` unavailable for this profile (incognito?), or `topSitesGetTiles` handler missing |
| Remove doesn't persist | `RemoteNtpService::RemoveCustomTile()` requires a network round-trip; tile reappears on next NTP sync if not actually stored |
| Bubble doesn't close when button clicked again | `bubble_` pointer not cleared — check the close callback wiring in `MostVisitedButton` |
