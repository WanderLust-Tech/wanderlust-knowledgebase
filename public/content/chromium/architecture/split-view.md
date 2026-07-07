# Split View

Split view provides a secondary web panel that appears alongside the main browser content. When shown, it defaults to half the available content width with a draggable divider separating it from the primary content.

## Build flag

Controlled by `enable_split_view = false` in `src/custom/custom_browser_config.gni`. Disabled by default. Enable with:

```gn
enable_split_view = true
```

At the C++ level this surfaces as `BUILDFLAG(ENABLE_SPLIT_VIEW)` from `custom/buildflags/custom_features_buildflags.h`.

## Architecture

```
BrowserView (root)
 ├── top_container_          (toolbar, tab strip)
 ├── toolbar_web_view_       [ENABLE_SPLIT_VIEW] SplitViewWebView panel
 ├── split_divider_view_     [ENABLE_SPLIT_VIEW] SplitViewDivider drag handle
 ├── contents_container_     main content + devtools
 └── unified_side_panel_     Chromium side panel
```

`toolbar_web_view_` is a `SplitViewWebView` (a `views::WebView` subclass) added as a direct child of `BrowserView`. It is positioned by `BrowserViewLayout::CustomLayoutContainers` in the same pass that positions `contents_container_`, `sidebar_container_`, and `vertical_tab_bar_`.

`split_divider_view_` is a `SplitViewDivider` (a `views::View` subclass defined in `browser_view.cc`) that sits between the panel and the main content. It renders an east-west resize cursor and fires a drag callback to `BrowserView::SetSplitDividerX` as the user drags.

### SplitViewWebView

`SplitViewWebView` extends `views::WebView` with three behaviours:

1. **In-panel navigation** — `OpenURLFromTab` intercepts all navigations (including new-tab dispositions) and loads them inside the panel via `NavigationController::LoadURLWithParams`.
2. **Focus callbacks** — `OnWebContentsFocused` / `OnWebContentsLostFocus` fire a `FocusChangedCallback` that `BrowserView` uses to set `split_view_active_` and update the omnibox.
3. **Tab helper attachment** — The constructor registers an `AddWebContentsAttachedCallback` that calls `TabHelpers::AttachTabHelpers` on the panel's `WebContents` the moment it is created. This gives the panel a password manager, translate, content settings, mixed content handling, and all other standard tab helpers. `SplitViewWebView` is a declared friend of `TabHelpers` in `tab_helpers.h` to enable this.

## Key files

| File | Role |
|---|---|
| [src/custom/browser/ui/split_view_web_view.h](../../src/custom/browser/ui/split_view_web_view.h) | `SplitViewWebView` declaration |
| [src/custom/browser/ui/split_view_web_view.cc](../../src/custom/browser/ui/split_view_web_view.cc) | `SplitViewWebView` implementation |
| [src/chrome/browser/ui/views/frame/browser_view.h](../../src/chrome/browser/ui/views/frame/browser_view.h) | Members: `toolbar_web_view_`, `split_divider_view_`, `split_divider_x_`, `split_view_active_`; methods: `ShowToolbarWebView()`, `HideToolbarWebView()`, `OnSplitViewFocusChanged()`, `SetSplitDividerX()` |
| [src/chrome/browser/ui/views/frame/browser_view.cc](../../src/chrome/browser/ui/views/frame/browser_view.cc) | Construction, `ShowToolbarWebView()`, `HideToolbarWebView()`, `SplitViewDivider` class (anonymous namespace) |
| [src/chrome/browser/ui/views/frame/browser_view_layout.cc](../../src/chrome/browser/ui/views/frame/browser_view_layout.cc) | `CustomLayoutContainers` — positions panel and divider, adjusts `contents_container_` bounds |
| [src/chrome/browser/ui/tab_helpers.h](../../src/chrome/browser/ui/tab_helpers.h) | `SplitViewWebView` friend declaration |
| [src/chrome/browser/renderer_context_menu/render_view_context_menu.cc](../../src/chrome/browser/renderer_context_menu/render_view_context_menu.cc) | "Open link in split view" context menu item |
| [src/chrome/browser/ui/browser_navigator.cc](../../src/chrome/browser/ui/browser_navigator.cc) | Omnibox navigation redirect to panel when `split_view_active_` |

## Entry points

### Toggling the panel

| Trigger | Detail |
|---|---|
| **Toolbar button** | `SplitViewButton` — calls `IDC_TOGGLE_SPLIT_VIEW` |
| **App menu** | "Toggle Split View" item in the zoom/print section |
| **Keyboard shortcut** | `Ctrl+Shift+E` |
| **Right-click menu** | "Open link in split view" on any link (`IDC_CONTENT_CONTEXT_OPEN_IN_SPLIT_VIEW = 33304`) |

All toggle triggers dispatch `IDC_TOGGLE_SPLIT_VIEW` (33303) through `BrowserCommandController` to `BrowserView::ToggleSplitView()`. The right-click item calls `BrowserView::ShowToolbarWebView(link_url)` directly.

### Relevant files for entry points

| File | Role |
|---|---|
| [src/chrome/app/chrome_command_ids.h](../../src/chrome/app/chrome_command_ids.h) | `IDC_TOGGLE_SPLIT_VIEW = 33303`, `IDC_CONTENT_CONTEXT_OPEN_IN_SPLIT_VIEW = 33304` |
| [src/custom/browser/ui/views/toolbar/split_view_button.cc](../../src/custom/browser/ui/views/toolbar/split_view_button.cc) | Toolbar button |
| [src/chrome/browser/ui/toolbar/app_menu_model.cc](../../src/chrome/browser/ui/toolbar/app_menu_model.cc) | App menu item |
| [src/chrome/browser/ui/views/accelerator_table.cc](../../src/chrome/browser/ui/views/accelerator_table.cc) | `Ctrl+Shift+E` → `IDC_TOGGLE_SPLIT_VIEW` |
| [src/chrome/browser/renderer_context_menu/render_view_context_menu.cc](../../src/chrome/browser/renderer_context_menu/render_view_context_menu.cc) | Right-click "Open link in split view" |

