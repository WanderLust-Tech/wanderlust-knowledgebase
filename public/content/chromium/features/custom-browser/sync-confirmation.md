# Sync Confirmation (chrome://sync-confirmation)

A real sign-in confirmation dialog — shows the actual signed-in
account's name/email and a real sync-benefits list, not placeholder
content. Registered under vanilla Chromium's own host name
(`sync-confirmation`).

---

## Architecture

**Controller/handler:** `CustomSyncConfirmationUI` /
`CustomSyncConfirmationHandler`
(`custom/browser/ui/webui/sync_confirmation/custom_sync_confirmation_{ui,handler}.{h,cc}`).

| Message | Purpose |
|---|---|
| `customGetSyncConfirmationState` | Real `IdentityManager` primary-account email/display name, `SyncServiceFactory::IsSyncAllowed`, and a benefits list with per-`UserSelectableType` `managedByPolicy` flags |
| `customSyncConfirm` | `"confirm"` or `"settings"` → `SyncUserSettings::SetInitialSyncFeatureSetupComplete` |
| `customSyncUndo` | `IdentityManager`'s primary-account mutator → `ClearPrimaryAccount(kAbortSignin)` |

Both the confirm and undo paths fire `customSyncConfirmationClosed`
afterward.

The three buttons map directly: **"Yes, I'm in"** → `customSyncConfirm("confirm")`,
**"Settings"** → `customSyncConfirm("settings")` (same confirm, but
routes to sync settings afterward instead of just closing), **"Cancel"**
→ `customSyncUndo` (aborts sign-in entirely).

---

## Reachability: gated on OAuth being configured

This dialog is only reached organically via a real Google/DICE sign-in
flow. `CustomSettingsHandler::HandleStartSignIn`
(`custom_settings_handler.cc`, the code path that would initiate that
flow) checks `google_apis::HasOAuthClientConfigured()` and **silently
bails if false**. This fork ships without bundled OAuth client
credentials by default, so in a stock build the real sign-in flow — and
therefore this confirmation dialog — is inert. It only becomes reachable
in a build that supplies real OAuth keys.

---

## Known limitations

- Inert in any build without configured OAuth credentials (see above) —
  can't be exercised end-to-end in a stock checkout.
- No standalone way to preview this dialog outside the real sign-in flow.
