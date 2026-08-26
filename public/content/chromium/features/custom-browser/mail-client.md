# Mail Client (IMAP)

A native IMAP4rev1 client, hand-rolled directly on Chromium's network
service rather than a vendored library — libetpan (the usual choice)
has TLS backends that aren't BoringSSL-compatible and needs the same
dedicated-thread bridge libtorrent required, so this builds on
`network::mojom::NetworkContext` instead. Foundation work started
v1.8.56 (2026-08-25); as of v1.8.57 it's still backend-only — there is
no inbox UI yet, only account management in Settings.

Gated by `BUILDFLAG(ENABLE_MAIL_CLIENT)`.

---

## Current status — what actually works today

- **Settings → Mail accounts**: add/remove IMAP accounts. Adding one
  performs a real login against the server (and, if configured,
  selects a mailbox and fetches headers) before the account is ever
  saved — a bad host/port/credentials fails visibly instead of saving
  silently.
- Passwords are OSCrypt-encrypted and base64-stored in the
  `custom.mail.accounts` pref; the plaintext password is never sent to
  the renderer/JS side.
- **Not yet wired to anything user-visible beyond that**: there's no
  inbox, no message list, no way to actually read mail. The FETCH
  response parser (`imap_fetch_response.{cc,h}`), the RFC 5322 header
  parser (`mail_header_parser.{cc,h}`), and the per-profile SQLite
  message store (`MailDatabase`/`MailBackend`) all exist and are
  unit-tested, but `MailService` doesn't call any of them yet — per
  the phase-2 commit message, that wiring is a later phase.

---

## Where to find it

Settings → **Mail accounts** (route `mail-accounts`, listed in the
Settings left-nav). Add an account with host/port/username/password;
the "Add" action blocks on a real server round-trip and surfaces
whatever error the server (or the TCP/TLS layer) returns.

**Pref:** `custom.mail.accounts` — JSON array of accounts (host, port,
username, an OSCrypt-encrypted+base64 password blob). Never holds a
plaintext password.

---

## Architecture

```
MailAccountsPage.tsx (Settings)
   │  customMailGetAccounts / customMailAddAccount / customMailRemoveAccount
   ▼
CustomMailHandler (WebUI message handler)
   │  verifies via MailService::TestConnection() before persisting
   ▼
MailService (per-profile KeyedService)
   │  owns one ImapConnection at a time for TestConnection
   ▼
ImapConnection  (Login → [SelectMailbox → FetchHeaders] → Logout state machine)
   │  transport-agnostic -- unit-tested against a fake ImapTransport
   ▼
MojoImapTransport (real transport)
   │  NetworkContext::CreateTCPConnectedSocket + UpgradeToTLS
   ▼
ImapResponseParser  (incremental byte-stream parser: tagged/untagged
                      responses, {n}-byte literals, now tracks literal
                      byte ranges for structured FETCH parsing)

Storage layer (built, not yet called by MailService):
ImapFetchResponse (UID + raw header block) → MailHeaderParser (RFC 5322
unfolding for Subject/From/Date) → MailDatabase/MailBackend (SQLite,
sql::MetaTable versioning, RefCountedThreadSafe backend on a
sequenced task runner -- mirrors the RSSDatabase/RSSBackend pattern)
```

Account storage (`MailAccountStore`) is intentionally stateless per
call — it reads/writes the `custom.mail.accounts` pref fresh each
time rather than caching, since accounts are only touched when
Settings is open or a connection is being made.

---

## File map

| Path | Purpose |
|---|---|
| `browser/mail/imap_response_parser.{cc,h}` | Incremental IMAP byte-stream parser |
| `browser/mail/imap_command_builder.{cc,h}` | Command tagging/quoting |
| `browser/mail/imap_connection.{cc,h}` | Login/SelectMailbox/FetchHeaders/Logout state machine |
| `browser/mail/imap_transport.h` | Transport-agnostic interface (enables fake-transport unit tests) |
| `browser/mail/mojo_imap_transport.{cc,h}` | Real transport via `NetworkContext` TCP + TLS upgrade |
| `browser/mail/mail_service.{h,cc}` | Per-profile `KeyedService`; currently exposes only `TestConnection()` |
| `browser/mail/mail_service_factory.{h,cc}` | `BrowserContextKeyedServiceFactory` |
| `browser/mail/mail_account_store.{h,cc}` | Encrypted account persistence in the `custom.mail.accounts` pref |
| `browser/mail/imap_fetch_response.{cc,h}` | UID + raw header-block extraction from FETCH responses |
| `browser/mail/mail_header_parser.{cc,h}` | RFC 5322 header unfolding (Subject/From/Date) |
| `browser/mail/mail_database.{h,cc}` | Per-profile SQLite message store |
| `browser/mail/mail_backend.{h,cc}` | `RefCountedThreadSafe` backend on a sequenced task runner |
| `browser/ui/webui/mail/custom_mail_handler.{h,cc}` | WebUI message handler backing the Settings page |
| `components/custom_settings/components/MailAccountsPage.tsx` | The Settings UI |
| `common/custom_pref_names.h` | `kMailAccounts` |
| `common/constants.{h,cc}` | `kMailDatabaseFilename` ("Custom Mail") |

Tests live in a standalone `mail_unittests` target (23 tests as of
v1.8.57), deliberately kept out of the monolithic `unit_tests` binary
for fast iteration.

---

## Known limitations

- No inbox/message-list UI — Settings account management only.
- `MailService`'s only real operation is `TestConnection()`; the
  FETCH/parse/store pipeline exists but isn't invoked from anywhere a
  user can reach.
- Only one `TestConnection` can be in flight at a time per profile — a
  second call while one is pending fails immediately.
- `MailDatabase::AddMessage` is `INSERT OR IGNORE` on `(account_id,
  mailbox, uid)` — a message already present is left untouched, not
  overwritten, so a future re-sync won't clobber a locally-set read
  flag once that flow exists.
- IMAP4rev1 only — no OAuth (password auth only), no IMAP IDLE/push,
  no attachment handling.
