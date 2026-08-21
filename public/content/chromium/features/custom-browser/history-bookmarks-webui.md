# History & Bookmarks Pages (chrome://history, chrome://bookmarks)

Real, functional `chrome://history` and `chrome://bookmarks` pages —
both were bare placeholder `WebUIController`s with no backend wiring
before this. Added v1.8.40 (2026-08-20), with a viewport-background
follow-up fix the same day (v1.8.41).

These are distinct from the *sidebar's* History and Bookmarks panels
(`chrome://sidebar/history`, `chrome://sidebar/bookmarks`) — same
underlying Chromium services, different handler classes and a different
(fuller) standalone page layout.

---

## chrome://history

**Handler:** `CustomHistoryHandler` (`custom/browser/ui/webui/history/custom_history_handler.{h,cc}`).

- `HistoryService`-backed search, with date-range and host-only filters.
- Batch delete.
- Live updates — the handler observes `HistoryService` and pushes
  changes to the page without a manual refresh.

| Message | Purpose |
|---|---|
| `requestHistory` | Query (search term, date range, host filter) → results |
| `removeHistoryEntries` | Batch delete by URL/timestamp |

As of v1.8.42, `removeHistoryEntries` is PIN-gated by
[Parental Controls](parental-controls.md) when that feature is enabled —
see that doc for the gate mechanics.

---

## chrome://bookmarks

**Handler:** `CustomBookmarksHandler` (`custom/browser/ui/webui/bookmarks/custom_bookmarks_handler.{h,cc}`).

- `BookmarkModel`-backed tree — folders and bookmarks, not a flat list.
- Add / rename / delete, plus full drag-and-drop reordering and
  re-parenting in the React UI (move between folders, reorder within a
  folder).

| Message | Purpose |
|---|---|
| `requestBookmarkTree` | Full folder/bookmark tree |
| `addBookmark` | Add a URL bookmark |
| `addBookmarkFolder` | Add a folder |
| `renameBookmark` | Rename a node (bookmark or folder) |
| `setBookmarkUrl` | Edit a bookmark's URL |
| `removeBookmark` | Delete a node |
| `moveBookmark` | Reorder/re-parent — drives the drag-and-drop UI |

Multiple rapid `BookmarkModel` change notifications (e.g. a drag that
touches several nodes) are collapsed into a single `bookmarksChanged`
event to the frontend, rather than firing once per node.

---

## Shared architecture

Both pages mirror `SidebarDOMHandler`'s already-proven IPC patterns —
same `WebUIMessageHandler` shape, same "query once, then push updates"
model — rather than inventing a new protocol for the standalone pages.

```
CustomHistoryUI / CustomBookmarksUI   (WebUIController, pre-existing)
    │
    └─ CustomHistoryHandler / CustomBookmarksHandler   (new)
         — HistoryService / BookmarkModel observer
         — real CRUD, not a stub
```

---

## v1.8.41 fix: background not filling the viewport

Both pages' background color was applied to the same element as the
centering `max-w-*`/`mx-auto` classes, so the margins outside the
constrained content column fell through to the unstyled white body —
visible as white bars on either side in dark mode. Fixed by splitting
into an outer full-bleed dark/light background `<div>` wrapping the
centered content, matching the pattern `custom_downloads` already used.

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/ui/webui/history/custom_history_handler.{h,cc}` | History query/delete/live-update |
| `custom/browser/ui/webui/history/custom_history_ui.{h,cc}` | `WebUIController` (pre-existing, now actually wired up) |
| `custom/browser/ui/webui/bookmarks/custom_bookmarks_handler.{h,cc}` | Bookmark tree CRUD + reordering |
| `custom/browser/ui/webui/bookmarks/custom_bookmarks_ui.{h,cc}` | `WebUIController` (pre-existing, now actually wired up) |
| `custom/components/custom_history/App.tsx` | History page UI |
| `custom/components/custom_bookmarks/App.tsx` | Bookmarks page UI (tree + drag-and-drop) |

---

## Known limitations

- No OS-level "Delete history" reauth beyond the optional Parental
  Controls PIN gate — if that feature isn't enabled, deletion is
  unrestricted, same as vanilla Chromium.
- Bookmark import/export lives in Settings, not on this page (matches
  vanilla Chromium's own split).
