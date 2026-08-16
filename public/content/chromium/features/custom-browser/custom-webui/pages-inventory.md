# Custom WebUI pages inventory

A full inventory of every custom React/TypeScript `chrome://` page in this
fork, audited against the actual code on 2026-07-19 (not the aspirational
docs that existed before this pass — see "Stale docs superseded by this
one" at the bottom). Cross-reference this against
[`custom-webui/getting-started.md`](./getting-started.md) for how the
React → esbuild → grit → `.pak` → `WebUIController` pipeline itself works;
this doc is just the "what pages exist and are they wired up" inventory.

**2026-07-19, later the same day:** `custom_extensions` gained a
per-extension detail view — see "`custom_extensions` — detail page added"
below. It was flagged in the original pass as complete-but-narrow-MVP; this
closes one of the gaps its own header comment called out.

**2026-07-20:** the remaining feature-parity gaps (severe warnings,
load-error dialog, apps section, blocklisted visibility, keyboard
shortcuts, site permissions, activity log, Safety Hub and MV2-deprecation
banners) were all closed — see "Second feature-parity pass" below.
`custom_extensions` now has full, simplified-where-noted parity with
upstream's `chrome://extensions`.

**2026-07-29:** `custom_profile_picker` and `custom_profile_customization`
— found to be 100% placeholder stubs earlier the same day — were both
completed with real `WebUIMessageHandler`s modeled on the still-present
(unregistered) upstream `ProfilePickerHandler`/`ProfileCustomizationHandler`.
Local-profiles-only scope; see "`custom_profile_picker`/
`custom_profile_customization` — completed 2026-07-29" below.

**2026-07-30:** an external cross-repo roadmap audit
(`FEATURE_DEEP_DIVE_ROADMAP.md`) flagged `custom_sync_confirmation` and
`custom_management` as placeholders, contradicting this doc's own
"Complete and live" listing. Re-verified against the actual code: the
audit was right, this doc was wrong — both are 100% placeholder stubs,
same pattern as `custom_password_manager`/`custom_profile_picker` before
them (native `WebUIController` correctly registers the `chrome://` host,
but `web_ui->AddMessageHandler(...)` is never called, so there's no IPC
surface at all). Moved to "Needs attention" below.

**2026-07-30, later the same day:** the same roadmap audit's Tier-1
prioritization picked `custom_password_manager` as the first item to
finish. Rather than duplicate the working Settings → Passwords logic,
the password-handling code was **extracted** out of the monolithic
`CustomSettingsHandler` into a new standalone
`custom::CustomPasswordManagerHandler`, attached to **both**
`custom_settings_ui.cc` (so Settings → Passwords keeps working unchanged)
and `custom_password_manager_ui.cc` (making the standalone page real for
the first time). See "`custom_password_manager` — completed 2026-07-30"
below; moved back to "Complete and live".

**2026-07-30, later still:** `custom_sync_confirmation` — the second
Tier-1 item from `FEATURE_DEEP_DIVE_ROADMAP.md` — was completed the same
way: a new, deliberately lean `custom::CustomSyncConfirmationHandler`
(no `ConsentAuditorFactory`/`LoginUIServiceFactory`/`BrowserListObserver`
machinery, none of which exists anywhere else in this fork) attached to
the already-registered `custom_sync_confirmation_ui.cc`. "Yes, I'm in"
and "Settings" really enable sync via `SyncUserSettings::
SetInitialSyncFeatureSetupComplete`; "Cancel" really signs out via
`IdentityManager`, reusing `CustomSettingsHandler::HandleSignOut`'s exact
call. See "`custom_sync_confirmation` — completed 2026-07-30" below;
moved back to "Complete and live".

**2026-07-30, later still again:** `custom_management` — the third
Tier-1 item from `FEATURE_DEEP_DIVE_ROADMAP.md` — was completed. This is
the first fork WebUI handler to read real `policy::PolicyService`/
`ProfilePolicyConnector`/`ChromeBrowserPolicyConnector` state (not to be
confused with the fork's own unrelated `custom::SecurityPolicyManager`/
`UrlAccessController`/`FunctionControlManager` local-pref scaffolding
under `custom/chrome/browser/security/`). New
`custom::CustomManagementHandler` surfaces real managed-status,
policy-force-installed extensions, cloud-reporting signals, managed
websites, and admin-forced run-on-login applications; drops the upstream
threat-protection-connectors section and GAIA promotion banner, neither
of which this fork has infrastructure for. See "`custom_management` —
completed 2026-07-30" below; moved back to "Complete and live".

**2026-08-01:** two Tier-2 roadmap items landed, both upgrading pages that
were already listed "Complete and live" (they had real apps + registered
hosts, just with a genuine functionality gap the roadmap flagged):

- **`custom_whats_new`** went from a 100% hardcoded `{title, body}[]`
  array with zero IPC surface to a real feed: new
  `custom::CustomWhatsNewHandler` fetches from a new, decoupled
  `WhatsNewEntry` table/endpoint in `wanderlust-api`
  (`GET /api/whatsnew?appId=...`, anonymous by design — a `chrome://`
  page has no API login session) via a server-to-server
  `network::SimpleURLLoader` call from the browser process (same pattern
  `GoogleAuthProvider` already uses) — this sidesteps both the page's CSP
  (no `connect-src` override existed) and CORS (no `chrome://` origin
  entry existed) entirely rather than fixing either. Falls back to the
  original hardcoded entries if the fetch returns nothing, so the page
  never renders blank. `wanderlust-api`'s existing `BrowserRelease`/
  `GET /api/releases` (the roadmap's "already-existing release
  infrastructure") was deliberately *not* reused — it's pure Omaha
  installer metadata (version/platform/arch/hash) with no title/body
  field at all, and one row per platform/arch would have meant duplicate
  cards per release.
- **`custom_intro`** went from a single static welcome screen (its own
  header comment admitted "a static welcome placeholder with no action
  buttons") to a real 2-step first-run wizard: Welcome, then a real
  cross-browser import step. New `custom::CustomIntroHandler` is a
  near-verbatim port of the real, previously-orphaned upstream
  `chrome/browser/ui/webui/settings/import_data_handler.h/.cc` — orphaned
  because `custom::CustomSettingsUI` unconditionally claims the
  `"settings"` host before vanilla `SettingsUI` (the class that normally
  attaches it) is ever reached, so this real Chromium import machinery
  (`ImporterList`, `ExternalProcessImporterHost`, `ProfileWriter` — all
  unmodified, real Chromium classes) had literally no live UI attachment
  point in this fork until now. "Firefox-only" needed no artificial
  filtering: there's no `ChromeImporter` class in this Chromium version at
  all, and `EdgeImporter` only reads the legacy pre-Chromium "Spartan"
  favorites store (bookmarks only) — so `ImporterList::
  DetectSourceProfiles()` already only ever surfaces Firefox (full:
  history/bookmarks/passwords/autofill/search engines, via real NSS-based
  password decryption), legacy Edge (bookmarks-only, if present), and a
  synthetic "Bookmarks HTML File" option.

Every entry below lives under `src/custom/components/custom_<name>/`
(`App.tsx` + `main.tsx` + `BUILD.gn`) unless noted, with a matching native
controller under `src/custom/browser/ui/webui/<name>/` (`<name>_ui.cc`/`.h`
+ usually a `<name>_handler.cc`/`.h`).

## Complete and live

Each of these has a real (non-boilerplate) React app and a native
`WebUIController`/`WebUIConfig` that actually registers a `chrome://`
host for it:

`custom_apps`, `custom_bittorrent`, `custom_bookmarks`,
`custom_certificate_manager`, `custom_chrome_urls`, `custom_credits`,
`custom_downloads`, `custom_epub_reader`, `custom_extensions`,
`custom_feedback`, `custom_flags`, `custom_history`, `custom_intro`,
`custom_management`,
`custom_password_manager`, `custom_print`,
`custom_privacy_shield`, `custom_profile_customization`,
`custom_profile_picker`, `custom_proxy_routing`, `custom_reader`,
`custom_sync_confirmation`,
`custom_tab_search`, `custom_terms`,
`custom_top_sites` (backed by the `most_visited` handler/controller, not
a `custom_top_sites_ui.cc` — same naming mismatch as `custom_settings`
below, just older), `custom_tracking_dashboard`, `custom_whats_new`.

That's 26 single-purpose pages, live and code-complete. `custom_credits`,
`custom_feedback`, and `custom_apps` were all confirmed to actually be
placeholders as of the 2026-07-30 roadmap audit (despite being listed
here since 2026-07-19) — all three got real backends on 2026-08-01:
`custom_credits` now reuses `about_ui::GetCredits()` (the same build-time-
generated license manifest vanilla `chrome://credits` displays) via a new
`CustomCreditsHandler`; `custom_apps` now lists/launches/uninstalls real
installed web apps via `web_app::WebAppProvider` (`CustomAppsHandler`,
porting the web-app half of upstream's `AppHomePageHandler` into this
fork's own IPC convention); `custom_feedback` now submits anonymously to
wanderlust-api's `POST /api/feedback` (`CustomFeedbackHandler`). All three
are genuinely live now. (`custom_password_manager` was previously removed
from this list on 2026-07-27 after being found to be a 100%-stub page,
then re-added on 2026-07-30 once a real handler was built — see
"`custom_password_manager` — completed 2026-07-30" below.
`custom_profile_picker`
and `custom_profile_customization` were briefly removed from this list on
2026-07-29 after being found to be placeholder stubs, then re-added the
same day once real handlers were built — see
"`custom_profile_picker`/`custom_profile_customization` — completed
2026-07-29" below.)

### Multi-page hubs

- **`custom_settings/`** — the live settings surface. Not one page but a
  hub-and-spoke app: ~30 sub-pages under `components/*Page.tsx`
  (Appearance, Privacy, Downloads, etc.), routed client-side, backed by
  `custom_settings_ui.cc` + `custom_settings_handler.cc`. This is what
  `chrome://settings` (or whatever this fork's settings host is) actually
  serves.
- **`custom_sidebar/pages/`** — seven sub-pages (Bookmarks, History, Notes,
  NtpSettings, Rss, Agent, RecentlyClosed) backed by the sidebar
  handler/controller. RecentlyClosed (added 2026-08-01) shows two live
  sections — Open Tabs and Recently Closed tabs/windows — ported from
  `RemoteNtpServiceImpl`'s `TabRestoreService`/`BrowserList` logic since
  `browser_api`/`window.custom` isn't reachable from `chrome://sidebar`.
  See [`custom-webui/sidebar.md`](./sidebar.md) for the RSS-adjacent detail
  on this one, and [`custom-webui/rss-reader.md`](./rss-reader.md) for the
  reader page specifically.

### Native-only (no React frontend)

- ~~**`adblock_settings`**~~ **Removed (2026-08-16)** — turned out to be neither
  "native-only" nor "incomplete," but dead vendored code that never
  actually worked: `AdblockSettingsUI` (`custom/browser/ui/webui/adblock_settings/`)
  referenced a `chrome://` host constant registered nowhere in the tree
  (no `WebUIConfig`/`WebUIControllerFactory` entry, not in any `BUILD.gn`
  — genuinely unbuilt, not just unreachable), and its header even had a
  class-name typo (`AdBlockSettingsUI` vs. the actual `AdblockSettingsUI`)
  that would have failed to compile had it ever been wired in. Its two
  messages didn't touch the real ad-block engine
  (`custom/browser/net/blockers/`) at all: `settingAdblock` just flipped
  the same `prefs::kEnableAdBlock` boolean the already-working "Block ads
  and trackers" toggle (`PrivacyPage.tsx`, backed by `PrivacyShieldHandler`)
  already controls, and `settingPopupBlocker` wrote a raw byte to a file
  in the user-data dir — a hack its own code comment admitted was "a bad
  design," not real popup-blocker integration. The paired frontend
  (`browser/resources/settings/adblock_settings/`) was legacy
  pre-Polymer HTML from a decade-old Chromium API surface. Deleted
  entirely rather than finished — the only non-duplicated capability
  ("smart adblock" tri-state, real popup blocking) had zero working
  backend logic to build on, making "finish" a rewrite from scratch, not
  a wiring fix.
- **`about`** — same shape: a native `custom_about_ui.cc` exists, but the
  only `AboutPage.tsx` in the tree lives *nested inside*
  `custom_settings/components/`, not as its own `custom_about` package.
  Likely intentional (About is a settings sub-page, not a standalone
  `chrome://about`), but flagging since it doesn't fit the 1:1 pattern
  every other entry follows.

### `custom_extensions` — detail page added (2026-07-19)

The original audit found this page's list+enable/disable/uninstall/
load-unpacked flow fully wired to real `extensions::ExtensionRegistry`/
`ExtensionRegistrar` data (not a stub) — its own header comment just
scoped out a few upstream features by name. Of those, only the
per-extension detail page was requested to be built; the rest
(permissions/site-access editor, errors/warnings surface, pack-extension,
update-all) remain out of scope.

**Frontend** (`custom/components/custom_extensions/App.tsx`): clicking an
extension's name in the list sets a `selectedId` and swaps the whole page
to a new `ExtensionDetail` component — plain local component state, no
router, since the detail view is just a different render of data already
in the `extensions` array fetched by the list. If the selected extension
disappears from a `customExtensionsChanged` refetch (removed from
another tab, or mid-flight on initial mount), a `useEffect` resets
`selectedId` back to `null` rather than rendering a detail view for an
extension that no longer exists. The detail view reuses the exact same
enable/reload/remove `chrome.send` calls as the list row — no new IPC
verbs for actions that already existed, only for the extra fields below.

**Backend** (`custom_extensions_handler.cc`'s `BuildExtensionDict`):
three new fields, all read directly off the existing `extensions::Extension`
already in hand — no new observers, no new round trip:
- `source` — a short human string (`"Chrome Web Store"`, `"Unpacked"`,
  `"Installed by admin policy"`, etc.) derived from
  `extension.location()` (`extensions::mojom::ManifestLocation`), via a
  translation function for the same reason `ManifestTypeString` already
  existed: that enum is a "stored in prefs, never renumber" one per its
  own doc comment, so its raw int shouldn't cross the `chrome.send`
  boundary either.
- `homepageUrl` — `extensions::ManifestURL::GetManifestHomePageURL()`,
  which is empty unless the manifest explicitly specifies one (as
  opposed to `GetHomepageURL()`, which falls back to a generic Web Store
  gallery URL for webstore-hosted extensions — deliberately not used
  here, since a generic fallback link isn't worth showing).
- `webStoreUrl` — `extensions::ManifestURL::GetWebStoreURL()`, separately
  from homepage, since an extension can have both a real homepage and a
  Web Store listing.
- `optionsUrl` — `extensions::OptionsPageInfo::GetOptionsPage()`, gated
  on `HasOptionsPage()`.

**Known scope limits:**
- No extension icon on the detail page — the list row doesn't show one
  either (this codebase's `custom_extensions` page never added the async
  `ImageLoader`-based icon-fetch pipeline other WebUI pages use), and
  adding it only on the detail view would've been an inconsistent half
  measure. Left as a documented gap, same as the four features that
  remain genuinely out of scope.
- Full build (C++ handler + the `custom_extensions_bundle` esbuild/
  TypeScript action) passed clean.

**Bug fix, same day:** the list was showing the wrong set of extensions —
genuine Chromium *component* extensions (e.g. the built-in PDF Viewer,
`mhjfbmdgcfjbbpaeojofohoefgiehjai`) were visible, while WanderLust's own
bundled first-party extension (the ad blocker — `kOurExtensionIds` in
`custom/extensions/common/custom_extension.cc`, currently just
`iledkllfmbcapkafpogpdmpbpefpcbie`) was hidden. Root cause:
`HandleGetExtensions` filtered on `IsBundledInternalExtension` (our own
first-party ID list) instead of on install location — component
extensions aren't in that ID list at all, so nothing filtered them, while
our own bundled extension *is* in that list and got excluded from the
list it should have appeared in.

Fixed by filtering on `extensions::Manifest::IsComponentLocation(location())`
instead (matches upstream's own convention for hiding component
extensions from the user-facing list) — the bundled ad blocker isn't a
component extension (it's installed via a normal `CrxInstaller::InstallCrx`
call on first run, see `custom/patches/chrome-browser-ui-startup-startup_browser_creator.cc.patch`),
so it now shows correctly. One side effect needed fixing at the same
time: `mayDisable` was computed purely from `ManagementPolicy::UserMayModifySettings`,
which doesn't know about `kOurExtensionIds` — so once visible, the
bundled extension would have shown a working-looking enable/disable
checkbox and Remove button that silently no-op
(`HandleSetExtensionEnabled`/`HandleRemoveExtension` both still early-return
for `IsBundledInternalExtension`, unchanged, since removability of the
bundled extension wasn't part of this ask). `mayDisable` now also checks
`!IsBundledInternalExtension(id)`, so the row correctly renders as
management-locked instead of offering controls that don't work.

**Bundled "Adblock for Youtube" extension removed (2026-07-20).** It was
only ever a test artifact and had gone stale/unmaintained, so it (and
every reference to it) was deleted: `kOurExtensionIds`/
`kOurExtensionFilenames` in `custom/extensions/common/custom_extension.cc`
are now empty (`kOurNumExtensions = 0`, a `{nullptr}` placeholder entry in
each array purely to keep them valid, non-zero-size C++ arrays — never
read since the count is 0), the `adblock_for_youtube.crx` file was
deleted from `custom/browser/extensions/default_extensions/`, and its
entry was removed from `custom_browser_extensions_default_extensions` in
`custom/browser/extensions/sources.gni` (the separate, still-present
`dtheme.crx` entry there is unrelated and was left alone). The
`kOurExtensionIds`/`IsBundledInternalExtension` mechanism itself is
generic (array + count, looped everywhere it's consumed) and was
deliberately *not* ripped out — it's just dormant now, ready to hold a
future first-party bundled extension without touching any of the ~5
patched upstream files that special-case bundled extensions (install
verifier, install prompt/bubble suppression, `chrome://extensions`
visibility, first-run installer) — all of those loop `for (i = 0; i <
kOurNumExtensions; ++i)`, so they're now unconditional no-ops with zero
patch changes needed. One practical side effect: since
`IsBundledInternalExtension` now always returns false, anyone who already
had the old extension installed will find it's no longer management-
locked — `mayDisable` falls through to the normal
`ManagementPolicy::UserMayModifySettings` check, so the existing
enable/disable toggle and Remove button on the extensions page now work
on it like any other extension, letting it be removed from an existing
profile through the normal UI instead of needing manual profile surgery.

**Dark mode bug fix, same day:** the page stayed light-themed regardless
of the browser's actual theme, even though individual extension cards
(`bg-white dark:bg-navy-800`) did correctly flip dark. Root cause: this
Tailwind v4 setup uses the default `media` dark-mode strategy (no
`@custom-variant dark`/`darkMode` config anywhere in this codebase's
`custom/components/**/tailwind.css` files — `dark:` compiles straight to
`@media (prefers-color-scheme: dark)`, resolved by Blink from the
browser's theme, same mechanism every other custom WebUI page uses), so
detection itself was never the problem. What was missing: neither
`App()`'s nor `ExtensionDetail`'s root `<main>` ever painted a
full-viewport background — compare `custom_downloads/App.tsx` and
`custom_settings/App.tsx`, both of which wrap their whole page in
`min-h-screen bg-lightPrimary dark:bg-navy-900`. Without that, the cards
inside correctly went dark but the canvas around/behind them (driven by
`<body>`, which nothing ever painted) stayed the browser's default WebUI
white.

Fixed by splitting each root `<main>` into an outer full-bleed
`min-h-screen bg-lightPrimary dark:bg-navy-900` element and an inner
`mx-auto max-w-4xl px-6 py-10` content column — same two-layer structure
`custom_downloads`/`custom_settings` already use, applied to both the
list view and the (2026-07-19-added) detail view. Full build passed
clean, including the `custom_extensions_bundle` Tailwind/esbuild step.

**Feature-parity pass vs. upstream chrome://extensions, same day.** A
full feature-by-feature audit against upstream's real extensions manager
(`chrome/browser/resources/extensions/` + `developer_private_api.cc`)
found four real gaps worth closing (out of a much longer list — pack-
extension, update-now, keyboard shortcuts page, site-permissions pages,
activity log, and safety-check/MV2-deprecation panels remain explicitly
out of scope, either because they weren't requested or because they're
large, separate sub-apps upstream itself gates behind flags). All four
reuse existing Chromium APIs directly — nothing here is new discard/
permission/error logic of our own, same pattern as the earlier dormant-
tab and duplicate-tab work in `vertical-tabs.md`.

*Quick wins:*
- **Icons** — `<img src={ext.iconUrl}>` in both the list row and detail
  view, pointed at `chrome://extension-icon/<id>/<size>/<match>`
  (`ExtensionIconSource::GetIconURL`, `extension_misc::EXTENSION_ICON_MEDIUM`
  = 48px, `ExtensionIconSet::Match::kBigger`) — the same already-existing
  data source upstream's own page and `app_home` reuse. Registered via
  `content::URLDataSource::Add` in `custom_extensions_ui.cc`, plus an
  `img-src chrome://extension-icon 'self';` CSP override (the default
  img-src doesn't cover a separate host). No new icon-loading/base64
  encoding code was needed on our side.
- **Search/filter** — a plain text input filtering the already-fetched
  list client-side by name or id substring (`App.tsx`'s `visible`
  computation) — no backend change, no new IPC verb.
- **Crashed/terminated extensions** — `HandleGetExtensions` now also
  enumerates `registry->terminated_extensions()` (a third, previously-
  unsurfaced `ExtensionRegistry` set), tagged `terminated: true` in the
  dict. Reload uses the *same* `ExtensionRegistrar::ReloadExtension(id)`
  call already used for unpacked extensions — it already handles the
  terminated case internally (mirrors
  `DeveloperPrivateReloadFunction::Run()`), so no new reload path was
  needed, just relaxing the button's gating from `developerMode &&
  isUnpacked` to `terminated || (developerMode && isUnpacked)`.
  `ExtensionRegistryObserver` has no dedicated `OnExtensionTerminated`
  callback (a real build error caught this — it doesn't exist as a
  virtual to override); a crash routes through the existing
  `OnExtensionUnloaded(reason=TERMINATE)` override instead, which already
  broadcasts `customExtensionsChanged` unconditionally.

*Detail-page toggles:* `allowIncognito`/`allowFileUrls`/`collectErrors`,
each a thin wrapper over existing Chromium APIs — `extensions::util::
SetIsIncognitoEnabled`/`IsIncognitoEnabled`/`CanBeIncognitoEnabled` (split
across two headers: writes in `chrome/browser/extensions/extension_util.h`,
reads in `extensions/browser/extension_util.h` — easy to miss, only one
was included on the first pass), `SetAllowFileAccess`/`AllowFileAccess`
(same file), and `ErrorConsole::SetReportingAllForExtension`/
`IsReportingEnabledForExtension`. The first two reload the extension
internally on change (per their own doc comments), so the existing
registry-observer broadcast covers them; collecting errors doesn't touch
the registry, so `HandleSetCollectErrors` broadcasts manually.

*Permissions & site-access editor:* read-only permission-message list
(`PermissionMessageProvider::GetPermissionMessages`, fed by
`ExtensionPrefs::GetGrantedPermissions` — mirrors
`AddPermissionsInfo`/`extension_info_generator.cc`, simplified to skip
the API-vs-host-permission split upstream does) plus a three-state
site-access editor (`on_click` / `on_specific_sites` / `on_all_sites`)
via `extensions::PermissionsManager` (read: `HasWithheldHostPermissions`,
`ShouldWarnAllHosts` — the exact branching mirrors
`CreateRuntimeHostPermissionsInfo`) and `extensions::ScriptingPermissionsModifier`
(write: `SetWithholdHostPermissions`, `RemoveBroadGrantedHostPermissions`,
`RemoveAllGrantedHostPermissions`, `GrantHostPermission(GURL)` for adding
a site from a URL the user types). Only shown when
`PermissionsManager::CanAffectExtension` is true (extensions that don't
request host permissions get neither section).

One correctness issue caught and fixed before it shipped: granted hosts
are sent to the frontend as URL *pattern* strings (e.g.
`https://*.example.com/*`, via `URLPattern::GetAsString()`) for display,
but the initial removal handler tried to parse that pattern string as a
plain `GURL` and call `ScriptingPermissionsModifier::RemoveGrantedHostPermission(GURL)`
— `*` isn't valid in a URL's scheme/host position, so this would have
silently failed on every real pattern. Fixed by parsing the string back
into a `URLPattern` (`URLPattern::Parse`) and calling the pattern-based
`RemoveHostPermissions(URLPattern, callback)` instead — the same call
upstream's own `DeveloperPrivateUpdateSiteAccessFunction` uses. That
overload is async (unlike every other host-access call in this file), so
the `customExtensionsChanged` broadcast happens from its completion
callback rather than immediately after — broadcasting right away would
race ahead of the actual permission change and show the host as still
granted for one refresh cycle. The `ScriptingPermissionsModifier` instance
is kept alive by moving it into the bound callback, since it doesn't
outlive the call otherwise.

*Errors & warnings surface:* install warnings
(`Extension::install_warnings()`) ride the main list dict (cheap, always
available) and drive a small ⚠ badge on the list row. Runtime/manifest
errors are fetched lazily — only when the detail page for an extension
with `errorCount > 0` is open, since `ErrorConsole::GetErrorsForExtension`
entries can carry full stack traces (`RuntimeError::stack_trace()`,
`extensions/common/stack_frame.h`'s `StackFrame`) that aren't worth
including in every list refresh. `errorCount` itself (just a deque size)
does ride the list dict, cheaply. "Clear all" calls
`ErrorConsole::RemoveErrors(ErrorMap::Filter::ErrorsForExtension(id))`.
Deliberately skipped: `requestFileSource`-style source-code snippets
around each error (upstream reads the actual file from disk to highlight
the offending line) — messages, severity, source file, and stack traces
as plain text are a reasonable MVP without adding disk I/O.

**Known scope limits (this pass):**
- No pack-extension, update-now, keyboard shortcuts page, site-
  permissions pages, activity log, or safety-check/MV2-deprecation
  panels — all remain as documented gaps from the original audit.
- The site-access editor doesn't show *withheld-but-not-yet-granted*
  hosts the extension requested (upstream's own UI shows both granted
  and withheld hosts in one list with per-row toggles) — only what's
  currently granted, with a separate "add a site" flow for granting new
  ones. Simpler, but less discoverable than upstream's approach.
- Two build errors were caught and fixed before landing (both namespace-
  qualification mistakes, not logic bugs): `ExtensionIconSet` and
  `URLPattern` are *global* classes in this codebase, not
  `extensions::`-scoped, despite being used almost exclusively by
  extensions code — easy to get wrong by pattern-matching against
  neighboring `extensions::` types.
- Full build passed clean on the second attempt (first attempt's four
  compile errors were exactly the namespace/override issues above); no
  upstream files were touched, so no patch regeneration was needed.

**Second feature-parity pass — severe warnings, load-error dialog, apps
section, blocklisted visibility, and the five remaining gaps (2026-07-20).**
Closes out the "Known scope limits (this pass)" list above. The user asked
for all five remaining items, "simplified" — each is a deliberately
scoped-down version of the upstream feature, not a full port, with the
scope cut documented per item below.

*Severe warnings + load-error dialog:*
- **Severe warning badges** — `BuildExtensionDict` now also surfaces a
  `severeWarnings: string[]` field, populated from
  `ExtensionPrefs::HasDisableReason` checks for `DISABLE_NOT_VERIFIED`,
  `DISABLE_UPDATE_REQUIRED_BY_POLICY`, `DISABLE_BLOCKED_BY_POLICY`,
  `DISABLE_UNSUPPORTED_MANIFEST_VERSION`, and
  `DISABLE_UNSUPPORTED_DEVELOPER_EXTENSION`, plus an informational Manifest
  V2 entry (`manifest_version() == 2`) and a `corruptInstall` flag
  (`DISABLE_CORRUPTED`). The list row's ⚠ badge count now includes these;
  the detail page renders them in their own red box above install
  warnings, and a `policyControlled` field
  (`extensions::Manifest::IsPolicyLocation`) drives a tooltip. A
  `corruptInstall`-gated **Repair** button on the detail page reinstalls
  from the Web Store via `extensions::WebstoreReinstaller` (ref-counted,
  kept alive as a member field until its callback fires, same pattern as
  `PackExtensionJob`).
- **Load-error dialog** — `UnpackedInstaller` previously had no
  `set_completion_callback` wired up at all, so `HandleLoadUnpacked`
  optimistically resolved `{ok: true}` before the load actually finished,
  making failures silently invisible. Fixed by wiring the real completion
  callback before `Load()`; on failure, a RE2 regex (mirroring
  `DeveloperPrivateAPIFunction::GetManifestError`'s own pattern) extracts
  the line/column from JSON manifest-parse errors, and a
  `base::ThreadPool` task reads `manifest.json` to build a plain ±2-line
  text snippet (deliberately not upstream's full `FileHighlighter`-class
  HTML before/highlight/after split — a plain marked snippet is enough for
  this browser). The frontend shows this in a dismissible red banner with
  Retry (re-attempts the last picked folder, no need to reopen the picker)
  and Dismiss.

*Apps section + blocklisted visibility:*
- Extensions of `type: 'app'` now render in their own "Apps" section
  below the main list (mirroring upstream's separate apps/extensions
  split) instead of being filtered out entirely.
- `HandleGetExtensions` now also loops `registry->blocklisted_extensions()`
  (a fourth `ExtensionRegistry` set, alongside enabled/disabled/
  terminated), tagged `blocklisted: true`. These are security-relevant
  (Safe Browsing malware/policy-violation flags) and were previously
  invisible — now shown with a red "Blocklisted" badge and folded into the
  Safety Hub banner (see below) instead of silently disappearing from the
  list.

*Keyboard shortcuts page (simplified):* a new "Keyboard shortcuts" button
opens a flat list of every named/action command across all enabled
extensions. Backend: `HandleGetAllCommands` calls
`CommandService::GetExtensionActionCommand` (for the
`ActionInfo::Type::kAction` "activate extension" command) and
`GetNamedCommands(id, QueryType::ALL, CommandScope::ANY_SCOPE, &map)` per
extension, returning `{name, description, shortcut, isGlobal}` via
`ui::Command::AcceleratorToString`. `HandleSetShortcut` wraps
`CommandService::UpdateKeybindingPrefs`/`RemoveKeybindingPrefs` (empty
keystroke clears). **Simplified vs. upstream:** no raw keydown-capture
widget — shortcuts are typed as plain text (e.g. `"Ctrl+Shift+Y"`); no
regular/global scope picker (global commands are readable and settable
here, just not toggleable between scopes from this page); no
cross-extension "shortcut already in use" conflict warning.

*Site permissions page (simplified, frontend-only):* a new "Site
permissions" button opens a site-centric view built entirely from data
the main list already fetches (`hostAccess` + `grantedHosts` per
extension) — no new backend call. Two sections: extensions with
`on_all_sites` access, and a per-site breakdown (host pattern → which
extensions hold `on_specific_sites` access to it). **Simplified vs.
upstream:** read-only navigation only — clicking an extension jumps to its
existing detail-page permissions editor rather than duplicating an
add/remove-site control in a second place; no "restricted sites" concept.

*Activity log (minimal, gated):* folded into the detail page as a small
section rather than a separate page, per the recommendation that this is
near-always empty for real users — `ActivityLog::is_active()` requires
either `--enable-extension-activity-logging` or the deprecated Watchdog
app. `BuildExtensionDict` adds a cheap `activityLogActive` flag; when
false the section just reads "Activity logging isn't enabled for this
browser" and does no fetch. When true (dev-mode only, lazy "Show" button),
`HandleGetActivityLog` calls `ActivityLog::GetFilteredActions` with no
filters (`Action::ACTION_ANY`, empty api/page/arg URL, `days_ago = -1`),
returning `{apiName, actionType, pageUrl, timeMs}` per
`extensions::Action` (`action_type()` mapped to a short string,
`time().InMillisecondsSinceUnixEpoch()` for the frontend to format via
`Date`).

*Safety Hub banner (simplified):* a red banner above the list,
frontend-only, listing extensions where `blocklisted || corruptInstall`
(both already computed above), with a "Remove all" bulk action
(`removeExtension` per row, filtered to `mayDisable` extensions, same
confirm-before-remove UX as the existing per-row Remove button — no new
IPC verb). **Simplified vs. upstream:** no scored recommendation engine or
separate review sub-panel, just a grouped list with a bulk action.

*MV2-deprecation banner (simplified):* an amber informational banner,
frontend-only, listing extensions where `isManifestV2` (already computed
above) and not already covered by the Safety Hub banner
(`!blocklisted`), each linking straight to its detail page.
**Simplified vs. upstream:** no three-stage experiment/enforcement
rollout — just a static "these may stop working" notice with links to
review each one.

**Known scope limits (this pass):**
- Blocklisted-extension removal was assumed at first to need special
  handling (a different uninstall path than a normal extension) but
  turned out not to — `ExtensionRegistrar::UninstallExtension` and the
  existing `mayDisable`-gated Remove button both already work uniformly
  across all four `ExtensionRegistry` sets, so the Safety Hub's bulk-remove
  reuses the same `removeExtension` call unconditionally rather than
  needing a separate codepath.
- No embedded raw-keydown shortcut capture, scope toggle, or conflict
  detection on the shortcuts page (see above).
- No add/remove-site controls on the site permissions page — it links out
  to the detail page's existing editor instead of duplicating it.
- Activity log has no filtering/search UI (type, API name, date range) —
  it's an unfiltered recent-activity dump, appropriate given it's expected
  to be empty for virtually all users.
- Full build (`npm run build`, C++ handler + `custom_extensions_bundle`
  esbuild/TypeScript) passed clean for all five items in one final
  combined build, no warnings.

### `custom_profile_picker`/`custom_profile_customization` — completed 2026-07-29

Both pages were placeholder stubs (each rendering a literal "not wired up
yet" card, no routing/state/IPC) until this pass — see git history/prior
revisions of this doc for that state. Native registration was already
correct (`CustomProfilePickerUI`/`CustomProfileCustomizationUI` and their
`WebUIConfig`s were properly swapped in via the `chrome_web_ui_configs.cc`/
`chrome_web_ui_controller_factory.cc` patches); the gap was purely the
missing `WebUIMessageHandler` on each. Both were modeled directly on the
real, upstream `ProfilePickerHandler`/`ProfileCustomizationHandler`
(`chrome/browser/ui/webui/signin/profile_picker_handler.cc` /
`profile_customization_handler.cc`) — still fully present in this fork's
tree, just unregistered, so the new handlers reuse proven Chromium logic
rather than reinventing it.

**Scope, deliberately local-profiles-only**: no Google/Dice sign-in for new
profiles — that requires the full upstream `ProfilePicker` C++
flow-controller state machine, a separate, much larger undertaking. The
"Sign in with Google" button is present but wired to a documented no-op
(`FireWebUIListener("sign-in-not-available")`) that shows a toast, matching
this fork's established pattern for partially-scoped features (e.g. the
password leak-checker, functional but pending OAuth credentials).

**`custom/browser/ui/webui/profile_picker/custom_profile_picker_handler.h/.cc`**
(new) — `getProfiles` (list via
`ProfileAttributesStorage::GetAllProfilesAttributesSortedByLocalProfileNameWithCheck()`,
filtered for `IsOmitted()`, each entry's avatar rendered as a bitmap data
URL via `profiles::GetSizedAvatarIcon()` + `webui::GetBitmapDataUrl()` —
same pattern the real handler's `CreateProfileEntry()` uses), `launchProfile`
(`profiles::SwitchToProfile()`), `createProfile`
(`ProfileManager::CreateMultiProfileAsync()`, then
`profiles::OpenBrowserWindowForProfile()` to open a window for the new
profile and `Browser::OpenGURL()` to navigate it straight to
`chrome://profile-customization` — necessary because navigating the
*picker's own* tab would stay in the picker's own profile, not the new
one), `renameProfile`/`removeProfile` (`ProfileAttributesEntry::SetLocalProfileName()`/
`webui::DeleteProfileAtPath()`, identical calls to the real handler),
`signInWithGoogle` (the documented no-op above). Observes
`ProfileAttributesStorage` for live list updates.

**`custom/browser/ui/webui/profile_customization/custom_profile_customization_handler.h/.cc`**
(new) — `getProfileInfo`/`getAvailableIcons` (the latter forwards
`profiles::GetIconsAndLabelsForProfileAvatarSelector()` directly, zero new
logic — same call the real handler makes), `setAvatarIcon`
(`profiles::SetDefaultProfileAvatarIndex()`), `setProfileName`, and two
pieces the real handler doesn't need but this simplified page does since
it's a plain `chrome://` tab rather than a native bubble: `getSuggestedColors`
(a fixed preset palette from `chrome_colors::kSelectedColorsInfo` — the
same array the NTP background-color picker uses — rather than the real
handler's single `GenerateNewProfileColor()` suggestion, since a
multi-swatch row needs more than one option) and `setThemeColor`
(`ThemeServiceFactory::GetForProfile(profile)->SetUserColor()`). `done`/`skip`
are no-ops — every field already saves live as it's changed, and there's no
ephemeral-profile finalization needed since profiles created by this fork's
picker aren't created ephemeral in the first place (unlike upstream's flow).
Also observes `ProfileAttributesStorage` for live updates (avatar/name/theme
changed elsewhere).

**Both React apps** (`App.tsx` in each `custom/components/custom_profile_picker/`
and `custom_profile_customization/`) rewritten from the stub cards to real
UIs following the `custom_extensions` fetch-on-mount +
`cr.addWebUIListener` pattern; each directory gained its own `cr.ts`
IPC-shim copy (the established per-page-copy convention — see
`getting-started.md`) and added it to `BUILD.gn`'s `sources`.

**GN deps added** to `custom/browser/ui/webui/BUILD.gn`'s `static_library("ui")`:
`//chrome/browser/themes`, `//chrome/browser/ui/profiles`, and
`//chrome/browser/new_tab_page/chrome_colors:generate_colors_info` (the
last one is a header-only dependency for `selected_colors_info.h` — that
exact target name, not the `chrome_colors` source_set, is the established
pattern other WebUI signin handlers already use for the same header, per
`chrome/browser/ui/webui/signin/BUILD.gn`).

**Known scope limits:**
- No Google/Dice sign-in (see above) — local profiles only.
- No profile-switch-to-existing-account confirmation flow, no profile
  statistics in the deletion-confirmation dialog (the real picker shows
  bookmark/password/etc. counts before deleting; this one just confirms via
  an in-page confirmation step instead — see below for why not a native
  dialog).
- `getSuggestedColors` returns a static preset list rather than
  context-aware suggestions generated relative to existing profile colors.
- Full `chrome` build passed clean; compiled the `ui` static library target
  in isolation first to iterate faster, then verified the complete build.

**Five bugs found during the user's own runtime testing, fixed same day (2026-07-30):**

1. **Installed-profile creation crashed on a DCHECK.** `ProfileImpl::DoFinalInit()`
   (`chrome/browser/profiles/profile_impl.cc`) has a fork-specific addition
   (`BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)`) that synchronously creates a
   per-profile download-cache directory with no `ScopedAllowBlocking` guard
   — `base::AssertBlockingAllowed()` fired the moment
   `ProfileManager::CreateMultiProfileAsync()`'s "Add profile" flow ran
   `DoFinalInit()` on a sequence that correctly disallows blocking (unlike
   normal startup profile loading, which apparently tolerates it). The same
   unguarded pattern existed in `~ProfileImpl()`'s matching `DeleteFile()`
   call, which would have crashed identically on profile deletion. Both
   pre-existing bugs, never exercised before because nothing in this fork
   had ever created-then-destroyed a second profile until this feature.
   Fixed by wrapping both in `ScopedAllowBlockingForProfile`, the exact RAII
   guard this same file already uses for the analogous profile-directory
   creation a few lines above.
2. **Newly-created profiles crashed later, on a null-pointer deref.**
   `RSSImpl::Shutdown()` (`custom/browser/rss/rss_impl.cc`, called by the
   KeyedService framework before a profile is destroyed) nulls `profile_`
   but never stopped `one_shot_peek_timer_`. If that timer was still
   pending, it fired later via `ScheduleRSS()`, which unconditionally
   dereferences `profile_->GetOriginalProfile()`. Fixed by calling the
   already-existing `StopOneShotPeekTimer()` first thing in `Shutdown()`,
   before nulling `profile_`.
3. **The picker never closed after launching a profile.** Turned out this
   page is normally hosted inside the real, untouched upstream
   `ProfilePickerView` — a dedicated, chrome-less `views::Widget`
   (`chrome/browser/ui/views/profiles/profile_picker_view.cc`), not a
   normal `Browser` tab; this fork's `WebUIControllerFactory` patch only
   swaps in custom content to render *inside* it. `CustomProfilePickerHandler::OnProfileSwitched`
   now calls the real `ProfilePicker::Hide()` after a successful launch
   (safely a no-op if the widget isn't open), with a `TabStripModel`-based
   fallback kept for the non-standard case of reaching this page as a plain
   tab instead.
4. **Deleting a profile silently did nothing.** Root cause of the above,
   part two: `ProfilePickerView` never overrides
   `GetJavaScriptDialogManager()`, so `window.alert`/`confirm`/`prompt`
   have nothing to route through and silently resolve as "cancelled" in
   this widget. The delete button's `window.confirm()` always evaluated
   false, so `removeProfile` never even fired. Fixed by replacing it with
   a small in-menu confirmation step (Delete → "This can't be undone" with
   Cancel/Delete buttons) — no native dialog dependency, matching why real
   Chromium's own profile picker builds its own in-page confirmation
   instead of using `window.confirm()` too.
5. **Dark mode wasn't respected.** Same bug class already hit (and fixed)
   for `custom_extensions` earlier this session: both pages' root `<main>`
   set `dark:text-white` for text but never painted a background at all,
   so the canvas behind the (correctly dark-flipping) cards stayed the
   default WebUI white regardless of theme. Fixed by wrapping both pages in
   the same `min-h-screen bg-lightPrimary dark:bg-navy-900` outer +
   `mx-auto max-w-* px-6 py-* ` inner two-layer structure `custom_downloads`/
   `custom_settings` already use.

All five fixes verified by compiling their respective object files
directly; the `profile_impl.cc` fix regenerated its patch (`chrome-browser-profiles-profile_impl.cc.patch`)
since it's an upstream file — the other four are fork-owned files, no
patch regeneration needed. Runtime click-through testing was the user's
own, not the agent's, for this pass.

## Needs attention

No open gaps remain. `custom_settings_ui_old` and `vertical_tabs_page`
were both resolved by deletion; `custom_password_manager`/
`custom_sync_confirmation`/`custom_management` were all completed
2026-07-30 (see below).

### `custom_sync_confirmation` — completed 2026-07-30

Previously a 100% placeholder stub (see prior revisions of this doc) —
both buttons were rendered `disabled` with no event handlers, and
`custom_sync_confirmation_ui.cc` only set up the `WebUIDataSource`/CSP
with no `AddMessageHandler()` call. Resolved as the second Tier-1 item
from `FEATURE_DEEP_DIVE_ROADMAP.md`'s prioritization. Unlike the other
pages fixed this way, this one's `chrome://` host was already registered
(patched into `chrome_web_ui_controller_factory.cc`/
`chrome_web_ui_configs.cc` earlier) — the gap was purely the missing
handler.

The real upstream `chrome/browser/ui/webui/signin/sync_confirmation_handler.h/.cc`
is built around machinery this fork deliberately doesn't have —
`ConsentAuditorFactory` (legal consent-string recording),
`LoginUIServiceFactory` (native constrained-dialog close callback), and
`BrowserListObserver`/`Browser*` (native-window-resize plumbing) — none
of which exist anywhere else in `src/custom`. Rather than pull all of
that in, a new, deliberately lean
`custom/browser/ui/webui/sync_confirmation/custom_sync_confirmation_handler.h/.cc`
(`custom::CustomSyncConfirmationHandler`) was built as a plain, one-shot
`content::WebUIMessageHandler` — no observer base classes at all, since
the page fetches its state once on load and the user clicks exactly one
of three buttons, unlike `CustomSettingsHandler`'s persistent People
panel which needs live `IdentityManager`/`SyncService` observation.

Three messages: `customGetSyncConfirmationState` (real signed-in
account name/email via the same `FindExtendedAccountInfo` full-name →
given-name → email fallback `HandleGetSignInState` already uses, plus a
small sync-benefits list built from `syncer::UserSelectableType` +
`SyncUserSettings::IsTypeManagedByPolicy`), `customSyncConfirm` (both
"Yes, I'm in" and "Settings" — really enables sync via
`SyncUserSettings::SetInitialSyncFeatureSetupComplete`, using
`BASIC_FLOW` vs. `ADVANCED_FLOW_CONFIRM` to distinguish the two, matching
upstream's own basic/advanced-flow distinction), and `customSyncUndo`
("Cancel" — really signs out, reusing
`CustomSettingsHandler::HandleSignOut`'s exact
`IdentityManager::GetPrimaryAccountMutator()->ClearPrimaryAccount()`
call, with `signin_metrics::ProfileSignout::kAbortSignin` — a real enum
value whose own doc comment reads "signin process was aborted... so
signout", an exact semantic match rather than a repurposed one).

Since this page is a plain `chrome://` tab and not a native constrained
dialog, button clicks fire a `customSyncConfirmationClosed` WebUIListener
and the frontend navigates itself (`chrome://settings` for "Settings",
`chrome://newtab` otherwise) rather than closing a native window.

### `custom_management` — completed 2026-07-30

Previously a 100% placeholder stub (see prior revisions of this doc) —
`App.tsx` had no data fetch at all, and `custom_management_ui.cc` only
set up the `WebUIDataSource`/CSP with no `AddMessageHandler()` call.
Resolved as the third Tier-1 item from `FEATURE_DEEP_DIVE_ROADMAP.md`'s
prioritization. Like `custom_sync_confirmation`, this page's `chrome://`
host was already registered (patched into
`chrome_web_ui_controller_factory.cc`/`chrome_web_ui_configs.cc` earlier,
with the real upstream `ManagementUIConfig` compiled out via
`!BUILDFLAG(ENABLE_CUSTOM_WEBUI)`) — the gap was purely the missing
handler.

This is the **first fork WebUI handler to read real
`policy::PolicyService`/`ProfilePolicyConnector`/
`ChromeBrowserPolicyConnector` state** — not to be confused with the
fork's own unrelated `custom::SecurityPolicyManager`/
`UrlAccessController`/`FunctionControlManager` local-pref scaffolding
under `custom/chrome/browser/security/`, which has nothing to do with
real GPO/CBCM enterprise policy. New
`custom/browser/ui/webui/management/custom_management_handler.h/.cc`
(`custom::CustomManagementHandler`) computes the real managed-status
signal exactly like upstream (`ProfilePolicyConnector::IsManaged()` +
`ChromeBrowserPolicyConnector::HasMachineLevelPolicies()`), reuses the
real `chrome/browser/ui/managed_ui.h` free functions
(`GetManagementPageSubtitle`/`GetAccountManagerIdentity`/
`GetDeviceManagerIdentity`) rather than re-deriving the "managed by X"
string by hand, and observes `policy::PolicyService` for
`POLICY_DOMAIN_CHROME` so a page left open across a policy refresh
updates live via a `managedDataChanged` WebUIListener — the one place
this handler needs live observation, unlike the pure one-shot
`sync-confirmation` handler.

Six messages, matching upstream's non-promotion subset: `getContextualManagedData`,
`getExtensions` (policy-force-installed extensions with real permission
messages via `extensions::PermissionMessageProvider::
GetManagementUIPermissionIDs`, reusing the same `ExtensionRegistry`
dependency `CustomExtensionsHandler` already uses),
`initBrowserReportingInfo`/`initProfileReportingInfo` (real
`enterprise_reporting::kCloudReportingEnabled`/
`kCloudProfileReportingEnabled` prefs plus on-prem-reporting-extension
presence — simplified vs. upstream's per-datatype policy-schema parsing,
since this fork has no such extension policy schema to parse against),
`getManagedWebsites` (`ManagedConfigurationAPIFactory::GetForProfile`),
and `getApplications` (`WebAppProvider`'s `GetAppRunOnOsLoginMode` policy
check). Explicitly dropped: `getThreatProtectionInfo` (no
enterprise-connectors infrastructure exists in this fork), the whole GAIA
promotion-banner flow (`PromotionEligibilityChecker`/
`ManagementPromotionObserver` — no GAIA upsell relevant to a
local-profiles fork), device-signals consent messaging, and every
ChromeOS-only code path. Three new GN deps were needed on
`custom/browser/ui/webui/BUILD.gn`'s `:ui` target for the first time
(`//components/policy/core/common`, `//chrome/browser/web_applications`,
`//components/enterprise`) — `ProfilePolicyConnector`/
`ChromeBrowserPolicyConnector`/`managed_ui.h`/`ManagedConfigurationAPIFactory`
turned out to already be reachable transitively via the existing
`//chrome/browser/profiles`/`//chrome/browser/ui` deps, same situation as
`IdentityManagerFactory` before them.

### `custom_password_manager` — completed 2026-07-30

Previously a 100% placeholder stub (see prior revisions of this doc) —
`App.tsx` had no routing/state/IPC and
`custom_password_manager_ui.h/.cc` registered no `WebUIMessageHandler`.
Resolved as the first Tier-1 item from `FEATURE_DEEP_DIVE_ROADMAP.md`'s
prioritization.

Rather than duplicate the working Settings → Passwords logic
(`custom_settings/components/PasswordsPage.tsx` /
`custom_settings_handler.cc`) or attach the entire 76-message
`CustomSettingsHandler` monolith to a passwords-only page, the
password-handling code (list/remove, CSV export/import with OS reauth,
view/copy with OS reauth, add/edit, local weak/reused checkup, and
`BulkLeakCheckService` network leak-check plumbing) was **extracted**
into a new standalone handler:
`custom/browser/ui/webui/password_manager/custom_password_manager_handler.h/.cc`
(`custom::CustomPasswordManagerHandler`). This one handler is attached to
**both** `custom_settings_ui.cc` (Settings → Passwords keeps working
unchanged) and `custom_password_manager_ui.cc` (making
`chrome://password-manager` real for the first time) — mirroring
upstream Chromium's own `password_manager_ui.cc` pattern of several
small, focused handlers on one page rather than one god-object.

The one subtlety in the extraction: `CustomSettingsHandler`'s
`select_folder_dialog_` + `FileSelected()` were shared across four
unrelated pickers (folder, font file, password export, password
import) dispatched via boolean flags. The new handler got its own,
independent `password_file_dialog_` member and `FileSelected()`
override for just the two password-picker flags, rather than trying to
share the original dialog member across classes.

`custom/components/custom_password_manager/App.tsx` is now
`PasswordsPage.tsx`'s logic ported near-verbatim (same `cr.sendWithPromise`/
`chrome.send` messages, same C++ handler underneath), with the
Settings-page's self-referential "Open password manager" section dropped
(this page *is* that destination now) and a `/passwords/<host>` deep-link
path parsed on mount to pre-fill the filter box, so the Settings page's
"Open password manager" button now lands on a real, working page. See
[`password-manager-import-export.md`](../password-manager-import-export.md)
and
[`password-manager-view-edit-checkup.md`](../password-manager-view-edit-checkup.md)
for the underlying feature details (both docs describe functionality
that now lives on two pages instead of one).

### `vertical_tabs_ui/page/vertical_tabs_page.tsx` — removed (2026-08-16)

Previously documented here as "orphaned" and "not a stub" — direct
inspection when this decision finally got made showed neither framing was
quite right: the component was actually near-empty (`<div><h1>Vertical
Tabs UI</h1></div>`, ~40 of its 77 lines were commented-out boilerplate
copied from an unrelated page template), and no `.cc` file anywhere
registered a `WebUIConfig`/`WebUIController`/`chrome://` host for it —
confirmed unreachable from any URL, exactly as this doc said.

The deciding factor: Vertical Tabs configuration already has a full,
working home in `chrome://settings` — `custom_settings/components/
TabsPage.tsx`'s "Vertical tab bar" section (mode, zoom, exclusive-tree-open,
density, all bound to real prefs). This standalone page would have been a
second, empty surface for something that already ships and works, not a
genuinely missing feature. Resolved by **deletion** rather than finishing
it, mirroring `custom_settings_ui_old` below:

- Removed `custom/components/vertical_tabs_ui/` entirely (5 files:
  `BUILD.gn` ×2, `vertical_tabs_page.tsx`, `vertical_tabs_page.html`,
  `tsconfig.json`).
- Removed the dangling references: the dep + pak-source lines in
  `custom/components/resources/BUILD.gn`, the `<include>` line in
  `custom/components/resources/custom_components_resources.grd`, the dep
  in `custom/browser/ui/sources.gni`'s `custom_browser_ui_web_deps`, the
  stale reserved-ID entry in `custom/resources/resource_ids.spec`, and the
  dead `VerticalTabsUIConfig::IsWebUIEnabled` comment fragment in the
  unrelated `custom/browser/ui/webui/remote_ntp_internals_ui_config.cc`
  (that fragment was the one clue to what was once intended — a
  `WebUIConfig` gating availability on `TabService` existing, never
  finished).

GN gen and the `custom/components/resources:resources` target both built
clean before and after; no functional change, since nothing could reach
this page.

### `custom_settings_ui_old/page/` — removed (2026-07-19)

This was the pre-React-hub settings SPA (`custom_settings_page.tsx`, a
stray `.tsx.old` backup, `routes.tsx`, `contentIndex.ts`, and several
per-section view components). Confirmed dead — `custom_settings_ui.cc`
never referenced it, only the new `custom_settings/` hub — so it's been
deleted:

- Removed `custom/components/custom_settings_ui_old/` entirely (27
  files: `BUILD.gn`, the `page/` subdirectory, its `.tsx`/`.ts`/`.css`
  sources) from the `src/custom` fork repo.
- Removed the four dangling references: the `<include>` line in
  `custom/components/resources/custom_components_resources.grd`, the
  dep + pak-source lines in `custom/components/resources/BUILD.gn`, the
  dep in `custom/browser/ui/sources.gni`, and the dep in the *upstream*
  `chrome/browser/ui/BUILD.gn` (patched — `npm run update_patches`
  regenerated `chrome-browser-ui-BUILD.gn.patch` afterward).
- Removed an unused `#include` of the old page's generated grit header
  from `custom/browser/ui/webui/remote_ntp_internals_ui_config.cc` (an
  unrelated file it never should have been included from — nothing in
  that file referenced the symbols it provided).

Full build passed clean before and after; no functional change since
nothing could reach this page.

## Stale docs superseded by this one

Two existing knowledgebase pages describe a settings/vertical-tabs
architecture that **does not match the current code** — both predate the
React hub-and-spoke rewrite and were never updated:

- [`custom-settings-ui.md`](../custom-settings-ui.md) describes a
  fictional `custom_settings_ui/` directory with hand-written
  `.html`/`.js`/`.css` files and a `web_ui()` GN template that doesn't
  exist anywhere in this codebase — the real settings page is the React
  `custom_settings/` hub described above, built via the pipeline in
  `getting-started.md`. This doc should be rewritten or retired rather
  than treated as current.
- `custom-features-implementation.md`'s "Vertical Tabs UI" section (§3)
  and "Custom Settings UI" section (§4) both cite the wrong directory
  (`components/vertical_tabs_ui/` — removed 2026-08-16, see above — and
  `components/custom_settings_ui/` without the `page/`/hub-and-spoke
  detail) and, for vertical tabs, wrongly describe it as "Chrome Extension
  Architecture" — the actual, working Vertical Tabs UI is a Views-native
  feature plus a `chrome://settings` section, not an extension and not a
  standalone WebUI page. Treat this doc's WebUI sections as unreliable
  until corrected.
