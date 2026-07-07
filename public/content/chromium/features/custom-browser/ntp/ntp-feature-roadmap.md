# NTP Feature Roadmap

Analysis of the `maxmilton/new-tab` Chrome extension (v0.21.0) as a reference for
features that can be built into the WanderLust remote NTP.

**Source analyzed:** `maxmilton/new-tab` — TypeScript + stage1 + ekscss, zero external
API calls. All data sourced from `chrome.*` extension APIs.

---

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented |
| 🔧 | Partially implemented — some plumbing exists |
| 🗺️ | Planned — spec is clear, work is scoped |
| 💡 | Possible — feasible but not yet prioritized |
| ❌ | Not feasible in remote NTP context |

---

## Feature inventory

### 1. Bookmark Bar — folder-based quick links  ✅

**What the extension does:** Renders bookmark bar folders as collapsible panels with
hover/click to reveal URLs inside.

**What we built:** Full end-to-end live data pipeline — `BookmarkModel` → Mojo IPC
→ renderer extension → `window.custom.bookmarks` → `BookmarksAPI` → `BookmarkList`
React component. Updates automatically when the user adds/removes/renames bookmarks.

Coverage includes:
- Bookmark bar folders, including their direct URL children and all levels of sub-folders
- Bookmark bar direct items (bare bookmarks not in any folder) as a synthetic folder entry
- **Other Bookmarks** — direct items as a synthetic folder entry; sub-folders as individual folder entries
- Sub-folder nesting at **all depths** — `BuildBookmarkFolders` recurses via `std::function`; nested sub-folders appear with path-prefixed titles (e.g. `"Projects > Archived"`) so users know where they live
- Show/hide toggle in NTP settings sidebar (Full layout)
- **Favicons in Hub dropdown items** — `buildFaviconUrl(url, false)` constructs `chrome-search://favicon2/` URLs client-side; rendered as 16×16 images before each bookmark title with `onError` hide
- **Drag-to-reorder bookmark folders** — Hub bar pills are draggable; a blue insertion-line indicator shows the drop point; on drop, `ReorderBookmarkFolder(int64 folder_id, int32 new_folder_index)` is called on the `RemoteNtp` Mojo interface; the service computes the correct absolute index among all bookmark bar children (skipping non-folder nodes) and calls `BookmarkModel::Move`; the model observer fires automatically, pushing the updated folder list back to the renderer

**Reference:** `ntp-bookmarks-api.md` for full implementation details.

---

### 14. Hub layout  ✅

**What it does:** A bookmark-first NTP layout with a fixed glassmorphism bar spanning
the full viewport top. Each bookmark folder appears as a pill button; hovering opens a
floating dropdown showing that folder's bookmarks, with sub-folders rendered as
labelled sections inside the same panel.

**What we built:**
- `src/layouts/HubLayout.tsx` — fixed bar + hover-open `FolderMenu` components
- 80 ms close-delay timer so moving from button to dropdown doesn't flicker
- Sub-folder sections with hairline divider and indented items; favicons per bookmark entry
- Drag-to-reorder folder pills (HTML5 DnD, blue insertion-line indicator, persisted via `BookmarkModel::Move`)
- Settings: `showSearch`, `showTopSites`, wallpaper source/color/blur/brightness
- Selectable from `NtpSettingsPage.tsx` alongside Full, Glass, Focus, etc.
- `LayoutFlavor` type and `VALID_FLAVORS` updated in `useLayoutFlavor.ts` and `LayoutContext.tsx`
- **Unified search** (`UnifiedSearch.tsx`) — hover-open "Find" panel in the Hub bar that fans out a query to open tabs (local filter), recently-closed sessions (local filter), and history (`HistoryAPI.search` with 150 ms debounce); grouped by source with keyboard navigation (↑↓ select, ↵ open/switch, Esc close); tabs switch via `TabsAPI.switchToTab`, sessions restore via `SessionsAPI.restoreSession`, history navigates directly

---

### 2. Unified search across five data sources  ✅

**What the extension does:** A single search box searches across:
1. Open tabs (match by title/URL)
2. Bookmarks (match by title/URL)
3. History (match by title/URL)
4. Top sites / most-visited
5. Recently-closed sessions

**What we have:** All five data sources are bridged and available via `window.custom.*`
APIs. A unified cross-source search UI (`UnifiedSearch.tsx`) is live in the Hub bar:

