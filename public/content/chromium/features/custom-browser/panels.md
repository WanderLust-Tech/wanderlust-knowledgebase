# Panels

Gated by `BUILDFLAG(ENABLE_PANELS)`. Restores Chromium's old floating-window
"panel" UI primitive — small, dockable, always-on-top windows that host a
single `WebContents` outside the normal `Browser` / `TabStripModel` surface.
Extensions opt in via `chrome.windows.create({type: 'panel'})`. The original
subsystem was deprecated and removed upstream around 2017; this fork carries
the full code and an `enable_panels` build-time gate so it can be revived
without polluting unrelated builds.

## Build / activation

| Where | What |
|---|---|
| [`custom_browser_config.gni`](../src/custom/custom_browser_config.gni#L294) | `enable_panels = true` (or `false`) — gates source compilation, integration patches, and the extension-API branch |
| [`custom_features_buildflags.h`](../src/custom/buildflags/BUILD.gn) + [`branding_buildflags.h`](../src/custom/custom_browser_config.gni#L616) | `BUILDFLAG(ENABLE_PANELS)` emitted from both headers; either include path works for `#if`-gating |
| Sources | [`browser/sources.gni`](../src/custom/browser/sources.gni) (`panel_tag`, `panel_task` for task manager) and the entire [`browser/ui/sources.gni`](../src/custom/browser/ui/sources.gni#L92) `if (enable_panels)` block for the platform-independent layer + Views frontend |
| Runtime opt-in | None. The build-time gate is the only opt-in needed; `PanelManager::ShouldUsePanels` returns `true` for any extension on Win/Mac (and on tested Linux WMs). Upstream's `--enable-panels` switch + Hangouts allow-list is gone in this fork. |
| Keyed service | Lazy singleton via `base::Singleton<PanelManager>::get()`. Self-initializes on first `GetInstance()` call — no explicit startup hook needed. |
| Task manager | `PanelTag` attached in `Panel::Initialize` via `task_manager::WebContentsTags::CreateForPanel(web_contents, panel)`. `kPanel` is excluded from the `CreateForExtension` path in patched `chrome_extensions_browser_client.cc` so it doesn't trip `IsExtensionWebContents`'s panel-exclusion DCHECK. |

## Architecture

```
chrome.windows.create({type:'panel', url:..., ...})
  │  (from extension JS)
  ▼
WindowsCreateFunction::Run                        (chrome/browser/extensions/api/tabs/tabs_api.cc)
  │  - case windows::CreateType::kPanel:
  │  - PanelManager::ShouldUsePanels(extension_id) → true (build-time gated, no runtime flag)
  │  - early return with the panel's window value, skipping Browser::Create
  ▼
PanelManager::CreatePanel(app_name, profile, url, bounds, CREATE_AS_DOCKED)
  │
  ├──► Picks a PanelCollection for the new panel
  │      (DockedPanelCollection / DetachedPanelCollection / StackedPanelCollection)
  │
  └──► Panel::Initialize(url, bounds, always_on_top)
         ├── PanelExtensionWindowController       ← registers with WindowControllerList
         │      so chrome.windows.{get,getAll,onCreated} sees the panel
         ├── CreateNativePanel → PanelView (Win Views frontend)
         │      ├── views::Widget::Init           ← creates the OS window
         │      ├── NonClientView → PanelFrameView (Init() builds title icon /
         │      │      label / close-min-restore buttons, sets bounds)
         │      ├── SetLayoutManager(FillLayout)  ← so web_view_ auto-sizes
         │      └── web_view_ (views::WebView)    ← hosts the WebContents
         ├── PanelHost (WebContentsDelegate + WebContentsObserver)
         │      ├── content::WebContents::Create  ← single WebContents per panel
         │      ├── SetViewType(...kPanel)        ← routes task-manager tagging
         │      │      via the patched chrome_extensions_browser_client to
         │      │      WebContentsTags::CreateForPanel
         │      └── LoadURL(url)
         ├── WebContentsTags::CreateForPanel      ← PanelTag for task manager
         └── theme_service_->AddObserver(this)    ← repaint on theme change

(later, after Initialize returns)
  ▼
panel->Show() / ShowInactive()                    (from tabs_api.cc)
  ├── window_->Show()
  └── web_contents->UpdateWebContentsVisibility(VISIBLE)
         ← first-time transition out of Visibility::kHidden, required for
           the compositor to start producing frames
```

`Panel` is the lifetime root. `PanelHost` owns the `WebContents`. `PanelView`
is the platform-independent Views frontend (concrete only on Windows today).
`PanelManager` is a process-wide singleton that owns the collections and the
drag/resize controllers.

## Pieces

| Class / file | Role |
|---|---|
| [`PanelManager`](../src/custom/browser/ui/panels/panel_manager.cc) | Lazy process-wide singleton. Owns `DockedPanelCollection`, `DetachedPanelCollection`, `Stacks`, `PanelDragController`, `PanelResizeController`, `PanelMouseWatcher`, and a `DisplaySettingsProvider`. Constructor wires all of these — no separate `Initialize()` call. |
| [`Panel`](../src/custom/browser/ui/panels/panel.cc) | The panel's logical type. Implements `ui::BaseWindow`, observes `ThemeService` and `ExtensionRegistry`, owns the `PanelHost`, `PanelExtensionWindowController`, `CommandUpdaterImpl`, and the platform `NativePanel`. Has a unique `SessionID` generated at construction via `SessionID::NewUnique()`. |
| `PanelExtensionWindowController` (nested in `panel.cc`) | `extensions::WindowController` impl that surfaces the panel to the `chrome.windows.*` API. Registers itself with `WindowControllerList` in its constructor. Full 12-method override set: `GetWindowId` returns the panel's `SessionID::id_type`; `GetWindowTypeText` returns `"panel"`; `CreateWindowValueForExtension` builds a populated `base::Value::Dict` with `id`, `type`, `focused`, `incognito`, `alwaysOnTop`, `state`, `left/top/width/height`, `sessionId`. |
| [`PanelHost`](../src/custom/browser/ui/panels/panel_host.cc) | `WebContentsDelegate` + `WebContentsObserver` for the panel's single `WebContents`. Handles `OpenURLFromTab` (forces new tab), `AddNewContents` (forces new tab), `ResizeDueToAutoResize`, `HandleKeyboardEvent`, etc. Calls `Panel::Close` via a UI-thread `PostTask` on `WebContentsDestroyed`. |
| [`PanelView` / `PanelFrameView` / `PanelStackView`](../src/custom/browser/ui/views/panels/) | Views frontend. `PanelView` is a `views::WidgetDelegateView` with `FillLayout`, owns the `views::Widget` and the `views::WebView`. `PanelFrameView` is the `NonClientFrameView` — paints the titlebar background via `FillRect` (active/inactive/attention/minimize colors) and hit-tests resize zones. `PanelStackView` hosts the native stack window when panels are stacked. Win-only today. |
| [`DockedPanelCollection`](../src/custom/browser/ui/panels/docked_panel_collection.cc) | Default layout. Panels dock along the bottom-right of the work area, packed right-to-left. Auto-shrinks panels when more arrive than fit. Owns the docked-mode drag handler. |
| [`DetachedPanelCollection`](../src/custom/browser/ui/panels/detached_panel_collection.cc) | Free-floating panels at user-chosen positions. Currently unreachable via the extension API in this build (see "Detached panels" below). |
| [`StackedPanelCollection`](../src/custom/browser/ui/panels/stacked_panel_collection.cc) | Vertical stacks of panels (drag one panel onto another to stack). |
| [`PanelDragController`](../src/custom/browser/ui/panels/panel_drag_controller.cc) / [`PanelResizeController`](../src/custom/browser/ui/panels/panel_resize_controller.cc) | Process-wide drag and resize state machines; coordinate across collections when a panel is dragged out of one. Each holds a `raw_ptr` to the actively-dragged/resized panel that must be nulled on end-of-gesture (see "Reset state" below). |
| [`PanelMouseWatcher`](../src/custom/browser/ui/panels/panel_mouse_watcher.cc) | Watches the global mouse cursor when minimized panels exist, so the titlebar can peek up when the cursor approaches the bottom edge. |
| [`DisplaySettingsProvider`](../src/custom/browser/ui/panels/display_settings_provider.cc) | Reports the work area and edge-snap targets, observes display changes and full-screen state. |
| [`PanelTag` / `PanelTask`](../src/custom/browser/task_manager/providers/web_contents/) | Task-manager integration. `PanelTag` is the per-`WebContents` tag attached in `Panel::Initialize`; `PanelTask` is the row that shows up in the task manager. |

## Extension API surface

`tabs_api.cc`'s `WindowsCreateFunction::Run` has a panel branch:

```cpp
case windows::CreateType::kPanel: {
  extension_id = extension()->id();
  bool use_panels = PanelManager::ShouldUsePanels(extension_id);
  if (use_panels) {
    create_panel = true;
  } else {
    window_type = Browser::TYPE_POPUP;
  }
  break;
}
```

When `create_panel == true`, execution skips the entire `Browser::Create`
path and instead calls:

```cpp
Panel* panel = PanelManager::GetInstance()->CreatePanel(
    panel_app_name, window_profile, panel_url, window_bounds,
    PanelManager::CREATE_AS_DOCKED);
panel->Show() / ShowInactive();
return RespondNow(WithArguments(
    panel->extension_window_controller()->CreateWindowValueForExtension(
        extension(), WindowController::kPopulateTabs,
        source_context_type())));
```

The panel's window value comes from `PanelExtensionWindowController`, not
`ExtensionTabUtil::CreateWindowValueForExtension(Browser&, ...)` — the
extension API never sees a `Browser*` for a panel.

### Method coverage

Modern Chromium's `chrome.windows.*` implementation has a recurring filter —
"skip controllers with no `Browser*`" — that has to be patched per call site
for panels to be visible:

| API | Works for panels? | Notes |
|---|---|---|
| `chrome.windows.create({type:'panel'})` | ✅ | Phase 4b kPanel branch in `tabs_api.cc`. |
| `chrome.windows.get(panelId)` | ✅ | Calls the controller's own `CreateWindowValueForExtension` — no Browser-only path. |
| `chrome.windows.getCurrent()` *(from a panel page)* | ✅ | `PanelHost::GetExtensionWindowController()` returns the panel's controller; `WindowsGetCurrentFunction` resolves through that. |
| `chrome.windows.getAll(...)` / `getAll({windowTypes:['panel']})` | ✅ | Patched in `tabs_api.cc`: an `ENABLE_PANELS` branch handles controllers with null `GetBrowser()` by calling the controller's own filter + serialization methods. |
| `chrome.windows.remove(panelId)` | ✅ | Routes through `WindowController::window()->Close()` → `Panel::Close()`. |
| `chrome.windows.onCreated` / `onRemoved` | ✅ | Patched in `windows_event_router.cc`: `OnWindowControllerAdded` / `OnWindowControllerRemoved` previously short-circuited on null `GetBrowser()`. Now allows controllers whose `GetWindowTypeText() == "panel"`. |
| `chrome.windows.getLastFocused()` | ❌ | Iterates `BrowserList` directly. Would never see panels. |
| `chrome.windows.update(panelId, …)` | ❌ | [tabs_api.cc:1041-1044](../src/chrome/browser/extensions/api/tabs/tabs_api.cc#L1041) explicitly errors when `controller->GetBrowser() == nullptr`. A panel-handling branch would need to invoke `Panel::SetPanelBounds` / `Activate` / `Minimize` for the requested update. |
| `chrome.windows.onFocusChanged` | ❓ | Unverified — likely the same `GetBrowser()` filter pattern. |

## Lifecycle

1. **Construction:** `Panel::Panel(profile, app_name, min_size, max_size)` runs first. The init list initializes `theme_service_` and `session_id_` early (before `profile_`) — both must be initialized from the constructor argument `profile`, *not* the member `profile_`, because their declarations appear earlier in the header than `profile_` and C++ init runs in declaration order. The same applies to `extension_registry_`.
2. **`Panel::Initialize(url, bounds, always_on_top)`** wires:
   - `native_panel_` via `CreateNativePanel` (`PanelView` ctor, which `Widget::Init`s the OS window — `PanelFrameView::Init()` runs from `CreateNonClientFrameView()` before `Widget::Init` returns, so child views exist when `Widget::Init` immediately calls `UpdateWindowIcon`).
   - `extension_window_controller_` — registered with `WindowControllerList` in its own ctor.
   - `panel_host_` + its `WebContents`. `SetViewType(..kPanel)` triggers `AttachExtensionTaskManagerTag`; under `ENABLE_PANELS` the patched `chrome_extensions_browser_client.cc` short-circuits the `kPanel` case (it would otherwise hit `WebContentsTags::CreateForExtension`, which DCHECKs because `IsExtensionWebContents` excludes `kPanel`).
   - `WebContentsTags::CreateForPanel(web_contents, this)` — attaches the actual `PanelTag` for the task manager.
   - `theme_service_->AddObserver(this)`.
3. **Add to a collection:** `PanelManager` picks a `PanelCollection` based on the requested bounds and the create mode (`CREATE_AS_DOCKED` is the only mode reachable from the extension API today).
4. **Show:** `tabs_api.cc` calls `panel->Show()` or `ShowInactive()` after `CreatePanel` returns. The native path is `PanelView::ShowPanel()` → `window_->Show()` → `web_contents->UpdateWebContentsVisibility(content::Visibility::VISIBLE)`. The explicit visibility update is required for first-time transitions — the `WebContents` is created with `Visibility::kHidden`, and `views::WebView::SetWebContents` only attaches the native view; it does not run the visibility lifecycle. Without `UpdateWebContentsVisibility(VISIBLE)`, the compositor never produces frames and the content area paints black even though the URL has loaded. (Subsequent show toggles use `WasShown()` per [`web_contents.h` docs](../src/content/public/browser/web_contents.h#L882).)
5. **Destruction:** `~Panel()` removes itself from `WindowControllerList` (via `~PanelExtensionWindowController`), removes the theme observer, and decrements the keep-alive count on non-Aura platforms. On Aura (every desktop build), the keep-alive lives in `PanelView`.

## Collections

| Mode | Constant | Behavior |
|---|---|---|
| Docked | `CREATE_AS_DOCKED` | Panels pack from the bottom-right of the work area leftward. Auto-shrinks panel widths once the row would overflow. This is the default and only mode used by the extension API today. |
| Detached | `CREATE_AS_DETACHED` | Free-floating at a user-chosen position. The Vivaldi-era `kDetachedPanel` `CreateType` enum value was removed from upstream `windows.json`; the `tabs_api.cc` branch carries a `TODO(panels-revival)` comment marking where to re-enable it. |
| Stacked | (no API; drag-driven) | Vertical column of multiple panels. Created by `PanelManager::CreateStack` when one panel is dragged onto another. Stacks share a native window via `PanelStackView`. |

## Rendering pipeline

The path from `panel_host_->Init(url)` to a painted page is fragile and was
the source of multiple revival-era black-content bugs:

1. **WebContents creation.** `content::WebContents::Create(create_params)` — initial `Visibility::kHidden`.
2. **`SetViewType(kPanel)`.** Routes the task-manager tag (gated above) and sets blink's view type.
3. **`LoadURL(url)`.** Navigation starts in a hidden WC. The renderer process is created and the page begins loading.
4. **`web_view_->SetWebContents(web_contents)`** (`PanelView::AttachWebContents`). This attaches the WC's native view to `web_view_`'s `NativeViewHost` holder, but does **not** run the visibility lifecycle. If `web_view_`'s bounds are still 0×0 at this point (i.e. no Layout has happened), the native view is also 0×0.
5. **`Widget::Show()`.** Widget becomes visible; `ui::Compositor` is now actively producing surfaces.
6. **`SetLayoutManager(FillLayout)` runs.** `PanelView`'s FillLayout sizes `web_view_` to fill the contents area on the post-Show layout pass. Without a layout manager, the manual `Layout(PassKey)` override only runs when the framework triggers a layout — adding a child does *not* synchronously do that, so `web_view_` could stay at 0×0 until the first paint pass, and the renderer's compositor frames would have nowhere to present.
7. **`UpdateWebContentsVisibility(Visibility::VISIBLE)`.** First-time transition out of `kHidden`. The RenderWidgetHostView's compositor frame sink starts producing frames into the holder's native view.

Steps 6 and 7 are both required — step 6 (FillLayout) ensures the native view has area; step 7 (`UpdateWebContentsVisibility`) ensures the compositor produces frames.

### The three layout-cascade requirements

Panels are a custom-framed Widget where `PanelView` is the contents view and `PanelFrameView` is the `NonClientFrameView`. Modern Chromium's NonClientView/NonClientFrameView/ClientView layout cascade has three coupled requirements that must all be met for the contents view to ever get bounds. Getting any one wrong leaves the panel showing chrome + a black content area:

1. **`set_frame_type(kForceCustom)` *before* `Widget::Init`.** `Widget::Init` is what builds the initial `NonClientView` and reads the frame_type preference to decide which factory to invoke. Calling `set_frame_type` afterward only stores the preference and requires `FrameTypeChanged()` to apply — which itself `CHECK`s `IsFrameSystemDrawn()` in `HWNDMessageHandler::PerformDwmTransition` and crashes for custom frames. So the pattern is "set first, then Init; never call `FrameTypeChanged` on a custom-framed Widget."

2. **`params.remove_standard_frame = true` paired with `kForceCustom`.** They are a pair. With `remove_standard_frame = false`, the OS draws the frame and the internal layout takes a different path that never sizes the client view despite the Widget having valid bounds.

3. **`PanelFrameView::Layout(PassKey)` must chain to `NonClientFrameView::Layout` via `LayoutSuperclass<NonClientFrameView>(this)`.** This is the modern Chromium gotcha — see [`non_client_view.cc:289`](../src/ui/views/window/non_client_view.cc#L289): `NonClientView::Layout` only sizes `frame_view_` and `overlay_view_`. ClientView (and therefore the contents view) is sized by [`NonClientFrameView::Layout`](../src/ui/views/window/non_client_view.cc#L125), which calls `client_view->SetBoundsRect(GetBoundsForClientView())`. The pre-deprecation Panel code didn't need this because `NonClientView::Layout` itself used to size the client view; the responsibility was moved into `NonClientFrameView::Layout` (with the matching reparent of ClientView to be a child of FrameView). Without chaining, ClientView stays 0×0 forever — the symptom is "title bar paints, content area is black, `GetBoundsForClientView` never fires."

The bug was reproducible at every step — diagnostic VLOGs in each of the layout-related callbacks (`CreateNonClientFrameView`, `GetContentsView`, `OnWidgetBoundsChanged`, `GetBoundsForClientView`, `Layout(PassKey)`) and a parent-chain walk after `Widget::Init` pinpointed which requirement was missing. The VLOGs are still in the code at `VLOG(1)` for the next revival regression.

## Threading

Panel code is **UI-thread-only**. All `Profile`, `Panel`, `WebContents`,
`RenderWidgetHost`, and view-tree access happens there. Originally several
panel sites posted to `base::ThreadPool`, which fired the
`SupportsUserData` sequence checker the moment the bound function touched a
keyed-service. Migrated to UI-thread posts:

- `DockedPanelCollection::ScheduleDelayedTitlebarsCheck` and
  `ScheduleLayoutRefresh` — `content::GetUIThreadTaskRunner({})->PostDelayedTask` with `BindOnce`.
- `PanelHost::WebContentsDestroyed` — posts `ClosePanel` to the UI thread via
  `BindOnce`.

`base::WeakPtr` from `WeakPtrFactory` members in these classes is bound to
the UI sequence at first use; the `InvalidateWeakPtrs()` calls right before
each post correctly cancel any pending earlier delayed task in the same lane.

## Reset state

A recurring revival bug: state variables on long-lived controllers were
*set* but never *reset* on end-of-gesture or end-of-lifecycle, so a second
operation would trip `DCHECK(!field_)` or run on stale pointers. Visible
shape: a commented-out `// field_ = NULL;` line adjacent to a `DCHECK(field_)`
or `DCHECK(!field_)`.

Sites fixed:

| Site | What |
|---|---|
| `PanelDragController::EndDragging` / `OnPanelClosed` | nullifies `dragging_panel_`, `dragging_panel_original_collection_`. |
| `PanelResizeController::EndResizing` | nullifies `resizing_panel_`. |
| `DockedPanelCollection::DiscardSavedPanelPlacement` | nullifies `saved_panel_placement_.panel` and `.left_panel`. |
| `DetachedPanelCollection::DiscardSavedPanelPlacement` | nullifies `saved_panel_placement_.panel`. |
| `StackedPanelCollection::DiscardSavedPanelPlacement` | nullifies `saved_panel_placement_.panel` and `.top_panel`. |
| `PanelFrameView` ctor | constructs `title_icon_` via `views::Builder<TabIconView>` (the original `new TabIconView(this, NULL)` was commented out). |
| `PanelView::OnMouseReleased` | nullifies `old_focused_view_` after restoring focus. |

If more state-not-reset DCHECKs surface, grep for:

```
//\s*\w+_\.\w+\s*=\s*(NULL|nullptr)\s*;
//\s*\w+_\s*=\s*(NULL|nullptr)\s*;
```

inside the panels source tree.

## Frame chrome

**Titlebar background** paints fine — `PanelFrameView::PaintFrameBackground`
uses `canvas->FillRect(...)` with the resolved `SkColor` for each paint state:

| State | Color |
|---|---|
| `PAINT_AS_ACTIVE` | `SkColorSetRGB(0x3a, 0x3d, 0x3d)` (dark gray) |
| `PAINT_AS_INACTIVE` | `SkColorSetRGB(0x7a, 0x7c, 0x7c)` (medium gray) |
| `PAINT_FOR_ATTENTION` | `SkColorSetRGB(0x53, 0xa9, 0x3f)` (green) |
| `PAINT_AS_MINIMIZED` | `SkColorSetRGB(0xf5, 0xf4, 0xf0)` (off-white) |

The original Panels feature shipped per-panel corner/edge PNGs (`IDR_WINDOW_*`,
`IDR_PANEL_*_CORNER/EDGE`) used in `PaintFrameEdge` to draw rounded border
art around minimized panels. These resources were removed from upstream
`theme_resources` when panels were deprecated. The fork's
`custom_extra_theme_resources.grdp` brings back the **button** assets
(`IDR_PANEL_CLOSE`, `IDR_PANEL_MINIMIZE`, `IDR_PANEL_RESTORE` + hovered /
pressed variants) but **not** the corner/edge art.

In `panel_frame_view.cc`, the eight `GetTopLeftCornerImage` /
`GetTopEdgeImage` / etc. helpers are stubbed to return an empty
`gfx::ImageSkia` (via `base::NoDestructor`). `DrawImageInt` on an empty
image is a no-op, so `PaintFrameEdge` runs without crashing — minimized
panels just render without border decoration. Restoring the original look
means re-shipping the PNGs and adding the `IDR_PANEL_*_CORNER/EDGE`
entries back to the `.grdp`.

## Pref schema

No user-facing prefs. Panel layout state (active collection, bounds) is held
in-memory only — there is no on-disk persistence of panel positions across
sessions. `PanelManager` accepts settings only via its `DisplaySettingsProvider`,
which is constructed eagerly and is not pref-backed.

## Known limitations

| | |
|---|---|
| **Windows-only Views frontend** | `PanelView` / `PanelFrameView` / `PanelStackView` are gated `is_win` in `sources.gni`. Other platforms compile the platform-independent layer but have no concrete `NativePanel` — `CreateNativePanel` would crash at runtime. |
| **`chrome.windows.update` doesn't reach panels** | [`tabs_api.cc:1041`](../src/chrome/browser/extensions/api/tabs/tabs_api.cc#L1041) explicitly errors when `controller->GetBrowser() == nullptr`. JS-driven panel bounds/focus updates require a separate code path that calls into `Panel::SetPanelBounds`, `Activate`, `Minimize` etc. |
| **`chrome.windows.getLastFocused` skips panels** | The function iterates `BrowserList` directly rather than `WindowControllerList`. Low-priority because most use-cases ask for the focused window from within an extension popup, which already knows its context. |
| **Empty `CreateTabList`** | Panels host a single `WebContents` but `chrome.windows.get({populate:true})` returns no `tabs` array, matching how apps and devtools windows behave. |
| **No minimized-panel frame chrome art** | `PaintFrameEdge` draws nothing because `IDR_WINDOW_*_CORNER/EDGE` and `IDR_PANEL_*_CORNER/EDGE` are gone. Titlebar background paints fine via `FillRect`. Affects only minimized panels. |
| **Detached panels not reachable via extension API** | The `kDetachedPanel` `CreateType` was removed from upstream `windows.json`. The collection still exists; it's just unreachable from JS. Restoring it requires re-adding the enum value to the API schema. |
| **No session restore** | Panel positions and the list of open panels are not persisted across browser restarts. |
| **Stacked panels — drag-only** | The only way to create a stack is to drag one panel onto another. There's no extension API for "create me a stack". Stack-teardown reset state (the `secondary_stack_window_ = nullptr` family) is also still commented out — won't bite until a user actually stacks panels. |

## Test extension

A minimum MV3 extension at [test-extensions/panels-test/](../test-extensions/panels-test/)
exercises the panel API: buttons in its popup call `chrome.windows.create`
with various param combinations, list panels via `chrome.windows.getAll`,
and close them. See [test-extensions/panels-test/README.md](../test-extensions/panels-test/README.md)
for the per-button mapping.

## Integration patches

| Patch | What it does |
|---|---|
| [`chrome-browser-extensions-api-tabs-tabs_api.cc.patch`](../src/custom/patches/chrome-browser-extensions-api-tabs-tabs_api.cc.patch) | Adds the `kPanel` `CreateType` branch + early-return with `PanelManager::CreatePanel`; adds a panel-handling branch in `WindowsGetAllFunction::Run` for controllers with no `Browser*`. |
| [`chrome-browser-extensions-chrome_extensions_browser_client.cc.patch`](../src/custom/patches/chrome-browser-extensions-chrome_extensions_browser_client.cc.patch) | Moves `kPanel` out of the `CreateForExtension` switch branch and into the "tracked by other tags" branch when `ENABLE_PANELS=1`, so `SetViewType(..kPanel)` doesn't trip `IsExtensionWebContents`'s DCHECK. |
| [`chrome-browser-task_manager-web_contents_tags.{cc,h}.patch`](../src/custom/patches/) | Adds `WebContentsTags::CreateForPanel(web_contents, panel)` and the `PanelTag` registration; gates the new declarations behind `BUILDFLAG(ENABLE_PANELS)`; adds the missing `class Panel;` forward decl. |
| [`chrome-browser-extensions-api-tabs-windows_event_router.cc.patch`](../src/custom/patches/) | Allows `chrome.windows.onCreated` / `onRemoved` to fire for panels — previously short-circuited on null `GetBrowser()`. |

All patches regenerate from live source via the project's patch-regen script —
edit the live `.cc`/`.h` files under `src/chrome/...`, not the `.patch` files.
