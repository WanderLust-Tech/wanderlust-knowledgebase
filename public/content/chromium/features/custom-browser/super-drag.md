# Super Drag

Gated by `BUILDFLAG(ENABLE_SUPER_DRAG)`. Lets users drag selected text, links,
or images and release them anywhere in the browser window to trigger a
configurable action — open in a new tab, search in the foreground, copy text,
save a link, etc. The gesture direction (up, down, left, right, or combined)
determines which action fires.

Super drag optionally integrates with the mouse gesture motion analyzer
(`BUILDFLAG(ENABLE_MOUSE_GESTURES)`) for richer path analysis, but compiles and
operates independently when mouse gestures are disabled.

## Build / activation

| Where | What |
|---|---|
| [`custom_browser_config.gni`](../src/custom/custom_browser_config.gni) | `enable_super_drag = true` — gates source compilation |
| [`buildflags`](../src/custom/buildflags/) | Emits `BUILDFLAG(ENABLE_SUPER_DRAG)` for `#if`-gating |
| [`custom_prefs.cc`](../src/custom/browser/prefs/custom_prefs.cc) | Registers all `super_drag.*` prefs (default: enabled) |
| [`browser/sources.gni`](../src/custom/browser/sources.gni) | 8 `super_drag/` source files under `if (enable_super_drag)` |
| Settings UI | [`browser/resources/settings/sources.gni`](../src/custom/browser/resources/settings/sources.gni) — 4 `super_drag_page/` TS files under `if (enable_super_drag)` |

## Architecture

```
User begins dragging selected text / a link / an image
   │
   ▼
WebContentsViewAura (patched — content/browser/web_contents/)
   │  DragEnteredCallback  → SuperDragEntered
   │  OnDragUpdated        → SuperDragUpdated  (returns kDragOperationLink when active)
   │  GotModifiedDropData  → SuperDragDrop     (intercepted before CompleteDrop)
   │  CompleteDragExit     → SuperDragExited
   │  EndDrag              → SuperDragEnded
   │  OnMouseEvent         → OnMouseEntered    (kMousePressed / kMouseEntered)
   │
   ▼
content::WebContentsDelegate virtual methods
   │  (bridge to Browser via browser.cc / browser.h patch)
   │
   ▼
Browser::super_drag_delegate_  (std::unique_ptr<SuperDragDelegate>)
   │  Constructed in Browser::Browser() when ENABLE_SUPER_DRAG
   │
   ▼
SuperDragDelegate
   │
   ├── OnDragEntered(point, drop_data)
   │     Checks service enabled + IsURLAllowed(tab_url)
   │     Sets is_dragging_ = true
   │     Initialises MouseGestureMotionAnalyzer (#if ENABLE_MOUSE_GESTURES)
   │     Creates SuperDragBubble (if tip_enabled pref is set)
   │
   ├── OnDragUpdated(point)  →  returns true when is_dragging_
   │     Feeds point into analyzer; appends direction char to motion_list_
   │     Looks up current action; updates bubble label
   │     Returning true tells view layer to signal kDragOperationLink to OS
   │     (makes the drop accepted so GotModifiedDropDataFromDelegate fires)
   │
   ├── OnDragDrop(point)
   │     Resolves final action:
   │       1. GetActionFromString(motion_list_)
   │       2. fallback: GetGestureStringPointToPoint(start→end) if (1) is NO_ACTIONS
   │     Dispatches action (see Actions table)
   │     Closes bubble
   │
   ├── OnDragExited()   — hides bubble, keeps is_dragging_ true
   ├── OnDragEnded()    — sets is_dragging_ = false, closes bubble
   │
   └── GetGestureStringPointToPoint(location)
         Returns "u"/"d"/"l"/"r" from start_ → location delta
         Requires the delta to exceed reaction_distance (pref) to register
```

### Drop dispatch detail

`SuperDragUpdated` returning `true` tells the Aura view layer to advertise
`kDragOperationLink` to the OS, which causes the OS to treat the release as an
accepted drop. At that point `GotModifiedDropDataFromDelegate` is called with
`drop_data.has_value() == true`. The patch intercepts that path:

