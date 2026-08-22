# Picture-in-Picture Hover Button

A floating button that appears over any `<video>` element on hover,
toggling native Picture-in-Picture for it — works site-wide, independent
of whatever native video controls (or lack thereof) a page ships. Added
v1.8.48 (2026-08-22).

---

## Where to find it

No dedicated page — it just appears when hovering a large-enough video
on any site. Toggle: Settings → Others → Web content → "Show a
Picture-in-Picture button when hovering videos" (on by default).

**Pref:** `custom.picture_in_picture_button.enabled` (bool, default `true`).

---

## How it works

`PictureInPictureButtonTabHelper` (a `WebContentsObserver`) injects a
self-contained script via `RenderFrameHost::ExecuteJavaScript` on
`DidFinishNavigation` — only for the primary main frame, and only for
real, non-same-document, non-error-page navigations (so SPA route
changes and hash navigations don't re-inject).

The injected script is idempotent per page load (guarded by
`window.__wlPipInjected`) and installs:

- A single floating `<div>` button, hidden until a matching video is
  hovered, positioned via `getBoundingClientRect()` on scroll/resize.
- A `mouseenter` listener on every `<video>` at least 80×80px
  (`MIN_SIZE`) that shows the button; a 250ms hide delay (`HIDE_DELAY`)
  so moving from the video to the button doesn't flicker it away.
- A `MutationObserver` on `document.documentElement` that picks up
  videos added later by client-side routing, infinite scroll, etc. —
  this is why the helper doesn't need to re-inject on same-document
  navigations the way `InstagramDownloaderTabHelper` does for its own
  passive-capture script.
- A click handler that calls `element.requestPictureInPicture()` (or
  `document.exitPictureInPicture()` if that video is already the active
  PiP element).

Videos with the `disablePictureInPicture` attribute are skipped
entirely — the button never attaches to them. The whole script no-ops
immediately if `document.pictureInPictureEnabled` is false (e.g. the
Document Picture-in-Picture policy disables it).

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/picture_in_picture/picture_in_picture_button_tab_helper.{h,cc}` | The `WebContentsObserver` + injected script |
| `custom/common/custom_pref_names.h` | `kPictureInPictureButtonEnabled` |
| `custom/browser/prefs/custom_prefs.cc` | Registers the pref, default `true` |
| `custom/components/custom_settings/components/OthersPage.tsx` | The Settings toggle |

---

## Known limitations

- No visual indicator distinguishing "in PiP" vs. "not in PiP" beyond
  the tooltip text swapping ("Picture in picture" ↔ "Exit picture in
  picture") — the icon itself doesn't change state.
- 80×80px minimum size is a fixed constant, not configurable.
- Injected once per top-level navigation via `ExecuteJavaScript` — a
  page that never fires a "real" navigation after initial load (pure
  client-side app shells that only ever hash-route) still gets the
  initial injection, but relies entirely on the `MutationObserver` to
  catch anything added afterward.
