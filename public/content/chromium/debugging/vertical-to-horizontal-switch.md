# Vertical → Horizontal Tab Strip Switch — Known Broken State

**Status:** Unresolved as of 2026-05-22. Multiple attempts have failed to
fully restore the horizontal strip after a runtime switch from vertical
back to horizontal. This doc captures the investigation so the next
person picking it up doesn't re-walk the same paths.

## Symptoms

User starts in horizontal tabs, opens settings, switches to vertical
tabs (works fine), then switches back to horizontal tabs:

1. **The upstream new-tab button (`+` after the tabs) does not appear**.
2. **The tab strip area is blank**. The small chevron for the tab-search
   affordance is visible at the top-left corner of where the strip
   should be, but the actual tabs are not painted.
3. **Adding a new tab via Ctrl+T** briefly shows all tabs as blank/
   overlaid before the state self-corrects after some delay.

Switching horizontal → vertical → horizontal → vertical → horizontal
reproduces the broken horizontal state each time.

## Reproduction

1. Launch the browser (must start in horizontal/POSITION_TOP mode).
2. Open settings, change "Tab bar position" away from Top (e.g. Left).
   Vertical bar appears, works correctly.
3. Open settings, change "Tab bar position" back to Top.
4. Observe: tab strip is blank, no `+` button. Adding tabs via shortcut
   shows the flicker described above.

## Code paths involved

