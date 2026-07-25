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
| `Up` / `K` | Focus previous sibling button (wraps at top) |
| `Down` / `J` | Focus next sibling button (wraps at bottom) |
| `Home` | Focus first button |
| `End` | Focus last button |
| `Enter` / `Space` | Activate the tab (default `views::Button` behavior → fires the per-button `PressedCallback` → `OnTabButtonPressed` → `ActivateTabAt`) |
| `Delete` | Closes the tab (fires `close_callback_` → `OnTabCloseRequested` → `CloseWebContentsAt(CLOSE_USER_GESTURE \| CLOSE_CREATE_HISTORICAL_TAB)`) |
| Anything else | Falls through to `views::Button::OnKeyPressed` |

`J`/`K` are additive aliases for `Down`/`Up` in the same `switch`, for
users with vim/terminal muscle memory. When this was first added
(2026-07-15) it was deliberately scoped to just these two keycodes — no
`gg`/`G`, no counts, no mode switching. That full set was added later
(2026-07-18, see "Full modal vim navigation" below) via a separate
first-refusal hook (`VerticalTabButton::SetVimKeyCallback`, tried before
this `switch`), not by extending this table — counts/`gg`/`G`/visual-mode
intercept keys *ahead of* this plain single-step nav rather than
replacing it, so this table is still accurate for the plain,
no-count-pending case.

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

## Dynamic per-button state (tooltip, loading, alerts, attention)

Four small quick-win features (2026-07-15), all driven by a new private
helper, `VerticalTabBar::UpdateDynamicButtonState(button, contents)`,
called from both `InsertButtonForContents` and `UpdateButtonData` so new
and existing buttons go through the same path:

| Feature | `VerticalTabButton` API | Data source |
|---|---|---|
| Full-title + full-URL tooltip | `SetTooltipText` (inherited from `views::View`, no wrapper needed) | `contents->GetTitle()` + `contents->GetVisibleURL().spec()`, joined with `\n` |
| Loading spinner | `SetLoading(bool)` | `contents->IsLoading()` |
| Alert icon (audio/video/recording/device-connected/etc.) | `SetAlertIcon(const ui::ImageModel&)` | `GetTabAlertStatesForTab(tab)` + `tabs::GetAlertIndicatorColor` + `tabs::GetAlertImageModel` |
| "Needs attention" badge | `SetNeedsAttention(bool)` | `TabStripModelObserver::SetTabNeedsAttentionAt` override |

**Tooltip.** The row elides long titles (`gfx::ELIDE_TAIL`) and never
shows the URL otherwise, so hover is the only place to see either in
full. No new `VerticalTabButton` method was needed — `views::View`
already exposes `SetTooltipText` publicly (the existing `close_button_`
tooltip already called it directly), so `UpdateDynamicButtonState` just
calls it on the button itself.

**Loading spinner.** `VerticalTabButton` gained a `views::Throbber`
sibling to `favicon_`, same preferred size (16×16) and margins, added
right after it in the constructor. Exactly one of the two is visible at
a time — `SetLoading(true)` hides `favicon_`, shows `throbber_`, and
calls `throbber_->Start()`; `SetLoading(false)` reverses it and calls
`Stop()`. Because `views::BoxLayout` collapses hidden children to zero
width, the swap doesn't shift anything else in the row. This mirrors
upstream `TabIcon`'s favicon/throbber swap (`chrome/browser/ui/views/tabs/tab_icon.cc`)
but without its network-state nuance — `contents->IsLoading()` is a
simple boolean instead of a `network_state` enum tracking crashed/error/
waiting sub-states.

**Alert icon.** Reuses the exact helpers the upstream horizontal tab's
`AlertIndicatorButton` (`chrome/browser/ui/views/tabs/alert_indicator_button.cc`)
uses, so the glyph and color match: `TabStripModel::GetTabForWebContents`
resolves a `tabs::TabInterface*`, `GetTabAlertStatesForTab(tab)` (global
namespace, declared in `chrome/browser/ui/tabs/tab_utils.h`) returns a
priority-ordered `std::vector<tabs::TabAlert>`, and — if non-empty —
`tabs::GetAlertIndicatorColor` + `tabs::GetAlertImageModel` (both in
`chrome/browser/ui/tabs/alert/tab_alert_icon.h`) turn the highest-priority
alert into a themed `ui::ImageModel`. The icon lives in its own
`views::ImageView` slot between the label and the close button, hidden
whenever the alert list is empty.

Known simplification: `is_frame_active` is hardcoded `true` when calling
`GetAlertIndicatorColor` — `VerticalTabBar` doesn't currently track
whether the browser window itself is focused. This only affects which
shade of the alert color is picked (active vs. inactive frame), never
which icon shows.

**Needs-attention badge.** `TabStripModelObserver::SetTabNeedsAttentionAt(index, attention)`
is an existing upstream hook (fired e.g. when a background tab wants to
show a JS dialog) that `VerticalTabBar` didn't previously override. It
now does, and forwards straight to `tab_buttons_[index]->SetNeedsAttention(attention)`.
The button renders it as a small 6 px colored dot (`views::CreateRoundedRectBackground`)
in its own slot next to the favicon/throbber — hidden by default, so it
costs nothing in the common case.

## Pin and drag-resize (2026-07-15)

The biggest "partial" item from the gap analysis: the hover-expand
animation existed, and `TabService::GetVerticalTabBarWidth`/
`SetVerticalTabBarWidth` was a registered, persisted pref — but nothing
read it, and there was no way to lock the bar at a custom width. This
closes that gap using two pieces of scaffolding that already existed in
`vertical_tab_bar.h` but were never wired up: a `class ResizeArea;`
forward-declare and a `kResizeAreaWidth = 4` constant, both unused before
this.

**New pref**: `tab.vertical_tab_bar_pinned` (bool, default `false`) —
`custom_pref_names.h` → `TabService::IsVerticalTabBarPinned()` /
`SetVerticalTabBarPinned()`, registered in `TabService::RegisterProfilePrefs`
alongside the existing vertical-tab-bar prefs.

**Pin toggle**: a `views::LabelButton` (`pin_button_`) at the top-right of
the header band, built lazily by `EnsurePinAndResizeControls()` (called
from `EnsureTabStripVisible()`, right after `EnsureButtonContainer()` —
same "must come after the upstream TabStripRegionView attaches" ordering
constraint documented in the Lifecycle section, since these are also
direct children of `VerticalTabBar` and `EnsureViewCacheIsBuilt()` relies
on `children().front()` being the region view). Uses the same
`kKeepIcon`/`kKeepOffIcon` pair as the side panel's pin button
(`side_panel_coordinator.cc`) for a consistent icon language.
Hidden at the fully-collapsed `kStartWidth` (50px) — there isn't room
for it next to `tab_search_affordance_` without overlapping, and
"pin the expanded view" isn't a meaningful action on a collapsed,
icon-only bar. It appears once hover (or pinning) widens the bar past 50px.

**Pinned state** (`VerticalTabBar::ApplyPinnedState`, driven by a
`PrefChangeRegistrar` observer on the new pref):
- `width_` is set from `GetVerticalTabBarWidth()` (clamped to
  `[kMinWidth, kMaxWidth]` = `[5, 500]` — both constants existed unused
  before this too) instead of being animation-driven.
- `hover_animation_` is parked at its "shown" endpoint via `Reset(1)`,
  and `OnMouseEntered`/`OnMouseExited` early-return while `is_pinned_` —
  the bar simply stops responding to hover.
- `resize_area_` becomes visible.

Unpinning reverses all of this: `width_` resets to `kStartWidth`,
`hover_animation_.Reset(0)` returns to the collapsed baseline, and the
resize handle hides again. This is the same hover-collapse behavior the
bar always had — pinning is purely additive, nothing about the unpinned
path changed.

**Drag-resize** (`VerticalTabBar::OnResize`, the `views::ResizeAreaDelegate`
method): only acts while pinned (the handle is hidden otherwise). Mirrors
`SidePanel::OnResize`'s pattern (capture starting width on the first
`OnResize` call via a dedicated field, clear it on `done_resizing`,
persist only on `done_resizing`) with one deliberate difference: no
`base::i18n::IsRTL()` flip. `SidePanel` mirrors direction because its
"right-aligned" concept is reading-direction-relative; `VerticalTabBar`'s
`position_` (`POSITION_LEFT`/`POSITION_RIGHT`) is a literal screen side
the user picked explicitly in settings, so it doesn't need to.

The `starting_width_on_resize_` field used to be `preresize_width_` — a
member that existed since before this change but was only ever written
in the constructor and `Init()` (`width_ = preresize_width_ = kStartWidth`)
and never read anywhere. Repurposed rather than adding a new field,
since it already existed for exactly this.

**Resize handle placement**: a thin (`kResizeAreaWidth` = 4px) strip on
whichever edge faces the page content — the bar's right edge when
`position_ == POSITION_LEFT`, its left edge when `POSITION_RIGHT`. Added
as the last child (topmost in hit-testing) so it reliably intercepts
drags even over the button rows beneath it. When pinned and docked left,
the pin button and resize handle both live on the bar's right edge;
`pin_button_`'s bounds are inset by `kResizeAreaWidth` in that specific
case so their hit-test regions don't overlap.

## Tree mode (2026-07-16)

The last "partial" item from the gap analysis: `TabService::VerticalTabBarMode`
(`MODE_SIMPLE`/`MODE_TREE`) and `VerticalTabBar::UpdateMode(int)` both
existed, but `mode_` was write-only — nothing ever read it, and
`UpdateMode` had no callers anywhere in the codebase. The settings UI's
"exclusive tree open" and "remove parent behavior" toggles were even
further behind: `TabService` didn't have getters for those two prefs at
all, despite both being registered.

