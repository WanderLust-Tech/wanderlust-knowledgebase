# Screenshot / Page Capture

A toolbar button for capturing the visible viewport, a user-dragged
region, or the entire page, with the result saved, copied to the
clipboard, or both, per Settings. Added v1.8.52 (2026-08-23); full-page
capture and an optional capture delay added v1.9.10 (2026-09-06). A
separate post-capture annotation editor also exists — see
[Screenshot Editor](screenshot-editor).

A right-click "Capture region…" context-menu entry is still a planned
follow-up — not yet implemented.

---

## Where to find it

Toolbar button (camera icon) — click to open a dropdown with "Capture
visible area", "Capture region…", and "Capture full page".

**Settings:** Settings → Others → "Screenshots" section — save
behavior (ask each time vs. auto-save to Downloads), whether to also
copy every capture to the clipboard, and an optional delay (0/3/5/10s)
before a capture fires.

**Prefs:**

| Pref | Type | Default |
|---|---|---|
| `custom.screenshot.save_behavior` | string enum `"prompt"` \| `"auto"` | `"prompt"` |
| `custom.screenshot.auto_save_folder` | file path | empty (falls back to the profile's Downloads folder) |
| `custom.screenshot.copy_to_clipboard` | bool | `true` |
| `custom.screenshot.capture_delay_seconds` | int | `0` |
| `custom.screenshot.open_editor_after_capture` | bool | `false` (no Settings UI yet — see [Screenshot Editor](screenshot-editor)) |
| `toolbar.show_screenshot_button` | bool | `true` |

---

## How it works

`ScreenshotCaptureService` (a `KeyedService`, one per profile) owns
all three capture paths:

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
- **Full page** — mirrors DevTools' own
  `Page.captureScreenshot(captureBeyondViewport: true)`
  (`content/browser/devtools/protocol/page_handler.cc`) rather than a
  scroll-and-stitch approach: gets the document's full size via
  `blink::mojom::LocalMainFrame::GetFullPageSize()`, temporarily
  resizes the render widget to it using the same device-emulation
  mechanism DevTools uses
  (`RenderWidgetHostImpl::GetAssociatedFrameWidget()->
  EnableDeviceEmulation`, including a documented double-resize
  workaround for a scrollbar-artifact bug), captures once via
  `GetSnapshotFromBrowser` (forces a fresh repaint before copying),
  then restores the original view size/web prefs regardless of
  outcome. One paint, no tiles — sidesteps the "sticky header repeats
  in every stitched tile" problem a scroll+stitch approach would need
  to guard against. Capped at a 16K-pixel dimension ceiling; fails
  cleanly rather than attempting a capture the compositor can't
  actually satisfy.

If `custom.screenshot.capture_delay_seconds` is set, the visible-area
and full-page paths defer the actual capture via a
`base::SequencedTaskRunner::PostDelayedTask` before running (region
capture isn't delayed this way — that flow already waits on the user's
drag).

Once a bitmap exists, `HandleCaptureResult` either opens it in the
[Screenshot Editor](screenshot-editor)
(`custom.screenshot.open_editor_after_capture`) or hands it to
`ScreenshotOutputWriter`, which:

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
| `custom/browser/screenshot/screenshot_capture_service.{h,cc}` | Owns all three capture paths, crops region captures, resizes+restores for full-page |
| `custom/browser/screenshot/screenshot_capture_service_factory.{h,cc}` | `BrowserContextKeyedServiceFactory`, registers the prefs |
| `custom/browser/screenshot/screenshot_output_writer.{h,cc}` | PNG encode, Save-As dialog, auto-save, clipboard (also exposes `CopyToClipboard`/`SaveAs` as independent methods the editor's Save/Copy buttons call directly) |
| `custom/browser/screenshot/screenshot_region_select_widget.{h,cc}` | Drag-to-select overlay `Widget` |
| `custom/browser/ui/views/toolbar/screenshot_toolbar_button.{h,cc}` | Toolbar `MenuButton` |
| `custom/browser/ui/views/toolbar/screenshot_menu_model.{h,cc}` | The 3-item dropdown menu |
| `custom/common/custom_pref_names.h` | Pref name constants |
| `custom/components/custom_settings/components/OthersPage.tsx` | "Screenshots" Settings section (save behavior, clipboard toggle, delay) |
| `ui/views/widget/widget_delegate.h` | Vanilla file — grants `ScreenshotRegionSelectWidget` friend access to the private `WidgetDelegateView()` constructor |

---

## Known limitations

- No right-click "Capture region…" context-menu entry yet — the
  toolbar button and its dropdown are the only trigger.
- No toolbar-visibility toggle in Settings for
  `toolbar.show_screenshot_button` — the pref exists and defaults to
  visible, but there's no UI control to hide it yet (other bottombar
  buttons follow the same pattern already, e.g. Tracking Dashboard).
- No Settings UI for `custom.screenshot.open_editor_after_capture` yet
  — set it via `chrome://advanced-prefs` for now.
- No post-capture confirmation toast — the capture completes silently
  (aside from the Save-As dialog itself, when that path is taken).
