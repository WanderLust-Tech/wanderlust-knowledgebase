# Sidebar

Gated by `BUILDFLAG(ENABLE_SIDEBAR)`. A right-edge panel that hosts a stack
of utility surfaces — bookmarks, history, RSS feeds — each backed by its
own route on the [`chrome://sidebar` WebUI](custom-webui/sidebar.md). This
document covers the C++ / Views side: the keyed service, the per-window
container, the dock/undock subsystem, and the collapsed/expanded state
machine. The React app, route bundle, and DOM-handler IPCs are documented
separately at [`docs/custom-webui/sidebar.md`](custom-webui/sidebar.md).

## Build / activation

| Where | What |
|---|---|
| [`custom_browser_config.gni`](../src/custom/custom_browser_config.gni#L289) | `enable_sidebar = true` — gates source compilation, the BrowserView wiring, the WebUI bundle, and the integration patches |
| [`branding_buildflags.h`](../src/custom/custom_browser_config.gni#L586-L590) | `BUILDFLAG(ENABLE_SIDEBAR)` macro emitted for `#if`-gating |
| Sources | [`browser/sidebar/sources.gni`](../src/custom/browser/sidebar/sources.gni) (service layer) + [`browser/ui/sources.gni`](../src/custom/browser/ui/sources.gni#L83) `if (enable_sidebar)` block (Views layer) |
| Keyed service | `SidebarService` — one per profile, lazy via `SidebarServiceFactory::GetForProfile(profile)`. Wired in [`custom_browser_context_keyed_service_factories.cc`](../src/custom/browser/custom_browser_context_keyed_service_factories.cc). |
| Pref registration | `SidebarService::RegisterProfilePrefs` is called from the patched `chrome/browser/prefs/browser_prefs.cc` under the buildflag gate. |

## Architecture

```
SidebarService (per-profile keyed service, no Views, no Browser)
  │  Stores: enabled, position (left/right), type (bookmarks/history/rss),
  │          width, is_undocked, is_collapsed, undocked_width, click prefs
  │  Subscribers register their own PrefChangeRegistrar against the
  │  profile's PrefService — there is intentionally no observer pattern.
  │
  ├──► SidebarContainerView                         (per-BrowserView, owned by BrowserView)
  │      Lives inside the browser window, anchored to the left or right
  │      edge of the content area. Hosts:
  │        ├── SidebarTopPane (the pane-button strip — bookmarks /
  │        │     history / rss / notes / ntp-settings /
  │        │     expand-collapse / settings)
  │        ├── views::WebView lazily created by ResetWebViewIfNeeded() —
  │        │     loads chrome://sidebar/<pane> on first pane click
  │        └── views::ResizeArea on the inner edge for drag-resize
  │      Visibility flows from SidebarService::IsUndocked() — false-> visible,
  │      true -> SetVisible(false) and BrowserViewLayout skips us.
  │      Width is read by BrowserViewLayout (lines ~1158-1159 of browser_view_layout.cc):
  │      `sidebar_width = sidebar_container_->GetVisible() ? width() : 0`.
  │
  └──► UndockedSidebarWidget                        (per-profile singleton, NOT a Browser)
         Exists only while is_undocked == true. Frameless top-level Widget
         snapped to the right edge of the primary display, hosting an
         inner SidebarContainerView with browser_view = nullptr.
         Lifetime driven by per-window SidebarContainerView observers
         calling Show/CloseForProfile on pref flips; idempotent so N
         browser windows produce exactly one widget.
```

`SidebarContainerView` is reused in both docked and undocked contexts. The
docked instance is a child of the upstream `BrowserView`; the undocked
instance is a child of `UndockedSidebarWidget` and gets `browser_view_ ==
nullptr` in its ctor. Code paths in the container that need a `Browser*`
(e.g. settings-button → `chrome::ExecuteCommand`) fall back to
`chrome::FindLastActiveWithProfile(profile_)` when `browser_view_` is null.

## Pieces

| Class / file | Role |
|---|---|
| [`SidebarService`](../src/custom/browser/sidebar/sidebar_service.cc) | Per-profile `KeyedService`. Pref-backed state for everything sidebar-shaped: enabled flag, position, current pane type, width, dock state, collapsed state, click dispositions. Also observes `HistoryService` for the history pane. No observer pattern — callers wire their own `PrefChangeRegistrar` to whichever prefs they care about. |
| [`SidebarServiceFactory`](../src/custom/browser/sidebar/sidebar_service_factory.cc) | Standard `BrowserContextKeyedServiceFactory`. `GetForProfile(profile)` returns the (lazy) singleton. |
| [`SidebarContainerView`](../src/custom/browser/ui/views/frame/sidebar_container_view.cc) | The per-window (or per-undocked-widget) view. Lays out the pane strip + WebView + resize area. Owns the `views::WebView` lazily (created on first pane button press to avoid spinning up a render process for users who never click the sidebar). Implements `views::ContextMenuController` + `ui::SimpleMenuModel::Delegate` for the right-click menu. Also provides `ShowPanel(Type)` to programmatically open a panel (used by `RemoteNtpTabHelper` to open the NTP settings panel from the NTP page), and the static `FindForBrowserView(BrowserView*)` registry that maps a `BrowserView` to its docked `SidebarContainerView`. |
| [`SidebarTopPane`](../src/custom/browser/ui/views/frame/sidebar_top_pane.cc) | The pane-button strip — bookmarks / history / rss / notes / ntp-settings / expand-collapse / settings. Delegates content-pane clicks to `SidebarContainerView` via `SidebarTopPaneDelegate::TopPaneButtonPressed(Type)`. |
| [`SidebarTopPaneButton`](../src/custom/browser/ui/views/frame/sidebar_top_pane.cc) | Themed `views::ImageButton` subclass with a selected/hover state. |
| [`UndockedSidebarWidget`](../src/custom/browser/ui/views/sidebar/undocked_sidebar_widget.cc) | Per-profile floating Widget. PanelView-cribbed init params (`TYPE_WINDOW`, `remove_standard_frame=true`, `z_order=kFloatingWindow`, `NATIVE_WIDGET_OWNS_WIDGET` so `Widget::Close` async-destroys the Widget+view tree and our dtor runs to release the keep-alives — `CLIENT_OWNS_WIDGET` would require `unique_ptr<Widget>` plumbing we haven't wired); Windows-specific `WS_EX_TOOLWINDOW` so it stays out of the taskbar / Alt-Tab. Hosts a `SidebarContainerView(nullptr, profile)`. Owns the right-edge bounds math; observes `kSidebarIsCollapsed` (profile pref) to resize and `kBackgroundModeEnabled` (local_state pref) to (de)activate the keep-alives. |
| [`SidebarWebContentsDelegate`](../src/custom/browser/sidebar/sidebar_web_contents_delegate.cc) | `WebContentsDelegate` for the sidebar's `WebContents`. Handles `OpenURLFromTab` (forwards to active browser as a new tab), keyboard event routing, and zoom. |

## State model — the four prefs

The sidebar's behavior is described by a handful of bools/ints in
`PrefService`. There is no in-memory mirror of state — `SidebarService` is
a thin accessor layer over `prefs_->GetBoolean(...)`. Every place that
reads state goes through the service; every place that mutates calls the
matching `Set...` setter, which writes through to the pref.

| Pref | Type | Default | Read by |
|---|---|---|---|
| `sidebar.enabled` | bool | true | Master toggle; `SidebarContainerView::VisibilityChanged` releases the WebView when this goes false |
| `sidebar.position` | int (`Position`) | `POSITION_RIGHT` | `SidebarContainerView::Layout` (which edge to anchor pane vs WebView) |
| `sidebar.width` | int | `kSidebarDefaultMinWidth` (443) | `SidebarContainerView::UpdatePrefs` when *docked* and not collapsed |
| `sidebar.type` | int (`Type`) | `TYPE_BOOKMARKS` | Which pane to show — drives the URL loaded into the WebView |
| `sidebar.is_undocked` | bool | false | `SidebarContainerView::OnUndockedPrefChanged` hides/shows itself; spawns/closes `UndockedSidebarWidget` |
| `sidebar.is_collapsed` | bool | true | Width source: `kPaneWidth` when true, `sidebar.width` (or `sidebar.undocked_width`) when false |
| `sidebar.undocked_width` | int | `kSidebarDefaultWidth` | `UndockedSidebarWidget::UpdateBounds` width when expanded + undocked |
| `sidebar.undocked_edge` | int (`UndockedEdge`) | `EDGE_RIGHT` | `UndockedSidebarWidget::UpdateBounds` — which screen edge to anchor against. Updated by `OnDragSettled` when the user drops the widget near a screen edge |
| `sidebar.undocked_auto_hide` | bool | true | `UndockedSidebarWidget::OnAutoHideTick` — when true the widget shrinks to a 4px peek strip after the delay |
| `sidebar.undocked_auto_hide_delay_ms` | int | 5000 | `UndockedSidebarWidget::OnAutoHideTick` — how long the cursor must stay off the widget before it hides |
| `sidebar.click_disposition` / `click_type` | int | — | Click-handling behavior (single/double-click; foreground/background tab) |
| `sidebar.exclusive_folder_open`, etc. | bool | — | Bookmark-pane-specific behavior overrides |

Defaults chosen so a fresh profile launches the browser with the docked
sidebar collapsed to its pane-button handle — the user sees the small
strip and discovers content by clicking a pane button.

## The state machine

Two orthogonal axes — docked/undocked × collapsed/expanded — give four
states:

| State | Where it lives | Width | What's shown |
|---|---|---|---|
| Docked + collapsed *(default)* | In every `BrowserView` | `kPaneWidth` (35) | Pane-button strip only — `web_view_` and `resize_area_` are `SetVisible(false)` |
| Docked + expanded | In every `BrowserView` | `service->GetWidth()` clamped to `[kMinWidth, kMaxWidth]` | Pane strip + WebView + resize handle |
| Undocked + collapsed | `UndockedSidebarWidget` floating window | `kPaneHandleWidth` (60) | Pane-button strip — the floating window is anchored to the persisted screen edge, 80% of work-area height, vertically centered |
| Undocked + expanded | `UndockedSidebarWidget` floating window | `service->GetUndockedWidth()` (default 320) | Pane strip + WebView |
| Undocked + peeking *(runtime-only)* | `UndockedSidebarWidget` floating window | `kPeekStripWidth` (4) | A 4-pixel strip inset by `kPeekEdgePad` (4) from the snapped work-area edge. Triggered after 5s idle (per `kSidebarUndockedAutoHideDelayMs`); reveals to the previous collapsed/expanded state when the cursor enters the strip |

Transitions:

- **Collapse / expand** is triggered by:
  - Clicking the expand/collapse button in `SidebarTopPane` (any state)
  - Clicking any pane button (bookmarks/history/rss) while collapsed — auto-expands and selects that pane
  - Right-click → "Expand" / "Collapse" in the context menu
- **Dock / undock** is triggered by:
  - Right-click → "Undock Sidebar" / "Dock Sidebar" in the context menu

All transitions go through the pref. The pref-change observer in each
`SidebarContainerView` re-reads state from the service, updates its
`width_` field, calls `BrowserView::DeprecatedLayoutImmediately()`, and
(for docked containers only) spawns or closes the `UndockedSidebarWidget`.

## Lifecycle

1. **Service construction.** `SidebarServiceFactory::GetForProfile()` lazily constructs `SidebarService` on first access. Constructor opens the four pref members (`width_`, `enabled_`, `position_`, `type_int_`) and registers a `HistoryServiceObserver`. No views are touched.
2. **Per-window container construction.** `BrowserView` ctor at [browser_view.cc:1042](../src/chrome/browser/ui/views/frame/browser_view.cc#L1042) creates a `SidebarContainerView`, calls `Init()`, then `SetVisible(!service->IsUndocked())` (so the docked surface stays hidden if the user previously undocked), then `InitViews()`.
3. **`Init()`** subscribes the container's `PrefChangeRegistrar` to `kSidebarIsCollapsed` and `kSidebarIsUndocked`, then calls `UpdatePrefs()` (which caches `is_collapsed_`, `is_undocked_`, `selected_type_`, `position_`, and the resolved `width_`). It registers `this` as the `ContextMenuController` for the view. If the persisted pref already says `is_undocked == true`, it calls `UndockedSidebarWidget::ShowForProfile(profile_)` — this is how a "browser launched with sidebar undocked" recovers the floating widget.
4. **`InitViews()`** creates the `resize_area_` and `pane_view_` and adds them as child views. `web_view_` is *not* created here — it's lazily constructed in `ResetWebViewIfNeeded()` on first pane button click. This avoids spinning up a render process for users who never open the sidebar.
5. **First pane button click.** `SidebarTopPane` fires `TopPaneButtonPressed(type)` on the delegate (the container). The container: (a) calls `ResetWebViewIfNeeded()` to lazily create the `views::WebView`, (b) `LoadURL(chrome://sidebar/<route>)`, (c) records the type via `service->SetType()`, (d) if collapsed, flips `service->SetCollapsed(false)`. The pref-change observer fires, `UpdatePrefs()` widens `width_` to the saved value, `BrowserView` relayouts.
6. **Right-click menu.** `ShowContextMenuForViewImpl` builds a fresh `SimpleMenuModel` with two items — "Undock/Dock Sidebar" and "Expand/Collapse". The labels are chosen based on current state.
7. **Dock → undock.** User picks "Undock Sidebar". `SetUndocked(true)` writes the pref. **Every** `SidebarContainerView` observing the pref runs `OnUndockedPrefChanged`, but only the **docked-side** containers (those with `browser_view_ != nullptr`) take action — both the visibility flip and the widget-lifecycle call are gated on `browser_view_`:
   - `SetVisible(false)` on themselves → `BrowserViewLayout` skips them on the next pass.
   - Call `UndockedSidebarWidget::ShowForProfile(profile_)`. The first call wins; subsequent calls are no-ops because the static map already has an entry.
8. **`UndockedSidebarWidget::ShowForProfile`** creates the widget, sets `FillLayout`, runs `Widget::Init` with right-edge bounds, applies `WS_EX_TOOLWINDOW`, then constructs a `SidebarContainerView(nullptr, profile_)` as its single child, runs its `Init()`/`InitViews()`, and finally `ShowInactive()`.
9. **Undock → dock.** User picks "Dock Sidebar". `SetUndocked(false)` writes the pref. Docked-side containers `SetVisible(true)` and call `UndockedSidebarWidget::CloseForProfile(profile_)` which removes the static map entry and calls `Widget::Close()`. The widget destroys itself and the inner container.
   - **Edge case — no browser window open:** If the user docks while all browser windows are closed (the process is kept alive by background-mode keep-alives), there are no docked-side `SidebarContainerView` instances to handle the pref change. In this state `OnUndockedPrefChanged` on the undocked-side container detects that `is_undocked_` is flipping to `false` and `chrome::FindLastActiveWithProfile` returns null. It calls `chrome::NewEmptyWindow(profile_)` first (so the new docked sidebar has a `BrowserView` to live in), then calls `UndockedSidebarWidget::CloseForProfile(profile_)` to tear down the floating widget. Without this, the floating widget would stay visible and the new browser window would initialise a second, independent docked sidebar — leaving the user with both simultaneously.

### The `browser_view_ == nullptr` rule

The inner `SidebarContainerView` hosted inside `UndockedSidebarWidget` is constructed with `browser_view = nullptr`. **It is the visible sidebar in undocked mode** — it must never hide itself or drive the widget's lifecycle. `OnUndockedPrefChanged` enforces this by gating *both* the `SetVisible(!is_undocked_)` call AND the `Show/CloseForProfile` calls behind `if (browser_view_)`. The no-browser-window edge case above is the one exception: when `browser_view_ == nullptr` AND `is_undocked_` flips to `false`, the undocked container must act to close itself since there are no docked containers to do so. If the gate is missed entirely, the symptom is:

- User undocks → docked containers hide → the undocked widget shows
- Inside it, the inner container *also* hides itself because `is_undocked_ = true`
- The widget paints only its bare background — looks like the sidebar is empty.

This was a real bug during development. The fix is in `OnUndockedPrefChanged`; if the symptom recurs (undocked sidebar shows only a solid colored rectangle with no pane buttons), look there first.

## Per-profile vs per-window

| Concern | Scope |
|---|---|
| `SidebarService` and all prefs | Per-profile (per-`Profile`). Two browser windows on the same profile share state. |
| `SidebarContainerView` *inside a `BrowserView`* | Per-`BrowserView`. Each browser window owns its own instance. |
| `SidebarContainerView` *inside `UndockedSidebarWidget`* | Per-profile (one, shared). The widget itself is per-profile. |
| `UndockedSidebarWidget` | Per-profile singleton. Static `std::map<Profile*, UndockedSidebarWidget*>` keyed by original (non-OTR) profile. |

When two browser windows are open on the same profile and the user undocks
from one, the other window's docked sidebar also disappears — both
containers observe the same pref. The undocked widget is shared.

## Undocked widget geometry, drag/snap, and auto-hide

The undocked widget is sized like Naver Whale's floating sidebar — a slim
strip on one screen edge, not a full-height panel. It's draggable, snaps to
either edge, and auto-hides to a thin peek strip after inactivity.

### Geometry

Computed in [`UndockedSidebarWidget::UpdateBounds`](../src/custom/browser/ui/views/sidebar/undocked_sidebar_widget.cc):

| Dimension | Collapsed | Expanded |
|---|---|---|
| Width | `kPaneHandleWidth` (60) | `service->GetUndockedWidth()` clamped to ≥ `kPaneHandleWidth + 1`, default 320 |
| Height | 80% of work-area height (`kHeightFraction = 0.80f`) | same |
| Y | Centered vertically in the work area | same |
| X | `work_area.x() + kEdgeMargin` (left) or `work_area.right() - width - kEdgeMargin` (right) | same |

The display chosen on init is always primary. Subsequent calls to
`UpdateBounds` use `Screen::GetDisplayMatching(window_bounds)` against the
widget's current screen-space rect, so after a drag onto a secondary
monitor the snap math stays on that monitor instead of teleporting the
widget back to the primary. `ApplyPeekState` uses the same matching helper
for the same reason.

### Drag, manual move handling, and edge snap

The widget is frameless (`remove_standard_frame=true`) but we do **not**
return `HTCAPTION` from `NonClientHitTest`. `UndockedSidebarFrameView::NonClientHitTest`
always returns `HTCLIENT` (or `HTNOWHERE` outside the local bounds).
Every mouse event reaches the View tree like a normal in-client click.

**Why no HTCAPTION:** the OS-driven path (`WM_NCLBUTTONDOWN` move-loop
for left-button drag, `WM_NCRBUTTONDOWN` system-menu for right-button)
juggles mouse capture internally on Windows. Going to manual drag
keeps capture under aura's control end-to-end and lets the view tree
see right-clicks for the context menu.

> **Companion fix:** even with HTCAPTION removed, right-clicking the
> sidebar still tripped `DCHECK(!HasCapture())` in
> [`HWNDMessageHandler::SetCapture`](../src/ui/views/win/hwnd_message_handler.cc).
> Root cause is upstream / Windows-level: `WM_RBUTTONDOWN` automatically
> captures the HWND for the duration of the message, and when our view
> tree shows the context menu and the Widget then calls `SetCapture()`,
> the DCHECK fires on a perfectly fine no-op redundant capture. The
> upstream comment right above the DCHECK acknowledges this and
> suggests relaxing it. We dropped the DCHECK entirely in
> `hwnd_message_handler.cc` — `::SetCapture(hwnd)` is idempotent and
> already the only operation in the function. Release builds had the
> DCHECK compiled out and never had this crash.

**Manual drag** is implemented directly on the `UndockedSidebarWidget`
view via `OnMousePressed` / `OnMouseDragged` / `OnMouseReleased`:

| Step | Behavior |
|---|---|
| `OnMousePressed(left)` | If the hit View is a `views::Button` (a pane-strip icon), return false so the button handles the click. Otherwise capture `drag_start_cursor_ = Screen::GetCursorScreenPoint()` and `drag_start_origin_ = window->GetWindowBoundsInScreen().origin()`, set `is_dragging_ = true`, return true. |
| `OnMousePressed(right)` | Always return false. The right-click bubbles to `SidebarContainerView`'s `ContextMenuController`, which shows the dock/undock + collapse/expand menu. |
| `OnMouseDragged` | Compute `Screen::GetCursorScreenPoint() - drag_start_cursor_` and add to `drag_start_origin_`. `SetBounds` the widget to the new origin (preserving size). Wrap in `ignoring_bounds_changes_` so `OnWidgetBoundsChanged` doesn't re-enter. |
| `OnMouseReleased` | Clear `is_dragging_` and call `OnDragSettled` directly to run the snap math. |

> **Why absolute screen coordinates, not `event.root_location()`:** the
> natural-looking choice — using `event.root_location()` — produces
> jittery drags. `root_location()` is relative to *this widget's root
> view*, so once we `SetBounds` the widget to its new position, the next
> mouse-move event reports the cursor in a shifted reference frame. The
> delta math then races itself: each frame's `SetBounds` shifts the
> origin we're measuring from. `Screen::GetCursorScreenPoint()` reads
> the OS-level cursor in absolute screen space, which doesn't move when
> we move the widget.

Because all drag movement goes through `SetBounds` from our own view
methods, the capture state stays under aura's control: Widget's
standard mouse-event flow does its own `SetCapture` on `OnMousePressed`
when we return true, and `ReleaseCapture` on `OnMouseReleased` — both
through aura, both tracked. No invisible OS-level captures linger.

**Snap (drag-end).** `OnDragSettled`:

1. Clears `is_dragging_` so subsequent pref handlers run normally
2. Looks up the display containing the widget's center (multi-monitor)
3. Measures `dist_left` and `dist_right` against that display's work-area edges
4. If the nearer edge is within `kSnapDistance` (80px), updates the
   `UndockedEdge` pref and calls `UpdateBounds()` to snap
5. Otherwise leaves the widget where the user dropped it (the persisted
   edge pref is unchanged, so next launch still respects it)

Because `SidebarContainerView::Layout` derives its direction from
`service->GetUndockedEdge()` when `browser_view_ == nullptr`, snapping
to the opposite edge automatically flips the inner layout — pane buttons
move to the snapped edge, WebContents flips to the screen interior. The
outer widget bounds don't change shape, just position; the inner
container relayouts when the `kSidebarUndockedEdge` pref change fires.

`ignoring_bounds_changes_` is set around our own `SetBounds` calls (snap
and auto-hide) so the resulting `OnWidgetBoundsChanged` is not
re-interpreted as another user drag.

### The `is_dragging_` gate

The `is_dragging_` flag is set in `OnMousePressed` (start of manual
drag) and cleared at the top of `OnDragSettled` (before the snap-driven
`UpdateBounds`). While set, two callbacks change behavior:

- **`OnCollapsedPrefChanged`** — returns early. If something else (a
  context-menu collapse/expand, a settings toggle) writes
  `kSidebarIsCollapsed` mid-drag, we don't want a `UpdateBounds()` that
  re-snaps the widget to its anchor edge mid-move — that would teleport
  it out from under the cursor.
- **`OnAutoHideTick`** — treats drag as continuous user activity. It
  resets `last_user_activity_` and returns early without checking
  inactivity, so the widget can't peek mid-drag and yank the icon strip
  to the screen edge.

The flag is cleared *before* the snap path runs in `OnDragSettled` so the
subsequent `UpdateBounds()` behaves normally (full snap-to-edge).

### Layout-direction mirroring

`SidebarContainerView` reuses the existing `position_` field — used by
`Layout()` and `SetStyle()` to decide which side of the container holds
the pane buttons vs the WebContents — but the source of truth differs:

- **Docked container** (`browser_view_ != nullptr`): `position_ = service->GetPosition()`
  (the global `sidebar.position` pref)
- **Undocked container** (`browser_view_ == nullptr`): `position_` is
  derived from `service->GetUndockedEdge()` — `EDGE_LEFT → POSITION_LEFT`,
  `EDGE_RIGHT → POSITION_RIGHT`. The container's `PrefChangeRegistrar`
  also listens to `kSidebarUndockedEdge` (sharing `OnCollapsedPrefChanged`
  since the work is identical) so a mid-session snap-flip relays out the
  inner container.

`OnCollapsedPrefChanged` branches on `browser_view_`:

- **Docked**: calls `browser_view_->DeprecatedLayoutImmediately()`. The
  parent `BrowserView` owns the layout pass and reconsults the
  container's new width.
- **Undocked**: there's no `BrowserView`. The handler calls
  `InvalidateLayout()` on the container itself, marking it dirty so the
  next paint pass reruns `Layout(PassKey)` and the pane buttons /
  WebContents actually move to the new sides. Without this, the cached
  `position_` updates but the children stay put — the symptom was "snap
  to the opposite edge, layout doesn't flip."

### Auto-hide and peek

A `kAutoHideTickMs` (100ms) `RepeatingTimer` (`auto_hide_tick_timer_`)
runs while the widget exists. Each tick:

1. Reads `IsUndockedAutoHideEnabled()` — if false, force-reveals if
   currently peeking and resets activity time; no further work.
2. Computes "active" = cursor over widget OR widget is focused. If
   active, records `last_user_activity_ = Now()` and reveals if peeking.
3. If inactive and not peeking: checks `Now() - last_user_activity_` against
   `GetUndockedAutoHideDelayMs()` (default 5000ms, clamped to ≥ 1000ms)
   and calls `ApplyPeekState()` when the delay has elapsed.

**Peek state** (`ApplyPeekState`): widget shrinks to `kPeekStripWidth`
(4) pixels wide, inset by `kPeekEdgePad` (4) from the snapped work-area
edge so its DWM drop-shadow doesn't bleed onto the adjacent monitor on a
multi-display setup. Without the inset, the strip's outer pixels sit
exactly at the seam between monitors and the system frame shadow paints
through to the neighboring display. Y and height are preserved.

**Reveal** is the inverse of the active-check above — the next tick where
the cursor lands on the peek strip (`bounds.Contains(cursor)`) flips
`is_peeking_` back to false and calls `UpdateBounds()` to restore to the
configured collapsed/expanded width.

Tradeoffs:

- The 100ms poll is cheap (one `GetCursorScreenPoint` + a rect contains)
  but introduces up to 100ms reveal latency. Felt acceptable in testing.
- Auto-hide bypasses the inactivity timer when the widget is focused,
  so reading/typing in the WebContents won't trigger hide.
- No reveal animation; the bounds change is instant. Could add a
  `gfx::SlideAnimation` between the peek and normal x/width if jumpiness
  becomes a complaint.

### Background mode

`UndockedSidebarWidget` holds **two** keep-alives **when the local-state
pref `prefs::kBackgroundModeEnabled` is true** — both are needed, and
holding only one of them is a crash.

| Keep-alive | Origin | What it prevents |
|---|---|---|
| `ScopedKeepAlive` | `KeepAliveOrigin::SIDEBAR_UNDOCKED` (Enabled restart) | Browser process exit when the last `Browser` closes |
| `ScopedProfileKeepAlive` | `ProfileKeepAliveOrigin::kSidebarUndocked` | `Profile` destruction when its last `Browser` closes (gated by the `DestroyProfileOnBrowserClose` flag) |

Why both: the process-level keep-alive alone is not enough. With
`DestroyProfileOnBrowserClose` enabled, `ProfileManager` tears down a
`Profile` once its `BrowserWindow` refcount hits zero, regardless of
whether the *process* is still alive. The widget then holds a dangling
`raw_ptr<Profile>` and the inner `SidebarContainerView` is still wired to
the doomed `Profile`'s keyed services. Worse: `ProfileImpl::~ProfileImpl`
does blocking file I/O on the UI thread, which trips
`AssertBlockingAllowed` — a hard DCHECK during teardown.

### The `kBackgroundModeEnabled` gate

`prefs::kBackgroundModeEnabled` is the same local-state pref Chrome's
`BackgroundModeManager` uses for extension background processes — the
"Continue running background apps when [browser] is closed" toggle. We
piggyback on it rather than adding a sidebar-specific pref:

- **Pref `true` (default in this fork):** `UndockedSidebarWidget` holds
  both keep-alives. Closing all Browser windows leaves the floating
  sidebar (and the Chrome process) running. The user can re-open browser
  windows or dock the sidebar to release the keep-alives.
- **Pref `false`:** The widget holds neither keep-alive. Closing the
  last Browser window tears down the process normally; the widget goes
  with it. This matches the default behavior for any other UI surface.

`UndockedSidebarWidget` listens for runtime flips of the pref through a
`PrefChangeRegistrar` bound to `g_browser_process->local_state()`. The
handler calls `RefreshBackgroundModeKeepAlives()`, which is idempotent —
it diffs `wanted` (pref value) against `have` (keep-alive pointer state)
and only acts on transitions. So toggling the setting while the sidebar
is open immediately starts/stops blocking Chrome from exiting; no
restart needed.

`OnWidgetDestroying` explicitly resets both keep-alive `unique_ptr`s and
removes the local-state registrar before the Widget tears down, so an
in-flight pref-change notification can't reach a partially-destroyed
delegate.

Enum values were added at:

- [`keep_alive_types.h`](../src/components/keep_alive_registry/keep_alive_types.h) — `KeepAliveOrigin::SIDEBAR_UNDOCKED`, with the `operator<<` case in `keep_alive_types.cc`
- [`profile_keep_alive_types.h`](../src/chrome/browser/profiles/keep_alive/profile_keep_alive_types.h) — `ProfileKeepAliveOrigin::kSidebarUndocked = 42`, with the `operator<<` case in `profile_keep_alive_types.cc`. Comment block above `kMaxValue` marks it as paired with the process-level enum.

## WebContents lifecycle and per-window divergence

Lazy creation: `web_view_` (and therefore the `WebContents`) is created on
the first pane button press, not at container construction. If you open
a browser window and never click a sidebar pane button, no render process
spins up for the sidebar.

**Open issue (intentional MVP simplification):** the docked
`SidebarContainerView`s and the undocked container each lazily create
their *own* `WebView` / `WebContents` when their pane buttons are clicked.
A second browser window opening a sidebar pane therefore launches a
second render process and reloads the page. The state machine for sharing
one `WebContents` across all per-window containers (move it between
parents on focus / on undock) would live in `SidebarService` but is not
written yet. Acceptable for the first revival because the sidebar pages
are local-resource WebUIs (`chrome://sidebar/...`) and load in tens of
milliseconds.

`VisibilityChanged` overrides handle the special case where the master
`sidebar.enabled` pref is flipped off at runtime: `ReleaseWebView()`
tears down the `views::WebView` cleanly so the render process exits.

## Right-click context menu

`SidebarContainerView` implements `views::ContextMenuController` (a
non-pure interface — `set_context_menu_controller(this)` in `Init()`) and
`ui::SimpleMenuModel::Delegate`. Right-click anywhere on the sidebar
surface fires `ShowContextMenuForViewImpl`, which builds a fresh
`SimpleMenuModel` with labels picked from current state:

| Command | Label | Action |
|---|---|---|
| `kCmdToggleDock` | "Undock Sidebar" / "Dock Sidebar" | `service->SetUndocked(!IsUndocked())` |
| `kCmdToggleCollapsed` | "Expand" / "Collapse" | `service->SetCollapsed(!IsCollapsed())` |

Labels are currently hardcoded English strings — wire to IDS resources
when the feature stabilizes.

## Anchoring and layout

The docked sidebar's width is consumed by `BrowserViewLayout` at the
[browser_view_layout.cc:1158-1159](../src/chrome/browser/ui/views/frame/browser_view_layout.cc#L1158)
read site:

```cpp
int sidebar_width = sidebar_container_->GetVisible() ?
    sidebar_container_->width() : 0;
```

So to hide the sidebar in the docked surface, all the container needs to
do is `SetVisible(false)` — the layout pass reads zero and gives the
horizontal space to the contents area. The `width()` accessor returns the
container's own `width_` member, set by `UpdatePrefs()` to either
`kPaneWidth` (collapsed) or the clamped service width (expanded).

The undocked widget bypasses this entirely. `UndockedSidebarWidget::UpdateBounds()`
queries `display::Screen` for the work area of the display containing the
widget and sets bounds `(edge_x, centered_y, width, 80% × work_area_height)`
where `edge_x` is anchored to whichever edge the `kSidebarUndockedEdge`
pref records. It runs on init, whenever `kSidebarIsCollapsed` changes, and
after `OnDragSettled` decides a snap is warranted.

## The undocked widget — drag, snap, auto-hide, keep-alive

The undocked widget is a frameless floating window with four behaviors layered on top of the basic collapse/expand state machine.

### Geometry

- **Width.** `kPaneHandleWidth` (60) when collapsed, `kSidebarUndockedWidth` pref (default 320) when expanded. Wider than the docked `kPaneWidth` (35) because the floating window is standalone and needs more visual presence.
- **Height.** `kHeightFraction × work_area.height()` (80%), centered vertically. Not full-height — matches the Naver Whale-style floating sidebar instead of edge-to-edge.
- **Horizontal anchor.** `kEdgeMargin` (8) px from the snapped edge, on whichever side `kSidebarUndockedEdge` records.

### Drag handle and HTCAPTION

`remove_standard_frame = true` strips the OS titlebar. `UndockedSidebarFrameView::NonClientHitTest` returns `HTCLIENT` for every point inside the widget (and `HTNOWHERE` outside) — *never* `HTCAPTION`. Window-move drag is handled manually on the contents view via `OnMousePressed` / `OnMouseDragged` / `OnMouseReleased` (see "Drag, manual move handling, and edge snap" above for the full reasoning).

### Edge snap

`OnMouseReleased` calls `OnDragSettled` directly. `OnDragSettled` measures the widget's distance to each edge of the display containing it; if either is within `kSnapDistance` (80) px, it writes the new edge to `kSidebarUndockedEdge` and calls `UpdateBounds` to snap. If the user dropped the widget away from any edge, it stays where they put it and the persisted edge is left alone (so the next session still restores to the last-snapped side).

Re-entrancy: `UpdateBounds`, `ApplyPeekState`, `ApplyNormalState`, and the manual-drag `SetBounds` in `OnMouseDragged` all set `ignoring_bounds_changes_ = true` while they call `Widget::SetBounds`, so the resulting `OnWidgetBoundsChanged` early-returns and doesn't try to drive any drag logic of its own.

### Auto-hide and the peek strip

`UndockedSidebarWidget` runs a `base::RepeatingTimer` (`auto_hide_tick_timer_`) at `kAutoHideTickMs` (100ms) while the widget exists. Each tick:

1. If `kSidebarUndockedAutoHide` is false, no-op (reveals if currently peeking, so a user turning auto-hide off doesn't get stuck at a 4px strip).
2. Read the cursor screen position. If it's inside the widget bounds, or the widget has keyboard focus, or `is_dragging_` is true, reset `last_user_activity_ = now()` (and reveal if peeking) and return.
3. Otherwise, if `now - last_user_activity_ >= delay_ms` (clamped to ≥1000ms), call `ApplyPeekState`.

`ApplyPeekState` shrinks the widget's `width` to `kPeekStripWidth` (4) and pins its `x` flush against the screen edge (no `kEdgeMargin` — the user must be able to reach the strip by slamming the cursor into the side). Vertical bounds are preserved.

`ApplyNormalState` flips `is_peeking_` back to false and calls `UpdateBounds`, which recomputes width from the collapsed/expanded prefs.

The peek state is **runtime-only** — not persisted. A browser restart always starts in the normal (collapsed or expanded) state.

## Known limitations

| | |
|---|---|
| **No animation** | All transitions (collapse/expand, dock/undock) are instant. A `gfx::SlideAnimation` on the docked container's `width_` and the undocked widget's bounds would smooth this out. |
| **Multiple WebContents** | Each `SidebarContainerView` (per-BrowserView + the undocked one) lazily creates its own. See "WebContents lifecycle" above. |
| **No header pop-out button** | Dock/undock is only reachable from the right-click context menu. |
| **Primary-display only for initial spawn** | The first `UpdateBounds` after `ShowForProfile` uses the primary display's work area. Once the user drags the widget to a secondary monitor, `OnDragSettled` correctly uses `display::Screen::GetDisplayMatching(bounds)` so snap/peek behave on that display — but the initial spawn doesn't yet remember which display the widget was on last session. |
| **No drag-to-resize on undocked widget** | The widget's bounds are computed from prefs; the inner `SidebarContainerView::OnResize` writes `kSidebarUndockedWidth` on resize-end, but the widget doesn't propagate the resize cursor from its own edges yet. (`views::Widget`'s standard resize edges are gone because `remove_standard_frame=true`.) |
| **Drag affordance is invisible** | The whole pane-strip background is drag-targetable, but there's no visual cue. Users learn to drag from non-button space by accident or by reading docs. A subtle grip pattern (3 horizontal dots, a hover background) on the empty pane-strip area would make it discoverable. |
| **Auto-hide polls every 100ms** | Cheaper alternatives exist (per-platform mouse hooks, `aura::WindowEventDispatcher` filters), but the polling timer is simple and the cost is negligible. If profiling ever flags it, the panels subsystem's `PanelMouseWatcher` is a more efficient reference implementation. |
| **English-only context menu strings** | "Undock Sidebar" / "Dock Sidebar" / "Expand" / "Collapse" are `u""` literals in `ShowContextMenuForViewImpl`. Should be `IDS_SIDEBAR_*` from generated_resources. |

## Integration patches

| Patch | What it does |
|---|---|
| [`chrome-browser-prefs-browser_prefs.cc.patch`](../src/custom/patches/chrome-browser-prefs-browser_prefs.cc.patch) | Calls `sidebar::SidebarService::RegisterProfilePrefs(registry)` under `ENABLE_SIDEBAR`. |
| [`chrome-browser-extensions-api-settings_private-prefs_util.cc.patch`](../src/custom/patches/chrome-browser-extensions-api-settings_private-prefs_util.cc.patch) | Allowlists `kSidebar*` prefs (including the new dock/collapsed/undocked-width ones) for the WebUI Settings page. |
| [`chrome-browser-ui-views-frame-browser_view.cc.patch`](../src/custom/patches/chrome-browser-ui-views-frame-browser_view.cc.patch) | Creates the per-window `SidebarContainerView`, calls `Init()` / `SetVisible(!service->IsUndocked())` / `InitViews()`. |
| [`chrome-browser-ui-views-frame-browser_view_layout.cc.patch`](../src/custom/patches/chrome-browser-ui-views-frame-browser_view_layout.cc.patch) | Lays out the sidebar container alongside the contents area in `BrowserViewLayout`. |

All patches regenerate from live source via the project's patch-regen script.
Edit the live `.cc`/`.h` files, not the `.patch` files.

## WebUI

The pane content — bookmarks list, history list, RSS feed reader, page notes, and NTP settings — is a
single-bundle React SPA served at `chrome://sidebar`. Routing, IPC,
backend wiring, and the C++ `SidebarUI` / `SidebarDOMHandler` are
documented at [`docs/custom-webui/sidebar.md`](custom-webui/sidebar.md).

## NTP Settings Panel

`TYPE_NTP_SETTINGS = 7` is a special panel type that hosts the NTP (New Tab Page)
settings at `chrome://sidebar/ntp-settings`. Unlike the other panels it is not
opened by the user clicking the top-pane button in a sidebar that is already
expanded — it is primarily opened **programmatically** when the user clicks the
gear icon on any NTP layout.

### How it opens

1. The NTP React page calls `window.custom.settings.openNtpSettings()`.
2. The V8/Gin binding (`SettingsBindings` in `remote_ntp_extension.cc`) forwards to `RemoteNtp::OpenNtpSettings()`.
3. `RemoteNtp` sends a `OpenNtpSettings()` Mojo IPC to the browser via `RemoteNtpRouter`.
4. `RemoteNtpTabHelper::OnOpenNtpSettings()` looks up the `SidebarContainerView` for the browser window via `SidebarContainerView::FindForBrowserView(BrowserView*)`.
5. `SidebarContainerView::ShowPanel(TYPE_NTP_SETTINGS)` updates the button selection state and calls `TopPaneButtonPressed(TYPE_NTP_SETTINGS)`, which loads `chrome://sidebar/ntp-settings` and expands the sidebar if collapsed.

### Layout flavor reporting

Each NTP layout reports its flavor to the browser via `window.custom.settings.onLayoutChanged(flavor)`:

| Flavor | Layout |
|---|---|
| `'full'` | Default full-page NTP (NewTab class component) |
| `'glass'` | Glass morphism overlay layout |
| `'clean'` | Clean side-by-side layout |
| `'focus'` | Focus / minimal layout (search only) |
| `'wallpaper'` | Bing daily wallpaper layout |

`RemoteNtpTabHelper` stores the flavor in `current_ntp_flavor_`. `SidebarDOMHandler::NtpGetCurrentLayout` reads it so `NtpSettingsPage` can show the right options for the active layout.

### Layout switching from the sidebar

`NtpSettingsPage` includes a layout picker (5 radio-style cards). Selecting a card updates the local `settings.layout` field; the relevant content/background toggles update in-place. On **Save Settings**, the full JSON (including `layout`) is written to the pref and pushed to the NTP via `SendNtpSettingsChanged`.

On the NTP side, `LayoutShell` registers a chained `onNtpSettingsChanged` handler (via `useEffect`) that reads `settings.layout` from the new JSON and calls `setFlavor()` in `LayoutContext` if it differs from the current flavor. `setFlavor` also writes to `localStorage('layoutFlavor')` so the new layout persists across new-tab opens. The `LayoutShell` fades out the old layout and fades in the new one without a page reload.

Each layout component (`GlassLayout`, `NewTab`) also registers its own `onNtpSettingsChanged` handler to apply per-component settings (search visibility, background, etc.). These handlers chain: they save the previously registered handler and call it first, ensuring that `LayoutShell`'s layout-switch logic always fires regardless of which layout is currently mounted.

### Settings persistence

Settings are stored as a JSON blob in the `remote_ntp.settings_json` profile pref
(`prefs::kNtpSettingsJson`, registered in `custom_prefs.cc`). This is cross-origin-safe:
`chrome://sidebar/` and `chrome-search://remote-ntp` both access it through their
respective browser-side handlers rather than reading each other's origin storage.

- **Save path**: `NtpSettingsPage` → `chrome.send('ntpSaveSettings', [json])` → `SidebarDOMHandler::NtpSaveSettings` → writes pref → finds active NTP tab → `RemoteNtpTabHelper::SendNtpSettingsChanged(json)` → `RemoteNtpRouter::SendNtpSettingsChanged` → `RemoteNtpClient::NtpSettingsChanged` Mojo call → `RemoteNtp::NtpSettingsChanged` → `RemoteNtpExtension::DispatchNtpSettingsChanged` → `window.custom.settings.onNtpSettingsChanged()` callback on the NTP page.
- **Load path (NTP opens)**: `RemoteNtpTabHelper::NavigationEntryCommitted` reads the pref and pushes it to the NTP renderer via `SendNtpSettingsChanged`, so settings survive navigation.