**New `TabService` getters** (no new prefs — both already existed,
registered, just unread): `IsVerticalTabBarExclusiveTreeOpen()`,
`GetVerticalTabBarRemoveParentBehavior()`.

**Data source**: Chromium's built-in tab-opener graph —
`TabStripModel::GetOpenerOfTabAt(index)` / `GetIndexOfTab(tab)` — the
same mechanism that already exists for "which tab should activate when
this one closes." No new data model was needed; tree structure is
derived, not stored.

**`VerticalTabBar::RebuildTreeState()`** recomputes every button's depth,
has-children flag, expand state, and visibility on every model mutation
(called from the tail of `OnTabStripModelChanged` and
`ReplaceTabsWithButtons`) and whenever the mode pref changes:
- Depth and has-children are memoized recursive walks up/down the
  opener chain (`parent_index[i] = GetIndexOfTab(GetOpenerOfTabAt(i))`),
  capped at 8 levels and guarded against cycles (openers form a DAG in
  practice, but this is external data, so the recursion carries a `fuel`
  counter rather than trusting that).
- Visibility is "any ancestor in `collapsed_nodes_`" — a
  `std::set<raw_ptr<content::WebContents>>` of user-collapsed parent
  nodes, keyed by `WebContents*` identity (stable across reorders,
  unlike index — same reasoning as every other per-tab identity in this
  file).
- In `MODE_SIMPLE` this is a flat pass — depth 0, not expandable, always
  visible for everyone — not a special case, so toggling the mode pref
  live just works with no restart.

**`VerticalTabButton`** gained two new row elements, both first-class
`BoxLayout` children (not absolutely positioned) so hidden ones
correctly collapse to zero width, same pattern as the loading-spinner
swap: `indent_spacer_` (a plain `views::View`, width = `depth * 12px`,
zero outside tree mode) and `disclosure_button_` (a `views::LabelButton`
with `kKeyboardArrowDownIcon`/`kKeyboardArrowRightIcon` — same expand/
collapse chevron pair used elsewhere in Chrome, e.g.
`window_controls_overlay_toggle_button.cc`), hidden for leaf rows.

**Bug fixed post-landing**: `SetTreeExpandable`'s icon/tooltip/accessible-name
update was originally gated behind `tree_expanded_ != expanded` as a
cheap no-op guard. `tree_expanded_` defaults to `true`, so the very
first call for a newly-discovered parent (`SetTreeExpandable(true,
true)`) evaluated `true != true` and skipped the block entirely —
leaving `disclosure_button_` focusable with no accessible name. This
tripped `views::RunAccessibilityPaintChecks`' DCHECK
(`accessibility_paint_checks.cc:93`, "View is focusable but has no
accessible name") the first time such a row painted, crashing debug
builds. Fixed by dropping the "did it change" guard for this part —
`SetImageModel`/`SetTooltipText`/`SetAccessibleName` now always run
whenever `has_children` is true, since they're cheap and only invoked
from `RebuildTreeState` (on tab-list mutations), not per frame. Lesson:
a "skip if unchanged" optimization is only safe when the field's
*default* value can't coincidentally equal the first real value passed
in — worth double-checking for any future setter following this
no-op-guard pattern.

**Exclusive tree open**: `VerticalTabBar::OnTreeToggleRequested`
(bound per-button, same pattern as `SetCloseCallback`) flips
`collapsed_nodes_` membership. When expanding a node and the pref is on,
every *other root-level* branch (tabs with no opener) gets collapsed too
— scoped to roots deliberately. Making it exclusive at every nesting
level would mean clicking any nested disclosure triangle collapses
unrelated subtrees elsewhere in the tree, which reads as surprising
rather than helpful; "only one top-level folder open" is the readable
interpretation of the pref name.

**Remove parent behavior — the interesting discovery**: only
`REMOVE_CHILDREN` needed new code. `MOVE_CHILDREN_TO_UPPER_LAYER` — the
enum's other value — turned out to already be vanilla Chromium's
default, unconditional behavior: `TabStripModel::FixOpeners(index)`
(private, called from every close/move path in `tab_strip_model.cc`)
already reparents a closed tab's children to its own opener, for every
tab close in the browser, with no pref check. So the only thing this
feature needed to add was the *other* branch — cascading the close.
`VerticalTabBar::OnTabCloseRequested` now, when in tree mode with
`REMOVE_CHILDREN` set, calls `CollectDescendants` to snapshot the whole
subtree by `WebContents*` **before** closing the parent — waiting until
after would be too late, since `FixOpeners` reparents children to the
grandparent the instant their opener closes, and at that point they no
longer look like this tab's descendants.

**Known scope limits** (documented rather than silently narrowed):
- `REMOVE_CHILDREN` only triggers via the vertical bar's own close
  button (`OnTabCloseRequested`). Other close paths — Ctrl+W, the
  right-click context menu, the horizontal strip — don't currently
  check this pref. `MOVE_CHILDREN_TO_UPPER_LAYER` is unaffected by this
  limitation since it's vanilla's default everywhere already.
- Opener changes that happen outside an insert/remove/move
  (`TabStripModel::SetOpenerOfWebContentsAt` called directly, e.g. when
  a background tab navigates and "adopts" a new opener) don't trigger
  `RebuildTreeState` — there's no dedicated `TabStripModelObserver` hook
  for "opener changed" to observe. Narrow, and self-corrects on the next
  actual insert/remove/move.

## Density (2026-07-16)

The last "Partial" item. Two continuous controls already existed in
`tab_page.html` — a 75-125% "Zoom" dropdown
(`tab.vertical_tab_bar_zoom_percent`) and a 16-33px "Tabs height" slider
(`sidebar.tab_height`) — plus, at the user's request, three new named
presets (Compact/Comfortable/Spacious) on top of them, matching the
product spec's literal wording.

**A latent crash found before wiring anything up**: `sidebar.tab_height`
belongs to `sidebar::SidebarService`, a different `KeyedService` than
`TabService` (it also hosts the Sidebar/Sidebar Apps features — unrelated
to vertical tabs except for sharing this one settings-page row).
`SidebarService::GetTabHeight()` existed with zero callers anywhere —
and unlike every other "unread getter" found so far this session, this
one wasn't just inert: `kSidebarTabHeight` was **never registered** in
`SidebarService::RegisterProfilePrefs`. Calling `GetInteger()` on an
unregistered pref hits a debug-build `CHECK` inside `PrefService`. Had
this been wired up without checking, it would have crashed the browser
the first time `ApplyDensityToButtons()` ran. Fixed by registering it
with a default of `32` — deliberately matching the vertical tab bar's
previous hardcoded row height (`kButtonHeight`), so shipping this change
causes zero visual change for anyone who's never touched the slider.

**Wiring** (`VerticalTabBar::GetDensityScale()` /
`GetEffectiveRowHeight()` / `ApplyDensityToButtons()`, called after
`EnsureButtonContainer()` builds and from a new pref-change listener on
both prefs):
- Zoom % becomes a `0.75`-`1.25` scale factor, pushed to each button via
  `VerticalTabButton::SetDensityScale(float)`.
- Tab height becomes each button's (and the trailing "+ New tab"
  button's) row height directly, clamped to `[16, 33]` — the settings
  slider's own range — as a belt-and-braces guard.

**`VerticalTabButton::SetDensityScale`** scales every icon slot
(favicon/throbber/close/disclosure/alert), the attention dot, and the
tree-mode indent unit, all relative to fixed base sizes (16px icons, 6px
dot, 12px indent) rather than compounding off whatever the current size
happens to be — repeated calls with different scales stay correct. Font
scaling works the same way but needs a captured baseline:
`base_font_list_` is set once, from `label_->font_list()`, immediately
after the label is constructed, before any scaling ever runs.
`SetDensityScale` always derives from `base_font_list_.DeriveWithSizeDelta(...)`,
never from the label's current (possibly already-scaled) font — the same
"derive from a fixed base, not from cumulative state" pattern used for
every other scaled dimension here.

**Presets** (`tab_page.ts`): three `cr-button`s, each writing both
prefs together via `this.set('prefs.<path>.value', n)` — Compact
(16px/80%), Comfortable (24px/100%, matching the registered defaults),
Spacious (33px/110%). A preset button shows an `active` state
(`isDensityPreset_`) only when both prefs exactly match its point in the
2D space; moving either slider away from a preset clears the highlight
with no "custom" indicator to replace it — the raw sliders/dropdown
remain visible below for fine-tuning past what the three presets offer.

New GRD strings: `IDS_OPTIONS_SIDEBAR_TAB_DENSITY(_COMPACT|_COMFORTABLE|_SPACIOUS)`
in `generated_resources.grdp`, registered in
`settings_sidebar_localized_strings_provider.cc` alongside the existing
sidebar strings.

## Click-to-mute, frame-active alert coloring, content-type coloring (2026-07-17)

Three small, independent follow-ups, all in `UpdateDynamicButtonState`
(the shared per-button refresh helper — see "Dynamic per-button state"
above).

**Click-to-mute.** `alert_icon_` was a plain `views::ImageView` — not
clickable. Changed its type to `views::LabelButton` (icon-only, same
pattern as `close_button_`/`disclosure_button_`) so it can receive
clicks. `SetAlertIcon` gained a required `accessible_description`
parameter (from `GetTabAlertStateText(alert)`, already the exact
upstream helper for this) — set on the button whenever the icon is
visible, **regardless of whether it's actually clickable**, because a
`LabelButton` is focusable the moment it's visible and a focusable
view with no name trips the same
`views::RunAccessibilityPaintChecks` DCHECK fixed for the disclosure
triangle on 2026-07-16. A new `SetAlertClickCallback` is bound only for
`AUDIO_PLAYING`/`AUDIO_MUTING` states — `VerticalTabBar::OnAlertIconClicked`
toggles `contents->IsAudioMuted()` via the same `SetTabAudioMuted(...,
TabMutedReason::AUDIO_INDICATOR, ...)` call the upstream horizontal
strip's `BrowserTabStripController::ToggleTabAudioMute` uses. Every
other alert state (recording, device-connected, PIP, etc.) gets an
empty closure — clicking does nothing, since none of those are
actually toggleable from a tab icon.

**Frame-active-aware alert coloring.** `tabs::GetAlertIndicatorColor`'s
`is_frame_active` argument was hardcoded `true` since the alert-icon
feature landed (2026-07-15) — `VerticalTabBar` didn't track whether the
browser window itself was focused. Now reads `GetWidget() &&
GetWidget()->IsActive()`. Only affects which shade of the alert color
renders (active-frame vs. inactive-frame), never which icon shows.

**Content-type color coding.** No upstream Chromium API classifies "what
kind of site is this," so `ClassifyContentType(GURL)` (anonymous
namespace, `vertical_tab_bar.cc`) is a small, deliberately
non-exhaustive hostname-substring table across six categories (Video,
Social, Shopping, Dev, Search, News) with its own color palette
(`GetContentCategoryColor`) — hues chosen to be visually distinct from
`GetTabGroupStripeColor`'s existing 9-color group palette just above it
in the same file, even though the two are never painted simultaneously.
`VerticalTabButton` gained a second color field, `content_type_color_`,
alongside the existing `group_color_`; `OnPaintBackground` paints
`group_color_` if set, else falls back to `content_type_color_` — the
manual (group) and inferred (content-type) color languages share one
3px stripe slot but never compete for it. Extend the classification
tables as needed; this was scoped as "better than nothing," not a
complete taxonomy of the web.

