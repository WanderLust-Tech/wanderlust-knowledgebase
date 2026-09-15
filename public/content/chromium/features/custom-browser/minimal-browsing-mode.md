# Minimal Browsing Mode

Permanently hides the toolbar and bookmark bar while keeping the tab strip
visible — a persistent layout mode, not a hover-to-reveal one. Added
v1.9.22 (2026-09-15).

---

## Where to find it

Settings → Appearance → Layout → "Minimal browsing mode".

**Pref:** `toolbar.minimal_browsing_mode` (bool, default `false`).

---

## How it works

A single pref check in `BrowserView::IsToolbarVisible()` and
`BrowserView::IsBookmarkBarVisible()` (`chrome/browser/ui/views/frame/browser_view.cc`)
short-circuits both to `false` whenever `prefs::kMinimalBrowsingMode` is
set, via a small `IsMinimalBrowsingModeEnabled()` helper. Both functions
are re-queried on every layout pass (`BrowserViewLayout::LayoutToolbar()`
and `LayoutBookmarkBar()`), so toggling the pref takes effect immediately
— no restart, no explicit re-show/re-hide call needed.

The tab strip is laid out independently of toolbar visibility
(`BrowserViewLayout::Layout()` calls `LayoutToolbar()` and
`LayoutBookmarkAndInfoBars()` as separate steps after the tab strip
region), so hiding the toolbar/bookmark bar has no effect on tabs.

A `PrefChangeRegistrar` entry on `kMinimalBrowsingMode` calls
`BrowserView::InvalidateLayout()` on change, mirroring the existing
Compact Layout pref's wiring — this is what makes the Settings toggle
apply live.

This is deliberately a single centralized check rather than several
scattered ones. It was inspired by a third-party Chromium fork's
"subwindow mode" (part of an embeddable-browser-as-DLL SDK), which
achieved a similar visual result via a dozen independent
`GWL_STYLE & WS_CHILD` checks scattered across `BrowserView`,
`BrowserViewLayout`, `GlassBrowserFrameView`, and the tab strip — no code
was ported (that project's interop code carries a proprietary,
commercially-restricted license), only the "hide chrome, keep tabs, do it
in one place" design idea. See
[CCP_Tangram_Feature_Port_Analysis.md](../../../analysis/CCP_Tangram_Feature_Port_Analysis.md)
section 5 (P1) for the source analysis.

**Not the same as Zen Mode:** the sibling "Zen mode" toggle in the same
Settings section (`zen_mode.enabled`, no dedicated article yet) auto-hides
*all* top chrome (including the tab strip) and reveals it on cursor hover
near the top of the window. Minimal Browsing Mode has no reveal behavior
at all — the toolbar and bookmark bar simply stay hidden until the setting
is turned off again, and the tab strip is never affected either way.

---

## File map

| Path | Purpose |
|---|---|
| `custom/common/custom_pref_names.h` | `kMinimalBrowsingMode` |
| `custom/browser/prefs/custom_prefs.cc` | Registers the pref, default `false` |
| `patches/chrome-browser-ui-views-frame-browser_view.cc.patch` | `IsToolbarVisible()`/`IsBookmarkBarVisible()` checks, `IsMinimalBrowsingModeEnabled()`, registrar wiring |
| `patches/chrome-browser-ui-views-frame-browser_view.h.patch` | `IsMinimalBrowsingModeEnabled()` declaration |
| `custom/components/custom_settings/components/AppearancePage.tsx` | The Settings toggle |

---

## Known limitations

- No keyboard shortcut to toggle the mode — Settings only.
- Interaction with Zen Mode and Compact Layout when combined hasn't been
  given dedicated UX treatment (e.g. no attempt to disable one when the
  other is active) — enabling more than one at once is untested territory
  covered only by "doesn't crash", not "looks good".
- Caption buttons (minimize/maximize/close) and window dragging are
  unaffected — this only touches in-window toolbar/bookmark-bar
  visibility, unlike the source project's subwindow mode, which was also
  suppressing native window chrome for embedding purposes not relevant
  here.
