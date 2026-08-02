# Page Notes

Per-URL personal notes stored locally in the browser profile. Accessible from the **Notes** button in the sidebar top pane (`chrome://sidebar/notes`). Notes persist across sessions and are private — no sync, no server.

## Build flag

Gated by `BUILDFLAG(ENABLE_PAGE_NOTES)`. Controlled by `enable_page_notes = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).
Also requires `BUILDFLAG(ENABLE_SIDEBAR)` — page notes are surfaced exclusively through the sidebar panel.

## Architecture

```
SidebarTopPane (NOTES_BUTTON)
  └─ SidebarContainerView::TopPaneButtonPressed(TYPE_NOTES)
       └─ LoadURL(kChromeUISidebarNotesURL)
            └─ SidebarDOMHandler (shared handler)
                 └─ PageNotesServiceFactory → PageNotesService
                      └─ page_notes.json  (profile directory)
```

## C++ service — `PageNotesService`

[`src/custom/browser/page_notes/page_notes_service.h`](../src/custom/browser/page_notes/page_notes_service.h)
[`src/custom/browser/page_notes/page_notes_service.cc`](../src/custom/browser/page_notes/page_notes_service.cc)

A `KeyedService` per profile. All public methods run on the UI thread; file I/O runs on a dedicated `MayBlock` sequence via `base::ThreadPool`.

| Method | Thread | Description |
|---|---|---|
| `EnsureLoaded(callback)` | UI | Posts a background read if not yet loaded; runs `callback` immediately if already loaded. Multiple callers queue until the first read completes. |
| `GetNotesForUrl(url)` | UI (post-load) | Returns all notes whose normalized URL matches `url`. |
| `GetAllNotes()` | UI (post-load) | Returns every note across all URLs. |
| `SaveNote(url, text, id)` | UI (post-load) | `id == 0` inserts (assigns next id). `id > 0` updates existing. Calls `PostPersist()`. |
| `DeleteNote(id)` | UI (post-load) | Removes by id. Calls `PostPersist()`. |
| `NormalizeUrl(url)` | Any | Strips scheme, query, fragment. Returns `"host/path"`. |

### Thread model

- `ReadNotesFromDisk` runs on the `MayBlock` sequence — this is the only site that calls `base::ReadFileToString`.
- JSON **serialization** happens on the UI thread (fast, no I/O), then the resulting string is posted to `WriteNotesToDisk` on the same `MayBlock` sequence.
- All in-memory mutations (`SaveNote`, `DeleteNote`) happen on the UI thread between the load completing and the next `PostPersist()`.

### Storage format

`{profile}/page_notes.json`:

```json
{
  "version": 1,
  "next_id": 5,
  "notes": [
    {
      "id": 1,
      "url": "example.com/some/page",
      "text": "Remember to check the API docs",
      "created": 1700000000,
      "updated": 1700000001
    }
  ]
}
```

`url` is the normalized form (scheme/query/fragment stripped). `created`/`updated` are Unix timestamps in seconds.

### URL normalization

`PageNotesService::NormalizeUrl` parses via `GURL`, returns `host + path` with trailing slashes removed and no scheme/query/fragment. Examples:

| Raw URL | Normalized |
|---|---|
| `https://example.com/page?ref=foo#anchor` | `example.com/page` |
| `https://example.com/` | `example.com` |
| `https://sub.example.com/a/b/` | `sub.example.com/a/b` |

## Factory — `PageNotesServiceFactory`

[`src/custom/browser/page_notes/page_notes_service_factory.h`](../src/custom/browser/page_notes/page_notes_service_factory.h)

Standard `BrowserContextKeyedServiceFactory`. OTR (incognito) profiles are redirected to the parent profile via `GetBrowserContextRedirectedInIncognito` — notes are visible and editable during private browsing.

Registered unconditionally in [`EnsureBrowserContextKeyedServiceFactoriesBuilt`](../src/custom/browser/custom_browser_context_keyed_service_factories.cc).

## IPC — `SidebarDOMHandler` extension

Notes messages are registered alongside the existing RSS/bookmarks/history messages in `SidebarDOMHandler::RegisterMessages`. All reads are async: the handler calls `svc->EnsureLoaded(callback)` and resolves the JS promise in the deferred `Do*` method.

### Reads — `cr.sendWithPromise(name, ...args)`

