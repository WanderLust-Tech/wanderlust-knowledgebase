# Cloud bookmark sync — configuring your own OAuth credentials

How this fork's Google Drive / Microsoft OneDrive cloud bookmark sync
gets its OAuth client IDs, what happens if they're missing, and how a
different deployer/fork configures their own.

## Two independent OAuth mechanisms — don't confuse them

This fork has **two entirely separate** "is Google/Microsoft sign-in
configured" knobs. They are not related and fixing one does nothing for
the other:

1. **Cloud bookmark sync (Drive/OneDrive)** — this fork's own feature,
   under `custom/browser/sync/` + `custom/browser/signin/`
   (`GoogleAuthProvider`, `MicrosoftAuthProvider`). Gated on
   `custom_google_oauth_client_id`/`custom_microsoft_oauth_client_id`
   (below). This is what this doc covers.
2. **Real Google Dice sign-in** ("Turn on sync" in Settings → People) —
   vanilla Chromium's own sign-in flow. Gated on a completely different,
   vanilla mechanism: `google_apis::HasOAuthClientConfigured()`
   (`google_apis/google_api_keys.cc`), which reads real
   `GOOGLE_CLIENT_ID_MAIN`-style Chrome-branding keys. This fork never
   sets those, so this path is always inert by design
   (`CustomSettingsHandler::HandleStartSignIn` checks
   `HasOAuthClientConfigured()` and silently no-ops if false, specifically
   to avoid an upstream `NOTREACHED()` inside
   `SigninViewController::ShowDiceSigninTab`). This is a separate,
   intentional gap, not a bug — see `de-googling.md`.

## Where the cloud-sync client IDs actually come from

`src/custom/custom_browser_config.gni`:
```gn
# OAuth2 client IDs — override these with your registered app credentials.
# Microsoft: register at https://portal.azure.com (multi-tenant, native/desktop)
# Google:    register at https://console.cloud.google.com
custom_microsoft_oauth_client_id = ""
custom_google_oauth_client_id = ""
```

The `declare_args()` default is an empty string, but **a normal
`npm run build` never actually uses that default** — `src/custom/package.json`'s
`config` block overrides it:
```json
"config": {
  "custom_microsoft_oauth_client_id": "2ff9b28b-434d-4aee-bd27-723d7da972ef",
  "custom_google_oauth_client_id": "671527558035-969tnuqgrbci44h1ru6j83oga6jv8nfv.apps.googleusercontent.com"
}
```
`build/commands/lib/config.py`'s `get_npm_config()` reads this
`package.json` config block (falling back to environment variables first)
and passes the resolved value straight through to `gn gen --args`, which
overrides the `.gni` default. **These are the WanderLust project's own
real, registered app credentials** — a standard build already has working
cloud sync, with no configuration needed.

The `.gni` empty-string default only matters if:
- Someone runs a raw `gn gen` bypassing the `npm run build`/`config.py`
  pipeline entirely, or
- A downstream fork blanks these two keys out of their own `package.json`
  (exactly what the `.gni` comment invites forks to do — "override these
  with **your** registered app credentials").

## What happens with an empty client ID

Before 2026-07-31, nothing — `GoogleAuthProvider::StartSignIn()` /
`MicrosoftAuthProvider::StartSignIn()` had no guard at all. Clicking
"Sign in with Google/Microsoft" would open a new tab and navigate straight
to the real authorize endpoint with `client_id=` (empty). The OAuth
provider's own server would reject it — Google returns a plain
"Error 400: invalid_client" page, Microsoft an AADSTS error page — with
**no indication from the browser itself** that anything was misconfigured
on this end. The flow would just stall in `SyncState::kSigningIn`
indefinitely.

**Fixed 2026-07-31:** both providers now check for an empty client ID at
the top of `StartSignIn()` and fail immediately via the existing
`Observer::OnSignInFailed(error)` callback (the same path already used
for network errors and invalid token responses) — no tab opens, no
foreign error page, and the browser's own sync-state machinery
(`CloudSyncManager::SetSyncState(SyncState::kError)`) reflects the
failure the same way it already does for a real network error. The
message directs the user/deployer to this doc.

## Registering your own credentials (for a downstream fork/deployer)

Both providers use OAuth2 **PKCE with no client secret**
(`code_challenge_method=S256`, no `client_secret` parameter anywhere in
either `.cc` file) — these are "public/native app" client IDs per
[RFC 8252](https://www.rfc-editor.org/rfc/rfc8252), the same category
Google's and Microsoft's own tooling (`gcloud`, `git-credential-manager`,
etc.) ships in the open. That's a materially different risk category from
a client *secret* or API key — it doesn't remove the need to register
your own app if you're shipping your own fork, but it's not the same kind
of "leaked secret" incident as committing a real secret would be.

**Google:**
1. Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2. Configure the OAuth consent screen (External or Internal, as appropriate).
3. Create OAuth client ID credentials, type **Desktop app**.
4. Add scope `https://www.googleapis.com/auth/drive.appdata` (plus `openid email profile`).
5. Redirect URI: `http://localhost` (matches `kRedirectUri` in `google_auth_provider.cc`).
6. Put the resulting client ID in `custom/package.json`'s
   `config.custom_google_oauth_client_id`.

**Microsoft:**
1. Register an app at [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App registrations.
2. Supported account types: multi-tenant (matches the `/common/` authorize/token endpoints in `microsoft_auth_provider.cc`).
3. Platform: **Mobile and desktop applications**, redirect URI `http://localhost`.
4. API permissions: `User.Read`, `Files.ReadWrite.AppFolder`, `offline_access` (delegated).
5. Put the resulting Application (client) ID in `custom/package.json`'s
   `config.custom_microsoft_oauth_client_id`.

No app secret is needed or used for either provider — only the client ID.

## Relevant files

- `custom/custom_browser_config.gni` — declare_args defaults (empty)
- `custom/package.json` — the real values actually used by a normal build
- `custom/buildflags/BUILD.gn` — emits `GOOGLE_OAUTH_CLIENT_ID`/`MICROSOFT_OAUTH_CLIENT_ID` buildflags
- `custom/browser/signin/google_auth_provider.{h,cc}` — Google PKCE flow + empty-ID guard
- `custom/browser/signin/microsoft_auth_provider.{h,cc}` — Microsoft PKCE flow + empty-ID guard
- `custom/browser/sync/cloud_sync_manager.{h,cc}` — bridges provider `Observer` callbacks to `SyncState`
- `custom/components/custom_settings/components/AccountPage.tsx` — the Settings UI surface (no client-ID input field exists here — that's a build-time/deployer decision, not a runtime user setting)
- `CLOUD_SYNC_IMPLEMENTATION.md` (repo root, not this knowledgebase) — the original internal design/progress log for this feature, including the real app-registration history for the IDs currently in `package.json`