| Source | API | Surface |
|--------|-----|---------|
| Omnibox / bookmarks / history / top sites | `window.custom.autocomplete` | NTP search box (all layouts) |
| Open tabs | `window.custom.tabs` → `TabsAPI` | `TabsMenu` + `UnifiedSearch` in Hub bar |
| Recently-closed sessions | `window.custom.sessions` → `SessionsAPI` | `RecentSessionsMenu` + `UnifiedSearch` in Hub bar |
| History full-text search | `window.custom.history` → `HistoryAPI` | `HistoryMenu` + `UnifiedSearch` in Hub bar |
| Top sites tiles | `window.custom.ntpTiles` → `TilesAPI` | Tile grids in all layouts |

**`UnifiedSearch` component** — hover-open "Find" panel in the Hub bar:
- Fans out to tabs (≤5), recently-closed sessions (≤3), and history (≤5); results grouped by source
- Tabs and sessions filtered locally; history debounced 150 ms via `HistoryAPI.search`
- Keyboard: ↑↓ navigate, ↵ open/switch, Esc close; `onMouseEnter`/`Leave` with 80 ms close-delay matching other Hub menus
- Tab results call `TabsAPI.switchToTab`; session results call `SessionsAPI.restoreSession`; others navigate via `window.location.href`
- Favicons via `buildFaviconUrl(url, false)` with `onError` hide

---

### 3. Top sites / most-visited tiles  ✅

**What the extension does:** Renders `chrome.topSites` as icon tiles.

**What we have:** `TilesAPI` (`window.custom.ntpTiles`) fully implemented. The NTP
renders most-visited tiles in all layouts.

---

### 4. Themes  ✅

**What the extension does:** Six built-in themes (dark/light/high-contrast variants)
controlled by a settings toggle.

**What we have:** `ThemeAPI` (`window.custom.theme`) pushes `darkModeEnabled` and
background image metadata from the browser. Theme switching via the NTP settings
sidebar (`NtpSettingsPage.tsx`) persists per-layout settings in
`window.custom.settings.settingsJson`.

NTP-level colour palette themes and Chromium theme integration are now implemented.

Coverage includes:
- 8 predefined accent palettes: Blue (default), Violet, Rose, Amber, Emerald, Cyan,
  Indigo, Slate
- `colorTheme` key in the settings JSON drives two CSS custom properties on
  `document.documentElement`: `--ntp-accent` (hex) and `--ntp-accent-rgb` (R, G, B
  components for `rgba()` usage)
- **Chromium theme integration:** `RemoteNtpTheme` Mojo struct gained a
  `toolbar_color` field (uint32 SkColor, 0xAARRGGBB). `RemoteNtpThemeProvider`
  populates it via `ThemeService::GetColorProvider()->GetColor(ThemeProperties::COLOR_TOOLBAR)`
  whenever a non-default, non-system theme (extension theme or Chrome Colors palette)
  is active. Zero signals "use the NTP's own colour palette setting."
  Note: `ui::ThemeProvider::GetColor` was removed in this Chromium version — colours
  are now accessed through `ui::ColorProvider` (`ThemeService::GetColorProvider()`).
- `useNtpColorTheme` hook in `LayoutShell.tsx` — priority order:
  1. If `window.custom.theme.theme.toolbarColor` is non-zero (custom browser theme
     active), derive `--ntp-accent` from the browser toolbar colour directly.
  2. Otherwise, apply the user's selected NTP colour palette.
  - Reacts live to both `onNtpSettingsChanged` and `onThemeChanged`.
- "Accent colour" picker in `NtpSettingsPage.tsx` — circular colour swatches with a
  ring indicator; sits under the existing "Browser theme" (auto/light/dark) toggle.
  When a Chromium theme is active this picker is overridden automatically.
- Active-tab indicator dot in `TabsMenu` uses `var(--ntp-accent)` instead of a
  hardcoded Tailwind colour class.

**Architecture note:** `src/utils/ntpThemes.ts` defines the palette registry;
`src/hooks/useNtpColorTheme.ts` owns the priority logic (browser theme → palette →
default). Adding a new NTP palette requires one entry in that array only.

---

### 5. NTP Settings  ✅

**What the extension does:** Settings panel with drag-and-drop section reordering,
per-section visibility toggles, and theme picker.

