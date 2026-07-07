---
title: "Vertical Tabs"
description: "Replaces the horizontal tab strip with a narrow vertical column on the side of the browser window. Native Views implementation — no WebUI or IPC layer. Supports hover-expand animation, full keyboard navigation, and live sync with the tab model."
category: "Features"
tags: ["tabs", "ui", "views", "buildflag", "vertical-tabs"]
difficulty: "advanced"
date: "2026-07-02"
author: "Wanderlust Team"
estimated_reading_time: "15 minutes"
---

# Vertical Tabs

Gated by `BUILDFLAG(ENABLE_VERTICAL_TABS)`. Replaces the default horizontal
tab strip across the top of the browser window with a narrow vertical
column on the side, hosting per-tab buttons. Implementation lives entirely
in native Views — no WebUI, no IPC layer — so it can participate in window
dragging, focus traversal, drag-from-outside drops, and theme propagation
the way upstream tab UI does.

## Build / activation

| Where | What |
|---|---|
| [`custom_browser_config.gni`](../src/custom/custom_browser_config.gni) | `enable_vertical_tabs = true` (gates source compilation + BrowserView wiring) |
| [`custom_features_buildflags.h`](../src/custom/buildflags/BUILD.gn) | `BUILDFLAG(ENABLE_VERTICAL_TABS)` macro generated for `#if`-gating C++ |
| Per-profile pref | `TabService::IsVerticalTabBarEnabled()` — runtime toggle, read on construction and on subsequent `UpdateMode`/position changes |
| Sources | `custom_browser_ui_sources` block in [`browser/ui/sources.gni`](../src/custom/browser/ui/sources.gni) and an `if (enable_vertical_tabs)` block in [`browser/ui/BUILD.gn`](../src/custom/browser/ui/BUILD.gn) |

## Architecture

```
BrowserView (upstream, patched in chrome-browser-ui-views-frame-browser_view.cc.patch)
├── VerticalTabBar                      ← container, hover-expand animation
│   ├── TabStripRegionView (upstream)   ← first child, bounded to kHeaderHeight band
│   │   └── TabStripScrollContainer
│   │       └── TabStrip               ← upstream; hidden in vertical mode
│   │           └── tab_container_
│   └── button_container_ (views::View) ← second child; starts at y=kHeaderHeight
│       ├── VerticalTabButton           ← one per TabStripModel index
│       ├── VerticalTabButton
│       ├── ...
│       └── new_tab_button_in_bar_      ← trailing "+ New tab" affordance
└── (rest of BrowserView)
```

Two custom Views plus a small button-host container — no parenting under
upstream `TabStrip`:

| Class | File | Role |
|---|---|---|
| `VerticalTabBar` | [`vertical_tab_bar.{h,cc}`](../src/custom/browser/ui/views/frame/vertical_tab_bar.cc) | Outer container. Hosts the upstream `TabStripRegionView` and a sibling `button_container_`. Owns the hover-expand `gfx::SlideAnimation` (50 px → 250 px). Acts as `TabStripModelObserver` to keep the button list synced. |
| `VerticalTabButton` | [`vertical_tab_button.{h,cc}`](../src/custom/browser/ui/views/frame/vertical_tab_button.cc) | Per-tab widget: favicon + label + close (✕). Inherits `views::Button`; focus ring; keyboard nav (`Up`/`Down`/`Home`/`End`/`Delete`); selected/hover backgrounds resolved from the theme. |

The bar **wraps the upstream `TabStripRegionView`** rather than replacing
it — this keeps the upstream tab-model machinery alive (drag-from-outside
drop target, accessibility hookup, focus traversal scaffolding). The
`VerticalTabButton`s live in a **sibling `button_container_` View** that
paints over the region view; upstream `TabStrip` keeps its sole child
`tab_container_` (upstream M128 made that a hard `CHECK`).

## Lifecycle and the construction-order quirk

