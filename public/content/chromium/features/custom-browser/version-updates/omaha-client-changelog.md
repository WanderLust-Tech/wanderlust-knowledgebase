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