**What we have:** `SettingsBindings` (`window.custom.settings`) pushes settings JSON
from the browser. `NtpSettingsPage.tsx` (sidebar panel) reads/writes per-layout
settings. `GlassLayout` and others respond to `onNtpSettingsChanged`.

Coverage includes:
- Per-layout visibility toggles: search bar, top sites, bookmarks, greeting, clock,
  weather
- **Section drag-and-drop (Full layout):** The Content section in the sidebar shows
  Search, Top sites, and Bookmarks as draggable rows with inline visibility toggles.
  Users drag rows to reorder; the result is stored as `sectionOrder: string[]` in the
  settings JSON. `NewTab.tsx` reads `sectionOrder` on mount and on every settings push,
  normalising the array (unknown ids stripped, missing ids appended at end) before
  rendering sections in that order with `<Divider>` between visible ones.
  HTML5 Drag-and-Drop API — no external library. Drop position (before/after) is
  determined by comparing the pointer's Y coordinate against the drop target's vertical
  midpoint, giving precise above/below insertion.
- Wallpaper source picker (Default / Bing / Unsplash / Colour), blur & brightness
  sliders, Unsplash topic chips
- Accent colour palette picker (8 swatches)

**Outstanding:**
- Settings migration / versioning as the schema evolves.

---

### 6. WiFi status widget  ✅

**What the extension does:** Not present in maxmilton/new-tab.

**What we have:** `NetworkBindings` (`window.custom.network`) exposes WiFi SSID,
signal level, link speed etc. from `wifi::WiFiService` (macOS and Windows).

---

### 7. Clock widget  ✅

**What the extension does:** Not present in maxmilton/new-tab.

**What we have:** Analog (`ScallopClock`) and digital (`Clock`) widgets in all layouts,
controlled via NTP settings.

---

### 8. Weather widget  ✅

**What the extension does:** Not present (zero external API calls by design).

**What we have:** Open-Meteo weather widget in Glass and Full layouts.

---

### 9. Recently-closed sessions  ✅

**What the extension does:** Lists recently-closed tabs/windows via `chrome.sessions`.

**What we built:** Full end-to-end live data pipeline — `TabRestoreService` → Mojo IPC
→ renderer extension → `window.custom.sessions` → `SessionsAPI` → `RecentSessionsMenu`
React component in the Hub layout bar.

Coverage includes:
- Recently-closed tabs — title, URL, timestamp
- Recently-closed windows — active tab title/URL, tab count badge, window icon
- Tab groups (`GROUP` entries) are intentionally excluded — no single representative URL
- Observer-based push: updates whenever a tab/window is closed or restored
- `RecentSessionsMenu` — pill button in the Hub bar, hover-open dropdown matching bookmark folder style
- `RecentSessions` — standalone panel component in Full layout (section) and Glass layout (carousel tab); off by default, enabled via the "Recently Closed" toggle in NTP settings
- **Restore by session ID** — `NtpRecentSession` now carries `session_id` (from `entry->id.id()`); `RestoreSession(int32 session_id)` on the `RemoteNtp` Mojo interface routes to `TabRestoreService::RestoreEntryById` via `BrowserLiveTabContext::FindContextForWebContents`; clicking any session entry in `RecentSessionsMenu`, `RecentSessions`, or `UnifiedSearch` restores the tab/window instead of navigating to its URL

**Reference:** full stack in five layers — see `ntp-bookmarks-api.md` for the general
architecture pattern; sessions follows the same push-only design.

---

### 10. Open tabs list  ✅

**What the extension does:** Lists all open tabs by title/URL; clicking switches to the
tab. Uses `chrome.tabs`.

**What we built:** Full end-to-end live data pipeline — `BrowserList`/`TabStripModel`
→ Mojo IPC → renderer extension → `window.custom.tabs` → `TabsAPI` → `TabsMenu` React
component in the Hub layout bar.

Coverage includes:
- All open tabs across all browser windows (filtered to the current profile)
- `isActive` flag to highlight the active tab in each window
- Live updates via `BrowserListObserver` + `TabStripModelObserver` — list refreshes whenever tabs open, close, or navigate
- `switchToTab(tabId, windowId)` — clicking a tab in the Hub menu activates it and focuses its window (`SwitchToTab` on the `RemoteNtp` Mojo interface)
- Tab search: filter box inside the Hub dropdown for quick keyboard-driven tab switching
- Tab count badge on the "Tabs" pill button