## Showing and hiding the panel

```cpp
// Toggle (show if hidden, hide if visible)
browser_view->ToggleSplitView();

// Show and load a URL into the panel
browser_view->ShowToolbarWebView(GURL("https://example.com"));

// Show without changing the loaded URL
browser_view->ShowToolbarWebView();

// Hide (also resets divider position)
browser_view->HideToolbarWebView();
```

All methods call `InvalidateLayout()` so the content area reflows on the next paint cycle. Visibility state is not persisted across sessions.

## Layout

`BrowserViewLayout::CustomLayoutContainers` runs on every layout pass. When `toolbar_web_view_->GetVisible()` is true:

1. Panel width is computed from `split_divider_x_` (stored in `BrowserView` coordinates). When `split_divider_x_ == -1` (the default), the panel takes exactly half of the available content width.
2. A 4 px divider (`split_divider_view_`) is placed immediately to the right of the panel.
3. `contents_container_` fills the remaining space.
4. Panel width is clamped to `[100px, content_width - 4px - 100px]` so neither pane can be collapsed below 100 px.

The panel respects the existing sidebar and vertical tab bar — those are subtracted from `contents_width` first.

When hidden the panel and divider are collapsed to zero bounds.

### Dragging the divider

`SplitViewDivider` stores drag-start state on `OnMousePressed` and calls `BrowserView::SetSplitDividerX(new_x)` on each `OnMouseDragged`. `SetSplitDividerX` stores the value in `split_divider_x_` and calls `InvalidateLayout()`. On `OnMouseCaptureLost` the divider snaps back to its position at drag start.

## In-panel navigation

`SplitViewWebView::OpenURLFromTab` captures all navigations originating from the panel (including `NEW_FOREGROUND_TAB`, `NEW_BACKGROUND_TAB`, etc.) and loads them inside the panel. Links never open new browser tabs from within the panel.

## Omnibox behaviour

When the split panel is focused, `BrowserView::split_view_active_` is set to `true` and `UpdateToolbar(panel_wc)` is called with the panel's `WebContents` directly. This causes the omnibox to display the panel's current URL via `omnibox_view_->OnTabChanged(panel_wc)`.

When the user types in the omnibox and presses Enter, `chrome::Navigate` in `browser_navigator.cc` detects `split_view_active_ == true` with a `CURRENT_TAB` disposition and redirects the navigation into the panel via `SplitViewWebView::LoadInitialURL` — the main tab is never disturbed.

### Known limitation — omnibox URL display deferred

`ToolbarView::GetWebContents()` always returns the active tab's `WebContents` (not the panel's). This is required because page action icons (`PriceTrackingIconView`, etc.) call `tabs::TabInterface::GetFromContents(wc)` on whatever `GetWebContents()` returns, and that call crashes if the `WebContents` is not a registered tab in the tab strip. The panel's `WebContents` is never a tab-strip entry.

As a result:
- **Content-setting icons and page action icons always reflect the main tab** — not the panel — even when the panel is focused.
- **The omnibox URL does update** to the panel's URL on focus gain (via the explicit `UpdateToolbar(panel_wc)` call), but page action icons are not affected.
- **Panel navigations while focused do not update the omnibox URL** — only focus gain/loss triggers a refresh.

To fully solve this, the panel's `WebContents` needs a `TabModel` / `TabInterface` registration (see `TabLookupFromWebContents::CreateForWebContents` in `tab_model.cc`). That requires either integrating the panel into the tab strip model as a non-visible entry, or making all page action icons use `TabInterface::MaybeGetFromContents` (the null-safe variant) and handle a null result gracefully.

**TODO**: Revisit omnibox URL display and page action icon support for the split panel once a `TabInterface` strategy is decided.

## Tab helpers

`SplitViewWebView` calls `TabHelpers::AttachTabHelpers` on the panel's `WebContents` as soon as it is created. This is triggered via `AddWebContentsAttachedCallback` registered in the constructor, and `AttachTabHelpers` is idempotent so it is safe to call again if the `WebContents` is ever replaced.

`SplitViewWebView` is listed as a friend of `TabHelpers` in `tab_helpers.h` (under `ENABLE_SPLIT_VIEW`) because `AttachTabHelpers` is private. This is intentional — the panel is a secondary browsing surface that should have password manager, translate, mixed content handling, etc.

## Adding split view to your code

To show the split panel from a `BrowserWindow*`:

```cpp
#if BUILDFLAG(ENABLE_SPLIT_VIEW)
  BrowserView* bv = BrowserView::GetBrowserViewForBrowser(browser);
  if (bv) {
    bv->ShowToolbarWebView(GURL("https://example.com"));
  }
#endif
```

To toggle it (show if hidden, hide if visible):

```cpp
#if BUILDFLAG(ENABLE_SPLIT_VIEW)
  BrowserView* bv = BrowserView::GetBrowserViewForBrowser(browser);
  if (bv)
    bv->ToggleSplitView();
#endif
```

Users can also trigger this via `Ctrl+Shift+E`, the app menu, the toolbar button, or right-clicking any link.