```
1.  BrowserView ctor
      └── vertical_tab_bar_ = AddChildView(new VerticalTabBar(this, profile));
2.  VerticalTabBar::Init()        ← runs before our children exist
      ├── reads TabService prefs (position, mode)
      ├── SetBorderStyle()
      ├── EnsureTabStripVisible() ← finds nothing, no-op
      ├── ReplaceTabsWithButtons()← finds no TabStrip, no-op
      └── observed_model_->AddObserver(this)
3.  BrowserView ctor (continuing)
      └── tab_strip_region_view_ = vertical_tab_bar_->AddChildView(
            std::make_unique<TabStripRegionView>(std::move(tabstrip)));
4.  vertical_tab_bar_->EnsureTabStripVisible()  ← BrowserView calls this AFTER (3)
      ├── EnsureViewCacheIsBuilt()              ← finds TabStrip + NewTabButton(s)
      ├── snaps bounds, hides upstream new-tab button(s)
      └── first-time-only: ReplaceTabsWithButtons()
                          ← builds the initial button list from the model
```

The `view_cache_built_` latch in `EnsureTabStripVisible` bridges the gap:
the first successful build is also when the initial button list gets
populated.

## TabStripModelObserver synchronization

| `TabStripModelChange::type()` | What we do |
|---|---|
| `kInserted` | Build a `VerticalTabButton`, `AddChildViewAt(button, index)` on `button_container_`; insert into `tab_buttons_` at the same index. |
| `kRemoved` | Look up `tab_buttons_[index]`, `RemoveChildViewT(button)` from `button_container_`, erase from the vector. |
| `kMoved` | Reorder both the view child slot (`button_container_->ReorderChildView`) and the `tab_buttons_` vector. |
| `kReplaced` | `UpdateButtonData(index, new_contents)` — refresh title + favicon for the new WebContents in that slot. |
| `kSelectionOnly` | `UpdateActiveSelection()` — walk `tab_buttons_` and set `selected_` on whichever matches `active_index()`. |

Per-button identity is `content::WebContents*` captured at construction —
`OnTabButtonPressed` resolves `c` to its *current* model index at click time
via `GetIndexOfWebContents`, so a tab moved between creation and click still
activates correctly.

## Layout strategy

- **Outer `VerticalTabBar` bounds** are sized by `BrowserViewLayout`, which reads `vertical_tab_bar_->width()`. Width animates 50 → 250 px on hover via `gfx::SlideAnimation`.
- **`TabStripRegionView`** (first child) bounded to `(0, 0, width_, kHeaderHeight)` — confined to the header band. Its `FrameGrabHandle` is `SetVisible(false)` to avoid swallowing clicks in the vertical column.
- **`button_container_`** (second child) held at `(0, kHeaderHeight, width_, height() - kHeaderHeight)`. `BoxLayout::kVertical` with cross-axis `kStretch` and `inside_border_insets = gfx::Insets::VH(4, 6)` plus 2 px between-child spacing.
- **Each `VerticalTabButton`** gets `SetPreferredSize(gfx::Size(0, kButtonHeight))`. BoxLayout reads `kButtonHeight` as the vertical extent; cross-axis stretch overrides the zero width. No manual `SetBounds` per button.
- Layout is entirely BoxLayout-driven — mutations call `InvalidateLayout` on `button_container_` and the layout manager re-positions everything on the next pass.
- Inside each button, `views::BoxLayout` arranges `favicon → label → close` left-to-right. `SetFlexForView(label_, 1)` anchors favicon to the left and close to the right. Label uses `gfx::ELIDE_TAIL`.

## Theming

| Surface | ColorId |
|---|---|
| Bar background | `kColorToolbar` |
| Bar border (1 px sided) | `kColorToolbarSeparator` |
| Button selected state | `kColorTabBackgroundActiveFrameActive` |
| Button hover state | `kColorTabBackgroundInactiveHoverFrameActive` |
| Close-icon foreground | `kColorNewTabButtonForegroundFrameActive` |