- [`TabService::OnPrefChanged`](../../src/custom/browser/tab/tab_service.cc#L95)
  observes `kTabBarPosition` and calls
  `BrowserView::UpdateVerticalTabBarPosition()` on every
  `BrowserList` entry.
- [`BrowserView::UpdateVerticalTabBarPosition`](../../src/chrome/browser/ui/views/frame/browser_view.cc#L6306)
  flips `vertical_tab_bar_->SetVisible`, reparents
  `tab_strip_region_view_` between `vertical_tab_bar_` and
  `top_container_`, then calls `DeprecatedLayoutImmediately()`.
- [`VerticalTabBar::EnsureTabStripVisible`](../../src/custom/browser/ui/views/frame/vertical_tab_bar.cc)
  is the function that mutates upstream view state when entering
  vertical mode — it's the source of the "things to undo on switch-
  back":
  - `tab_strip_region_view_->SetBounds(0, 0, width_, kHeaderHeight)`
  - `hosted_tab_strip_->SetVisible(false)`
  - `upstream_new_tab_buttons_[*]->SetVisible(false)`
  - `frame_grab_handle_->SetVisible(false)`
  - `tab_search_affordance_->SetProperty(kViewIgnoredByLayoutKey, true)`
  - `tab_search_affordance_->SetBounds(kLeftPadding, y, w, h)` (manual)
- [`TabStripRegionView::SetVerticalMode`](../../src/chrome/browser/ui/views/frame/tab_strip_region_view.cc#L460)
  flips the internal `vertical_` flag plus the layout-manager
  orientation and `tab_strip_container_`'s flex spec.
- [`TabStrip::SetVisible`](../../src/custom/patches/chrome-browser-ui-views-tabs-tab_strip.cc.patch#L65)
  override forces `visible=true` when `!IsVerticalTabBarEnabled()` —
  meaning *any* `SetVisible` call on the upstream `TabStrip` after the
  pref has flipped to `POSITION_TOP` should resolve to visible.

## What we have tried (in order)

### Attempt 1 — restore new-tab button visibility on `VerticalTabBar::VisibilityChanged`

Added a `VisibilityChanged(is_visible=false)` override that walks
`upstream_new_tab_buttons_` and calls `SetVisible(true)`. **Result:** No
change. The `VisibilityChanged` callback may not have been firing at
the right time, or the cached pointers may have been stale.

### Attempt 2 — also restore `hosted_tab_strip_`, `frame_grab_handle_`, and clear `kViewIgnoredByLayoutKey`

Expanded the `VisibilityChanged` restore to undo every mutation
`EnsureTabStripVisible` made. **Result:** CHECK failure in
[`TabStripRegionView::UpdateTabStripMargin`](../../src/chrome/browser/ui/views/frame/tab_strip_region_view.cc#L716):

```
CHECK(tab_search_container_->GetProperty(views::kViewIgnoredByLayoutKey));
```

The property MUST stay `true` when
`render_tab_search_before_tab_strip_=true`, because the horizontal
Layout positions that view manually.

### Attempt 3 — leave the property alone, only restore visibility

Reverted the `kViewIgnoredByLayoutKey` reset. **Result:** Same as
Attempt 1 — broken horizontal strip on switch-back. CHECK no longer
fires.

### Attempt 4 — wire `TabStripRegionView::SetVerticalMode` to actually flip layout orientation

The original patch's `SetVerticalMode` updated only
`tab_strip_container_`'s flex spec, not the region view's outer
`FlexLayout` orientation. Added a `static_cast<FlexLayout*>(GetLayoutManager())->SetOrientation(...)`
call plus a final `InvalidateLayout()`. Also fixed the
`MinimumFlexSizeRule`: the constructor uses `kScaleToMinimum` for the
scrollable-tabstrip path and `kScaleToZero` otherwise; the old
`SetVerticalMode` hard-coded `kScaleToZero`, so the scrollable
container could collapse to zero width after a mode swap. Detected via
`tab_strip_scroll_container_ != nullptr`.

Also added a direct call from `BrowserView::UpdateVerticalTabBarPosition`
to `tab_strip_region_view_->SetVerticalMode(!to_top)` before the
reparent, so the flag flip is deterministic and doesn't rely on any
observer order. **Result:** No change to the symptoms.

### Attempt 5 — deterministic, explicit restore call from BrowserView

Exposed `VerticalTabBar::RestoreUpstreamViewsForHorizontalMode()` as a
public method and called it explicitly from
`BrowserView::UpdateVerticalTabBarPosition` before
`SetVisible(false)`/reparent, so the restore doesn't depend on
`VisibilityChanged` firing. **Result:** No change.

### Attempt 6 — reset `kViewIgnoredByLayoutKey` inside `SetVerticalMode(false)` for affordances that aren't `render_tab_search_before_tab_strip_`

Targeted reset: if the user has the `TabStripComboButton` (combo
disabled-or-enabled path doesn't matter, what matters is which
affordance got pinned) or the trailing tab-search container variant
(`!render_tab_search_before_tab_strip_`), reset
`kViewIgnoredByLayoutKey=false` on the affected view so `FlexLayout`
takes over positioning and overwrites the stale manual bounds from
vertical mode. Render-before users keep the property at `true`
(required by the `UpdateTabStripMargin` CHECK). **Result:** No change
reported by user.

## Live source changes still in place

- `src/chrome/browser/ui/views/frame/browser_view.cc` —
  `UpdateVerticalTabBarPosition` calls
  `RestoreUpstreamViewsForHorizontalMode()` (when going horizontal) and
  `SetVerticalMode(!to_top)` (always) before the reparent.
- `src/chrome/browser/ui/views/frame/tab_strip_region_view.cc` —
  `SetVerticalMode` now flips outer `FlexLayout` orientation, picks
  the correct min flex rule, resets `kViewIgnoredByLayoutKey` on
  trailing-search / combo-button affordances when going horizontal,
  ends with `InvalidateLayout()`.
- `src/custom/browser/ui/views/frame/vertical_tab_bar.{h,cc}` —
  `RestoreUpstreamViewsForHorizontalMode()` exposed as a public method;
  `VisibilityChanged` calls the same method as a fallback.

None of these have been reverted. They're plausibly correct individually
but together they still don't produce a working horizontal strip.

## Hypotheses worth investigating next

In rough order of likelihood:

1. **The cache pointers are stale or never populated.** Add `LOG(INFO)`
   to `EnsureViewCacheIsBuilt` and to `RestoreUpstreamViewsForHorizontalMode`
   to confirm `hosted_tab_strip_`, `upstream_new_tab_buttons_`, and
   `frame_grab_handle_` are actually non-null at restore time. If the
   cache was built for a different `TabStripRegionView` instance (e.g.
   if `tab_strip_region_view_` was rebuilt at some point), our pointers
   are pointing to disowned views that are no longer in the tree —
   our `SetVisible(true)` calls would be no-ops as far as the visible
   strip is concerned.

2. **`BrowserViewLayout::LayoutTabStripRegion` isn't running.** The
   layout cascade after the reparent may not actually be invoking
   `LayoutTabStripRegion`. Confirm with a tracepoint at
   [browser_view_layout.cc:689](../../src/chrome/browser/ui/views/frame/browser_view_layout.cc#L689).
   If it's not running, `tab_strip_region_view_` keeps its stale
   `(0, 0, width_, 32)` bounds from `EnsureTabStripVisible` and the
   strip is effectively a 32-pixel-tall sliver at the wrong width.

3. **`tab_strip_container_` was reparented or replaced during the
   round-trip.** If something in upstream rebuilds the
   `TabStripScrollContainer` between mode switches, our flex-spec
   changes apply to the old container and the new one has defaults.

4. **`top_container_` doesn't lay out its children.** Confirmed via
   [top_container_view.cc](../../src/chrome/browser/ui/views/frame/top_container_view.cc)
   — it has no `Layout` override and no layout manager. Normally
   `BrowserViewLayout` directly sets bounds on `tab_strip_region_view_`
   (which happens to be a child of `top_container_`), but if for some
   reason that path is skipped, the region view keeps its vertical-
   mode bounds.

5. **The `vertical_` flag on `TabStripRegionView` was never `true` to
   begin with for some users.** If `IsTabstripComboButtonEnabled()` was
   true at construction, the combo-button branch is taken regardless
   of `vertical_`. Verify which construction branch ran by logging the
   resolved values of `IsTabstripComboButtonEnabled()` and
   `vertical_` in the ctor.

6. **A second `Layout` pass undoes our state.** Some delayed task
   (animation tick, accessibility relayout, focus restore) might be
   firing `EnsureTabStripVisible` again after our restore. Add a debug
   counter to `EnsureTabStripVisible` to see how many times it runs
   per switch.

## Workaround for users

Restart the browser after switching modes. Mode switches mid-session
work going horizontal → vertical, but not the reverse.

## File map for the area

| File | Role |
|---|---|
| [`vertical_tab_bar.cc`](../../src/custom/browser/ui/views/frame/vertical_tab_bar.cc) | Vertical bar host. `EnsureTabStripVisible` and `RestoreUpstreamViewsForHorizontalMode` live here. |
| [`vertical_tab_bar.h`](../../src/custom/browser/ui/views/frame/vertical_tab_bar.h) | Declarations + cached upstream pointers. |
| [`browser_view.cc`](../../src/chrome/browser/ui/views/frame/browser_view.cc) | `UpdateVerticalTabBarPosition` orchestrates the switch. |
| [`tab_strip_region_view.cc`](../../src/chrome/browser/ui/views/frame/tab_strip_region_view.cc) | `SetVerticalMode` flips orientation + flex spec. Constructor's `vertical_` initialization decides initial state. |
| [`tab_service.cc`](../../src/custom/browser/tab/tab_service.cc) | Pref observer that triggers `UpdateVerticalTabBarPosition`. |
| [`tab_strip.cc.patch`](../../src/custom/patches/chrome-browser-ui-views-tabs-tab_strip.cc.patch) | Override of `TabStrip::SetVisible` that forces visible=true when not in vertical mode. |
