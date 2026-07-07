# Helium Browser Port — Phase A (Privacy & Performance Hardening)

Five low-complexity features ported from the [Helium browser](https://github.com/helium-browser/helium)
patch catalogue. All are implemented as `BUILDFLAG(CUSTOM_BROWSER)`-guarded changes to
vanilla Chromium files — no new source files, no new build targets. Apply or refresh
patches with `npm run update_patches`.

See `CLAUDE.md` (items 12–16) for the full technical spec of each change.

---

## Features

### 1. Infinite Tab Freezing

**Vanilla file:** `src/components/performance_manager/features.cc`

Background tabs are suspended indefinitely after going idle. Chromium's built-in
`kInfiniteTabsFreezing` feature is flipped from `FEATURE_DISABLED_BY_DEFAULT` to
`FEATURE_ENABLED_BY_DEFAULT`.

| Detail | Value |
|---|---|
| Pref / flag | `chrome://flags/#infinite-tabs-freezing` (user can disable) |
| Memory saving | Significant on sessions with many open tabs |
| Regression risk | Low — tab reloads on focus, which is the standard Chromium discard behaviour |
| Source | Helium `infinite-tab-freezing.patch` |

---

### 2. Field Trial / A/B Test Disabling

**Vanilla file:** `src/components/variations/service/variations_service.cc`

The Chromium variations service normally fetches a "seed" from Google's servers that
can silently enable or disable features remotely. `StartRepeatedVariationsSeedFetch()`
is suppressed so no seed fetch ever occurs. Any seed already stored locally is still
applied; only the outbound network call is blocked.

| Detail | Value |
|---|---|
| Network change | No periodic `POST` to `clientservices.googleapis.com/chrome-variations/seed` |
| User-visible change | None — `chrome://flags` overrides still work |
| Regression risk | Very low — features shipped via field trials that we haven't explicitly disabled still apply from any cached seed on first run |
| Source | Bromite `disable-fetching-field-trials.patch` |

---

### 3. Battery Status API Removal

**Vanilla file:** `src/content/browser/browser_interface_binders.cc`

`navigator.getBattery()` returns a rejected `Promise` because the Mojo interface
binding (`device::mojom::BatteryMonitor`) is never registered for frames. Battery
charge and charging state are a stable fingerprinting vector that persists across
cookie clears.

| Detail | Value |
|---|---|
| API impact | `navigator.getBattery()` → `Promise<rejected>` |
| Known breakage | None — no legitimate site functionality depends on this API |
| Fingerprinting surface eliminated | Battery level, charging state, charge/discharge times |
| Source | inox-patchset `disable-battery-status-service.patch` |

---

### 4. MV2 Extension Preservation

**Vanilla files:**
- `src/chrome/browser/extensions/manifest_v2_experiment_manager.cc`
- `src/chrome/browser/extensions/extension_management.cc`

Two changes together ensure MV2 extensions (uBlock Origin, etc.) are never warned
about, disabled, or removed:

1. **`CalculateCurrentExperimentStage()`** in `manifest_v2_experiment_manager.cc`
   returns `kNone` unconditionally, so no deprecation UI ever appears.

2. **`IsAllowedManifestVersion()`** in `extension_management.cc` returns `true`
   unconditionally, so no enterprise policy or feature flag can block MV2.

| Detail | Value |
|---|---|
| Extensions affected | All MV2 extensions — uBlock Origin, Tampermonkey legacy, etc. |
| UI change | No warning badges in `chrome://extensions` |
| Regression risk | None — this only ever adds permissions, never removes them |
| Source | ungoogled-chromium `extensions-manifestv2.patch` |

---

### 5. WebRTC IP Leak Prevention

**Vanilla file:** `src/chrome/browser/ui/browser_ui_prefs.cc`

The default value of the `kWebRTCIPHandlingPolicy` pref changes from
`kWebRTCIPHandlingDefault` (which exposes the local LAN IP via STUN) to
`kWebRTCIPHandlingDefaultPublicInterfaceOnly` (which restricts WebRTC to the
interface used for outbound HTTP).

| Detail | Value |
|---|---|
| Pref key | `prefs::kWebRTCIPHandlingPolicy` |
| New default | `blink::kWebRTCIPHandlingDefaultPublicInterfaceOnly` |
| Video/audio calls | Unaffected — relay (TURN) still works; only local address exposure is blocked |
| User override | Settings → Privacy → WebRTC IP handling policy |
| Source | Bromite / Helium `webrtc-default-handling-policy.patch` |
