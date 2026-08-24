# Screenshot / Page Capture

A toolbar button for capturing either the current visible viewport or a
user-dragged region of the page, with the result saved, copied to the
clipboard, or both, per Settings. Added v1.8.52 (2026-08-23).

Full-page capture (via `paint_preview`) and a right-click "Capture
region…" context-menu entry are planned follow-ups — not yet
implemented.

---

## Where to find it

Toolbar button (camera icon) — click to open a dropdown with "Capture
visible area" and "Capture region…".

**Settings:** Settings → Others → "Screenshots" section — save
behavior (ask each time vs. auto-save to Downloads) and whether to
also copy every capture to the clipboard.

**Prefs:**

| Pref | Type | Default |
|---|---|---|
| `custom.screenshot.save_behavior` | string enum `"prompt"` \| `"auto"` | `"prompt"` |
| `custom.screenshot.auto_save_folder` | file path | empty (falls back to the profile's Downloads folder) |
| `custom.screenshot.copy_to_clipboard` | bool | `true` |
| `toolbar.show_screenshot_button` | bool | `true` |

---

## How it works

`ScreenshotCaptureService` (a `KeyedService`, one per profile) owns
both capture paths:

- **Visible area** — `RenderWidgetHostView::CopyFromSurface()` against
  the active tab's view, with `output_size` explicitly scaled by
  `GetDeviceScaleFactor()` (`CopyFromSurface` does not auto-scale for
  HiDPI on its own).
- **Region** — shows `ScreenshotRegionSelectWidget`, a translucent
  overlay `views::Widget` scoped to the browser window's content
  bounds (modeled on the existing mouse-gesture trail overlay, but
  with `accept_events = true` and `activatable = kYes` since this one
  has to actually receive the drag and the Escape key rather than
  pass events through to the page). Once the user drags and releases,
  the same `CopyFromSurface` capture runs and the selected rect is
  cropped out of the resulting bitmap in the browser process — no
  renderer IPC, no per-element DOM awareness.

Either path hands its `SkBitmap` to `ScreenshotOutputWriter`, which:

- Writes it to the clipboard via `ui::ScopedClipboardWriter` if the
  clipboard pref is on (default on).
- Then, per the save-behavior pref: either PNG-encodes and writes
  straight to the auto-save folder on a background thread, or shows a
  native Save-As dialog (`ui::SelectFileDialog`) and writes wherever
  the user picks.

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/screenshot/screenshot_capture_service.{h,cc}` | Owns both capture paths, crops region captures |
| `custom/browser/screenshot/screenshot_capture_service_factory.{h,cc}` | `BrowserContextKeyedServiceFactory`, registers the prefs |
| `custom/browser/screenshot/screenshot_output_writer.{h,cc}` | PNG encode, Save-As dialog, auto-save, clipboard |
| `custom/browser/screenshot/screenshot_region_select_widget.{h,cc}` | Drag-to-select overlay `Widget` |
| `custom/browser/ui/views/toolbar/screenshot_toolbar_button.{h,cc}` | Toolbar `MenuButton` |
| `custom/browser/ui/views/toolbar/screenshot_menu_model.{h,cc}` | The 2-item dropdown menu |
| `custom/common/custom_pref_names.h` | Pref name constants |
| `custom/components/custom_settings/components/OthersPage.tsx` | "Screenshots" Settings section |
| `ui/views/widget/widget_delegate.h` | Vanilla file — grants `ScreenshotRegionSelectWidget` friend access to the private `WidgetDelegateView()` constructor |

---

## Known limitations

- No full-page capture yet — the toolbar dropdown only offers visible
  area and region.
- No right-click "Capture region…" context-menu entry yet — the
  toolbar button and its dropdown are the only trigger.
- No toolbar-visibility toggle in Settings for
  `toolbar.show_screenshot_button` — the pref exists and defaults to
  visible, but there's no UI control to hide it yet (other bottombar
  buttons follow the same pattern already, e.g. Tracking Dashboard).
- No post-capture confirmation toast — the capture completes silently
  (aside from the Save-As dialog itself, when that path is taken).