| Message | Args | Resolves with |
|---|---|---|
| `notesGetActiveUrl` | — | `string` — URL of the active tab, or `""` if the page is not http/https (via `FindBrowserWithProfile`) |
| `notesGetForUrl` | `url: string` | `PageNote[]` — all notes for that URL |
| `notesList` | — | `PageNote[]` — every note across all pages |
| `sharedNotesGetForUrl` | `url: string` | `SharedAnnotation[]` — shared annotations from the backend (empty until backend is configured) |

### Writes — `chrome.send(name, args)`

| Message | Args | Effect |
|---|---|---|
| `notesSave` | `[url, text, id]` | `id == 0` → insert; `id > 0` → update text. Fire-and-forget. |
| `notesDelete` | `[id]` | Removes the note with that id. Fire-and-forget. |
| `sharedNotesPost` | `[url, text]` | Posts annotation to shared backend. No-op until backend configured. |
| `sharedNotesDelete` | `[annotationId]` | Deletes shared annotation by UUID. No-op until backend configured. |

### Listener events — `cr.addWebUIListener(name, fn)`

| Event | Payload | Sent when |
|---|---|---|
| `notesUrlChanged` | `url: string` | Active tab navigates (`PrimaryPageChanged`) or user switches tabs (`OnTabStripModelChanged`). Empty string when the tab closes or the active page is not http/https. |

`PageNote` shape returned from reads:

```typescript
interface PageNote {
  id: number;
  url: string;      // normalized
  text: string;
  created: number;  // Unix seconds
  updated: number;
}
```

`SharedAnnotation` shape:

```typescript
interface SharedAnnotation {
  id: string;         // Server-assigned UUID
  url: string;        // Normalized host + path
  text: string;
  userName: string;   // Display name from identity provider
  timestamp: number;  // Unix seconds
}
```

## React component — `NotesPage`

[`src/custom/components/custom_sidebar/pages/NotesPage.tsx`](../src/custom/components/custom_sidebar/pages/NotesPage.tsx)

| Section | Behaviour |
|---|---|
| Header | Displays the normalized domain of the active tab. Updates automatically when the user navigates or switches tabs. **↻** button forces a manual refresh (fallback). |
| Editor | `<textarea>` pre-populated with: (1) the in-progress draft from `localStorage` if one exists and differs from the saved note, otherwise (2) the first saved note for the page. Draft is auto-saved 300ms after each keystroke. Draft is cleared on Save/Delete. |
| Save / Update / Delete | **Save** → `notesSave` (insert, `id == 0`); **Update** → `notesSave` with existing id; **Delete** → `notesDelete`. All clear the localStorage draft key. |
| Multi-note list | Shown only when a page has more than one note. Clicking a row loads it into the editor. |
| All notes | Collapsible section — fetches via `notesList` on expand. Shows `url` + truncated text + date. Hover → **✕** to delete. Includes an `<input type="search">` that filters the list client-side by URL or note text (no new IPC needed). |
| Shared annotations | Collapsible section — fetches via `sharedNotesGetForUrl` on expand. Shows author name, annotation text, date. Hover → **✕** to delete (own annotations). **Share note publicly** button posts the current editor contents via `sharedNotesPost`. Shows a "backend not configured" notice until `PageNotesBackendClient` is wired up. |

## Live URL tracking

Notes are only available on **http and https pages**. For any other scheme (`chrome://`, `file://`, `data:`, `about:`, etc.) the URL sent to JS is an empty string, which causes the React panel to show no editor and no note content. The check is applied in `NotesEligibleUrl()` (anonymous namespace in `sidebar_dom_handler.cc`) before every `FireWebUIListener("notesUrlChanged", ...)` call and before resolving `notesGetActiveUrl`.

`SidebarDOMHandler` now inherits from both `content::WebContentsObserver` and `TabStripModelObserver`. On `OnPageLoaded`, the handler:

1. Calls `chrome::FindBrowserWithProfile(profile_)` to get the owning browser.
2. Adds itself as a `TabStripModelObserver` on `browser->tab_strip_model()`.
3. Calls `Observe(active_web_contents)` to start watching the active tab.

Events:

| Trigger | Handler | Action |
|---|---|---|
| User navigates (same tab) | `PrimaryPageChanged` | Fire `notesUrlChanged` with new URL, or `""` if not http/https |
| User switches tab | `OnTabStripModelChanged` (selection changed) | Re-`Observe` new active tab, fire `notesUrlChanged` with URL or `""` if not http/https |
| Tab closes | `WebContentsDestroyed` | Fire `notesUrlChanged` with empty string |
| Browser / handler destroyed | Destructor | Calls `RemoveObserver` on `observed_tab_strip_model_`; `WebContentsObserver` self-cleans. |

