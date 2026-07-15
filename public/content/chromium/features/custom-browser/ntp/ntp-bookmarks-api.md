# NTP Bookmarks API — Implementation Reference

Live bookmark bar data flowing from `BookmarkModel` in the browser process into the
React NTP via Mojo IPC, the renderer extension, and the browser-api TypeScript library.

---

## Architecture: five-layer stack

```
Browser process (C++)
  BookmarkModel  →  RemoteNtpServiceImpl  →  RemoteNtpTabHelper
                                                     ↓
                                              RemoteNtpRouter
                                                     ↓  (Mojo IPC)
Renderer process (C++)
                                              RemoteNtp  (mojom::RemoteNtpClient)
                                                     ↓
                                        RemoteNtpExtension
                                        window.custom.bookmarks
                                                     ↓  (JS)
TypeScript (browser-api)
                                              BookmarksAPI
                                                     ↓
React (remote_ntp)
                                              BookmarkList
```

---

## 1. Mojo interface (`remote_ntp.mojom`)

Two structs and one push method on `RemoteNtpClient`:

```mojom
// A bookmark tree node. URL bookmarks have a non-empty url and empty children.
// Folder nodes have an empty url and a children array that may itself contain
// nested folder nodes — enabling arbitrary nesting depth without depth limits.
struct NtpBookmarkEntry {
  int64 id;
  mojo_base.mojom.String16 title;
  string url;                         // empty for folder nodes
  bool is_folder;
  array<NtpBookmarkEntry> children;   // non-empty only for folder nodes
};

// A top-level bookmark folder (bookmark bar node or "Other Bookmarks").
// Its children are NtpBookmarkEntry nodes; folder-typed children carry their
// own children recursively, enabling unlimited nesting depth.
struct NtpBookmarkFolder {
  int64 id;
  mojo_base.mojom.String16 title;
  array<NtpBookmarkEntry> children;
};

interface RemoteNtpClient {
  // ...existing methods...
  BookmarksChanged(array<NtpBookmarkFolder> folders);
};
```

`NtpBookmarkEntry.children` is self-referential via `array<>` indirection — Mojo
arrays are passed by reference so there is no infinite-size issue.

`BookmarksChanged` is **push-only** — the browser pushes whenever any bookmark
changes; the renderer never requests it.

---

## 2. Browser process

### `RemoteNtpService` (base class)

**Files:** `src/custom/browser/ntp/remote_ntp_service.h/.cc`

- `Observer::OnBookmarksChanged(const vector<NtpBookmarkFolderPtr>&)` — observer hook
- `virtual GetBookmarkBarItems() const` — overridable getter; base returns `{}`
- `NotifyAboutBookmarks()` — iterates `observers_`, calls `OnBookmarksChanged`
- `NotifyAboutBookmarks()` is called from `OnURLsAvailable()`, which fires async
  after `most_visited_->Refresh()` — the same timing used for tile pushes, ensuring
  the Mojo client is already connected before the first push

### `RemoteNtpServiceImpl` (desktop implementation)

**Files:** `src/custom/browser/ntp/remote_ntp_service_impl.h/.cc`

Inherits `bookmarks::BookmarkModelObserver`. On any change to the bookmark bar it
rebuilds and pushes the folder list.

**Constructor / destructor:**
```cpp
bookmark_model_ = BookmarkModelFactory::GetForBrowserContext(profile_);
if (bookmark_model_) bookmark_model_->AddObserver(this);

// destructor:
if (bookmark_model_) bookmark_model_->RemoveObserver(this);
```

**`BuildBookmarkFolders()`** — reads two bookmark root nodes and emits folders in this order:

*Bookmark bar (`bookmark_bar_node()`)*
1. Direct URL children of the bar (bare bookmarks not in any folder) → synthetic
   folder entry using `bar->GetTitle()` — only emitted if non-empty
2. For each folder child: one `NtpBookmarkFolder` via `add_folder` (see below)

*Other Bookmarks (`other_node()`)*
3. Direct URL children of `other_node()` (not in a sub-folder) → synthetic folder
   entry using `other->GetTitle()` — only emitted if non-empty
4. For each folder child of `other_node()`: one `NtpBookmarkFolder` via `add_folder`

