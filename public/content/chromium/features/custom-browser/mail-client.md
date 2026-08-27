# Mail Client (IMAP)

A native IMAP4rev1 client, hand-rolled directly on Chromium's network
service rather than a vendored library — libetpan (the usual choice)
has TLS backends that aren't BoringSSL-compatible and needs the same
dedicated-thread bridge libtorrent required, so this builds on
`network::mojom::NetworkContext` instead. Foundation work started
v1.8.56 (2026-08-25); as of v1.8.58 it's a working background-synced
inbox with a message list and body reading (plain text solid, HTML
rendering still being debugged).

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
- **Background sync**: `MailSyncService` polls every configured
  account's INBOX on a timer (`custom.mail.sync_interval_seconds`,
  default 300s), fetching only messages newer than the last-synced UID
  per account. New mail triggers a desktop notification and updates a
  toolbar button's live unread-count badge (bottom bar; shared
  `CountBadgeView`, also used by the tracking-dashboard button).
- **chrome://mail**: a combined inbox across every configured account,
  capped at the 200 most-recent messages (not full history — the list
  is a "recent" view, not a paginated archive). A "Sync now" button
  triggers an immediate sweep. Clicking a message opens it (fetches/
  caches its body, marks it read); a "Mark as unread" button reverts
  that.