```
GotModifiedDropDataFromDelegate
  if (!drop_data.has_value())          ← delegate rejected drop
      SuperDragDrop(...)               ← fires before CompleteDragExit
      CompleteDragExit()
      return
  ────────────────────────────────────
  *drop_context.drop_data = ...        ← apply delegate modifications
  if (IsDragDropInProgress()
      && SuperDragIsDragging())        ← our guard (is_dragging_ still true)
      SuperDragDrop(...)
      CompleteDragExit()
      return
  ────────────────────────────────────
  CompleteDrop(...)                    ← normal renderer drop
```

`is_dragging_` is the gatekeeper: if super drag never activated (service
disabled, URL excepted, reaction distance not reached), `SuperDragIsDragging()`
returns `false` and the drop falls through to the renderer normally.

## Actions

Each gesture direction maps to a user-configurable `SuperDragService::Action`:

| Enum value | Description |
|---|---|
| `NO_ACTIONS` (0) | No-op (unassigned direction) |
| `CURRENT_TAB` (1) | Open dragged URL / search in current tab |
| `FOREGROUND_TAB` (2) | Open in new foreground tab |
| `BACKGROUND_TAB` (3) | Open in new background tab (default for cardinal directions) |
| `WINDOW` (4) | Open in new window |
| `INCOGNITO` (5) | Open in new incognito window |
| `COPY_TEXT` (101) | Copy selected text to clipboard |
| `SAVE_LINK` (102) | Save link to default location |
| `SAVE_LINK_AS` (103) | Save link with file picker |
| `SAVE_IMAGE_AS` (104) | Save image with file picker |
| `OPEN_IMAGE_IN_NEW_TAB` (105) | Open image URL in background tab |

### Default direction → action mappings

`SuperDragService::GetDefaultRelations()` returns these factory defaults.
All diagonal and reverse combinations default to `NO_ACTIONS`.

| Gesture | Action |
|---|---|
| `"u"` | `BACKGROUND_TAB` |
| `"d"` | `BACKGROUND_TAB` |
| `"l"` | `BACKGROUND_TAB` |
| `"r"` | `BACKGROUND_TAB` |
| `"ul"`, `"ur"`, `"dl"`, `"dr"` | `NO_ACTIONS` |
| `"ud"`, `"du"`, `"lr"`, `"rl"` | `NO_ACTIONS` |
| `"lu"`, `"ld"`, `"ru"`, `"rd"` | `NO_ACTIONS` |

## Preferences

| Pref key | Type | Default | Description |
|---|---|---|---|
| `super_drag.enabled` | bool | `true` | Master on/off toggle |
| `super_drag.tip_enabled` | bool | `true` | Show visual drag tip overlay |
| `super_drag.reaction_distance` | int | `25` (px) | Minimum drag distance before gesture activates |
| `super_drag.relations` | dict | (see above) | Direction → action mapping |
| `super_drag.searchengines` | dict | `{}` | Direction → search engine ID mapping |
| `super_drag.exceptions` | dict | `{}` | URL patterns exempt from super drag |

`RegisterProfilePrefs` passes `GetDefaultRelations()` as the default value for
`super_drag.relations`. Without this, the pref registers as an empty dict and no
gestures fire on first run.

## Mouse gesture integration

`SuperDragDelegate` conditionally owns a `MouseGestureMotionAnalyzer`:

```cpp
#if BUILDFLAG(ENABLE_MOUSE_GESTURES)
  std::unique_ptr<MouseGestureMotionAnalyzer> analyzer_;
#endif
```

When `ENABLE_MOUSE_GESTURES` is on, the analyzer appends a direction character
(`u`/`d`/`l`/`r`) to `motion_list_` each time the pointer crosses a direction
threshold. `GetActionFromString(motion_list_)` does an exact dict lookup, so
`"uuu"` would not match the key `"u"` — the fallback in `OnDragDrop` handles
this by calling `GetGestureStringPointToPoint` when the exact lookup returns
`NO_ACTIONS`.

When `ENABLE_MOUSE_GESTURES` is off, `GetGestureStringPointToPoint` (straight-line
start→end delta) is the only direction source.

## File map

