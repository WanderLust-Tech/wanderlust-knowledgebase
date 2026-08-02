# Password manager: view/copy, add/edit, and checkup (2026-07-27)

Follow-up to [`password-manager-import-export.md`](./password-manager-import-export.md),
closing out the rest of the Settings → Passwords completion request: viewing/
copying a password with OS reauth, adding/editing credentials, and a password
checkup (local weak/reused checks plus real network-based leaked-password
checking).

## View / copy password

`chrome.send('customRequestPasswordValue', [signonRealm, username])` (well,
`cr.sendWithPromise`, per below) → `{success, password?, error?}`.

Gated behind OS reauth like export, but with a real (non-zero) validity
window instead of export's always-reauth policy. Both flows now share one
`RequestDeviceAuth(message, source, validity_period, histogram, callback)`
helper in `custom_settings_handler.cc` (export's inline reauth logic was
refactored into this helper rather than duplicated) — it creates a fresh
`device_reauth::DeviceAuthenticator` per call, same as before, but the
`validity_period` argument is now real: export still passes `base::Seconds(0)`
(always re-prompt — it's the highest-risk action), while viewing a password
passes `password_manager::constants::kPasswordManagerAuthValidity` (5
minutes). This works because `DeviceAuthenticatorCommon::NeedsToAuthenticate()`
checks a timestamp on a **per-profile** `DeviceAuthenticatorProxy` `KeyedService`,
not on the `DeviceAuthenticator` instance itself — so creating a fresh
authenticator object per reveal (matching upstream's own
`PasswordsPrivateDelegateImpl::AuthenticateUser` pattern exactly) still gets
the "don't re-prompt within N minutes" behavior for free, without needing to
hold a long-lived authenticator instance across calls.

`HandleRequestPasswordValue` looks the credential up in the existing
`last_password_forms_` cache (same one `HandleRemovePassword` already used),
then re-checks it still exists *after* the async reauth completes (the
credential could be removed while the OS prompt is up).

Frontend: `PasswordsPage.tsx` reveals the password inline (monospace, in a
`<div>` under the row) with a Show/Hide toggle, plus a separate Copy button
using `navigator.clipboard.writeText()` (fetches the value via the same
reauth flow if not already revealed, without necessarily displaying it).

## Add / edit

`chrome.send('customSavePassword', [{origin, username, password,
originalSignonRealm?, originalUsername?}])` → `customPasswordSaveResult`
(`{success, error?}`) + `customPasswordsChanged`.

Mirrors the existing `HandleSaveAddress`/`HandleSavePaymentMethod` pattern in
the same file (guid-based edit detection there; here, since `PasswordForm`
has no guid, "edit" is detected by a non-empty `originalSignonRealm`, and the
existing form is looked up in `last_password_forms_` by
`originalSignonRealm`+`originalUsername` — same lookup key
`HandleRemovePassword` already uses).

`PasswordStoreInterface::UpdateLogin()` matches the row to update by the
form's own primary-key fields (signon_realm, url, username_element,
username_value, password_element) — so if the username (or site, which
changes signon_realm) changed, the old row can't be found by the *new*
form's key, and `UpdateLoginWithPrimaryKey(new_form, old_form)` must be used
instead, passing the *old* form's key fields separately. `HandleSavePassword`
picks between the two based on whether `username_value`/`signon_realm`
changed vs. the looked-up `existing` form.

**Frontend design note:** the Edit button doesn't open a blank form — it
first calls the same `requestPasswordValue()` reauth flow used for
View/Copy, and only opens the edit modal once that resolves with the real
current password. This means editing requires OS reauth too (implicitly,
via needing to pre-fill the password field), matching how real password
managers treat "edit" as sensitive as "view" — you can't edit a password you
can't see.

