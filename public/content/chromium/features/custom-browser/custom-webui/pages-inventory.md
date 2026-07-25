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
`custom_management`, `custom_password_manager`, `custom_print`,
`custom_privacy_shield`, `custom_profile_customization`,
`custom_profile_picker`, `custom_proxy_routing`, `custom_reader`,
`custom_sync_confirmation`, `custom_tab_search`, `custom_terms`,
`custom_top_sites` (backed by the `most_visited` handler/controller, not
a `custom_top_sites_ui.cc` — same naming mismatch as `custom_settings`
below, just older), `custom_tracking_dashboard`, `custom_whats_new`.

That's 26 single-purpose pages, live and code-complete.

### Multi-page hubs

- **`custom_settings/`** — the live settings surface. Not one page but a
  hub-and-spoke app: ~30 sub-pages under `components/*Page.tsx`
  (Appearance, Privacy, Downloads, etc.), routed client-side, backed by
  `custom_settings_ui.cc` + `custom_settings_handler.cc`. This is what
  `chrome://settings` (or whatever this fork's settings host is) actually
  serves.
- **`custom_sidebar/pages/`** — five sub-pages (Bookmarks, History, Notes,
  NtpSettings, Rss) backed by the sidebar handler/controller. See
  [`custom-webui/sidebar.md`](./sidebar.md) for the RSS-adjacent detail on
  this one, and [`custom-webui/rss-reader.md`](./rss-reader.md) for the
  reader page specifically.

### Native-only (no React frontend)

- **`adblock_settings`** — has a native handler directory
  (`custom/browser/ui/webui/adblock_settings/`) but no matching
  `custom/components/custom_adblock_settings/` React app anywhere in the
  tree. Either genuinely native-only (served some other way) or an
  incomplete page — worth a follow-up look if adblock settings are
  supposed to have a dedicated UI.
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

## Needs attention

One real gap remains (a second, `custom_settings_ui_old`, was resolved by
deletion — see below):

### `vertical_tabs_ui/page/vertical_tabs_page.tsx` — orphaned frontend

The React component is real (not a stub) and its build target
(`vertical_tabs_page_generated`) is wired into
`custom/browser/ui/sources.gni` and `custom/components/resources/BUILD.gn`,
so it **compiles and gets packed into resources**. But **no `.cc` file
anywhere registers a `WebUIConfig`/`WebUIController`/`chrome://` host for
it** — grepping the whole `custom/browser/ui/webui/` tree for anything
that would serve this page turns up nothing live.

The one clue to what was intended: `custom/browser/ui/webui/remote_ntp_internals_ui_config.cc`
(an otherwise-unrelated file for the `chrome://remote-ntp-internals` page)
contains a dead, commented-out fragment:

```cpp
// bool VerticalTabsUIConfig::IsWebUIEnabled(
//     content::BrowserContext* browser_context) {
//       Profile* profile = Profile::FromBrowserContext(browser_context);
//       auto* service = TabServiceFactory::GetForProfile(profile);
//       return service != nullptr;
// }
```

Someone started scaffolding a `VerticalTabsUIConfig` (presumably gating
the page's availability on `TabService` existing, mirroring how the
native vertical tab bar checks the same service), left it commented out
in a file it doesn't belong in, and never finished the `WebUIController`
side. The page is currently unreachable from any URL.

**This needs a decision**, not just a docs fix: either finish wiring it
(a real `VerticalTabsUIConfig`/`VerticalTabsUI` pair following the
`getting-started.md` pattern, presumably for some settings/companion
surface distinct from the native `VerticalTabBar` Views implementation
that's the actual feature — see `vertical-tabs.md`), or remove the
orphaned React page and build wiring if it's superseded by the native
implementation and no longer needed.

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
  (`components/vertical_tabs_ui/` and `components/custom_settings_ui/`
  without the `page/`/hub-and-spoke detail) and, for vertical tabs,
  wrongly describe it as "Chrome Extension Architecture" — it's a native
  WebUI page candidate (currently orphaned, see above), not an
  extension. Treat this doc's WebUI sections as unreliable until
  corrected.
