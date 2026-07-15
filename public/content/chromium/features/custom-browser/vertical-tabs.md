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
│   ├── TabStripRegionView (upstream)   ← first child, bounded to the top
│   │   │                                   kHeaderHeight band so its
│   │   │                                   FrameGrabHandle doesn't swallow
│   │   │                                   clicks below the header. The
│   │   │                                   FrameGrabHandle itself is also
│   │   │                                   SetVisible(false) so it doesn't
│   │   │                                   cover the search caret inside
│   │   │                                   the header. We hide its
│   │   │                                   NewTabButton; the TabSearchButton
│   │   │                                   is positioned manually at top-left.
│   │   │                                   Its TabStrip is SetVisible(false).
│   │   └── TabStripScrollContainer
│   │       └── TabStrip                ← upstream; hidden in vertical mode
│   │           └── tab_container_      ← upstream; sole direct child of TabStrip
│   └── button_container_ (views::View) ← second child; starts at y=kHeaderHeight
│       │                                   so it sits below the header band
│       │                                   instead of overlapping it.
│       │                                   BoxLayout::kVertical with cross-axis
│       │                                   kStretch. Owns the buttons.
│       ├── VerticalTabButton           ← one per TabStripModel index
│       ├── VerticalTabButton
│       ├── ...
│       └── new_tab_button_in_bar_      ← trailing "+ New tab" affordance.
│                                          views::LabelButton; always last
│                                          child because tab buttons insert
│                                          at indices 0..N-1.
└── (rest of BrowserView)
```

Two custom Views plus a small button-host container — no parenting under
upstream `TabStrip`:

| Class | File | Role |
|---|---|---|
| `VerticalTabBar` | [`vertical_tab_bar.{h,cc}`](../src/custom/browser/ui/views/frame/vertical_tab_bar.cc) | Outer container. Hosts the upstream `TabStripRegionView` and a sibling `button_container_`. Owns the hover-expand `gfx::SlideAnimation` (50 px → 250 px). Acts as `TabStripModelObserver` to keep the button list synced. Pushes pinned/group state to each button via `UpdateButtonData` and `InsertButtonForContents`. |
| `VerticalTabButton` | [`vertical_tab_button.{h,cc}`](../src/custom/browser/ui/views/frame/vertical_tab_button.cc) | Per-tab widget: favicon + label + close (✕). Inherits `views::Button`; focus ring; keyboard nav (`Up`/`Down`/`Home`/`End`/`Delete`); selected / hover backgrounds resolved from the theme. Pinned tabs hide the label and close button for a compact icon-only row. Tab group membership is shown as a 3 px color stripe on the bar-facing edge. |

The bar **wraps the upstream `TabStripRegionView`** rather than replacing
it — this keeps the upstream tab-model machinery alive (drag-from-outside
drop target, accessibility hookup, focus traversal scaffolding). The
`VerticalTabButton`s live in a **sibling `button_container_` View** that
paints over the region view; upstream `TabStrip` keeps its sole child
`tab_container_` (upstream M128 made that a hard `CHECK` — parenting our
buttons under `TabStrip` crashed `TabStrip::GetAvailableSize`).

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

`Init()` running before children are attached is awkward but matches the
patch order in `chrome-browser-ui-views-frame-browser_view.cc.patch`.
The `view_cache_built_` latch in `EnsureTabStripVisible` is what bridges
the gap: the first successful build is also when the initial button list
gets populated. Without that latch, opening a new window with vertical
tabs enabled would show an empty strip until the first tab change.

## TabStripModelObserver synchronization

After `Init()` registers the observer, every model mutation flows through
`OnTabStripModelChanged`:

| `TabStripModelChange::type()` | What we do |
|---|---|
| `kInserted` | For each `ContentsWithIndex`, build a `VerticalTabButton`, give it `SetPreferredSize(0, kButtonHeight)`, and `AddChildViewAt(button, index)` on `button_container_`; insert into `tab_buttons_` at the same index. BoxLayout positions it. |
| `kRemoved` | For each removed entry, look up `tab_buttons_[index]`, `RemoveChildViewT(button)` from `button_container_`, erase from the vector. |
| `kMoved` | Reorder both the view child slot (`button_container_->ReorderChildView`) and the `tab_buttons_` vector. |
| `kReplaced` | `UpdateButtonData(index, new_contents)` — refresh title + favicon for the new WebContents in that slot (no relayout: the slot stays the same size) |
| `kSelectionOnly` | `UpdateActiveSelection()` — walk `tab_buttons_` and set `selected_` on whichever matches `active_index()` |

The trailing `new_tab_button_in_bar_` (a plain `views::LabelButton` with the `+` vector icon and "New tab" label) is **not** in `tab_buttons_` and **not** an observer of the model — clicking it calls `chrome::NewTab(browser)`, which feeds back through the model into the `kInserted` path above and produces a real `VerticalTabButton` at index N. The "+" view stays at slot N+1 (still last) because tab-button inserts use `AddChildViewAt` with model indices 0..N-1.

Plus `TabChangedAt(contents, index, change_type)` which fires for
title/favicon/load-state changes — pulls fresh data from the
`WebContents` and calls `SetTitle` / `SetFavicon` on the affected button.

Per-button identity is `content::WebContents*` captured at construction:
`OnTabButtonPressed(WebContents* c)` and `OnTabCloseRequested(WebContents* c)`
resolve `c` to its *current* model index at click time via
`GetIndexOfWebContents`. This means a tab moved by another window action
between button creation and click still activates correctly — index
binding would have activated the wrong tab.

## Layout strategy

Every level of the bar tracks the same animated width — there's no
clipping; the buttons themselves grow and shrink.

- **Outer `VerticalTabBar` bounds** are sized by `BrowserViewLayout`, which reads `vertical_tab_bar_->width()`. The width member animates 50 → 250 on hover via `gfx::SlideAnimation` (`kStartWidth` → `kStartWidth + kExpandedWidth`).
- **`TabStripRegionView`** (first child of the bar) is bounded to `(0, 0, width_, kHeaderHeight)` — confined to the header band. The tab-search affordance inside it is positioned manually (see below) so we don't need region view to be full-height. Keeping it full-height previously meant its internal `FrameGrabHandle` (which returns true from `IsRectInWindowCaption` so the OS treats it as window-drag space) covered the whole vertical column and swallowed clicks meant for `button_container_`'s tab buttons and the trailing "+ New tab" affordance.
- **`button_container_`** (second child of the bar) is held at `(0, kHeaderHeight, width_, height() - kHeaderHeight)` — sits directly below the header band. It uses `BoxLayout::kVertical` with cross-axis `kStretch` and `inside_border_insets = gfx::Insets::VH(4, 6)` plus 2 px between-child spacing. The horizontal insets keep the selected/hover background of each button from cutting through the bar's sided border.
- **Hosted upstream `TabStrip`** is `SetVisible(false)` — we don't host buttons under it and we don't want its `Tab` children rendering or firing upstream hover-cards. `TabSearchButton` is unaffected because it's a sibling of `TabStrip` inside `TabStripRegionView`, not a child of `TabStrip`.
- **Tab-search affordance** (`TabStripComboButton` when the upstream combo-button flag is on, otherwise `TabSearchContainer`) is found during `EnsureViewCacheIsBuilt` — whichever wrapper is outermost in tree walk (combo > container > button) wins. It stays a child of `TabStripRegionView` (an earlier attempt to reparent it into `VerticalTabBar` tripped `DCHECK_EQ(children_.size(), …)` in `View::ReorderChildLayers` because `TabStripRegionView::GetChildrenInZOrder` still emits the moved view via its `tab_strip_combo_button_` / `tab_search_container_` raw_ptrs). Instead each layout pass we set `kViewIgnoredByLayoutKey`, force-visible, and `SetBounds` it to the top-left of the header band in region-view-local coords. Two upstream paths still want to move it; we neutralize both:
  - `TabStripRegionView::Layout` repositions the "button to paint to layer" (combo button) to `tab_strip_container_->bounds().right() + …` every layout pass — at 50 px wide that's off-screen. We patch `Layout` to early-return in vertical mode after the FlexLayout pass.
  - `TabStripRegionView`'s internal `FrameGrabHandle` is emitted **last** in `GetChildrenInZOrder` (so it paints on top), and its `FlexSpecification(kPreferred, kUnbounded, order 3)` sizes it to fill the leftover vertical space in a 32 px-tall region view. Reverse-order hit testing then hands every click in the header to the (no-op) grab handle. We cache it by `"FrameGrabHandle"` class name and `SetVisible(false)` it — window-drag through this strip is not needed when the bar is on the side.

  The new-tab hide pass exempts the cached affordance by pointer identity so the search caret stays visible even when the wrapper carries the new-tab element id (combo button does).
- **Each `VerticalTabButton`** gets `SetPreferredSize(gfx::Size(0, kButtonHeight))`. BoxLayout reads `kButtonHeight` as the main-axis (vertical) extent; cross-axis (horizontal) stretch overrides the zero width to match container width. No manual `SetBounds` per button.

Layout is entirely BoxLayout-driven — there's no `RelayoutButtons()`
loop anymore. Mutations (insert / remove / move) call `InvalidateLayout`
on `button_container_` and the layout manager re-positions everything on
the next pass.

Inside each `VerticalTabButton`, `views::BoxLayout` arranges
`favicon → label → close` left-to-right, and `SetFlexForView(label_, 1)`
gives the label all the extra horizontal space. That anchors the
favicon to the left edge and the close button (✕) to the right edge
when the bar is expanded — without flex, all three pack tightly at the
left and the close button sits next to the label with no gap. The
label uses `gfx::ELIDE_TAIL` so long titles truncate with an ellipsis
instead of pushing the close button off-screen.

At the collapsed width (50 px), the label flexes down to zero and only
the favicon (and the close button, anchored at the right) are visible.
Hovering grows the buttons to full 250 px and the label reappears in
the gap that opens up.

`EnsureTabStripVisible` runs from `Layout(PassKey)`. After cache build,
it's cheap — two `SetBounds` calls on cached pointers + `SetVisible`
on the cached new-tab-button list. No recursion, no class-name string
matching. Button layout is handled by `button_container_`'s BoxLayout
on the same Layout pass.

`AnimationProgressed` calls `InvalidateLayout()` only when the
integer-rounded width actually changes. `gfx::Tween::IntValueBetween`
quantizes, so endpoints and plateaus skip the layout pass.

## Theming

Every color resolves through the active `ui::ColorProvider`:

| Surface | ColorId |
|---|---|
| Bar background | `kColorToolbar` |
| Bar border (1 px sided, left or right depending on position) | `kColorToolbarSeparator` |
| Button selected state | `kColorTabBackgroundActiveFrameActive` |
| Button hover state | `kColorTabBackgroundInactiveHoverFrameActive` |
| Close-icon foreground | `kColorNewTabButtonForegroundFrameActive` |

No `SK_ColorWHITE` / `SK_ColorGRAY` literals anywhere — the bar and
buttons follow dark mode, custom themes, and frame-active transitions
without manual repainting.

## Keyboard

`VerticalTabButton` overrides `OnKeyPressed`:

| Key | Behavior |
|---|---|
| `Up` | Focus previous sibling button (wraps at top) |
| `Down` | Focus next sibling button (wraps at bottom) |
| `Home` | Focus first button |
| `End` | Focus last button |
| `Enter` / `Space` | Activate the tab (default `views::Button` behavior → fires the per-button `PressedCallback` → `OnTabButtonPressed` → `ActivateTabAt`) |
| `Delete` | Closes the tab (fires `close_callback_` → `OnTabCloseRequested` → `CloseWebContentsAt(CLOSE_USER_GESTURE \| CLOSE_CREATE_HISTORICAL_TAB)`) |
| Anything else | Falls through to `views::Button::OnKeyPressed` |

Arrow nav moves *focus only* — does not auto-activate the tab. If you'd
rather have "arrow to switch tabs" behavior (Edge-style), add a
`PressedCallback` invocation in the arrow branch after `RequestFocus()`.

Sibling enumeration uses `views::AsViewClass<VerticalTabButton>(child)`
rather than `static_cast` — any non-VerticalTabButton sneakily added to
the strip is silently skipped instead of crashing arrow nav.

## Pinned tabs and tab groups

`VerticalTabBar::UpdateButtonData` and `InsertButtonForContents` both query
the `TabStripModel` and push state to each button:

| Model state | `VerticalTabButton` API | Visual effect |
|---|---|---|
| `model->IsTabPinned(index)` | `SetPinned(true)` | Hides `label_` and `close_button_` — the button renders as a compact 32 px icon-only row |
| `model->GetTabGroupForTab(index)` → `TabGroupModel` → `TabGroupVisualData::color()` | `SetGroupColor(SkColor)` | Paints a 3 px solid stripe on the bar-facing edge of the button using a hardcoded 9-color palette matching `tab_groups::TabGroupColorId` |

Group colors are hardcoded in an anonymous-namespace array in `vertical_tab_bar.cc`
(`GetTabGroupStripeColor`), indexed by `static_cast<int>(color_id)`. This avoids
threading a `ui::ColorProvider` down to the button layer. The palette matches
Chrome's default group color swatch set (grey, blue, red, yellow, green, orange,
purple, cyan, orange-2).

Pinned state and group color are re-pushed on every `UpdateButtonData` call
(triggered by `TabChangedAt` and `OnTabStripModelChanged`) so they stay
current as tabs are grouped/ungrouped or pinned/unpinned.

## Intentional non-presence

The repo used to contain `VerticalTab`, `VerticalTabStripRegionView`,
and `VerticalTabCloseButton` (~2 000 lines, near-line-for-line clones of
the upstream `Tab` / `TabStripRegionView` / `TabCloseButton`). They had
no external callers anywhere in the codebase and represented a
maintenance burden — every upstream tweak to those files silently
bit-rotted them. Deleted in [feat: vertical tabs cleanup pass](#).

**If you find yourself reaching for a "vertical Tab" class, don't add it
back.** The lightweight `VerticalTabButton` is the per-tab widget; the
upstream `Tab` is unused in vertical mode by design (horizontal-only
layout). Anything you'd want from the upstream `Tab` (alert states, tab
groups visualization, freezing votes) needs to be folded into
`VerticalTabButton` directly.

## Known issues / future work

- **Vertical → horizontal mode switch leaves the horizontal strip broken**
  (no `+` button, tabs blank, flicker on new-tab) — see
  [troubleshooting/vertical-to-horizontal-switch.md](troubleshooting/vertical-to-horizontal-switch.md)
  for symptoms, repro, and the six attempted fixes that didn't resolve it.
  Workaround: restart after switching back.
- **`Init()` runs before children attach** — already worked around via the
  `view_cache_built_` latch, but it's still a smell. Tightening would
  require either reordering the BrowserView patch or moving `Init()`'s
  observer registration into `EnsureTabStripVisible`. Low priority.
- **Activation semantics on arrow nav** — see Keyboard above. Decide
  product-wise whether arrows should auto-switch tabs or just move focus.
- **Hover-expand animation cost** — bar outer width animates per frame.
  After the cache + integer-equality fixes, the per-frame cost is
  bounded (cached pointer SetBounds + a BoxLayout pass over N buttons),
  but it's still a real layout pass. If hover feels janky on slow
  machines with many tabs, the longer-term fix is to layer-transform
  the bar rather than resize it.
- **`raw_ptr` trait mismatch** — `View::children().front()` returns a
  `raw_ptr<View, kMayDangle>`; our `tab_strip_region_view_` member uses
  the plain trait. Code that assigns from `children()` to a non-dangling
  `raw_ptr` member needs `.get()` to drop to the underlying pointer.
- **Cached pointers into upstream are by class-name string match** —
  `EnsureViewCacheIsBuilt` finds `TabStrip`, the tab-search affordance
  (combo / container / button), the `FrameGrabHandle`, and the upstream
  new-tab button(s) via `GetClassName()` comparisons. An upstream rename
  silently breaks visibility/hit-testing here without a compile error.
  Belt-and-braces would be element identifiers or a dedicated
  upstream-side accessor, but that needs more patching.

## File map

### Active

| File | Purpose |
|---|---|
| [`vertical_tab_bar.{h,cc}`](../src/custom/browser/ui/views/frame/vertical_tab_bar.cc) | Container view. TabStripModelObserver. Owns hover animation, cached view pointers, the `tab_buttons_` vector. |
| [`vertical_tab_button.{h,cc}`](../src/custom/browser/ui/views/frame/vertical_tab_button.cc) | Per-tab widget. Inherits `views::Button`. Focus ring, themed states, keyboard nav. |

### Patched (upstream files modified)

| Patch | What it touches |
|---|---|
| [`chrome-browser-ui-views-frame-browser_view.{h,cc}.patch`](../src/custom/patches/chrome-browser-ui-views-frame-browser_view.cc.patch) | Adds `vertical_tab_bar_` member to BrowserView. Parents the `TabStripRegionView` into the vertical bar when the pref is enabled. Calls `EnsureTabStripVisible()` after the parent set. |
| [`chrome-browser-ui-views-frame-browser_view_layout.{h,cc}.patch`](../src/custom/patches/chrome-browser-ui-views-frame-browser_view_layout.cc.patch) | `BrowserViewLayout::LayoutVerticalTabBar()` — sizes the bar within the BrowserView slot using `vertical_tab_bar_->width()`. |

### Service (existing, not part of vertical-tabs proper)

| File | Role |
|---|---|
| [`tab_service.{h,cc}`](../src/custom/browser/tab/) | Profile-keyed pref reader: `IsVerticalTabBarEnabled`, `GetTabBarPosition` (LEFT / RIGHT / TOP), `GetVerticalTabBarMode`. Owned by `Browser`'s profile, not the bar. |

## Manual test (post-build)

1. Open Settings → enable the vertical tabs pref.
2. Click around the title bar — vertical tab bar appears on the left or right (per `position`), default 50 px wide. The horizontal tab strip should disappear.
3. Hover over the bar — it expands to ~250 px over 200 ms; **each button grows horizontally with it**, from a favicon-only column at 50 px to the full row (favicon + title + ✕) at 250 px. Move the mouse away — buttons shrink back. The label and close glyphs aren't faded in/out; they're overflow-clipped by the button's own bounds while the bar is narrow.
4. Open a new tab (`Ctrl+T`) — a button appears at the end of the strip live, no reload needed.
5. Type a URL in a tab and watch the title update — the button's label updates immediately. Same for the favicon as it loads.
6. Click a button — its tab becomes active in the content area.
7. Click the ✕ — the tab closes; the button vanishes from the strip.
8. Reorder tabs by dragging in another window or using `Ctrl+Shift+PageUp/Down` — the vertical strip reorders in lockstep.
9. Tab into the vertical strip, then `Up`/`Down`/`Home`/`End` to navigate; `Enter` activates; `Delete` closes the focused tab. Each focused button shows the standard Chromium focus ring.
10. Toggle dark mode — bar background, separator, button states all change theme correctly (no white sliver).
