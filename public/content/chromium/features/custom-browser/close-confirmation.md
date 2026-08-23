# Close & Quit Confirmation

Two related, independently-toggled confirmation prompts, grouped under
one "Closing" section in Settings → Tabs:

- **Confirm before closing a window with multiple tabs** — pre-existing
  mechanism (`Browser::CanCloseInClosingTabs`), but had **no Settings UI**
  until v1.8.51 — exposed for the first time alongside the new toggle below.
- **Confirm before quitting the browser** — brand new in v1.8.51. Applies
  to the app menu's Exit command and to closing the last open window.

Both default to **off**.

---

## Where to find it

Settings → Tabs → "Closing" section:

- "Confirm before closing a window with multiple tabs" (pref
  `tab.confirm_closing_tabs`)
- "Confirm before quitting the browser" (pref
  `custom.confirm_quit_browser`)

---

## Confirm before quitting

`Browser::CanCloseAsQuit()` is checked in `HandleBeforeClose()`, **before**
the tab-close check — so the two dialogs never stack for the same close
action; quitting always shows at most one prompt.

```cpp
bool Browser::CanCloseAsQuit() {
  if (!ShouldStartShutdown())
    return true;  // Other windows remain open; closing this one won't quit.

  if (close_quit_confirmation_state_ != NOT_PROMPTED)
    return close_quit_confirmation_state_ != WAITING_FOR_RESPONSE;

  if (profile_->GetOriginalProfile()->GetPrefs()->GetBoolean(
          prefs::kConfirmQuitBrowser)) {
    close_quit_confirmation_state_ = WAITING_FOR_RESPONSE;
    window_->ConfirmBrowserCloseAsQuit(/* ... */);
    return false;
  }
  return true;
}
```

`ShouldStartShutdown()` is the existing predicate for "is this the last
window, i.e. would closing it actually quit the app" — reused as-is, not
reimplemented. Closing one window out of several never prompts, since
the app isn't quitting.

The app menu's **Exit** command goes through a separate but parallel
path, `Browser::ConfirmAndExit()` → `ConfirmAndExitResponse()`, since
Exit doesn't go through the normal window-close flow at all.

### The dialog

`ConfirmQuitDialog` (`custom/browser/tab/confirm_quit_dialog.{h,cc}`) —
a `views::DialogDelegateView` sibling of the existing tab-close
confirmation dialog, same shape (a `views::MessageBoxView` with a "Do
not ask next time" checkbox, reusing that dialog's own
`IDS_OPTIONS_TAB_CONFIRM_DO_NOT_ASK_NEXT` string rather than a new one).

| | |
|---|---|
| Title | "Quit WanderLust" |
| Message | "This will close all windows and tabs. Are you sure you want to quit?" |
| Checkbox | "Do not ask next time" — checking it and confirming sets `custom.confirm_quit_browser` to `false` |

---

## Confirm before closing multiple tabs

`Browser::CanCloseInClosingTabs()` — gated by
`BUILDFLAG(ENABLE_TAB_SHAPES)` (an existing, unrelated-sounding coupling
carried over from wherever this check originally landed), and only
triggers when the window has 2+ tabs (`tab_strip_model_->count() < 2`
short-circuits to allow the close). Reads
`TabService::IsConfirmClosingTabs()` rather than the pref directly.

This mechanism already existed before v1.8.51; what's new is that
`tab.confirm_closing_tabs` is now actually reachable from Settings —
previously there was no UI path to turn it on at all.

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/tab/confirm_quit_dialog.{h,cc}` | The quit-confirmation dialog |
| `custom/common/custom_pref_names.h` | `kConfirmQuitBrowser = "custom.confirm_quit_browser"` |
| `custom/browser/prefs/custom_prefs.cc` | Registers the pref, default `false` |
| `custom/components/custom_settings/components/TabsPage.tsx` | Both toggles, under a new "Closing" section |
| `chrome/browser/ui/browser.{h,cc}` (patched) | `CanCloseAsQuit()`, `ConfirmAndExit()`, and the pre-existing `CanCloseInClosingTabs()` |
| `chrome/browser/ui/browser_command_controller.cc` (patched) | Routes the Exit command through `ConfirmAndExit()` |

---

## Known limitations

- The "confirm closing multiple tabs" check is gated by
  `BUILDFLAG(ENABLE_TAB_SHAPES)` — if that flag is ever disabled, the
  Settings toggle would still show but have no effect. Not currently an
  issue since Tab Shapes is enabled by default.
- No per-window override — both prefs are profile-wide.
