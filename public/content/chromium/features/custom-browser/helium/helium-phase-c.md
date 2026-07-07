# Helium Browser Port — Phase C (UX Enhancements)

Four features ported or adapted from the [Helium browser](https://github.com/helium-browser/helium)
patch catalogue. All are gated by `BUILDFLAG(CUSTOM_BROWSER)`. New source files live under
`src/custom/`; vanilla Chromium files contain only minimal integration hooks.
Apply or refresh patches with `npm run update_patches`.

See `docs/helium-phase-b.md` for the five Phase B features.  
See `CLAUDE.md` (items 22–25) for the full technical spec of each change.

---

## Features

### 1. MRU Tab Cycling

**Vanilla files:**
- `src/chrome/browser/ui/views/frame/browser_view.h`
- `src/chrome/browser/ui/views/frame/browser_view.cc`

Replaces Chromium's left-to-right `Ctrl+Tab` / `Ctrl+Shift+Tab` behaviour with
Most-Recently-Used ordering. On first press a snapshot of the MRU list is taken; each
subsequent press advances one step through the snapshot. Cycling ends when the user
releases `Ctrl`, at which point the selected tab is committed and the snapshot is
discarded.

**Key design choices:**

- `mru_tab_order_` (front = most recent) maintained in `BrowserView`. Updated in
  `MRUTabActivated` (called from `OnTabStripModelChanged`). Removals erase from both
  the live order and any in-flight snapshot via `MRUTabRemoved`.
- `mru_cycling_` guard prevents `MRUTabActivated` from re-ordering during active cycling.
- Ctrl-release detected by `MRUCtrlReleaseHandler : ui::EventObserver` (window-level
  event monitor). Monitor and handler stored as two separate `unique_ptr` members;
  monitor destroyed before handler in `StopMRUCycling`.
- Accelerator interception in `AcceleratorPressed` for `IDC_SELECT_NEXT_TAB` /
  `IDC_SELECT_PREVIOUS_TAB`; returns `true` to suppress default tab-order navigation.

| Detail | Value |
|---|---|
| Pref key | `tab.mru_cycling_enabled` |
| Default | `false` (opt-in) |
| Order storage | `mru_tab_order_` (`std::vector<raw_ptr<content::WebContents>>`) in `BrowserView` |
| Cycle snapshot | `mru_cycle_snapshot_` (copy taken at first Ctrl+Tab press) |
| Ctrl-release detection | `MRUCtrlReleaseHandler : ui::EventObserver` via `views::EventMonitor::CreateWindowMonitor` |
| Source | Adapted from Brave/Helium `tab-cycling-mru-impl.patch` |

---

### 2. Compact Layout (Tabs in Toolbar)

**Vanilla files:**
- `src/chrome/browser/ui/views/frame/browser_view_layout_delegate.h`
- `src/chrome/browser/ui/views/frame/browser_view_layout.h` / `.cc`
- `src/chrome/browser/ui/views/frame/browser_view.cc` (`BrowserViewLayoutDelegateImpl`)

An optional layout mode that places the tab strip and toolbar side-by-side in a single
row, reclaiming the full tab-strip height for page content. Implemented purely at the
layout level — no view reparenting.

**Layout algorithm (`LayoutCompactRow`):**

1. Row height = toolbar's `GetPreferredSize().height()`.
2. Tab strip occupies the left 65% of available width at `top`.
3. Toolbar occupies the right 35% at the same `top`.
4. Both views are placed via `SetViewBoundsToRectangle`; `top` advances by `row_h`.
5. Bookmark bar and info bars are suppressed (not laid out) in compact mode.

The existing `Layout()` tab strip + toolbar sequence is replaced by `LayoutCompactRow`
when `delegate_->IsCompactLayoutEnabled()` returns true. Wrapped in a
`BUILDFLAG(CUSTOM_BROWSER)` `if/else` so the vanilla path is untouched when the flag is
off.

| Detail | Value |
|---|---|
| Pref key | `toolbar.compact_layout` |
| Default | `false` (opt-in) |
| Tab strip share | 65% of available width |
| Toolbar share | 35% of available width |
| Row height | Toolbar preferred height |
| Source | Adapted from Helium `compact.patch` (layout-only; no view reparenting) |

---

### 3. Zen Mode (Auto-Hide Chrome)

**Vanilla files:**
- `src/chrome/browser/ui/views/frame/browser_view.h`
- `src/chrome/browser/ui/views/frame/browser_view.cc`
- `src/chrome/browser/ui/views/frame/browser_view_layout_delegate.h`
- `src/chrome/browser/ui/views/frame/browser_view_layout.cc`

A distraction-free mode that hides the top chrome (toolbar + tab strip) and expands
page content to fill the full window. Moving the cursor to the top 6 px of the window
instantly reveals the chrome; moving away starts a 3-second timer before hiding again.

**State machine:**

| State | `zen_active_` | `zen_chrome_visible_` | Effect |
|---|---|---|---|
| Off | `false` | `true` | Normal layout |
| Hidden | `true` | `false` | Content full-height; chrome at `y=-height` |
| Revealed | `true` | `true` | Content full-height; chrome at `y=0`, overlaying content |

**Layout integration:**

- `UpdateTopContainerBounds` has a new branch: when `IsZenModeHiding()`, sets
  `top_container_bounds.set_y(-height)` to park chrome above the window edge.
- In `Layout()`, when zen is active: bookmark bar visibility is forced off and `top` is
  reset to `top_inset` so `LayoutContentsContainerView` always gets `top=0` regardless
  of whether chrome is revealed. Content never jumps between hidden/revealed states.

**Mouse monitoring:**

`ZenMouseObserver : ui::EventObserver` listens to `kMouseMoved` events via
`views::EventMonitor::CreateWindowMonitor`. Y coordinate is translated from screen to
window space; thresholds are:
- `y ≤ 6 px` → reveal immediately, cancel timer
- `y > chrome_height + 8 px` → start 3-second `base::RetainingOneShotTimer`
- `y ≤ chrome_height` while visible → cancel timer (cursor inside chrome area)

| Detail | Value |
|---|---|
| Pref key | `zen_mode.enabled` |
| Default | `false` (opt-in) |
| Reveal zone | Top 6 px of window |
| Hide grace period | 3 seconds (`base::RetainingOneShotTimer`) |
| Chrome hide mechanism | `top_container_bounds.set_y(-height)` in `UpdateTopContainerBounds` |
| Content top | Always `top_inset` when zen active (no jump on reveal) |
| Source | Adapted from Helium `zen-mode.patch` (single-axis, no sidebar animation) |

---

### 4. Native Bang Shortcuts

**New files:**
- `src/custom/browser/bang_shortcuts.h`
- `src/custom/browser/bang_shortcuts.cc`

**Vanilla file:**
- `src/chrome/browser/ui/views/frame/browser_view.cc` (one call in `InitViews`)

Seeds 18 `!bang` keyword shortcuts into the `TemplateURLService` on first run. Users can
then type e.g. `!yt chromium build` in the address bar to search YouTube directly.

**Installed bangs:**

| Bang | Engine |
|---|---|
| `!g` | Google |
| `!ddg` | DuckDuckGo |
| `!yt` | YouTube |
| `!w` | Wikipedia |
| `!gh` | GitHub |
| `!maps` | Google Maps |
| `!imgs` | Google Images |
| `!news` | Google News |
| `!so` | Stack Overflow |
| `!npm` | npm |
| `!mdn` | MDN Web Docs |
| `!reddit` | Reddit |
| `!hn` | Hacker News (Algolia) |
| `!rust` | Rust Docs |
| `!pypi` | PyPI |
| `!crates` | crates.io |
| `!b` | Bing |
| `!wa` | Wolfram Alpha |

**Implementation details:**

- `TemplateURLData.safe_for_autoreplace = true` — bangs appear in the keyword list but
  don't override user-set engines.
- Existing keywords are skipped (no overwrite of user customisations).
- `BangInstaller : TemplateURLServiceObserver` is heap-allocated and self-owned; it
  defers installation until `OnTemplateURLServiceLoaded()` fires, then `delete this`.
- `prefs::kBangShortcutsInstalled` pref ensures installation is idempotent across
  browser restarts, profile copies, and concurrent windows.

| Detail | Value |
|---|---|
| Pref key | `custom.bangs_installed` |
| Default | `false` (written `true` after first install) |
| Bang count | 18 |
| Idempotency | Pref gate + per-keyword existence check |
| Deferred load | `BangInstaller : TemplateURLServiceObserver` (self-owned) |
| Source | Custom implementation; inspired by Helium `add-native-bangs.patch` |
