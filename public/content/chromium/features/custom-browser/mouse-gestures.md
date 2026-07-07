# Mouse Gestures

Gated by `BUILDFLAG(ENABLE_MOUSE_GESTURES)`. Adds three native, extension-free
input modes that the user can rebind from the custom settings WebUI:

| Mode | Trigger | What it does |
|---|---|---|
| Stroke gesture | Hold right mouse button, drag a direction string (`u`/`d`/`l`/`r` segments), release | Maps the stroke to a `MouseGestureService::Action` (page back/forward, tab switch, fullscreen, etc.) |
| Wheel gesture | Hold right mouse button, scroll the wheel up/down | Two prefs: `kWheelGestureRightBtnWheelUp` / `kWheelGestureRightBtnWheelDown` |
| Rocker (locker) gesture | Hold one button, click the other | Two prefs: `kLockerGestureFlipBack` (right-down → left-click) / `kLockerGestureFlipForward` (left-down → right-click) |

Super Drag rides on the same buildflag — drag a link or selection inside the
viewport and direction-tag it to "open in new tab", "search", etc. without
hitting the address bar or context menu. See [Super Drag](#super-drag) below.

The implementation is intentionally native rather than extension-based so it
participates in the renderer-host input pipeline (intercepts before the
context menu fires) and the views accelerator path (so rebound actions can
fire even when the renderer is busy).

## Build / activation

| Where | What |
|---|---|
| [`custom_browser_config.gni`](../src/custom/custom_browser_config.gni#L294) | `enable_mouse_gestures = true` — gates source compilation and every patch hunk below |
| [`custom_features_buildflags.h`](../src/custom/buildflags/BUILD.gn) + [`branding_buildflags.h`](../src/custom/custom_browser_config.gni#L616) | `BUILDFLAG(ENABLE_MOUSE_GESTURES)` is emitted from both headers (custom_branding_flags + custom_features_buildflags); either include path works for `#if`-gating |
| Sources | [`browser/sources.gni`](../src/custom/browser/sources.gni#L52) groups `mouse_gesture/`, `super_drag/`, and `accelerator/` together. The Win-only overlay (`mouse_gesture_widget_delegate_view_win.{cc,h}`) sits inside an inner `if (is_win)` block. |
| Per-profile pref | `prefs::kMouseGestureEnabled` (`mouse_gesture.enabled`, default true) — runtime master switch read on every dispatched event |
| Keyed services | `MouseGestureServiceFactory`, `AcceleratorServiceFactory`, `SuperDragServiceFactory` registered in [`custom_browser_context_keyed_service_factories.cc`](../src/custom/browser/custom_browser_context_keyed_service_factories.cc) |
| Pref registration | `MouseGestureService::RegisterProfilePrefs`, `SuperDragService::RegisterProfilePrefs`, `AcceleratorService::RegisterProfilePrefs` invoked from the `chrome/browser/prefs/browser_prefs.cc` patch under the buildflag |
| settings_private | All `kMouseGesture*` / `kWheelGesture*` / `kLockerGesture*` / `kSuperDrag*` prefs whitelisted in [`prefs_util.cc.patch`](../src/custom/patches/chrome-browser-extensions-api-settings_private-prefs_util.cc.patch) so the WebUI can read/write them |

## Architecture

```
RenderWidgetHostImpl::ForwardMouseEventWithLatencyInfo
  │  (patched in content-browser-renderer_host-render_widget_host_impl.cc.patch)
  ├──► mouse_locker_gesture_dispatcher_ ──┐
  ├──► mouse_wheel_gesture_dispatcher_  ──┤  each is a unique_ptr; nullptr = uninstalled
  └──► mouse_gesture_dispatcher_        ──┘
                │
                ▼
   each handler reads PrefService, decides:
     - "I handled this event"              → consume (no context menu, no IPC to renderer)
     - "I'm midway through a stroke"        → consume + draw the trail
     - "this isn't my event"                → pass through to renderer

Browser (one per window, owns the observer list)
  └── std::vector<ChromeMouseGestureHostObserver*> mouse_gesture_observers_
        │   (added in OnActiveTabChanged, deleted in OnTabDeactivated/TabDetachedAtImpl)
        │
        └── ChromeMouseGestureHostObserver  ← WebContentsObserver per active tab
              │
              ├── on RenderViewReady / PrimaryMainDocumentElementAvailable / TitleWasSet
              │     Reset() walks plugin-page guests and reinstalls all 3 dispatchers
              │
              └── installs three dispatcher subclasses on the RWH:
                  ChromeMouseGestureHostDispatcher       ← stroke recognizer
                  ChromeMouseWheelGestureHostDispatcher  ← right-btn + wheel
                  ChromeMouseLockerGestureHostDispatcher ← rocker

BrowserView (one per window)
  ├── mouse_gesture_widget_ (Win-only)
  │   └── MouseGestureWidgetDelegateViewWin  ← transparent top-most overlay that
  │                                            draws the stroke trail and direction
  │                                            label. Created in AddedToWidget().
  │                                            Accessed via
  │                                            BrowserWindow::GetMouseGestureWidgetDelegateView().
  └── AcceleratorService::RegisterAcceleratorsInit(focus_manager)  ← in LoadAccelerators(),
                                                                      registers the
                                                                      user-rebindable
                                                                      keyboard accelerators

CustomContentBrowserClientParts::OverrideWebPreferences
  │  (registered in chrome_content_browser_client.cc → extra_parts_)
  └── forces web_prefs->context_menu_on_mouse_up = true whenever gestures are
      active, so the context menu doesn't race the stroke on Mac/Linux
      (Windows already defaults to true)
```

## Pieces

| Class / file | Role |
|---|---|
| [`MouseGestureHostDispatcher`](../src/custom/content/public/browser/mouse_gesture_host_dispatcher.h) (+ wheel/locker siblings) | Pure-virtual interface in `custom/content/public/browser/`. Three pure-virtual classes the RWH knows by reference under `ENABLE_MOUSE_GESTURES`. |
| [`ChromeMouseGestureHostDispatcher`](../src/custom/browser/mouse_gesture/chrome_mouse_gesture_host_dispatcher.cc) | Stroke recognizer. Right-down opens a stroke, right-move feeds it to the overlay's `OnMouseRightMoveAt`, right-up commits via `OnMouseRightUpAt`. If the user released without a recognized stroke and the context menu shouldn't be suppressed, this replays the cached mouse-down + mouse-up so the renderer's context menu still fires. |
| [`ChromeMouseWheelGestureHostDispatcher`](../src/custom/browser/mouse_gesture/chrome_mouse_wheel_gesture_host_dispatcher.cc) | Holds a 50 ms debounce on the wheel. While right is down, wheel deltas dispatch `kWheelGestureRightBtnWheelUp` / `kWheelGestureRightBtnWheelDown` actions through `BrowserActionDispatcher::PostAction`. Sets `executed_` so the trailing right-up consumes itself and doesn't pop the context menu. |
| [`ChromeMouseLockerGestureHostDispatcher`](../src/custom/browser/mouse_gesture/chrome_mouse_locker_gesture_host_dispatcher.cc) | Rocker. Left-down + right-down → `kLockerGestureFlipBack` action. Right-down + left-down → `kLockerGestureFlipForward`. Same `executed_` self-cancel on the trailing right-up. |
| [`ChromeMouseGestureHostObserver`](../src/custom/browser/mouse_gesture/chrome_mouse_gesture_host_observer.cc) | WebContentsObserver. On each renderer-ready signal, walks plugin guests (PDF/full-page guest) and installs the three dispatchers on whichever WebContents is the live host. |
| [`MouseGestureService`](../src/custom/browser/mouse_gesture/mouse_gesture_service.cc) | KeyedService, one per profile. Owns the `Action` enum, the default direction → action dictionary, and `ResetToDefault`. Profile-pref-backed (`mouse_gesture.*`, `wheel_gesture.*`, `locker_gesture.*`). |
| [`BrowserActionDispatcher`](../src/custom/browser/mouse_gesture/browser_action_dispatcher.cc) | The "what to actually run" side. Maps an `Action` int + a session id back to a `Browser*` and calls `chrome::ExecuteCommand` / window methods. Used by all three dispatchers and Super Drag. |
| [`MouseGestureWidgetDelegateView`](../src/custom/browser/mouse_gesture/mouse_gesture_widget_delegate_view.h) + `_win.cc` | Top-most click-through widget that paints the stroke trail, current motion bitmap, and resolved action name. Win-only today (Mac/Linux build with the flag will compile because the include + creation are gated by `BUILDFLAG(IS_WIN)`, but rendering falls back to "no visual feedback"). |
| [`MouseGestureMotionAnalyzer`](../src/custom/common/mouse_gesture_motion_analyzer.cc) | Pixel-stream → direction-segment recognizer. Filters out noise inside `kMouseGestureInvalidRadius`. Outputs the canonical `udlr` string the service looks up. |
| [`AcceleratorService`](../src/custom/browser/accelerator/accelerator_service.cc) | User-rebindable keyboard accelerators. Lives in the same source group because it shares the rebind-table pattern with the gesture service; registered as a keyed service alongside the others. |

## Pref schema

All names defined in [`custom/common/custom_pref_names.h`](../src/custom/common/custom_pref_names.h). Defaults set in
`MouseGestureService::RegisterProfilePrefs` / `SuperDragService::RegisterProfilePrefs`.

| Pref | Type | Default | Read by |
|---|---|---|---|
| `mouse_gesture.enabled` | bool | true | All three dispatchers (master switch); `CustomContentBrowserClientParts::OverrideWebPreferences` |
| `mouse_gesture.tip_enabled` | bool | true | Overlay (show direction label) |
| `mouse_gesture.tip_line_enabled` | bool | true | Overlay (draw stroke trail) |
| `mouse_gesture.tip_quality` | bool | true | Overlay (antialiased line) |
| `mouse_gesture.tip_line_color` | string `"AARRGGBB"` | `"A0FF194B"` | Overlay |
| `mouse_gesture.tip_line_weight` | int | 6 | Overlay |
| `mouse_gesture.invalid_radius` | int (px) | 50 | `MouseGestureMotionAnalyzer` — strokes shorter than this stay un-segmented |
| `mouse_gesture.relations` | dict<string, int> | see `MouseGestureService::GetDefaultRelations` | Stroke dispatcher — direction-string → `Action` lookup |
| `wheel_gesture.right_btn_wheel_up` | int (`Action`) | `SELECT_PREVIOUS_TAB` on Win, `NO_ACTIONS` on Mac | Wheel dispatcher |
| `wheel_gesture.right_btn_wheel_down` | int (`Action`) | `SELECT_NEXT_TAB` on Win, `NO_ACTIONS` on Mac | Wheel dispatcher |
| `locker_gesture.flip_back` | int (`Action`) | `NO_ACTIONS` | Locker dispatcher |
| `locker_gesture.flip_forward` | int (`Action`) | `NO_ACTIONS` | Locker dispatcher |
| `super_drag.enabled` | bool | true | `SuperDragDelegate` |
| `super_drag.tip_enabled` | bool | true | Super-drag bubble |
| `super_drag.reaction_distance` | int (px) | tunable | `SuperDragDelegate` |
| `super_drag.relations` | dict | see service defaults | Maps direction strings to drag actions (open-in-new-tab, search, etc.) |
| `super_drag.search_engines` | dict | user-managed | Per-direction search engine override |
| `super_drag.exceptions` | dict | empty | Per-origin opt-out |

## The `Action` enum

`MouseGestureService::Action` is the shared vocabulary every dispatcher
talks in. The enum is **pref-stable** — integer values are persisted in
`mouse_gesture.relations` and the wheel/locker prefs, so adding actions
appends, never inserts:

| Range | Meaning |
|---|---|
| 0 | `NO_ACTIONS` (always allowed, default for "do nothing") |
| 1–15 | Page actions: scroll up/down/home/end, zoom in/default/out, back, forward, reload, reload-all-tabs, stop, home, URL hierarchy up, reload-clearing-cache |
| 101–120 | Tab actions: select prev/next/left-end/right-end, close (and close-and-select-left/right), close-all/others, open new tab, open home tab, duplicate, restore, pin, mute, move prev/next |
| 201–206 | Window actions: new window, secret/incognito, close, minimize, maximize, fullscreen |
| 301–302 | Bookmarks / view source |
| 401–405 | UI toggles: bookmark bar, find bar, inspect element, dev tools, sidebar |
| 501 | Focus address bar |
| 901–907 | Open downloads / task manager / history / bookmark manager / options / extensions / net-internals |

The `// CAUTION: do not edit this section for prefs` comment at the top
of the enum is a load-bearing comment — renumbering breaks every saved
profile.

## Event flow — stroke gesture

1. User right-presses inside the viewport. The mouse-down hits
   `RenderWidgetHostImpl::ForwardMouseEventWithLatencyInfo`, which (under
   the buildflag) offers it to the locker dispatcher (no — only one
   button is down), then the wheel dispatcher (it records `mouse_rdown_ =
   true` and returns false to keep the event flowing), then the stroke
   dispatcher.
2. The stroke dispatcher resolves the per-tab `BrowserView` (via
   `chrome::FindBrowserWithTab` → `BrowserWindow::GetMouseGestureWidgetDelegateView`),
   confirms `MouseGestureService::IsEnabled()`, and calls
   `view->OnMouseRightDownAt(x, y)`. The overlay clears its bitmaps,
   starts a new stroke, and returns `prevent_default = true` so the
   event consumes here.
3. Each mouse-move during the drag goes through
   `ChromeMouseGestureHostDispatcher::HandleMouseEvent` → `OnMouseRightMoveAt`,
   which feeds the `MouseGestureMotionAnalyzer` and repaints the trail
   bitmap.
4. On right-up, `OnMouseRightUpAt` finalizes the analyzer to a `udlr`
   string, looks it up in `mouse_gesture.relations`, and asks
   `BrowserActionDispatcher` to run the resolved `Action`. If no stroke
   was recognized and `should_fire_right_click` is still true, the
   dispatcher replays the buffered mouse-down + mouse-up to the renderer
   so the user gets a normal context menu.
5. Because `web_prefs->context_menu_on_mouse_up` is forced true by
   `CustomContentBrowserClientParts::OverrideWebPreferences`, the renderer
   doesn't pop a context menu at step 1 — only the replay at step 4 can
   produce one. Without that pref the menu would race the stroke on
   Mac/Linux (Windows defaults to mouse-up regardless).

## Event flow — wheel gesture

1. Right-down → wheel dispatcher's `mouse_rdown_ = true`.
2. Wheel event → if `kRightButtonDown` modifier is set and >50 ms have
   passed since the last wheel, dispatch
   `kWheelGestureRightBtnWheelUp/Down` action via
   `BrowserActionDispatcher::PostAction`, set `executed_ = true`, and
   return `true` to consume.
3. Right-up → if `executed_`, the wheel dispatcher consumes the right-up
   itself (returns `true`), clears `executed_` and `mouse_rdown_`, and
   no context menu fires.

## Event flow — rocker gesture

1. While left is down, right-down triggers `kLockerGestureFlipForward`.
   While right is down, left-down triggers `kLockerGestureFlipBack`.
2. The trailing right-up is consumed the same way the wheel dispatcher
   consumes it (`executed_` + `mouse_rdown_` interlock).

## Per-tab observer lifecycle

The `Browser` owns a `std::vector<ChromeMouseGestureHostObserver*>` — one
per tab that has ever been active. Maintenance lives in three patches to
`chrome/browser/ui/browser.cc`:

| Hook | What it does |
|---|---|
| `OnActiveTabChanged(old, new)` | If `new_contents` has no observer in the vector, push a new `ChromeMouseGestureHostObserver(new_contents)`. The observer's ctor calls `Reset()`, which walks plugin guests and `rwh->SetMouseGestureHostDispatcher(...)` × 3. |
| `OnTabDeactivated(old)` | Delete the observer for `old`. Its `WebContentsObserver` base unregisters; the three dispatchers (`unique_ptr` on the RWH) outlive briefly but get replaced atomically on next activation. |
| `TabDetachedAtImpl(contents, was_active)` | Same cleanup for tab detach/close. |

Dispatchers don't hold a back-pointer to the observer — they receive a
`WebContents*` and resolve the per-call `Browser*` via
`chrome::FindBrowserWithTab(web_contents_)`. So observer deletion is
**not** a use-after-free even though the dispatcher unique_ptrs stay
installed momentarily on the RWH.

## Super Drag

Same buildflag, parallel pipeline. Drag entries flow through patched
`WebContentsDelegate` virtuals:

| `WebContentsDelegate` virtual | Implemented by `Browser` (forwards to `super_drag_delegate_`) |
|---|---|
| `SuperDragIsDragging()` | `SuperDragDelegate::is_dragging()` |
| `SuperDragEntered(point, drop_data)` | Records origin + drop_data, starts the bubble |
| `SuperDragUpdated(point)` | Updates the bubble's direction indicator via `MouseGestureMotionAnalyzer` (same recognizer the stroke gesture uses) |
| `SuperDragDrop(point)` | Resolves direction → action from `super_drag.relations`, runs it |
| `SuperDragExited()` / `SuperDragEnded()` | Tear down bubble + drag state |

The hookup point is
[`content_browser_web_contents_view_aura.cc.patch`](../src/custom/patches/content-browser-web_contents-web_contents_view_aura.cc.patch),
which calls `web_contents_->GetDelegate()->SuperDrag*` from the Aura
drag-and-drop handlers.

`super_drag_delegate_` is owned by `Browser` and constructed in the
`Browser` ctor alongside `BossKeyServiceFactory::GetForProfile(profile_)`
under the same buildflag. Without that init the `SuperDrag*` overrides
would null-deref on the first drag.

## WebUI customization

| Surface | Location |
|---|---|
| React settings page (active UI) | [`MouseGesturePage.tsx`](../src/custom/components/custom_settings/components/MouseGesturePage.tsx) + [`GestureCaptureCanvas.tsx`](../src/custom/components/custom_settings/components/GestureCaptureCanvas.tsx) (right-drag stroke recorder), [`SuperDragPage.tsx`](../src/custom/components/custom_settings/components/SuperDragPage.tsx) |
| Polymer fallback (still built) | [`browser/resources/settings/mouse_gesture_page/`](../src/custom/browser/resources/settings/mouse_gesture_page/) + `super_drag_page/`, gated by `enable_mouse_gestures` in [`sources.gni`](../src/custom/browser/resources/settings/sources.gni) |
| C++ ↔ WebUI handler | [`custom_settings_handler.cc`](../src/custom/browser/ui/webui/settings/custom_settings_handler.cc) — `customMouseGestureRelationsReset` calls `MouseGestureService::ResetToDefault()` |
| Pref binding | Direct via `chrome.settingsPrivate` (allowlist in [`prefs_util.cc.patch`](../src/custom/patches/chrome-browser-extensions-api-settings_private-prefs_util.cc.patch)) |

The React `GestureCaptureCanvas` records a right-drag inside the settings
page itself, runs it through the same `MouseGestureMotionAnalyzer`
contract (TS-side reimplementation), and writes the resolved direction
string back to `mouse_gesture.relations`. The user never types `"udlr"`
by hand.

## Known limitations

- **Win-only visual feedback.** `MouseGestureWidgetDelegateViewWin` is the only concrete subclass. On other platforms, gestures still execute (the dispatchers feed `BrowserActionDispatcher` directly), but no trail or label paints. A Mac/Linux delegate view would slot in via the `MouseGestureWidgetDelegateView` interface.
- **Context menu deferral relies on `web_prefs->context_menu_on_mouse_up`.** Set in `CustomContentBrowserClientParts::OverrideWebPreferences`. If `CustomContentBrowserClientParts` ever stops being registered in `extra_parts_`, right-click gestures regress on Mac/Linux (Windows still works because Chromium defaults the field to true there).
- **The `// CAUTION: do not edit` enum.** Renumbering `MouseGestureService::Action` invalidates every user's saved gesture map. Always append.
- **One observer per active tab, not per WebContents.** Background tabs have no gesture observer installed. This is by design — only the active tab routes input — but means the gesture cursor effect won't appear during a tab-drag preview.