The handler stores `raw_ptr<TabStripModel> observed_tab_strip_model_` and removes the observer in both `TabStripModelDestroyed` and the destructor.

## Shared annotations — `PageNotesBackendClient`

[`src/custom/browser/page_notes/page_notes_backend_client.h`](../src/custom/browser/page_notes/page_notes_backend_client.h)

HTTP client for wanderlust-api's shared annotations endpoints
(`Controllers/SharedAnnotationsController.cs`). Implemented with real
`network::SimpleURLLoader` calls, real auth, and a real production
endpoint — completed 2026-08-01.

### Backend protocol

```
GET  <kBaseUrl>?url=<encoded_normalized_url>
     → 200 [ { id, url, text, userName, timestamp } ]        (anonymous)

POST <kBaseUrl>                        Authorization: Bearer <jwt>
     Body: { "url": "...", "text": "..." }
     → 200/201 { id, url, text, userName, timestamp }

POST <kBaseUrl>/<id>/delete            Authorization: Bearer <jwt>
     → 204 No Content
```

`<kBaseUrl>` is `BUILDFLAG(CUSTOM_OMAHA_PUBLIC_URL) + "/api/sharedannotations"`
— wanderlust-api, the same backend already serving Omaha/releases/whatsnew,
not a separate "annotations service." IONOS hosting blocks the DELETE
verb, hence the `/delete` suffix (same convention as every other
wanderlust-api mutation).

### Implementation notes

- **Constructor** takes a `Profile*` and grabs `url_loader_factory_` from `profile->GetDefaultStoragePartition()->GetURLLoaderFactoryForBrowserProcess()`.
- **`GetAnnotationsForUrl`** issues a GET, parses the plain JSON array response via `base::JSONReader`, and calls back with the list. Anonymous — no auth needed for reads.
- **`PostAnnotation` / `DeleteAnnotation`** call `EnsureAuthenticated()` first (see below), then issue POST, treating any 2xx as success.
- Each `SimpleURLLoader` is kept alive by moving it into its own completion callback closure; `kMaxResponseSize = 2 MB` caps response buffering.
- All requests carry a `net::DefineNetworkTrafficAnnotation` annotation as required by Chromium's network auditing.
- **`SetCachedToken(token)`** stores a wanderlust-api bearer token that is attached as an `Authorization` header on write requests.

### Authentication — reuses cloud-sync sign-in, not Chromium's native Gaia

Rather than wiring Chromium's native `ProfileOAuth2TokenService` (which
this fork otherwise de-googles), `EnsureAuthenticated()` reuses whichever
of the browser's own already-working Google/Microsoft sign-ins
(`CloudSyncManager`, originally built for cloud bookmark sync) is
currently signed in:

1. If `cached_token_` is already set, proceed immediately.
2. Otherwise, ask `CloudSyncManagerFactory::GetForProfile(profile_)` which
   provider (if either) is signed in, and call its
   `Get{Google,Microsoft}AccessToken()` pass-through (new methods on
   `CloudSyncManager`, added alongside its existing `IsGoogleSignedIn()`/
   `GetGoogleUserInfo()` accessors) to get that provider's access token.
3. POST `{ provider, accessToken }` to wanderlust-api's
   `POST /api/auth/external-login` (`AuthController.cs`) — a new endpoint
   that verifies the token against Google's `userinfo` endpoint or
   Microsoft Graph's `/me`, finds-or-creates a wanderlust-api `User` by
   email, and mints a normal wanderlust-api JWT (`ApiResponse<AuthResponse>`,
   same shape as `/api/auth/login`).
4. Cache the returned JWT via `SetCachedToken()` and proceed.

If neither cloud-sync provider is signed in, the write is attempted
unauthenticated and the server returns 401 — there's no separate
"sign in to share" prompt to build; signing into cloud sync at all is
sufficient.

A `PageNotesBackendClient` is created once in `SidebarDOMHandler::OnPageLoaded` (passing `profile_`) and stored as `backend_client_`. It is destroyed when the handler is destroyed (panel navigates away).

