# Browser Tools

Five utility commands in the three-dot app menu under `BUILDFLAG(CUSTOM_BROWSER)`:
Restart, Restart & Clear Cache, Flush Memory, View Formatted Source, and Reuse
This Window for Popups. The first three appear at the bottom of the menu just
above the Exit item, after a normal separator that follows Settings. The latter
two (added later, cross-referenced from `EasyBrowserAdvanced`'s deep-dive doc —
see `changelog.md`) sit in their own group right after Print, next to the
existing (unwired-in-this-fork) `IDC_VIEW_SOURCE`.

---

## Build flag

Gated by `BUILDFLAG(CUSTOM_BROWSER)`. Controlled by `custom_browser = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

---

## Commands

### Restart — `IDC_CUSTOM_RESTART`

Calls `chrome::AttemptRestart()` directly. Equivalent to closing and reopening
the browser with session restore. All open tabs are saved and restored on the
next launch.

### Restart & Clear Cache — `IDC_CUSTOM_RESTART_CLEAR_CACHE`

Clears the HTTP cache for all unprotected web origins, then restarts.

Uses `BrowsingDataRemover::RemoveAndReply` with a heap-allocated
`RestartObserver` that fires `chrome::AttemptRestart()` once the cache removal
completes and self-deletes:

```cpp
class RestartObserver : public content::BrowsingDataRemover::Observer {
 public:
  void OnBrowsingDataRemoverDone(uint64_t failed_data_types) override {
    chrome::AttemptRestart();
    delete this;
  }
};

// In AppMenuModel::ExecuteCommand:
case IDC_CUSTOM_RESTART_CLEAR_CACHE:
  browser_->profile()->GetBrowsingDataRemover()
      ->RemoveAndReply(base::Time(), base::Time::Max(),
                       content::BrowsingDataRemover::DATA_TYPE_CACHE,
                       content::BrowsingDataRemover::ORIGIN_TYPE_UNPROTECTED_WEB,
                       new RestartObserver());
  return;
```

The observer is created on the heap and self-deletes in `OnBrowsingDataRemoverDone`
so no ownership plumbing is needed. `DATA_TYPE_CACHE` covers the HTTP disk cache
only — cookies, history, and stored passwords are not touched.

> **M137 API note:** `GetBrowsingDataRemover()` changed from a static method
> (`content::BrowserContext::GetBrowsingDataRemover(context*)`) to a non-static
> member in Chromium M137. See
> [chromium-136-to-137-migration.md §4.5](chromium-136-to-137-migration.md).

### Flush Memory — `IDC_CUSTOM_FLUSH_MEMORY`

Sends a critical memory pressure notification across all browser processes:

```cpp
case IDC_CUSTOM_FLUSH_MEMORY:
  base::MemoryPressureListener::NotifyMemoryPressure(
      base::MemoryPressureListener::MEMORY_PRESSURE_LEVEL_CRITICAL);
  return;
```

This triggers Chromium's built-in memory pressure response in every process:

- **Renderer processes** — V8 garbage collection, image cache eviction,
  parsed script cache purge
- **GPU process** — GPU resource cache flush
- **Browser process** — any `MemoryPressureListener` callbacks registered by
  browser subsystems

No tabs are closed. Effect is equivalent to the OS sending a low-memory signal
and can free several hundred MB in a typical browsing session with many open tabs.

### Reuse This Window for Popups — `IDC_REUSE_WINDOW_FOR_POPUPS`

A real **checkable** app-menu item (this fork's first — the other four
commands on this page are plain clickable items; `AppMenuModel::
IsCommandIdChecked` previously only handled vanilla Chromium's own
`IDC_SHOW_BOOKMARK_BAR`/`IDC_PROFILING_ENABLED`/`IDC_TOGGLE_REQUEST_TABLET_SITE`,
copied here for the new id). Per-window, in-memory-only runtime toggle — not a
profile pref — for kiosk/signage deployments where you want `window.open()`/
`target=_blank` to reuse the current window as a new tab instead of spawning a
new one, without needing a relaunch to change the launch-flag-only behavior
`--app`/kiosk mode already offers.

```cpp
// Browser::AddNewContents, chrome/browser/ui/browser.cc — right after the
// existing Mac-only fullscreen popup→tab rewrite, same shape, not IS_MAC-gated:
if (reuse_window_for_popups_ &&
    (disposition == WindowOpenDisposition::NEW_POPUP ||
     disposition == WindowOpenDisposition::NEW_WINDOW)) {
  disposition = WindowOpenDisposition::NEW_FOREGROUND_TAB;
}
```

The bool lives directly on `Browser` (`bool reuse_window_for_popups_ = false;`),
following the exact in-memory-only precedent already set by `BrowserView::
split_view_active_` — this fork's only other example of per-window (not
per-profile, not per-tab) runtime state. Resets to off on every relaunch;
there is deliberately no persisted pref.

`Browser::AddNewContents` is the single central point for this — it's where
both `chrome::AddWebContents` (renderer `window.open()`) and, transitively,
`Browser::OpenURLFromTab` (ctrl-click / target=_blank links) funnel through
before `Navigate()` runs.

### View Formatted Source — `IDC_CUSTOM_VIEW_FORMATTED_SOURCE`

Opens a new tab (`chrome://formatted-source/?id=<uuid>`) showing the active
tab's current HTML, reformatted for readability — a one-click alternative to
"open DevTools → Sources → find the doc → click the pretty-print `{}` button"
for users who don't already know DevTools exists.

