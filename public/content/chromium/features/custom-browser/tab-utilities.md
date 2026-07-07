# Tab Utilities

Extended tab context menu commands available under `BUILDFLAG(CUSTOM_BROWSER)`.
All commands appear in the right-click tab context menu. Implemented as patches
on top of the vanilla Chromium tab strip.

---

## Build flag

Gated by `BUILDFLAG(CUSTOM_BROWSER)`. Controlled by `custom_browser = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

---

## Commands

### Copy URL

Re-uses `TabStripModel::CommandCopyURL`, which exists in vanilla Chromium but is
restricted to web-app windows. The patch removes the `IsForWebApp()` DCHECK gate
(`DCHECK(delegate()->IsForWebApp())` is deleted) so the command is available in
all browser windows.

Writes the current tab's last committed URL to the clipboard.

### Copy All URLs

`TabStripModel::CommandCopyAllURLs` — calls `delegate()->CopyAllURLs()`.

Iterates all open tabs and writes their URLs to the clipboard as a
newline-separated list.

### Clone Tab to New Window

`TabStripModel::CommandCloneTabToNewWindow` — calls
`delegate()->CloneTabToNewWindow(web_contents)`.

Opens the current tab's URL in a new regular browser window. The new window
starts with a fresh session (no shared cookies, history, or session state).

### Clone Tab to Incognito

`TabStripModel::CommandCloneTabToIncognito` — calls
`delegate()->CloneTabToIncognito(web_contents)`.

Opens the current tab's URL in an incognito window. Only shown when the source
tab is not already incognito (the menu item is omitted with
`!tab_strip->profile()->IsOffTheRecord()`).

### Close Tabs to Left

`TabStripModel::CommandCloseTabsToLeft` — closes all unpinned tabs to the left
of (and not in the same selection as) the context tab.

Mirrors the upstream `CommandCloseTabsToRight` in reverse direction.
`GetIndicesClosedByCommand` is extended to handle `CommandCloseTabsToLeft`; the
patch also simplifies the vanilla RTL label-swap for Close Tabs to Right (the
`IsRTL()` conditional that flipped the label is removed — both directions now
always use their own label).

---

## Architecture

All commands follow the existing Chromium tab command pattern:

```
Tab context menu (right-click)
  └─► TabMenuModel::Build()
        Adds items via AddItemWithStringId(Command*, IDS_*).
        CloneTabToIncognito item omitted when profile is already OTR.
        │
        └─► TabStripModel::ExecuteContextMenuCommand()
              Dispatches to delegate for CopyAllURLs / CloneTab* commands.
              Dispatches GetIndicesClosedByCommand then CloseTabs for CloseTabsToLeft.
              │
              └─► TabStripModelDelegate (BrowserTabStripModelDelegate)
                    CopyAllURLs()           — iterates WebContents, writes URLs to clipboard
                    CloneTabToNewWindow()   — NavigateParams to NEW_WINDOW
                    CloneTabToIncognito()   — opens incognito window, navigates
```

---

## File map

| File | Change |
|---|---|
| `chrome/browser/ui/tabs/tab_menu_model.cc` (patch) | Adds 4 menu items inside `#if BUILDFLAG(CUSTOM_BROWSER)` after `CommandDuplicate` |
| `chrome/browser/ui/tabs/tab_strip_model.h` (patch) | Adds `CommandCloseTabsToLeft`, `CommandCopyAllURLs`, `CommandCloneTabToNewWindow`, `CommandCloneTabToIncognito` to the `ContextMenuCommand` enum |
| `chrome/browser/ui/tabs/tab_strip_model.cc` (patch) | `IsContextMenuCommandEnabled`, `ExecuteContextMenuCommand`, and `GetIndicesClosedByCommand` cases for all new commands |
| `chrome/browser/ui/tabs/tab_strip_model_delegate.h` (patch) | Adds `virtual void CopyAllURLs() = 0`, `CloneTabToNewWindow(WebContents*)`, `CloneTabToIncognito(WebContents*)` to the delegate interface; also adds the required BUILDFLAG includes (`build/buildflag.h`, `custom/buildflags/custom_browser_buildflags.h`) |

---

## Tab Behaviour Features

Three tab interaction behaviours ported from the chrome_plus project
(`shuax/chrome_plus`). Each is controlled by a pref in `TabService`
(`src/custom/browser/tab/tab_service.cc`).

---

### Tab Scroll Navigation