## Advanced sorting (2026-07-17)

Right-clicking *empty* space in the vertical bar (below/between the tab
buttons — a tab button's own right-click still opens the existing
per-tab menu via `ShowContextMenuForContents`, unaffected) shows a
"Sort tabs by" menu: Title, Domain, or Recently used.

**Wiring**: `button_container_->set_context_menu_controller(this)`
(set once, in `EnsureButtonContainer`) makes `VerticalTabBar` — now
also a `views::ContextMenuController` — receive
`ShowContextMenuForViewImpl` for clicks the buttons don't consume
themselves. A new delegate class, `VerticalTabBarSortMenuDelegate`
(same file, same lifetime pattern as the existing
`VerticalTabContextMenuContents` for the per-tab menu — held alive by a
`sort_menu_delegate_` member for as long as the menu is open), builds a
3-item `ui::SimpleMenuModel` and dispatches to
`VerticalTabBar::SortTabsBy(SortCriterion)`.

**Scope-preserving algorithm.** Pinned tabs and tabs in a group are
excluded entirely and never move — reordering them risks breaking
`TabStripModel`'s invariants (pinned tabs contiguous at the front,
grouped tabs contiguous within their group). `SortTabsBy`:
1. Collects `{original_index, WebContents*}` for every unpinned,
   ungrouped tab, in ascending model order.
2. Captures `target_slots` (just their `original_index` values) *before*
   sorting — `std::sort` reorders the entries themselves, so reading
   `original_index` back off a sorted entry would give that entry's own
   stale slot, not the slot it should move to. (Caught and fixed during
   implementation — an easy trap since the natural-looking one-vector
   version silently no-ops instead of crashing.)
3. Sorts the entries by the chosen criterion — title
   (`base::i18n::ToLower`-normalized), domain (`GURL::host()`), or
   recency (`WebContents::GetLastActiveTime()`, most recent first).
4. Walks `sortable[i] → target_slots[i]`, resolving each entry's
   *current* index via `GetIndexOfWebContents` immediately before
   calling `MoveWebContentsAt` — not assuming indices stay stable, since
   earlier moves in the same loop shift everything after them.

**Build-caught bug**: the `Entry` struct's `contents` field was
initially a bare `content::WebContents*`, reasoned (wrongly) to be
exempt from this repo's `raw_ptr<T>` member-field rule as "local and
transient." The `chromium-rawptr` clang plugin doesn't grant that
exemption — CLAUDE.md's "doesn't apply to local variables" carve-out
covers a bare local pointer *variable*, not a member field of a struct
that happens to be defined inside a function body. Any struct/class
member field of pointer type needs `raw_ptr<T>` regardless of the
struct's scope; only bare local variables, function parameters, and
return types are exempt. Fixed to `raw_ptr<content::WebContents>`.

This is a one-shot reordering action, not a persistent "always sorted"
mode — dragging a tab afterward (or opening a new one) behaves exactly
as before; nothing about normal reordering is sort-aware.

## Bulk/multi-select (2026-07-17)

Ctrl-click (Cmd-click on Mac) and Shift-click on `VerticalTabButton` now
extend `TabStripModel`'s existing multi-selection — the same
`ui::ListSelectionModel` the horizontal tab strip already uses.
Deliberately did **not** invent a parallel selection concept for the
vertical bar; it's a second view onto the model's one selection state,
same as `VerticalTabBar` already is for the active tab.

**Gesture mapping** (`VerticalTabButton::OnMousePressed`, mirroring
upstream `Tab::OnMousePressed`'s modifier handling exactly, down to the
Mac Cmd-vs-Ctrl split via a local `IsMultiSelectModifierDown`):

| Gesture | `TabStripModel` call |
|---|---|
| Ctrl/Cmd-click | Toggle: `SelectTabAt`/`DeselectTabAt` depending on current state |
| Shift-click | `ExtendSelectionTo` |
| Shift+Ctrl/Cmd-click | `AddSelectionFromAnchorTo` (range, without clearing existing selection) |

Handled synchronously in `OnMousePressed`, not through the normal
`PressedCallback`-on-release path — returning `true` without calling
`views::Button::OnMousePressed` means the button never enters its
pressed state, so a Ctrl/Shift-click never also activates the tab as an
ordinary click would.

**Bulk operations needed no new code.** `TabStripModel::ExecuteContextMenuCommand`
(already wired — see `ShowContextMenuForContents`/
`VerticalTabContextMenuContents`, unchanged since it predates this
feature) already operates on the full selection when the right-clicked
tab is part of a multi-selection larger than one — that logic lives
upstream, shared with the horizontal strip. Getting multi-select
gestures working was the entire scope; "Close N tabs," "Pin N tabs,"
etc. all just work. (The per-button ✕ close button and `Delete` key
deliberately still close only that one tab, matching upstream's own
`BrowserTabStripController::CloseTab` — upstream doesn't special-case
multi-selection there either, only the context-menu command does.)

**Visual indication**: `VerticalTabButton::SetMultiSelected` reuses the
existing hover/selected background color — currently no visual
distinction between "the active tab" and "also selected but not
active." `VerticalTabBar::UpdateMultiSelection` (called on
`TabStripSelectionChange::selection_changed()`, alongside the existing
`UpdateActiveSelection` for `active_tab_changed()`) walks
`model->selection_model()` and flags every selected index except the
active one, which already gets the same look via `selected_`.

## Hover thumbnail previews (2026-07-17)

Hovering a `VerticalTabButton` for ~400ms shows a small floating popup
with a live thumbnail of that tab's page, positioned to the right of
the button (or wherever `anchor_bounds_in_screen.right() + 8` lands —
no edge-avoidance/flip logic yet, see Known scope limits below).

