# Privacy Hardening Backlog

Features identified from the `chromium-project` reference repo (Bromite, Washezium, Inox,
Ungoogled Chromium, Advanced Chrome patch). Ordered by implementation priority.

Source repo: `D:\Code\_To_Use\_chromium\chromium-project`

---

## Tier 1 — Low Complexity, High Value

Simple pref-default flips and single-point flag changes. Target: one patch each.

- [x] **Disable Field Trials** *(Bromite)*
  Blocks Google from pushing runtime experimental configs. Implemented via
  `BUILDFLAG(CUSTOM_BROWSER)` guard in `components/variations/service/variations_service.cc`
  — `IsFetchingEnabled()` returns `false` and `StartRepeatedVariationsSeedFetch()` is skipped.

- [x] **Disable RLZ Tracking** *(Inox)*
  No source change needed — `enable_rlz = is_chrome_branded && enable_rlz_support`.
  Since our build is not chrome-branded, `BUILDFLAG(ENABLE_RLZ)` is `false` and all
  RLZ pinging is already compiled out.

- [x] **Disable Google URL Tracker** *(Washezium)*
  `GoogleURLTracker` is not present in modern Chromium (removed upstream). N/A.

- [x] **Disable GCM Status Checks** *(Washezium / Inox)*
  `BUILDFLAG(CUSTOM_BROWSER)` early-return guards added to `InitializeMCSClient()`,
  `StartCheckin()`, and `SchedulePeriodicCheckin()` in
  `components/gcm_driver/gcm_client_impl.cc`. `ToCheckinProtoVersion()` helper wrapped
  in `#if !BUILDFLAG(CUSTOM_BROWSER)`. Added `build/branding_buildflags.h` include.

- [x] **Disable Update Pings** *(Inox)*
  Already guarded — custom `UpdateManager` replaces Google update infrastructure.
  Registry paths and GUIDs are conditionally defined in
  `chrome/installer/util/google_update_constants.cc`.

- [ ] **Block `trk:` Scheme** *(Ungoogled / Washezium)*
  Registers `trk:` as a blocked URL scheme so any URL using it (common in some
  builds as a tracking-request marker) is silently dropped.
  *Skipped* — noted as crash-prone when used in `gaia_urls.cc`; per-service disables
  achieve the same result without stability risk.

- [x] **Privacy Preference Defaults** *(Washezium — ~10 patches)*
  Flip default prefs at registration time with `BUILDFLAG(CUSTOM_BROWSER)` guards:
  - [x] Block third-party cookies by default (`cookie_settings.cc` → `kBlockThirdParty`)
  - [x] Enable Do-Not-Track header by default (`tracking_protection_prefs.cc` → `true`)
  - [x] Disable autofill upload by default — autofill profile/card already default `false`
  - [x] Disable network prediction / prefetch by default (`preloading_prefs.cc` → `kDisabled`)
  - [x] Disable search suggestions by default (`profile.cc` → `false`)
  - [ ] Keep cookies only until browser exit by default — no matching pref found; handled by content settings
  - [x] Prompt for download directory by default (`download_prefs.cc` → `true`)
  - [x] Disable background mode by default (`background_mode_manager.cc` → `false`)
  - [x] Disable translation offer by default (`browser_ui_prefs.cc` → `false`)

---

## Tier 2 — Medium Complexity, High Value

Require new UI surface or non-trivial backend changes.

- [x] **DNS-over-HTTPS UI** *(Bromite)*
  Already implemented. `kDnsOverHttpsMode` defaults to `"automatic"` in `custom_prefs.cc`.
  Toggle exposed in `PrivacyPage.tsx`. Custom `PrivateDnsManager` handles advanced routing.

- [x] **Client Hints Override** *(Bromite)*
  Two-layer block in `third_party/blink/common/client_hints/`:
  - `IsClientHintSentByDefault()` returns `false` for CUSTOM_BROWSER → suppresses low-entropy
    defaults (`Sec-CH-UA`, `Sec-CH-UA-Mobile`, `Sec-CH-UA-Platform`, `Save-Data`)
  - `SetIsEnabled()` is a no-op for CUSTOM_BROWSER → `Accept-CH` response headers are
    ignored; servers cannot opt into high-entropy hints (`Sec-CH-UA-Arch`,
    `Sec-CH-UA-Full-Version-List`, `Sec-CH-UA-Platform-Version`, etc.)

- [x] **Network Isolation Hardening** *(Bromite)*
  Four features changed from `DISABLED_BY_DEFAULT` → `ENABLED_BY_DEFAULT` for CUSTOM_BROWSER
  in `net/base/features.cc`:
  - `kSplitCacheByIncludeCredentials` — partition HTTP cache by credential state
  - `kSplitCacheByNetworkIsolationKey` — partition HTTP cache by NIK (top-frame + frame site)
  - `kSplitCodeCacheByNetworkIsolationKey` — partition JS/WASM code cache by NIK
  - `kPartitionConnectionsByNetworkIsolationKey` — isolate TCP/QUIC connection pools
  Also enabled `kContentSettingsPartitioning` in `components/content_settings/core/common/features.cc`
  (partitions site permissions by top-level site). `kSplitCacheByCrossSiteMainFrameNavigationBoolean`
  and `kThirdPartyStoragePartitioning` were already `ENABLED_BY_DEFAULT`.

- [x] **Supercookie Mitigation — Favicon Cache Isolation** *(Bromite)*
  Covered by network isolation: enabling `kSplitCacheByNetworkIsolationKey` partitions the
  HTTP cache used for favicon fetches by top-level origin. The Blink memory-cache rewrite
  (per Bromite's `Partition-Blink-memory-cache.patch`) is skipped as too invasive for this
  Chromium version; the HTTP cache layer isolation provides the primary protection.

---

## Tier 3 — High Complexity, Medium Value

Significant implementation effort; tackle after Tier 1 & 2 are complete.

- [x] **Enhanced Download System** *(Advanced Chrome patch)*
  Custom download shelf with prompt-based workflow, per-item action menus, and
  download filtering. Already fully implemented across 34 patches: custom
  `DownloadOptionsShelf`, `DownloadOptionsItemView`, `DownloadOptionsShelfView`,
  and `CustomDownloadButton` in `custom/browser/ui/views/`.

- [x] **Reader Mode UI** *(Advanced Chrome patch)*
  Desktop toolbar button implemented in `custom/browser/ui/views/toolbar/reader_mode_button.cc`.
  `ReaderModeButton` extends `ToolbarButton`, observes `TabStripModel` (active tab
  changes) and `CustomReaderModeManager` (availability/state events). Button is
  hidden by default and shown only when `GetReaderModeState()` returns `kAvailable`,
  `kActive`, or `kDistilling`. Pressing calls `ToggleReaderMode()`. Wired into
  `ToolbarView::Init()` after `location_bar_`, guarded by `BUILDFLAG(ENABLE_READER_MODE)`.

---

## Skipped / Out of Scope

| Feature | Reason |
|---|---|
| Kiwi extensions patch | Extensions already supported |
| Bromite Android-specific features | Desktop-only build |
| Brave crypto / wallet | Out of scope |
| Sidebar patch (Vue/Vuetify) | Different framework from existing sidebar |
| Ungoogled domain substitution | Requires their full build infrastructure |
| Inox/Washezium safe browsing disable | Safe browsing is useful; hardening preferred over removal |
| WebGL/WebRTC disable | Too breaking for general users; expose as opt-in pref instead |
