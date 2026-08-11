# Browser versioning scheme (2026-07-28)

How this fork's own product version relates to the underlying Chromium
version it's built on, and how the two are kept from colliding in the
User-Agent string.

## The problem

`chrome/VERSION` is the single upstream mechanism that feeds `PRODUCT_VERSION`
everywhere in a Chromium build: the installer, the Win32 file version
resource, crash reporting, Omaha/update checks, Safe Browsing requests,
variations, and — critically — the literal `Chrome/X.Y.Z.W` token in the
User-Agent string. It has exactly four numeric fields: `MAJOR.MINOR.BUILD.PATCH`.

This fork wants to run its own product versioning on top of that (see
"Chosen scheme" below), which for the pieces of the number that matter most
means **not** using `MAJOR` to mean "the Chromium milestone" the way real
Chrome does. But the UA string's `Chrome/X.Y.Z.W` token is read from those
same four fields — if `MAJOR` stops being a real Chromium milestone, every
site that UA-sniffs the Chrome major version (extremely common, for feature
detection and "unsupported browser" checks) sees `Chrome/1` and treats the
browser as ancient or broken.

## Chosen scheme (finalized 2026-07-28)

`chrome/VERSION`'s four fields, repurposed:

| Field | Meaning | Rule |
|---|---|---|
| `MAJOR` | Chromium engine identity | **Must stay the real upstream Chromium milestone** — see "Why `MAJOR` can't be repurposed" below. Update whenever the fork rebases. |
| `MINOR` | This fork's own "major" version | Frozen at `1`. Bump only for an intentional "Wanderlust 2.0"-scale relaunch. |
| `BUILD` | Chromium-rebase counter | Increment by 1 every time the fork rebases onto a new upstream Chromium milestone (i.e., every time `MAJOR` changes). |
| `PATCH` | Everything else | Increment for every release cut in between Chromium rebases — new features or hotfixes alike. Reset to `0` whenever `BUILD` increments. |

`custom/build/commands/lib/build.py`'s `check_versions_match()` originally
compared `chrome/VERSION`'s `MINOR.BUILD.PATCH` against `package.json`'s
`version` field. This table describes the scheme as originally proposed
for those four `chrome/VERSION` fields; it was superseded by the
fully-separate `custom_product_version` (Brave-style) scheme below once
repurposing `chrome/VERSION` directly proved unsafe, and
`check_versions_match()` was later rewritten to match — see
"A fully separate product version" below for the current, actual check.

**Current values at the time this table was written:** `chrome/VERSION`
read `MAJOR=140 MINOR=1 BUILD=1 PATCH=0` — the real Chromium milestone
stayed in `MAJOR`, and `1.1.0` was already in place for the fork's own
tracking. `custom/package.json`'s version was fixed from a pre-existing,
unrelated mismatch (`1.0.0` — the `check_versions_match()` warning visible
in build logs throughout this whole thread) to `1.1.0` to match; the root
`package.json` already read `1.1.0`. **Superseded 2026-07-29**:
`chrome/VERSION`'s `MINOR=1 BUILD=1 PATCH=0` were themselves leftover
placeholder values from the abandoned `MAJOR=1` experiment below, never
actually restored to upstream's real values after that revert. Once
noticed, `chrome/VERSION` was reset to the genuine pristine upstream
values for the pinned Chromium tag — `MAJOR=140 MINOR=0 BUILD=7339
PATCH=210` — and `custom/patches/chrome-VERSION.patch` was deleted
entirely, since there's no longer any diff from upstream to patch. This
is now possible/safe precisely because the fork's own versioning moved
fully onto the separate `custom_product_version` (below); `chrome/VERSION`
no longer needs to hold any fork-specific value at all, not even in
`MINOR`/`BUILD`/`PATCH`.

### Why `MAJOR` can't be repurposed (tried and reverted, 2026-07-28)

The original ask was to freeze `MAJOR` at `1` (with `MINOR` as the
Chromium-rebase counter instead) — and the UA-decoupling work above was
specifically done to make that *look* safe, since the traditional UA string
and Client Hints no longer read `chrome/VERSION` at all. Tried setting
`MAJOR=1` directly and ran a full `chrome` build to verify — it broke in
two independent, fundamental ways tied to Chromium's own build-time code
generators, unrelated to anything UA-related:

1. **Flag-expiry generation** (`unexpire_flags_gen`) — Chromium generates a
   `BASE_FEATURE` entry per near-future milestone to auto-disable
   "unexpired" flags, computed as an offset from the current `MAJOR`. With
   `MAJOR=1` the computed offset went negative, producing a literally
   invalid C++ identifier: `BASE_FEATURE(kUnexpireFlagsM-1, ...)` — a
   hard compile error (`expected ';' after top level declarator`).