`DoSharedNotesPost`/`DoSharedNotesDelete` both route their write result through `SidebarDOMHandler::OnSharedAnnotationWritten`, which fires `FireWebUIListener("notesSharedChanged")` on success — `NotesPage.tsx` listens for this event to refetch the shared list (replacing an earlier fixed-300ms-delay refetch hack).

## Draft persistence

`NotesPage` auto-saves unsaved editor content to `localStorage` using the key `notes-draft:<url>`. The draft is:

- **Written** 300ms after every keystroke (debounced via `setTimeout`).
- **Restored** on page load if it exists and differs from the persisted note — so closing the sidebar mid-edit does not lose work.
- **Cleared** on Save, Update, or Delete.

This is entirely client-side; no IPC is involved.

## Native integration

### `SidebarService::Type`

[`sidebar_service.h`](../src/custom/browser/sidebar/sidebar_service.h):

```cpp
TYPE_NOTES = 6,
```

Stored in prefs as an integer so the sidebar reopens to the last-used panel on restart.

### `SidebarTopPane` button

[`sidebar_top_pane.h/.cc`](../src/custom/browser/ui/views/frame/):

- `NOTES_BUTTON = 8` in `ButtonKind` enum.
- `notes_button_` — `SidebarTopPaneButton` positioned after RSS, before the expand/collapse and options buttons at the bottom.
- Icon: currently `IDR_HISTORY_ICON` (placeholder). Replace with a dedicated pencil/note icon when one is added to `custom_theme_resources`.
- Tooltip: `"Page Notes"` (hardcoded; add `IDS_TOOLTIP_SIDEBAR_NOTES` when localization pass is done).

### `SidebarContainerView::TopPaneButtonPressed`

```cpp
case sidebar::SidebarService::TYPE_NOTES:
  ResetWebViewIfNeeded();
  LoadURL(GURL(custom::kChromeUISidebarNotesURL));
  break;
```

## File map

| Path | Role |
|---|---|
| `src/custom/browser/page_notes/page_notes_service.h/.cc` | KeyedService — in-memory store + async JSON I/O |
| `src/custom/browser/page_notes/page_notes_service_factory.h/.cc` | BCKF — profile scoping, OTR redirect |
| `src/custom/browser/page_notes/page_notes_backend_client.h/.cc` | Real HTTP client for wanderlust-api's shared annotations endpoints, incl. the cloud-sync-token external-login exchange |
| `src/custom/browser/sync/cloud_sync_manager.h/.cc` | Gained `GetGoogleAccessToken()`/`GetMicrosoftAccessToken()` pass-throughs, reused by `PageNotesBackendClient` |
| `src/custom/browser/ui/webui/sidebar/sidebar_dom_handler.h/.cc` | 8 message handlers (5 local notes + 3 shared), live URL tracking via WebContentsObserver + TabStripModelObserver |
| `src/custom/common/webui_url_constants.h` | `kChromeUISidebarNotesURL = "chrome://sidebar/notes"` |
| `src/custom/browser/sidebar/sidebar_service.h` | `TYPE_NOTES = 6` |
| `src/custom/browser/ui/views/frame/sidebar_top_pane.h/.cc` | `NOTES_BUTTON`, `notes_button_`, layout + selection |
| `src/custom/browser/ui/views/frame/sidebar_container_view.cc` | `TYPE_NOTES` → `LoadURL` |
| `src/custom/browser/sources.gni` | Adds page_notes source files |
| `src/custom/browser/custom_browser_context_keyed_service_factories.cc` | Registers `PageNotesServiceFactory` |
| `src/custom/components/custom_sidebar/types.ts` | `'notes'` added to `SidebarRoute`; `PageNote` interface |
| `src/custom/components/custom_sidebar/App.tsx` | `notes` route detection + `<NotesPage />` render |
| `src/custom/components/custom_sidebar/pages/NotesPage.tsx` | React component — editor + all-notes list |

## Known gaps / future work

| Item | Notes |
|---|---|
| Notes icon | `IDR_HISTORY_ICON` is a placeholder. Add a pencil/note icon to `custom_theme_resources` and update `sidebar_top_pane.cc`. |
| Tooltip string | Hardcoded `u"Page Notes"`. Add `IDS_TOOLTIP_SIDEBAR_NOTES` to the GRD file when a localization pass is done. |
| Multiple notes per URL | The editor shows the first note for a page; multiple appear as a clickable list below. Future: per-note expand/edit flow. |
| Export | No export. A `notesExport` IPC could return all notes as JSON or Markdown. |