No `SK_ColorWHITE` / `SK_ColorGRAY` literals — bar and buttons follow dark
mode, custom themes, and frame-active transitions without manual repainting.

## Keyboard navigation

| Key | Behavior |
|---|---|
| `Up` | Focus previous sibling button (wraps at top) |
| `Down` | Focus next sibling button (wraps at bottom) |
| `Home` | Focus first button |
| `End` | Focus last button |
| `Enter` / `Space` | Activate the tab |
| `Delete` | Close the tab |

Arrow nav moves *focus only* — does not auto-activate the tab.

## Known issues / future work

- **Vertical → horizontal mode switch leaves the horizontal strip broken** (no `+` button, tabs blank, flicker on new-tab). Workaround: restart after switching back. See `troubleshooting/vertical-to-horizontal-switch.md`.
- **`Init()` runs before children attach** — already worked around via the `view_cache_built_` latch. Low priority to fix.
- **Drag-and-drop reorder** — clicking and dragging a `VerticalTabButton` does nothing. Wiring `views::DragController` on `VerticalTabButton` is unblocked (no upstream `TabDragController` to coexist with).
- **Pinned tabs and tab groups** are not visually distinguished — the model state is observed but `VerticalTabButton` doesn't render group color bars or the pinned-tab compact form.
- **Cached pointers are by class-name string match** — `EnsureViewCacheIsBuilt` finds views via `GetClassName()`. An upstream rename silently breaks visibility/hit-testing without a compile error.

## File map

### Active

| File | Purpose |
|---|---|
| [`vertical_tab_bar.{h,cc}`](../src/custom/browser/ui/views/frame/vertical_tab_bar.cc) | Container view. `TabStripModelObserver`. Owns hover animation, cached view pointers, the `tab_buttons_` vector. |
| [`vertical_tab_button.{h,cc}`](../src/custom/browser/ui/views/frame/vertical_tab_button.cc) | Per-tab widget. Inherits `views::Button`. Focus ring, themed states, keyboard nav. |

### Patched upstream files

| Patch | What it touches |
|---|---|
| `chrome-browser-ui-views-frame-browser_view.{h,cc}.patch` | Adds `vertical_tab_bar_` member to BrowserView. Parents the `TabStripRegionView` into the vertical bar when the pref is enabled. Calls `EnsureTabStripVisible()` after the parent set. |
| `chrome-browser-ui-views-frame-browser_view_layout.{h,cc}.patch` | `BrowserViewLayout::LayoutVerticalTabBar()` — sizes the bar within the BrowserView slot using `vertical_tab_bar_->width()`. |

### Service

| File | Role |
|---|---|
| [`tab_service.{h,cc}`](../src/custom/browser/tab/) | Profile-keyed pref reader: `IsVerticalTabBarEnabled`, `GetTabBarPosition` (LEFT / RIGHT / TOP), `GetVerticalTabBarMode`. |

## Manual test (post-build)

1. Open Settings → enable the vertical tabs pref.
2. Click around the title bar — vertical tab bar appears on the left or right (per `position`), default 50 px wide. The horizontal tab strip should disappear.
3. Hover over the bar — it expands to ~250 px over 200 ms; each button grows horizontally with it. Move the mouse away — buttons shrink back.
4. Open a new tab (`Ctrl+T`) — a button appears at the end of the strip live, no reload needed.
5. Type a URL in a tab and watch the title/favicon update — the button's label updates immediately.
6. Click a button — its tab becomes active in the content area.
7. Click the ✕ — the tab closes; the button vanishes from the strip.
8. Reorder tabs using `Ctrl+Shift+PageUp/Down` — the vertical strip reorders in lockstep.
9. Tab into the vertical strip, then `Up`/`Down`/`Home`/`End` to navigate; `Enter` activates; `Delete` closes the focused tab.
10. Toggle dark mode — bar background, separator, button states all change theme correctly.