**`build_entry` recursive lambda** — converts any `BookmarkNode*` to an `NtpBookmarkEntryPtr` at any depth:
```cpp
std::function<NtpBookmarkEntryPtr(const BookmarkNode*)> build_entry;
build_entry = [&build_entry](const BookmarkNode* node) {
  auto entry = NtpBookmarkEntry::New();
  entry->id = node->id(); entry->title = node->GetTitle();
  entry->is_folder = node->is_folder();
  if (node->is_folder()) {
    entry->url = std::string();
    for (const auto& child : node->children())
      entry->children.push_back(build_entry(child.get()));
  } else { entry->url = node->url().spec(); }
  return entry;
};
```

**`add_folder` lambda** — builds one `NtpBookmarkFolder` from a node, calling `build_entry` for each direct child. No depth limit.

**Observer methods** that all call `NotifyAboutBookmarks()`:
- `BookmarkModelLoaded`
- `BookmarkNodeAdded`
- `BookmarkNodeRemoved`
- `BookmarkNodeChanged`
- `BookmarkNodeMoved`
- `BookmarkNodeChildrenReordered`
- `BookmarkAllUserNodesRemoved`
- `BookmarkModelBeingDeleted` — also nulls `bookmark_model_` to prevent use-after-free
- `BookmarkNodeFaviconChanged` — no-op (favicon changes don't affect the folder list)

### `RemoteNtpRouter`

**Files:** `src/custom/browser/ui/ntp/remote_ntp_router.h/.cc`

```cpp
void SendBookmarksChanged(vector<NtpBookmarkFolderPtr> folders);
// Guards on remote_ntp_client(), then calls BookmarksChanged(move(folders)).
```

### `RemoteNtpTabHelper`

**Files:** `src/custom/browser/ui/ntp/remote_ntp_tab_helper.h/.cc`

```cpp
void OnBookmarksChanged(const vector<NtpBookmarkFolderPtr>& folders) override;
// Clones each folder (move-only type), then calls remote_ntp_router_.SendBookmarksChanged().
```

---

## 3. Renderer process

### `RemoteNtp` (Mojo client + state store)

**Files:** `src/custom/renderer/ntp/remote_ntp.h/.cc`

New state:
```cpp
vector<mojom::NtpBookmarkFolderPtr> bookmark_folders_;
bool has_received_bookmarks_ = false;
```

New Mojo client override:
```cpp
void BookmarksChanged(vector<NtpBookmarkFolderPtr> folders) override {
  has_received_bookmarks_ = true;
  bookmark_folders_ = move(folders);
  if (can_run_js_in_renderframe_)
    RemoteNtpExtension::DispatchBookmarksChanged(render_frame()->GetWebFrame());
}
```

Public accessors:
- `bool AreBookmarksAvailable() const`
- `const vector<NtpBookmarkFolderPtr>& GetBookmarkFolders() const`

### `RemoteNtpExtension` (window.custom bridge)

**Files:** `src/custom/renderer/ntp/remote_ntp_extension.h/.cc`

`BookmarksBindings` gin class exposed as **`window.custom.bookmarks`**:

| JS property | C++ method | Returns |
|---|---|---|
| `bookmarksAvailable` | `AreBookmarksAvailable()` | `bool` |
| `ntpBookmarks` | `GetNtpBookmarks()` | array of folder objects |
| `onBookmarksChanged` | — | settable callback, called by dispatch script |

Dispatch script:
```js
if (window.custom?.bookmarks?.onBookmarksChanged &&
    typeof window.custom.bookmarks.onBookmarksChanged === 'function') {
  window.custom.bookmarks.onBookmarksChanged();
}
```

JS folder object shape (matches `BookmarkFolderData` in `DailyLink.ts`):
```js
{
  id: string,          // int64 converted via std::to_string
  title: string,       // std::u16string → V8 string
  children: [          // BookmarkNode — may itself contain children at any depth
    {
      id: string, title: string, url: string,  // url is "" for folder nodes
      isFolder: boolean,
      children: [ /* recursive */ ]
    },
    ...
  ]
}
```

The renderer builds the `children` array with a recursive `build_v8_entry` lambda (`std::function`) that mirrors the C++ `build_entry` pattern.

---

## 4. TypeScript — `browser-api`

**File:** `src/api/bookmarks_api.ts`

```ts
// A bookmark tree node — self-referential, matching NtpBookmarkEntry on the C++ side.
export interface BookmarkNode {
  id: string; title: string;
  url: string;          // empty for folder nodes
  isFolder: boolean;
  children: BookmarkNode[];
}

// Top-level folder (bookmark bar or "Other Bookmarks").
export interface BookmarkFolderData {
  id: string; title: string;
  children: BookmarkNode[];
}

class BookmarksAPI {
  constructor() {
    // window.custom.bookmarks sub-object
    this._handle = BrowserAPI.getInstance()._handle?.bookmarks ?? null;
    if (this._handle) this._handle.onBookmarksChanged = () => this._notify();
  }

  addObserver(observer: BookmarksChangedCallback): void {
    // Fires immediately if bookmarksAvailable === true (data already pushed)
    if (this._handle?.bookmarksAvailable) observer(this._handle.ntpBookmarks);
    this._observers.push(observer);
  }
}
```

`BookmarkEntry`, `BookmarkSubfolder`, and `BookmarkFolder` are exported as named
types from `index.ts`. `BookmarksAPI` is accessible via
`BrowserAPI.getInstance().bookmarks`.

---

## 5. React — `remote_ntp`

### `BookmarkList`

**File:** `src/components/Bookmarks/BookmarkList.tsx`

Self-contained live consumer. Parent layouts can optionally pass a `bookmarks?` prop
as a dev-mode fallback; the API takes precedence when `window.custom` is present.
Maps `BookmarkFolder.subfolders` through to `BookmarkSubfolderData` for the
`BookmarkFolder` component.

### `BookmarkFolder`

**File:** `src/components/Bookmarks/BookmarkFolder.tsx`

Renders a collapsible top-level folder section (Bootstrap accordion). Direct
children are rendered via `BookmarkNodeView`, which recurses:
- URL nodes → `<a>` link via `BookmarkLink`
- Folder nodes → nested collapsible section, indented by `depth * 8px` (capped at 4 levels of indent for readability)

There is no depth limit on the tree — the recursion bottoms out at leaf URL nodes.

### Full layout

**File:** `src/components/NewTab/NewTab.tsx`

`BookmarkList` rendered below `<StaticTiles />`, gated by `this.state.showBookmarks`.
Controlled via a **Show bookmarks** toggle in `NtpSettingsPage.tsx` (sidebar, Full
layout only) that writes `showBookmarks: boolean` into the settings JSON.

### Hub layout

**File:** `src/layouts/HubLayout.tsx`

Dedicated bookmark-first layout: a fixed glassmorphism bar across the top of the
viewport containing one pill button per top-level folder. Hovering a button opens a
floating dropdown panel (80 ms close-delay to bridge the gap between button and panel).

Within each dropdown:
- Direct URL children listed first
- Sub-folders appear as labelled sections separated by a hairline divider, with
  items indented (`pl-5`) to indicate nesting

The Hub layout responds to `showSearch`, `showTopSites`, and all wallpaper settings
via `onNtpSettingsChanged`. It is selectable from `NtpSettingsPage.tsx` alongside
the other layout flavors.

---

## Data flow (happy path)

1. NTP page loads → `RemoteNtp` constructor connects Mojo
2. `NavigationEntryCommitted` → `OnNewTabPageOpened()` → `most_visited_->Refresh()`
3. `OnURLsAvailable()` fires (async) → `NotifyAboutBookmarks()`
4. `RemoteNtpServiceImpl::GetBookmarkBarItems()` → `BuildBookmarkFolders()`
5. `RemoteNtpTabHelper::OnBookmarksChanged()` → clone → `SendBookmarksChanged()`
6. Mojo delivers `BookmarksChanged(folders)` to renderer
7. `RemoteNtp::BookmarksChanged()` stores data, dispatches JS
8. `window.custom.bookmarks.onBookmarksChanged()` called
9. `BookmarksAPI._notify()` → all observers called with `ntpBookmarks`
10. `BookmarkList` `useState` updates → React re-render

After first load, steps 4–10 repeat automatically whenever the user adds, removes,
renames, or moves a bookmark within the bar.

---

## Extending / next steps

### `getFolderChildren()` async pull method

### `getFolderChildren()` async pull method
For very large libraries, add a `GetBookmarkFolderChildren(int64 folder_id)` request
on `RemoteNtp` mojom + corresponding C++ implementation returning children on demand,
instead of pushing the entire tree on every change.

### Drag-to-reorder folders within the NTP panel
Reorder bookmark folders in the Full/Glass layout view without opening the browser's
Bookmark Manager — purely a React/state change, no C++ required.

### Favicons in Hub dropdown
Show the site favicon beside each bookmark link in the Hub layout's dropdown panel.
The `chrome://favicon2/?url=` source is already registered via `FaviconSource` in
`RemoteNtpServiceImpl`.
