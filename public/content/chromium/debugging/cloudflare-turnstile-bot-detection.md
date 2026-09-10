---
title: "Cloudflare Turnstile Bot Detection Failure"
description: "Investigation log for Cloudflare Turnstile consistently failing with 'bot behavior detected' / widget crash in the custom browser, while Chrome and Edge pass fine on the same machine/network."
category: "Debugging"
tags: ["cloudflare", "turnstile", "bot-detection", "tls", "client-hints", "wasm", "unresolved"]
difficulty: "advanced"
date: "2026-09-09"
author: "Wanderlust Team"
estimated_reading_time: "10 minutes"
---

# Cloudflare Turnstile Bot Detection Failure

## Status: UNRESOLVED — investigation paused 2026-09-09

Two real bugs were found and fixed along the way (both shipped), but neither
fixed the actual Turnstile failure. The root cause is still unknown. This
document exists so the investigation doesn't have to restart from zero next
time.

## Symptom

On every Cloudflare-protected site tested, the Turnstile "Verify you are
human" widget fails to complete. Chrome and Edge, tested side by side on the
same machine/network, pass every time. The user has confirmed:

- It happens on **every** Cloudflare site tried, not just one.
- Cloudflare's own [Turnstile Troubleshooter](https://developers.cloudflare.com/turnstile/troubleshooting/)
  page reports **Error 300031** ("Generic challenge failure" family — per
  Cloudflare's own docs, this means "Bot behavior detected" / the widget's JS
  hit an unrecoverable exception; the specific digits after `300` are for
  Cloudflare-internal use and don't have individual public meaning).
- A `cf_clearance` cookie **does** get set, so the network-level challenge
  handshake itself isn't fully blocked.
- With DevTools set to "Pause on caught exceptions", two exceptions fire
  during a failed attempt:
  - `RangeError: Invalid code point -1` — thrown from inside Cloudflare's own
    minified script (`challenges.cloudflare.com/cdn-cgi/challenge-platform/.../normal?lang=auto`),
    specifically a call to `String.fromCodePoint(-1)` at the end of a
    byte-by-byte XOR/decode loop reading from a `Uint8Array(462846)`
    (almost certainly an embedded/obfuscated data blob baked into that
    script, decoded at runtime — not a separately-fetched resource).
  - `TypeError: Failed to fetch` — a `fetch()` call failing; likely tied to
    the same benign redundant-request retry pattern described below, not
    necessarily a separate cause.
- Console also logs Cloudflare's own generic wrapper message:
  `Turnstile Widget seem to have crashed: <random-session-token>` (the
  trailing token, e.g. `ckwbh`, is just a per-session identifier with no
  public meaning — confirmed via Cloudflare community threads).

## Real bugs found and fixed (shipped, but did not resolve the issue)

### 1. Client Hints (`sec-ch-ua*`) suppressed entirely by default

**File:** `third_party/blink/common/client_hints/client_hints.cc`
**Fixed in:** commit reverting `IsClientHintSentByDefault()`'s
`BUILDFLAG(CUSTOM_BROWSER)` branch, which unconditionally `return false`d for
every Client Hint type — completely disabling `sec-ch-ua`,
`sec-ch-ua-mobile`, and `sec-ch-ua-platform` regardless of the
`kSuppressUAClientHint` feature flag that was clearly meant to be the actual
toggle (default off, i.e. not suppressed). Confirmed via a byte-level
`tls.peet.ws/api/all` comparison against Edge: Edge sent all three headers,
our browser sent none, despite a User-Agent string claiming `Chrome/142`.

This is a real, independently valuable fix (a browser claiming to be Chrome
while sending zero Client Hints is a well-known bot/impersonation signal to
virtually every bot-management vendor) but **confirmed via retest that it
did not fix Turnstile** — the 300031 error persisted unchanged after
rebuilding and confirming (via a fresh `tls.peet.ws` capture) that the
headers were actually being sent.

### 2. `Do Not Track` and Third-Party-Cookie-Deprecation forced on by default

**File:** `components/privacy_sandbox/tracking_protection_prefs.cc`
**Fixed:** removed `BUILDFLAG(CUSTOM_BROWSER)` overrides that forced
`kEnableDoNotTrack` and `kTrackingProtection3pcdEnabled` to `true` (stock
Chromium defaults both to `false`). Confirmed via network capture that our
browser was sending `dnt: 1` on every request; Edge was not.

Also **did not fix Turnstile**, confirmed on both the original profile
(after toggling the Settings UI checkbox off once, since the stale `true`
value had already been persisted to disk before the code fix landed — the
code default only applies to prefs absent from an existing profile's
`Preferences` file) and a **brand-new profile** (clean defaults, no stale
persisted values) — same 300031 failure on the very first page load.

## Things ruled out with concrete evidence

- **Privacy Guard fingerprint-protection suite** (canvas noise, font
  fingerprint protection, audio noise, screen-metrics normalize,
  letterboxing) — user confirmed all toggles off; all five prefs default to
  `false` in `custom_prefs.cc` regardless.
- **Ad blocker** — user has it toggled off in Settings
  (`kEnableAdBlock` gate). The one place that looked like a lead — a
  `$generichide` cosmetic-filter exception rule that's silently unrecognized
  by our filter parser (`filter.cc`'s `parseOption()` has no case for
  `generichide`) — turned out to be a dead end: the actual *live* cosmetic
  injector (`ad_block_tab_helper.cc`) correctly gates on `kEnableAdBlock`
  before doing anything. The *other* class, `CosmeticFilterTabHelper`, does
  have the `$generichide` bug, but is dead code — never attached to any
  `WebContents` anywhere in `src/custom` (confirmed via grep for
  `CreateForWebContents` call sites) — so it cannot be firing at all.
- **Website Restrictions (Parental Controls) / Content Policy Chain** — both
  confirmed default-off and user has no custom rules configured for any
  domain (would need an explicit PIN + blocklist/allowlist mode, or an
  explicit non-empty rule set, neither of which exist here).
- **Domain Shields per-domain overrides** — user confirmed none configured.
- **Third-party cookie handling beyond stock** — `kCustomSessionOnlyCookies`
  defaults `false`; even enabled it only makes cookies session-scoped
  (`CONTENT_SETTING_SESSION_ONLY`), it does not block third-party cookies
  differently from stock Chromium.
- **Secure DNS / DNS-over-HTTPS** — defaults to `"automatic"` (matches stock
  Chromium's own default upgrade behavior; no custom/forced DoH provider
  template exists anywhere in the fork). User tested toggling it off
  entirely — no change.
- **`PrivateDnsManager`** — a whole class exists with hardcoded
  `8.8.8.8`/`8.8.4.4` DNS servers and Google/Cloudflare DoH endpoints, and
  its feature flag (`PrivateDnsResolution`) *is* enabled by default — but
  it's orphaned: nothing in `src/custom` calls `ResolveDns()`/
  `ResolveDnsSync()` for real page loads, and nothing feeds its config into
  the actual network stack (`net::HostResolver`, `URLRequestContextBuilder`,
  or any `DnsOverHttpsConfig`). Confirmed via exhaustive grep of every
  caller.
- **`net::ERR_NAME_NOT_RESOLVED` on Cloudflare's per-session, high-entropy
  subdomains** — initially looked highly suspicious (a known Cloudflare
  anti-tampering technique deliberately probes whether DNS-level filtering
  blackholes randomized subdomains), but the user confirmed **the exact same
  errors appear in Edge too** — this is normal/expected Cloudflare
  client-side retry noise, not a real difference between the browsers.
- **Host resolver rule mapping** (the classic Chromium technique for
  synthetically forcing `ERR_NAME_NOT_RESOLVED` via
  `--host-resolver-rules`/`MappedHostResolver`) — no such mechanism exists
  anywhere in `src/custom`. The one patch touching
  `net/dns/host_resolver_manager.cc` only changes the IPv6-connectivity-probe
  target address (an internal "is IPv6 usable" check, unrelated to real DNS
  lookups for web content).
- **Our own request-blocking throttles returning a disguised error** — our
  `AdBlockThrottle`/`PingBeaconBlockThrottle` use `net::ERR_BLOCKED_BY_CLIENT`
  (the conventional, visible-as-such code), never `ERR_NAME_NOT_RESOLVED`,
  ruling out a throttle silently blocking a request and pretending it's a
  DNS failure.
- **TLS fingerprint (JA3) mismatch** — initially the leading theory: a
  `tls.peet.ws` capture showed different JA3 hashes between our browser and
  Edge. Turned out to be a red herring — Chrome's own TLS ClientHello
  extension **order** is deliberately randomized per-connection (an
  anti-JA3-pinning feature Chromium itself ships), so JA3 will differ
  connection-to-connection even from the same real Chrome. The
  order-independent **JA4** hash's *cipher* and *extension-ID* segments were
  identical between our browser and Edge; the one real difference (a few
  extra signature-algorithm codepoints in Edge's `ja4_r`) is explained by
  Edge being on Chromium 154 vs. our pinned Chromium 142 — ordinary version
  skew, not a bug.
- **GPU/WebGL hardware rendering** — confirmed on (`chrome://gpu`), not
  falling back to a software renderer (SwiftShader).
- **Debug-build JS/WASM performance** — a plausible theory (Turnstile's
  challenge does real WASM/proof-of-work computation, and Debug Chromium
  builds run V8 significantly slower with DCHECKs enabled). Built a plain
  Release config (`npm run build:release` equivalent, non-official — i.e.
  optimizations on, but not the full PGO/LTO "official build" used for real
  releases) and retested: **no change**, ruling out raw execution speed as
  the cause. (Note: a *true* official build with `is_official_build:true`
  was not tested — see Open Questions below.)
- **HTTP decompression codecs (brotli/zstd/gzip)** — no patches exist to any
  of these anywhere in `src/custom`; stock Chromium codecs, unmodified.
- **Global CSP / Trusted Types tightening applied to arbitrary web content**
  (a real bug class this fork has hit before in RSS/mail features) — no
  matches for any CSP/Trusted-Types-related code in
  `custom_content_browser_client.cc`/`custom_content_browser_client_parts.cc`
  outside of our own `chrome://`-scheme WebUI pages (which is normal and
  doesn't affect regular web content).
- **WebAssembly disabled/restricted globally** — no v8 flag overrides, no
  WASM-disabling patches anywhere in `src/custom` or `src/custom/patches`.
- **Stale HTTP cache** — the `RangeError` reproduced on the **very first
  page load of a brand-new profile** (empty cache), ruling out a stale
  cached copy of Cloudflare's script mismatched against fresh data.
- **Browser extensions** — user confirmed none installed.

## Where the investigation was paused

The last concrete, unresolved lead: is the `Uint8Array(462846)` blob that
`normal?lang=auto`'s decode loop reads from actually **byte-identical**
between our browser and Edge for the exact same script URL?　This was asked
but not yet answered when the user asked to pause and document instead of
continuing live.

- **If the bytes differ** → real data corruption or CDN-served content
  variation in transit, a genuine network-layer bug (though every codec/
  proxy/throttle we could find has been checked and passes bytes through
  unmodified — see "ruled out" above; would need packet-level capture
  (Wireshark) to find where the divergence actually happens).
- **If the bytes are identical** → the divergence is happening in *script
  execution*, not data transport. The most likely remaining explanation:
  Cloudflare's challenge script computes some kind of environment/
  fingerprint-derived "key" (from Navigator/Screen/Performance/WebGL
  properties, timing behavior, etc.) that's used somewhere in or before this
  decode loop, and something about our browser's JS-visible environment
  still differs from a stock browser's in a way not yet identified. Given
  how much has already been ruled out on the "obviously different settings"
  front, this would likely require either (a) setting a breakpoint further
  upstream in the same minified bundle to trace what feeds into the decode
  loop's key/state variables, or (b) a real official build
  (`is_official_build:true`, full PGO) to rule out V8/codegen differences
  specific to a non-official build, which was not yet tested.

## Open questions / next steps for whoever picks this back up

1. Finish the byte-comparison test described above.
2. If bytes match, try setting a breakpoint earlier in the same script (search
   the Sources panel for where `eg`/the decode function is first invoked,
   rather than pausing on the exception itself) to see what state/key values
   feed into it, and compare against the equivalent point in Edge if
   possible (Edge's script is minified differently — same challenge platform
   codebase, different build — so a byte/line-for-line diff isn't directly
   possible, but the *shape* of what's read from `navigator`/`screen`/etc.
   just before the decode call may still be comparable).
3. Consider testing a true official build
   (`npm run build:release` — `is_official_build:true`, full PGO/LTO) rather
   than the plain optimized Release config already tried, to fully rule out
   build-flag-driven V8/codegen differences.
4. Consider asking Cloudflare support directly via the Turnstile
   Troubleshooter's "Report to support" flow (Session ID
   `BBB67F6C283649FE89D869788A4F9A44` was captured during this investigation,
   though it will have expired by the time anyone picks this back up — get a
   fresh one).
5. This is very likely something specific to a from-scratch/non-Google-
   branded Chromium build in general (a widely-reported class of problem
   with Cloudflare specifically, independent of this fork's own custom
   patches) rather than something introduced by this fork's own code — worth
   searching for whether this reproduces on a **vanilla, unpatched** Chromium
   142 build too, which would definitively separate "our patches broke this"
   from "unbranded Chromium and Cloudflare just don't get along."

## Related

- [Ad Blocker](/chromium/features/custom-browser/ad-blocker)
- [Privacy Guard](/chromium/features/custom-browser/privacy-guard)
- [Content Policy Chain](/chromium/features/custom-browser/content-policy-chain)
