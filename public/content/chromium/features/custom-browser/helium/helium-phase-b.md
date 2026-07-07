# Helium Browser Port — Phase B (Privacy & UX Refinements)

Five features ported from the [Helium browser](https://github.com/helium-browser/helium)
patch catalogue. All are implemented as `BUILDFLAG(CUSTOM_BROWSER)`-guarded changes to
vanilla Chromium files — no new source files, no new build targets. Apply or refresh
patches with `npm run update_patches`.

See `docs/helium-phase-a.md` for the five Phase A features.  
See `CLAUDE.md` (items 17–21) for the full technical spec of each change.

---

## Features

### 1. Audio Context Noise

**Vanilla files:**
- `src/third_party/blink/renderer/modules/webaudio/analyser_node.cc`
- `src/third_party/blink/renderer/modules/webaudio/audio_context.cc`

**Settings pipeline files (same pattern as canvas/font/screen noise):**
- `src/third_party/blink/renderer/core/frame/settings.json5`
- `src/third_party/blink/public/web/web_settings.h`
- `src/third_party/blink/renderer/core/exported/web_settings_impl.h` / `.cc`
- `src/third_party/blink/public/common/web_preferences/web_preferences.h`
- `src/third_party/blink/renderer/core/exported/web_view_impl.cc`
- `src/custom/common/custom_pref_names.h`
- `src/custom/browser/prefs/custom_prefs.cc`
- `src/custom/browser/custom_content_browser_client_parts.cc`

Adds ±0.01% amplitude jitter (xorshift32 seeded from `CanvasNoiseToken::Get()`) to the
four `AnalyserNode.get*Data()` methods. Also rounds `AudioContext.baseLatency` to 2
decimal places. Breaks audio fingerprinting while remaining perceptually inaudible.

| Detail | Value |
|---|---|
| Pref key | `privacy_guard.audio_context_noise` |
| Default | `false` (opt-in) |
| Noise mechanism | xorshift32, `CanvasNoiseToken::Get()` as seed; ±0.01% multiplicative (float) / LSB flip (byte) |
| Latency rounding | `std::round(base_latency_ * 100.0) / 100.0` |
| Source | Helium `patches/helium/core/noise/audio.patch` |

---

### 2. Hardware Concurrency Spoofing

**Vanilla file:** `src/third_party/blink/renderer/core/frame/navigator_concurrent_hardware.cc`

`navigator.hardwareConcurrency` is clamped to [2, 16], floored to the nearest even
number (odd core counts are statistically uncommon and thus distinctive), then one of
three plausible values — n, n−2, n−4 — is selected per session using the top 2 bits of
`CanvasNoiseToken::Get()`. The result is stable within a session but differs across
sessions, preventing the true CPU core count from serving as a persistent fingerprint.

| Detail | Value |
|---|---|
| Pref / gate | Always-on for `BUILDFLAG(CUSTOM_BROWSER)` (no user pref) |
| Clamp range | [2, 16], even numbers only |
| Session selection | `(token >> 62) & 3` → picks 0, 1, or 2 steps below n |
| Regression risk | Very low — no site relies on exact core count for functionality |
| Source | Helium `patches/helium/core/noise/hardware-concurrency.patch` |

---

### 3. Reduced Accept-Language Headers

**Vanilla file:** `src/services/network/public/cpp/features.cc`

Enables Chromium's built-in `kReduceAcceptLanguage` feature (previously
`FEATURE_DISABLED_BY_DEFAULT`) so `Accept-Language` headers omit quality weighting and
secondary locales. For example, `en-GB;q=0.9, en;q=0.8` becomes `en`. Most localisation
systems are unaffected since servers fall back to content-negotiation; only the
fingerprinting precision is reduced.

| Detail | Value |
|---|---|
| Feature flag | `network::features::kReduceAcceptLanguage` |
| Change | `FEATURE_DISABLED_BY_DEFAULT` → `FEATURE_ENABLED_BY_DEFAULT` |
| User override | `chrome://flags/#reduce-accept-language` |
| Regression risk | Low — some highly locale-specific sites may serve `en` content instead of `en-GB`; users can disable via flag |
| Source | Helium `reduce-accept-language-headers.patch` |

---

### 4. Kagi Search Engine

**Vanilla file:** `src/third_party/search_engines_data/resources/definitions/regional_settings.json`

Adds Kagi to the prepopulated search engine list for the five largest English-language
regions. Kagi was already fully defined in `prepopulated_engines.json` (ID 115); this
change makes it available in the regional selector so users can set it as their default
in `chrome://settings/searchEngines`.

| Detail | Value |
|---|---|
| Regions added | US, GB, AU, CA, ZZ (global fallback) |
| Engine ID | 115 (`&kagi`) |
| User impact | Kagi appears in search engine settings; existing default is unchanged |
| Source | Helium `add-kagi-image-search.patch` |

---

### 5. Centered Address Bar

**Vanilla file:** `src/chrome/browser/ui/views/toolbar/toolbar_view.cc`

An optional layout mode where the omnibox is horizontally centred in the toolbar
regardless of how many buttons appear on each side. Implemented by:

1. Capping the location bar's `MaximumFlexSizeRule` at `kPreferred` (its preferred
   width, which `CalculatePreferredSize()` limits to ~60% of toolbar width).
2. Adding two equal-weight flex spacers around the location bar with
   `MaximumFlexSizeRule::kUnbounded`. Both have the same flex order (1004 = lowest
   priority), so they absorb remaining space equally, centering the bar.

Gated on the `toolbar.center_address_bar` pref (default: `true`). Layout is initialised
once per browser session; a restart is required after toggling.

| Detail | Value |
|---|---|
| Pref key | `toolbar.center_address_bar` |
| Default | `true` (on by default) |
| Restart needed | Yes — layout is set up once in `InitLayout()` |
| Location bar max | `MaximumFlexSizeRule::kPreferred` (≈60% of toolbar width) |
| Spacer flex order | 1004 (`kOrderOffset + 4`) |
| Source | Helium `centered-address-bar.patch` |