Scrolling the mouse wheel while the cursor is over the tab strip cycles through
open tabs. Scroll up selects the previous tab; scroll down selects the next tab.
Wraps around at both ends.

**Pref**: `tab.select_on_mouse_wheel` (bool)  
**Default**: `true` on Windows, `false` on macOS (Magic Mouse avoidance)

**Implementation**:

```
ui::MouseWheelEvent (views::View::OnMouseWheel)
  └─► TabStrip::OnMouseWheel()          tab_strip.cc (patch)
        TabService::IsSelectOnMouseWheel()
        browser->tab_strip_model()->SelectTabAt(next)
```

`next` is computed as `(current ± 1 + count) % count` so the selection wraps.
Single-tab windows are skipped early.

---

### Double-Click to Close Tab

Double-clicking a tab's body (not the close button) closes that tab.
No-ops on the last tab if keep-last-tab is also active.

**Pref**: `tab.close_on_double_click` (bool)  
**Default**: `true`

**Implementation**: Already present in `Tab::OnMouseReleased` (`tab.cc`).
Fires when `event.GetClickCount() == 2` on a left-button release that hits the
tab body. Delegates to `controller_->CloseTab(this, CloseTabSource::kFromMouse)`.

---

### Keep Last Tab

Controls what happens when the user attempts to close the final tab in a window.

**Pref**: `tab.last_close_behavior` (int, `TabService::Behavior` enum)

| Value | Enum constant | Behaviour |
|---|---|---|
| `0` | `CLOSE_ANYWAY` | Standard Chromium behaviour — closes tab and window |
| `1` | `CLOSE_WITH_NEW_TAB` | Opens a blank NTP first, then closes the old tab — window stays open |
| `2` | `KEEP` | Close is silently ignored — tab and window remain |

**Default**: `1` (`CLOSE_WITH_NEW_TAB`)

**Implementation**:

```
Tab close button / Ctrl+W / middle-click
  └─► TabStripModel::CloseWebContentsAt()     tab_strip_model.cc (patch)
        count() == 1 guard
        TabService::GetLastCloseBehavior()
          CLOSE_WITH_NEW_TAB → delegate_->AddTabAt(GURL(), -1, true)
                               then falls through to CloseTabs()
          KEEP               → return (no-op)
          CLOSE_ANYWAY       → falls through to CloseTabs()
```

The NTP is appended at index `-1` (end) with `foreground=true` so it becomes
active before the old tab is removed, preventing a window-close signal.

---

## File map

| File | Change |
|---|---|
| `chrome/browser/ui/tabs/tab_menu_model.cc` (patch) | Adds 4 menu items inside `#if BUILDFLAG(CUSTOM_BROWSER)` after `CommandDuplicate` |
| `chrome/browser/ui/tabs/tab_strip_model.h` (patch) | Adds `CommandCloseTabsToLeft`, `CommandCopyAllURLs`, `CommandCloneTabToNewWindow`, `CommandCloneTabToIncognito` to the `ContextMenuCommand` enum |
| `chrome/browser/ui/tabs/tab_strip_model.cc` (patch) | `IsContextMenuCommandEnabled`, `ExecuteContextMenuCommand`, and `GetIndicesClosedByCommand` cases for all new commands; `CloseWebContentsAt` keep-last-tab guard |
| `chrome/browser/ui/tabs/tab_strip_model_delegate.h` (patch) | Adds `virtual void CopyAllURLs() = 0`, `CloneTabToNewWindow(WebContents*)`, `CloneTabToIncognito(WebContents*)` to the delegate interface; also adds the required BUILDFLAG includes (`build/buildflag.h`, `custom/buildflags/custom_browser_buildflags.h`) |
| `chrome/browser/ui/views/tabs/tab_strip.h` (patch) | Adds `OnMouseWheel` override declaration, `GetProfile()`/`SetProfile()`, `profile_` member |
| `chrome/browser/ui/views/tabs/tab_strip.cc` (patch) | `TabStrip::OnMouseWheel` implementation; unconditional `TabService` includes |
| `custom/browser/tab/tab_service.cc` | `IsSelectOnMouseWheel()` moved outside `ENABLE_VERTICAL_TABS` guard; defaults updated for `kTabLastCloseBehavior` and `kTabCloseOnDoubleClick` |

---

## Related docs

- [security-privacy-features.md](security-privacy-features.md) — Force Incognito (related to Clone to Incognito)
- [cyberfox-features.md](cyberfox-features.md) — origin analysis (feature 1)