2. **Policy constants generation** — policy keys (e.g. `policy::key::
   kUserDataDir`) are generated from `policy_templates.json` only for
   policies whose `supported_on` version range includes the current
   `MAJOR`. With `MAJOR=1`, every real policy's range excluded it, so
   `chrome/browser/policy/policy_path_parser_win.cc`'s reference to
   `key::kUserDataDir` failed to compile — the generated constant simply
   didn't exist.

Both are **pre-existing Chromium build infrastructure**, not anything this
fork added, and both assume `MAJOR` is a realistic, contemporary milestone
number for version-relative arithmetic/range-checks — a hard constraint
that has nothing to do with the UA string. Reverted `MAJOR` back to `140`
immediately and re-verified with a full `chrome` build. Given this, the
frozen "`1`" the fork wants belongs in `MINOR` (as in the table above) —
which, conveniently, is exactly where it already was.

## UA-string decoupling (implemented 2026-07-28)

Since the UA string's `Chrome/X.Y.Z.W` token can no longer safely come from
`chrome/VERSION` once `MAJOR` stops tracking a real milestone, it's patched
to read a separate, dedicated constant instead — kept accurate independently
of whatever `chrome/VERSION` says.

**`custom/custom_browser_config.gni`**:
```gn
# Manually mirrors custom/package.json's config.projects.chromium.tag.
custom_chromium_base_version = "140.0.7339.210"
_custom_chromium_base_version_parts =
    string_split(custom_chromium_base_version, ".")
custom_chromium_base_major_version = _custom_chromium_base_version_parts[0]

custom_chrome_product_and_version_for_ua = "Chrome/$custom_chromium_base_version"
```
...exposed as buildflags `CUSTOM_CHROMIUM_BASE_VERSION_FOR_UA`,
`CUSTOM_CHROMIUM_BASE_MAJOR_VERSION_FOR_UA`, and
`CUSTOM_CHROME_PRODUCT_AND_VERSION_FOR_UA` via the existing
`custom_branding_flags` → `//build:branding_buildflags` mechanism (the same
one already used for `CUSTOM_OMAHA_PUBLIC_URL` etc.).

**Why a manually-mirrored literal, not read live from `package.json`:**
`custom/package.json`'s `config.projects.chromium.tag` holds this exact
value already, and reading it directly at gn-gen time looked like the
obvious "single source of truth" move. Two dead ends before landing here:

1. GN's `read_file(path, "json")` requires every key in the file to be a
   valid GN identifier. `package.json`'s npm `scripts` keys (e.g.
   `"build:optimized"`) aren't, so parsing the whole file fails outright
   (`Invalid identifier "build:optimized"`).
