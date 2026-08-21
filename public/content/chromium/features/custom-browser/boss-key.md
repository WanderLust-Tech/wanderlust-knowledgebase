# Boss Key

A global panic-hide hotkey — instantly hides every matching browser
window, restorable with the same key combination. Genuinely implemented
end to end, including conflict-avoidance across multiple profiles/windows
sharing the same shortcut.

---

## Where to find it

Settings → Others → enable the Boss Key checkbox, which reveals a
"configure shortcut" row (default `Ctrl+F9`). Click into the field and
press a new combination to rebind it; Escape cancels an in-progress
capture.

---

## Architecture

**Service:** `BossKeyService` (per-profile `KeyedService`),
`custom/browser/boss_key/boss_key_service.{h,cc}` +
`boss_key_service_factory.{h,cc}` + `boss_key_observer.{h,cc}`.

Registers a real global accelerator via
`ui::GlobalAcceleratorListener::GetInstance()->RegisterAccelerator()` —
Chromium's cross-platform global-hotkey abstraction. On Windows this is
backed by `RegisterHotKey`/`WM_HOTKEY`
(`ui/base/accelerators/global_accelerator_listener/global_accelerator_listener_win.cc`).
No dedicated GN build flag — always compiled in.

### Prefs

| Pref | Type | Default |
|---|---|---|
| `boss_key.enabled` (`kBossKeyEnabled`) | bool | `false` |
| `boss_key.command_text` (`kBossKeyCommandText`) | string | `"Ctrl+F9"` |

### Hide/show

`BossKeyObserver::OnKeyPressed` toggles a `STATE_SHOW`/`STATE_HIDE`
state machine:

- **Hide:** calls `BrowserFrame::Hide()` on every browser window
  matching the profile/accelerator, and acquires a `ScopedKeepAlive`
  (origin `BOSS_KEY`) so the browser process doesn't exit just because
  every window is hidden.
- **Show:** restores via `native_widget_private()->Show(state, ...)`.

### Conflict avoidance across profiles/windows

`BossKeyService::Unregister()` walks `BrowserList::GetInstance()`
looking for another enabled `BossKeyService` (a different profile or
window) using the same accelerator, and re-registers the hotkey on its
behalf if found — so disabling Boss Key in one profile hands the live
registration to another profile that still has it enabled with the same
shortcut, rather than the hotkey just going dead. This is a real,
implemented mechanism, not a documented-but-unbuilt intent.

### Shortcut capture UI

The Settings-side capture field
(`custom/browser/resources/settings/others_page/boss_key_binding_controller.ts`)
captures the keystroke combo entirely client-side and writes it directly
to the `boss_key.command_text` pref. The only `chrome.send` call
involved during capture is `customSetShortcutHandlingSuspended`, which
suspends normal accelerator handling while the field is actively
recording a new combination — there's no boss-key-specific message for
the capture step itself.

---

## Known limitations

- One shortcut per profile — no per-window override.
- No visual/audio feedback on hide/show beyond the window
  appearing/disappearing.
