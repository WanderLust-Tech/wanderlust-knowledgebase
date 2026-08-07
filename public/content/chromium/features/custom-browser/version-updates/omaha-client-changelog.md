# Omaha Update Client — Changelog

`custom-omaha-client` didn't track its own release version until now — see
[Omaha Update Client](omaha-update-client) for the tool's overall
architecture. Everything before `1.0.0.0` is grouped as pre-versioned
history rather than listed per-commit, since no version constant existed
to hang entries off of.

## Pre-versioned history

- **Install wizard**: the `--install-ui` first-run experience was rebuilt
  from a single static progress dialog into a three-screen wizard
  (Welcome → Eula → Progress) — install-location picker, gated
  Terms-of-Service consent, and a full-width bottom progress bar with an
  auto-cycling GDI+ image carousel or (behind a separate, off-by-default
  build flag) a looping WebView2 video. See
  [Omaha Update Client](omaha-update-client) for the details and known
  gaps (the install-path picker is currently cosmetic only).

## Versioned releases

### 1.1.0.0 — 2026-08-07

Adds staged-rollout / A-B testing support, and a stable per-install
identity to make it work.

- **Persisted install ID** (`src/client_identity.h/.cc`): a stable GUID,
  generated once on first run and cached in a small state file
  (`%LOCALAPPDATA%\<app_name>\update_client_state.json` on Windows,
  `~/.config/<app_name>/update_client_state.json` elsewhere) — unlike the
  Omaha `sessionId` (regenerated every check), this stays the same across
  repeated update checks. Sent as `installId` in the update-check request
  (`update_request.h/.cc`). UUID generation was factored out of
  `OmahaClient::MakeSessionId()` into a shared `src/uuid.h/.cc` so both
  call sites use the same code.
- **Explicit fresh-install signal**: `--version`'s default changed from
  `"1.0.0.0"` to `"0.0.0.0"` (matching `Version`'s own default-constructed
  value) — `wanderlust-api` now treats that sentinel as "brand-new install,
  nothing to compare against" and always returns the selected release
  rather than running a version comparison. `win_service.cc`'s matching
  hardcoded default got the same fix.
- **Server-side rollout/A-B engine** (`wanderlust-api`): `BrowserReleases`
  gained a `RolloutWeight` (0-100) and `ExperimentName` per release, so
  multiple active releases can target the same appId/platform/arch
  simultaneously. A new `ReleaseRolloutSelector` deterministically buckets
  each install (via `installId`, not `sessionId`) into exactly one
  candidate using a weighted waterfall — same install always gets the same
  variant. A single release at the default weight of 100 covers every
  bucket, so this is fully backward compatible. See
  `wanderlust-api/UPDATE_PROTOCOL.md` for the full algorithm.
- **`custom-browser`'s `UpdateManager` gets the same treatment**: since it
  has its own separate, in-process Omaha implementation (it does not call
  this CLI tool — see [Omaha Update Client](omaha-update-client)), it also
  needed a persisted install ID to participate in the same rollout/A-B
  rules for existing installs, not just fresh ones. Added a new Local
  State pref (`custom.auto_update.install_id`, generated via
  `base::Uuid::GenerateRandomV4()` on first read) and threaded it into the
  same `installId` request field.

### 1.0.0.0 — 2026-08-06

Introduces this changelog and the tool's first formal version.

- **New `omaha_client_version` GN arg** (`src/BUILD.gn`, default
  `"1.0.0.0"`), threaded through `config.h` as `Config::client_version` —
  the same `declare_args()` → `defines` → `#ifndef`-guarded-default pattern
  already used for `omaha_server_url`/`omaha_app_id`/`omaha_app_name`.
  Exposed via a new `omaha_client --client-version` command.
- **Reported to the update server**: every Omaha update-check request now
  carries `clientVersion` (top-level, alongside `protocol`/`sessionId`/
  `isMachine`) so `wanderlust-api` can see which updater builds are out in
  the wild. `wanderlust-api`'s `OmahaController` logs it (`ILogger`
  injected for the first time in that controller) — see
  `wanderlust-api/UPDATE_PROTOCOL.md` for the updated request schema. This
  is purely additive: older clients that don't send `clientVersion` are
  unaffected, and the field isn't used in any update-decision logic, only
  logged for observability.
