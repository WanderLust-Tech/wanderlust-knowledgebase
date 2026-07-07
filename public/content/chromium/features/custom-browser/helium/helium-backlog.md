# Helium Browser Port — Backlog & Out-of-Scope Features

Features from the [Helium browser](https://github.com/helium-browser/helium) FEATURES.md
that were reviewed but not implemented in Phase A. Organised by priority tier and
feasibility.

See `docs/helium-phase-a.md` for the five features that were implemented.
See the gap-analysis artifact for the full scoring rationale.

---

## Phase B — ✅ Complete

All five Phase B features have been implemented. See `docs/helium-phase-b.md` for full
technical detail. Items 17–21 in `.github/CLAUDE.md` contain the implementation specs.

### ~~Audio Context Noise~~

Add ±0.01% amplitude jitter to Web Audio API output buffers and analyser data.
`baseLatency` rounded to 2 decimal places. Per-render salts prevent identical noise
across consecutive renders. Companion to the existing canvas fingerprint noise
(`prefs::kCanvasFingerprintNoise`).

| Detail | Value |
|---|---|
| Vanilla files | `audio_buffer.cc/h`, `base_audio_context.cc`, `audio_context.cc`, `realtime_analyser.cc` |
| New pref | `privacy_guard.audio_context_noise` |
| Complexity | Medium (~538 lines in Helium) |
| Source | Helium `patches/helium/core/noise/audio.patch` |

---

### Hardware Concurrency Spoofing

`navigator.hardwareConcurrency` clamped to [2, 16]; odd values floored to even (odd
core counts are statistically rare); one of three plausible values (n, n–2, n–4)
selected deterministically per origin+session token. Prevents CPU core count from
being used as a stable fingerprint.

| Detail | Value |
|---|---|
| Vanilla file | `third_party/blink/renderer/core/frame/navigator_base.cc` |
| New pref | `privacy_guard.hardware_concurrency_noise` |
| Complexity | Low–Medium (~169 lines in Helium) |
| Source | Helium `patches/helium/core/noise/hardware-concurrency.patch` |

---

### Reduced Accept-Language Headers

Reduces the precision of `Accept-Language` request headers (e.g. `en-GB;q=0.9` →
`en`) to limit language-preference-based fingerprinting without breaking most
localisation.

| Detail | Value |
|---|---|
| Vanilla file | Language negotiation code in `net/` or `chrome/browser/translate/` |
| Complexity | Low |
| Source | Helium `reduce-accept-language-headers.patch` |

---

### Kagi Search Engine + Custom Suggestions URL

Two separate, low-complexity additions best landed together:

1. Adds Kagi as a prepopulated search engine with image-search support
   (`components/search_engines/prepopulated_engines.json`).
2. Lets users specify a separate suggestions endpoint per search engine
   (`template_url_data.h` + settings WebUI).

| Detail | Value |
|---|---|
| Vanilla files | `prepopulated_engines.json`, `template_url_data.h`, settings WebUI |
| Complexity | Low |
| Source | Helium `add-kagi-image-search.patch`, ungoogled-chromium `add-suggestions-url-field.patch` |

---

### Centered Address Bar

Optional layout mode where the omnibox is horizontally centred in the toolbar
regardless of flanking button counts. Implemented as a toolbar layout calculation
override gated by a new pref.

| Detail | Value |
|---|---|
| Vanilla file | `chrome/browser/ui/views/toolbar/toolbar_view.cc` |
| New pref | `toolbar.center_address_bar` |
| Complexity | Medium |
| Source | Helium `centered-address-bar.patch` |

---

## Phase C — ✅ Complete

All four Phase C features have been implemented. See `docs/helium-phase-c.md` for full
technical detail. Items 22–25 in `.github/CLAUDE.md` contain the implementation specs.

### MRU Tab Cycling (Ctrl+Tab)

Replaces Chromium's left-to-right `Ctrl+Tab` with Most-Recently-Used ordering.
On first cycle a sorted MRU list is built from the model; subsequent presses rotate
through it. Cycling ends on Ctrl release, mouse click, or window focus loss.
Ported from Brave in Helium — a well-tested implementation.

| Detail | Value |
|---|---|
| Vanilla files | `chrome/browser/ui/tabs/tab_strip_model.cc/h` (add `SelectMRUTab()`, `StopMRUCycling()`, `mru_cycle_list_`), `chrome/browser/ui/views/frame/browser_view.cc` (add `TabCyclingEventHandler`) |
| New pref | `tab.mru_cycling_enabled` |
| Complexity | Medium (~262 lines in Helium/Brave) |
| Source | Brave/Helium `tab-cycling-mru-impl.patch` |

---

### Compact Layout (Tabs in Toolbar)

Reparents the tab strip into the toolbar row, reclaiming the full tab-strip height
for content. The omnibox narrows to a preferred compact width (350 px). Window
caption hit-testing extended to cover the in-toolbar tab strip.

| Detail | Value |
|---|---|
| Key additions | `ShouldDrawToolbarTabStrip()`, `OnToolbarTabStripStateChanged()`, extended `IsRectInWindowCaption()` |
| New pref | `toolbar.compact_layout` |
| Complexity | High — view hierarchy reparenting + hit-testing |
| Source | Helium `compact.patch` |

---

### Zen Mode (Auto-Hide Chrome)

Distraction-free mode that animates top chrome (toolbar + tab strip) and side chrome
(sidebar / vertical tabs) in/out based on cursor proximity. A 6 px edge zone triggers
reveal; grace periods on enter and exit prevent flickering. Independent pinning for
top and side chrome.

| Detail | Value |
|---|---|
| Key API | `GetTopChromeRevealRatio()`, `GetSideChromeRevealRatio()`, `ToggleZenModeTopChrome()`, `ToggleZenModeSideChrome()` |
| New prefs | `zen_mode.enabled`, `zen_mode.sidebar_pinned`, `zen_mode.top_chrome_pinned` |
| Animation constants | Reveal trigger 6 px, hover leeway 8 px, reveal 200 ms (FAST_OUT_SLOW_IN_3), cursor exit grace 3000 ms |
| Complexity | Very High — dual animation loops + cursor event monitoring |
| Source | Helium `zen-mode.patch` |

---

### Native Bang Shortcuts

`!bang` shortcuts (e.g. `!g query`, `!ddg query`) implemented natively in the
template URL service via a new `TemplateURLBangManager` class that loads bang
definitions asynchronously and registers them as hidden template URLs. Bang categories
surface in the omnibox with visual differentiation (AI-category bangs get a spark
icon).

| Detail | Value |
|---|---|
| Vanilla files | `components/search_engines/template_url_service.cc`, `template_url_data_util.cc`, `template_url_service_factory.cc`, omnibox views |
| Complexity | High — async loading, new manager class, omnibox integration (~1000+ lines total) |
| Source | Helium `add-native-bangs.patch`, `bangs-ui.patch` |

---

## Out of Scope — Not Recommended

These features from Helium's catalogue are incompatible with WanderLust's architecture,
require Helium-specific infrastructure, or represent a project-scale commitment rather
than a feature port.

| Feature | Reason skipped |
|---|---|
| **Domain Substitution System** | 50 000-entry substitution table applied at build time via a Python pipeline (`utils/domain_substitution.py`). Requires adopting Helium's entire build infrastructure — not compatible with the patch-based approach. |
| **Binary Pruning List** | 50 000+ files excluded from the build at prep time (`utils/prune_binaries.py`). Same infrastructure dependency as domain substitution. |
| **Full Helium Noise Token System** | Per-origin FNV1a session token delivered via Mojo IPC (~1 183 lines, `noise_token.mojom`). WanderLust's existing per-session LSB canvas noise already provides the main benefit. The full system adds cross-API correlation protection — marginal gain for Very High complexity. |
| **Component Update Proxy** | Proxies extension and component downloads through Helium's own servers. Requires building equivalent WanderLust-side server infrastructure before this makes sense. |
| **i18n Translation Pipeline (80+ languages)** | Machine-translation pipeline across 80 locales (`devutils/i18n_translate.py`, `owners.yml`). A project-scale commitment, not a feature. Revisit if WanderLust commits to international distribution. |
| **uBlock Origin bundled install** | Helium bundles uBlock Origin as a component extension. This requires component infrastructure and a distribution mechanism. Users can install from the Chrome Web Store; MV2 Preservation (Phase A #4) ensures it works. |
| **DuckDuckGo / Kagi as default search** | Changing the default search engine touches regional settings JSON and is a product/legal decision, not a technical one. Implement separately as a branding choice if needed. |
