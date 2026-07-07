# Sidebar WebUI (`chrome://sidebar`)

Gated by `BUILDFLAG(ENABLE_SIDEBAR)`. Replaces the legacy
`chrome-extension://dilkochpjplnaiapncbdigfghljnlano/<page>.html` pages that
the side panel used to load (the Kinza-era bundled extension that often
showed as `ERR_BLOCKED_BY_CLIENT` when the extension wasn't loaded).

## Shape

| Concern | Implementation |
|---|---|
| WebUI host | `chrome://sidebar/` — single React SPA, one bundle |
| Routing | `chrome://sidebar/bookmarks` / `…/history` / `…/rss` / `…/notes` / `…/ntp-settings` — `App.tsx` reads `window.location.pathname` and renders the matching page component |
| C++ controller | [`SidebarUI`](../../src/custom/browser/ui/webui/sidebar/sidebar_ui.cc) — mirrors `ReaderUI`; serves the bundle via `webui::SetupWebUIDataSource` with the same `script-src 'self'` / `style-src 'self' 'unsafe-inline'` CSP overrides |
| DOM handler | [`SidebarDOMHandler`](../../src/custom/browser/ui/webui/sidebar/sidebar_dom_handler.cc) — exposes RSS-read IPCs (`requestFeedList`, `requestFeedContent`, plus `readerFeedsChanged` / `readerUnreadChanged` listeners — same names as `ReaderDOMHandler` so the shared `RSSImpl` backend serves both), bookmark IPCs (`requestBookmarkTree` + `bookmarksChanged` listener), history IPCs (`requestHistory`, `removeHistoryEntry`, `historyChanged` listener), notes IPCs (`notesGetActiveUrl`, `notesGetForUrl`, `notesList`, `notesSave`, `notesDelete`), NTP settings IPCs (`ntpGetSettings`, `ntpSaveSettings`, `ntpGetCurrentLayout`), and a shared `openUrl` write that navigates the active browser tab |
| React bundle | [`//custom/components/custom_sidebar/`](../../src/custom/components/custom_sidebar/) — `main.tsx` → `App.tsx` → one of `pages/{RssPage,BookmarksPage,HistoryPage,NotesPage,NtpSettingsPage}.tsx` |
| Native integration | [`SidebarContainerView`](../../src/custom/browser/ui/views/frame/sidebar_container_view.cc) loads `kChromeUISidebarBookmarksURL` / `…HistoryURL` / `…RssURL` / `…NotesURL` / `…NtpSettingsURL` into its embedded `WebView` when a top-pane button is pressed (or `ShowPanel()` is called programmatically) |

## File map

| Path | Role |
|---|---|
| `index.html` | Bare shell, `<div id="root">` + module import |
| `main.tsx` | `createRoot().render(<App />)` after pulling in `cr.ts` for the IPC polyfill |
| `cr.ts` | `chrome.send` / `cr.sendWithPromise` / `cr.addWebUIListener` polyfill — copy of `custom_reader/cr.ts` |
| `App.tsx` | Reads `window.location.pathname`, picks `<RssPage/>`, `<BookmarksPage/>`, `<HistoryPage/>`, `<NotesPage/>`, or `<NtpSettingsPage/>` |
| `types.ts` | `Feed`, `Group`, `FeedItem`, `FeedListResponse`, `SidebarRoute` (`'bookmarks' \| 'history' \| 'rss' \| 'notes' \| 'ntp-settings'`), `PageNote` |
| `hooks/useSidebarRss.ts` | `useFeedList` + `useFeedItems` + `getFaviconUrl` — same IPC names as chrome://reader's hooks so the shared `RSSImpl` backend serves both |
| `hooks/useBookmarks.ts` | `useBookmarks()` — fetches the tree once and refetches on `bookmarksChanged` |
| `hooks/useHistory.ts` | `useHistory(query, maxCount)` — debounced search input is the caller's job; refetches on `historyChanged`. Also exports the imperative `removeHistoryEntry(url)` |
| `hooks/useOpenUrl.ts` | `openUrl(url)` — single entry point for "navigate the active tab". Sidebar links route through this rather than `<a target="_blank">` because `SidebarWebContentsDelegate` doesn't override `OpenURLFromTab` |
| `pages/RssPage.tsx` | Compact RSS view: `<select>` feed picker + scrolling item list with favicon, relative time, 2-line summary clamp |
| `pages/BookmarksPage.tsx` | Recursive tree: collapsible folders + clickable bookmark rows with favicons. Top-level folders default open; nested folders default closed. Search filter prunes the tree client-side (small N, no backend round-trip) |
| `pages/HistoryPage.tsx` | Recent visits grouped by day (Today / Yesterday / `<weekday, MMM d>`), 200 most recent within the last year. Debounced (250ms) search by title/URL substring. Hover row → ✕ button → `removeHistoryEntry` |
| `pages/NotesPage.tsx` | Per-URL text notes. On mount: `notesGetActiveUrl` → `notesGetForUrl`. Textarea pre-populated with first note for current page; Save/Update/Delete. ↻ button re-queries active tab. Collapsible "All notes" section via `notesList` |
| `pages/NtpSettingsPage.tsx` | NTP settings panel. On mount: `Promise.all([ntpGetCurrentLayout, ntpGetSettings])` → populate state (layout field falls back to the active NTP flavor if never previously saved). Layout picker at the top: 5 radio-style cards (full/clean/focus/wallpaper/glass). Sections below update immediately as the user selects cards: content toggles (search, top sites, greeting, clock), background toggles (show background, Bing wallpaper), and a theme picker (auto/light/dark). Save button fires `ntpSaveSettings` which persists to prefs and pushes to the active NTP tab via `RemoteNtpTabHelper` |
| `BUILD.gn` | `build_react_webui("custom_sidebar")` — same template `custom_reader` uses |
| `styles/tailwind.css` | Brand/navy palette tokens, same as `custom_reader` |
| `tsconfig.json` | Same path aliases as `custom_reader` (react, react-dom, pathfinder-ui) |

## Route lifecycle

The native `SidebarContainerView` owns lifecycle. When the user clicks a top-pane button:

1. `TopPaneButtonPressed(type)` calls `LoadURL(GURL(kChromeUISidebar{Bookmarks,History,Rss,Notes,NtpSettings}URL))` on the embedded `WebView`.
2. The `WebContents` navigates — fresh document, fresh React app instance.
3. `App.tsx`'s `routeFromLocation()` reads `window.location.pathname` and picks the page component.
4. Page mounts, fires `onPageLoaded`, then issues whatever IPCs it needs.

The SPA never navigates between routes internally — every route switch is a navigation driven by the native button.

**NTP settings special case.** The `ntp-settings` route can also be opened programmatically when the user clicks the gear icon on the NTP page. The call chain is: NTP React → `window.custom.settings.openNtpSettings()` → `RemoteNtp` Mojo → `RemoteNtpTabHelper::OnOpenNtpSettings()` → `SidebarContainerView::ShowPanel(TYPE_NTP_SETTINGS)`. `ShowPanel` calls `ChangeUIWithType(type)` on the pane strip and then `TopPaneButtonPressed(type)` so the button selection state, the URL load, and the collapse-expand behavior all use the same code path as a button click.

## IPC contract

`SidebarDOMHandler` is the single message handler behind all three pages. RSS messages share names with `ReaderDOMHandler` (different handler instance, same `RSSImpl` backend) so the React hooks are portable. Bookmark and history messages are sidebar-specific.

### Reads — `cr.sendWithPromise(name, ...args)`

| Message | Args | Resolves with |
|---|---|---|
| `requestFeedList` | — | `{ feeds: Feed[], groups: Group[] }` |
| `requestFeedContent` | `channelUrl: string` | `FeedItem[]` (also marks the channel's items read server-side and fires `readerUnreadChanged`) |
| `requestBookmarkTree` | — | `{ loaded: boolean, roots: BookmarkNode[] }` — three top-level folders (bookmark_bar / other / mobile); recursive `BookmarkNode` payload with `type: "folder"` (has `children[]`) or `type: "url"` (has `url`). `loaded` is false until `BookmarkModelLoaded` fires |
| `requestHistory` | `query: string, maxCount?: number` | `HistoryEntry[]` — `{ url, title, visitTime (ms), visitCount }`. Empty `query` returns most-recent visits within the last 365 days; non-empty filters by title/url substring. `maxCount` defaults to 100 |
| `notesGetActiveUrl` | — | `string` — `GetLastCommittedURL().spec()` of the active tab |
| `notesGetForUrl` | `url: string` | `PageNote[]` — all notes whose normalized URL matches |
| `notesList` | — | `PageNote[]` — every note across all pages |
| `ntpGetSettings` | — | `string` — raw JSON blob from the `remote_ntp.settings_json` profile pref (empty string if never saved) |
| `ntpGetCurrentLayout` | — | `string` — layout flavor of the active NTP tab (`'full'`, `'glass'`, `'clean'`, `'focus'`, or `''` if no NTP is active) |

### Writes — `chrome.send(name, args)`

| Message | Args |
|---|---|
| `onPageLoaded` | `[]` — handler calls `AllowJavascript()` and flips its `page_loaded_` flag |
| `openUrl` | `[url]` — opens in a new foreground tab of the last-active browser window (`ScopedTabbedBrowserDisplayer` + `Navigate(PAGE_TRANSITION_AUTO_BOOKMARK)`) |
| `removeHistoryEntry` | `[url]` — `HistoryService::DeleteURLs({url})` — fires `historyChanged` via observer |
| `notesSave` | `[url, text, id]` — `id == 0` inserts, `id > 0` updates. `PageNotesService::SaveNote()`. Fire-and-forget |
| `notesDelete` | `[id]` — `PageNotesService::DeleteNote()`. Fire-and-forget |
| `ntpSaveSettings` | `[settingsJson]` — writes JSON blob to `remote_ntp.settings_json` pref, then finds the active NTP tab and pushes the update via `RemoteNtpTabHelper::SendNtpSettingsChanged` so the NTP page reacts without a reload |
| `sharedNotesPost` | `[url, text]` — posts annotation to shared backend (no-op until backend configured) |
| `sharedNotesDelete` | `[annotationId]` — deletes shared annotation by UUID (no-op until backend configured) |

### Listener events — `cr.addWebUIListener(name, fn)`

| Event | Payload | Sent when |
|---|---|---|
| `readerFeedsChanged` | — | `RSSImpl::NotifyRSSChanged` reaches the observer list (subscribe/unsubscribe, fetch results) |
| `readerUnreadChanged` | `{ channelUrl, unreadCount }` | Immediately after `requestFeedContent` marks items read |
| `bookmarksChanged` | — | Any `BookmarkModelObserver` event (load complete, add/remove/move/rename). React side refetches the full tree |
| `historyChanged` | — | `HistoryServiceObserver::OnURLVisited` / `OnHistoryDeletions` / `OnHistoryServiceLoaded` — React refetches its last query |
| `notesUrlChanged` | `url: string` | Active tab navigates or user switches tabs (`WebContentsObserver::PrimaryPageChanged` / `TabStripModelObserver::OnTabStripModelChanged`). Empty string on tab close. |

## Build wiring

Mirrors `custom_reader`:

| File | Change |
|---|---|
| [`src/custom/components/custom_sidebar/BUILD.gn`](../../src/custom/components/custom_sidebar/BUILD.gn) | `build_react_webui("custom_sidebar")` target |
| [`src/custom/tools/gritsettings/resource_ids_custom.spec`](../../src/custom/tools/gritsettings/resource_ids_custom.spec) | Reserved slot `31160` (custom_reader took 31130; we leave 30 for headroom) |
| [`src/custom/components/resources/BUILD.gn`](../../src/custom/components/resources/BUILD.gn) | `custom_sidebar:resources` dep + `custom_sidebar_resources.pak` source |
| [`src/custom/browser/ui/webui/BUILD.gn`](../../src/custom/browser/ui/webui/BUILD.gn) | `custom_sidebar:resources` dep |
| [`src/custom/browser/ui/sources.gni`](../../src/custom/browser/ui/sources.gni) | `enable_sidebar` block adds `sidebar_dom_handler.{cc,h}` + `sidebar_ui.{cc,h}` |
| [`src/custom/browser/ui/BUILD.gn`](../../src/custom/browser/ui/BUILD.gn) | Same sources via the `enable_sidebar` block in `source_set("ui")` |
| [`src/chrome/browser/ui/webui/chrome_web_ui_configs.cc`](../../src/chrome/browser/ui/webui/chrome_web_ui_configs.cc) | `#if BUILDFLAG(ENABLE_SIDEBAR)` → `map.AddWebUIConfig(std::make_unique<custom::SidebarUIConfig>())` |
| [`src/custom/common/webui_url_constants.h`](../../src/custom/common/webui_url_constants.h) | `kChromeUISidebarHost`, `kChromeUISidebar{Bookmarks,History,Rss,Notes,NtpSettings}URL` |
| [`src/custom/browser/ui/views/frame/sidebar_container_view.cc`](../../src/custom/browser/ui/views/frame/sidebar_container_view.cc) | `LoadURL(GURL(kChromeUISidebar*URL))` instead of `kSidebarExtension*HTML` |

## Deferred

- **`kSidebarExtension*HTML` constants in [`constants.cc`](../../src/custom/common/constants.cc)** — still defined but unreferenced after `sidebar_container_view.cc` was migrated. Safe to delete in a cleanup pass once we've confirmed nothing else loads from the bundled extension.
- **Bookmark edit / add / delete / drag-to-reorder** — currently the bookmarks page is read-only. The native bookmark manager (`chrome://bookmarks`) covers full CRUD; reproducing it in the sidebar isn't a priority. Click-to-navigate is the 90% case.
- **History delete-range / clear-day** — only per-URL deletion is wired. `chrome://history` covers bulk operations.
- **Virtualized history list** — `HistoryPage` currently renders all 200 rows directly. Fine for the default cap; if we raise it above ~500, switch to a windowed renderer.

## Manual test (post-build)

1. Open a window with the sidebar enabled (`enable_sidebar = true` in `custom_browser_config.gni`, which is the default).
2. Click the **RSS** button on the sidebar's top pane. The inner WebView should navigate to `chrome://sidebar/rss` (DevTools → Network confirms — `custom_sidebar.js` + `custom_sidebar.css` load).
3. The feed picker shows whatever channels `RSSImpl` has cached; selecting one populates the item list. Subscribing from the RSS infobar updates the list live (via `readerFeedsChanged`).
4. Click **Bookmarks**. The tree appears (Bookmarks bar / Other bookmarks / Mobile bookmarks roots, top-level open by default). Click a bookmark → it opens in a new foreground tab of the same browser window. Add or rename a bookmark in `chrome://bookmarks` — the sidebar tree updates live via `bookmarksChanged`.
5. Click **History**. Recent visits grouped by day (Today / Yesterday / weekday + date). Typing in the search box (250ms debounce) filters by title/url. Hovering a row reveals **✕** — click removes that entry from history. Visiting a new page updates the list live via `historyChanged`.
6. Click **Notes**. Navigates to `chrome://sidebar/notes`. The URL of the active tab appears in the header. Type a note and press **Save** — reopen the Notes panel on the same page and the note should be pre-populated. Click **↻** after navigating to a different page to update the URL and load that page's notes. Expand "All notes" to see a list of every note. Hover a note in that list → **✕** to delete it.

7. Open a **New Tab** (any layout). Click the gear icon. The browser sidebar should open (or expand if already visible) and navigate to `chrome://sidebar/ntp-settings`. The layout picker at the top shows the active layout card selected. Click a different layout card — the content/background sections below update immediately. Press **Save Settings**: the NTP should transition to the new layout without a reload. Open a new NTP — the saved layout and settings should be pre-applied.

> **See also:** [docs/page-notes.md](../page-notes.md) for the full Page Notes architecture, IPC contract, thread model, and known gaps.
> **See also:** [docs/sidebar.md](../sidebar.md#ntp-settings-panel) for the NTP settings end-to-end flow and Mojo IPC chain.