**Reused, not rebuilt.** Chromium already has a full thumbnail
capture-and-decode pipeline for exactly this purpose — the upstream
horizontal tab strip's own hover card uses it. Every tab already has a
`ThumbnailTabHelper` attached (`ThumbnailTabHelper::CreateForWebContents`
is called for every `WebContents` from `chrome/browser/ui/tab_helpers.cc`'s
`AttachTabHelpers`, unconditionally), and
`TabHoverCardThumbnailObserver` already wraps the async capture-request +
JPEG-decode dance into a single `gfx::ImageSkia`-producing callback. The
new code here is only presentation (`VerticalTabHoverPreview`, an
anonymous-adjacent class in `vertical_tab_bar.cc`) and the trigger
(`VerticalTabBar`'s hover-delay timer) — no parallel thumbnail
infrastructure was built.

**Trigger** (`VerticalTabButton::StateChanged`, `VerticalTabBar::OnButtonHoverChanged`):
`StateChanged` (already overridden here for hover repaints) now also
detects `STATE_HOVERED` transitions and fires a
`SetHoverPreviewCallback(bool)` callback — `true` on hover start, `false`
on end. The bar starts a 400ms `base::OneShotTimer` on hover-start
(debounces skimming past several rows while scrolling — a preview
shouldn't pop for every row passed over) and stops it immediately on
hover-end; the timer firing is what actually calls
`ShowHoverPreview`.

**`VerticalTabHoverPreview`**: owned by `VerticalTabBar` for the bar's
whole lifetime (created lazily on first hover, then reused across every
subsequent hover — not recreated per-tab) — a borderless, non-activatable
`views::Widget` (`TYPE_POPUP`, `CLIENT_OWNS_WIDGET`) containing one
`views::ImageView`. `ShowFor(contents, anchor_bounds)` calls
`ThumbnailTabHelper::FromWebContents(contents)->thumbnail()` and hands
it to a `TabHoverCardThumbnailObserver`, whose callback sets the
`ImageView`'s image whenever a decoded thumbnail becomes available
(async — the popup shows up immediately but the image itself may
populate a moment later, same as the upstream hover card).

**Re-resolve by identity, not by captured pointer.** `ShowHoverPreview`
re-resolves the tab's current index via `GetIndexOfWebContents` and
re-reads `tab_buttons_[index]` fresh at fire time, rather than trusting
an index or button pointer captured 400ms earlier in
`OnButtonHoverChanged` — the tab may have closed, moved, or the whole
button list may have been rebuilt (`TearDownAllButtons`/`ReplaceTabsWithButtons`,
e.g. a mode switch) during the delay. If the contents no longer resolves
to a valid button, the preview simply doesn't show — same defensive
"re-resolve before acting" pattern used everywhere else in this file
(e.g. `OnTabButtonPressed`). `TearDownAllButtons` also proactively hides
any currently-showing preview and stops the timer, so a stale-anchored
popup doesn't linger on screen for a frame during a rebuild.

**Known scope limits:**
- No edge-avoidance — the preview always anchors to the right of the
  button; on a narrow screen or with the bar docked right, it could
  render off-screen or overlap the button itself. Upstream's
  `BubbleDialogDelegateView`-based hover card handles this properly;
  this is a plain `Widget`, deliberately simpler, without that logic.
- No show/hide debounce on the *hide* side — moving the pointer off a
  button hides the preview immediately, even if the pointer is about to
  land on an adjacent row (which would show a new preview right away
  anyway, but there's a visible flicker rather than a smooth handoff).

## Tab search/filter (2026-07-17)

Pressing "/" while a `VerticalTabButton` has focus (or clicking the new
search toggle button in the header, immediately left of `pin_button_`)
opens a filter row between the header and the button list. Typing
narrows visible rows to tabs whose title or URL contains the query
(case-insensitive); `Escape` (or the toggle button again) closes it and
clears the filter.

**Layout**: `button_container_`'s top offset was hardcoded to
`kHeaderHeight` everywhere it was set. Replaced both call sites with
`GetContentTop()`, which adds `kSearchRowHeight` (28px) only while
`search_visible_` — the search row inserts itself into the layout
without any other code needing to know it exists. `search_field_`
(a plain `views::Textfield`, no dedicated View subclass) occupies that
inserted row directly; `VerticalTabBar` is its `views::TextfieldController`
itself, rather than a separate small delegate class — `ContentsChanged`
and `HandleKeyEvent` are the only two overrides needed (both have
empty/no-op default bodies upstream, so this compiles as a lightweight
addition to the existing multiple-inheritance list, not a new pattern).

**Filtering is layered onto `RebuildTreeState`, not a separate
mechanism.** Both of its branches (the `MODE_SIMPLE` flat pass and the
`MODE_TREE` computed pass — see "Tree mode" above) already decide each
button's final `SetVisible` call; both now additionally require
`MatchesSearchFilter(contents)` to be true. This means tree-mode
collapse/expand and the search filter compose correctly for free —
a collapsed subtree stays hidden even if a query would otherwise match
something inside it, and a query that matches a deeply nested tab
doesn't fight with its ancestors' collapsed state. Keeping one
visibility computation was a deliberate choice over adding a second,
parallel `SetVisible` call site that would need to independently agree
with the tree-mode one on every future change.

**Discovery via `VerticalTabButton::OnKeyPressed`'s existing fallthrough**:
"/" (`VKEY_OEM_2`, unshifted) fires a new `SetOpenSearchCallback` closure,
same binding pattern as every other per-button callback in this file.
Only fires while a *button* has focus — once the search field itself is
focused, "/" simply types a literal slash, no special-casing needed.

**Header layout**: the search toggle button reuses `pin_button_`'s exact
visibility condition (hidden at the fully-collapsed 50px width, appears
once hover/pinning widens the bar past that) and sits immediately to its
left, with the same resize-handle inset applied when both are pinned
and docked left. Three icons now potentially share the header row
(`tab_search_affordance_` left, search toggle + pin right) — no overflow
handling beyond what already existed for two; a very narrow expanded
width could theoretically crowd them, not expected to matter in
practice since the hover-expanded width (250px+) has ample room.

## Full modal vim navigation (2026-07-18)

The last item from the original "not implemented" list that touched
keyboard nav. The J/K addition from 2026-07-15 was explicitly scoped as
"not modal vim emulation, just muscle-memory up/down" — this closes the
rest of it: counts (`5j`, `5k`), `gg`/`G` (jump to first/last, or the
Nth visible row with a count — vim's exact semantics), and one
mode-switch (`v` toggles a visual-select mode where `j`/`k` extend the
multi-selection instead of just moving focus). Deliberately still not
full vim: no editing commands (`dd` etc.) — closing a tab by accident
from a stray keystroke is a much worse failure mode than a navigation
command doing nothing, so anything destructive stayed out of scope.

**Where the state lives.** Count buffer, pending-`g`, and visual-mode
flag are all `VerticalTabBar` members, not `VerticalTabButton` ones —
they have to persist as focus moves between buttons (typing `5` then
`j` while focus is on row 3 needs to still remember the `5` once
handling reaches row 3's key event). `VerticalTabButton::OnKeyPressed`
gets a new first-refusal hook, `SetVimKeyCallback`, tried *before* the
existing plain arrow-nav block: the bar's `OnVimKeyEvent` returns `true`
for anything it decided to handle (digits, `g`, `G`, `v`, `Escape` while
in visual mode, or `j`/`k`/arrows when a count is pending or visual mode
is active) and `false` for everything else — including plain `j`/`k`
with no count and no visual mode, which is the common case and falls
straight through to the unchanged single-step nav below it.

**Visible-row aware.** All jumps/moves operate over
`GetVisibleButtonIndices()` — whichever buttons `RebuildTreeState`
currently has visible (respecting both tree-mode collapse and the
search filter from the two features above), not raw model indices. `gg`
skips over collapsed subtrees and filtered-out rows the same way Home
already does.

**Composes with multi-select for free.** Visual mode doesn't introduce
a new selection mechanism — entering it calls `TabStripModel::SelectTabAt`
to anchor at the current tab, and `j`/`k` while active call
`ExtendSelectionTo` on each step, both already-existing calls from the
bulk/multi-select feature (2026-07-17, "Bulk/multi-select" above). The
growing highlight as you extend is the same shared-selection background
that Ctrl/Shift-click already produces; there's no separate "vim visual
selection" concept to keep in sync with the mouse-driven one.

**Build-caught bug**: `JumpToVisiblePosition` originally took an unused
`content::WebContents* contents` parameter (leftover from an earlier
draft where it computed a "from" position itself instead of delegating
to `FocusAndMaybeExtendSelection`). Unlike the earlier `raw_ptr`
mistake, this wasn't a Chromium-specific plugin check — it's a
plain unused-parameter smell — but worth removing on principle even
before finding out whether the build configuration would have flagged
it. Caught during self-review before this was even sent for a build,
by rereading each new function once with the specific question "is
every parameter actually used" — cheap enough to make into a habit
before flagging something as done.

**Known scope limits:**
- No visual indicator that visual mode is active beyond the growing
  selection highlight itself — real vim shows `-- VISUAL --` in its
  command line; there's no equivalent status area here to put that.
- `vim_pending_g_`'s one-key window means typing `g` then pausing
  indefinitely before a second key leaves it silently pending — a
  low-cost quirk (the next unrelated keypress clears it), not worth a
  timeout for.

## Named session save/restore (2026-07-18)

The same "Sort tabs by" background menu (right-click empty bar space —
see "Advanced sorting" above) gained three more entries: **Save tabs as
new session**, **Restore session ▸** (one entry per saved session), and
**Delete session ▸**. The two submenus only appear once at least one
session exists.

**Deliberately not built on Chromium's own Saved Tab Groups.**
`chrome/browser/ui/tabs/saved_tab_groups/` is a large, real, shipped
upstream system (`TabGroupSyncService`, cross-device sync, sharing/
collaboration between users, its own deletion-confirmation dialogs) —
genuinely the closest upstream analogue to "named session save/restore."
It was deliberately not integrated with: it's scoped to a *tab group*,
not a whole window's tab set, and pulling in its sync/collaboration
machinery for what the gap analysis asked for (save the current tabs,
give them a name, restore them later) would have meant a much deeper,
riskier integration than the rest of this gap-closing work. What's built
here instead is a small, local, WanderLust-owned pref-backed list —
simpler, but with real limits documented below rather than silently
matched to the upstream feature's capabilities.

**Storage**: `TabService::{Get,Save,Delete}VerticalTabBarSession`, a
new `base::Value::List` pref (`tab.vertical_tab_bar_saved_sessions`,
`PrefRegistrySimple` — local-only, see the cross-device-sync gap item
below for why not synced). Each entry: `{"name": string, "tabs":
[{"title": string, "url": string}, ...]}`.

**Save** (`VerticalTabBar::SaveCurrentTabsAsSession`) snapshots *every*
open tab's title/URL — unlike `SortTabsBy`, a session snapshot isn't
trying to preserve pinned/group invariants, it's just "what was open."
The name is auto-generated from the current date/time
(`base::TimeFormatShortDateAndTime`) — there's no rename UI in this
first pass (see Known scope limits).

**Restore** (`VerticalTabBar::RestoreSession`) opens each saved URL via
`NavigateParams` + `Navigate()` — the same simple, general-purpose
browser-navigation primitive `SavedTabGroupUtils::OpenUrlInNewUngroupedTab`
uses internally (mirrored, not depended on — no include of anything
under `saved_tab_groups/`). Disposition is
`WindowOpenDisposition::NEW_BACKGROUND_TAB` so restoring a multi-tab
session doesn't yank focus away once per tab; the user stays on
whatever tab they were already looking at while the session opens
behind it.

**Known scope limits:**
- No rename UI — sessions keep their auto-generated timestamp name for
  their lifetime; only save and delete are exposed, not edit.
- No confirmation dialog before delete (unlike the upstream Saved Tab
  Groups system, which has a whole `TabGroupDeletionDialogController`
  for this). A wrong click loses a saved session with no undo.
- Restoring opens tabs into the *current* window only — no "restore
  into a new window" option.
- Not synced across devices (tracked separately — see the
  cross-device-sync item in the gap list below).

## Crash recovery tied to vertical tabs (2026-07-18)

Chromium's own session restore already reopens every tab after a crash
or restart — nothing new was needed for that part. What it doesn't know
about is the vertical bar's own organizational state: which tree nodes
were collapsed. `collapsed_nodes_` (see "Tree mode" above) is keyed by
`content::WebContents*`, and those pointers don't survive a restart —
the WebContents get destroyed and recreated fresh when tabs reopen. Left
alone, every restored window would come back with everything fully
expanded, silently losing whatever tree organization the user had built
up. That's the actual, narrow scope of "crash recovery tied to vertical
tabs specifically" — not rebuilding Chromium's crash recovery, closing
the one gap in it that's specific to this feature.

**Re-keyed by URL, not WebContents identity.** A new pref,
`tab.vertical_tab_bar_collapsed_urls` (`TabService::{Get,Set}VerticalTabBarCollapsedUrls`,
a `base::Value::List` of URL strings), is written every time a node is
collapsed or expanded (`VerticalTabBar::PersistCollapsedNodesToPrefs`,
called at the end of `OnTreeToggleRequested`) — on every toggle, not
just at clean shutdown, since a pref only written at shutdown would lose
exactly the state a crash is supposed to survive. On startup,
`RestoreCollapsedNodesFromPrefs` walks the just-restored model and
re-populates `collapsed_nodes_` with whichever tabs' *current* URL
matches an entry in the persisted list.

**Known imprecision, accepted deliberately**: URL is a heuristic, not a
stable identity. Two tabs open to the same URL collapse/expand together
(there's no way to tell them apart from URL alone). A tab whose URL
changes between the collapse and the restore (a redirect, a SPA
navigating client-side) won't re-match and comes back expanded. Both are
judged acceptable — the alternative (a truly stable per-tab identity
that survives a crash) doesn't exist in Chromium's tab model to hook
into, and "sometimes over-restores, never crashes or corrupts state" is
the right failure mode for a UI-organization feature like this one.

**Wiring**: `RestoreCollapsedNodesFromPrefs` runs inside
`ReplaceTabsWithButtons`, right after the button-insertion loop and
*before* `RebuildTreeState` (which reads `collapsed_nodes_` to compute
visibility) — get the order wrong and the first paint would show
everything expanded for one frame, or worse, `RebuildTreeState` would
compute visibility from an empty `collapsed_nodes_` that's about to be
overwritten. `ReplaceTabsWithButtons` only ever runs its full body once
per `VerticalTabBar` instance (the `Init()`-time call is a guaranteed
no-op — no `TabStrip` cached yet — and every subsequent tab-strip
mutation goes through `OnTabStripModelChanged`, not this function), so
this really is a one-time startup restore, not something that could
clobber a user's live collapse/expand actions mid-session.

## Virtual scrolling (2026-07-18)

The gap analysis named this "virtual scrolling," which in the strict
sense means windowing/recycling views so only the visible rows actually
exist — necessary at huge N (thousands+), where instantiating every
row upfront would be slow and memory-heavy. That's not what got built,
deliberately: at tab-strip scale (even a heavy power user rarely clears
a few hundred), ordinary child views cost nothing noticeable, and
`VerticalTabBar` already has a whole session's worth of code (tree
state, search filter, multi-select, hover preview, drag-reorder,
keyboard nav) built on the assumption that `tab_buttons_[i]` is a
real, persistent `VerticalTabButton` for every tab. Rewriting that
assumption into a recycling pool would touch nearly every feature in
this document for a performance problem that doesn't exist at this
scale.

**What was actually broken, and what this fixes**: `button_container_`
had no scrolling mechanism at all — it was a direct child of
`VerticalTabBar`, manually bounded to whatever vertical space was
available. With enough tabs to exceed that height, the overflow rows
weren't just visually clipped, they were **completely unreachable** —
no scrollbar, no mouse-wheel response, nothing. That's the real bug
"untested past normal tab counts" was hinting at, and it's what this
closes: `button_container_` is now the *contents* of a `views::ScrollView`
(`button_scroll_view_`), which is what actually gets added as
`VerticalTabBar`'s child and positioned at the viewport rect
`button_container_` used to occupy directly
(`EnsureButtonContainer`/`EnsureTabStripVisible`, wherever those bounds
were previously set). `button_container_` itself no longer needs
explicit bounds — `ScrollView::Layout()` sizes it from its own preferred
size (`BoxLayout`'s natural height for however many buttons currently
exist) on every pass, and shows a scrollbar / responds to mouse-wheel
input once that exceeds the viewport.

> **Correction (2026-07-18, later same day):** the paragraph above was
> wrong about the ScrollView auto-sizing `button_container_` — this
> shipped with a real bug that made every tab button in the bar
> permanently invisible, caught only when the user actually opened a
> vertical-tabs window (this feature was build-verified but never
> runtime-checked before landing; see the retro note at the end of this
> section). `views::ScrollView` only assigns its contents view a size
> automatically when `is_bounded()` is true — set via
> `ScrollView::ClipHeightTo(min, max)` — and `EnsureButtonContainer`
> never called it. Without that, `button_container_` stayed at its
> zero-size default forever; `BoxLayout` happily laid out every button
> inside that zero-size rect, which is indistinguishable from "no
> buttons" on screen. Fixed with a single
> `scroll_view->ClipHeightTo(0, 100000)` before `SetContents` in
> `EnsureButtonContainer` — `min=0, max=100000` puts no meaningful floor
> or ceiling on the content's height (the *outer* `button_scroll_view_`
> bounds, set explicitly in `EnsureTabStripVisible`, are what actually
> constrain the visible viewport and trigger scrolling); it only needs
> to flip `is_bounded()` to true so `ScrollView::Layout()` takes the
> branch that calls `contents_->SetSize(...)` at all. Full build passed
> clean; no upstream files touched, so no patch regeneration was needed
> for the fix itself.
>
> **Retro:** this is exactly the risk that was flagged when the feature
> first landed — restructuring `button_container_`'s parentage was
> called out as "structurally riskier than others," and build success
> was explicitly *not* treated as proof it worked. It wasn't runtime-
> verified before moving to the next gap-list item, and the bug sat
> latent through five more rounds of unrelated work until a user actually
> opened the bar. Lesson for this codebase going forward: a change to
> `VerticalTabBar`'s core view hierarchy (as opposed to a new field, pref,
> or button state) warrants an explicit "did you get a chance to check
> this in a running browser?" before considering it done, even when the
> build is clean and the user says to keep going.

**Nothing else changed.** `button_container_` is still the direct
parent of every `VerticalTabButton`, still owns them, still the target
for `AddChildViewAt`/`RemoveChildViewT`/`ReorderChildView`. Coordinate
conversions that already existed (`ConvertPointFromScreen(button_container_, ...)`
in the drag-reorder handler) keep working unchanged — Views' coordinate
system accounts for scroll offset automatically when walking the view
hierarchy, so drag-reorder, hit-testing, and everything else built
against `button_container_` in earlier features needed no changes at all.

**Known scope limits:**
- The trailing "+ New tab" button lives inside the scrollable content
  (it's `button_container_`'s last child, same as always) — with enough
  tabs to need scrolling, it scrolls out of view along with everything
  else, rather than staying pinned as an always-visible footer. A
  pinned footer would be a reasonable follow-up but is a further layout
  complication not included here.
- True view-recycling virtualization remains unimplemented, on purpose
  — see above. If tab counts in practice ever reach a scale where that
  matters, this would need genuine reconsideration, but that's not
  where things stand today.

## Third-party extension API (2026-07-18)

A `chrome.verticalTabs.*` extension API, mirroring the existing
`chrome.sidebar.*` API's plumbing exactly: JSON schema → json_schema_compiler
codegen → `ExtensionFunction` subclasses → `BrowserContextKeyedAPI` +
`EventRouter`, registered through the same
`CustomExtensionsBrowserAPIProvider::RegisterExtensionFunctions` /
`EnsureApiBrowserContextKeyedServiceFactoriesBuilt` chain every other
custom API (rss, infobars, sidebar) already uses.

**Files:**
- `custom/common/extensions/api/vertical_tabs.json` — schema
- `custom/common/extensions/api/_vertical_tabs_api_features.json` — API feature, depends on `permission:verticalTabs`
- `custom/common/extensions/api/_permission_features.json` — new `"verticalTabs"` permission
- `custom/browser/extensions/api/vertical_tabs/vertical_tabs_api.{h,cc}` + `BUILD.gn`
- Wired into `custom/common/extensions/api/custom_api_sources.gni` and `BUILD.gn`, both gated on the existing `enable_vertical_tabs` GN flag (same flag `ENABLE_VERTICAL_TABS` already used throughout `tab_service.h`)
- Upstream hook points (both already patched for rss/sidebar, extended the same way): `chrome/browser/extensions/api/BUILD.gn` (`public_deps` on the new `vertical_tabs` source_set) and `chrome/browser/extensions/api/api_browser_context_keyed_service_factories.cc` (`VerticalTabsAPI::GetFactoryInstance()` under `BUILDFLAG(ENABLE_VERTICAL_TABS)`)

**A pre-existing clue this was planned before:** `_permission_features.json`'s
`"sidebar"` permission already allowlisted an extension ID commented
`// Vertical Tab` (`A147CA7CD12C3D2C0DB73B880702623A57186F38`), alongside the
`// Sidebar` entry. That ID almost certainly belonged to the legacy MV2
`custom/browser/resources/vertical_tab/` extension (dead code, superseded
by this native-Views bar — see "Intentional non-presence" below), which
would have called into `chrome.sidebar.*` for privileged operations before
the rewrite. The new `"verticalTabs"` permission reuses that same ID rather
than minting a new one, since it's the one already reserved for a
first-party vertical-tabs companion extension.

**API surface (deliberately read-mostly):**
- `getPreference(key, callback)` — generic pref reader, identical pattern to `chrome.sidebar.getPreference`; scoped in practice to the `tab.vertical_tab_bar_*` keys in `custom_pref_names.h`
- `getSessions(callback)` — lists saved session names (`TabService::GetVerticalTabBarSavedSessions`, profile-scoped, no active window needed)
- `saveSession(name, callback)` — snapshots the active window's open tabs under `name`
- `restoreSession(name, callback)` — reopens a saved session's tabs as new background tabs in the active window; `callback(false)` if the name doesn't exist
- `deleteSession(name, callback)` — removes a saved session
- `onModeChanged(mode)` event — fires when `tab.vertical_tab_bar_mode` changes between Simple/Tree

`saveSession`/`restoreSession` reuse `VerticalTabBar::SaveCurrentTabsAsSession`/
`RestoreSession` directly (via `BrowserView::vertical_tab_bar()` on
`chrome::FindLastActive()`) rather than reimplementing the `TabStripModel`
walk in the extension function — one source of truth for what "the current
session" means, whether triggered from the sort-menu UI or an extension.
`SaveCurrentTabsAsSession` gained an optional `name` parameter (default
empty → the existing auto-generated date/time name) so the extension
caller can supply a real name; the context-menu entry point, which has no
text input, is unaffected.

**Deliberately not exposed:** no `setPreference`, no per-tab `closeTab`/
`pinTab`/`moveTab`, no `onWindowClosing`/`onExit` events. Sidebar's own
version of those two events is registered in its `SidebarEventRouter`
constructor but the actual dispatch call site in
`chrome/browser/ui/unload_controller.cc` is commented out — meaning it's
never lived in a working state — so it wasn't worth mirroring dead code.
`onModeChanged` is the one event actually wired end-to-end (live
`PrefChangeRegistrar` → `EventRouter::BroadcastEvent`, following
`RssEventRouter::DispatchEvent`'s working pattern instead of sidebar's
non-functional one). Letting an arbitrary allowlisted extension silently
rewrite user-facing bar settings, or close/move tabs out from under the
user without a visible UI action, felt like the wrong default for a first
pass — a write surface can be added later against a concrete use case.

**Known scope limits:**
- `getPreference` is a raw pref-store passthrough (same as sidebar's) — no per-key allowlist beyond the permission itself gating who can call it at all.
- `saveSession`/`restoreSession` operate on `chrome::FindLastActive()`'s window, not a caller-specified window ID — there's no `windowId` parameter to target a background window.
- Full build (schema-compiler codegen included) passed clean on the first attempt — no errors or warnings.

## Cross-device sync for vertical tab prefs (2026-07-18)

`TabService::RegisterProfilePrefs` registered every vertical-tab-bar pref
via `PrefRegistrySimple`, with no `flags` argument — meaning none of them
were ever eligible for Chrome Sync, regardless of the user's sync
settings. Fixed by passing `user_prefs::PrefRegistrySyncable::SYNCABLE_PREF`
on the ones that make sense to carry to a new device, plus (a detail
that's easy to miss) adding matching entries to
`chrome/browser/sync/prefs/chrome_syncable_prefs_database.cc`'s allowlist —
registering with the `SYNCABLE_PREF` flag alone is necessary but **not**
sufficient in current Chromium; the pref also has to appear in that
file's `kChromeSyncablePrefsAllowlist` map (`ChromeSyncablePrefsDatabase::
GetSyncablePrefMetadata` only returns metadata for prefs it finds there).
Missing that step is the most likely way a "sync this pref" change looks
right and silently does nothing.

**Synced:** `tab.vertical_tab_bar_mode`, `..._pinned`, `..._zoom_percent`,
`..._remove_parent_behavior`, `..._exclusive_tree_open`, and
`..._saved_sessions` — all genuine "how I like my tab bar to behave"
preferences. Saved sessions use `MergeBehavior::kMergeableListWithRewriteOnUpdate`
rather than a plain overwrite, so saving a session on one device doesn't
clobber a different session saved on another device before the next sync
cycle.

**Deliberately not synced:**
- `tab.vertical_tab_bar_width` — a pixel width tuned for a wide external
  monitor would bleed onto a laptop's built-in display the moment it
  synced down. This is exactly the gap the next item, multi-monitor
  per-display preferences, exists to solve properly (remember a width
  *per monitor*, not one global synced number) — syncing it now would
  actively work against that later fix.
- `tab.vertical_tab_bar_collapsed_urls` — the crash-recovery pref (see
  "Crash recovery tied to vertical tabs" above). It's a heuristic keyed to
  URLs of tabs open on *this* device right now; it has no correct
  interpretation on a different device with a different set of open tabs.

**Mechanics, for future reference:** a pref registered with `PrefRegistrySimple`
(this codebase's existing convention throughout `TabService`) can be
retrofitted for sync without changing its registration's static type —
`RegisterIntegerPref`/`RegisterBooleanPref`/`RegisterListPref` all take an
optional trailing `flags` argument on the base `PrefRegistrySimple` class
itself; the flag only takes effect because the object handed to
`RegisterProfilePrefs` at its one real call site
(`chrome/browser/prefs/browser_prefs.cc::RegisterProfilePrefs`) is actually
a `user_prefs::PrefRegistrySyncable`, upcast to `PrefRegistrySimple*` for
the parameter type. No signature change needed.

**A found-in-passing detail, not acted on:** `chrome_syncable_prefs_database.cc`
already had an (unrelated) `prefs::kVerticalTabsEnabled` entry — a stock
Chromium/upstream experiment flag with the same "vertical tabs" name, already
syncable. It backs a different, upstream feature this fork doesn't use;
`TabService::IsVerticalTabBarEnabled()` derives from `kTabBarPosition`
instead. Left alone — no relationship to touch or unify.

**Known scope limits:**
- New numeric IDs (100331–100336) were appended to `chrome_syncable_prefs_database.cc`'s
  `syncable_prefs_ids` enum and mirrored into
  `tools/metrics/histograms/metadata/sync/enums.xml`'s `ChromeSyncablePref`
  enum, per that file's own "never renumber, append only" convention — the
  IDs are allocated unconditionally (matching the existing
  `kGlicRolloutEligibility` precedent) so they stay stable regardless of
  `enable_vertical_tabs`; only the allowlist map entry is behind
  `BUILDFLAG(ENABLE_VERTICAL_TABS)`.
- This doesn't add any new UI for "sync my vertical tab settings" — it
  rides the existing "Settings sync" toggle Chrome Sync already exposes,
  same as every other synced pref.
- Full build (including the upstream `chrome_syncable_prefs_database.cc`
  and `enums.xml` edits) passed clean, patches regenerated via `npm run
  update_patches`.

## Multi-monitor per-display preferences (2026-07-18)

The gap-analysis note on "Cross-device sync" above flagged this: syncing
`tab.vertical_tab_bar_width` verbatim would mean a width tuned for a wide
external monitor bleeding onto a laptop's built-in display the moment it
synced down. This closes the actual underlying gap — remembering a
*different* pinned width per physical monitor — rather than papering over
it by just not syncing width (which was still the right call for sync
specifically, but didn't solve the local multi-monitor case either: even
on one machine, moving the same browser window between a laptop screen
and a dock's external display previously kept whatever width was last
set, regardless of which screen it landed on).

**New pref:** `tab.vertical_tab_bar_width_by_display` — a dict pref
mapping `base::NumberToString(display::Display::id())` → pixel width,
registered via plain `RegisterDictionaryPref` (no `SYNCABLE_PREF` flag —
a display id is a local-hardware identifier, meaningless on another
device). `TabService::GetVerticalTabBarWidthForDisplay(display_id)` falls
back to the existing global `GetVerticalTabBarWidth()` when nothing's
recorded yet for that display, so a fresh profile or a never-before-seen
monitor behaves exactly like before this feature existed — no migration
step, no "first launch on a new monitor" edge case to handle specially.

**Wiring, all in `vertical_tab_bar.cc`:**
- `GetCurrentDisplayId()` — `display::Screen::GetScreen()->GetDisplayNearestWindow(GetWidget()->GetNativeWindow()).id()`, or `-1` if the widget isn't attached to a screen yet.
- `ApplyPinnedState()` (pin toggle, and the pinned-pref-change observer) now loads the *current* display's width via `GetVerticalTabBarWidthForDisplay` instead of the flat global getter.
- `OnResize`'s `done_resizing` branch persists the drag-resized width to both the global pref (unchanged behavior, keeps single-monitor users' pre-existing pref working exactly as before) and the current display's per-display entry.
- `Layout(PassKey)` compares `GetCurrentDisplayId()` against a cached `last_applied_display_id_` on every layout pass and re-applies that display's remembered width the moment they differ — this is what actually catches "the whole browser window just got dragged to another monitor," since there's no dedicated display-change observer here, just a cheap check riding an override that already runs on every bounds change.

**Known scope limits:**
- `display::Display::id()` is a best-effort stable identifier (typically EDID-derived) — not a cryptographic guarantee. A monitor that stops reporting a stable id (some KVM switches, certain docking-station reconnects) will look "new" to this feature and fall back to the global width rather than misapplying a stale one. Same "documented heuristic, not a hard guarantee" tradeoff as the URL-keyed crash-recovery collapse state above.
- Only width is remembered per-display. Pinned/unpinned state, mode, and density stay global — a monitor doesn't have a good claim on "should tree mode be on," the way it does on "how wide should the bar be."
- No settings UI to inspect or clear the per-display map — it's pure background bookkeeping, same as the collapsed-URLs crash-recovery pref.
- Full build passed clean; patches unaffected (this feature touches only `custom/` files, no upstream edits).

## Duplicate-tab detection (2026-07-18)

Two parts: a small visual indicator per duplicate tab, and a bulk "Close
duplicate tabs" action — the last item from the original gap list.

**Detection:** `VerticalTabBar::RebuildDuplicateState` buckets every open
tab's `GetVisibleURL().spec()` (exact string match — no scheme/query
normalization) and flags any bucket with more than one entry. Called from
`OnTabStripModelChanged` (insert/remove/move/replace all change which
URLs collide) and from `TabChangedAt` (a same-tab navigation changes
this too, without touching the tab count at all — so it needed its own
call site, not just piggybacking on the model-mutation one). Blank tabs
and the New Tab Page are explicitly excluded from the bucketing — with
several NTPs open at once being completely normal, flagging every one of
them as a "duplicate" would be noise, not signal.

**Visual indicator:** a new small gray dot on `VerticalTabButton`
(`duplicate_badge_`), built the same way as the existing "needs
attention" dot (`attention_dot_`) — hidden by default, `SetVisible`
toggled by `SetDuplicate(bool)`, scaled by `SetDensityScale` alongside
the other per-button glyphs. Deliberately a *separate* dot in a distinct
neutral color rather than reusing the attention dot for both meanings — a
tab can be both a duplicate and need attention at the same time, and
collapsing those into one ambiguous indicator would lose information.

**Bulk action:** `VerticalTabBar::CloseDuplicateTabs`, wired into the
"Sort tabs by" background context menu (right-click empty bar space,
`VerticalTabBarSortMenuDelegate`) as a new "Close duplicate tabs" item —
the same background menu Advanced sorting and Named session save/restore
already live in. For each URL with more than one open tab: keeps the
active tab if it's one of the duplicates (closing the tab the user is
currently looking at would be a surprising side effect of a cleanup
action), otherwise keeps the first/oldest occurrence, and closes the
rest with `TabCloseTypes::CLOSE_USER_GESTURE | CLOSE_CREATE_HISTORICAL_TAB`
— the same flags a normal user-initiated tab close uses, so an
accidental sweep is still undoable via "Reopen closed tab," tab by tab.
Uses the identical URL-bucketing key as the detection pass, so the
action never closes a tab the badge wasn't already flagging.

**Known scope limits:**
- Exact URL match only — `example.com/` and `example.com` (no trailing
  slash), or the same page with a different `#fragment` or `?query`,
  are treated as distinct, not duplicates. A fuzzier match was
  considered and rejected: it's much easier to accidentally close a tab
  the user actually wanted kept than to leave an exact duplicate
  unflagged.
- No pref, no settings toggle — this is always-on, matching how "needs
  attention" and alert icons already work with no opt-out.
- No cross-window detection — only tabs within the same window's
  `TabStripModel` are compared. A duplicate open in a *different*
  browser window shows no indicator in either window.
- Full build passed clean; no upstream files touched, so no patch
  regeneration needed for this one.

## Dormant-tab resource optimization (2026-07-18)

The last item from the original spec's gap list — closing it means every
"Not implemented" bullet from the first audit is now done.

Entirely a reuse of upstream infrastructure that already ships in this
fork: Chromium's Memory Saver / tab-discarding system
(`chrome/browser/resource_coordinator/`, backed by
`components/performance_manager/`), which frees a background tab's
renderer process to save memory and reloads it on next activation. This
was already fully wired (prefs registered, `WebContents::WasDiscarded()`
live) — it just had zero visibility or manual control from the vertical
tab bar specifically, since discard state was never read anywhere in
`vertical_tab_bar.cc`/`vertical_tab_button.cc` before this. No new
discard logic was written; this is pure surfacing of an existing signal
plus one bulk action on top of an existing API.

**Visual indicator:** a third small dot on `VerticalTabButton`
(`dormant_dot_`, soft blue — reads as "asleep" rather than the attention
dot's alert-red or the duplicate badge's neutral gray), driven by
`content::WebContents::WasDiscarded()`. Wired into the same
`UpdateDynamicButtonState` every other per-tab dynamic signal (alert
icon, content-type color, loading spinner) already goes through, plus a
tooltip suffix ("Inactive — memory freed, will reload when selected")
so hovering explains what the dot means without needing a legend.

Getting the refresh trigger right needed a bit of research: discarding a
tab doesn't fire a dedicated "discard" notification. By default
(`features::kWebContentsDiscard` is off), `TabLifecycleUnit::Discard`
(`chrome/browser/resource_coordinator/tab_lifecycle_unit.cc`) builds a
**replacement** `WebContents` and calls
`TabStripModel::DiscardWebContentsAt`, which fires
`TabStripModelObserver::OnTabStripModelChanged` with
`TabStripModelChange::kReplaced` — already routed through
`UpdateButtonData` → `UpdateDynamicButtonState` in this bar's existing
`kReplaced` handling, so no new observer hookup was needed. Reload (the
tab reactivating) has no dedicated signal either — it rides the same
ordinary `TabChangedAt` calls any navigation already triggers, which
this bar was already forwarding to the same update path. Net result: the
existing per-tab refresh plumbing from the very first version of this
bar already happened to be the correct place to read `WasDiscarded()` —
nothing structural needed to change, only what gets read there.

**Bulk action:** "Free up inactive tabs" in the "Sort tabs by"
background context menu (same low-risk extension point
`CloseDuplicateTabs` used) — `VerticalTabBar::DiscardInactiveTabs` calls
`resource_coordinator::TabLifecycleUnitExternal::FromWebContents(contents)
->DiscardTab(mojom::LifecycleUnitDiscardReason::EXTERNAL)` on every
background, unpinned, not-already-discarded tab. `EXTERNAL` matches how
`chrome://discards`' own manual discard button tags a user-initiated
request, as opposed to an automatic `PROACTIVE`/`URGENT` discard.
`DiscardTab` already declines ineligible tabs on its own (unsaved form
data, active media playback, etc.) — no eligibility check duplicated
here.

**Known scope limits:**
- No per-tab "Discard this tab" context-menu item — the per-tab
  right-click menu (`VerticalTabContextMenuContents`) wraps upstream's
  shared `TabMenuModel`, which has no discard entry to enable, and adding
  a custom command there is a riskier extension point than the
  standalone "empty space" sort menu `CloseDuplicateTabs` and this action
  already use. The bulk action covers the common "free up memory" case;
  a single-tab affordance is a reasonable, low-risk follow-up if it turns
  out to be wanted.
- Pinned tabs are never discarded by `DiscardInactiveTabs` — they're
  pinned specifically to stay one click away, which a discard-and-reload
  cycle works against.
- No custom eligibility/timing logic (e.g. "discard after N minutes
  hidden") — this leans entirely on upstream's own Memory Saver
  heuristics and the manual action, rather than adding a second,
  potentially conflicting discard policy specific to vertical tabs.
- Full build passed clean, including the link against
  `resource_coordinator::TabLifecycleUnitExternal` — no new `BUILD.gn`
  dependency was needed, since this file already links against the
  chain that pulls that target in.

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

## Feature-parity gap analysis (vs. product spec)

A Confluence proposal (`BC/Vertical Tabs`) lays out a broader vertical-tabs
vision than what's built today. Audited against the implementation
(`vertical_tab_bar.{h,cc}`, `vertical_tab_button.{h,cc}`, `tab_service.{h,cc}`,
the Polymer settings UI) on 2026-07-14; updated across eighteen rounds
of gap-closing work — the per-button quick wins (2026-07-15, "Dynamic
per-button state" and "Keyboard" above), pin/drag-resize (2026-07-15,
"Pin and drag-resize" above), tree mode (2026-07-16, "Tree mode" above),
density (2026-07-16, "Density" above), a second quick-wins pass
(2026-07-17, "Click-to-mute, frame-active alert coloring, content-type
coloring" above), advanced sorting (2026-07-17, "Advanced sorting"
above), bulk/multi-select (2026-07-17, "Bulk/multi-select" above), hover
thumbnail previews (2026-07-17, "Hover thumbnail previews" above), tab
search/filter (2026-07-17, "Tab search/filter" above), full modal vim
navigation (2026-07-18, "Full modal vim navigation" above), named
session save/restore (2026-07-18, "Named session save/restore" above),
crash recovery tied to vertical tabs (2026-07-18, "Crash recovery tied
to vertical tabs" above), virtual scrolling (2026-07-18, "Virtual
scrolling" above — read that section before assuming this means
view-recycling), a third-party extension API (2026-07-18,
"Third-party extension API" above), cross-device sync for vertical
tab prefs (2026-07-18, "Cross-device sync for vertical tab prefs"
above), multi-monitor per-display preferences (2026-07-18,
"Multi-monitor per-display preferences" above), duplicate-tab
detection (2026-07-18, "Duplicate-tab detection" above), and
dormant-tab resource optimization (2026-07-18, "Dormant-tab resource
optimization" above — the last item from the original gap list). All
items originally listed as "Partial" or "Not implemented" from the first
audit are now Implemented.

**Implemented**
- Horizontal/vertical toggle with persistent pref (`tab.bar_position`: TOP/LEFT/RIGHT)
- Full tab titles + favicon in expanded state
- Tab-group visual categorization (3 px color stripe)
- Keyboard nav: arrows + vim-style `J`/`K`, Home/End, Delete, Enter, plus full modal vim (counts, `gg`/`G`, visual-select mode — see "Full modal vim navigation" below)
- Full-title + full-URL tooltip on hover
- Loading spinner (favicon/`views::Throbber` swap)
- Alert icon for audio/video/recording/device-connected states (reuses upstream `tabs::GetAlertImageModel`), click-to-mute for audio states, and frame-active-aware coloring
- Content-type color coding (heuristic domain classifier, falls back only when no manual group color is set)
- "Needs attention" badge (small dot, driven by `TabStripModelObserver::SetTabNeedsAttentionAt`)
- Pin/unpin toggle with drag-to-resize (`views::ResizeArea`) while pinned, persisted via `TabService::GetVerticalTabBarWidth`/`SetVerticalTabBarWidth`
- Tree mode: parent/child indentation and collapse via disclosure triangles, derived from `TabStripModel`'s opener graph; exclusive-root-open and remove-parent-cascades-children behaviors both wired to their (previously-unread) prefs
- Density: zoom % and row height both drive real rendering now, plus three named presets (Compact/Comfortable/Spacious) matching the spec's exact wording
- Basic accessibility (accessible names, standard focus ring — no explicit ARIA roles/live-region, no high-contrast handling)
- Theming via `ui::ColorProvider` (dark mode included) — beyond spec's "customizable themes"
- Advanced sorting: right-click empty bar space → sort unpinned/ungrouped tabs by title, domain, or recency
- Bulk/multi-select: Ctrl/Shift-click extends `TabStripModel`'s selection; bulk context-menu commands (close/pin/group N tabs) work via the existing upstream `ExecuteContextMenuCommand` path
- Hover thumbnail previews: reuses the upstream hover-card's thumbnail pipeline (`ThumbnailTabHelper` + `TabHoverCardThumbnailObserver`) — no edge-avoidance yet, see Known scope limits
- Tab search/filter: "/" or the header toggle opens a filter row; composes correctly with tree-mode visibility since both share one `RebuildTreeState` computation
- Full modal vim navigation: counts (`5j`/`5k`), `gg`/`G`, and a visual-select mode that composes with bulk/multi-select's existing `TabStripModel` selection calls — no vim editing commands (deliberately, see accidental-close risk)
- Named session save/restore: a small, local, pref-backed list (not Chromium's own Saved Tab Groups/sync system — see "Named session save/restore" above for why) — no rename UI or delete confirmation yet
- Crash recovery tied to vertical tabs: tree-mode collapse state is persisted by URL and re-associated with restored tabs after a crash/restart — the one piece of vertical-bar-specific state Chromium's own (already-automatic) session restore doesn't know about
- Virtual scrolling: `button_container_` now scrolls inside a `views::ScrollView` — fixes the real bug (overflow tabs were previously completely unreachable, not just clipped). Deliberately real scrolling, not view-recycling — see "Virtual scrolling" above for why that's the right call at tab-strip scale
- Third-party extension API: `chrome.verticalTabs.*`, mirroring the existing `chrome.sidebar.*` API's schema/codegen/registration plumbing — read-mostly (getPreference, getSessions, saveSession, restoreSession, deleteSession, onModeChanged) with no pref-write or per-tab-mutation surface — see "Third-party extension API" above for the scope rationale
- Cross-device sync: mode, pinned, density, tree behaviors, and saved sessions now sync via `PrefRegistrySyncable::SYNCABLE_PREF` plus a matching `chrome_syncable_prefs_database.cc` allowlist entry — width and crash-recovery collapsed-node state deliberately excluded, see "Cross-device sync for vertical tab prefs" above for why
- Multi-monitor per-display preferences: pinned bar width is now remembered per `display::Display::id()` and re-applied when the browser window moves to a different monitor — see "Multi-monitor per-display preferences" above for the mechanism and its scope limits
- Duplicate-tab detection: a small distinct-colored badge per duplicate (exact URL match, NTP/blank excluded), plus a "Close duplicate tabs" bulk action in the sort-menu that preserves the active tab and uses undoable closes — see "Duplicate-tab detection" above for the exact-match rationale and scope limits
- Dormant-tab resource optimization: surfaces upstream's existing Memory Saver/tab-discarding system (no new discard logic) via a third per-tab dot driven by `WebContents::WasDiscarded()`, plus a "Free up inactive tabs" bulk action — see "Dormant-tab resource optimization" above

**Not implemented**
None — every item from the original gap-analysis audit is now implemented.

**Dropped from scope (2026-07-17):** the spec's "responsive/screen-size
adaptation" bullet (portrait-mode optimization, ultrawide-display
auto-detection, multi-monitor awareness) reads like it was written with
an extension-based implementation in mind, from before this feature
committed to native Views — a browser *window*, not the vertical tab
bar specifically, is what would need to reflow per screen size/orientation,
and that's Chromium window-management territory, not something a
per-window `VerticalTabBar` instance can reasonably own. Not tracked
here going forward. (Multi-monitor per-display preferences, above,
is a narrower and still-plausible piece of the same spec bullet —
kept, since "remember a different bar width per monitor" is a
reasonable, scoped ask, unlike full responsive reflow.)

The spec's "Monetization Strategy" section (subscription tiers, enterprise pricing) is a product/business proposal, not an engineering scope item, and isn't tracked here.

## Dead / unwired code

Found during the gap analysis above — none of these are reachable from any
active code path today:

| File | Status |
|---|---|
| `src/chrome/browser/ui/tabs/vertical_tab_strip_state_controller.{h,cc}` | **Not WanderLust dead code — upstream Chromium's own, unrelated, unshipped vertical-tabs prototype.** See correction below. |
| `src/custom/browser/resources/vertical_tab/` | Legacy MV2 extension (`manifest.json` + a pre-Polymer `cr.ui.Tree`-based tree view: `tree/tab_tree.js`, `simple/tab_tree.js`, `extended_tree.js`) — not referenced by any `BUILD.gn`. Predates the native Views implementation, and its tree-view functionality is now superseded by "Tree mode" above. Safe to delete. |
| `src/custom/components/vertical_tabs_ui/page/vertical_tabs_page.tsx` | React stub — literally `<h1>Vertical Tabs UI</h1>`. No `WebUIController` registers it; unreachable from any URL. |

**Correction (2026-07-15):** the original version of this note suggested
`VerticalTabStripStateController` "may already have the shape needed" for
pin/collapse and was worth resurrecting. That was wrong, caught while
implementing pin/resize (see "Pin and drag-resize" below) — don't repeat
the mistake:

- `prefs::kVerticalTabsEnabled` is a real, registered, **syncable**
  upstream pref (`tabs::RegisterProfilePrefs` in `tab_strip_prefs.cc`,
  called from `browser_prefs.cc`), gated by a real upstream
  `base::Feature`, `features::kVerticalTabs` (`chrome/browser/ui/tabs/features.cc`,
  disabled by default). This is upstream Chromium's own experimental
  vertical-tabs prototype — nothing to do with WanderLust's feature.
- `VerticalTabStripStateController` is scaffolding for *that* upstream
  feature. No caller anywhere in `chrome/browser/ui/views` consumes its
  `VerticalTabStripState` — the upstream View-layer implementation was
  apparently never landed in this checkout, only the prefs + controller.
- Critically, its `collapsed`/`uncollapsed_width` state is **in-memory
  only** — `SetUncollapsedWidth`/`SetCollapsed` update a plain struct
  member, never `pref_service_`. Only `IsVerticalTabsEnabled`/
  `SetVerticalTabsEnabled` actually touch a pref. So even setting aside
  the "unrelated feature" problem, this class doesn't persist width
  either — adopting it would have meant *adding* persistence to it, not
  getting persistence for free.

Building on it would have meant either migrating WanderLust's
`TabService`-based pref scheme (`tab.bar_position`,
`tab.vertical_tab_bar_width`, etc.) onto this upstream one, or running
two parallel, unrelated "vertical tabs" concepts side by side — both
worse than just extending `TabService`, which is what pin/resize
actually did. Left alone here (not deleted — that's upstream Chromium's
call, not WanderLust's, and it may still land its own feature someday);
just don't mistake it for reusable WanderLust scaffolding again.
`resources/vertical_tab/` and `vertical_tabs_page.tsx` remain genuine
WanderLust dead code and candidates for deletion, same rationale as the
`VerticalTab`/`VerticalTabStripRegionView` clones removed in the cleanup
pass noted above.

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