**How the HTML is fetched — deliberately not `view-source:` or
`RenderFrameHost::GetSerializedHtmlWithLocalLinks`:**

- Real `view-source:` (`third_party/blink/renderer/core/html/
  html_view_source_document.cc`) renders the **original, literal response
  bytes** verbatim (no reformatting), and always requires a brand-new
  navigation + tab + `SiteInstance` — the wrong tool for "show me this page's
  HTML, nicely formatted."
- `RenderFrameHostImpl::GetSerializedHtmlWithLocalLinks` — what "Save Page
  As... Complete" actually calls — would give exactly the right *semantics*
  (current rendered DOM, no new navigation), but it's declared only on
  `RenderFrameHostImpl`, not the public `content::RenderFrameHost` interface,
  so embedder code (chrome/custom) can't call it directly.
- The public alternative, `WebContents::SavePage()`, works but creates a
  visible entry in the downloads system — an unwanted side effect for what's
  meant to feel like a snappy, one-click action.
- `RenderFrameHost::ExecuteJavaScript` (public) is restricted to
  `chrome://`/`devtools://` URLs; `ExecuteJavaScriptForTests` lifts that
  restriction but is explicitly documented "ONLY FOR TESTS" — not appropriate
  to ship.

**What it actually uses**: `content::DevToolsAgentHost` +
a hand-built CDP `Runtime.evaluate` call (`FormattedSourceContentFetcher`,
`custom::DevToolsAgentHostClient` subclass) requesting
`document.documentElement.outerHTML`. This is the same public, sanctioned
mechanism Chromium's own headless/automation surfaces use to run JS in an
arbitrary page from browser-process C++ — no visible side effect, no
test-only API, no content-internal header.

The fetched HTML is handed off via `FormattedSourceContentStore` — a
one-shot, in-memory, process-global `std::map<std::string, std::string>`
keyed by a fresh UUID (not a pref, not a `KeyedService`; this is ephemeral
handoff data, consumed exactly once by the new tab's DOM handler and then
erased) — then a new foreground tab opens at
`chrome://formatted-source/?id=<uuid>`.

**Pretty-printing — reuses DevTools' own formatter, with a known gap**: the
React frontend (`custom/components/formatted_source/App.tsx`) is written to
spin up a Web Worker at `/formatter_worker-entrypoint.js` and speak
`third_party/devtools-frontend`'s `formatter_worker` postMessage protocol
directly (`{method:'format', params:{mimeType, content, indentString}}`) —
deliberately not DevTools' full Sources-panel wrapper
(`models/formatter/formatter.ts`), which pulls in SDK/workspace dependencies
this page has no use for; the worker's own GN target has no such dependency.
**This isn't wired up yet.** Two real obstacles, both investigated but not
resolved: (1) `devtools_entrypoint`'s default `visibility = [":*"]`
(same-BUILD-file-only, via the `devtools_visibility` `declare_args()` in
`front_end/visibility.gni` — a real, supported override point, just not yet
used) blocks a normal GN `deps` line; (2) more fundamentally, the generated
`formatter_worker-entrypoint.js` is **not** a self-contained bundle — it's a
raw ES module importing the rest of devtools-frontend's module graph
(`platform.js`, etc.), so neither a live GN dependency nor a simple
vendor-and-copy of one file is sufficient; the whole transitive closure
would need bundling/rolling up first, the way DevTools' own shipping `.pak`
does it. Until that's solved, the page **gracefully degrades**: on any
worker load/format failure it falls back to showing the raw, unformatted
HTML (still copy-pasteable and searchable) with a small "(unformatted —
pretty-printer unavailable)" label, rather than showing nothing. Dropping a
working bundle at that path is the only thing a future pass needs to do —
no other code changes.

