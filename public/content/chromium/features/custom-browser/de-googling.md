# De-Googling

Measures applied to reduce or eliminate Chromium's data flows to Google
infrastructure. Organised as three independent layers that each address a
different failure mode.

---

## Layer 1 — Telemetry pruning (build-time)

**Script:** `src/custom/build/commands/lib/applyTelemetryPruning.py`  
**Lists:** `src/custom/build/telemetry/`

Two complementary techniques, both applied before `gn gen`:

### File pruning (`pruning.list`)

Source files are physically deleted before compilation. These files implement
Google telemetry surfaces we do not want in the binary at all.

| File deleted | What it removed |
|---|---|
| `chrome/browser/ui/uma_browsing_activity_observer.cc/h` | UMA browsing activity crash-report dialog |
| `components/domain_reliability/uploader.cc/h` | Domain Reliability Monitor network upload |
| `components/variations/service/variations_field_trial_creator.cc/h` | A/B test config download from Google field trial servers |
| `chrome/browser/safe_browsing/chrome_password_reuse_detection_manager_client.cc/h` | Safe Browsing password-reuse event reporter |

### Domain substitution (`domain_substitution.list`)

Regex replacements applied to source files redirect known Google telemetry
endpoint domains to non-routable `.invalid` equivalents. Even if a code path
fires accidentally, no data reaches Google.

| Endpoint blocked | Purpose |
|---|---|
| `www.google-analytics.com`, `ssl.google-analytics.com` | Google Analytics |
| `clients2.google.com`, `update.googleapis.com` | Crash/metrics reporting |
| `optimization-hints.pa.googleapis.com` | Optimization Guide hints upload |
| `privacysandbox.googleapis.com` | Privacy Sandbox reporting |
| `safebrowsing.googleapis.com`, `safebrowsing.google.com` | Safe Browsing update/reporting |
| `clients4.google.com` | Domain Reliability Monitor + Chrome Sync |
| `clientservices.googleapis.com` | Variations / field trial seed |
| `www.googleapis.com/geolocation` | Geolocation service |
| `uma-export.googleplex.com` | UMA reporting |

---

## Layer 2 — Feature flag overrides (compile-time, `BUILDFLAG(CUSTOM_BROWSER)`)

`BASE_FEATURE` definitions flipped to `DISABLED_BY_DEFAULT` to prevent these
subsystems from executing in the renderer or browser process.

### Optimization Guide

**File:** `components/optimization_guide/core/optimization_guide_features.cc`

| Flag | Upstream | Our default | Effect |
|---|---|---|---|
| `kRemoteOptimizationGuideFetching` | ENABLED | **DISABLED** | No URL hints uploaded to Google for page-load "suggestions" |
| `kModelQualityLogging` | ENABLED | **DISABLED** | No model inference quality logs sent to Google |
| `kOptimizationGuideModelExecution` | ENABLED | **DISABLED** | No on-device model execution triggered by Optimization Guide |
| `kOptimizationGuideModelDownloading` | ENABLED (with TFLite) | **auto-DISABLED** | Disabled automatically when `build_with_tflite_lib=false` |

### Privacy Sandbox

**File:** `services/network/public/cpp/features.cc`

| Flag | Upstream | Our default | Effect |
|---|---|---|---|
| `kInterestGroupStorage` | ENABLED | **DISABLED** | Kills the FLEDGE/Protected Audience Interest Group API at the network layer — no storage, no auction |

**File:** `chrome/common/chrome_features.cc`

| Flag | Upstream | Our default | Effect |
|---|---|---|---|
| `kKAnonymityService` | ENABLED | **DISABLED** | No k-anonymity join/query requests to `chromekanonymityauth-pa.googleapis.com` |

### NTP / Shopping

**File:** `components/search/ntp_features.cc`

| Flag | Upstream | Our default | Effect |
|---|---|---|---|
| `kNtpChromeCartModule` | ENABLED | **DISABLED** | Chrome Cart / shopping history module removed from NTP |

### HTTPS-First Mode

**File:** `chrome/common/chrome_features.cc`

| Flag | Upstream | Our default | Effect |
|---|---|---|---|
| `kHttpsFirstModeV2ForTypicallySecureUsers` | DISABLED | **ENABLED** | Auto-enables HTTPS-First Mode for users whose browsing is predominantly HTTPS |