- **Message body reading**: opening a message fetches its body over
  its *own* independent IMAP connection (never the sync poller's — so
  reading a message never blocks on, or gets blocked by, a sync in
  progress), decodes it (`mail_body_parser.cc` handles multipart,
  quoted-printable/base64 transfer encodings, and charset conversion),
  and caches the decoded plain-text and HTML bodies separately so
  re-opening a message is instant.
  - **Plain text**: solid, renders directly.
  - **HTML**: renders inside a sandboxed `<iframe>` backed by
    `chrome-untrusted://mail-body/` — this fork's first
    `chrome-untrusted://` page. The page's CSP blocks all injected
    `<script>`/`onXXX=` execution regardless of message content;
    remote images are blocked by default (tracking-pixel privacy leak)
    with a per-message "Load images" opt-in. **Currently still being
    debugged** — several real issues were found and fixed getting this
    working (a Trusted Types policy requirement, a Chromium restriction
    on sandboxed `chrome-untrusted://` navigation, a build-dependency
    gap that silently didn't pick up frontend edits) but it isn't
    fully confirmed working end-to-end yet as of this writing.

---

## Where to find it

- Settings → **Mail accounts** (route `mail-accounts`, listed in the
  Settings left-nav) — add/remove accounts, same as before.
- **chrome://mail** — the inbox itself.
- A mail toolbar button in the bottom bar (toggle:
  `toolbar.show_mail_button` pref) — opens chrome://mail, shows a live
  unread-count badge.

**Prefs:**
- `custom.mail.accounts` — JSON array of accounts (host, port,
  username, an OSCrypt-encrypted+base64 password blob). Never holds a
  plaintext password.
- `custom.mail.sync_interval_seconds` — background poll interval,
  default 300.
- `toolbar.show_mail_button` — mail toolbar button visibility.

---

## Architecture

```
MailAccountsPage.tsx (Settings)                    custom_mail/App.tsx (chrome://mail)
   │ customMailGetAccounts/AddAccount/RemoveAccount      │ mailGetMessages / mailGetMessageBody /
   ▼                                                      │ mailSetRead / mailSyncNow
CustomMailHandler (WebUI message handler)                 ▼
   │ verifies via MailService::TestConnection()      MailHandler (WebUI message handler)
   ▼ before persisting                                   │ observes MailSyncService for live
MailAccountStore (stateless per call --                  │ push updates (unread count, new mail)
reads/writes custom.mail.accounts fresh each time)         ▼
                                                       MailSyncService (per-profile KeyedService)
                                                          │  - OneShotTimer background poll loop
                                                          │  - GetMessages/GetMessageBody/SetMessageRead
                                                          │  - owns MailBackend (SQLite) + calls MailService
                                              ┌───────────┴───────────┐
                                              ▼                       ▼
                                   MailService::TestConnection   MailService::FetchMessageBody
                                   (sync poller's connection)    (independent connection -- reading
                                                                  a message never waits on a sync)
                                              │                       │
                                              └───────────┬───────────┘
                                                           ▼
                                              ImapConnection (Login → SelectMailbox →
                                              FetchHeaders/FetchBody → Logout state machine)
                                                           │  transport-agnostic -- unit-tested
                                                           │  against a fake ImapTransport
                                                           ▼
                                              MojoImapTransport (NetworkContext::
                                              CreateTCPConnectedSocket + UpgradeToTLS)
                                                           ▼
                                              ImapResponseParser (incremental byte-stream
                                              parser: tagged/untagged responses, {n}-byte
                                              literals, tracks literal byte ranges)

Storage/parsing pipeline:
ImapFetchResponse (UID + raw content) ──┬─→ MailHeaderParser (RFC 5322 unfolding for
                                         │   Subject/From/Date, used during sync)
                                         └─→ MailBodyParser (multipart walk, quoted-printable/
                                             base64 decode, charset conversion -- used when a
                                             message is opened)
                                                │
                                                ▼
                                  MailDatabase/MailBackend (SQLite, sql::MetaTable
                                  versioning at v4, RefCountedThreadSafe backend on a
                                  sequenced task runner -- mirrors RSSDatabase/RSSBackend)

HTML body rendering (chrome-untrusted://mail-body/):
App.tsx embeds a sandboxed <iframe sandbox="allow-scripts"> pointed at the untrusted
page, then postMessage()s {html, allowImages} to it once loaded (target origin '*' --
the frame has no allow-same-origin, so no addressable real origin; the receiving side's
own event.origin check against 'chrome://mail' is the actual validation). receiver.js
(plain JS, no bundler) sets the content via a Trusted Types policy and strips <img> src
attributes unless images are allowed. MailBodyUIConfig (custom/browser/ui/webui/mail_body/)
registers the page with content::kChromeUIUntrustedScheme, a CSP with no 'unsafe-inline'
script-src and an explicit trusted-types allowlist for its one policy name, and
AddFrameAncestor() locking embedding to chrome://mail only.
```

---

## File map

| Path | Purpose |
|---|---|
| `browser/mail/imap_response_parser.{cc,h}` | Incremental IMAP byte-stream parser |
| `browser/mail/imap_command_builder.{cc,h}` | Command tagging/quoting |
| `browser/mail/imap_connection.{cc,h}` | Login/SelectMailbox/FetchHeaders/FetchBody/Logout state machine |
| `browser/mail/imap_transport.h` | Transport-agnostic interface (enables fake-transport unit tests) |
| `browser/mail/mojo_imap_transport.{cc,h}` | Real transport via `NetworkContext` TCP + TLS upgrade |
| `browser/mail/mail_service.{h,cc}` | Per-profile `KeyedService`; `TestConnection()` (sync primitive) + `FetchMessageBody()` (independent, on-demand) |
| `browser/mail/mail_service_factory.{h,cc}` | `BrowserContextKeyedServiceFactory` |
| `browser/mail/mail_account_store.{h,cc}` | Encrypted account persistence in the `custom.mail.accounts` pref |
| `browser/mail/imap_fetch_response.{cc,h}` | UID + raw content extraction from FETCH responses (headers-only or whole-message) |
| `browser/mail/mail_header_parser.{cc,h}` | RFC 5322 header unfolding (Subject/From/Date) + shared `SanitizeUtf8()` |
| `browser/mail/mail_body_parser.{cc,h}` | Multipart walk, quoted-printable/base64 decode, charset conversion → plain text + HTML |
| `browser/mail/mail_database.{h,cc}` | Per-profile SQLite message store (schema v4: headers, read flag, sync checkpoint, cached bodies) |
| `browser/mail/mail_backend.{h,cc}` | `RefCountedThreadSafe` backend on a sequenced task runner |
| `browser/mail/mail_sync_service.{h,cc}` | Background poll loop, `KeyedService`; message list/body/read-state API for the WebUI |
| `browser/mail/mail_sync_service_factory.{h,cc}` | `BrowserContextKeyedServiceFactory` |
| `browser/mail/mail_notification_helper.{h,cc}` | Desktop notification for new mail |
| `browser/ui/views/toolbar/mail_toolbar_button.{cc,h}` | Bottom-bar toolbar button + unread badge |
| `browser/ui/views/toolbar/count_badge_view.{cc,h}` | Shared numeric badge, extracted from the tracking-dashboard button |
| `browser/ui/webui/mail/custom_mail_handler.{h,cc}` | WebUI message handler backing the Settings account-management page |
| `browser/ui/webui/mail/mail_ui.{cc,h}` | `chrome://mail` `WebUIConfig`/`WebUIController` |
| `browser/ui/webui/mail/mail_handler.{cc,h}` | `chrome://mail` WebUI message handler (list/body/read-state/sync-now) |
| `browser/ui/webui/mail_body/mail_body_ui.{cc,h}` | `chrome-untrusted://mail-body/` `WebUIConfig`/`WebUIController` |
| `components/custom_settings/components/MailAccountsPage.tsx` | Settings account-management UI |
| `components/custom_mail/` | `chrome://mail`'s React frontend (`App.tsx` + `cr.ts` shim) |
| `components/custom_mail_body/` | `chrome-untrusted://mail-body/`'s frontend — plain `index.html` + `receiver.js`, no bundler (hand-authored `.grd`, not `generate_grd()` — see below) |
| `common/custom_pref_names.h` | `kMailAccounts`, `kMailSyncIntervalSeconds`, `kToolbarShowMailButton` |
| `common/webui_url_constants.h` | `kChromeUIMailHost`/`URL`, `kChromeUIMailBodyHost`, `kChromeUIUntrustedMailBodyURL` |
| `common/constants.{h,cc}` | `kMailDatabaseFilename` ("Custom Mail") |

Vanilla Chromium files patched: `chrome/browser/ui/webui/chrome_web_ui_configs.cc`
(registers `MailUIConfig`), `chrome/browser/ui/webui/chrome_untrusted_web_ui_configs.cc`
(registers `MailBodyUIConfig`), `chrome/browser/ui/BUILD.gn` (resource repack list).

Tests live in a standalone `mail_unittests` target (63 tests as of
v1.8.58), deliberately kept out of the monolithic `unit_tests` binary
for fast iteration.

---

## Known limitations

- **HTML rendering is still being debugged** — see "Current status"
  above. Treat it as not-yet-confirmed-working.
- Links inside a rendered HTML email are inert — the sandboxed iframe
  has no `allow-top-navigation`/`allow-popups`, so clicking one does
  nothing. Opening links in a real tab (with URL validation) is a
  planned follow-up, not yet built.
- Remote-content blocking only covers `<img src>` — a `<style>`-block
  `background-image` tracking vector isn't addressed.
- No message body caching invalidation/staleness handling needed (or
  built) — email content never changes after delivery, so a cached
  body is permanent once fetched.
- `chrome://mail`'s list is capped at 200 most-recent messages across
  all accounts — no pagination or full-history browsing.
- Cross-account message ordering is by sync-insertion order, not a
  true chronological sort — the `date` header is kept as an unparsed
  raw string (RFC 2822 date parsing into `base::Time` hasn't been
  built).
- No RFC 2047 encoded-word decoding — non-ASCII Subject/From values
  with `=?charset?B/Q?...?=` encoding show up in their raw encoded
  form, not decoded.
- Only one `MailService::TestConnection` (the sync path) can be in
  flight per profile at a time — a second sync call while one is
  pending fails immediately. `FetchMessageBody` (reading a message) is
  no longer subject to this — it has its own independent connection.
- IMAP4rev1 only — no OAuth (password auth only), no IMAP IDLE/push
  (polling only), no attachment handling, no message composition/
  sending (no SMTP client exists).