**Architecture note:** `RemoteNtpServiceImpl` adds itself as a `BrowserListObserver` to
track new browser windows, and as a `TabStripModelObserver` on each window's
`TabStripModel`. Tab IDs are stable `SessionTabHelper::IdForTab()` values; window IDs
are `Browser::session_id()` values.

---

### 11. History search  ✅

**What the extension does:** Searches browsing history by query string via
`chrome.history.search`.

**What we built:** Full end-to-end pipeline — `history::HistoryService` →
fire-and-forget Mojo → renderer extension → `window.custom.history` → `HistoryAPI`
→ `HistoryMenu` React component in the Hub layout bar.

Coverage includes:
- `SearchHistory(string query)` on the `RemoteNtp` Mojo interface (renderer → browser);
  results pushed back via `HistoryResultsChanged(array<NtpHistoryResult>)` on
  `RemoteNtpClient` — same fire-and-forget + push-back pattern as autocomplete
- Empty query returns the last 7 days of visits ordered by recency (max 20); non-empty
  query runs a full-text search (max 20 results)
- `base::CancelableTaskTracker` in `RemoteNtpServiceImpl` cancels any in-flight
  history query when a new one arrives
- `window.custom.history.search(query)` + `historyAvailable` / `historyResults`
  properties exposed via `HistoryBindings` in the renderer extension
- `HistoryAPI` in browser-api: `search(query)`, `addObserver(cb)` for live result
  delivery; exported as `BrowserAPI.history`
- `HistoryMenu` in the Hub bar: hover-open dropdown matching the Tabs/Sessions style,
  150 ms debounced search input, relative timestamps ("3m ago", "2h ago", "1d ago")

**Architecture note:** Uses the same fire-and-forget + push-back pattern as
`QueryAutocomplete` / `AutocompleteResultChanged` rather than a Mojo callback, keeping
the browser-side implementation symmetric with the other push-only observers.
`NtpHistoryResult` carries `title`, `url`, `last_visit_ms`, and `visit_count`.

---

### 12. New-tab page-level search (omnibox delegation)  ✅

**What the extension does:** Typing in the search box submits to the default search
engine.

**What we have:** `AutocompleteAPI` (`window.custom.autocomplete`) provides real-time
suggestions; selecting a result opens the URL via `OpenAutocompleteMatch`.

---

### 13. Favicon resolution  ✅

**What the extension does:** Loads favicons from `chrome://favicon/`.

**What we have:** `FaviconSource` is registered in `RemoteNtpServiceImpl` and is
accessible from the NTP page. Tile favicons are populated via `favicon_url` in
`RemoteNtpTile`.

---

## Priority order (suggested)

| Priority | Feature | C++ effort | TS/React effort | Status |
|----------|---------|-----------|-----------------|--------|
| — | Hub layout | None | Medium | ✅ Done |
| — | Bookmark bar direct items | Low | None | ✅ Done |
| — | Bookmark sub-folder nesting (all depths) | Low | Medium | ✅ Done |
| — | Recently-closed sessions | Medium | Low | ✅ Done |
| — | Tabs list / search | Medium | Medium | ✅ Done |
| — | NTP colour themes | None | Medium | ✅ Done |
| — | History search | Medium | Medium | ✅ Done |
| — | Section drag-and-drop | None | Medium | ✅ Done |
| — | Favicons in Hub dropdown items | None | Low | ✅ Done |
| — | RecentSessions in Full/Glass layouts | None | Low | ✅ Done |
| — | Unified cross-source search UI | None | Medium | ✅ Done |
| — | Restore by session ID | Medium | Low | ✅ Done |
| — | Drag-to-reorder bookmark folders | Medium | Low | ✅ Done |

---

## What is NOT feasible in remote NTP

The remote NTP is a sandboxed web page loaded into the browser. It does not have
access to:
- **`chrome.*` extension APIs** — these are only available to browser extensions,
  not WebUI pages. All data must be bridged through Mojo and `window.custom`.
- **Raw filesystem access** — any local storage goes through `PrefService` or
  `IndexedDB`.
- **Cross-origin requests** without browser-level allowlisting via
  `RemoteNtpApiAllowList`.

Any feature from `maxmilton/new-tab` that reads `chrome.*` APIs needs a corresponding
Mojo bridge in the C++ layer.
