# Password manager: CSV import/export (2026-07-27)

Adds CSV export and import to the Settings → Passwords page
(`custom_settings/components/PasswordsPage.tsx`). This was the first item
built from a larger passwords-completion request; view/copy-with-reauth,
add/edit, and a password checkup were built as a follow-up the same day —
see [`password-manager-view-edit-checkup.md`](./password-manager-view-edit-checkup.md).

See [`custom-webui/pages-inventory.md`](./custom-webui/pages-inventory.md)
for how this fits into the wider WebUI picture — notably, the separate
`chrome://password-manager` page (`custom_password_manager`) is still a
placeholder stub; this feature was deliberately added to the existing
Settings sub-page instead of resurrecting that page.

## Why the Settings page, not a new dialog or the stub page

`CustomSettingsHandler` (`custom/browser/ui/webui/settings/
custom_settings_handler.h/.cc`) already had list+remove passwords wired up,
plus an established `ui::SelectFileDialog::Listener` pattern (used for the
cache-location folder picker and the sideloaded custom-font file picker).
Reusing that dialog member and pattern was far less code than standing up
new IPC/dialog plumbing on the stub page, and keeps all password UI in one
place for the user.

## Export

`chrome.send('customExportPasswords')` →

1. **OS reauthentication first.** Export is the highest-risk single action
   in the password manager — it writes every saved password as plaintext
   to a file in one shot, unlike viewing one at a time. Gated behind
   `device_reauth::DeviceAuthenticator::AuthenticateWithMessage()`
   (Windows Hello / Touch ID / ChromeOS lock screen), obtained via
   `ChromeDeviceAuthenticatorFactory::GetForProfile(profile, window,
   DeviceAuthParams(...))` — the same real upstream API used by
   `passwords_private_delegate_impl.cc`'s `AuthenticateUser`/
   `ExportPasswords`, just called directly instead of through the
   extensions-layer `passwordsPrivate` API this fork's WebUI doesn't use.
   Uses `device_reauth::DeviceAuthSource::kPasswordsCsvDownload` — an
   existing enum value in `device_reauth_metrics_util.h` that already
   exists for exactly this purpose.
   - Gated to `BUILDFLAG(IS_MAC) || BUILDFLAG(IS_WIN) ||
     BUILDFLAG(IS_CHROMEOS)`, matching upstream's own platform support.
     On other platforms export proceeds without reauth (also matching
     upstream).
   - **Windows quirk:** authentication cannot be canceled once started. A
     second export request while one is already pending fails immediately
     with an error rather than trying to interrupt the in-progress OS
     prompt.
2. On success, a native save dialog (`ui::SelectFileDialog::
   SELECT_SAVEAS_FILE`, defaulting to `passwords.csv`) opens via the
   handler's existing `select_folder_dialog_` member, gated by a new
   `pending_password_export_` flag so `FileSelected()` can tell this
   dialog open apart from the folder-picker/font-picker ones already using
   the same member.
3. `PasswordStoreInterface::GetAllLogins()` fetches every saved credential.
   `OnGetPasswordStoreResults` (the single-slot `PasswordStoreConsumer`
   callback) checks a new `password_export_fetch_pending_` flag *first*,
   before falling through to the pre-existing `customGetPasswords` display
   logic — both features share the one callback slot on this class.
4. Each `PasswordForm` is wrapped in a `password_manager::CredentialUIEntry`
   and serialized via `password_manager::PasswordCSVWriter::
   SerializePasswords()` — a static-only class that (by design) only keeps
   origin/username/password, discarding everything else.
5. The CSV is written via `base::WriteFile` on a `base::ThreadPool` task
   (`MayBlock`), then `customPasswordsExportResult` (`{success, error?}`)
   fires back to the page.

`base::WriteFile` has two overloads (`span<const uint8_t>` and
`std::string_view`) — passing `&base::WriteFile` directly to `BindOnce`
doesn't compile ("reference to overloaded function"); wrapped in a small
lambda that calls it with a fixed pair of argument types to force
resolution.

## Import

`chrome.send('customImportPasswords')` →

1. No reauth — importing doesn't reveal anything the user doesn't already
   have in the file they picked (matches upstream's own behavior).
2. Native open-file dialog (`SELECT_OPEN_FILE`), gated by
   `pending_password_import_`.
3. File read via `base::ReadFileToString` on a `base::ThreadPool` task.
4. Parsed via `password_manager::CSVPasswordSequence` — deliberately the
   lean, dependency-light CSV parser (no file I/O, no sandboxed mojo
   utility-process parser) rather than the heavier `PasswordImporter`/
   `PasswordManagerExporter`/`SavedPasswordsPresenter` orchestration
   classes upstream's extensions-layer API uses. Consistent with this
   fork's existing direct-to-store handler style.
5. Each row becomes a hand-built `PasswordForm` (`signon_realm` via
   `password_manager_util::GetSignonRealm(url)`, `Scheme::kHtml`,
   `Store::kProfileStore`) and is added via `PasswordStoreInterface::
   AddLogin()`. Rows that fail to parse or have no valid URL are counted
   as skipped, not treated as a hard failure for the whole import.
6. `customPasswordsImportResult` (`{success, imported, skipped, error?}`)
   fires back, followed by the existing `customPasswordsChanged` event so
   the on-screen list refreshes.

**Known limitation, deliberately not implemented:** no conflict resolution.
An imported row with the same origin+username as an existing saved login
is added as a new entry rather than merged/overwritten or flagged for the
user to accept/reject — upstream has a whole per-conflict UI flow for
this; a first cut just adds rows outright.

## Files touched

- `custom/browser/ui/webui/settings/custom_settings_handler.h/.cc` — the
  eight new methods (`HandleExportPasswords`, `OnExportReauthResult`,
  `ExportPasswordsToFile`, `OnPasswordsForExportReceived`,
  `OnPasswordsExportWritten`, `HandleImportPasswords`,
  `ImportPasswordsFromFile`, `OnPasswordCsvFileRead`), two new message
  registrations, an `OnGetPasswordStoreResults` dispatch check, and two new
  `FileSelected` branches.
- `custom/browser/ui/webui/BUILD.gn` — added
  `//components/device_reauth`, `//components/password_manager/core/
  browser/export`, `//components/password_manager/core/browser/
  import:csv`, and `//components/password_manager/core/browser/
  ui:credential_ui_entry`. (`ChromeDeviceAuthenticatorFactory` needed no
  new dep — like `IdentityManagerFactory`/`PrivacySandboxServiceFactory`,
  it lives directly in the giant `//chrome/browser:browser` target with no
  dedicated `BUILD.gn`, reachable transitively via the already-present
  `//chrome/browser/profiles` dep.)
- `custom_settings/components/PasswordsPage.tsx` — an "Import and export"
  section with two buttons and an inline status line, replacing the old
  "Import passwords" button that used to link out to the (non-functional)
  `chrome://password-manager` stub page. The "Password checkup" and "Open
  password manager" links remain pointed at that stub — they're still
  dead ends until that page (or an equivalent) is built.

No upstream files were touched, so no `npm run update_patches` was needed.
Both the C++ target (`custom/browser/ui/webui:ui`) and the React bundle
(`custom/components/custom_settings:resources`) built clean.