> `kHttpsFirstModeIncognito` is already `ENABLED_BY_DEFAULT` upstream — no change needed.

---

## Layer 3 — Pref defaults (runtime, `BUILDFLAG(CUSTOM_BROWSER)`)

Default values changed so users get privacy-safe behaviour out of the box
without needing to configure anything. All can be overridden in Settings.

### HTTPS-Only Mode enabled by default

**File:** `chrome/browser/ui/browser_ui_prefs.cc`  
**Pref:** `prefs::kHttpsOnlyModeEnabled` (`"https_only_mode_enabled"`)

| | Value |
|---|---|
| Upstream default | `false` |
| Our default | **`true`** |

Pairs with `kHttpsFirstModeV2ForTypicallySecureUsers` (Layer 2). HTTPS-Only
Mode blocks navigation to HTTP URLs and shows an interstitial; users can
proceed or add a per-site exception.

### 3P cookie deprecation enabled by default

**File:** `components/privacy_sandbox/tracking_protection_prefs.cc`  
**Pref:** `prefs::kTrackingProtection3pcdEnabled`
(`"tracking_protection.tracking_protection_3pcd_enabled"`)

| | Value |
|---|---|
| Upstream default | `false` |
| Our default | **`true`** |

Enables third-party cookie blocking (Chrome's "Mode B" tracking protection).
Controls whether the browser enforces 3PCD partitioning rules.

### DNS-over-HTTPS forced to Secure mode (Cloudflare)

**File:** `chrome/browser/net/default_dns_over_https_config_source.cc`  
**Prefs:** `prefs::kDnsOverHttpsMode`, `prefs::kDnsOverHttpsTemplates`

| | Value |
|---|---|
| Upstream default | mode=`"automatic"`, template=`""` |
| Our default | mode=`"secure"`, template=`"https://chrome.cloudflare-dns.com/dns-query"` |

Forces all DNS over Cloudflare DoH. Users can change provider or revert to
automatic in Settings → Privacy and Security → Security → Use secure DNS.

### Privacy Sandbox M1 API prefs

**File:** `components/privacy_sandbox/privacy_sandbox_prefs.cc`

Already `false` upstream — no change needed.

| Pref | Upstream default |
|---|---|
| `kPrivacySandboxM1TopicsEnabled` | `false` ✓ |
| `kPrivacySandboxM1FledgeEnabled` | `false` ✓ |
| `kPrivacySandboxM1AdMeasurementEnabled` | `false` ✓ |

---

## Recommended production args.gn additions

These GN args further reduce Google dependency but require a full `gn gen`
rerun after adding. They are not yet in the default debug `args.gn` but should
be applied for release builds.

| Arg | Value | Effect |
|---|---|---|
| `safe_browsing_mode` | `0` | Compiles out the entire Safe Browsing subsystem (endpoints already blocked by domain substitution) |
| `enable_compose` | `false` | Removes AI writing assistant and Google model execution infrastructure |
| `build_with_tflite_lib` | `false` | Removes TFLite model download/execution; auto-disables `kOptimizationGuideModelDownloading` |

> **Codec args** (`proprietary_codecs=true`, `ffmpeg_branding="Chrome"`,
> `enable_hevc_parser_and_hw_decoder=true`) require H.264/H.265/AAC
> distribution licences — legal sign-off needed before applying.

---

## Future work

Items are grouped by effort. All "easy flag flips" follow exactly the same
`#if BUILDFLAG(CUSTOM_BROWSER)` pattern used in Layer 2 above.

---

### Easy flag flips (same pattern as Layer 2)

**`kIpProtectionV1` → DISABLED**  
File: `components/ip_protection/` or `chrome/common/chrome_features.cc`  
IP Protection proxies third-party subresource requests through Google-operated
two-hop QUIC proxies and requires a Google account for token issuance. Disabling
removes the outbound Google proxy dependency entirely.

**`kHttpsFirstModeForAdvancedProtectionUsers` → DISABLED**  
File: `chrome/browser/ssl/https_upgrades_util.cc` or `https_first_mode_settings_tracker.cc`  
This feature auto-enables HTTPS-First Mode based on whether the user is enrolled
in Google's Advanced Protection Program (requires Google sign-in). Disabling it
ensures HTTPS-First Mode is controlled only by our own pref default.

**`kTailoredSecurityIntegration` → DISABLED**  
File: `chrome/browser/safe_browsing/` features file  
Monitors Google account state and silently auto-enables Enhanced Protection
(which sends full URLs to Google in real time). Disabling it prevents a Google
account sign-in from overriding the user's Safe Browsing pref.

**`kTranslateRankerQuery` + `kTranslateRankerEnforcement` → DISABLED**  
File: `components/translate/core/browser/` features file  
These flags control downloading a TFLite ranker model from `www.gstatic.com`
and using it to decide whether to show translate prompts. Disabling stops the
model download; the translate prompt still appears but uses a simple heuristic.

**`kJourneys` → DISABLED**  
File: `components/history_clusters/core/features.cc`  
Removes the AI-grouped "Journeys" view from `chrome://history`. The remote
OptimizationGuide dependency is already blocked, but this removes the UI surface
and any local computation overhead.

**`kMediaRouter` → DISABLED** *(if Cast is not used)*  
File: `chrome/common/chrome_features.cc`  
Disables the entire Cast/Media Router subsystem. If Cast is not a target
feature, this removes a significant slab of Google-related infrastructure.
Verify against Cast usage before applying.

**`kBrowsingTopics` — verify disabled**  
File: `third_party/blink/common/features.cc`  
The Topics API. Likely already `DISABLED_BY_DEFAULT` on non-branded builds but
should be confirmed. If enabled, flip to `DISABLED_BY_DEFAULT` under
`BUILDFLAG(CUSTOM_BROWSER)`.

---

### Permission hardening flags (improvements, not de-Googling)

These are privacy/UX improvements unrelated to Google dependencies. Same
flag-flip pattern; file is `components/permissions/features.cc`.

| Flag | Change | Effect |
|---|---|---|
| `kOneTimePermission` | → ENABLED | Camera/microphone grants expire at session end rather than being permanent |
| `kBlockPromptsIfDismissedOften` | → ENABLED | Auto-blocks permission prompts on sites that have been dismissed repeatedly |
| `kBlockRepeatedNotificationPermissionPrompts` | → ENABLED | Stops sites from re-prompting for notifications after the user dismissed once |
| `kRecordPermissionExpirationTimestamps` | → ENABLED | Enables time-limited permission grants |

---

### Pref defaults (same pattern as Layer 3)

**Local Sync LoopbackServer**  
File: `components/sync/service/sync_prefs.cc` — find `kEnableLocalSyncBackend` registration  
Set default to `true`. Activates Chromium's built-in `LoopbackServer`, which
stores sync data locally with no network access. This is cleaner than relying
on domain substitution alone — instead of silent network timeouts, Sync settings
show a working (local) sync state. Complexity: 1/5.

**Safe Browsing prefs** *(only if `safe_browsing_mode=0` is not applied)*  
File: `components/safe_browsing/core/common/safe_browsing_prefs.cc`  
Flip defaults to `false` under `BUILDFLAG(CUSTOM_BROWSER)`:
- `prefs::kSafeBrowsingEnabled`
- `prefs::kSafeBrowsingScoutReportingEnabled`
- `prefs::kSafeBrowsingExtendedReportingOptInAllowed`

With `safe_browsing_mode=0` these prefs are compiled out and this is moot.

**Autofill Google Pay sync**  
Disable `AUTOFILL_WALLET_DATA` sync type to remove Google Pay server card
dependency from autofill. Local address and card storage is unaffected.

---

### One C++ override

**`IsInterestGroupAPIAllowed()` → return false**  
File: `chrome/browser/chrome_content_browser_client.cc`  
Override `ChromeContentBrowserClient::IsInterestGroupAPIAllowed()` to always
return `false`. This is a compile-time kill switch for the FLEDGE/Protected
Audience API that works independently of the `kInterestGroupStorage` feature
flag — belt-and-suspenders for the Interest Group API.

---

### Component Updater audit

After applying `safe_browsing_mode=0` and `build_with_tflite_lib=false`,
several component updater registrations may still be active and contacting
Google CDN. Review `chrome/browser/component_updater/registration.cc` and
remove or stub registrations for components that are no longer needed:

| Component | Downloads from | Safe to remove? |
|---|---|---|
| Fingerprinting protection ruleset | Google CDN | Yes — bundle statically (see below) |
| Safety Tips | Google CDN | Yes — if not using Safe Browsing |
| Privacy Sandbox Attestations | Google CDN | Yes — FLEDGE/Topics disabled |
| Gemini Nano (`kPromptApi`) | Google CDN | Yes — `window.ai` not exposed |
| SODA (Live Captions) | Google CDN | Only if Live Captions not a target feature |
| Translate Ranker Model | gstatic.com | Yes — disabled by flag flips above |

---

### Fingerprinting Protection Filter (bundled ruleset required)

`kEnableFingerprintingProtectionFilter` gates a request-level fingerprinting
script blocker (separate from the existing canvas noise and font protection).
Enabling it requires:

1. Compiling a filter ruleset to the subresource_filter binary protobuf format
   (EasyPrivacy or uBlock Origin "privacy" list is a good source).
2. Registering the bundled ruleset with `RulesetService` at startup instead of
   the component updater path.
3. Flipping `kEnableFingerprintingProtectionFilter` to `ENABLED_BY_DEFAULT` and
   setting `kActivationLevel` to enabled under `BUILDFLAG(CUSTOM_BROWSER)`.

Key file: `components/fingerprinting_protection_filter/browser/`  
Component installer reference: `chrome/browser/component_updater/afp_blocked_domain_list_component_installer.cc`

---

### MV2 extension API re-enablement

Chromium enforces Manifest V3 restrictions on `background.persistent` and
`webRequestBlocking` via `max_manifest_version:2` gates in the extension
feature JSON files. Removing these gates allows extensions like uBlock Origin
(legacy MV2) to use persistent background pages and blocking `webRequest`,
which is significantly more capable than `declarativeNetRequest`.

Files to modify:
- `extensions/common/api/_manifest_features.json` — remove `max_manifest_version:2` on `background.persistent`
- `extensions/common/api/_permission_features.json` — remove `max_manifest_version:2` on `webRequestBlocking`

---

### Longer-term / separate projects

| Project | Complexity | Description |
|---|---|---|
| **Custom translate service** | 3/5 | Host a JS translation shim at your own CDN. Set via `--translate-script-url` and `--translate-security-origin` switches. Remove the `google_apis::GetAPIKey()` gate in `translate_manager.cc`. Disable `kTranslateRankerQuery`. |
| **Custom sync server** | 4/5 | Implement `HttpPostProviderFactory` pointing at a self-hosted server using the same protobuf schema. Replace `SyncAuthManager`'s `IdentityManager` with a stub for your own OAuth2/OIDC provider. Remove FCM (Firebase) invalidations. |
| **Custom identity provider** | 4/5 | Replace Gaia/DICE sign-in with your own OIDC provider. Implement `ProfileOAuth2TokenServiceDelegate`, strip `DiceResponseHandler` and `AccountReconcilor` from `chrome/browser/signin/`. |
| **Self-hosted Safe Browsing** | 4/5 | Keep `safe_browsing_mode=1`, patch all six URL constants in the Safe Browsing files, operate a V4-compatible threat feed server and RFC 9458 OHTTP relay. |
| **Custom LLM via `window.ai`** | 4/5 | Implement the ChromeML C ABI (`services/on_device_model/ml/chrome_ml_api.h`) against llama.cpp or ONNX Runtime. Change `ModelExecutionAPI` status from `test` to `stable` in `runtime_enabled_features.json5`. |
| **Custom translate service** | 3/5 | As above — redirect `translate.googleapis.com` to self-hosted endpoint via a `URLLoaderThrottle` following the `UAOverrideThrottle` pattern. |

---

## Related docs

- [security-privacy-features.md](security-privacy-features.md) — per-feature
  privacy controls (Connection Control, Referrer Control, WebGL disable, etc.)
- [privacy-guard.md](privacy-guard.md) — canvas/screen fingerprint noise,
  Privacy Guard feature set
- [privacy-shield.md](privacy-shield.md) — toolbar bubble surfacing all
  privacy toggles
