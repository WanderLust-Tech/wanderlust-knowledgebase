# Reader Mode Integration

**Correction (v1.9.21, 2026-09-14):** this article previously described a
much more complete implementation than actually existed — fictional CSS
injection, a `ReaderModeCache`, a `ContentAnalysisConfig` heuristic tuner,
and a "Migration from Original Patch" section claiming ✅ full DOM
distiller integration, none of which was ever real. Before this version,
`StartDistillation()` faked success after a fixed delay with a hardcoded
placeholder string (`"<h1>Distilled Content</h1><p>Article content would
appear here...</p>"`), and `ApplyReaderModeStyles()` only logged a
character count — no CSS or content ever reached the page. This rewrite
describes what's actually implemented as of v1.9.21, not what was
originally aspirational.

## What it is

A toolbar button that distills the current article-style page using
Chromium's own `components/dom_distiller` and navigates to its
already-built `chrome-distiller://` viewer — the real "Reader Mode"
Chrome itself would have, just not enabled by default upstream. Manual
trigger only: automatic per-page detection exists in the code but is off
by default and, separately, not actually wired to fire (see Known
limitations).

## Where to find it

The **Reader Mode toolbar button** (`reader_mode_button.cc`) is the real,
working entry point — click to enter, click again to exit. A right-click
**context-menu item** also exists but is currently a no-op (see Known
limitations) — don't rely on it.

| Where | What |
|---|---|
| [`custom_browser_config.gni`](../src/custom/custom_browser_config.gni) | `custom_enable_reader_mode = true`, `custom_reader_mode_distillation = true`, `custom_reader_mode_auto_detect = false` (all defaults) |
| Toolbar button | [`ui/views/toolbar/reader_mode_button.cc`](../src/custom/browser/ui/views/toolbar/reader_mode_button.cc) — calls `ToggleReaderMode()`, observes state/availability to update its own visibility and tooltip |
| Command ID | `kPageDistill = 35083` (`IDC_PAGE_DISTILL` from the original, pre-rewrite patch) |
| Manager | [`chrome/browser/features/custom_reader_mode_manager.{cc,h}`](../src/custom/chrome/browser/features/custom_reader_mode_manager.cc) — a bare process-wide singleton (`base::Singleton`), not per-tab despite inheriting `WebContentsObserver` |

## How it works

```
Toolbar button click
   │
   ▼
CustomReaderModeManager::ToggleReaderMode(web_contents)
   │
   ├── state == kAvailable → DistillPage(web_contents)
   │     │
   │     ▼
   │     StartDistillation(web_contents)
   │     │
   │     ▼
   │     DistillCurrentPageAndViewIfSuccessful(web_contents, callback)
   │       (chrome/browser/dom_distiller/tab_utils.h -- real upstream
   │        Chromium code, unmodified)
   │       - Wraps the *existing* WebContents (SourcePageHandleWebContents)
   │         -- no hidden/second WebContents needed for the current tab
   │       - DomDistillerService (always real; not gated by any flag)
   │         extracts the article
   │       - On success, navigates this same WebContents to
   │         chrome-distiller://<url>/... to display it -- a normal,
   │         back-navigable entry
   │     │
   │     ▼
   │     OnDistillationCompleted(web_contents, bool success)
   │       - Sets ReaderModeState::kActive or kError
   │       - Notifies observers (the toolbar button updates)
   │
   └── state == kActive → ExitReaderMode(web_contents)
         - NavigationController::GoBack() if possible (distillation was a
           real navigation now, so this returns to the original article --
           falls back to Reload() if there's no back entry)
```

The distilled HTML itself never passes through `CustomReaderModeManager`
at all — the navigation to the viewer *is* the display. This is simpler
than it looks: `DistillCurrentPageAndViewIfSuccessful` already does
everything (extraction + viewer navigation) in one call; nothing here
duplicates or wraps dom_distiller's own logic.

### Enabling the viewer

Chromium's `chrome-distiller://` viewer (`DomDistillerViewerSource`) is
real, already-registered infrastructure — not something built for this
feature. It's normally gated behind `IsDomDistillerEnabled()`, which by
default only checks for a `--enable-dom-distiller` command-line switch
(off by default upstream). A small patch to
`components/dom_distiller/core/dom_distiller_features.cc` makes it also
return `true` under this fork's own `BUILDFLAG(ENABLE_READER_MODE)`, so
the viewer registers without needing a hidden command-line flag just for
a built-in feature:

```cpp
bool IsDomDistillerEnabled() {
#if BUILDFLAG(ENABLE_READER_MODE)
  return true;
#else
  return base::CommandLine::ForCurrentProcess()->HasSwitch(
      switches::kEnableDomDistiller);
#endif
}
```

Two older, unrelated cosmetic patches already touched adjacent files
(`dom_distiller_viewer.js`/`dom_distiller_viewer_source.cc` — CSP/font-URL
tweaks) — those confirmed the viewer pipeline was buildable well before
this fix; this is the first patch that actually turns it on.

## File map

| Path | Purpose |
|---|---|
| `custom/chrome/browser/features/custom_reader_mode_manager.{h,cc}` | The manager — state tracking, command handling, calls into `DistillCurrentPageAndViewIfSuccessful` |
| `custom/browser/ui/views/toolbar/reader_mode_button.cc` | The real, working UI entry point |
| `chrome/browser/dom_distiller/tab_utils.{h,cc}` (unmodified upstream) | `DistillCurrentPageAndViewIfSuccessful` and friends — the actual extraction+viewer-navigation logic |
| `components/dom_distiller/core/dom_distiller_features.cc` (patched) | `IsDomDistillerEnabled()` — the one line gating whether the viewer registers at all |
| `chrome-browser-ui-browser_command_controller.cc.patch` | Wires `IDC_PAGE_DISTILL` → `CustomReaderModeManager::GetInstance()->DistillPage(web_contents)` |
| `chrome-browser-renderer_context_menu-render_view_context_menu.cc.patch` | Adds a "Read Mode" context-menu item — currently a no-op, see Known limitations |

## Known limitations

- **The context-menu "Read Mode" item does nothing.** It calls
  `ExecCommandWebSite(3)`, which is a `// TODO: ToggleDistilledView
  function no longer exists in Chromium` stub in the patch itself — a
  pre-existing broken entry point, not touched by this fix. Use the
  toolbar button instead.
- **Auto-detection is off by default, and wouldn't actually fire even if
  turned on.** `CustomReaderModeManager` is a bare singleton that never
  calls `Observe()` on any `WebContents` — so `DidFinishNavigation`/
  `DocumentOnLoadCompletedInPrimaryMainFrame` (the methods that would
  drive auto-detection) are dead code regardless of the
  `custom_reader_mode_auto_detect` build flag. Not a regression from this
  fix — this was already true, just newly relevant to call out now that
  the manual path actually works.
- **`IsArticleContent()` still always returns `true`.** No real
  distillability heuristic runs. `tab_utils.h` exposes a ready-made real
  one — `RunReadabilityHeuristicsOnWebContents(web_contents, callback)`,
  the same check upstream Chrome's own reader-mode UI uses — but it's
  async and this method is currently synchronous. Moot for the default
  config anyway, since auto-detection (the only caller) is off and
  non-functional per the point above; a real follow-up would need to fix
  both together.
- **No in-place restyling.** Distillation always navigates to
  `chrome-distiller://...` rather than reformatting the page in place —
  this matches how upstream Chrome's own "Distill page" feature behaves,
  but is a real behavior difference from what earlier documentation (and
  the QA checklist, before this correction) described.