---

## File map

| File | Change |
|---|---|
| `chrome/browser/ui/toolbar/app_menu_model.cc` (patch) | `RestartObserver` class; `ExecuteCommand`/`IsCommandIdEnabled` cases for all five ids; `Build()` menu item additions; `IsCommandIdChecked` extended for `IDC_REUSE_WINDOW_FOR_POPUPS` |
| `chrome/app/chrome_command_ids.h` (patch) | Registers `IDC_CUSTOM_RESTART`, `IDC_CUSTOM_RESTART_CLEAR_CACHE`, `IDC_CUSTOM_FLUSH_MEMORY`, `IDC_REUSE_WINDOW_FOR_POPUPS`, `IDC_CUSTOM_VIEW_FORMATTED_SOURCE` |
| `custom/app/generated_resources.grdp` | `IDS_MENU_RESTART`, `IDS_MENU_RESTART_CLEAR_CACHE`, `IDS_MENU_FLUSH_MEMORY`, `IDS_MENU_REUSE_WINDOW_FOR_POPUPS`, `IDS_MENU_VIEW_FORMATTED_SOURCE` string entries (this fork's own `.grdp` fragment — not `custom/grd/custom_strings.grd`, which doesn't exist in this tree; fixing that stale reference here) |
| `chrome/browser/ui/browser.h` / `.cc` (patch) | `reuse_window_for_popups_` bool + accessors; the `AddNewContents` disposition rewrite |
| `chrome/browser/ui/browser_commands.h` / `.cc` (patch) | `ToggleReuseWindowForPopups()`, `ViewFormattedSource()` |
| `chrome/browser/ui/browser_command_controller.cc` (patch) | Dispatch + enablement for both new ids |
| [`browser/formatted_source/`](../src/custom/browser/formatted_source/) | `FormattedSourceContentStore`, `FormattedSourceContentFetcher` (the CDP client), `RequestFormattedSource()` |
| [`browser/ui/webui/formatted_source/`](../src/custom/browser/ui/webui/formatted_source/) | `FormattedSourceUI` + `FormattedSourceDOMHandler`, registered in `chrome_web_ui_configs.cc` |
| [`components/formatted_source/`](../src/custom/components/formatted_source/) | React bundle: fetch by id, attempt worker-based formatting, raw-HTML fallback |
| `custom/tools/gritsettings/resource_ids_custom.spec` | New grit resource-id range for `formatted_source_resources.grd` (`includes: [31970]`) — every new `build_react_webui` bundle needs an entry here, in `custom/browser/ui/webui/BUILD.gn`'s `deps`, and in `custom/components/resources/BUILD.gn`'s repack `deps`/`sources` — easy to miss all three on a new bundle, as this one did during development |

---

## Testing

- **Restart:** Open the app menu → click Restart. Browser closes and reopens;
  previously open tabs should restore.
- **Restart & Clear Cache:** Same path. After restart, force-reload
  (`Ctrl+Shift+R`) a previously visited page — the response should be a fresh
  200 (not a 304 from cache).
- **Flush Memory:** Open `chrome://memory-internals` and note the private memory
  footprint of renderer processes. Click Flush Memory. Reload
  `chrome://memory-internals` — footprint of renderer processes should decrease
  measurably (most visible after heavy JavaScript or many open tabs).
- **Reuse This Window for Popups:** Toggle the menu item on (confirm it shows
  checked). Visit a page that does `window.open()` or has a `target=_blank`
  link; confirm it opens as a new foreground tab in the same window, not a
  new window. Toggle off; confirm normal new-window behavior returns. Open a
  second browser window and confirm its toggle is independent (per-window,
  not global).
- **View Formatted Source:** On any real page, open the app menu → View
  Formatted Source. Confirm a new tab opens showing the page's current HTML.
  Until the formatter-worker gap above is closed, expect the "(unformatted)"
  label and raw (but still readable/searchable) HTML rather than indented
  pretty-printed output.

---

## Related docs

- [cyberfox-features.md](cyberfox-features.md) — origin analysis (features 2 and 3)
- [chromium-136-to-137-migration.md](chromium-136-to-137-migration.md) — §4.5 `GetBrowsingDataRemover` API change
