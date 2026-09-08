# Screenshot Editor

A post-capture annotation editor for the
[Screenshot / Page Capture](screenshot-capture) feature — draw shapes,
add captions, blur/redact regions, crop, and undo/redo, then Save or
Copy the edited image. Scaffolding (view + Save/Copy, no tools) added
v1.9.11 (2026-09-07); the annotation tools themselves added v1.9.12
(2026-09-07), same day.

---

## Where to find it

Not opened directly — it's the destination of a capture when
`custom.screenshot.open_editor_after_capture` is on. There's no
Settings toggle for this pref yet; flip it via `chrome://advanced-prefs`
(search for `custom.screenshot.open_editor_after_capture`). With it on,
any capture (visible area, region, or full page) opens a new foreground
tab at `chrome://screenshot-editor/<id>` showing the captured image,
instead of going straight to save/clipboard.

**Default state:** Disabled by default (`false`) — captures go straight
to `ScreenshotOutputWriter` as before unless this pref is flipped on.

---

## Tools

- **Rectangle** (outline and filled), **ellipse**, **arrow**, **freehand
  line** — drag to draw.
- **Text** — click to place a small Caption/Add/Cancel popup right at
  the click point (paint-app style); Enter or "Add" commits it.
- **Blur** — drag a region; downsamples it to a tiny offscreen canvas
  and scales it back up, a real pixelation blur rather than an opaque
  paint-over.
- **Crop** — drag a region; flattens the canvas down to it via
  `getImageData`/`putImageData` (synchronous, so the canvas updates
  immediately rather than depending on an async image decode).
- **Undo/redo** — two stacks of `DrawElement[]` snapshots. Cropping
  flattens the image and clears both stacks, so undo can't reach back
  across a crop — a deliberate simplification (the pre-crop element
  geometry no longer means anything once the canvas has been resized
  and recomposited).
- Color swatches and a line-width slider apply to all draw tools.

---

## How it works

**Bitmap hand-off.** `ScreenshotCaptureService::OpenInEditor` PNG-encodes
the captured `SkBitmap`, stores the bytes in `ScreenshotEditorImageStore`
(a process-wide `base::UnguessableToken`-keyed holding pen) and opens
`chrome://screenshot-editor/<id>` with that token in the URL. The page's
`WebUIDataSource` serves the bytes back at `<id>/capture.png` via a
request filter that extracts the id from the *request path itself*, not
from a member captured at `ScreenshotEditorUI` construction time —
`WebUIDataSource::CreateAndAdd` replaces any existing source registered
under the same host, so a second concurrently-open editor tab would
otherwise silently break a first tab's filter. This avoids pushing a
multi-megabyte base64 payload over `chrome.send` — `custom_credits_ui.cc`
has its own comment on a similarly large payload crashing the renderer
before. The store entry is removed when the owning `ScreenshotEditorUI`
is destroyed (tab closed or navigated away).

**Registration.** Beyond the usual `WebUIConfigMap` entry, two more
registration points were needed (found via "This site can't be reached"
during development): a `GetWebUIFactoryFunction` switch entry in the
vanilla `chrome_web_ui_controller_factory.cc` (without it, navigation
silently `ERR_FAILED`s even with the `WebUIConfig` registered), and
`custom/components/resources/BUILD.gn`'s `repack("resources")`
deps/sources lists (a per-page `BUILD.gn` dependency alone only pulls in
the compile-time resource-ID header constants, not the actual packed
bytes).

**Editing model.** `EditorCanvas.tsx` keeps a `DrawElement[]` array
rather than painting destructively — every render pass clears the
canvas, redraws the base image, then replays every element in order
(plus the in-progress drag as a live preview). This is what makes
undo/redo a simple snapshot-stack push/pop instead of needing to
reconstruct prior canvas state some other way.

**Save/Copy.** `ScreenshotEditorDOMHandler` exposes `saveScreenshot`/
`copyScreenshot` (classic `chrome.send`, this fork's convention, not
Mojo) — the editor calls `canvas.toDataURL('image/png')` and sends the
result; the handler decodes it and calls two new
`ScreenshotOutputWriter` methods, `CopyToClipboard`/`SaveAs`, split out
from the existing pref-driven `SaveAndOfferClipboard` since an explicit
button click shouldn't follow the automatic post-capture save-behavior
pref (a deliberate Save click should always show the Save-As dialog,
regardless of whether captures normally auto-save).

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/screenshot/screenshot_editor_image_store.{h,cc}` | Process-wide id → PNG bytes holding pen |
| `custom/browser/ui/webui/screenshot_editor/screenshot_editor_ui.{h,cc}` | `WebUIConfig`/`WebUIController`, serves `capture.png` via a request filter |
| `custom/browser/ui/webui/screenshot_editor/screenshot_editor_dom_handler.{h,cc}` | `saveScreenshot`/`copyScreenshot` message handler |
| `custom/components/screenshot_editor/App.tsx` | Top-level layout, Save/Copy header, status messages |
| `custom/components/screenshot_editor/components/EditorCanvas.tsx` | The canvas, drawing logic, drag handling, crop, undo/redo |
| `custom/components/screenshot_editor/components/Toolbar.tsx` | Tool buttons, color swatches, line-width slider, undo/redo buttons |
| `custom/components/screenshot_editor/types.ts` | `DrawElement` shape types |
| `chrome/browser/ui/webui/chrome_web_ui_configs.cc` | Vanilla file — `WebUIConfigMap` registration |
| `chrome/browser/ui/webui/chrome_web_ui_controller_factory.cc` | Vanilla file — `GetWebUIFactoryFunction` entry (see "How it works" above) |
| `custom/components/resources/BUILD.gn` | Vanilla-adjacent — pak-aggregation `repack("resources")` list |

---

## Known limitations

- No Settings UI for the `open_editor_after_capture` pref — only
  reachable via `chrome://advanced-prefs`.
- Undo/redo can't cross a crop boundary (see "Tools" above).
- No PDF export or keyboard shortcuts for tool selection yet — mouse
  and the on-screen toolbar only.
- `ScreenshotEditorImageStore` is a single process-wide store, not
  profile-scoped — not a concern for this fork's single-profile-at-a-time
  usage pattern, but worth knowing if that ever changes.