| File | Purpose |
|---|---|
| [`browser/super_drag/super_drag_delegate.{cc,h}`](../src/custom/browser/super_drag/super_drag_delegate.cc) | Core drag lifecycle — enter, update, drop, exit, ended. Owns the motion analyzer (optional). Resolves gesture string and dispatches actions |
| [`browser/super_drag/super_drag_service.{cc,h}`](../src/custom/browser/super_drag/super_drag_service.cc) | `KeyedService` — pref access, URL exceptions, action/search-engine lookup from gesture strings. `RegisterProfilePrefs` is the authoritative pref registrar |
| [`browser/super_drag/super_drag_service_factory.{cc,h}`](../src/custom/browser/super_drag/super_drag_service_factory.cc) | `BrowserContextKeyedServiceFactory` for `SuperDragService` |
| [`browser/super_drag/super_drag_bubble.{cc,h}`](../src/custom/browser/super_drag/super_drag_bubble.cc) | Transient overlay shown during a drag to give visual feedback on the current action |
| [`browser/resources/settings/super_drag_page/`](../src/custom/browser/resources/settings/super_drag_page/) | Settings UI — main page, actions configurator, exceptions manager, reset dialog |
| [`patches/content-browser-web_contents-web_contents_view_aura.cc.patch`](../src/custom/patches/content-browser-web_contents-web_contents_view_aura.cc.patch) | Aura view-layer hooks: `DragEnteredCallback`, `OnDragUpdated`, `GotModifiedDropDataFromDelegate`, `CompleteDragExit`, `EndDrag`, `OnMouseEvent` |
| [`patches/chrome-browser-ui-browser.{cc,h}.patch`](../src/custom/patches/) | `SuperDrag*` bridge methods on `Browser`; `super_drag_delegate_` member |
| [`patches/content-public-browser-web_contents_delegate.{cc,h}.patch`](../src/custom/patches/) | Virtual `SuperDrag*` / `OnMouseEntered` / `SuperDragIsDragging` declarations on `WebContentsDelegate` |

## Adding a default action mapping

Edit `SuperDragService::GetDefaultRelations()` in
[`super_drag_service.cc`](../src/custom/browser/super_drag/super_drag_service.cc).
Keys are gesture strings (`"u"`, `"d"`, `"l"`, `"r"`, `"ud"`, etc.); values are
`Action` enum integers.

## URL exceptions

`super_drag.exceptions` is a dictionary of URL patterns. When
`SuperDragService::IsURLAllowed(url)` returns `false`, super drag is suppressed
for that page entirely. Add patterns via the settings UI or directly in the pref
dictionary.

## Debugging

The delegate emits `VLOG(1)` throughout its lifecycle. To see the output, launch
the browser with:

```
--vmodule=super_drag_delegate=1
```

or the global `--v=1` flag. Key log lines to look for:

| Log line | Meaning |
|---|---|
| `SuperDrag: OnDragEntered — active url=… text=…` | Drag recognised; service enabled; URL not excepted |
| `SuperDrag: OnDragUpdated … motion_list="u" action=3` | Gesture accumulating; action resolved each frame |
| `SuperDrag: OnDragDrop point=…` | Drop handler reached (action will fire) |
| `SuperDrag: OnDragDrop — dispatching action=4` | Final action value (4 = WINDOW, 3 = BACKGROUND_TAB, etc.) |
| `SuperDrag: OpenSafeURL — blocked (not http/https)` | URL failed scheme check in `OpenSafeURL` |

If `OnDragDrop` is never logged, the drop is not reaching the delegate — check
that `SuperDragUpdated` is returning `true` (confirm `OnDragUpdated` log shows
`action` ≠ 0) and that `SuperDragIsDragging()` is still `true` when the drop
fires.

## Known gaps

- **Mouse gesture analyzer builds up `motion_list_` as a raw path string.**
  A drag that tracks `"uuu"` won't match the pref key `"u"`. The drop handler
  falls back to `GetGestureStringPointToPoint` (straight-line direction), so
  simple gestures work, but multi-segment gestures (e.g. `"ud"` — up then down)
  will only fire if the accumulated string exactly matches a pref key.

- **No search-engine drag on non-text selections.** Dragging a link over a
  search-engine gesture slot opens the link URL rather than searching for the
  link text. `GetTemplateURLFromString` is wired in the service but the delegate
  does not yet distinguish "is this a search gesture?" from "is this a link
  navigation gesture?".