**Known limitation, deliberately not implemented:** no duplicate-detection
on add (adding a credential for a site+username that already exists just
creates a second entry, it doesn't merge or warn) — matches the same
scope-cut already documented for CSV import.

## Checkup: local (weak / reused) — no network

`cr.sendWithPromise('customGetPasswordCheckup')` → `{totalChecked, weak: [...],
reused: [...]}`.

Uses `password_manager::BulkWeakCheck()` (zxcvbn-based scoring,
`components/password_manager/core/browser/ui/weak_check_utility.h`) and
`password_manager::BulkReuseCheck()` (`.../ui/reuse_check_utility.h`) — both
pure, synchronous, local-only functions with no network or sign-in
dependency. `BulkReuseCheck` takes an `AffiliatedGroup` list as a second
argument (used to avoid flagging the same password across affiliated
domains, e.g. `apple.com`/`apple.de`, as "reused") — this fork passes an
**empty** group list, a deliberate simplification: without affiliation
grouping, a password shared across genuinely affiliated domains would be
flagged as reused when upstream wouldn't flag it. A minor false-positive
edge case, not incorrect for the common case (actual credential reuse across
unrelated sites).

## Checkup: network leak check (BulkLeakCheckService)

`chrome.send('customStartLeakCheck')` / `chrome.send('customStopLeakCheck')`,
progress streamed via `customLeakCheckProgress`
(`{state, pendingCount, leaked: [...]}`) as each credential finishes.

This is the **real** upstream plumbing — `SavedPasswordsPresenter` +
`BulkLeakCheckServiceAdapter` (`components/password_manager/core/browser/ui/`)
+ `BulkLeakCheckServiceInterface::Observer`
(`components/password_manager/core/browser/leak_detection/`) — wired up
exactly as `chrome://password-manager`'s own settings page would use it,
not a simplified stand-in:

- `EnsureLeakCheckAdapter()` (lazy, first-call-only) builds a
  `SavedPasswordsPresenter(AffiliationServiceFactory::GetForProfile(profile),
  profile_store, account_store)`, then a
  `BulkLeakCheckServiceAdapter(presenter, BulkLeakCheckServiceFactory::
  GetForProfile(profile), profile->GetPrefs())`, and registers
  `CustomSettingsHandler` as a `BulkLeakCheckServiceInterface::Observer` via
  a `base::ScopedObservation`.
- `HandleStartLeakCheck` calls `StartBulkLeakCheck(LeakDetectionInitiator::
  kDesktopProactivePasswordCheckup)` — but only once `SavedPasswordsPresenter::
  Init()`'s first store fetch has actually completed. `StartBulkLeakCheck`
  reads from the presenter's in-memory credential cache, which is empty
  until `Init()`'s async callback fires; an early version of this code
  called `Init()` with no callback and started the check immediately after,
  which would silently check zero credentials on a cold first click. Fixed
  by tracking whether the presenter was just created and, if so, deferring
  the actual `StartBulkLeakCheck` call to `Init()`'s completion callback
  (`OnSavedPasswordsPresenterReady`) instead of racing it.
- `OnStateChanged`/`OnCredentialDone` (the observer overrides) map the
  service's `State` enum to a plain string and, for leaked credentials,
  match the `LeakCheckCredential`'s username+password back against
  `SavedPasswordsPresenter::GetSavedPasswords()` to report which saved
  site(s) it corresponds to (a leaked credential is just a username+password
  pair — it can match more than one saved site if the password was reused).

**This will not actually find leaks in this build today.** Real leak
checking requires the profile to be signed in to a real Google account to
mint an OAuth access token for the request. This fork's Google sign-in flow
is real (a genuine DICE/Gaia flow via `signin_ui_util::
EnableSyncFromSingleAccountPromo`) but currently inert:
`google_apis::HasOAuthClientConfigured()` returns false because no real
`google_default_client_id`/`secret`/API key is set anywhere in this fork's
build config (a side effect of de-googling — see
[`de-googling.md`](./de-googling.md)) — so `HandleStartSignIn` silently
no-ops, and every leak-check run is expected to land in `State::kSignedOut`
or `State::kTokenRequestFailure` rather than ever reaching `kIdle` with real
results.

This was a deliberate scope decision: rather than build a fake/simplified
stand-in, the real API surface is wired up correctly and is ready to work
the moment real Google OAuth credentials are registered (a Google Cloud
Console project + OAuth consent screen + API key — account/credential setup
outside of what's doable in code) and set via
`google_default_client_id`/`google_default_client_secret`/`google_api_key`
build args. Until then, the UI clearly labels the signed-out/token-error
states rather than pretending the feature works.

## GN / build changes

- `custom/browser/ui/webui/BUILD.gn` — added
  `//components/password_manager/core/browser/leak_detection` (leak-detection
  headers are `#include`d directly in `custom_settings_handler.cc`) and
  swapped the narrower `//components/password_manager/core/browser/
  ui:credential_ui_entry` dep for the full `//components/password_manager/
  core/browser/ui` target (needed for `weak_check_utility.cc`,
  `reuse_check_utility.cc`, `saved_passwords_presenter.cc`,
  `bulk_leak_check_service_adapter.cc`).
- No new deps needed for `AffiliationServiceFactory`,
  `AccountPasswordStoreFactory`, or `BulkLeakCheckServiceFactory` — all three
  are already reachable transitively (the first lives directly in the giant
  `//chrome/browser:browser` target like several other factories this
  codebase already relies on this way; the latter two are public headers of
  `//chrome/browser/password_manager/factories`, already pulled in via the
  existing `//chrome/browser/password_manager` dep).
- Verified with both a direct target build (`custom/browser/ui/webui:ui`,
  catches compile errors) and a full `chrome` target build (catches
  link-time errors — relevant here since `:ui` is a source_set, and some of
  these factory classes only produce a link error rather than a compile
  error on platforms lacking an implementation). Both passed clean, no
  patch regeneration needed since no upstream files were touched.

## Files touched

- `custom/browser/ui/webui/settings/custom_settings_handler.h/.cc` — new
  methods (`RequestDeviceAuth` helper + 12 new handler/callback methods),
  five new message registrations, a `BulkLeakCheckServiceInterface::Observer`
  base class addition, and new members (`password_checkup_fetch_pending_`,
  `saved_passwords_presenter_`, `leak_check_adapter_`,
  `leak_check_observation_`, `leaked_credentials_found_`).
- `custom_settings/components/PasswordsPage.tsx` — inline reveal/copy
  buttons per row, an Add/Edit modal, and a "Password checkup" section with
  separate local-checkup and network-leak-check controls (each with its own
  independent progress/result display, since one is instant and synchronous
  while the other streams progress over time).
