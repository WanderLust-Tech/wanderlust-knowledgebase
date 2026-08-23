# WanderLust Browser — Full Feature QA Checklist

> **Purpose:** A comprehensive, click-through manual test pass covering every custom feature in the WanderLust Chromium fork. Use this after a Chromium version rebase, a large patch-stack change, or before cutting a release build.

## How to use this document

- Work through each section top to bottom in a fresh build. Each feature has a **What it is**, **Where to find it**, **Default state** (buildflag/pref defaults — helpful context if something doesn't appear), and a checklist of concrete steps with expected results.
- Check off `- [ ]` items as you go (`- [x]`) — this file is designed to be edited directly as a running test log.
- Where a 📷 line appears, drop your screenshot right below it (e.g. `![Sidebar docked and undocked](./images/qa/sidebar.png)`) once you've captured it. A local `images/qa/` folder next to this file works well for that.
- Steps requiring editing a profile's `Preferences`/`Local State` file directly (a handful of features have no settings-page UI yet) call this out explicitly — always close the browser fully before hand-editing a prefs file, and relaunch afterward.
- Some features are **disabled by default** (noted per-section) — that's expected, not a bug; enable them first before testing.
- If a step fails, note the build version/commit and the exact failure next to the checkbox rather than just leaving it unchecked, so a re-test after a fix can confirm the same scenario.

## Build under test

| Field | Value |
|---|---|
| Browser version | |
| Chromium base version | |
| Build config (Debug/Release) | |
| Platform (Windows/macOS/Linux) | |
| Tester | |
| Date | |

---

## Table of Contents

1. [Browser UI](#browser-ui)
2. [Input & Interaction](#input--interaction)
3. [Privacy & Security](#privacy--security)
4. [Network & Downloads](#network--downloads)
5. [Content & Reading](#content--reading)
6. [New Tab Page](#new-tab-page)
7. [Settings & Configuration](#settings--configuration)
8. [Custom WebUI](#custom-webui)
9. [Installer & Auto-Update](#installer--auto-update)

---

## Browser UI

### Sidebar

**What it is:** A right-edge (or left-edge) panel hosting built-in surfaces — Bookmarks, History, RSS, Notes, NTP Settings, Recently Closed — plus user-pinned arbitrary websites ("Web Panels"). Can be docked inside the browser window or undocked into a floating, draggable, auto-hiding widget.
**Where to find it:** Collapsed pane-button strip on the window edge by default. Right-click anywhere on the sidebar for the "Undock/Dock Sidebar" and "Expand/Collapse" context menu. Settings toggle for position/enabled state lives in the sidebar settings page.
**Default state:** Enabled by default — gated by `BUILDFLAG(ENABLE_SIDEBAR)`, `enable_sidebar = true`. Fresh profile launches docked and collapsed to the pane-button handle.

- [x] Click a pane button (e.g. Bookmarks) in the collapsed sidebar strip — **Expected:** sidebar auto-expands and loads that pane's content.
- [x] Click the expand/collapse button in the pane strip — **Expected:** sidebar animates open/closed smoothly.
- [x] Right-click the sidebar → "Undock Sidebar" — **Expected:** sidebar detaches into a floating frameless widget snapped to a screen edge; docked sidebar in the browser window disappears.
- [x] Drag the undocked floating widget to a different screen edge — **Expected:** it snaps to the nearest edge (left/right/top/bottom) within ~80px.
- [x] Leave the undocked widget idle (don't touch it) for ~5 seconds — **Expected:** it auto-hides to a thin 4px peek strip; moving the cursor onto the strip reveals it again.
- [x] Right-click the undocked widget → "Dock Sidebar" — **Expected:** it re-attaches inside the browser window at its last docked position.
- [x] Drag the sidebar's inner resize handle (docked, expanded) — **Expected:** sidebar width changes and persists after restart.
- [x] Open Settings → pin a site by URL under "Web Panels" — **Expected:** a new globe-icon button appears in the pane strip; clicking it loads the live site in place, keeping scroll/session state when you switch away and back.
- [ ] As of v1.8.35: pin a site under Web Panels that you've visited before (has a favicon in local history/bookmarks) — **Expected:** the pane-strip button shows that site's real favicon instead of the generic globe icon.
- [ ] Pin a site you've never visited before — **Expected:** button falls back to the generic globe icon (nothing to resolve in the local favicon DB — no network fetch is attempted).
- [ ] As of v1.8.35: right-click a pinned Web Panel button → "Unpin from Sidebar" — **Expected:** the button disappears immediately from the sidebar itself (previously only removable via Settings → Sidebar → Web Panels).
- [x] On any New Tab Page layout, click the gear/settings icon — **Expected:** sidebar opens directly to the NTP Settings panel.
- [ ] As of v1.8.45: switch between a couple of different browser themes (or light/dark mode) and look at the Bookmarks, History, RSS, Page Notes, both Settings, and Expand/Collapse icons in the pane strip — **Expected:** all of them recolor to match the active theme, consistent with the Agent/Recently-Closed/Dock-toggle icons in the same strip (previously these six were hardcoded flat-color raster PNGs that never recolored and visually stood out). Also confirm Page Notes shows its own distinct icon, not History's icon reused.

📷 *Screenshot suggestion: the sidebar in both docked-expanded and undocked-floating states, side by side.*

### Sidebar Apps

**What it is:** Lets Windows users pin native desktop applications (`.lnk` shortcuts) to the sidebar's button strip via a right-click shell context menu entry, so clicking the icon launches the app directly.
**Where to find it:** Right-click any `.lnk` shortcut on the Desktop or in File Explorer → "Add to Wanderlust Sidebar". Pinned apps appear as icons at the bottom of the sidebar's pane-button strip.
**Default state:** Enabled whenever the Sidebar is enabled — no separate buildflag (`BUILDFLAG(ENABLE_SIDEBAR)`). Windows-only.

- [ ] Right-click a desktop `.lnk` shortcut (e.g. Notepad) — **Expected:** "Add to Wanderlust Sidebar" appears in the context menu.
- [ ] Click it while the browser is already running — **Expected:** an icon for the app appears at the bottom of the sidebar's button strip within a couple seconds, no new window opens.
- [ ] Click the pinned app icon in the sidebar — **Expected:** the target application launches as a normal Windows process.
- [ ] Right-click the pinned app icon in the sidebar → "Remove from Sidebar" — **Expected:** the icon disappears from the strip.
- [ ] Add the same shortcut twice (or two different shortcuts pointing at the same .exe) — **Expected:** only one icon appears (silent de-dupe by executable path).
- [ ] Repeat the "Add to Wanderlust Sidebar" step with the browser fully closed — **Expected:** browser launches, opens a normal window, and the app is pinned (same end state as the running-browser case).
- [ ] As of v1.8.36: check the pinned app's icon in the sidebar — **Expected:** shows the actual application's real icon (resolved via `SHGetFileInfo`), not a generic/placeholder icon.
- [ ] As of v1.8.38: repeat "Click it while the browser is already running" and "Repeat... with the browser fully closed" above — **Expected:** both now actually work end to end (previously the registered shell verb used space-separated switch syntax that Chromium's command-line parser couldn't pair with its value, so `AddApp()` silently never ran — clicking while running did nothing, and on cold start the `.lnk` path opened/downloaded as a normal file argument instead of being pinned).
- [ ] On an install that already had the old broken verb registered, just relaunch the browser (no reinstall, no manual registry edit) — **Expected:** the self-heal check on launch (`EnsureSidebarAppsContextMenuRegistered()`) detects and corrects the stale registry command automatically.

📷 *Screenshot suggestion: File Explorer right-click menu showing "Add to Wanderlust Sidebar", next to the sidebar showing the resulting pinned icon.*

### Panels (extension floating windows)

**What it is:** Restores Chromium's old "panel" window type — small, dockable, always-on-top windows that extensions can open via `chrome.windows.create({type:'panel'})`, separate from normal tabs/windows.
**Where to find it:** Not user-facing directly — triggered by an extension. Use the bundled test extension at `test-extensions/panels-test/` (Load unpacked via `chrome://extensions`) to exercise it.
**Default state:** Enabled by default — gated by `BUILDFLAG(ENABLE_PANELS)`, `enable_panels = true`. No runtime toggle; the build flag is the only gate.

- [ ] Load the `panels-test` extension unpacked via `chrome://extensions` (enable Developer mode first) — **Expected:** loads without errors.
- [ ] Click the extension's toolbar icon and use its popup to create a panel — **Expected:** a small frameless window appears docked to the bottom-right of the screen, showing real page content (not a black rectangle).
- [ ] Open several panels in a row — **Expected:** they pack right-to-left along the bottom edge and auto-shrink to fit.
- [ ] Drag one panel on top of another — **Expected:** they merge into a vertical stack.
- [ ] Close a panel via its own close (X) button — **Expected:** panel disappears cleanly, no crash.
- [ ] Check `chrome://extensions` → Details → "Inspect views" or the task manager (`Shift+Esc`) while a panel is open — **Expected:** the panel's WebContents shows up as its own row.
- [ ] As of v1.8.20: open one docked panel, one detached panel (drag it away from the edge), and stack two more panels together, then fully restart the browser — **Expected:** the docked panel comes back docked, the two stacked panels come back stacked together in the same order, and the detached one comes back detached — not everything collapsed to detached (the old behavior; before this fix, panels didn't reopen at all after a restart).
- [ ] Close one panel out of a 3-panel stack (via its own close button), leaving 2 — **Expected:** the remaining 2-panel stack still restores correctly after a restart (not the closed one, which shouldn't reappear).
- [ ] As of v1.8.22: from the extension's background page/console, call `chrome.windows.create({type:'detached_panel', url:'...'})` — **Expected:** a free-floating detached panel opens (not docked to the screen edge, and not an error) — previously this call errored with "invalid window type."

📷 *Screenshot suggestion: two or three docked panels packed along the bottom-right of the screen.*

### Custom HTML Infobars

**What it is:** Lets extensions (via `chrome.infobars.show()`) or internal browser code drop a horizontal HTML banner above a tab's page content — like Chrome's old infobars, but the entire banner is arbitrary HTML/JS instead of native UI chrome.
**Where to find it:** Not directly user-facing — triggered by an extension calling `chrome.infobars.show({tabId, path, height})`. Use the bundled test extension at `test-extensions/infobars-test/`.
**Default state:** Enabled by default — gated by `BUILDFLAG(CUSTOM_EXTENSION_INFOBAR)`, `custom_extension_infobar = true`.

- [ ] Load the `infobars-test` extension unpacked via `chrome://extensions` — **Expected:** loads without errors.
- [ ] Open any `http(s)` page (not a `chrome://` page), click the extension's toolbar icon, then click a basic test button — **Expected:** a horizontal HTML banner appears above the page content, below the tab strip.
- [ ] Click the banner's close (X) button — **Expected:** banner dismisses; the popup's log records the dismissal exactly once.
- [ ] Trigger a test button that grows/shrinks its own content height dynamically — **Expected:** the infobar smoothly animates to the new height (clamped to a max of 72px) without a page reload.
- [ ] Navigate the tab to a different URL while the infobar is showing — **Expected:** infobar is dismissed automatically.
- [ ] Try triggering an infobar on a `chrome://` page (e.g. `chrome://settings`) — **Expected:** the call fails with an "Unable to attach infobar to tab" style error, since system pages have no infobar manager.

📷 *Screenshot suggestion: an HTML infobar banner open above a normal web page.*

### Browser Tools (app menu utilities)

**What it is:** Four utility commands added to the three-dot app menu: Restart, Restart & Clear Cache, Flush Memory, and Reuse This Window for Popups.
**Where to find it:** Three-dot app menu (⋮). Restart / Restart & Clear Cache / Flush Memory sit at the bottom of the menu just above Exit. Reuse This Window for Popups sits in its own group right after Print.
**Default state:** Enabled by default — gated by `BUILDFLAG(CUSTOM_BROWSER)`, `custom_browser = true`.

- [x] Open several tabs, then app menu → Restart — **Expected:** browser closes and reopens with all previous tabs restored.
- [x] Visit a page, force-reload it once (`Ctrl+Shift+R`) so it's cached, then app menu → Restart & Clear Cache — **Expected:** browser restarts; force-reloading the same page afterward shows a fresh 200 response, not a 304 from cache.
- [ ] Open `chrome://memory-internals`, note renderer memory usage, then app menu → Flush Memory — **Expected:** no tabs close; reloading `chrome://memory-internals` shows measurably lower renderer memory footprint (most visible with many tabs/heavy JS open).
- [x] Toggle app menu → "Reuse This Window for Popups" on — **Expected:** menu item shows a checkmark.
- [ ] With it toggled on, visit a page that does `window.open()` or has a `target="_blank"` link — **Expected:** it opens as a new foreground tab in the same window instead of a new window.
- [ ] Toggle it off and repeat — **Expected:** normal new-window behavior returns. Open a second browser window and confirm its toggle state is independent (per-window, not global, and resets to off after a restart).

📷 *Screenshot suggestion: the app menu open, showing all four custom items in their two groups.*

### Splash Screen

**What it is:** A branded startup overlay — a small frameless window showing the WanderLust name and tagline — displayed for 2.5 seconds when the browser first launches.
**Where to find it:** Appears automatically right after the first browser window opens on launch. No settings toggle.
**Default state:** Enabled by default — gated by `BUILDFLAG(ENABLE_SPLASH_SCREEN)`, `enable_splash_screen = true`.

- [x] Fully close the browser, then relaunch it — **Expected:** a small (480×280) dark-navy window with "WanderLust" and "Private · Fast · Yours" text appears on top, without stealing focus from the main browser window.
- [x] Wait without interacting — **Expected:** after 2.5 seconds the splash window fades and closes on its own (~300ms fade).
- [x] While the splash screen is visible, check Alt+Tab / the taskbar — **Expected:** the splash window does not appear in either (Windows `WS_EX_TOOLWINDOW`).
- [x] Try clicking into the main browser window while splash is showing — **Expected:** main window is interactive immediately; splash screen doesn't block input.

📷 *Screenshot suggestion: the splash screen window itself, captured within the first 2.5 seconds of a fresh launch.*

### Tab Utilities (context menu commands)

**What it is:** Extra commands added to the tab right-click context menu: Copy URL, Copy All URLs, Clone Tab to New Window, Clone Tab to Incognito, and Close Tabs to Left.
**Where to find it:** Right-click any tab in the tab strip.
**Default state:** Enabled by default — gated by `BUILDFLAG(CUSTOM_BROWSER)`, `custom_browser = true`.

- [x] Right-click a tab → Copy URL — **Expected:** clipboard contains that tab's current URL.
- [x] Open several tabs, right-click any tab → Copy All URLs — **Expected:** clipboard contains a newline-separated list of every open tab's URL.
- [x] Right-click a tab → Clone Tab to New Window — **Expected:** a new regular browser window opens with the same URL, no shared cookies/history/session with the original.
- [x] Right-click a tab in a normal (non-incognito) window → Clone Tab to Incognito — **Expected:** an incognito window opens with the same URL.
- [x] Right-click a tab that is already incognito — **Expected:** "Clone Tab to Incognito" is not shown in the menu.
- [x] Open 4-5 tabs, right-click one in the middle → Close Tabs to Left — **Expected:** all unpinned tabs to its left close; tabs to the right and the tab itself remain.

📷 *Screenshot suggestion: the tab right-click context menu showing the five new items.*

### Tab Behaviors (scroll, double-click, keep-last-tab)

**What it is:** Three mouse/close-behavior tweaks for the tab strip: scroll-wheel tab switching, double-click-to-close, and configurable "keep last tab" behavior when closing a window's final tab.
**Where to find it:** Behavior is automatic on the tab strip; the "keep last tab" behavior is configurable via its pref (check Settings for a corresponding tab-behavior section).
**Default state:** Scroll-wheel switching enabled by default on Windows (disabled by default on macOS); double-click-to-close enabled by default; keep-last-tab defaults to "close with new tab" (opens a blank NTP instead of closing the window). All part of `BUILDFLAG(CUSTOM_BROWSER)`.

- [ ] Hover the mouse over the tab strip (not a specific tab) and scroll the wheel down — **Expected:** the next tab to the right becomes active; scrolling at the last tab wraps to the first.
- [ ] Scroll up — **Expected:** the previous tab becomes active, wrapping at the first tab.
- [x] Double-click the body of a tab (not its close button) — **Expected:** that tab closes immediately.
- [x] With only one tab open in a window, close it via the tab's close button or `Ctrl+W` — **Expected:** (default behavior) a new blank tab opens first, then the old tab closes — the window stays open rather than closing.

📷 *Screenshot suggestion: not essential for this one — a short screen recording of the scroll-to-switch behavior is more useful than a static image.*

### Close & Quit Confirmation

**What it is:** As of v1.8.51, two independently-toggled confirmation prompts under Settings → Tabs → "Closing": confirming before closing a window with 2+ tabs (pre-existing mechanism, newly exposed in Settings), and confirming before quitting the browser entirely (brand new).
**Where to find it:** Settings → Tabs → "Closing" section — "Confirm before closing a window with multiple tabs" and "Confirm before quitting the browser."
**Default state:** Both off by default.

- [ ] Enable "Confirm before quitting the browser," then close your only open window (or use the app menu's Exit command) — **Expected:** a "Quit WanderLust" dialog appears asking "This will close all windows and tabs. Are you sure you want to quit?" with OK/Cancel and a "Do not ask next time" checkbox.
- [ ] Click Cancel — **Expected:** the browser stays open, nothing closes.
- [ ] Repeat and click OK — **Expected:** the browser quits normally.
- [ ] Repeat once more, but check "Do not ask next time" before confirming — **Expected:** the browser quits, and the Settings toggle is now off — quitting again doesn't prompt.
- [ ] With "Confirm before quitting" enabled, open a second browser window, then close just one of the two windows — **Expected:** no prompt (the app isn't quitting — another window remains open).
- [ ] Enable "Confirm before closing a window with multiple tabs," open 2+ tabs in a window, then close the window (not via the app quitting) — **Expected:** a confirmation dialog appears before the window actually closes.
- [ ] With only one tab open, close the window — **Expected:** no prompt (the pref only applies at 2+ tabs).
- [ ] With both toggles enabled, close the last window with multiple tabs open (an action that both closes a multi-tab window *and* quits the app) — **Expected:** per the implementation comment, the two dialogs are checked in a fixed order (quit check before tab-close check) specifically so they don't appear stacked/overlapping on top of each other — confirm what you actually observe (e.g. quit dialog only, or quit dialog followed by a separate tab-close dialog) and note it, since this exact sequencing hasn't been manually verified end-to-end yet.

📷 *Screenshot suggestion: the "Quit WanderLust" confirmation dialog.*

### Tab Shapes

**What it is:** Lets the user choose the visual shape of browser tabs — Round (default), Rectangle, or Trapezoid.
**Where to find it:** `chrome://settings/customTab` — "Tab Shape" section at the top of the page, with visual previews for each option.
**Default state:** Enabled by default (`enable_tab_shapes = true`); shape defaults to Round. Per the feature doc, tab-rendering integration is flagged as only "Partial" — visually confirm the tab strip actually redraws, don't assume it does.

- [x] Navigate to `chrome://settings/customTab` — **Expected:** a "Tab Shape" section appears with three preview options (Round/Rectangle/Trapezoid).
- [x] Click "Rectangle" — **Expected:** open browser tabs visually update to sharp rectangular corners immediately, no restart needed.
- [x] Click "Trapezoid" — **Expected:** tabs update to the angled trapezoid shape.
- [x] Click "Round" to return to default — **Expected:** tabs return to rounded corners.
- [ ] Toggle the browser to dark mode with a non-default shape selected — **Expected:** the settings-page preview swaps to its dark-mode image variant.
- [ ] Restart the browser after picking a non-default shape — **Expected:** the chosen shape persists (falls back to Round only if the pref is somehow corrupted).

📷 *Screenshot suggestion: the `chrome://settings/customTab` page showing the three shape previews, and the actual tab strip in each of the three shapes.*

### Vertical Tabs

**What it is:** Replaces the horizontal tab strip across the top of the window with a narrow, collapsible vertical column of tab buttons on the left or right edge — with many additional features layered on: hover-to-expand, pinning, drag-resize, tree/nested-tab mode, density presets, search/filter, multi-select, sorting, saved sessions, hover thumbnail previews, and vim-style keyboard navigation.
**Where to find it:** Enable via the vertical-tabs settings toggle (tab settings page). Once enabled, replaces the horizontal strip automatically.
**Default state:** Enabled by default (`enable_vertical_tabs = true`), but the vertical layout itself is a runtime per-profile toggle that starts off/horizontal until the user switches it on.

- [ ] Enable the vertical tabs pref in Settings — **Expected:** horizontal tab strip disappears; a narrow (~50px) vertical column of tab icons appears on the configured side.
- [ ] Hover the mouse over the collapsed bar — **Expected:** it animates outward to ~250px, revealing full tab titles and close (✕) buttons; moving the mouse away shrinks it back.
- [ ] Click the pin button (visible once the bar is expanded) — **Expected:** the bar locks open at a fixed width and stops responding to hover; a resize handle appears on its inner edge.
- [ ] Drag the resize handle while pinned — **Expected:** bar width changes live and persists after restart.
- [ ] Open a new tab (`Ctrl+T`) and navigate somewhere — **Expected:** a new button appears in the vertical strip live, with favicon and title updating as the page loads.
- [ ] Open tabs to a few sites with distinctly-colored favicons (e.g. a red-logo site, a blue-logo site) and expand the bar — **Expected:** each tab button shows a thin color stripe on its bar-position edge roughly matching that site's favicon color, once the favicon finishes loading.
- [ ] Open a tab to a site with no favicon (or before one loads) — **Expected:** stripe falls back to the hostname-heuristic category color (e.g. YouTube/Netflix → red, GitHub/Stack Overflow → green) instead of showing nothing or a stale color from a previous tab.
- [ ] Right-click a tab with a visible favicon-color stripe → assign it to a manual tab group with a group color — **Expected:** the stripe switches to the group's chosen color, overriding the favicon-derived color.
- [ ] Open a link with ctrl-click / middle-click from an existing tab, then right-click empty space in the bar → note a parent/child relationship — **Expected:** with Tree mode enabled (settings), the new tab appears indented as a child with a disclosure triangle on the parent.
- [ ] Right-click empty space below the tab buttons → "Sort tabs by" → Title — **Expected:** unpinned, ungrouped tabs reorder alphabetically; pinned/grouped tabs stay put.
- [ ] Right-click empty space → "Save tabs as new session", then close those tabs, then right-click → "Restore session ▸" and pick it — **Expected:** all previously-open tabs reopen as background tabs.
- [ ] As of v1.8.29: save a session, restart the browser, and confirm it still appears under "Restore session ▸" and restores correctly — **Expected:** the new `schemaVersion` field on each saved session (added for future forward-compat) doesn't change or break normal save/restore behavior.
- [ ] Ctrl-click (Cmd-click on Mac) two different tab buttons — **Expected:** both are added to a multi-selection (visually highlighted); right-click → Close should close both.
- [ ] Press "/" while a tab button has focus — **Expected:** a search/filter row appears; typing narrows the visible tabs to title/URL matches; Escape clears it.
- [ ] Hover a tab button for about half a second without clicking — **Expected:** a small floating thumbnail preview of that tab's page appears beside it.
- [ ] With focus on a tab button, press `j`/`k` (or arrow keys) — **Expected:** as of v1.8.25, focus moves down/up between tab buttons *and* the newly-focused tab becomes active (its page shows in the content area) — not just a focus-ring move. `Home`/`End` jump to first/last with the same activation.
- [ ] With vim visual-select mode active (`v` while a tab has focus), press `j`/`k` to extend the selection across several tabs — **Expected:** no crash or double-activation glitching; each step extends the highlighted multi-selection normally (the new activate-on-arrow code path is explicitly skipped while in visual mode, so it doesn't add any new activation calls on top of whatever selection-extension already does).
- [ ] **Vertical → horizontal switch-back** (status genuinely unclear as of 2026-08-17 — see `docs/chromium/debugging/vertical-to-horizontal-switch.md`): Launch fresh in horizontal mode. In Settings, change "Tab bar position" away from Top (e.g. Left) — vertical bar should appear and work correctly. Then change it back to Top. **Expected (if actually fixed):** the horizontal tab strip repaints immediately with all tabs and the upstream `+` new-tab button visible, no restart needed. **Known-broken symptoms to watch for (if NOT fixed):** tab strip area blank except a small chevron at the top-left, no `+` button, and/or tabs briefly flicker blank when opening a new tab via Ctrl+T before self-correcting. Repeat the horizontal→vertical→horizontal cycle 2-3 times — the original bug reproduced on every cycle, not just the first. Report the actual result either way (even "still broken" or "confirmed fixed") back to the doc — six previous fix attempts were each believed to have failed, and a seventh (undocumented) fix landed 2026-06-29 that has never been runtime-verified either way.

📷 *Screenshot suggestion: the vertical tab bar in both collapsed (hover-out) and expanded (hover-in) states, plus one shot of Tree mode showing indented child tabs.*

### Container Tabs

**What it is:** Firefox-Multi-Account-Containers-style tab isolation — a tab assigned to a named container gets its own cookie jar/storage, so you can be logged into the same site as two different accounts in two tabs without incognito or separate profiles.
**Where to find it:** Right-click empty space in the vertical tab bar → "New tab in container ▸" (pick a container) or "Manage containers…". Settings page: `chrome://settings/containers`.
**Default state:** Enabled by default — part of `BUILDFLAG(CUSTOM_BROWSER)` tooling; requires the vertical tab bar to access the menu entry point.

- [ ] Go to `chrome://settings/containers` and create two containers with different names/colors — **Expected:** both appear in a list, editable/deletable.
- [ ] Right-click empty vertical-tab-bar space → "New tab in container ▸" → pick container A, log into a site (e.g. an email provider) — **Expected:** new tab opens normally, no special container UI chrome, but is isolated.
- [ ] Repeat with container B, same site — **Expected:** you can log in as a different account without being logged out of the first.
- [ ] Ctrl-click a link inside a container tab — **Expected:** the newly opened child tab inherits the same container (same logged-in session, no fresh login).
- [ ] Trigger a `window.open()` popup from a container tab (e.g. an OAuth "login with provider" popup) — **Expected:** popup also lands in the same container.
- [ ] Restart the browser with a container tab open (or use "reopen closed tab") — **Expected:** as of v1.8.17, the restored tab keeps its container's isolated storage (still logged in as the container's account) rather than falling back to the default partition.
- [ ] Save a tab group containing a container tab, close it, then reopen the saved group — **Expected:** the reopened tab keeps its container's isolated storage. Note: this mapping is local to this device (not synced), so reopening the same saved group on a different device will not carry the container assignment there.
- [ ] Open a container tab, force-discard it (`chrome://discards` or via the memory saver settings), then reactivate it by switching to its tab — **Expected:** container isolation survives the discard/reactivate cycle.

📷 *Screenshot suggestion: `chrome://settings/containers` page with two containers configured, plus the "New tab in container ▸" submenu.*

### Custom Download Shelf

**What it is:** Replaces Chrome's download bubble (the small popup near the toolbar) with a bottom shelf bar showing active/recent downloads, with extra per-item commands: hide, delete from list, delete file from disk.
**Where to find it:** Appears automatically at the bottom of the window when a download starts. Toggle back to Chrome's bubble at `chrome://settings/customOthers` ("Use Chrome's download bubble instead of the custom download shelf").
**Default state:** Enabled by default — gated by `BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)`, `custom_download_shelf = true`. The bubble-revert pref (`custom.enable_download_bubble`) defaults to `false` (shelf is the default UI).

- [ ] Download any file — **Expected:** a shelf bar slides up from the bottom of the window immediately (no ~2s delay like upstream Chrome), showing the file's progress, icon, and name.
- [ ] Right-click a download item in the shelf — **Expected:** context menu includes Open, Pause/Resume/Cancel (while active), plus "Hide", "Delete from list", and "Delete file".
- [ ] Click "Hide" on an item — **Expected:** item disappears from the shelf for this session (download history still has it).
- [ ] Click "Delete file" on a completed download — **Expected:** the file is removed from disk and from the download list/history.
- [ ] Go to `chrome://settings/customOthers` and enable "Use Chrome's download bubble instead of the custom download shelf" — **Expected:** next download shows Chrome's normal small bubble near the toolbar instead of the bottom shelf.
- [ ] Toggle "Invisible download bar" on (same settings section) — **Expected:** downloads are still tracked/listed at `chrome://downloads` but no shelf bar visually appears.
- [ ] Toggle the download toolbar button visibility pref — **Expected:** the download icon in the toolbar shows/hides accordingly.

📷 *Screenshot suggestion: the custom download shelf at the bottom of the window with an active download and its right-click context menu open.*

### Enhanced Omnibox

**What it is:** Address-bar enhancements. Two pieces are real and working as of v1.8.16: a `settings:` quick-action provider that jumps straight to a `chrome://settings` sub-page, and a fixed RSS-in-omnibox provider that suggests subscribed feed items matching typed text. URL Formatting and Security Indicators (also originally planned under this feature) are still not implemented.
As of v1.8.29, `CustomSearchProvider` (the RSS-in-omnibox provider) no longer reaches into `chrome/browser`-layer `RSSService`/`Profile` directly from `components/omnibox/browser` — a real layering violation from the 1.8.16 fix that only surfaced as an undefined-symbol link failure at full-browser link time (deferred at 1.8.17, fixed properly here). Functionally unchanged from the user's perspective; see enhanced-omnibox.md for the architecture.
**Where to find it:** The main address bar (omnibox) — no dedicated settings page; `settings:` and RSS suggestions require no toggle beyond having subscribed an RSS feed via `chrome://reader` (for RSS suggestions specifically, also check the RSS feature's own omnibox-integration toggle under `chrome://settings/rss`).
**Default state:** `settings:` quick actions work out of the box. RSS suggestions require an active feed subscription with omnibox search enabled.

- [ ] Type `settings:` followed by a partial section name (e.g. `settings: passwords`, `settings: privacy`) — **Expected:** a suggestion appears with the matching section's label, navigating directly to the right `chrome://settings/<section>` sub-page on selection (not the settings hub page).
- [ ] Type `settings: appearance` — **Expected:** a suggestion appears (note: both `appearance` and `appearance-and-layout` routes share the "Appearance" label, so either may surface as the top match).
- [ ] Subscribe to an RSS feed via `chrome://reader`, then type a few characters from one of its item titles into the omnibox — **Expected:** a suggestion labeled "RSS" appears; selecting it navigates to that item's link.
- [ ] With no RSS feeds subscribed (or omnibox search disabled under `chrome://settings/rss`), type text that would otherwise match an RSS item — **Expected:** no RSS suggestion appears, no crash.
- [ ] Type a plain search query into the omnibox — **Expected:** normal suggestions appear (bookmarks/history/search engine) with no crash or visual corruption.
- [ ] Type a full URL into the omnibox — **Expected:** the URL displays normally with the usual security indicator (lock icon / "Not secure", etc.) — unchanged, since URL Formatting/Security Indicators were not part of this pass.

📷 *Screenshot suggestion: the omnibox dropdown showing a `settings:` quick-action suggestion alongside a normal search suggestion.*

### Split View

**What it is:** A secondary web panel that opens alongside the main tab content, split by a draggable divider — lets you browse two pages side by side in one window without a second window.
**Where to find it:** Toolbar split-view button, app menu → "Toggle Split View" (in the zoom/print section), keyboard shortcut `Ctrl+Shift+E`, or right-click any link → "Open link in split view".
**Default state:** Enabled by default — gated by `BUILDFLAG(ENABLE_SPLIT_VIEW)`, `enable_split_view = true`.

- [ ] Press `Ctrl+Shift+E` — **Expected:** a secondary panel opens taking up half the content width, with a draggable divider between it and the main page.
- [ ] Right-click a link on any page → "Open link in split view" — **Expected:** the link's target loads directly into the split panel (main tab is undisturbed).
- [ ] Drag the divider left/right — **Expected:** panel/main-content split ratio changes live; dragging to an extreme stops at a minimum ~100px for either side (can't fully collapse either pane).
- [ ] Click a link inside the split panel — **Expected:** navigation happens inside the panel itself; it never opens a new tab.
- [ ] Click into the split panel to focus it, then look at the omnibox — **Expected:** omnibox URL updates to reflect the panel's page.
- [ ] With the panel focused, type a new URL in the omnibox and press Enter — **Expected:** the panel navigates (not the main tab).
- [ ] Press `Ctrl+Shift+E` again (or click the toolbar button) — **Expected:** panel and divider close, main content reclaims the full width.

📷 *Screenshot suggestion: split view open with two different pages visible side by side and the divider between them.*

### Workspaces (Spaces)

**What it is:** Named collections of saved tab groups bundled with a sidebar panel choice and a set of proxy-routing rules — switching workspaces collapses/hides the outgoing workspace's tab groups and reopens/expands the incoming one's, updates the sidebar to that workspace's chosen panel, and (if proxy routing is on) applies its proxy rule subset. A profile-wide action affecting every open window of that profile.
**Where to find it:** Right-click empty space in the vertical tab bar → "Switch workspace ▸" (checkmark shows the active one) / "New workspace" / "Manage workspaces…". Settings page: `chrome://settings/workspaces`.
**Default state:** Always enabled — not gated by a buildflag, switchable per profile.

- [ ] Right-click empty vertical-tab-bar space → "New workspace" — **Expected:** a new workspace is created and immediately becomes active (auto-named "Workspace N" since there's no text-prompt dialog).
- [ ] Go to `chrome://settings/workspaces` — **Expected:** the new workspace appears in a list; you can edit its name, color, assigned sidebar panel, assigned saved tab groups, and assigned proxy routing rules.
- [ ] Save a tab group (right-click a tab group header → save), then assign that saved group to a workspace in the settings page — **Expected:** the group shows as checked/assigned in the workspace's edit form.
- [ ] Create a second workspace and assign a different saved tab group to it — **Expected:** each workspace independently lists only its own assigned groups.
- [ ] Right-click the vertical tab bar → "Switch workspace ▸" → pick the second workspace — **Expected:** the first workspace's assigned tab group collapses (or hides) in the tab strip, and the second workspace's tab group opens/expands; this happens in every open browser window of the same profile, not just the active one.
- [ ] Assign different sidebar panels (e.g. Bookmarks vs. RSS) to two workspaces, then switch between them — **Expected:** the sidebar's active panel switches to match each workspace automatically.
- [ ] Delete the currently active workspace via Settings — **Expected:** it's removed from the list and there is no longer an active workspace (no crash, no orphaned checkmark in the switch menu).

📷 *Screenshot suggestion: `chrome://settings/workspaces` list view plus the "Switch workspace ▸" submenu with two workspaces and a checkmark on the active one.*

### Boss Key

**What it is:** A configurable global keyboard shortcut that lets you instantly hide/reveal the browser — useful for quickly getting the browser out of sight.
**Where to find it:** Settings → Others page (`chrome://settings/customOthers`) — "Boss key" checkbox plus a command-text field to record the shortcut.
**Default state:** Disabled by default (`boss_key.enabled` pref defaults to `false`); default recorded shortcut text is `Ctrl+F9` even while disabled.

- [ ] Go to `chrome://settings/customOthers` and enable the boss key checkbox — **Expected:** a "configure shortcut" row becomes visible (previously hidden) showing the current shortcut text (default `Ctrl+F9`).
- [ ] Click into the shortcut field and press a new key combination (e.g. `Ctrl+Shift+B`) — **Expected:** the field enters a "capturing" state (visibly highlighted), then displays the new combination once a valid key is pressed, and saves it as the new shortcut.
- [ ] Press Escape while the field is capturing, before pressing a real combination — **Expected:** capture cancels and the field reverts to its previous value.
- [ ] With the boss key enabled and a shortcut set, click elsewhere to unfocus Settings, then press the configured shortcut anywhere (even outside the browser window, since this is a global accelerator) — **Expected:** browser hides/minimizes instantly.
- [ ] Press the shortcut again — **Expected:** browser returns/restores.
- [ ] Uncheck the boss key checkbox — **Expected:** the shortcut row hides again and the global shortcut stops responding.
- [ ] With two browser windows/profiles open and boss key enabled in both with the same shortcut — **Expected:** no crash; only one instance's registration is actually active at a time (per the service's own conflict-avoidance), and disabling one profile's boss key hands the registration off to the other if it's still enabled.

📷 *Screenshot suggestion: the Others settings page with the boss key checkbox checked and the shortcut-capture field showing a recorded combination.*

---

## Input & Interaction

### Mouse Gestures

**What it is:** Native (extension-free) right-mouse-button gesture input with three modes: stroke gestures (drag a shape), wheel gestures (scroll while right button held), and rocker/locker gestures (click the opposite button while one is held).
**Where to find it:** Custom Settings WebUI → Mouse Gesture page (`MouseGesturePage.tsx`, includes the `GestureCaptureCanvas` stroke recorder); gestures themselves fire directly on any webpage viewport by holding the right mouse button.
**Default state:** Enabled by default — gated by `BUILDFLAG(ENABLE_MOUSE_GESTURES)`, `enable_mouse_gestures = true` in `custom_browser_config.gni`. Runtime master switch `mouse_gesture.enabled` defaults to `true`. Note: default `locker_gesture.flip_back` / `locker_gesture.flip_forward` prefs are `NO_ACTIONS` (no-op) until configured.

- [ ] Hold the right mouse button on a normal webpage and drag in a shape, then release — **Expected:** a stroke trail/direction-label overlay draws live during the drag (Windows only; other platforms execute the action with no visual trail), and on release the resolved action (per the mapping currently shown/configured in the Mouse Gesture settings page) executes; no context menu appears.
- [ ] Right-click and release quickly without dragging (no recognized stroke) — **Expected:** the normal right-click context menu appears (the buffered mouse-down/up is replayed to the renderer).
- [ ] Open the Mouse Gesture settings page and use the gesture capture canvas to record a new stroke → action mapping, then perform that exact stroke on a page — **Expected:** the newly configured action fires and matches the label shown during the drag.
- [ ] Hold the right mouse button and scroll the wheel up — **Expected:** on Windows, default action is "select previous tab" (`SELECT_PREVIOUS_TAB`); on Mac default is no-op (`NO_ACTIONS`) unless configured. No context menu appears on release.
- [ ] Hold the right mouse button and scroll the wheel down — **Expected:** on Windows, default action is "select next tab" (`SELECT_NEXT_TAB`); Mac default no-op.
- [ ] Hold the right mouse button down, then click (press) the left mouse button while right is still held — **Expected:** triggers the "Flip Back" locker action (default `NO_ACTIONS` — configure a real action in settings first to observe an effect, then repeat this test).
- [ ] Hold the left mouse button down, then click the right mouse button while left is still held — **Expected:** triggers the "Flip Forward" locker action (default `NO_ACTIONS` — configure then retest).
- [ ] With the master toggle (`mouse_gesture.enabled`) turned off in settings — **Expected:** right-drag no longer produces gesture behavior; normal right-click context menu works as stock Chromium.

📷 *Screenshot suggestion: capture the stroke-trail overlay mid-drag on Windows showing the direction trail and resolved action label.*

### Autoscroll (Middle-Click Scroll)

**What it is:** A settings toggle that disables Chromium's built-in middle-click autoscroll (the pan-by-moving-the-mouse cursor mode).
**Where to find it:** Settings → Others → Web content → "Disable autoscroll" checkbox.
**Default state:** Enabled by default (middle-click autoscroll behaves like stock Chromium out of the box). Gated by `BUILDFLAG(ENABLE_AUTOSCROLL_DISABLED)`, `enable_autoscroll_disabled = true` in `custom_browser_config.gni` — this flag enables the *ability to disable* autoscroll, it does not itself disable autoscroll.

- [ ] On a long scrollable page, click the middle mouse button on empty page content — **Expected:** the scroll-anchor cursor icon appears and moving the mouse pans the page (stock behavior).
- [ ] Go to Settings → Others → Web content and check "Disable autoscroll" — **Expected:** setting saves immediately.
- [ ] Without reloading the tab, click the middle mouse button on the same page again — **Expected:** autoscroll no longer activates (per doc, the pref propagates live via `pref_watcher.cc`, no reload required).
- [ ] Uncheck "Disable autoscroll" in settings, then middle-click the page again — **Expected:** autoscroll cursor mode resumes.
- [ ] With autoscroll disabled, middle-click directly on a link — **Expected:** link still opens in a new background tab (unrelated stock Chromium behavior, not gated by this pref).

📷 *Screenshot suggestion: the scroll-anchor cursor icon active on a page, contrasted with the "Disable autoscroll" checkbox in Settings → Others.*

### Super Drag

**What it is:** Drag selected text, a link, or an image and drop it anywhere in the window; the drag direction (up/down/left/right) determines a configurable action — open in tab, search, copy, save link/image, etc.
**Where to find it:** Custom Settings WebUI → Super Drag page (`SuperDragPage.tsx` — actions configurator, exceptions manager, reset dialog); triggered directly by dragging selectable content on any page.
**Default state:** Enabled by default — gated by `BUILDFLAG(ENABLE_SUPER_DRAG)`, `enable_super_drag = true`. `super_drag.enabled` pref defaults `true`. Minimum drag distance to activate (`super_drag.reaction_distance`) defaults to 25px.

- [ ] Select some text on a page, drag it **upward** more than ~25px, release — **Expected:** default action `BACKGROUND_TAB` fires — the dragged text/link opens as a search or URL in a new background tab; a drag-tip bubble shows the resolved action during the drag.
- [ ] Repeat the same drag **downward** — **Expected:** also opens in a new background tab (default for all 4 cardinal directions).
- [ ] Repeat dragging a link **left**, then **right** — **Expected:** both open the link in a new background tab by default.
- [ ] Drag a link or text diagonally (e.g., up-and-left) — **Expected:** default mapping for diagonal/combined directions is `NO_ACTIONS`; no super-drag action fires (drop falls through to normal renderer drag-drop).
- [ ] Drag content only a few pixels (well under the 25px reaction distance) and release — **Expected:** super drag never activates; normal browser drag/drop behavior occurs instead.
- [ ] In the Super Drag settings page, add the current site to `super_drag.exceptions`, then repeat a cardinal drag on that site — **Expected:** super drag is fully suppressed on that page.
- [ ] Drag an image downward — **Expected:** default `BACKGROUND_TAB` opens the image URL in a new background tab (verify vs. explicit `OPEN_IMAGE_IN_NEW_TAB` mapping if reconfigured).
- [ ] Toggle off `super_drag.tip_enabled` in settings, repeat a drag — **Expected:** no visual bubble/overlay appears during the drag, but the action still fires on drop.
- [ ] As of v1.8.19: in the Super Drag settings page, assign a search engine to one gesture direction (e.g. up), then drag a hyperlink (not plain text) in that direction and release — **Expected:** the drop searches the search engine using the link's visible text as the query, opening a search-results page — not a direct navigation to the link's href. The mid-drag bubble should also show the "search with X" hint while dragging, not just the disposition label.
- [ ] Repeat the same drag in a direction with **no** search engine assigned — **Expected:** unchanged existing behavior — the link opens directly (navigates to its href).
- [ ] As of v1.8.29: assign a search engine to a gesture, then click "Reset to default" in the Super Drag settings page — **Expected:** the assignment is actually cleared this time (a pre-existing bug meant Reset silently did nothing to search-engine assignments before this fix), and gesture direction mappings return to their defaults.

📷 *Screenshot suggestion: mid-drag screenshot showing the Super Drag bubble overlay with its resolved action label (e.g., "Open in new tab").*

### Enhanced Scroll Animation System

**What it is:** Configurable smooth-scroll animation for mouse-wheel scrolling — tunable duration, velocity ramp, and easing curve — replacing Chromium's hardcoded scroll-animation constants.
**Where to find it:** No settings-page UI documented; tuned via command-line switches only: `--custom-scroll-duration=<ms>`, `--custom-scroll-velocity=<px>`, `--disable-enhanced-scrolling`.
**Default state:** Enabled by default — `custom_enhanced_scrolling = true` in `custom_browser_config.gni`, default duration 30ms (min 10ms) and velocity ramp 680–700px, ease-in-out curve. No per-profile pref/toggle exists in the UI today.

- [ ] Scroll a long page with the mouse wheel using default settings — **Expected:** scroll animates smoothly with an ease-in-out feel, completing quickly (10–30ms depending on scroll delta) rather than jumping instantly.
- [ ] Relaunch the browser with `--custom-scroll-duration=100` and scroll the same page — **Expected:** each wheel-scroll animation visibly takes longer/slower than default.
- [ ] Relaunch with `--custom-scroll-velocity=200` and perform small wheel flicks — **Expected:** the max-duration ramp is reached at a much smaller scroll distance than default (animation "maxes out" sooner).
- [ ] Relaunch with `--disable-enhanced-scrolling` and scroll — **Expected:** scrolling falls back to stock Chromium scroll-animation behavior (graceful fallback, no crash).
- [ ] Perform rapid successive wheel scrolls in quick succession — **Expected:** no stutter, dropped frames, or animation queue buildup.
- [ ] Compare wheel-scroll feel against trackpad/touch scroll on the same page — **Expected:** enhanced animation applies to wheel scrolling; touch/trackpad scrolling remains unaffected (per doc's intended integration scope).

📷 *Screenshot suggestion: not easily captured as a still — consider a short screen recording of a wheel-scroll at default vs. `--custom-scroll-duration=100` for visual comparison instead.*

### Typed Input History

**What it is:** A per-profile store of URLs typed directly into the address bar, offering frecency-ranked (frequency + recency) autocomplete suggestions as you type — ported from Firefox's Places `moz_inputhistory` design.
**Where to find it:** No dedicated settings page or toggle — operates automatically in the omnibox. Data persists to `{profile}/typed_input_history.json`.
**Default state:** Enabled by default, always active for regular profiles — gated by `BUILDFLAG(ENABLE_TYPED_INPUT_HISTORY)`, `enable_typed_input_history = true` in `custom_browser_config.gni`. No pref exists to disable it at runtime.

- [ ] Click the address bar, type a full URL directly (e.g. `github.com`) and press Enter to navigate (must be typed, not pasted/clicked) — **Expected:** navigation commits normally.
- [ ] Later, click the address bar and type a matching prefix (e.g. `gith`) — **Expected:** the previously typed URL appears as a ranked suggestion in the dropdown.
- [ ] Type and navigate to the same URL several more times, then retype the prefix — **Expected:** that suggestion ranks higher/first as its frecency score (frequency + recency) increases.
- [ ] Open an Incognito window and type a prefix that matches a URL typed in the regular profile — **Expected:** the suggestion still appears (read-only sharing from the parent profile), but navigating with it does not add/alter entries in the regular profile's history (Incognito typed navigations aren't recorded).
- [ ] Fully close and relaunch the browser, then retype a previously-used prefix — **Expected:** the suggestion is still present (data persisted to `typed_input_history.json`, reloaded lazily on first use).
- [ ] Navigate to a URL by clicking a link or bookmark (not typing) — **Expected:** this does NOT get recorded as typed history (only `PAGE_TRANSITION_TYPED` navigations qualify).

📷 *Screenshot suggestion: omnibox dropdown showing a typed-history suggestion ranked above/below regular history matches while typing a partial URL.*

---

## Privacy & Security

### Ad Blocker

**What it is:** Blocks requests to known ad/tracker hosts before the network fetch starts, using a bundled EasyList + EasyPrivacy filter engine plus element-hiding (cosmetic) CSS injection.
**Where to find it:** `chrome://settings` → Privacy and security → "Ad blocker" → **Block ads and trackers** toggle. Status shown via an omnibox page-action icon (ads-off badge) on any page with blocks.
**Default state:** Enabled by default. Gated by `BUILDFLAG(ENABLE_AD_BLOCKER)` (`enable_ad_blocker = true`); pref `custom.enable_ad_block` defaults to `true`.

- [ ] Visit a typical news site or ad-heavy page (loads `doubleclick.net`, `google-analytics.com`, etc.) — **Expected:** omnibox shows an "ads off" badge icon shortly after load.
- [ ] Click the badge icon — **Expected:** a bubble opens listing the blocked hosts for the current page.
- [ ] Open DevTools → Network tab, reload the page — **Expected:** blocked requests show status `(blocked:other)` with tooltip referencing `wanderlust-adblock`.
- [ ] Toggle "Block ads and trackers" off in Settings, reload the page — **Expected:** badge disappears, blocked count is zero.
- [ ] Navigate to a fresh tab — **Expected:** badge is hidden and any open bubble reflects an empty state.
- [ ] Visit a page with cosmetic (element-hiding) rules (e.g. a site with a known ad-container div) — **Expected:** the hidden element does not render (inspect via View Source vs rendered DOM — the element exists in DOM but has injected `display:none` style).
- [ ] As of v1.8.18: visit a page matching a `/regex/`-style EasyList rule (or add one locally to `bundled_filter_rules.cc` for testing) — **Expected:** the matching request is now blocked, where before it silently passed through.
- [ ] As of v1.8.26: force a background refresh (temporarily shrink `custom.filter_list_refresh.interval_hours`, or delete `WanderLustAdBlockCache.txt` and restart) — **Expected:** a fetch to `easylist.to` occurs, `WanderLustAdBlockCache.txt` appears under the user-data dir, and `BlockersWorker` picks up the new rules without a restart (verify by blocking a host only present in the freshly fetched list, not the bundled snapshot).
- [ ] As of v1.8.26: restart the browser after a successful refresh — **Expected:** the ad blocker loads from `WanderLustAdBlockCache.txt` on startup rather than the bundled `bundled_filter_rules.cc` snapshot (check via `VLOG(1)` output or a deliberately stale bundled marker rule).
- [ ] As of v1.8.26: feed the updater a truncated/near-empty response (e.g. a local test server, or briefly lower the sanity threshold) — **Expected:** the fetch is rejected, a `LOG(WARNING)` fires, and the existing engine/cache is left untouched.

📷 *Screenshot suggestion: the omnibox ad-block badge plus its opened bubble showing a list of blocked hosts.*

### Tracking Parameter Removal (Privacy Guard / URL Purify)

**What it is:** Strips known tracking query parameters (`utm_*`, `fbclid`, `gclid`, per-site params for Google/Amazon/Facebook/YouTube/etc.) from outbound URLs before the request leaves the browser.
**Where to find it:** `chrome://settings` → Privacy and security → "URL tracking parameter removal" → **Remove tracking parameters from URLs** toggle.
**Default state:** Disabled by default (opt-in). Build flag `BUILDFLAG(ENABLE_PRIVACY_GUARD)` (`enable_privacy_guard = true`) is on by default, but the pref `privacy_guard.url_purify.enabled` defaults to `false`.

- [ ] Enable the toggle, then navigate to `https://example.com/page?utm_source=newsletter&utm_medium=email&id=123` — **Expected:** DevTools → Network → the request URL shows only `?id=123`.
- [ ] Click through from a Google search result — **Expected:** outbound request lacks `ved`, `ei`, `usg`, etc.
- [ ] As of v1.8.26: after a background refresh has run (see "Filter list auto-refresh" below), visit a URL matching a ClearURLs-only provider not in the original hardcoded per-site list — **Expected:** its tracking parameters are stripped, confirming the fetched rules are live.
- [ ] Disable the toggle and reload the same tracked URL — **Expected:** all original query params are preserved in the outbound request.
- [ ] Open a new tab (custom NTP) with the toggle enabled — **Expected:** NTP's own backend API calls are unaffected (check DevTools on the `chrome-search://` frame).

📷 *Screenshot suggestion: DevTools Network panel side-by-side showing the same link with the toggle on vs off.*

### Filter list auto-refresh (Ad Blocker + URL Purify)

**What it is:** A shared background scheduler (`FilterListUpdateService`) that periodically re-fetches EasyList/EasyPrivacy (feeding the Ad Blocker) and ClearURLs-derived per-site rules (feeding URL Purify), hot-swapping each engine in place once a fetch passes a sanity-check gate. See the ad-blocker/security-privacy-features test entries above for the per-engine fetch/hot-swap/sanity-gate checks — this section covers only the shared toggle and orchestration.
**Where to find it:** `chrome://settings` → Privacy and security → "Filter list updates" → **Automatically update filter lists** toggle.
**Default state:** Enabled by default. Gated by `BUILDFLAG(ENABLE_FILTER_LIST_AUTO_REFRESH)` (`enable_filter_list_auto_refresh = true`, auto-narrowed off if either `enable_ad_blocker` or `enable_privacy_guard` is off); local-state pref `custom.filter_list_refresh.enabled` defaults to `true`. Default interval is 96 hours.

- [ ] Open Settings → Privacy and security — **Expected:** "Filter list updates" section shows the "Automatically update filter lists" toggle, on by default.
- [ ] Toggle it off, restart the browser — **Expected:** neither the EasyList/EasyPrivacy fetch nor the ClearURLs fetch fires on startup (no new request to `easylist.to` / the ClearURLs data source; no cache file timestamp update).
- [ ] Toggle it back on, restart — **Expected:** both fetches resume on their normal schedule (immediately if overdue, per `last_fetch_time + interval`).
- [ ] Quit and relaunch the browser shortly after a successful fetch (well inside the 96-hour interval) — **Expected:** no new fetch fires — `custom.filter_list_refresh.last_adblock_fetch_time` / `.last_url_purify_fetch_time` correctly suppress a redundant re-fetch.

### Privacy Shield (unified toolbar panel)

**What it is:** A single toolbar shield-icon button that surfaces on/off toggles for seven privacy features (Ad Blocker, Force Private Mode, Strip Referrer, Block Ping/Beacon, Disable WebGL, Session Cookies, Connection Control) plus live per-tab stats, without visiting Settings.
**Where to find it:** Shield icon in the bottombar → click to open the 360×340px bubble. Bubble visibility itself is controlled by pref `custom.toolbar.show_privacy_shield_button` (default shown).
**Default state:** Enabled by default. Gated by `BUILDFLAG(ENABLE_PRIVACY_SHIELD)` (`enable_privacy_shield = true`).

- [ ] Click the shield icon — **Expected:** as of v1.8.49, bubble opens showing seven toggle rows and a 5-cell stats strip (Ads blocked / Params stripped / Referrers stripped / Pings blocked / Trackers on page) — previously six toggles and four stats.
- [ ] Toggle "Connection Control" on inside the bubble — **Expected:** the change is reflected immediately if `chrome://settings` is also open in another tab (no reload needed).
- [ ] Visit a page that triggers ad blocks and tracker requests — **Expected:** the stats strip numbers update live while the bubble is open.
- [ ] Click the footer link — **Expected:** navigates to `chrome://settings/privacy`.
- [ ] Toggle "Show Privacy Shield button" off (if exposed) — **Expected:** the toolbar button disappears without restart.

📷 *Screenshot suggestion: the open Privacy Shield bubble with several toggles on and non-zero stats.*

### Connection Control

**What it is:** A per-profile network firewall — an ordered allow/deny rule list (by protocol, host glob, port, and public/private IP scope) evaluated before any request leaves the browser.
**Where to find it:** `chrome://settings` → Privacy and security → Security & Privacy → "Connection Control" section (`ConnectionControlSection` in `SecurityPage.tsx`) has a full rule-editor table — add/edit/delete/toggle rules by Action, Protocol, Scope, Port, and Host pattern, no restart needed. The master on/off is also mirrored in the Privacy Shield bubble.
**Default state:** Disabled by default. `custom.connection_control.enabled` defaults to `false`; `custom.connection_control.rules` defaults to `"[]"`.

- [ ] Open Settings → Security & Privacy → Connection Control, add a deny rule (scope: private, protocol: any, port: 0), enable the feature — **Expected:** applies immediately, no restart required.
- [ ] Navigate to `http://192.168.1.1` (or any private-IP address) — **Expected:** page fails with `ERR_BLOCKED_BY_CLIENT`.
- [ ] Add an `allow` rule above the deny rule for that specific IP — **Expected:** the page now loads without a restart.
- [ ] Set `enabled = false` — **Expected:** all traffic flows normally regardless of rules.
- [ ] Visit any `chrome://` or `wanderlust://` page while a broad deny-all rule is active — **Expected:** internal pages are never blocked (always exempt).

📷 *Screenshot suggestion: the blocked private-IP page showing `ERR_BLOCKED_BY_CLIENT` in the browser chrome.*

### Referrer Control

**What it is:** Strips the `Referer` header from outgoing requests unless the destination host matches a user-configured exception list.
**Where to find it:** `chrome://settings` → Privacy and security → Security & Privacy → "Referrer stripping" section (`ReferrerControlSection` in `SecurityPage.tsx`) — toggle plus a live exceptions list (add/remove glob patterns like `*.example.com`, no restart needed). Master toggle is also mirrored in the Privacy Shield bubble as "Strip Referrer".
**Default state:** Disabled by default. `custom.strip_referrer` defaults to `false`.

- [ ] Enable "Strip Referrer" with an empty exceptions list, then click a link from one page to `https://developer.mozilla.org/` — **Expected:** DevTools → Network → Request Headers shows no `Referer` header on the navigation request.
- [ ] Add `developer.mozilla.org` to the exceptions list and repeat — **Expected:** `Referer` header reappears for that destination only.
- [ ] Disable the feature — **Expected:** `Referer` is sent normally on all cross-site navigations again.

📷 *Screenshot suggestion: DevTools Request Headers panel with `Referer` absent, annotated with the toggle state.*

### Ping/Beacon Blocking

**What it is:** As of v1.8.49, cancels `<a ping>`/`navigator.sendBeacon()` requests unless the destination host matches a user-configured exception list — the same throttle shape as Referrer Control, piggybacking on the ad-block infrastructure.
**Where to find it:** `chrome://settings` → Privacy and security → Security & Privacy → "Block Ping/Beacon" section (`SecurityPage.tsx`) — toggle plus a live exceptions list. Master toggle is also mirrored in the Privacy Shield bubble as "Block Ping/Beacon".
**Default state:** Disabled by default (`custom.block_ping_beacon` = `false`) — some sites use `sendBeacon` for functional, not just analytics, pings.

- [ ] Enable "Block Ping/Beacon" with an empty exceptions list, then visit a page that fires `navigator.sendBeacon(...)` (or run `navigator.sendBeacon('https://example.com/x', 'y')` in DevTools console on any page) — **Expected:** DevTools → Network shows the beacon request blocked (`(blocked:other)`).
- [ ] Add the destination host to the exceptions list and repeat — **Expected:** the beacon request now succeeds for that host only.
- [ ] With the feature enabled, open the Privacy Shield bubble and trigger a blocked ping/beacon — **Expected:** the "Pings blocked" stat increments live for the current tab.
- [ ] Add a per-domain override for one site (via whatever per-domain shields UI is exposed) that flips this feature opposite to the global toggle — **Expected:** that site's ping/beacon requests behave per the override, not the global setting.
- [ ] Disable the feature globally — **Expected:** `<a ping>`/`sendBeacon()` requests succeed normally everywhere (except any per-domain override still forcing them blocked).

📷 *Screenshot suggestion: DevTools Network tab showing a blocked beacon request, next to the Privacy Shield bubble's incremented "Pings blocked" count.*

### Force Private Mode (Force Incognito)

**What it is:** Redirects every new window/tab and browser startup to an off-the-record (incognito) profile — makes incognito the only mode while the regular profile still owns persisted data.
**Where to find it:** "Force Private Mode" toggle in the Privacy Shield bubble, or pref `custom.force_incognito`.
**Default state:** Disabled by default (`custom.force_incognito` = `false`).

- [ ] Enable the toggle, restart the browser — **Expected:** the browser launches directly into an incognito-styled window (dark/incognito theme, "You've gone incognito" page or equivalent).
- [ ] With the feature on, press Ctrl+N / File → New Window — **Expected:** the new window is also incognito, not a regular window.
- [ ] Browse a few sites, close all windows, disable the pref, relaunch — **Expected:** normal (non-incognito) browsing resumes, and history/bookmarks from the regular profile are intact and undisturbed by the incognito interlude.
- [ ] With the feature enabled, open two "incognito" windows — **Expected:** they share the same session (same cookies/login state), since all force-incognito windows share one OTR profile.

📷 *Screenshot suggestion: browser window showing the incognito UI immediately after a fresh, non-incognito-requested launch.*

### Disable WebGL

**What it is:** Appends `--disable-webgl` to every renderer process command line, removing a common fingerprinting/GPU-info vector.
**Where to find it:** "Disable WebGL" toggle in the Privacy Shield bubble, or pref `custom.disable_webgl`.
**Default state:** Disabled by default (`custom.disable_webgl` = `false`).

- [ ] Enable the toggle and **restart the browser** (switch applies per-process at renderer launch) — **Expected:** `chrome://gpu` shows WebGL as software-only / hardware acceleration unavailable.
- [ ] Open DevTools console on any page and run `document.createElement('canvas').getContext('webgl')` — **Expected:** returns `null`.
- [ ] Disable the pref and restart — **Expected:** WebGL context creation succeeds again (non-null).

📷 *Screenshot suggestion: DevTools console showing `getContext('webgl')` returning `null` with the toggle visibly enabled.*

### Session-Only Cookies

**What it is:** Forces all cookies to be treated as session cookies (cleared at browser close) regardless of their `Max-Age`/`Expires` attributes.
**Where to find it:** "Session Cookies" toggle in the Privacy Shield bubble, or pref `custom.session_only_cookies`. Applied once at profile startup — **requires a restart** to take effect after toggling.
**Default state:** Disabled by default (`custom.session_only_cookies` = `false`).

- [ ] Enable the toggle and restart the browser.
- [ ] Visit a site that sets a persistent cookie (e.g. a login-remembered site) and check `chrome://settings/content/cookies` (or DevTools → Application → Cookies) for that site's cookie expiration — **Expected:** cookie shows as session-only (expires "when I close the browser"), even if the server requested a long `Max-Age`.
- [ ] Fully quit and relaunch the browser, revisit the same site — **Expected:** the cookie is gone; site treats you as a new/logged-out visitor.
- [ ] Add a per-site exception setting that cookie's content setting to `Allow` explicitly — **Expected:** that specific site's cookies persist across restarts despite the global toggle.

📷 *Screenshot suggestion: DevTools Application → Cookies panel showing "Session" expiration for a normally-persistent cookie.*

### Local Font Fingerprint Protection

**What it is:** Restricts font enumeration exposed to JavaScript (`document.fonts`) to a standard web-safe set, hiding OS-specific installed fonts that would otherwise be usable for device fingerprinting.
**Where to find it:** `chrome://settings` → Privacy and security → "Fingerprint resistance" section — **Restrict local font access** toggle, alongside the canvas noise/screen metrics/letterboxing toggles below (same `WebPreferences`-backed mechanism).
**Default state:** Disabled by default (`privacy_guard.font_fingerprint_protection` = `false`). Feature ships under `BUILDFLAG(ENABLE_PRIVACY_GUARD)`.

- [ ] Enable "Restrict local font access", open DevTools console on any page and run:
  ```js
  const fonts = await document.fonts.query({});
  [...fonts].map(f => f.family)
  ```
  — **Expected:** only standard web-safe font families appear; OS-specific fonts (e.g. "Segoe UI" on Windows) are absent. No restart required.
- [ ] Disable the toggle, repeat the same query — **Expected:** the full OS-installed font list reappears.

📷 *Screenshot suggestion: DevTools console output of the font query, before/after, side by side.*

### Fingerprint Resistance Suite (Canvas Noise, Screen Metrics, Letterboxing)

**What it is:** Three related anti-fingerprinting toggles grouped under one Settings section: canvas readback noise (perturbs `getImageData()`/`toDataURL()` output per session), screen-metrics normalization (rounds `screen.width`/`screen.height` to the nearest 50px), and viewport letterboxing (pads the actual rendered page into fixed-size buckets so `window.innerWidth`/`innerHeight` and CSS media queries report a common bucketed size).
**Where to find it:** `chrome://settings` → Privacy and security → "Fingerprint resistance" section — three toggles: **Add noise to canvas readback**, **Normalize screen dimensions**, **Letterbox the page viewport**.
**Default state:** All three disabled by default (`privacy_guard.canvas_fingerprint_noise`, `privacy_guard.screen_metrics_normalize`, `privacy_guard.letterboxing_enabled` all `false`).

- [ ] Enable "Add noise to canvas readback", visit a canvas-fingerprint test page (or run a canvas `toDataURL()` script twice across two fresh tabs/sessions) — **Expected:** the resulting data URL/hash differs between sessions even on an identical canvas draw.
- [ ] Enable "Normalize screen dimensions", open DevTools console, run `screen.width` / `screen.height` — **Expected:** values are rounded to the nearest 50px rather than the monitor's exact resolution.
- [ ] Enable "Letterbox the page viewport", resize the browser window across several sizes, checking `window.innerWidth`/`innerHeight` in DevTools console — **Expected:** values snap to multiples of the bucket size (default 200×100px) with visible solid-color bars filling the remainder of the tab area.
- [ ] With both screen-normalize and letterboxing enabled, compare `screen.width` to `window.innerWidth` in console — **Expected:** the two values match (so a site can't cross-check one faked value against the other).
- [ ] Open DevTools **docked** to the side with letterboxing on — **Expected:** the page viewport is still a clean bucket multiple, not `total_width − devtools_width`.
- [ ] Disable all three toggles — **Expected:** canvas output is stable/deterministic again, `screen.width`/`height` report real values, and no letterbox bars appear.

📷 *Screenshot suggestion: a resized browser window showing visible letterbox bars around the page content.*

### Tracking Relationship Dashboard

**What it is:** A passive, non-blocking observer that records first-party → third-party domain relationships seen during browsing and visualizes them as a force-directed graph.
**Where to find it:** Navigate directly to `chrome://tracking-dashboard`, or click the tracking dashboard toolbar button (v1.8.27) next to the Privacy Shield button.
**Default state:** Enabled by default whenever built. Gated by `BUILDFLAG(ENABLE_TRACKING_DASHBOARD)` (`enable_tracking_dashboard = true`); purely observational, no user-facing on/off pref.

- [ ] Browse a few sites that load third-party resources (news sites, sites with embedded ad/analytics scripts), then open `chrome://tracking-dashboard` — **Expected:** stat cards show non-zero "trackers" and "sites" counts, and a graph renders with blue (first-party) and orange (third-party) nodes connected by edges.
- [ ] Hover/inspect the graph — **Expected:** the layout animates to a stable position (spring-physics simulation), not a static snapshot.
- [ ] Click "Clear data" — **Expected:** stat cards reset to zero and the graph empties.
- [ ] Restart the browser and revisit the dashboard (without clearing first) — **Expected:** previously recorded relationships persist (loaded from the per-profile LevelDB store), confirming it survives restarts.
- [ ] As of v1.8.27: visit a site with no recorded trackers yet — **Expected:** the toolbar button shows no badge. Then visit a site known to trigger third-party requests — **Expected:** a numeric badge appears on the button showing the tracker count for that site (a "9+" placeholder above 9), and clicking the button opens `chrome://tracking-dashboard` as a normal tab, not a bubble.
- [ ] As of v1.8.27: with the badge showing a count on one tab, switch to a different tab with a different (or zero) tracker count — **Expected:** the badge updates or hides to match the newly active tab's site, without needing a page reload.
- [ ] As of v1.8.27: with the dashboard button visible, flip pref `toolbar.show_tracking_dashboard_button` to `false` (e.g. via a temporary pref edit) — **Expected:** the button disappears immediately, matching `PrivacyShieldButton`'s own visibility-pref pattern.

📷 *Screenshot suggestion: the force-directed graph with several first-party (blue) and third-party (orange) nodes connected.*

### Incognito Clipboard Privacy

**What it is:** Clears the system clipboard (copy-paste and selection buffers) when the last incognito window for a profile closes, so private-session clipboard data doesn't persist afterward.
**Where to find it:** No dedicated UI toggle documented; controlled by pref `privacy.clear_clipboard_on_incognito_close`. Regular (non-incognito) clipboard use is never affected.
**Default state:** Enabled by default (`privacy.clear_clipboard_on_incognito_close` = `true`). Gated by `BUILDFLAG(ENABLE_INCOGNITO_CLIPBOARD_PRIVACY)`.

- [ ] Open an incognito window, copy some text from a page, then close that incognito window (as the last/only incognito window open) — **Expected:** pasting anywhere (e.g. into the omnibox or a text editor) afterward yields nothing / an empty clipboard.
- [ ] Open two incognito windows, copy text, close only one — **Expected:** clipboard is NOT cleared (a second incognito window is still open).
- [ ] Close the second (last) incognito window — **Expected:** clipboard now clears.
- [ ] Copy something in a regular (non-incognito) window, then open and close an incognito window — **Expected:** the regular window's clipboard contents are untouched.

📷 *Screenshot suggestion: not very screenshot-friendly — a short annotated note or clipboard-content-before/after text capture works better than a screenshot here.*

### Content Policy Chain

**What it is:** Per-content-type URL filtering — ordered rules that block or allow specific resource types (scripts, images, fonts, XHR, frames, etc.) from specific hostname patterns.
**Where to find it:** `chrome://settings` → Privacy and security → Security & Privacy → "Content Policy Chain" section (`ContentPolicySection` in `SecurityPage.tsx`) — a rule-editor table with per-rule Action, Host pattern, and Content types (checkboxes), no restart needed.
**Default state:** Disabled by default. `custom.content_policy.enabled` = `false`; `custom.content_policy.rules` = `"[]"`. Gated by `BUILDFLAG(ENABLE_CONTENT_POLICY_CHAIN)` (`enable_content_policy_chain = true`).

- [ ] Open Settings → Security & Privacy → Content Policy Chain, enable it, add a rule blocking Scripts only for pattern `*.doubleclick.net` — **Expected:** applies immediately, no restart required.
- [ ] Visit a page that loads a script from `doubleclick.net` — **Expected:** DevTools Network tab shows that script request as blocked (`ERR_BLOCKED_BY_CLIENT`, initiator "ContentPolicy"), while unrelated resource types from the same host still load.
- [ ] Edit the rule and check every content-type box (or leave it at the default "all types") — **Expected:** every resource type from that host is now blocked, not just scripts.
- [ ] Disable the master toggle — **Expected:** all requests load normally regardless of rules present.
- [ ] Add a rule with an invalid/unmatched pattern — **Expected:** default-allow applies (no rule matched → request proceeds).

📷 *Screenshot suggestion: DevTools Network panel showing a script blocked with "ContentPolicy" as the block reason.*

### Origin Permission Grants

**What it is:** Lets an admin/power user silently pre-grant or pre-deny browser permissions (camera, microphone, notifications, geolocation, JavaScript, popups, clipboard) for specific origins, skipping the normal prompt.
**Where to find it:** `chrome://settings` → Privacy and security → Security & Privacy → "Origin permission grants" section (`OriginPermissionGrantsSection` in `SecurityPage.tsx`) — add/remove grants by origin, permission, and Allow/Deny state, no restart needed. Applied grants also become visible as per-site exceptions at `chrome://settings/content` (via the shared `HostContentSettingsMap`).
**Default state:** Disabled/inert by default — no grants exist until one is added (mechanism is always compiled in when `BUILDFLAG(ENABLE_ORIGIN_PERMISSION_GRANTS)` is set, but does nothing until a grant is added).

- [ ] Open Settings → Security & Privacy → Origin permission grants, add a grant for `https://example.com`, permission Camera, state Allow — **Expected:** applies immediately, no restart required.
- [ ] Visit `https://example.com` and trigger a camera-requiring script (or check via `navigator.mediaDevices.getUserMedia({video:true})` in DevTools console) — **Expected:** camera access is silently granted with no permission prompt.
- [ ] Check `chrome://settings/content/camera` — **Expected:** `example.com` appears in the "Allowed" list, same as if the user had approved a real prompt.
- [ ] Change the grant's state to Deny in the Settings table, retry the camera request — **Expected:** access is silently rejected, still no prompt, no restart needed.
- [ ] Remove the grant entirely, retry — **Expected:** normal prompt-before-access behavior returns immediately.
- [ ] Open an incognito window and visit the same origin — **Expected:** the grant does NOT carry over; incognito uses default (prompt) behavior.

📷 *Screenshot suggestion: `chrome://settings/content/camera` showing the pre-granted origin in the Allowed list with no prompt ever having appeared.*

### Site Injection

**What it is:** Per-site CSS/JS injection driven by a user-editable rules file in the profile directory — lets a user apply persistent stylesheet overrides or scripts to specific sites without an extension.
**Where to find it:** `chrome://settings` → Privacy and security → Security & Privacy → "Site injection" section (`SiteInjectionSection` in `SecurityPage.tsx`) — add/edit/delete rules with an address, type (CSS/JS), inject timing, and the actual CSS/JS content in a textarea. Saved to `<profile>/site_injection/rules.ini` and a generated payload file immediately. As of v1.8.47, a Save/Delete also hot-reloads the running rule set — already-open tabs pick up the change on their **next navigation**, no browser restart required.
**Default state:** Enabled by default as a mechanism (`enable_site_injection = true`, `BUILDFLAG(ENABLE_SITE_INJECTION)`), but a no-op until a rule is added.

- [ ] Open Settings → Security & Privacy → Site injection, add a global rule (address `*`, type CSS, inject "On navigation") with content `body::before{display:none}`.
- [ ] As of v1.8.47: without restarting, navigate to any page — **Expected:** the injected stylesheet is present (inspect `<head>` for a `<style>` tag matching the content) and takes visible effect immediately on commit (before first paint) — previously this required a full browser restart first.
- [ ] Add a domain-wildcard rule (`*.github.com`, CSS, "On navigation") and, without restarting, visit github.com and a subdomain — **Expected:** both match and get the injected CSS; a non-matching domain does not.
- [ ] Add a JS rule with inject timing "After page load" and visit its target site — **Expected:** the script runs only after the page's `load` event (verify via a `console.log` in the injected script and checking timing in DevTools Performance/Network).
- [ ] Edit an existing rule's content and re-save — **Expected:** the settings page reflects the change immediately, and as of v1.8.47 the target page also picks it up on its next navigation (reload the tab) — no restart needed on either side anymore.
- [ ] With a page already open (not reloaded) when a rule affecting it is edited, do *not* reload it — **Expected:** the already-rendered page keeps its old injected content until you actually navigate/reload it; the hot-reload swaps in the new rule set for future navigations, it doesn't retroactively re-inject into a currently-loaded DOM.
- [ ] Delete a rule that shares its payload file with another rule (e.g. two rules both pointing at the same generated file) — **Expected:** the shared file is preserved for the remaining rule, not deleted, and the remaining rule's injection still works on the next navigation.
- [ ] Perform a same-document navigation on an injected page (e.g. a hash change or SPA route change) — **Expected:** no re-injection occurs (CSS already applied persists; JS is not re-run).

📷 *Screenshot suggestion: the target page before/after the injected CSS takes effect (e.g., a hidden banner).*

### User-Agent Overrides

**What it is:** Two UA controls — a global compatibility mode substituting a pinned Firefox or Chrome-stable UA string for all requests, and per-site glob-matched UA override rules.
**Where to find it:** `chrome://settings` → Privacy and security → Security & Privacy — two sections: "User-Agent compatibility mode" (a Default/Firefox/Chrome-stable select, `UAGlobalModeSection`) and "Per-site User-Agent overrides" (a rule table, `UAOverridesSection`), both in `SecurityPage.tsx`. Both apply immediately, no restart needed.
**Default state:** Disabled by default — global mode defaults to `"default"` (pass-through), per-site rules default to `"[]"`. Gated by `BUILDFLAG(CUSTOM_BROWSER)` with no separate feature flag.

- [ ] Open Settings → Security & Privacy, set "User-Agent compatibility mode" to Firefox.
- [ ] Navigate to any page, open DevTools → Network → select the document request → Request Headers → `User-Agent` — **Expected:** shows the pinned Firefox UA string (`...rv:136.0) Gecko/20100101 Firefox/136.0`), no restart required.
- [ ] Reset the compatibility mode to Default — **Expected:** the normal Chromium UA string returns immediately.
- [ ] Add a per-site override for `*.example.com` with UA `TestAgent/1.0`, visit `https://example.com/` — **Expected:** the document request's `User-Agent` header reads `TestAgent/1.0`, overriding whatever compatibility mode is set, no restart required.
- [ ] Visit a non-matching host — **Expected:** UA reverts to the compatibility-mode value (or default Chromium UA if set to Default).
- [ ] Note the compatibility mode is local-state (applies to every profile on the machine) while per-site overrides are per-profile — verify a second profile shares the compatibility mode setting but not the per-site rule list.

📷 *Screenshot suggestion: DevTools Request Headers panel highlighting the overridden `User-Agent` value.*

### Scheme Aliases

**What it is:** A `wanderlust://<name>` shortcut registry that transparently redirects to any configured destination — built-in aliases to internal `chrome://` pages, or user-defined aliases to any URL.
**Where to find it:** Type `wanderlust://<name>` directly in the address bar. Built-in aliases work out of the box; user-defined aliases require editing `custom.scheme_aliases` (profile `Preferences`, JSON array of `{name, url}`) while the browser is closed.
**Default state:** Enabled by default (`enable_scheme_aliases = true`, `BUILDFLAG(ENABLE_SCHEME_ALIASES)`). Built-in aliases (`home`, `prefs`, `addons`, `plugins`, `about`, `network`, `memory`) are active immediately; user aliases default to none (`"[]"`).

- [ ] Type `wanderlust://prefs` in the address bar — **Expected:** redirects to `chrome://settings`.
- [ ] Type `wanderlust://network` — **Expected:** redirects to `chrome://net-internals`.
- [ ] Type an unregistered name, e.g. `wanderlust://doesnotexist` — **Expected:** normal failure (no handler), does NOT silently redirect anywhere.
- [ ] Close the browser, add a user alias `{"name":"mail","url":"https://gmail.com"}` to `custom.scheme_aliases`, relaunch, then type `wanderlust://mail` — **Expected:** redirects to `https://gmail.com`.
- [ ] Add a user alias for `"home"` pointing somewhere other than `chrome://newtab`, relaunch, type `wanderlust://home` — **Expected:** the user-defined destination wins over the built-in (user aliases shadow built-ins with the same name).

📷 *Screenshot suggestion: the address bar showing `wanderlust://prefs` having just redirected to the settings page.*

### De-Googling & Privacy-Safe Defaults

**What it is:** A set of build-time and runtime measures reducing data flow to Google — pruned/redirected telemetry endpoints, disabled Privacy Sandbox / Optimization Guide feature flags, and privacy-favorable pref defaults (HTTPS-Only/First mode, 3rd-party cookie blocking, Secure DNS, WebRTC IP restriction).
**Where to find it:** Runtime-visible pieces are in `chrome://settings` → Privacy and security (Connection security, DNS over HTTPS, WebRTC IP handling toggles) and `chrome://settings/adPrivacy`-equivalent Privacy Sandbox controls. Build-time telemetry pruning is a compile-time step, not runtime-toggleable.
**Default state:** Mixed — HTTPS-Only Mode, 3rd-party cookie blocking ("Mode B"), and Secure DNS "Automatic" are all enabled/defaulted-on out of the box; build-time telemetry file-pruning/domain-substitution is **opt-in, off by default** (`telemetry_hardening_enabled: false` in package.json config).

- [ ] Open `chrome://settings` → Privacy and security → "Connection security" — **Expected:** "Always use secure connections" (HTTPS-Only/First Mode) reflects an enabled state by default on a fresh profile.
- [ ] Check "Cookies and other site data" — **Expected:** default mode blocks third-party cookies (not "Allow all").
- [ ] Check "DNS over HTTPS" toggle — **Expected:** shows enabled/automatic by default.
- [ ] Browse a few ordinary sites with DevTools Network tab open (filter by domain) — **Expected:** no outbound requests to `google-analytics.com`, `doubleclick.net`, or other Google telemetry endpoints originating from the browser itself (as opposed to sites you visit making their own such requests).
- [ ] Visit `chrome://settings/help` (About page) — **Expected:** a "Chromium" version row appears alongside the browser's own version string.
- [ ] (If telemetry hardening was applied at build time) Confirm via `chrome://net-internals` or packet capture that pruned endpoints (e.g. `clients2.google.com`, `safebrowsing.googleapis.com`) are never contacted — **Expected:** no connection attempts logged to these hosts.

📷 *Screenshot suggestion: the Connection security and Cookies settings rows showing their privacy-safe default states on a fresh profile.*

### Google API Key InfoBar Suppression

**What it is:** Removes Chromium's "Google API keys missing" warning banner that otherwise appears on startup/new tabs when no Google API keys are configured — purely a cosmetic/UX suppression, no functional change.
**Where to find it:** N/A (nothing to configure) — verify by absence of the banner.
**Default state:** Always suppressed in custom builds. Gated by `BUILDFLAG(CUSTOM_BROWSER)` at compile time (`#if !BUILDFLAG(CUSTOM_BROWSER)` guards the InfoBar creation), no runtime toggle.

- [ ] Launch the browser fresh (new profile, no API keys configured) — **Expected:** no yellow "Google API keys missing" InfoBar appears on the initial window or new tab.
- [ ] Open several new tabs and windows — **Expected:** the InfoBar never appears in any of them.
- [ ] Confirm no functional regression — sign-in, Safe Browsing, and other features that would normally use API keys still behave normally (no crashes/errors attributable to the suppression) — **Expected:** browser behaves normally aside from the banner's absence.

📷 *Screenshot suggestion: a fresh-profile new-tab page with no Google API InfoBar, for comparison against stock Chromium's warning banner.*

### WebRTC IP Leak Protection

**What it is:** Restricts WebRTC to only expose the device's public-facing IP address to peers, preventing local LAN IP address leakage (even behind a VPN).
**Where to find it:** `chrome://settings` → Privacy and security → "WebRTC IP handling" → **Prevent WebRTC from leaking local IP addresses** toggle.
**Default state:** Enabled by default. `prefs::kWebRTCIPHandlingPolicy` defaults to `"default_public_interface_only"` (vs. upstream Chromium's `"default"`, which exposes all interfaces).

- [ ] With the toggle in its default (enabled) state, visit a WebRTC IP leak test page (e.g. any public "WebRTC leak test" site) — **Expected:** only the public IP is listed; no `192.168.x.x` / `10.x.x.x` local address appears.
- [ ] Disable the toggle and revisit the same test page — **Expected:** local LAN IP address(es) may now appear in the WebRTC candidate list.
- [ ] Re-enable the toggle — **Expected:** local IP disappears again; video/voice call functionality (test with any WebRTC call demo) still works normally.

📷 *Screenshot suggestion: the WebRTC leak test page showing only a public IP with the protection enabled.*

### Additional Hardening Defaults (Guest Mode, Battery API, About Page)

**What it is:** Three small, non-toggleable default-behavior changes: Guest browsing mode is disabled by default (prevents bypassing the custom privacy features via a guest session), the Battery Status API is stubbed so no site can read battery charge/level, and the About page explicitly shows the underlying Chromium version.
**Where to find it:** Guest mode setting lives at `chrome://settings` (people/profile section) as `prefs::kBrowserGuestModeEnabled`; Battery API has no UI (verify via console); Chromium version shows on `chrome://settings/help`.
**Default state:** Guest mode default is `false` (disabled, user can re-enable in settings). Battery API stub is unconditional in `BUILDFLAG(CUSTOM_BROWSER)` builds, always on.

- [ ] Check the profile/people menu (click the avatar / profile icon) — **Expected:** no "Open Guest window" / "Guest" entry appears by default.
- [ ] Open `chrome://settings` and locate the guest-mode setting — **Expected:** it is present and off by default; toggling it on and restarting **Expected:** the Guest option reappears in the profile menu.
- [ ] Visit any HTTPS page, open DevTools console, run `navigator.getBattery === undefined ? 'unsupported' : navigator.getBattery().then(b => console.log(b.level, b.charging))` — **Expected:** the call either resolves with no meaningful/real data or the connection is silently closed with no crash — critically, **the page/renderer does not crash** even though the API is called.
- [ ] Open `chrome://settings/help` — **Expected:** a "Chromium" row with a version string appears in addition to the browser's own version.

📷 *Screenshot suggestion: the profile menu with no Guest entry, next to `chrome://settings/help` showing the Chromium version row.*

### Timezone Override (Anti-Fingerprinting)

**What it is:** A per-profile runtime override of the reported system timezone. When set, it rebinds the OS `TimeZoneMonitor` service to report a chosen IANA timezone ID (e.g. `"America/New_York"`) instead of the host machine's real one, updating ICU and notifying all renderers — affecting `Intl.DateTimeFormat().resolvedOptions().timeZone`, `Date().toString()`, and `getTimezoneOffset()` site-wide. An empty override reverts to the host system timezone.
**Where to find it:** `chrome://settings` → Privacy and security → "Timezone override" section (`TimezoneOverrideSection` in `PrivacyPage.tsx`), right below Fingerprint resistance — a select listing "System default" plus ~50 IANA zones.
**Default state:** Disabled/no override by default — pref `custom.timezone` defaults to an empty string (host system timezone used as-is). Gated by `BUILDFLAG(CUSTOM_BROWSER)`, no separate feature flag; the `TimezoneService` KeyedService is always created per-profile.

- [ ] Open Settings → Privacy and security → Timezone override — **Expected:** select shows "System default" selected on a fresh profile.
- [ ] In any regular page's console, note the current values of `Intl.DateTimeFormat().resolvedOptions().timeZone` and `new Date().getTimezoneOffset()`.
- [ ] Back on the Settings page, select a zone far from your real one (e.g. "Asia/Tokyo") — **Expected:** applies immediately, no restart.
- [ ] Re-check `Intl.DateTimeFormat().resolvedOptions().timeZone` and `new Date().getTimezoneOffset()` in an existing or new tab — **Expected:** both now reflect Tokyo time (`"Asia/Tokyo"`, and an offset of `-540` minutes), differing from the machine's real timezone.
- [ ] Restart the browser (without reverting the override) — **Expected:** the override persists across restart (re-applied from the saved pref on profile load) — the Settings page still shows the overridden zone selected, and `Intl.DateTimeFormat()` still reports it.
- [ ] Revert to "System default" — **Expected:** the browser's reported timezone reverts to the real host system timezone (verify via `Intl.DateTimeFormat().resolvedOptions().timeZone`).

📷 *Screenshot suggestion: DevTools console showing `Intl.DateTimeFormat().resolvedOptions().timeZone` reporting a spoofed zone (e.g. "Asia/Tokyo") that doesn't match the host machine's actual timezone.*

### Parental Controls (PIN Lock & Website Restrictions)

**What it is:** As of v1.8.42, PIN-gates deleting browsing history (`chrome://history` and the sidebar history panel) and the "Clear browsing data on exit" toggle group, so a shared device can't have its history wiped or that setting changed without the PIN. As of v1.8.43, also adds a basic domain blocklist/allowlist site blocker plus forced SafeSearch and YouTube Restricted Mode.
**Where to find it:** Settings → a Parental Controls sub-page sets up the PIN and, once unlocked, hosts the Website Restrictions section. Gated actions (history delete, clear-on-exit) prompt for the PIN at the point of the action itself, wherever you are — no need to visit the settings page first.
**Default state:** Disabled by default.

- [ ] Open Settings → Parental Controls and set a PIN — **Expected:** the feature enables and unlocks immediately (you already know the PIN you just set).
- [ ] With Parental Controls enabled, wait past 10 minutes of inactivity (or restart the browser, which always starts locked), then try to delete a history entry on `chrome://history` — **Expected:** the delete is blocked and a PIN prompt appears instead of the entry disappearing.
- [ ] Enter the correct PIN — **Expected:** the entry deletes, and further history deletes and the "Clear browsing data on exit" toggle group work without re-prompting for the next 10 minutes of activity.
- [ ] Try deleting an entry from the sidebar's History panel while locked — **Expected:** same PIN gate as `chrome://history` (independent gate, same behavior).
- [ ] Try toggling "Clear browsing data on exit" in Settings while locked — **Expected:** also PIN-gated.
- [ ] Click "Change PIN" and enter the current PIN plus a new one — **Expected:** succeeds; the old PIN no longer works, the new one does.
- [ ] Click "Forgot PIN?" — **Expected:** a real OS-level reauth prompt (Windows Hello or platform equivalent) appears; on success, you can set a brand-new PIN without knowing the old one.
- [ ] Turn Parental Controls off (requires the current PIN) — **Expected:** all gates stop applying; history deletes and the clear-on-exit toggle work with no PIN prompt.
- [ ] As of v1.8.43: with Parental Controls enabled, add a domain to the blocklist (e.g. `example.com`) and navigate to it — **Expected:** the top-level navigation is blocked (`ERR_BLOCKED_BY_CLIENT`); a subdomain (`www.example.com`) is blocked too, but an unrelated site loads normally.
- [ ] Switch to allowlist mode with one domain listed, then visit that domain and a different one — **Expected:** the listed domain loads, the other is blocked.
- [ ] Enable "Force SafeSearch" and search on Google or Bing — **Expected:** results are filtered (`safe=active`/`ssui=on` present on the request).
- [ ] Enable "YouTube Restricted Mode" (Moderate or Strict) and browse YouTube — **Expected:** restricted-mode behavior applies.
- [ ] As of v1.8.44: with a blocklist/allowlist configured, disable Parental Controls entirely (current PIN required) — **Expected:** previously-blocked sites now load normally — this used to silently keep enforcing the domain list even after the whole feature was turned off.
- [ ] Re-enable Parental Controls with a new PIN after having disabled it with a domain list configured — **Expected:** restriction mode comes back as "Off," not silently re-armed with the old list (disabling resets the mode).

📷 *Screenshot suggestion: the PIN prompt interrupting a history-delete attempt, next to the Website Restrictions section showing a configured blocklist.*

---

## Network & Downloads

### Proxy Settings

**What it is:** A full in-browser proxy configuration UI covering every mode Chromium supports — system default, direct, auto-detect (WPAD), PAC script URL, manual single-proxy, and manual per-scheme proxies — plus bypass/reverse-bypass rules.
**Where to find it:** `chrome://proxy/` (legacy standalone page), `chrome://custom-settings/proxy` (React settings), or `chrome://settings/customProxy` (Polymer settings) — all three read/write the same config.
**Default state:** Enabled by default (`enable_proxy_settings = true` in `custom_browser_config.gni`; `BUILDFLAG(ENABLE_PROXY_SETTINGS)`).

- [ ] Open `chrome://settings/customProxy` — **Expected:** Page loads with mode radio buttons (System / Direct / Auto-detect / PAC URL / Manual).
- [ ] Select "Auto-detect" and Apply — **Expected:** Config applies immediately, no restart required.
- [ ] Select "Manual proxy", enter a single proxy `host:port`, Apply — **Expected:** Subsequent traffic routes through that proxy.
- [ ] Switch to per-scheme mode and set different HTTP/HTTPS proxies — **Expected:** Each protocol uses its own assigned proxy.
- [ ] Add a bypass rule (e.g. `localhost`) — **Expected:** Bypassed hosts load directly, not via the proxy.
- [ ] Click "Clear" — **Expected:** Resets to OS system default proxy.
- [ ] Open `chrome://proxy/` — **Expected:** Same config is visible/editable (all three surfaces share state via the same `apply`/`clear` messages).
- [ ] Edge case: enter a malformed PAC URL and Apply — **Expected:** No crash; config reports pending/failed state rather than silently succeeding.

📷 *Screenshot suggestion: The manual per-scheme proxy form with all fields filled in, showing the Apply/Clear buttons.*

### Smart Proxy Routing

**What it is:** Per-domain proxy routing rules that the browser compiles into a PAC script automatically — route specific domains through specific proxies while everything else goes direct, with a toolbar button showing active/inactive state.
**Where to find it:** Toolbar globe icon button (click for status bubble); full rule management at `chrome://custom-settings/proxy-routing`.
**Default state:** Enabled by default (`enable_smart_proxy_routing = true`; `BUILDFLAG(ENABLE_SMART_PROXY_ROUTING)`).

- [ ] Look at the toolbar on a fresh profile — **Expected:** Globe icon present, inactive state (no rules yet).
- [ ] Navigate to `chrome://custom-settings/proxy-routing` and add a rule (pattern `*.httpbin.org`, proxy `PROXY 127.0.0.1:8888`) — **Expected:** Rule appears in the table.
- [ ] With a local proxy running on port 8888, navigate to `https://httpbin.org/ip` — **Expected:** Reported IP is the proxy's outbound IP, not the local machine's.
- [ ] Open `chrome://net-internals/#proxy` — **Expected:** An active PAC script is shown containing a `shExpMatch` clause for `*.httpbin.org`.
- [ ] Click the toolbar globe icon — **Expected:** Status bubble opens showing "Active · 1 rule".
- [ ] Toggle routing off from the bubble — **Expected:** Icon reverts to inactive; net-internals shows `mode: SYSTEM`.
- [ ] Disable the rule via its per-rule toggle in settings (without disabling routing globally) — **Expected:** PAC regenerates without that clause; traffic to the domain goes direct again.
- [ ] Edge case: configure a manual proxy in Proxy Settings first, then enable Smart Proxy Routing — **Expected:** A warning is shown, since routing will overwrite the manual proxy config with the generated PAC.

📷 *Screenshot suggestion: The toolbar globe icon in both active and inactive states side by side, plus the status bubble showing rule count.*

### Integrated BitTorrent Client

**What it is:** A native magnet-link and `.torrent` handler built on libtorrent-rasterbar, with its own torrent manager page and OS-level `.torrent` file association.
**Where to find it:** `chrome://bittorrent` (manager UI); toolbar button and bottom-bar button both open it; settings at `chrome://settings/bittorrent` (React) or the BitTorrent section of `chrome://settings/customOthers` (Polymer checkboxes).
**Default state:** Enabled by default (`enable_bittorrent_client = true`; `BUILDFLAG(ENABLE_BITTORRENT_CLIENT)`). Runtime master toggle `bittorrent.enabled` pref also defaults to `true`.

- [ ] Click a `magnet:` link on any webpage — **Expected:** Tab redirects to `chrome://bittorrent`; torrent appears and moves from Queued → Downloading as metadata resolves.
- [ ] Download a `.torrent` file and let it complete downloading (as a file, not a torrent) — **Expected:** It's automatically detected, added to the torrent manager, the temp file is deleted, and the tab redirects to `chrome://bittorrent`.
- [ ] In Windows Explorer, double-click a `.torrent` file (after setting the browser as default handler in settings) — **Expected:** Browser launches/foregrounds and opens the torrent in the manager.
- [ ] In `chrome://bittorrent`, click Pause then Resume on an active torrent — **Expected:** State changes to Paused (network activity stops) then back to Downloading.
- [ ] Click "Open Folder" on a torrent — **Expected:** Opens the save path in the OS file manager.
- [ ] Remove a torrent with "delete files" checked — **Expected:** Torrent disappears from the list and downloaded data is deleted from disk.
- [ ] Go to `chrome://settings/bittorrent` → File association section, click "Set as default" then "Remove" — **Expected:** OS `.torrent` association is registered, then cleared (verify via Windows "Default apps" or re-double-clicking a `.torrent` file).
- [ ] Adjust max download/upload KiB/s and max connections, restart the browser — **Expected:** Settings persist and visibly cap transfer rates.
- [ ] Edge case: turn off the master enable toggle in settings — **Expected:** Toolbar/bottom-bar buttons disappear (or stop working) and magnet links are no longer intercepted.

📷 *Screenshot suggestion: chrome://bittorrent showing an active torrent with live download/upload rate, peer count, and progress bar.*

### Crash-Resilient Downloads

**What it is:** After the browser crashes mid-download, downloads that were interrupted resume automatically on next launch instead of requiring a manual "Resume" click.
**Where to find it:** No dedicated UI — runs automatically at startup. Governed by pref `custom.download.auto_resume_interrupted` (no settings-page toggle; settable only via the generic pref bridge or direct pref-file edit).
**Default state:** Enabled by default (`enable_crash_resume_downloads = true`; `BUILDFLAG(ENABLE_CRASH_RESUME_DOWNLOADS)`; pref defaults to `true`).

- [ ] Start a large download from a server that supports HTTP Range requests — **Expected:** Download begins normally and is visible in `chrome://downloads`.
- [ ] Mid-download, force-kill the browser process (Task Manager, not a normal quit) — **Expected:** Download is left in an interrupted state.
- [ ] Relaunch the browser — **Expected:** Without clicking anything, the download automatically resumes from where it stopped (progress continues, not restarting from 0%).
- [ ] Let it finish — **Expected:** File completes successfully and is valid/openable.
- [ ] Edge case: repeat the crash test against a server that does NOT support Range requests, or delete the partial file before relaunch — **Expected:** Download cannot auto-resume and is left interrupted, requiring a manual retry.
- [ ] Edge case: set `custom.download.auto_resume_interrupted` to `false` via the pref bridge, repeat the crash test — **Expected:** Interrupted download stays interrupted after relaunch; manual "Resume" click is required.

📷 *Screenshot suggestion: chrome://downloads showing a download's progress bar continuing seamlessly right after a relaunch, with the "Interrupted" label having disappeared.*

### Advanced Download Management

**What it is:** An enhanced download shelf and per-download options layer on top of Chromium's normal download system — auto-hide shelf, richer completion notifications, and custom download-path handling.
**Where to find it:** The download shelf at the bottom of the browser window (appears automatically whenever a download starts); per-item actions/options via the download item itself. The source doc does not specify a dedicated settings page for these options.
**Default state:** Enabled by default (`custom_download_options = true` and `custom_download_shelf_enhanced = true` in `custom_browser_config.gni`, surfaced as `CUSTOM_DOWNLOAD_OPTIONS_ENABLED`/`CUSTOM_DOWNLOAD_SHELF_ENHANCED` at compile time).

- [ ] Start a file download — **Expected:** Download shelf appears at the bottom of the window with a visibly enhanced progress indicator.
- [ ] Let all active downloads finish — **Expected:** If auto-hide is enabled, the shelf hides itself automatically once nothing is in progress.
- [ ] Trigger a download's options/details control — **Expected:** A download options view surfaces (location, naming/collision handling, security settings), if the options dialog is enabled.
- [ ] Complete a download — **Expected:** A completion notification appears with "Open" and "Show in Folder" action buttons.
- [ ] Change the configured custom download path, then download another file — **Expected:** The new file saves to the custom directory rather than the previous default.
- [ ] Edge case: download a file type Chromium flags as dangerous — **Expected:** Advanced dangerous-download handling/controls appear rather than the stock warning only.

📷 *Screenshot suggestion: The enhanced download shelf mid-download next to a completed download showing the rich completion notification with action buttons.*

### Instagram Downloader

**What it is:** A floating Save button on Instagram post/reel/IGTV pages that downloads the media directly, plus small heart badges on post thumbnails anywhere on Instagram marking posts you've previously liked/opened.
**Where to find it:** Any `instagram.com/p/`, `/reel/`, or `/tv/` page — floating Save button, fixed bottom-right. Heart badges appear on post thumbnails across profile grids, home feed, and explore. Both toggled independently at `chrome://settings` → Other settings → "Instagram" section.
**Default state:** Enabled by default (`enable_instagram_downloader = true`; `BUILDFLAG(ENABLE_INSTAGRAM_DOWNLOADER)`; both prefs default `true`).

- [ ] Navigate to an Instagram post or reel URL — **Expected:** A floating Save button appears bottom-right.
- [ ] Click Save on a single photo post — **Expected:** Image downloads straight to the Downloads folder with no "Save As" prompt.
- [ ] Click Save on a reel/video — **Expected:** Video file downloads directly, same no-prompt behavior.
- [ ] Click Save on a carousel (multi-image) post — **Expected:** Every slide downloads as a separate file (Chromium's own multi-download infobar may appear once several downloads fire in a tab).
- [ ] After opening a post/reel directly, browse to a grid/feed/profile page containing that same post — **Expected:** A small heart badge appears on its thumbnail if you'd previously liked it.
- [ ] While viewing a single post, like or unlike it using Instagram's own like button — **Expected:** The badge/liked state updates to match without needing to reload.
- [ ] Go to Instagram Settings → Your Activity → Interactions → Likes ("Liked posts"), then find the injected "Sync all my likes" button — **Expected:** Clicking it auto-scrolls the full liked-posts list and bulk-populates heart badges for everything in it, without opening each post individually.
- [ ] Edge case: uncheck the like-status badge toggle in Settings mid-session — **Expected:** Badges stop appearing and no further grid-mutation work happens (not just hidden — the observer actually stops).
- [ ] Edge case: view an Instagram Story — **Expected:** No Save button appears; Stories use a different URL/API not covered by this feature.

📷 *Screenshot suggestion: An Instagram post with the floating Save button visible, and a profile grid showing at least one thumbnail with the heart "liked" badge.*

### Startup Cache

**What it is:** An internal per-profile JSON store that records launch count and clean-shutdown state, used to detect whether the previous session crashed — with all disk writes deferred until 5 seconds after the first window opens, so it never slows down startup.
**Where to find it:** No user-facing UI — purely an internal service. Observable only by inspecting `{profile_dir}/startup_cache.json` (e.g., under the profile's `Default` folder) or by its effects on crash-dependent features like Crash-Resilient Downloads.
**Default state:** Enabled by default (`custom_cache = true`; `BUILDFLAG(CUSTOM_CACHE)`).

- [ ] Launch the browser, then close it cleanly via the window's close button — **Expected:** After a moment, `startup_cache.json` in the profile folder shows `"last_clean_shutdown": true`.
- [ ] Launch again and inspect the file within the first ~5 seconds — **Expected:** File still reflects the prior session's data; no write has landed yet (deferred flush).
- [ ] Wait 5+ seconds after that same launch, then re-check the file — **Expected:** `launch_count` incremented by 1 and `last_startup_time` updated to the current session's timestamp.
- [ ] Force-kill the browser process (Task Manager) after waiting past the 5-second mark — **Expected:** File on disk shows `"last_clean_shutdown": false` (written by the earlier deferred flush, never updated to `true` since shutdown was never clean).
- [ ] Relaunch the browser — **Expected:** The crash is detected internally (`PreviousSessionCrashed()` returns true); cross-check by confirming any interrupted downloads from that session auto-resume (see Crash-Resilient Downloads above), which relies on this same signal.
- [ ] Edge case: manually edit `startup_cache.json` to exceed 4 KB (pad it with data) and relaunch — **Expected:** Browser treats the oversized file as corrupt, discards it, and starts with a fresh cache rather than crashing.

📷 *Screenshot suggestion: The `startup_cache.json` file opened in a text editor immediately after a clean shutdown, showing `last_clean_shutdown: true` and an incremented `launch_count`.*

---

## Content & Reading

### RSS Reader

**What it is:** Automatically detects RSS/Atom/JSON feeds on the pages you visit, prompts you to subscribe via an infobar, and provides a full built-in reader (subscriptions, folders/groups, unread tracking, OPML import/export) for reading them.
**Where to find it:** Infobar appears automatically on pages with a `<link rel="alternate" type="application/rss+xml">` tag; built-in reader UI at `chrome://reader` (also aliased `wanderlust://reader/`); feed-related settings under `chrome://settings/` (detection toggle, infobar toggle, update interval, omnibox integration).
**Default state:** Enabled by default — gated by `BUILDFLAG(ENABLE_RSS_READER)`, `enable_rss_reader = true` in `custom_browser_config.gni`.

- [ ] Navigate to a page known to publish an RSS feed (e.g. a typical blog or news site) — **Expected:** An infobar appears reading "RSS feed detected: \<title\>" with two buttons, **Subscribe** and **Cancel**.
- [ ] Click **Subscribe** — **Expected:** Infobar dismisses; the feed is added to your subscriptions (no visible confirmation dialog, but it now appears in the reader sidebar).
- [ ] Open `chrome://reader` — **Expected:** Reader UI loads with the newly subscribed feed listed in the sidebar (Ungrouped section) without needing to reload the reader tab.
- [ ] Click into the feed and open an article — **Expected:** Article content renders in the reading pane; the item is marked read and the feed's unread count decrements.
- [ ] Create a new folder/group in the sidebar and drag or move the feed into it — **Expected:** Feed moves out of "Ungrouped" into the new group; sidebar reflects the new organization.
- [ ] Use the reader's OPML export, then import it back (or into a fresh profile) — **Expected:** All subscriptions and groupings are restored intact.
- [ ] Return to a page with a feed you already subscribed to and check the infobar behavior; then visit a new RSS page and click **Cancel** instead of Subscribe — **Expected:** Already-subscribed feeds don't re-prompt (`IsKnownChannelURL` skips them); Cancel simply dismisses with no subscription created.
- [ ] Toggle dark mode (OS or browser theme) while the reader tab is open — **Expected:** Reader UI switches to its dark theme.
- [ ] Click **↻ Refresh** in the reader header — **Expected:** button shows a brief spin; feeds refresh regardless of their normal update interval.
- [ ] Click **All feeds** — **Expected:** aggregated item list across every feed, with a summed unread badge.
- [ ] Type in **Search articles** — **Expected:** debounced (~250ms) results filter to matching titles; clearing the box restores the previous feed/group view.
- [ ] As of v1.8.34: search using different letter-case than the article title (e.g. a lowercase query for an uppercase-heavy title), or an accented variant of a word in the title — **Expected:** matching articles still appear (search is case- and accent-insensitive, not an exact-case substring match).
- [ ] Switch item-list layout using the **☰ / ▤ / ▦** buttons — **Expected:** Title/Magazine/Full views render distinctly (thumbnail in Magazine, full image + "Open original article" button in Full); selection persists across a reload.
- [ ] Toggle RSS off from Settings while `chrome://reader` is open in another tab — **Expected:** the reader tab live-swaps to the disabled-message screen without a manual reload.
- [ ] As of v1.8.28: open `chrome://reader` on a fresh profile with zero subscriptions — **Expected:** a categorized starter-feed picker (Tech/News/Science/Culture) appears in the main pane instead of "Select a feed to read articles." Check a few feeds and click "Add N feeds" — **Expected:** the picker disappears and the reader switches to the normal feed view with the selected feeds subscribed.
- [ ] As of v1.8.28: subscribe to a feed, then repoint its URL at something that will fail (a 404 or a dead host) and let it attempt at least 3 fetches (use ↻ Refresh to force attempts rather than waiting out the update interval) — **Expected:** a small ⚠ appears next to the feed's title in the sidebar, with a tooltip explaining it hasn't updated successfully in a while.
- [ ] As of v1.8.28: repoint that same feed back to a working URL and let one fetch succeed (↻ Refresh) — **Expected:** the ⚠ indicator clears.
- [ ] As of v1.8.28: with existing subscriptions from a pre-upgrade profile (schema v3), launch the upgraded browser — **Expected:** all existing subscriptions are intact (the v3→v4 migration adds columns in place; it must not wipe the database).

📷 *Screenshot suggestion: the RSS infobar with Subscribe/Cancel buttons on a real news site, and the reader UI showing a subscribed feed's article list in Magazine view.*

### ePub Reader

**What it is:** A full in-browser EPUB book reader (powered by vendored epub.js) with font size, theme, and pagination controls, and saved reading position per book.
**Where to find it:** `chrome://epub-reader/?url=<epub-url>` (local `file://` or remote `http(s)://` URL); any `http(s)://...*.epub` link is auto-redirected there; settings toggle under the custom browser Settings section (EPUB Reader page).
**Default state:** Enabled by default — gated by `BUILDFLAG(ENABLE_EPUB_READER)`, `enable_epub_reader = true`; the `epub_reader.enabled` pref also defaults to `true`.

- [ ] Click a link on a web page pointing to an `http://` or `https://` URL ending in `.epub` — **Expected:** Navigation is intercepted and redirected to `chrome://epub-reader/?url=<encoded-url>`, book opens and renders.
- [ ] Navigate directly to `chrome://epub-reader/?url=file:///path/to/book.epub` — **Expected:** Local EPUB loads and renders via epub.js.
- [ ] Click the toolbar **"Open file…"** button and pick a local `.epub` from disk — **Expected:** Book loads directly from the file picker without needing a URL at all.
- [ ] Use the prev/next controls and the Table of Contents panel — **Expected:** Page turns / jumping to a TOC entry navigates within the book.
- [ ] Increase/decrease font size and change theme (light / dark / sepia / auto) — **Expected:** Text resizes and colors update live inside the book viewer, without re-rendering the whole book; "auto" follows the OS light/dark setting.
- [ ] Toggle paginated vs. scrolled mode — **Expected:** Reading flow switches between page-turn and continuous scroll.
- [ ] Read partway into a book, close the tab, and reopen the same book URL — **Expected:** Reading position (last CFI/progress) is restored automatically.
- [ ] Try navigating directly to a `file:///path/to/book.epub` URL (not via `chrome://epub-reader/`) — **Expected:** Known limitation — the auto-redirect throttle only intercepts http/https, so this does *not* redirect; you must use the explicit `chrome://epub-reader/?url=file://...` form.

📷 *Screenshot suggestion: the reader open on a book showing the Toolbar, Table of Contents panel, and one of the sepia/dark themes applied.*

### Reader Mode Integration

**What it is:** Distraction-free "reader mode" that detects article-like pages and re-renders their content in a clean, distilled, serif-font reading layout.
**Where to find it:** Right-click context menu → **"Enter Reader Mode"** (shown when the manager reports the page as available) / **"Exit Reader Mode"** when active; internally mapped to browser command ID **35083** (Distill Page).
**Default state:** Enabled by default (`custom_enable_reader_mode = true`), but **automatic detection is disabled by default** (`custom_reader_mode_auto_detect = false`) — reader mode must be manually triggered rather than auto-suggested while browsing.

- [ ] Navigate to a clearly article-style page (news article, blog post) — **Expected:** Since auto-detect is off by default, no automatic prompt appears; manually invoke the reader-mode command/context-menu item to check availability.
- [ ] Right-click on the article page and select **"Enter Reader Mode"** (or trigger command 35083) — **Expected:** Brief "Distilling" state, then content is replaced with the clean reader layout (centered column, serif font, white content card).
- [ ] Right-click again while in reader mode — **Expected:** Menu now offers **"Exit Reader Mode"**; selecting it returns the page to normal rendering.
- [ ] Try triggering reader mode on a non-article page (e.g. a search results page, a `chrome://` page, or a page with mostly navigation/no article body) — **Expected:** Command is unavailable/greyed out, or reports "Not Available" — no distillation attempted on excluded schemes (`chrome://`, `about:`, `data:`, etc).
- [ ] Trigger reader mode on a page likely to fail distillation (e.g. a very sparse or malformed page) — **Expected:** State moves to "Error" and the UI fails gracefully rather than showing broken/garbled content.
- [ ] (Edge, requires a build with auto-detect flipped on) Navigate to several article pages in a row — **Expected:** Reader-mode availability is automatically flagged per page without manual triggering.

📷 *Screenshot suggestion: before/after of the same article page — normal view vs. active reader mode's distilled layout.*

### Most Visited Panel

**What it is:** A toolbar button that opens a compact popup showing your top sites as a card grid — the same tiles as the New Tab Page — accessible from any page without navigating away.
**Where to find it:** "Top Sites" icon in the main toolbar, to the right of the address bar. Click to open/close the bubble.
**Default state:** Enabled by default — gated by the `remote_ntp` build flag (same flag that enables the remote NTP).

- [ ] Open any regular web page, then click the **Top Sites** toolbar icon — **Expected:** A ~380×300px bubble opens (no title bar/close button) showing a 4-column grid of top-site tiles with favicons and titles.
- [ ] Left-click a tile — **Expected:** Current tab navigates to that site; bubble closes.
- [ ] Middle-click a tile (or right-click → "Open in new tab") — **Expected:** Site opens in a new background tab; bubble stays open.
- [ ] Right-click a tile → **Remove** — **Expected:** Tile disappears immediately and the grid reflows.
- [ ] Click the Top Sites toolbar icon again while the bubble is open — **Expected:** Bubble closes (toggle behavior).
- [ ] Open a new tab (NTP) after removing/interacting with tiles from the panel — **Expected:** NTP shows the same updated tile set, confirming shared state with the panel.
- [ ] Open the panel in an Incognito window — **Expected:** Empty-state message (or empty grid) since `RemoteNtpService` is unavailable for that profile.

📷 *Screenshot suggestion: the toolbar with the Top Sites icon highlighted, and the open bubble showing the 4-column tile grid.*

### Page Notes

**What it is:** Private, local, per-URL notes you can jot down while browsing — no sync, no server, stored only in your browser profile.
**Where to find it:** **Notes** button in the sidebar top pane → `chrome://sidebar/notes`.
**Default state:** Enabled by default — gated by `BUILDFLAG(ENABLE_PAGE_NOTES)`, `enable_page_notes = true`; also requires `BUILDFLAG(ENABLE_SIDEBAR)` to be enabled.

- [ ] Open the sidebar and click the **Notes** button — **Expected:** Notes panel loads, header shows the normalized domain/URL of the current tab.
- [ ] With an empty note for the current page, type some text and let it sit ~1 second, then close the sidebar without clicking Save, then reopen Notes — **Expected:** Your draft text is still there (auto-saved to a local draft after 300ms, restored on reopen).
- [ ] Click **Save** — **Expected:** Note is persisted; draft is cleared.
- [ ] Navigate to a `chrome://` or `file://` page (not http/https) — **Expected:** Notes editor shows no active URL / notes are unavailable for that page.
- [ ] Switch to a different http/https tab — **Expected:** Notes header and content update live to the new tab's URL without a manual refresh.
- [ ] Add a second note to the same page — **Expected:** A multi-note list appears below the editor; clicking a row loads that note into the editor for editing.
- [ ] Expand the **All notes** section and use the search box — **Expected:** List filters client-side by URL or note text across all saved notes.
- [ ] Open the same page in an Incognito window and check Notes — **Expected:** Notes from the regular profile are visible and editable (incognito redirects to the parent profile's notes).
- [ ] (If wanderlust-api backend/cloud-sync sign-in is configured) Click **Share note publicly** — **Expected:** Note appears in the "Shared annotations" list with your display name; if not signed in via cloud sync, a "backend not configured" notice is shown instead.

📷 *Screenshot suggestion: the Notes sidebar panel with an editor entry, the multi-note list, and the "All notes" search filter expanded.*

### AI Page Assistant

**What it is:** A read-only chat assistant (v1) backed by the Claude API that can see the current tab's visible text and answer questions about it — it cannot click, fill forms, or otherwise act on the page.
**Where to find it:** **AI Page Assistant** button in the sidebar top pane → `chrome://sidebar/agent`.
**Default state:** Enabled by default (`enable_ai_agent = true`) — gated by `BUILDFLAG(ENABLE_AI_AGENT)` **and** `BUILDFLAG(ENABLE_SIDEBAR)` (both must be on). Functional use also requires a Claude API key set in Settings → AI page (`ai_agent.api_key`, stored in plaintext prefs by design for v1).

- [ ] Open the sidebar and click the **AI Page Assistant** button — **Expected:** Chat panel opens at `chrome://sidebar/agent` showing an empty message list and an input box. If no backend/API key is configured, at minimum confirm the panel opens cleanly and shows a sensible empty/error state rather than a blank or broken page.
- [ ] With no API key configured, type a question and press Enter — **Expected:** A "Thinking…" indicator appears briefly, then an error message is shown (e.g. missing/invalid key) rather than a hang or crash.
- [ ] If a working API key is configured (Settings → AI page → password field), navigate to a content-heavy page and ask a question about it — **Expected:** "Thinking…" indicator, then a reply from Claude that reflects the visible page text.
- [ ] Ask the assistant to perform an action on the page (e.g. "click the login button for you") — **Expected:** Assistant declines and explains it can only read/discuss the page, not act on it.
- [ ] Close the sidebar (or navigate away) and reopen the Agent panel — **Expected:** Prior conversation turns are restored (transcript persists in-memory for the browser session).
- [ ] Click **Clear** (clear history) — **Expected:** Transcript empties immediately.
- [ ] Navigate to a different page and ask a new question without clearing — **Expected:** Old conversation turns remain visible (transcript is not per-tab/per-URL scoped), but the new answer is based on the newly-visited page's content.

📷 *Screenshot suggestion: the Agent sidebar panel mid-conversation, showing a user question, the page context, and Claude's reply.*

### JavaScript Content Controls

**What it is:** Per-page/per-domain JavaScript blocking control, integrated with Chromium's standard content settings so the choice persists across sessions.
**Where to find it:** Right-click page context menu — entries for **"Block JavaScript on this page"**, **"Allow JavaScript on this page"**, and **"Use default setting"** (only the states different from the current one are shown); backed by commands 35080 (Block), 35081 (Default), 35082 (Allow).
**Default state:** Enabled by default (`custom_javascript_controls = true`, `CUSTOM_JAVASCRIPT_CONTROLS_ENABLED`); per-site JavaScript permission itself defaults to "Default" (system default, normally allow).

- [ ] Right-click on a JavaScript-dependent page — **Expected:** Context menu shows a JavaScript control option to **block** JS (since current state is "allow/default").
- [ ] Click **"Block JavaScript on this page"** — **Expected:** JavaScript is blocked; JS-dependent content/behavior on the page stops working.
- [ ] Reload the page — **Expected:** JavaScript remains blocked (setting persisted via `HostContentSettingsMap`, not just an in-session toggle).
- [ ] Right-click again and select **"Allow JavaScript on this page"** — **Expected:** JavaScript is re-enabled; if the doc's "real-time application" claim holds, functionality resumes without a reload — otherwise verify it takes effect on next reload.
- [ ] Right-click and select **"Use default setting"** — **Expected:** Per-site override is cleared; page reverts to the browser's global JavaScript default.
- [ ] Set a Block override on one domain, then visit a different, unrelated domain — **Expected:** The second domain is unaffected (setting is scoped per URL/domain, not global).
- [ ] Restart the browser and revisit the domain you blocked earlier — **Expected:** Block setting is still in effect (persisted across sessions).

📷 *Screenshot suggestion: the page right-click context menu showing the Block/Allow/Default JavaScript entries.*

### Picture-in-Picture Hover Button

**What it is:** As of v1.8.48, a floating button that appears over any `<video>` element on hover and toggles native Picture-in-Picture for it — works site-wide, independent of a page's own native video controls.
**Where to find it:** No dedicated page — hover a large-enough video on any site. Toggle: Settings → Others → Web content → "Show a Picture-in-Picture button when hovering videos."
**Default state:** Enabled by default (`custom.picture_in_picture_button.enabled` pref).

- [ ] Hover over a reasonably large (80×80px or bigger) `<video>` on any site — **Expected:** a small floating button appears over the top-right of the video within a moment.
- [ ] Click the button — **Expected:** the video enters native Picture-in-Picture (a separate always-on-top mini window).
- [ ] Hover the same video again while it's in PiP — **Expected:** the button's tooltip reads "Exit picture in picture"; clicking it exits PiP.
- [ ] Move the mouse from the video onto the button itself (not away) — **Expected:** the button stays visible (doesn't flicker/hide) while the cursor is over it.
- [ ] Move the mouse away from both the video and the button — **Expected:** the button hides after a brief delay (~250ms), not instantly.
- [ ] Hover a very small video (well under 80×80px, e.g. a thumbnail-sized `<video>`) — **Expected:** no button appears.
- [ ] On a site using client-side routing (an SPA) or infinite scroll, navigate/scroll to reveal a video that wasn't present on initial page load — **Expected:** hovering it still shows the button, with no full-page reload needed.
- [ ] Hover a `<video>` with the `disablePictureInPicture` attribute set (test page or DevTools-added attribute) — **Expected:** no button ever appears for that video.
- [ ] Turn the Settings toggle off, then reload a page with video — **Expected:** no button appears on hover anywhere on the page.
- [ ] Turn the toggle back on and reload — **Expected:** the button returns.

📷 *Screenshot suggestion: the floating PiP button overlaid on the corner of a playing video.*

---

## New Tab Page

### Remote NTP Page Load & Offline Fallback

**What it is:** The New Tab Page is a cloud-hosted web page (URL set by `custom_new_tab_page_url` in `custom_browser_config.gni`) rather than a local WebUI, with a service worker that caches content and serves an offline fallback UI when the network is unavailable.
**Where to find it:** Open a new tab (`Ctrl+T` or `⌘+T`), or navigate to `chrome://newtab`.
**Default state:** Enabled by default — gated by `remote_ntp` buildflag, which defaults to `true`.

- [ ] Open a new tab with network connected — **Expected:** Remote NTP loads fully (tiles, search box, theme) within a couple seconds; no local/blank fallback page shown.
- [ ] Open DevTools → Application → Service Workers on the NTP tab — **Expected:** A service worker is registered and active for the NTP origin.
- [ ] Disable network (airplane mode or DevTools "Offline" throttling), then open a new tab — **Expected:** Offline fallback content renders instead of a network error page; an offline indicator/retry option is visible.
- [ ] Re-enable network and reload the NTP — **Expected:** Page recovers to full remote content; offline indicator disappears.
- [ ] Open several new tabs in a row — **Expected:** Subsequent loads are fast (served from cache), not each re-fetching from scratch.

📷 *Screenshot suggestion: side-by-side of normal NTP load vs. the offline fallback state.*

### Most-Visited / Top Sites Tiles

**What it is:** Tile grid on the NTP showing the user's most-visited sites, sourced from real browsing history via the `window.custom.ntpTiles` (`TilesAPI`) bridge — not static/demo data.
**Where to find it:** Main NTP body, all layouts (Full, Glass, Focus, Hub).
**Default state:** Enabled by default.

- [ ] Browse to 3-4 distinct sites repeatedly, then open a new tab — **Expected:** Those sites appear as tiles with correct titles/favicons, reflecting real history (not placeholder tiles).
- [ ] Right-click a tile (or use its overflow menu) — **Expected:** Options to remove/edit the tile are present and functional.
- [ ] Remove a tile — **Expected:** Tile disappears immediately and does not reappear on next new tab unless re-visited.
- [ ] Add a custom shortcut tile (if the layout supports it) — **Expected:** Custom tile appears alongside auto-generated most-visited tiles and persists across new tabs.
- [ ] Clear browsing history, then open a new tab — **Expected:** Most-visited tiles update accordingly (stale entries drop off over time/refresh).

📷 *Screenshot suggestion: tile grid showing a mix of auto most-visited and any custom-added tile.*

### Search Box & Autocomplete

**What it is:** An embedded search/omnibox-style box on the NTP that provides live autocomplete suggestions (via `window.custom.autocomplete` / `AutocompleteAPI`) sourced from the browser's real `AutocompleteController`, not a static suggestion list.
**Where to find it:** Search box on the NTP, all layouts.
**Default state:** Enabled by default (can be hidden via the `showSearch` NTP setting).

- [ ] Open a new tab and click into the search box — **Expected:** Cursor focuses the box; it visually matches the current theme.
- [ ] Type a query that matches previously visited pages (e.g. a site title) — **Expected:** Real autocomplete suggestions appear, including history/bookmark matches, not just generic web-search guesses.
- [ ] Type a full URL — **Expected:** A "visit site" suggestion appears distinctly from search suggestions.
- [ ] Select a suggestion with keyboard (arrow keys + Enter) — **Expected:** Browser navigates to the selected match.
- [ ] Type a query and press Enter without selecting a suggestion — **Expected:** Navigates to the default search engine's results page.

📷 *Screenshot suggestion: search box open with a visible autocomplete dropdown showing mixed history/search suggestions.*

### Theme Sync & Dark Mode

**What it is:** NTP appearance (light/dark, toolbar-derived accent color) stays in sync with the browser's system/Chrome theme via `window.custom.theme` (`ThemeAPI`) and the `RemoteNtpThemeProvider`.
**Where to find it:** Automatic — reflects `chrome://settings/appearance` theme choice; accent override in NTP Settings sidebar ("Browser theme" toggle).
**Default state:** Enabled by default.

- [ ] Switch OS or browser theme between light and dark (`chrome://settings/appearance`) — **Expected:** Open NTP tab updates its color scheme without a manual reload.
- [ ] Apply a Chrome theme/extension theme with a distinct toolbar color — **Expected:** NTP accent color (buttons, active states) derives from the toolbar color instead of the user's manual palette pick.
- [ ] Remove the custom theme (back to default) — **Expected:** NTP accent reverts to whatever the user picked in the NTP color palette picker.
- [ ] Toggle "Browser theme" between auto/light/dark in NTP Settings sidebar — **Expected:** NTP appearance updates live to match the forced choice, independent of OS setting.

📷 *Screenshot suggestion: NTP in light theme next to NTP in dark theme, same layout.*

### Accent Color Palette

**What it is:** A picker for 8 predefined NTP accent palettes (Blue, Violet, Rose, Amber, Emerald, Cyan, Indigo, Slate) that drive the NTP's UI accent color independent of the browser theme.
**Where to find it:** NTP Settings sidebar (`NtpSettingsPage`) → "Accent colour" swatches, under "Browser theme" toggle.
**Default state:** Enabled by default; Blue is the default palette.

- [ ] Open NTP Settings sidebar and locate the accent colour swatches — **Expected:** 8 circular swatches shown, current selection has a ring indicator.
- [ ] Select a different swatch (e.g. Rose) — **Expected:** Accent color updates immediately across UI elements (active tab dot, buttons) without reload.
- [ ] Reload the NTP — **Expected:** Selected palette persists.
- [ ] With a Chromium browser theme active, open the accent picker — **Expected:** Picker is visibly overridden/disabled, since toolbar color takes priority.

📷 *Screenshot suggestion: accent swatch picker with a non-default color selected and reflected in the UI.*

### NTP Layout Switching

**What it is:** Multiple selectable NTP layout "flavors" — Full, Glass, Focus, Hub (and any others registered in `VALID_FLAVORS`) — each with a different visual arrangement of the same underlying data.
**Where to find it:** NTP Settings sidebar → layout selector.
**Default state:** Enabled by default.

- [ ] Open NTP Settings and switch to each available layout in turn (Full, Glass, Focus, Hub) — **Expected:** NTP body re-renders in the corresponding layout without errors; tiles/search/bookmarks still populated with real data in each.
- [ ] Switch layout, then open a new tab — **Expected:** Chosen layout persists as the default for new tabs.
- [ ] In Glass layout, check the weather/RecentSessions carousel tab — **Expected:** Carousel navigation works and shows live content.

📷 *Screenshot suggestion: one screenshot per layout flavor for visual reference.*

### NTP Settings — Section Visibility & Reordering

**What it is:** A settings sidebar controlling per-section visibility (search, top sites, bookmarks, greeting, clock, weather) and, in Full layout, drag-and-drop reordering of Search/Top sites/Bookmarks sections.
**Where to find it:** NTP Settings sidebar (gear/settings icon on the NTP) → "Content" section.
**Default state:** Enabled by default.

- [ ] Open NTP Settings sidebar — **Expected:** Toggles for search bar, top sites, bookmarks, greeting, clock, and weather are visible per current layout.
- [ ] Toggle "Top sites" off — **Expected:** Tile grid disappears from the NTP immediately; toggling back on restores it.
- [ ] In Full layout, drag the "Bookmarks" row above "Search" in the Content section — **Expected:** A drop-position indicator appears; on drop, the NTP body re-renders with Bookmarks section above Search.
- [ ] Reload the NTP after reordering — **Expected:** Custom section order persists.
- [ ] Toggle a section off, reload, then check settings sidebar — **Expected:** Toggle state itself persists (not just the rendered section).

📷 *Screenshot suggestion: NTP Settings sidebar mid-drag showing the insertion-line indicator.*

### Wallpaper Customization

**What it is:** Background wallpaper picker with Default / Bing / Unsplash / Colour sources, plus blur and brightness sliders and Unsplash topic chips.
**Where to find it:** NTP Settings sidebar → wallpaper/background section.
**Default state:** Enabled by default.

- [ ] Open NTP Settings and switch wallpaper source to "Colour" — **Expected:** Background becomes a flat color; a color picker appears.
- [ ] Switch to "Unsplash" and pick a topic chip — **Expected:** Background image updates to match the selected topic.
- [ ] Adjust the blur slider — **Expected:** Background blur visibly increases/decreases in real time.
- [ ] Adjust the brightness slider — **Expected:** Background dims/brightens in real time.
- [ ] Reload the NTP — **Expected:** Chosen wallpaper source, image, blur, and brightness all persist.

📷 *Screenshot suggestion: same NTP with two different wallpaper sources for comparison.*

### Bookmarks Panel (Full/Glass Layouts)

**What it is:** A live bookmark bar viewer on the NTP, fed from the real `BookmarkModel` via Mojo (not a static list) — shows Bookmark Bar folders/items and "Other Bookmarks," with unlimited sub-folder nesting.
**Where to find it:** Full layout — below the tile grid, toggled via "Show bookmarks" in NTP Settings sidebar. Also selectable as a Glass layout carousel tab.
**Default state:** Enabled by default in supporting layouts (toggle in settings controls visibility).

- [ ] Add a bookmark to the Bookmark Bar in the actual browser (`Ctrl+D`) — **Expected:** New new-tab-page load (or live update) shows the bookmark under a synthetic "bar" folder entry.
- [ ] Create a bookmark folder with nested sub-folders and bookmarks — **Expected:** NTP bookmarks panel shows the folder as collapsible, with nested sub-folders rendered at increasing indent, down to leaf URL links.
- [ ] Click a bookmark link in the NTP panel — **Expected:** Navigates to that URL.
- [ ] Rename, move, or delete a bookmark in the browser's Bookmark Manager — **Expected:** NTP panel updates automatically without needing a manual NTP reload.
- [ ] Toggle "Show bookmarks" off in NTP Settings (Full layout) — **Expected:** Bookmarks section disappears from the NTP; toggling on restores it.

📷 *Screenshot suggestion: bookmarks panel showing at least one nested sub-folder expanded.*

### Hub Layout — Bookmark Bar & Folders

**What it is:** A dedicated bookmark-first NTP layout: a fixed glassmorphism bar across the top with one pill button per top-level bookmark folder; hovering opens a dropdown with that folder's bookmarks (including nested sub-folders, favicons, and drag-to-reorder).
**Where to find it:** NTP Settings sidebar → select "Hub" layout.
**Default state:** Enabled by default (selectable layout).

- [ ] Switch to Hub layout — **Expected:** Full-width top bar appears with one pill per top-level bookmark folder.
- [ ] Hover a folder pill — **Expected:** After a short delay a dropdown opens listing that folder's direct bookmarks first, then sub-folders as labelled, indented sections separated by a divider.
- [ ] Move the mouse from the pill into the dropdown — **Expected:** Dropdown stays open (no flicker) during the transition.
- [ ] Hover a bookmark link inside a Hub dropdown — **Expected:** A small favicon renders to the left of the title (or hides gracefully if unavailable).
- [ ] Drag a folder pill to a new position in the bar — **Expected:** A blue insertion-line indicator shows the drop point; on drop, the folder order changes and persists (backed by real `BookmarkModel::Move`, verify order also changed in the actual Bookmark Bar/manager).

📷 *Screenshot suggestion: Hub bar with a folder dropdown open showing sub-folder sections and favicons.*

### Hub Layout — Unified Search

**What it is:** A "Find" panel in the Hub bar that searches across open tabs, recently-closed sessions, and history in one query, grouped by source.
**Where to find it:** Hub layout top bar → "Find" pill/button.
**Default state:** Enabled by default in Hub layout.

- [ ] Open several tabs, close one, then open the Find panel and type a matching term — **Expected:** Results grouped by source (Tabs, Recently Closed, History) appear, each capped (≤5 tabs, ≤3 sessions, ≤5 history).
- [ ] Use arrow keys to navigate results, then press Enter on a tab result — **Expected:** Browser switches to that tab/window.
- [ ] Press Enter on a recently-closed session result — **Expected:** The tab/window is restored.
- [ ] Press Enter on a history result — **Expected:** Browser navigates directly to that URL.
- [ ] Press Esc while the panel is open — **Expected:** Panel closes without navigating.

📷 *Screenshot suggestion: Find panel open with all three result groups visibly populated.*

### Hub Layout — Open Tabs List

**What it is:** A live list of all open tabs across browser windows (current profile), with click-to-switch, sourced from the real `TabStripModel`/`BrowserList` via `window.custom.tabs` (`TabsAPI`).
**Where to find it:** Hub layout top bar → "Tabs" pill (shows a tab-count badge).
**Default state:** Enabled by default in Hub layout.

- [ ] Open several tabs/windows, then open the Tabs menu in the Hub bar — **Expected:** All tabs across windows are listed with correct titles; the active tab is visually highlighted.
- [ ] Type into the tab search/filter box inside the dropdown — **Expected:** List filters live to matching tabs.
- [ ] Click a tab entry — **Expected:** Browser switches to and focuses that tab's window.
- [ ] Open/close a tab elsewhere in the browser while the Hub tab is active — **Expected:** Tabs list and count badge update without manual refresh.

📷 *Screenshot suggestion: Tabs dropdown open with the filter box and count badge visible.*

### Hub Layout — Recently-Closed Sessions

**What it is:** A live list of recently-closed tabs and windows sourced from `TabRestoreService`, with click-to-restore.
**Where to find it:** Hub layout top bar → "Recently Closed" pill. Also available as a standalone panel/carousel tab in Full and Glass layouts (off by default there, toggle in NTP Settings).
**Default state:** Enabled by default in Hub bar; off by default as a Full/Glass section until the "Recently Closed" toggle is enabled.

- [ ] Close a tab, then open the Hub bar's Recently Closed menu — **Expected:** Closed tab appears with correct title, URL, and a recent timestamp.
- [ ] Close an entire window with multiple tabs — **Expected:** Entry shows the active tab's title/URL, a tab-count badge, and a window icon.
- [ ] Click a recently-closed entry — **Expected:** Tab/window is restored (not just navigated to the bare URL).
- [ ] Close a tab group — **Expected:** Group entries are intentionally excluded from the list (verify no broken/blank entry appears).
- [ ] In Full or Glass layout, enable "Recently Closed" in NTP Settings — **Expected:** Standalone RecentSessions panel/carousel tab appears and matches Hub bar data.

📷 *Screenshot suggestion: Recently Closed dropdown showing both a tab entry and a multi-tab window entry.*

### Hub Layout — History Search

**What it is:** A search box that queries real browsing history (`history::HistoryService`) via `window.custom.history` (`HistoryAPI`), showing recent visits by default and full-text results for a typed query.
**Where to find it:** Hub layout top bar → "History" pill.
**Default state:** Enabled by default in Hub layout.

- [ ] Open the History menu with an empty query — **Expected:** Last 7 days of visits shown, most recent first, capped at 20 results.
- [ ] Type a search term matching a page you've visited — **Expected:** After a brief debounce, full-text search results appear (up to 20), with relative timestamps like "3m ago"/"2h ago".
- [ ] Click a history result — **Expected:** Browser navigates to that URL.
- [ ] Type a new query quickly after another — **Expected:** Only the latest query's results are shown (no stale/out-of-order results from a cancelled earlier search).

📷 *Screenshot suggestion: History dropdown showing a mix of relative timestamps in the results list.*

### WiFi Status Widget

**What it is:** A widget showing live network status (SSID, signal strength, link speed) sourced from the OS WiFi service, not a static icon.
**Where to find it:** NTP widget area (layout-dependent placement).
**Default state:** Enabled by default (Windows and macOS).

- [ ] Open the NTP while connected to WiFi — **Expected:** Widget shows the actual connected SSID and a signal-strength indicator.
- [ ] Disconnect WiFi or switch networks — **Expected:** Widget updates to reflect the new state without an NTP reload.
- [ ] Connect via Ethernet only (WiFi off), open the NTP — **Expected:** Widget reflects "no WiFi"/wired state rather than showing stale SSID data.

📷 *Screenshot suggestion: WiFi widget showing a real connected network name and signal bars.*

### Clock Widget

**What it is:** Analog (`ScallopClock`) and digital (`Clock`) time widgets shown on the NTP.
**Where to find it:** NTP widget area, all layouts; visibility toggle in NTP Settings sidebar.
**Default state:** Enabled by default.

- [ ] Open the NTP — **Expected:** Clock widget shows the correct current local time, updating each minute/second as applicable.
- [ ] Toggle clock visibility off in NTP Settings — **Expected:** Widget disappears; toggling on restores it.
- [ ] Change the system clock format (12h/24h) if supported — **Expected:** Widget reflects system format, or check documented behavior if it uses a fixed format.

📷 *Screenshot suggestion: both analog and digital clock variants if the layout allows switching between them.*

### Weather Widget

**What it is:** A weather widget using the Open-Meteo API (zero-config, no API key) shown in Glass and Full layouts.
**Where to find it:** Glass layout carousel tab / Full layout widget area; visibility toggle in NTP Settings sidebar.
**Default state:** Enabled by default in Glass and Full layouts.

- [ ] Open the NTP in Full or Glass layout — **Expected:** Weather widget shows current conditions/temperature for the detected or configured location.
- [ ] Toggle weather visibility off in NTP Settings — **Expected:** Widget disappears; toggling on restores it and re-fetches data.
- [ ] Disconnect network, reload NTP — **Expected:** Widget fails gracefully (shows an error/placeholder state, not a broken layout).

📷 *Screenshot suggestion: weather widget with live conditions populated.*

### Favicon Resolution

**What it is:** Site icons on tiles and bookmark/history/tab entries are resolved through the browser's real favicon store (`chrome://favicon2/` via `FaviconSource`), not generic placeholder icons.
**Where to find it:** Automatic — appears throughout tiles, bookmarks, Hub dropdowns, history, and tabs lists.
**Default state:** Enabled by default.

- [ ] Visit a site with a distinct favicon, then check its most-visited tile — **Expected:** Tile shows the site's real favicon, not a generic globe/letter icon.
- [ ] Bookmark that same site and check the Bookmarks panel / Hub dropdown — **Expected:** Same real favicon appears next to the bookmark entry.
- [ ] Visit a site with no favicon (or a broken one) — **Expected:** UI falls back gracefully (default icon or hidden `<img>`) without a broken-image glyph.

📷 *Screenshot suggestion: tile grid and a Hub bookmark dropdown side by side showing matching real favicons for the same site.*

---

## Settings & Configuration

### Settings Hub Smoke Test (chrome://settings)

**What it is:** The entire settings surface is a React SPA (`custom_settings/`) that claims the `"settings"` WebUI host — this is a full replacement of `chrome://settings`, not an add-on. It's a hub-and-spoke app with ~30 client-side-routed sub-pages backed by one `custom_settings_handler.cc`.
**Where to find it:** `chrome://settings` (omnibox).
**Default state:** Enabled by default — this is the only settings surface in the fork; there is no vanilla `SettingsUI` fallback.

- [ ] Navigate to `chrome://settings` — **Expected:** React hub loads (left-nav + content pane), no blank page or console errors.
- [ ] Click **Appearance** — **Expected:** page loads; theme/layout controls are present and clickable.
- [ ] Turn on "Show home button", set Home page mode to "Specific page" — **Expected:** four preset buttons appear (Google/Bing/DuckDuckGo/Yahoo) above the free-text URL field.
- [ ] Click a preset (e.g. Bing) — **Expected:** the free-text field updates to that engine's URL and the clicked button highlights (primary/filled) while the others stay secondary/outlined.
- [ ] Click the home button in the toolbar — **Expected:** navigates to the preset URL just selected.
- [ ] Type a custom URL directly into the free-text field — **Expected:** no preset button stays highlighted, since the value no longer matches any of the four presets.
- [ ] Click **Privacy** — **Expected:** page loads; privacy/tracking toggles are present and clickable.
- [ ] Click **Downloads** — **Expected:** page loads; download location and behavior controls are present.
- [ ] Click **Passwords** — **Expected:** saved-password list loads (see the three dedicated Password Manager sections below for the deep functional tests).
- [ ] Click **RSS** — **Expected:** an enable/disable toggle for RSS is present; toggling it live-flips `chrome://reader` between its normal UI and its disabled-message screen (no reload needed — driven by the `readerStateChanged` event).
- [ ] Scroll to **About** — **Expected:** version/build info renders (this is a page nested inside the settings hub, not a standalone `chrome://about`).
- [ ] Click through every remaining item in the left-nav (there are ~30 sub-pages total; only a handful are itemized above) — **Expected:** each one loads content with no blank panel, no perpetual spinner, and no red error in DevTools console.
- [ ] Change one control on any page, then reload `chrome://settings` — **Expected:** the change persisted.
- [ ] Narrow the browser window below roughly 768px wide — **Expected:** the left-nav sidebar disappears and a hamburger button + current page name appear at the top of the content pane instead of a permanently squeezed layout.
- [ ] Click the hamburger button — **Expected:** the sidebar slides in from the left as an overlay (with a dimmed backdrop behind it), without pushing/resizing the page content.
- [ ] With the drawer open, click the dimmed backdrop (not a nav item) — **Expected:** the drawer closes, content pane unchanged.
- [ ] With the drawer open, click a different sidebar item — **Expected:** navigates to that page AND the drawer closes automatically.
- [ ] Widen the window back past ~768px — **Expected:** sidebar returns to its normal permanent left column; hamburger button and backdrop are both gone.
- [ ] At a narrow width, open **Containers**, **Workspaces**, **Security**, and **Smart Proxy Routing** and start adding/editing an entry on each — **Expected:** each form's fields stack in a single column (name above color, action above protocol, etc.) instead of being squeezed into two cramped columns.

📷 *Screenshot suggestion: the settings hub left-nav fully expanded, showing the full page list, for a baseline comparison after the next rebase — plus one shot of the narrow-width hamburger/drawer state and one of a rule-editor form in its single-column narrow layout.*

### Manage Profile (chrome://settings/manageProfile)

**What it is:** As of v1.8.33, a deep-link-only settings route (not in the left-nav, matching vanilla) that vanilla Chromium's profile-menu "Edit" pencil, the app menu's "Customize profile" item, and the profile-picker card's "Edit" option all navigate to. Reuses the same backend as the standalone `chrome://profile-customization` first-run wizard, minus its Skip/Done-to-profile-picker flow.
**Where to find it:** Not linked from the Settings left-nav — reached via the profile-menu "Edit" pencil, app menu → "Customize profile", or the profile-picker card's "Edit" option.
**Default state:** Enabled by default.

- [ ] Click the profile-menu "Edit" pencil (avatar icon → pencil) — **Expected:** navigates to `chrome://settings/manageProfile` and loads real avatar/name/theme-color controls (previously unrecognized by the Settings router, silently falling back to the "You and Wanderlust" page).
- [ ] From the app menu (⋮), click "Customize profile" — **Expected:** lands on the same `manageProfile` page.
- [ ] From the profile picker, click a profile card's "Edit" option — **Expected:** lands on the same `manageProfile` page for that profile.
- [ ] Change the avatar, name, or theme color on this page — **Expected:** change saves in place immediately (no Skip/Done buttons or redirect back to the profile picker — that flow is specific to the first-run `chrome://profile-customization` wizard, not this page).
- [ ] Navigate directly to `chrome://settings/manageProfile` via the omnibox — **Expected:** loads normally even though it's not reachable from the Settings left-nav.

### Import Browser Data (Settings)

**What it is:** As of v1.8.50, the Firefox/legacy Edge/Bookmarks-HTML importer (previously only reachable from the first-run `chrome://intro` wizard) is now also a normal Settings page, listed in the left-nav — unlike the deep-link-only Manage Profile page above.
**Where to find it:** Settings → "Import browser data" (visible in the left-nav sidebar).
**Default state:** Enabled by default.

- [ ] Open Settings and look at the left-nav — **Expected:** an "Import browser data" entry is present (previously the only way to reach this importer was the first-run wizard).
- [ ] Click into it — **Expected:** the same source-detection/selection UI as the first-run wizard's import step loads (detected browsers with per-item checkboxes for bookmarks/history/passwords/etc., plus a Bookmarks HTML File option).
- [ ] Run an import from this page (e.g. a Bookmarks HTML File) — **Expected:** it completes the same way it would from `chrome://intro` — same progress states, same success/failure signaling.
- [ ] Run the import a second time later, well after first-run — **Expected:** works identically; there's no "only during first run" restriction on this entry point.

### Custom Cache & Clear Browsing Data

**What it is:** Adds a user-selectable custom disk cache directory (via native folder picker) and a granular "clear data on exit" system (cache, cookies, history, downloads, passwords, form data individually toggleable), layered on top of Chromium's `BrowsingDataRemover`.
**Where to find it:** `chrome://settings` → the page containing cache/storage controls (handled by the same `CustomSettingsHandler` as the rest of settings).
**Default state:** Disk cache enabled by default (`kCustomEnableDiskCache` / `kBrowserEnableDiskCache` = true). Clear-on-exit is **disabled by default** (`kBrowserClearDataOnExit` = false), as are all individual clear-data-type prefs (cache/cookies/history/downloads/passwords/form data all default false).

- [ ] Toggle disk cache off, browse a page, toggle back on — **Expected:** toggle sticks, no crash.
- [ ] Click "Select cache location" (or equivalent) — **Expected:** a native OS folder-picker dialog opens.
- [ ] Pick a new folder — **Expected:** the path is saved and displayed in the UI; browsing afterward writes cache files to that folder (spot-check on disk).
- [ ] Pick a folder without write permission (e.g., a protected system folder) — **Expected:** the UI surfaces an error rather than silently accepting the path.
- [ ] Enable "Clear data on exit" and check only **Cache** — **Expected:** after fully closing and reopening the browser, cache is cleared but cookies/history/passwords remain.
- [ ] Enable "Clear data on exit" with **Cookies**, **Browsing history**, and **Download history** all checked — **Expected:** after restart, all three are cleared; downloads list is also immediately empty (not just eventually).
- [ ] Leave "Clear data on exit" off — **Expected:** no data is cleared across a normal restart (regression check for the default-false prefs).

📷 *Screenshot suggestion: the cache/clear-data settings section with the custom folder path visible and a couple of clear-data checkboxes ticked.*

### Feature Flag Management (build-time flags)

**What it is:** A build-time (not runtime-toggleable) system controlling five Chromium behaviors via `custom_browser_config.gni` → compile-time defines → `CustomFeatureManager` singleton. There is no dedicated settings screen for this in the current source — it's verified by observing each flag's real-world effect in the browser.
**Where to find it:** No toggle UI; verify indirectly through the browser behaviors listed below. (Build-time source of truth: `custom_browser_config.gni`.)
**Default state:** Per the fork's default config — Tab Hover Cards **disabled**, Reader Mode **enabled**, Enhanced Scrolling **enabled**, JavaScript Controls **enabled**, Download Options (enhanced) **enabled**.

- [ ] Hover over a tab in the tab strip for 1+ second — **Expected:** no hover-preview card appears (hover cards disabled by default).
- [ ] Open `chrome://reader` — **Expected:** page loads normally (Reader Mode enabled by default); does not show a "feature disabled" message.
- [ ] Scroll a long page with mouse wheel / trackpad — **Expected:** smooth/animated scroll behavior rather than an instant jump (Enhanced Scrolling enabled).
- [ ] Locate the JavaScript content controls in Settings → Privacy — **Expected:** advanced per-site JS controls are present and toggleable.
- [ ] Open the downloads UI (`chrome://downloads` / download shelf) — **Expected:** enhanced download options/management controls beyond stock Chromium are visible.
- [ ] After a fresh build from `custom_browser_config.gni`, spot-check that flipping one of the five gn flags (e.g. `custom_disable_tab_hover_cards = false`) actually restores the corresponding vanilla behavior — **Expected:** hover cards reappear once rebuilt with that flag off.

📷 *Screenshot suggestion: tab strip during a hover with no preview card, next to a note of the five flags' current gn values.*

### Password Manager — Import & Export

**What it is:** CSV export/import of saved passwords from the Settings → Passwords page, gated by OS-level reauthentication (Windows Hello / Touch ID) on export.
**Where to find it:** `chrome://settings` → **Passwords** (also reachable at `chrome://password-manager`, which shares the same backend handler).
**Default state:** Enabled by default; export reauth is gated to Windows/macOS/ChromeOS (matches upstream — other platforms skip the OS prompt).

- [ ] Click **Export passwords** — **Expected:** an OS authentication prompt (Windows Hello / Touch ID) appears before anything else happens.
- [ ] Complete the OS prompt — **Expected:** a native "Save As" dialog opens, defaulting to `passwords.csv`.
- [ ] Save the file and open it in a text editor — **Expected:** it contains origin/username/password columns for every saved login.
- [ ] Cancel the OS authentication prompt — **Expected:** export aborts cleanly, no file is written, no crash.
- [ ] Trigger a second export while the OS prompt from a first attempt is still open (Windows) — **Expected:** the second request fails immediately with an error rather than hanging.
- [ ] Click **Import passwords** and pick a valid CSV — **Expected:** no reauth prompt is required; a result message shows counts of imported vs. skipped rows.
- [ ] Import a CSV with one malformed row (bad/missing URL) mixed with valid rows — **Expected:** the malformed row is skipped and counted, valid rows still import; the password list refreshes live.
- [ ] Import a CSV containing a login that duplicates an existing saved entry (same origin+username) — **Expected:** a second, separate entry is added (no merge/overwrite — this is a documented limitation, not a bug).

📷 *Screenshot suggestion: the OS reauth prompt mid-export, and the post-import result banner showing imported/skipped counts.*

### Password Manager — View, Copy, Add/Edit

**What it is:** Inline reveal/copy of a saved password (OS-reauth gated, with a 5-minute reauth grace window) and an add/edit modal for credentials.
**Where to find it:** `chrome://settings` → **Passwords** (or `chrome://password-manager`).
**Default state:** Enabled by default.

- [ ] Click **Show** (or the reveal icon) next to a saved password — **Expected:** an OS reauth prompt appears; on success, the plaintext password displays inline in monospace.
- [ ] Click **Show** again on a different row within 5 minutes — **Expected:** no repeated OS prompt (validity window honors the 5-minute grace period).
- [ ] Click **Copy** without having revealed the password first — **Expected:** OS reauth still triggers before the value is copied to the clipboard; paste somewhere to confirm the correct value copied.
- [ ] Click **Edit** on a saved entry — **Expected:** reauth is required first (edit reuses the view flow) before the edit modal opens pre-filled with the real current password.
- [ ] Change the username and save — **Expected:** the entry updates correctly even though the primary key (username) changed (internally uses `UpdateLoginWithPrimaryKey`).
- [ ] Add a brand-new credential via **Add password** — **Expected:** new entry appears in the list immediately, no reauth required to add.
- [ ] Add a credential for a site+username that already exists — **Expected:** a second, separate entry is created (no duplicate warning — documented limitation).

📷 *Screenshot suggestion: a revealed password row alongside the Add/Edit modal.*

### Password Manager — Checkup (weak/reused + leak check)

**What it is:** Two independent checkup mechanisms: an instant local weak/reused-password scan (no network), and a real network-based leaked-password check via `BulkLeakCheckService`.
**Where to find it:** `chrome://settings` → **Passwords** → Password checkup section (or `chrome://password-manager`).
**Default state:** Enabled by default. The network leak-check **will not surface real results** in this build — it requires a signed-in Google account with a real OAuth client, which this de-googled fork doesn't have configured; expect the UI to sit in a signed-out/token-error state.

- [ ] Open the Password checkup section — **Expected:** local weak/reused results appear near-instantly (no spinner/network wait) — a "totalChecked" count plus lists of weak and reused passwords.
- [ ] Save two identical passwords for two unrelated sites, then re-run the local checkup — **Expected:** both are flagged as "reused".
- [ ] Save an obviously weak password (e.g., `1234`) — **Expected:** it's flagged as "weak" after the local check.
- [ ] Click **Start** on the network leak check — **Expected:** progress streams in (pending count updates); given no OAuth credentials are configured, expect it to land in a signed-out or token-error state rather than `kIdle`/results — verify the UI clearly labels this state rather than silently hanging or crashing.
- [ ] Click **Stop** mid-check — **Expected:** the check halts cleanly, no crash, state resets.

📷 *Screenshot suggestion: the checkup section showing local weak/reused results plus the leak-check's signed-out/error state label.*

---

### Offline Speech-to-Text (On-Device Language Packs)

**What it is:** A language-pack manager for Chromium's on-device speech engine (SODA), giving users a dedicated way to make the Web Speech API run fully offline and free instead of falling back to Google's paid cloud speech service. `SpeechRecognitionManagerImpl` already always prefers on-device recognition once a matching language pack is installed — this section just adds a way to install one on purpose.
**Where to find it:** `chrome://settings` → **Accessibility** → "Offline speech-to-text" section, just below Live Captions.
**Default state:** No language installed by default. Requires network access for the one-time model download; recognition itself runs fully offline afterward.

- [ ] Open Settings → Accessibility — **Expected:** the language dropdown lists available on-device languages (English, Spanish, French, etc.), none marked installed initially.
- [ ] Select a language and click **Download** — **Expected:** status switches to "Downloading — NN%" and progresses to completion without a page reload.
- [ ] After install completes — **Expected:** section shows "Installed — ready to use offline" with a **Remove** button; re-opening Settings later still shows it installed (persisted, not just in-memory).
- [ ] With the language installed, disable network access (or block it) and use a page with `webkitSpeechRecognition`/`SpeechRecognition` (mic permission required) — **Expected:** speech recognition still returns results — this is the proof on-device is actually serving the request instead of the paid cloud fallback. *(Requires a working microphone — human verification, not automatable.)*
- [ ] Click **Remove** on an installed language — **Expected:** reverts to the download state; a subsequent Web Speech request without network falls back to erroring/unavailable rather than silently using the removed model.
- [ ] Enable the separate "Live captions" toggle above and pick the same language it installs — **Expected:** no conflict between the two features; both read from the same underlying installed-language state.

📷 *Screenshot suggestion: the Accessibility page with a language mid-download, and again showing "Installed — ready to use offline."*

---

## Custom WebUI

### RSS Reader (chrome://reader)

**What it is:** A full React rewrite of the RSS reader — feed/folder sidebar plus an item list with Title/Magazine/Full view layouts, search, and OPML import/export.
**Where to find it:** `chrome://reader` (omnibox), or via the RSS subscribe infobar on a page with a detected feed.
**Default state:** Enabled by default, gated on the `rss.enabled` pref (toggle lives on Settings → RSS). When disabled, the page shows only a localized "disabled" message instead of the reader UI.

- [ ] Open `chrome://reader` with RSS enabled — **Expected:** sidebar (feeds/folders) + item list render; DevTools → Network shows only `custom_reader.js`/`custom_reader.css` loading (no `reader.js`/`reader.html`).
- [ ] Add a feed URL via the sidebar's add-feed input, optionally into a folder — **Expected:** new feed appears in the sidebar with an unread badge.
- [ ] Click **↻ Refresh** in the header — **Expected:** button shows a brief spin; feeds refresh regardless of their normal update interval.
- [ ] Click **All feeds** — **Expected:** aggregated item list across every feed, with a summed unread badge.
- [ ] Type in **Search articles** — **Expected:** debounced (~250ms) results filter to matching titles; clearing the box restores the previous feed/group view.
- [ ] As of v1.8.34: search using different letter-case than the article title (e.g. a lowercase query for an uppercase-heavy title), or an accented variant of a word in the title — **Expected:** matching articles still appear (search is case- and accent-insensitive, not an exact-case substring match).
- [ ] Hover a feed row, click **✎ edit** — **Expected:** inline panel lets you change title/folder; hover **✕ delete** — confirm prompt, then removal.
- [ ] Switch item-list layout using the **☰ / ▤ / ▦** buttons — **Expected:** Title/Magazine/Full views render distinctly (thumbnail in Magazine, full image + "Open original article" button in Full); selection persists across a reload.
- [ ] Click an item — **Expected:** opens the source article in a new tab; item dims to indicate it's now read, and the feed's unread badge decrements immediately.
- [ ] Use footer **Export OPML**, then **Import OPML** on a fresh profile — **Expected:** subscriptions round-trip correctly.
- [ ] Toggle RSS off from Settings while `chrome://reader` is open in another tab — **Expected:** the reader tab live-swaps to the disabled-message screen without a manual reload.
- [ ] Restart the browser — **Expected:** subscriptions and read/unread state persist.

📷 *Screenshot suggestion: the reader in Magazine view with a couple of subscribed feeds and unread badges visible.*

### Sidebar — RSS panel (chrome://sidebar/rss)

**What it is:** A compact RSS view inside the browser's side panel, sharing the same `RSSImpl` backend as `chrome://reader`.
**Where to find it:** Click the **RSS** button on the sidebar's top pane.
**Default state:** Enabled by default (`enable_sidebar = true`), gated by `BUILDFLAG(ENABLE_SIDEBAR)`.

- [ ] Click the sidebar's **RSS** button — **Expected:** panel navigates to `chrome://sidebar/rss` (confirm in DevTools → Network: `custom_sidebar.js`/`.css` load).
- [ ] Use the feed `<select>` picker — **Expected:** selecting a feed populates the compact item list (favicon, relative time, 2-line summary).
- [ ] Subscribe to a new feed from the RSS infobar on a regular page — **Expected:** the sidebar's feed list updates live without reopening the panel.

📷 *Screenshot suggestion: the sidebar open to the RSS panel next to a subscribed feed's item list.*

### Sidebar — Bookmarks panel (chrome://sidebar/bookmarks)

**What it is:** A recursive bookmark tree in the sidebar (Bookmarks bar / Other / Mobile roots). As of v1.8.46, right-click brings this panel up to full CRUD parity with `chrome://bookmarks` — previously it was read-only with no add/rename/delete/move capability at all.
**Where to find it:** Click the **Bookmarks** button on the sidebar's top pane.
**Default state:** Enabled by default (part of the sidebar bundle).

- [ ] Click **Bookmarks** — **Expected:** tree loads with top-level folders expanded by default, nested folders collapsed.
- [ ] Click a bookmark row — **Expected:** opens in a new foreground tab in the same window.
- [ ] Type in the search filter — **Expected:** tree prunes client-side to matching entries.
- [ ] Add/rename a bookmark via `chrome://bookmarks` while the sidebar panel is open — **Expected:** sidebar tree updates live (no manual refresh).
- [ ] As of v1.8.46: right-click a bookmark in this panel — **Expected:** a context menu appears with Open / Open in new tab / Open in new window / Copy URL / Add bookmark or folder here / Edit… / Move to folder… / Delete — this panel previously had no context menu at all.
- [ ] Use **Open in new tab** and **Open in new window** — **Expected:** each opens with the correct disposition (background/foreground tab, or a new window) via the same `bookmarkOpenUrl` message `chrome://bookmarks` uses.
- [ ] Use **Move to folder…** to move a bookmark — **Expected:** a folder picker appears and the move applies immediately; note this panel doesn't get drag-and-drop reordering in this pass, only the picker.
- [ ] Use **Delete** on a bookmark added from this panel — **Expected:** it disappears from both this panel and `chrome://bookmarks` immediately.

📷 *Screenshot suggestion: the bookmarks tree with the new right-click context menu open on a bookmark row.*

### Sidebar — History panel (chrome://sidebar/history)

**What it is:** Recent visits grouped by day, with search and per-entry deletion.
**Where to find it:** Click the **History** button on the sidebar's top pane.
**Default state:** Enabled by default.

- [ ] Click **History** — **Expected:** visits group under Today / Yesterday / weekday headers, newest first, capped at 200 rows / last 365 days.
- [ ] Type in the search box — **Expected:** debounced (~250ms) filter by title/URL substring.
- [ ] Hover a row, click **✕** — **Expected:** that entry is removed from history immediately, and from `chrome://history` too.
- [ ] Visit a new page while the panel is open — **Expected:** list updates live via `historyChanged`.

📷 *Screenshot suggestion: history grouped by day with the hover-revealed delete button visible.*

### Sidebar — Notes panel (chrome://sidebar/notes)

**What it is:** Per-URL text notes attached to the active tab.
**Where to find it:** Click the **Notes** button on the sidebar's top pane.
**Default state:** Enabled by default.

- [ ] Click **Notes** on a page — **Expected:** header shows the active tab's URL; a **Save** button is available.
- [ ] Type a note and click **Save** — **Expected:** note persists; reopening Notes on the same page shows it pre-populated.
- [ ] Navigate to a different page, click **↻** — **Expected:** header URL updates and that page's notes load.
- [ ] Expand **All notes** — **Expected:** every saved note across all pages lists; hover → **✕** deletes one.

📷 *Screenshot suggestion: a saved note next to the expanded "All notes" list.*

### Sidebar — NTP Settings panel (chrome://sidebar/ntp-settings)

**What it is:** A layout/appearance settings panel for the New Tab Page, reachable both from the sidebar's top pane and from the NTP's own gear icon.
**Where to find it:** Click the **gear icon** on a New Tab Page, or the sidebar's NTP-settings entry directly.
**Default state:** Enabled by default.

- [ ] Open a New Tab Page and click the gear icon — **Expected:** sidebar opens (or expands) and navigates to `chrome://sidebar/ntp-settings`, with the active layout card highlighted.
- [ ] Click a different layout card (full/clean/focus/wallpaper/glass) — **Expected:** content/background toggle sections below update immediately for the new layout.
- [ ] Toggle content options (search, top sites, greeting, clock) and background options (show background, Bing wallpaper), then click **Save Settings** — **Expected:** the open NTP tab transitions to the new layout without a page reload.
- [ ] Open a brand-new NTP tab — **Expected:** it reflects the previously saved layout and settings.

📷 *Screenshot suggestion: the layout-card picker with a non-default layout selected.*

### Sidebar — Recently Closed / Open Tabs panel (chrome://sidebar/recently-closed)

**What it is:** Two live lists — every open tab across every window of the profile, and recently closed tabs/windows via `TabRestoreService`.
**Where to find it:** Click the **Recently Closed** (undo icon) button on the sidebar's top pane.
**Default state:** Enabled by default.

- [ ] Open tabs in two separate browser windows, then open this panel — **Expected:** **Open Tabs** lists tabs from both windows, with a dot marking each window's active tab.
- [ ] Click a tab row belonging to the *other* window — **Expected:** that window activates and the tab becomes selected.
- [ ] Close a single tab, then close an entire window — **Expected:** both appear under **Recently Closed**; the window entry shows a tab-count badge.
- [ ] Click a closed-tab row — **Expected:** restores as a new tab in the window hosting the sidebar.
- [ ] Click a closed-window row — **Expected:** restores the whole window.
- [ ] Open/close/switch tabs while the panel is open — **Expected:** both lists update live with no manual refresh.

📷 *Screenshot suggestion: the Open Tabs list spanning two windows with the active-tab dot indicator visible.*

### Standalone Password Manager (chrome://password-manager)

**What it is:** The same password functionality as Settings → Passwords (list/remove/view/copy/add/edit/checkup/import/export), now also served as its own dedicated page sharing one backend handler with the settings sub-page.
**Where to find it:** `chrome://password-manager`, or via **Settings → Passwords → Open password manager**.
**Default state:** Enabled by default.

- [ ] Navigate directly to `chrome://password-manager` — **Expected:** page loads with the full password list (this used to be a placeholder stub — confirm it's not blank).
- [ ] From Settings → Passwords, click **Open password manager** — **Expected:** lands on this page (no longer a dead link).
- [ ] Navigate to `chrome://password-manager/passwords/<some-site.com>` — **Expected:** filter box pre-fills with that host (deep-link support).
- [ ] Perform one view/edit/remove action here — **Expected:** matches behavior already verified in the Settings → Passwords sections above (shared backend, no divergence).

📷 *Screenshot suggestion: the standalone password manager page loaded directly from the omnibox.*

### Advanced Preferences (chrome://advanced-prefs)

**What it is:** A full profile-preference editor — the about:config equivalent — listing every registered pref with type/value/default-state, editable inline.
**Where to find it:** `chrome://advanced-prefs` (typed directly). As of v1.8.31, moved off `chrome://settings/advanced-prefs` to this dedicated, unlisted host — deliberately not linked from the Settings nav or the omnibox `settings:` quick actions, so casual users don't stumble into it.
**Default state:** Enabled by default.

- [ ] Navigate directly to `chrome://advanced-prefs` — **Expected:** page loads with the full preference table (key/type/value/status columns).
- [ ] Open `chrome://settings` and look through the nav — **Expected:** no "Advanced preferences" entry appears anywhere in the Settings UI.
- [ ] Type `settings: advanced` in the omnibox — **Expected:** no quick-action suggestion for it appears (it's no longer part of the Settings route table).
- [ ] Type a filter term into the search box — **Expected:** table narrows to matching preference keys live.
- [ ] Toggle a boolean pref's checkbox — **Expected:** value flips immediately and the row highlights as "modified".
- [ ] Click a string/number value to edit it, change it, press Enter — **Expected:** new value saves and the row shows "modified".
- [ ] Click the reset (↺) icon on a modified pref — **Expected:** value reverts to default and the row's status returns to "default".
- [ ] Restart the browser after modifying a pref here — **Expected:** the change persists (this is real `PrefService` access, not a mock).

📷 *Screenshot suggestion: the advanced-prefs table with a few modified (highlighted) rows.*

### Custom WebUI Pages — Fleet Smoke Test

**What it is:** A broad sweep across every other single-purpose `chrome://` React page in the fork, to catch pages left broken by upstream Chromium changes after a rebase (e.g. a patch to `chrome_web_ui_configs.cc` failing to reapply). Host names below follow the fork's `chrome://<name>` convention (no `custom_` prefix) — confirm the exact string in the omnibox autocomplete if a guess below is off.
**Where to find it:** Omnibox, typing `chrome://` and using autocomplete, or via the relevant native menu entry (Extensions, Downloads, etc.).
**Default state:** Enabled by default for all listed pages, unless noted.

- [ ] `chrome://extensions` — **Expected:** list + Apps section load; icons render; enable/disable/remove/reload work; detail page opens on click with permissions/site-access/activity-log sections.
- [ ] `chrome://downloads` — **Expected:** loads and lists recent downloads.
- [ ] `chrome://history` — **Expected:** loads and lists recent visits.
- [ ] As of v1.8.40: on `chrome://history`, search by a title/URL term, then filter by date range and by a specific host — **Expected:** each filter narrows results live (real `HistoryService`-backed query, not a static list); select several rows and batch-delete — **Expected:** they disappear immediately and the page updates live without a manual reload.
- [ ] `chrome://bookmarks` — **Expected:** full CRUD bookmark manager loads.
- [ ] As of v1.8.40: on `chrome://bookmarks`, add a folder and a bookmark, rename each, then drag a bookmark into a different folder and reorder it within that folder — **Expected:** the tree reflects every change immediately (real `BookmarkModel` CRUD + drag-and-drop, not a static tree); rapid multi-node changes (e.g. a drag touching several nodes) collapse into a single UI update rather than flickering per node.
- [ ] As of v1.8.41: open either page in dark mode at a narrow-ish window width — **Expected:** the background fills the full viewport edge-to-edge, no white/light bars in the margins outside the centered content column (previously the background color was applied to the same element as the centering classes, so the margins fell through to the unstyled body).
- [ ] As of v1.8.46: right-click a bookmark on `chrome://bookmarks` — **Expected:** a context menu appears (previously there wasn't one) with Open / Open in new tab / Open in new window / Copy URL / Add bookmark or folder here / Edit… / Move to folder… / Delete.
- [ ] Use **Copy URL**, then paste — **Expected:** clipboard contains that bookmark's URL.
- [ ] Use **Add bookmark or folder here** from a right-click on a folder — **Expected:** a new bookmark/folder is created inside that folder.
- [ ] Use **Edit…** on a bookmark — **Expected:** opens an editor for its title/URL; saving updates the tree immediately.
- [ ] Use **Move to folder…** — **Expected:** a folder picker appears; confirming moves the bookmark, reflected immediately in the tree.
- [ ] `chrome://flags` (custom_flags) — **Expected:** experimental-flags page loads and search/filter works.
- [ ] `chrome://print` — **Expected:** print preview loads for a normal page.
- [ ] `chrome://certificate-manager` — **Expected (as of this writing, still a stub):** the page loads a static placeholder card reading roughly "not wired up yet," directing you to the OS certificate store — **no real certificate list loads**. If a real list ever does load, this line needs updating to describe the working feature.
- [ ] `chrome://management` — **Expected:** loads; shows real managed-status (unmanaged on a personal profile is expected and correct).
- [ ] `chrome://sync-confirmation` (best triggered via the sign-in flow) — **Expected:** shows real account name/email and sync-benefits list; "Yes, I'm in" / "Settings" / "Cancel" all function.
- [ ] `chrome://intro` (best triggered via first-run) — **Expected:** Welcome step, then a real cross-browser import step (Firefox / legacy Edge bookmarks / Bookmarks HTML file).
- [ ] `chrome://whats-new` — **Expected:** loads a features list (network fetch with hardcoded fallback if the API is unreachable).
- [ ] `chrome://tab-search` — **Expected (as of this writing, still a stub):** the toolbar button opens the bubble correctly (real top-chrome surface, no crash), but the search input is disabled and shows "not wired up yet" — **no real tab list, no search.** If real search ever ships, this line needs updating.
- [ ] `chrome://terms`, `chrome://credits` — **Expected:** both load their respective legal/license text.
- [ ] As of v1.8.32: switch to dark mode (OS or browser theme), then open `chrome://terms` — **Expected:** text renders light-on-dark, not white-on-white (the page previously had no background color set, so `dark:text-white` rendered invisibly on the default white canvas).
- [ ] As of v1.8.32: open `chrome://credits` — **Expected:** the embedded license-text iframe (`full.html`) actually renders inside the page instead of being blocked (previously the shell's CSP inherited Chromium's default `child-src 'none'`, blocking the iframe before `frame-ancestors` was even consulted).
- [ ] As of v1.8.39: in dark mode, spot-check `chrome://history`, `chrome://bookmarks`, `chrome://certificate-manager`, `chrome://chrome-urls`, `chrome://tab-search`, and `chrome://print` — **Expected:** all render with a proper dark background (no white-text-on-white-page); also check several `chrome://settings` sub-pages and `chrome://password-manager` for illegible dark-on-dark secondary/body text or an unstyled `<h2>` page title — none should appear (a full sweep across ~30+ files fixed exactly this pattern in one pass).
- [ ] As of v1.8.39: check the Profile menu's Account page (`AccountPage.tsx`) in **light** mode, and the sidebar's Notes panel in both light and dark mode — **Expected:** Account page text is legible in light mode (it was previously written dark-theme-only and washed out); Notes panel text isn't too light for light mode *and* too dark for dark mode at the same time (a previously fully-inverted color pairing).
- [ ] `chrome://feedback` — **Expected:** form loads and submits without error.
- [ ] `chrome://apps` — **Expected:** installed web apps list, launch/uninstall work.
- [ ] `chrome://proxy-routing` — **Expected:** proxy configuration UI loads.
- [ ] `chrome://privacy-shield` — **Expected:** privacy/tracking-protection UI loads.
- [ ] `chrome://tracking-dashboard` — **Expected:** dashboard loads with tracking-protection stats.
- [ ] `chrome://top-sites` (most-visited backed) — **Expected:** grid of top sites loads.
- [ ] `chrome://bittorrent`, `chrome://epub-reader` — **Expected:** both niche viewers load without a blank page.
- [ ] Profile menu → **Add profile** — **Expected:** `custom_profile_picker` loads real profile list/create/rename/delete/launch; new-profile flow lands on `custom_profile_customization` (avatar/name/theme color all save live).
- [ ] On `chrome://profile-customization`, edit a few swatches under "Custom theme" (both Light and Dark tabs) and click **Apply theme** — **Expected:** "Applied" confirmation appears; the actual browser chrome (toolbar/frame/tabs) visibly re-colors according to whichever mode (light/dark) the OS/browser is currently in.
- [ ] Click **Export JSON** — **Expected:** a `.json` file downloads containing `name`, `light`, `dark`, `cornerRadius`, `focusShadow`.
- [ ] Edit a color directly in the exported file, then use **Import JSON** to re-select it — **Expected:** the editor's swatches update to match, "Applied" confirms, and the browser chrome reflects the edited color.
- [ ] Import a JSON file missing `"light"` or `"dark"` — **Expected:** an "Invalid theme" error shows; the previously-applied theme is left untouched (not reset, not partially applied).
- [ ] Click **Reset** — **Expected:** browser chrome reverts to the default theme; editor swatches reset to the built-in placeholder values.
- [ ] As of v1.8.30: with no custom theme applied (or after **Reset**), open `chrome://settings` — **Expected:** cards/panels render with their normal ~20px corners and no visible focus-shadow change from any prior version.
- [ ] As of v1.8.30: apply a custom theme with a distinctly different `cornerRadius` (e.g. edit the exported JSON to `4` and re-import) and a visible `focusShadow`, then open `chrome://settings` — **Expected:** every page's cards/panels now render with the new corner radius, and Tab-focusing a button/checkbox/input anywhere shows the themed focus shadow — confirm on at least two different settings pages to verify it's fork-wide, not page-specific.
- [ ] Restart the browser after applying a custom theme (without resetting first) — **Expected:** the custom colors are still applied post-restart (persisted via prefs, not just in-memory for that session).
- [ ] `chrome://chrome-urls` — **Expected:** lists all internal `chrome://` URLs, including the custom ones above.

📷 *Screenshot suggestion: a grid/collage of the omnibox autocomplete dropdown showing all `chrome://` custom hosts, useful as a quick post-rebase completeness check.*

---

## Installer & Auto-Update

Covers `custom-omaha-client` (a separate sibling repo, vendored at
`src/custom/third_party/omaha_client`) and `custom-browser`'s own
`UpdateManager` (`src/custom/chrome/browser/autoupdate/`). Windows-only —
the background-updater self-install/uninstall mechanisms have no POSIX
implementation yet. See [Omaha Update Client](../version-updates/omaha-update-client)
for the full architecture. **These steps register real Windows services/
Scheduled Tasks and copy files outside the repo — clean up after testing**
(`omaha_client --uninstall-service` elevated, `schtasks /Delete /TN
WanderlustUpdateTask /F`, and remove the `Update\` folder under Program
Files/LocalAppData) rather than leaving test artifacts on the machine.

### Install Wizard UI

**What it is:** The three-screen (Welcome → Eula → Progress) graphical
first-run installer, with a custom-drawn title bar and modern flat
buttons/checkbox instead of stock Win32 chrome.
**Where to find it:** Run `omaha_client.exe --install-ui --version 1.0.0.0
--browser-exe "<path to any exe>"` directly (doesn't require a real
browser install to look at the UI — just don't click through to a real
Install unless you mean to).
**Default state:** Enabled — this is the only install path; no buildflag
gate.

- [ ] Launch `--install-ui` — **Expected:** borderless window (no system
  title bar) with its own painted title bar: app icon, app name, and a
  close (X) button in the top-right, separated from the body by a thin
  divider line.
- [ ] Drag the window by clicking and holding anywhere in the title bar
  band (not the close button) — **Expected:** window moves normally, same
  as dragging a native caption.
- [ ] Hover, then click, the custom close button — **Expected:** hover
  shows a red highlight; click closes the installer (same as Cancel).
- [ ] Double-click the title bar — **Expected:** nothing happens (no
  maximize) — this is a fixed-size window.
- [ ] On Windows 11, compare the window's corners to a normal application
  window — **Expected:** visibly rounded, not square.
- [ ] On the Welcome screen, check the Cancel/Next buttons and the Browse
  button — **Expected:** flat, rounded-corner buttons; Next is solid
  accent-blue (primary), Cancel/Browse are white with a thin border
  (secondary); hovering darkens the fill/border slightly.
- [ ] Advance to the Eula screen — **Expected:** the "I have read and
  agree..." checkbox is an unfilled rounded square with a border, and the
  Install button is visibly grayed out/disabled until it's checked.
- [ ] Check the EULA checkbox — **Expected:** the box fills solid
  accent-blue with a white checkmark, and the Install button switches to
  solid accent-blue (enabled).
- [ ] Compare all text (title bar, labels, buttons) against a very old
  build/screenshot if available — **Expected:** Segoe UI throughout, not
  the old default system font.

📷 *Screenshot suggestion: Welcome screen and the EULA screen (checkbox
checked, Install enabled) side by side.*

### Background Updater Self-Install

**What it is:** After a successful browser install, `omaha_client` copies
itself to a permanent location and registers for background update checks
— a Windows Service (machine-wide, needs Administrator) or a Scheduled
Task fallback (per-user, no admin needed) — mirroring how Google Update
persists itself after installing Chrome.
**Where to find it:** Happens automatically at the end of a real
`--install-ui` run, or standalone via `omaha_client.exe --register-updater`.
**Default state:** Enabled — always attempted; the two paths below are
automatic fallback, not a setting.

- [ ] Run `--register-updater` from a **non-elevated** prompt — **Expected:**
  JSON output `{"status":"ok","path":"...\\AppData\\Local\\<AppName>\\
  Update\\<AppName>Update.exe"}`; the exe exists at that path.
- [ ] Run `schtasks /Query /TN WanderlustUpdateTask /V /FO LIST` —
  **Expected:** task exists, `Task To Run` points at the copied exe with
  `--update`, `Logon Mode: Interactive only`, repeats every 4 hours.
- [ ] Run `--register-updater` again from an **elevated** (Run as
  Administrator) prompt — **Expected:** JSON output points at
  `...\Program Files\<AppName>\Update\<AppName>Update.exe` instead; `Get-
  Service OmahaClientSvc` shows it registered, `AUTO_START`, running as
  `LocalSystem`.
- [ ] With the elevated (Service) copy registered, run
  `omaha_client.exe --uninstall` (from either copy) — **Expected:** JSON
  `{"status":"ok"}`; `Get-Service OmahaClientSvc` no longer finds it, and
  the copied exe/Update folder are gone a few seconds later (self-delete
  is delayed until this process exits).
- [ ] Repeat `--uninstall` for the per-user (Scheduled Task) copy —
  **Expected:** same result, task removed via `schtasks /Query` no longer
  finding `WanderlustUpdateTask`.

📷 *Screenshot suggestion: `Get-Service OmahaClientSvc` and `schtasks
/Query /TN WanderlustUpdateTask` output side by side, showing both paths
registered.*

### Orphan Detection (Self-Uninstall)

**What it is:** The background updater notices when the browser itself has
been uninstalled (it lives in a sibling folder outside the browser's own
install tree, so a normal uninstall doesn't touch it) and removes itself
instead of running forever.
**Where to find it:** Not directly user-facing — verified by simulating an
uninstalled browser and watching the next background check.
**Default state:** Enabled — best-effort and delayed (next scheduled
check, up to ~4 hours), not instant. Never fires if `--install-ui` never
recorded a browser exe path (e.g. very old installs).

- [ ] After a real `--install-ui` install, find the state file at
  `%LOCALAPPDATA%\<AppName>\update_client_state.json` — **Expected:** it
  contains a `"browser_exe"` field pointing at the real, existing browser
  exe path.
- [ ] Hand-edit that field to a path that doesn't exist (e.g.
  `C:\nonexistent\browser.exe`), then run `<the registered updater copy>
  --update` directly — **Expected:** JSON output
  `{"status":"self_uninstalled"}`; the Service or Scheduled Task
  (whichever was registered) is removed, and the copied exe/folder
  disappear shortly after.
- [ ] Repeat with the field pointing at a real, existing file — **Expected:**
  a normal update check runs instead (no self-uninstall).

📷 *Not applicable — this is a state-file/CLI verification, not a visual
feature.*

### About Page — Check for Updates

**What it is:** `chrome://settings`'s "Check for updates" button — checks
wanderlust-api directly, then (if an update is available) downloads and
installs it via the background updater from above, with live progress.
**Where to find it:** `chrome://settings` → About/Help section.
**Default state:** Enabled — requires the background updater to already be
registered (see above) to actually apply an update; the check itself
always works regardless.

- [ ] With no update available (already on the latest version), click
  "Check for updates" — **Expected:** reports up to date; no download
  attempted.
- [ ] With a newer version published on the update server, click "Check
  for updates" — **Expected:** reports an update is available.
- [ ] As of v1.8.37: with an update available, let the check proceed all
  the way through — **Expected:** it actually downloads and installs
  (previously, the check would report an update was available but never
  call `DownloadUpdate()` — the button could only ever report
  availability; an update would only actually get applied by the
  independent background Scheduled Task/Service on its own schedule,
  regardless of this button).
- [ ] Let it proceed to download — **Expected:** a real, live progress
  indicator advances (not an instant jump to 100%) as `omaha_client.exe
  --update` runs in the background — check Task Manager for a transient
  `omaha_client.exe`/`<AppName>Update.exe` process while this is happening.
- [ ] Let the download/install finish — **Expected:** the browser restarts
  itself automatically (relaunches onto the new version) rather than
  requiring the user to close/reopen it manually.
- [ ] After restart, check the About page's version string — **Expected:**
  matches the version that was published, confirming the update actually
  applied (not just downloaded).
- [ ] Test on an install with no registered background updater (e.g. one
  predating this feature, or after running `--uninstall` against it) —
  **Expected:** a clear error is shown/logged rather than the button
  silently doing nothing.

📷 *Screenshot suggestion: the About page mid-download, showing a real
progress percentage.*
