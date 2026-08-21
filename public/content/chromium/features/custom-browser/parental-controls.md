# Parental Controls PIN Lock

PIN-gates two sensitive actions so a shared device can't have its history
wiped or its exit-time data-clearing behavior changed without the PIN:
deleting browsing history (both `chrome://history` and the sidebar
history panel) and the "Clear browsing data on exit" toggle group in
Settings. Added v1.8.42 (2026-08-20).

---

## Where to find it

Settings → a new Parental Controls sub-page (`ParentalControlsPage.tsx`)
sets up and manages the PIN. Once enabled, the gate is enforced
transparently wherever a covered action is attempted — there's no
separate "unlock" screen to visit first; the PIN prompt appears at the
point of the blocked action.

---

## Unlock model: sliding idle window, not a session

`ParentalControlsService::IsCurrentlyUnlocked()` is the only thing that
decides whether a gated action proceeds. There's no persisted "unlocked"
flag — unlock state is purely an in-memory `base::TimeTicks` expiry, so
it's always locked again on a fresh browser launch. Each successful
check extends the window by another 10 minutes (`kIdleTimeout`), which
gives idle-timeout behavior without a background timer: the window only
extends when a gated feature is actually being used.

```cpp
bool ParentalControlsService::IsCurrentlyUnlocked() {
  if (base::TimeTicks::Now() >= unlock_expiry_) return false;
  unlock_expiry_ = base::TimeTicks::Now() + kIdleTimeout;  // extend
  return true;
}
```

---

## PIN storage and verification

The PIN is never stored recoverably — only a salted SHA-256 hash
(`custom.parental_controls.pin_hash` / `custom.parental_controls.pin_salt`
prefs). `VerifyAndUnlock()` re-derives the hash from the entered PIN and
the stored salt and compares. Changing the PIN (`ChangePin`) or turning
the feature off (`Disable`) both require the *current* PIN — otherwise
someone locked out could just set a fresh PIN to bypass the gate
entirely.

### "Forgot PIN?" — device reauth, not a recovery question

`CustomParentalControlsHandler::HandleRequestDeviceReauthReset` uses the
same `device_reauth::DeviceAuthenticator` pattern already used for
revealing saved passwords (see
[Password Manager: view/copy, add/edit, and checkup](password-manager-view-edit-checkup.md))
— a real Windows Hello (or platform-equivalent) OS prompt. On success,
`ParentalControlsService::ResetPinAfterDeviceAuth()` sets a new PIN
without needing the old one. There's no email/security-question fallback
at all — device auth is the only recovery path.

---

## What's actually gated

| Surface | Handler | Gate point |
|---|---|---|
| `chrome://history` delete | `CustomHistoryHandler::HandleRemoveHistoryEntries` | Checked before calling into `HistoryService` |
| Sidebar history panel delete | `SidebarDOMHandler::RemoveHistoryEntry` | Same check, same shape |
| Settings → "Clear browsing data on exit" | `OthersPage.tsx`'s controls, backed by `CustomParentalControlsHandler` | Wraps the existing toggle group |

Each gate is the identical pattern: if Parental Controls is enabled and
`IsCurrentlyUnlocked()` is false, the action is dropped and a
`parentalControlsLocked` WebUI listener event fires instead (the
frontend responds by showing a PIN prompt) — the underlying
delete/toggle logic itself is completely unmodified.

---

## Messages

| Message | Purpose |
|---|---|
| `parentalControlsGetState` | Current enabled/unlocked state |
| `parentalControlsSetPin` | First-time setup — enables the feature and unlocks immediately |
| `parentalControlsVerifyPin` | Unlock with an existing PIN |
| `parentalControlsChangePin` | Requires current PIN |
| `parentalControlsDisable` | Requires current PIN |
| `parentalControlsLockNow` | Explicit re-lock (e.g. a "Lock now" button) |
| `parentalControlsRequestDeviceReauthReset` | "Forgot PIN?" — Windows Hello reset |

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/parental_controls/parental_controls_service.{h,cc}` | `KeyedService` — PIN hash/salt, unlock window |
| `custom/browser/parental_controls/parental_controls_service_factory.{h,cc}` | Standard `BrowserContextKeyedServiceFactory` |
| `custom/browser/ui/webui/parental_controls/custom_parental_controls_handler.{h,cc}` | WebUI message handler + device-reauth reset flow |
| `custom/components/custom_settings/components/ParentalControlsPage.tsx` | Setup/management UI |
| `custom/browser/ui/webui/history/custom_history_handler.cc` | Gate check before history deletion |
| `custom/browser/ui/webui/sidebar/sidebar_dom_handler.cc` | Gate check before sidebar-panel history deletion |

---

## Known limitations

- Single global PIN, not per-user or per-child-profile.
- Only two surfaces are gated (history erasure, clear-on-exit toggle) —
  it does not gate site access, incognito mode, or any content-filtering
  behavior; this is a data-protection feature, not a content-control
  suite despite the name.
- The 10-minute window is a fixed constant (`kIdleTimeout`), not
  user-configurable.