2. Falling back to `exec_script()` (to run a small Python helper that reads
   just the one JSON value, sidestepping GN's identifier restriction) hit a
   `script_executable="python3"` interpreter-resolution failure
   (`Could not execute interpreter. I was trying to execute ""`) specific to
   this dev environment, despite `python3` genuinely being reachable via
   `depot_tools`'s `python3.bat` shim for the real build process elsewhere.
   Root cause not fully chased down (possibly `exec_script()`-from-inside-a-
   `declare_args()`-block specifically, or something narrower to this
   machine) — not worth the risk of a flaky build-breaking dependency for a
   value that changes maybe twice a year.

Given both, a manually-kept-in-sync GN string literal was the pragmatic
choice: zero fragile runtime dependencies, one line to update whenever the
Chromium base is bumped. **Whoever rebases the pinned Chromium checkout must
update `custom_chromium_base_version` in `custom_browser_config.gni` by
hand, alongside `package.json`'s tag.**

**`components/version_info/version_info_with_user_agent.h/.cc`** (patched,
upstream files): both UA formats now read the custom constant under
`#if BUILDFLAG(CUSTOM_BROWSER)` (falling back to stock `PRODUCT_VERSION`
otherwise, so non-fork builds are unaffected):
- Full UA (`GetProductNameAndVersionForUserAgent()`): returns
  `BUILDFLAG(CUSTOM_CHROME_PRODUCT_AND_VERSION_FOR_UA)` directly — **not**
  `"Chrome/" BUILDFLAG(CUSTOM_CHROMIUM_BASE_VERSION_FOR_UA)`. `BUILDFLAG(X)`
  expands to a *parenthesized* expression (e.g. `("140.0.7339.210")`), which
  works fine as a plain assignment but breaks C++ string-literal-adjacency
  concatenation — `"Chrome/" ("140...")` parses as `"Chrome/"` being called
  as a function with argument `("140...")`, giving a real compile error
  (`called object type 'const char[8]' is not a function`). Pre-concatenating
  the whole `"Chrome/<version>"` token in GN sidesteps this entirely.
- Reduced UA (`GetProductNameAndVersionForReducedUserAgent()`): swaps
  `GetMajorVersionNumber()` for `BUILDFLAG(CUSTOM_CHROMIUM_BASE_MAJOR_VERSION_FOR_UA)`
  inside a `base::StrCat({...})` call — safe there since it's one
  comma-separated list element, not adjacency-concatenated.

**Deliberately not touched:** `version_info::GetVersionNumber()`/
`GetMajorVersionNumber()` themselves — the shared, global version source
read directly by Omaha/update-client, Safe Browsing (PVer4 client version),
crash reporting/crashpad annotations, and variations/field-trial seed
fetches. Masking those would corrupt update eligibility and crash-server
version bucketing; only the two UA-string-building functions were patched.

**Client Hints (patched 2026-07-28):** `Sec-CH-UA`/`navigator.userAgentData`
build their brand/version lists via a separate code path in
`components/embedder_support/user_agent_utils.cc`, not the
`version_info_with_user_agent` functions above. Three call sites there read
the real product version directly and needed the same treatment, all gated
behind `#if BUILDFLAG(CUSTOM_BROWSER)` with the stock behavior kept in the
`#else`:
- `GetUserAgentBrandMajorVersionListInternal()` — feeds the low-entropy
  `Sec-CH-UA`/`navigator.userAgentData.brands` list. Was
  `GetUserAgentBrandList(version_info::GetMajorVersionNumber(),
  std::string(version_info::GetVersionNumber()), ...)`; now passes
  `BUILDFLAG(CUSTOM_CHROMIUM_BASE_MAJOR_VERSION_FOR_UA)` /
  `BUILDFLAG(CUSTOM_CHROMIUM_BASE_VERSION_FOR_UA)` instead.
- `GetUserAgentBrandFullVersionListInternal()` — same swap, feeds the
  high-entropy `Sec-CH-UA-Full-Version-List`/
  `getHighEntropyValues(['fullVersionList'])`.
- `GetUserAgentMetadata()`'s `metadata.full_version = ...` assignment —
  feeds the (older, single-string) `getHighEntropyValues(['uaFullVersion'])`
  hint. Same swap to `BUILDFLAG(CUSTOM_CHROMIUM_BASE_VERSION_FOR_UA)`.

No adjacency-concatenation issue here (unlike the `version_info_with_user_agent.h`
patch) — these are plain function-call arguments and a plain assignment, not
string-literal concatenation, so `BUILDFLAG(X)`'s parenthesized expansion
works fine as-is. `components/embedder_support/user_agent_utils.cc` already
included `build/branding_buildflags.h` and its GN target
(`components/embedder_support:user_agent`) already depended on
`//build:branding_buildflags`, so no new includes or deps were needed.

Verified: to check the real value client-side, run in DevTools console:
```js
navigator.userAgentData.getHighEntropyValues(['fullVersionList']).then(console.log)
```

**Follow-up bug fixed the same day:** the first cut of the Client Hints
patch made the *product-name* brand entry ("Wanderlust") show the Chromium
base version too, instead of this fork's own product version — e.g.
`brands: [{Chromium, 140}, {Not=A?Brand, 24}, {Wanderlust, 140}]` and
`fullVersionList` showing `140.0.7339.210` for **both** Chromium and
Wanderlust. Root cause: `GenerateBrandVersionList()` (the shared helper
behind both brand-list functions) only accepts a single `version` string,
reused for both the `"Chromium"` entry and the product-name entry —
overriding that one value for the Chromium entry inadvertently overrode the
Wanderlust entry too.

Fixed by adding an optional trailing parameter,
`brand_only_version` (defaults to `std::nullopt`, so every other existing
caller — including all of `user_agent_utils_unittest.cc` — is unaffected):
```cpp
blink::UserAgentBrandList GenerateBrandVersionList(
    int seed,
    std::optional<std::string> brand,
    const std::string& version,
    blink::UserAgentBrandVersionType output_version_type,
    std::optional<blink::UserAgentBrandVersion> additional_brand_version = std::nullopt,
    std::optional<std::string> brand_only_version = std::nullopt);
```
When set, it overrides just the product-name entry's version, independent of
`version` (which still applies to the `"Chromium"` entry). `GetUserAgentBrandList()`
originally passed `version_info::GetMajorVersionNumber()`/`GetVersionNumber()`
as `brand_only_version` under `#if BUILDFLAG(CUSTOM_BROWSER)`, on the
assumption that those were "the real, un-overridden fork product version."
**That assumption was wrong** — those functions return `PRODUCT_VERSION`,
generated straight from `chrome/VERSION` (stayed `140.1.1.0` this whole
time), not this fork's own `custom_product_version`. Not caught until the
BUILD-field update below made the divergence between `custom_product_version`
(`1.7.25`) and `chrome/VERSION`'s leftover fields (`140.1.1.0`) large enough
to notice. Fixed 2026-07-28 by adding a `CUSTOM_PRODUCT_VERSION_MAJOR`
buildflag (mirroring the existing `CUSTOM_PRODUCT_VERSION`) and swapping
both `version_info::` calls for `BUILDFLAG(CUSTOM_PRODUCT_VERSION_MAJOR)`/
`BUILDFLAG(CUSTOM_PRODUCT_VERSION)`. End result: `"Chromium"` brand → real
pinned Chromium base version, `"Wanderlust"` brand → this fork's own
`custom_product_version` (now actually, not just nominally), `"Not=A?Brand"`
→ untouched (spec-mandated grease entry, unrelated to any of this — present
in every Chromium-based browser as an anti-fingerprinting/interop measure).
Verified by building `//components/embedder_support:user_agent` directly
(no compile errors) and regenerating patches.

## A fully separate product version (Brave-style, implemented 2026-07-28)

Given `MAJOR` can't be repurposed (previous section), the question became:
how does a fork like Brave or Vivaldi ship a clean "1.x.x"-looking version
at all, when they're also built from a real, large Chromium milestone? The
answer — confirmed by both public behavior (`chrome://version` in Brave
shows a separate "Brave version" and "Chromium version" side by side) and
by the constraints proved above (every fork has to build the same
milestone-dependent generators) — is that **`chrome/VERSION` stays
internal-only**, used purely for Chromium's own build-time tooling, and a
**fully independent product version string** drives everything a user
actually sees: About page, installer, and the Windows file-version
resource. This fork now does the same.

**`custom/custom_browser_config.gni`** — a new, wholly separate constant,
not derived from `chrome/VERSION` at all:
```gn
custom_product_version = "1.7.32"
custom_product_version_quad = "$custom_product_version.0"  # Win32 needs 4 fields
custom_product_version_major = "1"    # split from the quad
custom_product_version_minor = "7"
custom_product_version_build = "32"
custom_product_version_patch = "0"
```
Kept in sync by hand with `custom/package.json`'s top-level `version`
field (the actual pair `check_versions_match()` now compares — see below).
Exposed as `BUILDFLAG(CUSTOM_PRODUCT_VERSION)` via the existing
`custom_branding_flags` mechanism.

The `MINOR` field (`7`) is not arbitrary — it's the count of distinct
Chromium base-version upgrades this fork has gone through, counting the
initial commit's version as upgrade #1. Computed via:
```
git log --follow --reverse -p -- package.json | grep '"tag":'
```
against `custom/package.json`'s `config.projects.chromium.tag` field,
which returned 7 distinct tags corresponding to milestones 134 → 135 →
136 → 137 → 138 → 139 → 140. Future Chromium rebases should increment
this field by one each time, and reset `BUILD` (below) to `0` when they do.

The `BUILD` field (`32`, current value as of 2026-08-01) counts every
`feat:`/`fix:` commit landed in `src/custom` since the 140 rebase landed
(commit `303e6bf`, "chore: normalize line endings ... fix API drift from
140.0.7339.210 bump", 2026-07-09) up to `HEAD`:
```
git log 303e6bf..HEAD --format='%s'
```
13 `feat:` + 12 `fix:` = 25 as of 2026-07-29. The other 5 commits in that
range — 1 `build:`, 1 `refactor:`, 2 `chore:`, 1 `tools:` — were excluded
as non-user-facing housekeeping, consistent with the scheme table's own
wording: "increment for every release cut ... new features or hotfixes
alike." `+1` on 2026-07-30 for the profile picker/customization work
(completing both pages plus the `profile_impl.cc`/`rss_impl.cc` fixes
found while testing them) — landed as a single combined commit, so it's
one `BUILD` increment regardless of how many distinct bugs it fixed.
`+2` more, same day, for the `chrome://password-manager` work — landed as
two separate commits (one extracting `CustomPasswordManagerHandler` out
of `CustomSettingsHandler` and wiring it into both `custom_settings_ui.cc`
and `custom_password_manager_ui.cc`, a second porting
`PasswordsPage.tsx`'s logic into the standalone page's `App.tsx`), so it's
two `BUILD` increments. `+1` more, same day, for the
`chrome://sync-confirmation` work — landed as a single combined commit
covering the new `CustomSyncConfirmationHandler`, its UI wiring, and the
frontend. `+1` more, same day, for the `chrome://management` work —
landed as a single combined commit covering the new
`CustomManagementHandler` (the first fork handler to read real
`policy::PolicyService` state), its UI wiring, three new GN deps, and the
frontend. `+1` more, the next day (2026-07-31), for a roadmap cleanup
batch — one combined commit covering the `enable_custom_cc`/
`enable_tabstrip_logo` stale-comment fix, deleting nine confirmed-dead
duplicate security/policy stub files, and regenerating the ad-blocker's
bundled filter rules with real EasyList + EasyPrivacy data instead of a
~65-line hand-curated list. `+1` more, the next day (2026-08-01), for a
Tier-2 roadmap batch — one combined commit covering the DoH/ECH patch-
contradiction cleanup (`custom_dns_over_https_support` and its dead
`base::Feature`/buildflag removed entirely), the OAuth empty-client-id
guard + setup doc for `GoogleAuthProvider`/`MicrosoftAuthProvider`, the
real `chrome://whats-new` feed (new `CustomWhatsNewHandler` plus a
decoupled `WhatsNewEntry` table/endpoint added to the separate
`wanderlust-api` repo — not part of this fork's own version scheme, but
landing in the same commit), and the `chrome://intro` cross-browser
import wizard (new `CustomIntroHandler`, ported from the real,
previously-orphaned upstream `ImportDataHandler`). Recompute/increment
this count as further features and fixes land between Chromium rebases;
reset to `0` on the next rebase.

`custom_product_version` (`custom/custom_browser_config.gni`), both
`package.json` files' `version` fields, and this doc were all updated
together: first to `1.7.0` (once the rebase count was known), then to
`1.7.25` (once the feature/fix count since the 140 rebase was also
computed), then to `1.7.26` for the profile picker/customization commit,
then to `1.7.28` for the password-manager commit pair, then to `1.7.29`
for the sync-confirmation commit, then to `1.7.30` for the management
commit, then to `1.7.31` for the roadmap cleanup batch, then to `1.7.32`
for the Tier-2 batch (DoH/ECH cleanup, OAuth guard, What's New feed,
import wizard). (Versions `1.7.33` through `1.7.38` also landed following
this same one-bump-per-commit rule — see `changelog.md` for the
authoritative per-release detail; not reconstructed hunk-by-hunk here.)

For the 2026-08-09 rebase onto Chromium `141.0.7390.125`, `MINOR`
incremented from `7` to `8` (the 8th distinct Chromium base-version
upgrade this fork has gone through) and `BUILD` reset to `0` per the rule
above, giving `1.8.0` — see `changelog.md`'s 1.8.0 entry for everything
bundled into that release (the rebase itself, plus three runtime crashes
and a feature removal that manual QA testing turned up immediately
after). `custom_product_version` then bumped to `1.8.1` on 2026-08-10 —
the first `BUILD` increment since the 141 rebase — for the home-page
quick-pick presets feature, then to `1.8.2` the same day for the favicon
dominant-color tab tinting feature, then to `1.8.3`, same day, for
Settings WebUI responsive layout fixes (collapsing sidebar + reflowing
form grids) — all three prompted by the same feature-comparison review
(the third wasn't itself one of the reviewed features, but a real gap
found while verifying the review's claims), landed as three separate
commits/bumps since each is independently revertable.

**`check_versions_match()` rewritten** (`custom/build/commands/lib/
build.py`, 2026-07-28): previously compared `chrome/VERSION`'s
`MINOR.BUILD.PATCH` against `config.browser_version` — which itself
turned out to already be silently broken, since `config.chrome_version`
read `config.projects.chrome.tag` from `package.json`, a key that's never
existed (only `config.projects.chromium.tag` does), so the comparison was
unconditionally `"<chrome/VERSION-derived string>" != None` on every
build regardless of any of the version changes made in this whole
session. Given `chrome/VERSION` is now intentionally decoupled from the
product version entirely (previous section), the function was rewritten
to instead compare `custom_browser_config.gni`'s `custom_product_version`
directly against `package.json`'s top-level `version` field — the actual
pair of values that need to stay in sync by hand now — and drop the
`chrome/VERSION` comparison entirely. Verified by running the function
standalone with `1.7.25` in both places: no mismatch warning.

**About page**: `custom_settings_handler.cc`'s `HandleGetAboutInfo` "version"
field now returns `BUILDFLAG(CUSTOM_PRODUCT_VERSION)` (`"1.7.25"`) instead
of `version_info::GetVersionNumber()` (which is `chrome/VERSION`-derived —
`140.1.1.0` at the time this was written; `chrome/VERSION` was later reset
to pristine upstream values, `140.0.7339.210`, see above). The now-redundant `chromiumVersion`/"Build version" field was
removed entirely — it was neither the clean product version nor the real
Chromium base, just `chrome/VERSION`'s raw internal value, which per the
Brave pattern shouldn't be user-facing at all. `AboutPage.tsx`'s "Chromium
base" row was relabeled back to plain **"Chromium"**, since there's no
longer a competing "Chromium"-ish row to disambiguate against. End result:
exactly two version lines, "Version: 1.7.25" and "Chromium: 140.0.7339.210" —
matching Brave's own About-page shape.

**Windows file-version resource** (`chrome.exe`, `chrome.dll`, `setup.exe`,
`mini_installer.exe`): all four are generated via the same shared
`process_version_rc_template()` GN template
(`chrome/process_version_rc_template.gni`) → `process_version()`
(`build/util/process_version.gni`) → `build/util/version.py`, which
substitutes `@MAJOR@`/`@MINOR@`/`@BUILD@`/`@PATCH@` into
`chrome/app/chrome_version.rc.version`'s `FILEVERSION`/`PRODUCTVERSION`
block from whatever `-e VAR=value` arguments it receives (later ones
override earlier ones — `build/util/version.py`'s `GenerateValues()` parses
`chrome/VERSION` first, then applies `-e` overrides on top via a plain dict
update, so there's no conflict/duplicate-key error).

`process_version()` already had an `extra_args` parameter, applied *after*
the fork-wide `custom_process_version_arguments` default
(`build/util/process_version.gni:106-112`) — so rather than touching that
shared, every-`process_version()`-call default (which would risk also
overriding `chrome_version.h`'s `PRODUCT_VERSION` macro used by Omaha,
crash reporting, Safe Browsing, etc. — the exact thing we deliberately
avoided earlier), the override is scoped narrowly via `extra_args` at just
four specific call sites:
```gn
if (is_custom_browser) {
  extra_args = [
    "-e", "MAJOR=$custom_product_version_major",
    "-e", "MINOR=$custom_product_version_minor",
    "-e", "BUILD=$custom_product_version_build",
    "-e", "PATCH=$custom_product_version_patch",
  ]
}
```
— originally added to `chrome_exe_version`/`chrome_dll_version` in
`chrome/BUILD.gn`, `setup_exe_version` in `chrome/installer/setup/BUILD.gn`,
and `version` in `chrome/installer/mini_installer/BUILD.gn`.

### Full install-identity consistency (found + fixed 2026-07-29)

The "safety check" above (confirming nothing in install/upgrade/rollback
logic reads the *embedded* VERSIONINFO resource at runtime) was
**incomplete and wrong**. It checked `InstallUtil::GetChromeVersion` and
crash reporting, but missed several other places that independently derive
"the current version" from `chrome/VERSION`, all of which need to agree
with each other for an install to actually work. Found and fixed in two
passes after the first attempt broke every install.

**Pass 1 (temporary revert):** `chrome/installer/util/delete_old_versions.cc`
reads `chrome.exe`'s **embedded** FileVersionInfo to decide which
`Application\<version>\` subfolder is the "current" one to keep, deleting
any other version-named subfolder as a stray leftover:
```cpp
// GetExecutableVersionDirName() in delete_old_versions.cc
std::unique_ptr<FileVersionInfo> file_version_info(
    FileVersionInfo::CreateFileVersionInfo(exe_path));
return base::FilePath::FromUTF16Unsafe(file_version_info->file_version());
```
The actual subfolder was, at that point, still named after the real,
unmodified `chrome/VERSION` value (`140.0.7339.210`) — so once
`chrome_exe_version`/`chrome_dll_version`'s embedded resource said
`1.7.25.0`, every install immediately deleted its own freshly-extracted
`chrome.dll` as a "stray directory," leaving `Application\` with just a
shortcut-target stub and no working browser. Reported as "the installed
browser doesn't run, but the exe from the Release folder runs fine" (the
out-dir build isn't installed, so `chrome.dll` sits unversioned right next
to `chrome.exe` — no per-version-folder logic involved there at all).
First fix: reverted the override on `chrome_exe_version`/`chrome_dll_version`
entirely, restoring consistency at the cost of Explorer's Properties tab
showing `140.0.7339.210` instead of `1.7.25`.

**Pass 2 (full fix, done properly):** asked to make Explorer's Properties
tab *and* Windows Settings > Apps both show `1.7.25` after all. Tracing
further revealed the versioned-folder name and `DisplayVersion` registry
value are the *same* underlying quantity, computed by
`chrome/tools/build/win/create_installer_archive.py`'s `BuildVersion()` —
which parses `chrome/VERSION` directly (its own copy of the parsing logic,
independent of any GN variable). Achieving either display therefore
requires the *entire* install-identity chain to consistently use
`custom_product_version` instead of the real Chromium version — which,
done consistently, is actually safe (unlike reverting `chrome/VERSION`
itself, none of this touches the two build-time generators that need a
real milestone number). Four coordinated changes, all keyed off
`custom_product_version_quad` (`"1.7.25.0"`):

1. **`chrome/tools/build/win/create_installer_archive.py`** — new
   `--custom_browser_version` option; when passed, `main()` uses it as
   `current_version` instead of calling `BuildVersion()`. This is what
   names `Chrome-bin/<version>/` inside the archive (and therefore
   `Application\<version>\` after install) and what gets written as the
   `DisplayVersion`/`Version` registry values (`install_worker.cc`'s
   `new_version`, sourced from this same `current_version` via
   `GetMaxVersionFromArchiveDir`).
2. **`chrome/installer/mini_installer/BUILD.gn`** — passes
   `--custom_browser_version=$custom_product_version_quad` to the
   `mini_installer_archive` action, alongside the existing
   `--custom_browser_exe`.
3. **`chrome/app/version_assembly/BUILD.gn`** — `chrome_exe_version_manifest`
   (embedded in `chrome.exe`, declares the SxS dependent-assembly identity)
   and `version_assembly_manifest` (the archive's `<version>.manifest`,
   read by `create_installer_archive.py` to name the folder) both gained
   the same `custom_product_version`-based `extra_args`; the latter's
   *output filename* was also switched from `$chrome_version_full.manifest`
   to `$custom_product_version_quad.manifest`, since the archive script
   looks for an exact-name match.
4. **`chrome/BUILD.gn`** — re-added the `chrome_exe_version`/
   `chrome_dll_version` override from pass 1, now safe because everything
   above agrees with it.

**A second install-time consumer, found only by actually launching the
installed browser after the above:** even with the folder correctly named
`Application\1.7.25.0\` and containing a working `chrome.dll`, the
installed `Wanderlust.exe` failed to start
(`chrome/app/main_dll_loader_win.cc:138`, "Failed to load Chrome DLL... The
specified module could not be found"). `GetModulePath()` in that file
joins the exe's directory with `chrome::kChromeVersion` — a *fourth*,
independent version constant, generated from `CHROME_VERSION_STRING`
(`chrome/common/chrome_version.h`, via the `version_header` target, still
reading unmodified `chrome/VERSION`). Since `CHROME_VERSION_STRING` is also
used directly by 18 other files including `crash_reporting.cc` and the
Google Credential Provider, it was deliberately **not** overridden
fork-wide — instead, `chrome/common/chrome_constants.cc`'s `kChromeVersion`
definition was narrowly patched to use a new
`BUILDFLAG(CUSTOM_PRODUCT_VERSION_QUAD)` under `#if BUILDFLAG(CUSTOM_BROWSER)`,
leaving `CHROME_VERSION_STRING` itself, and every other consumer of it,
untouched. (Note: `BUILDFLAG(CUSTOM_PRODUCT_VERSION_QUAD)` was used as-is,
*not* concatenated with a literal — `BUILDFLAG(X) ".0"` hits the same
parenthesized-expansion/string-literal-adjacency issue documented above,
so the buildflag was defined to already be the full `"1.7.25.0"` quad.)

Verified end to end after all five changes: a clean install produces
`Application\1.7.25.0\chrome.dll` (survives `delete_old_versions.cc`'s
cleanup), `DisplayVersion`/`Version` registry values read `1.7.25.0`,
`Wanderlust.exe`'s embedded FileVersion/ProductVersion read `1.7.25.0`,
and the installed browser actually launches (multiple `Wanderlust.exe`
processes running from the installed path, no DLL-load error).

**One process note from testing, not a code bug:** after the temporary
revert in pass 1, a prior test install had registered `pv`/`Version`/
`DisplayVersion` as `140.0.7339.210` in the registry
(`HKCU\Software\Wanderlust\BrowserUpdate\Clients\{...}` and the Uninstall
key). Chromium's downgrade-protection (`IsDowngradeAllowed`,
`InstallProductsHelper` in `setup_main.cc`) then refused to install
`1.7.25.0` over that, since `1 < 140` numerically
(`HIGHER_VERSION_EXISTS`, exit code 4). This is an expected one-time
transition artifact for anyone with a pre-existing "real-Chromium-numbered"
install of this fork — resolved for testing by clearing the stale registry
subtree before reinstalling. A real user hitting this would need an
uninstall-first flow, or a downgrade-allowed override.

**Lesson**: a "confirmed nothing else reads this" safety check on a
version-identity override is only as good as the grep that produced it.
This one round needed four independent fixes because Chromium tracks
"the current installed version" through at least four separate,
independently-computed values (a Python script's own `chrome/VERSION`
parse, two separate `process_version()` GN calls, and a C++ header
macro) that must all agree — none of them reference each other, they're
each keyed off `chrome/VERSION` directly and happen to produce the same
string in a vanilla build.

## Files touched

- `custom/custom_browser_config.gni` — GN constants + buildflag entries for
  both `custom_chromium_base_version` (real pinned Chromium tag, drives the
  UA string) and `custom_product_version` (fork's own clean version, drives
  About page + file-version resources).
- `components/version_info/version_info_with_user_agent.h/.cc` (patched) —
  traditional UA string generation.
- `components/version_info/BUILD.gn` (patched) — added
  `//build:branding_buildflags` dep to the `version_info_with_user_agent`
  target.
- `components/embedder_support/user_agent_utils.h/.cc` (patched) — Client
  Hints (`Sec-CH-UA`/`navigator.userAgentData`) generation, including the
  `GenerateBrandVersionList()` `brand_only_version` param added for the
  Chromium-vs-Wanderlust brand-version follow-up fix.
- `chrome/BUILD.gn` (patched) — `extra_args` override on `chrome_exe_version`/
  `chrome_dll_version`; briefly reverted 2026-07-29 after breaking every
  install, then re-added once the rest of the install-identity chain
  (below) was made consistent with it.
- `chrome/installer/setup/BUILD.gn` (patched) — `extra_args` override on
  `setup_exe_version`.
- `chrome/installer/mini_installer/BUILD.gn` (patched) — `extra_args`
  override on the `version` target, plus `--custom_browser_version` passed
  to the `mini_installer_archive` action (2026-07-29).
- `chrome/app/version_assembly/BUILD.gn` (patched, 2026-07-29) —
  `chrome_exe_version_manifest`/`version_assembly_manifest` both gained
  `custom_product_version`-based `extra_args`; the latter's output
  filename switched from `$chrome_version_full.manifest` to
  `$custom_product_version_quad.manifest`.
- `chrome/tools/build/win/create_installer_archive.py` (patched, 2026-07-29)
  — new `--custom_browser_version` option overriding `BuildVersion()`'s
  `chrome/VERSION` parse.
- `chrome/common/chrome_constants.cc` (patched, 2026-07-29) — `kChromeVersion`
  narrowly switched to `BUILDFLAG(CUSTOM_PRODUCT_VERSION_QUAD)` under
  `#if BUILDFLAG(CUSTOM_BROWSER)`, leaving the widely-used
  `CHROME_VERSION_STRING` macro itself untouched for its other 17+
  consumers (crash reporting, credential provider, etc.).
- `custom/browser/ui/webui/settings/custom_settings_handler.cc` — `version`
  field now uses `custom_product_version`; removed the redundant
  `chromiumVersion` field.
- `custom/components/custom_settings/components/AboutPage.tsx` — removed
  the "Build version" row, relabeled "Chromium base" back to "Chromium".
- `custom/package.json` — `version` fixed from `1.0.0` to `1.1.0` to match
  `chrome/VERSION`'s existing `MINOR.BUILD.PATCH`.
- `chrome/VERSION` — tried `MAJOR=1`, reverted back to `MAJOR=140` (see
  "Why `MAJOR` can't be repurposed" above), leaving `MINOR=1 BUILD=1
  PATCH=0` as leftover placeholder values. Reset 2026-07-29 to the genuine
  pristine upstream values (`MINOR=0 BUILD=7339 PATCH=210`) once no longer
  needed for anything fork-specific; `chrome-VERSION.patch` deleted since
  there's no longer any diff from upstream.

Verified with a full `chrome` build (compiles and links clean) after each
round of changes — including after the `MAJOR=1` revert — and by directly
inspecting each generated `.rc` file's substituted values, before
regenerating patches.
