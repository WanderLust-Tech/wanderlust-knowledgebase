# Mobile Parity Strategy (Android / iOS)

Tier 4 of `FEATURE_DEEP_DIVE_ROADMAP.md` (2026-07-28): *"Mobile parity is
the biggest strategic gap... For a browser this feature-rich on desktop,
most users in 2026 will judge it by its phone experience first."*

This document is a **planning artifact, not an implementation record**.
No mobile build environment was set up and no mobile code was written to
produce it — see [Why this is a strategy doc, not a sprint](#why-this-is-a-strategy-doc-not-a-sprint)
for why that's the deliberate, correct scope for a first pass.

## Current state (verified 2026-08-01)

| Platform | What exists today | Verdict |
|---|---|---|
| Android | `src/custom/android/sources.gni` — 14 lines, lists two `.java` files (`CustomActivity.java`, `RemoteNtpBridge.java`) that **don't exist on disk**, referenced by nothing else in the build (`chrome/android/BUILD.gn` has zero references to this file) | Dead scaffolding. No real code. |
| iOS | `src/custom/ios/` — 19 real files, but 100% Remote-NTP (icon parsing, tile view, `WKWebView` messaging, one `custom_web_client.h/.mm` reference that's stale — the actual files were renamed to `rebel_web_client.*`, a leftover from a "Rebel" predecessor project) | Real code, but only for one feature (NTP), and only the WebView-hosted rendering surface — no sidebar, AI agent, ad blocker, BitTorrent, or RSS/EPUB reader equivalent |
| Build environment | `.gclient` syncs `target_os = ["win"]` only. No Android SDK/NDK has ever been fetched (`third_party/android_sdk` holds only CIPD metadata, not the actual SDK). `custom/build/commands/lib/config.py` has generic `target_os in ('android', 'ios')` branches and branding scripts (`applyAndroidBranding.py`, `applyIosBranding.py`) that print the right `gn gen` invocation — but nothing has ever run them | Never attempted. `git log` on `src/custom` has zero commits mentioning android/ios feature work; no `out/Android` or `out/iOS` build directory exists |

**Bottom line:** despite the `android/`/`ios/` directories existing, this
fork has never actually built for either platform. "Mobile parity" starts
from zero, not from a partially-working port.

## Two fundamentally different problems

**Android** is the tractable one. Chromium's Android port shares the same
Blink/content-layer architecture as desktop — `chrome/android/` sits
alongside `chrome/browser/ui/views/` as an alternate UI layer over shared
`chrome/browser/` and `components/` code. A real Android build is
possible on the current Windows dev machine (`target_os="android"` is a
supported Chromium build config on any host OS), and — per the backend
portability assessment below — a meaningful slice of this fork's backend
logic would carry over largely as-is.

**iOS is not the same kind of project.** Apple's App Store policy
requires all iOS browsers to use WebKit, not Blink — `ios/chrome/` is a
structurally separate codebase from `chrome/browser/`, sharing
essentially zero C++ feature code with the desktop fork (the existing 19
iOS files here are the WebView/UI glue layer, not ported feature logic).
It also requires macOS + Xcode to build, which this dev environment
doesn't have. Treat iOS as a **separate initiative** requiring dedicated
Mac hardware and WebKit-specific engineering — not a natural extension of
the work done in `custom/browser/` all session. This strategy focuses on
Android; iOS is revisited only in the [iOS](#ios-treat-as-a-separate-later-initiative)
section at the end.

## Backend portability assessment (Android)

Verified by reading the actual class declarations and includes, not
assumed from feature descriptions:

| Feature | Backend coupling | What porting requires |
|---|---|---|
| **Ad blocker** (`AdBlockClient`, `BloomFilter`, `CosmeticFilter`) | **Fully portable.** Plain C++ classes, no base class, no `views::`/`content::`/`chrome/browser/ui` includes at all — pure bloom-filter/string logic | Compile the existing files into the Android target; wire into Android's network stack hook point instead of the desktop one |
| **RSS reader backend** (`RSSImpl : public RSSFeed`, `RSSService : public KeyedService`) | **Portable.** Only `content::WebContents` dependency is OPML import/export (file-picker-adjacent, easily swapped for Android's file picker). SQLite-backed store, fetch/parse logic has no Views coupling. The React/WebUI reader is already a separate consumer via `RssServiceObserver` — presentation is already decoupled | New Android-native (or WebView-hosted) reader UI; backend reused as-is |
| **AI agent backend** (`AiAgentClient`, `AiAgentService : public KeyedService`) | **Portable, with one seam.** No Views dependencies — just `network::SimpleURLLoader` + string handling. The page-text-extraction call itself (`RenderFrameHost::ExecuteJavaScript`) is generic content-layer API. The *only* desktop-coupled part is finding which frame to extract from: `AgentDOMHandler` goes through `chrome::FindBrowserWithProfile()` → `Browser*` → `TabStripModel::GetActiveWebContents()` | Swap that one lookup for Android's Tab/WebContents equivalent; rewrite the chat UI as a native screen instead of a WebUI sidebar page |
| **Cloud bookmark sync** (`GoogleDriveStorageBackend`/`OneDriveStorageBackend : public StorageBackend`, `CloudSyncManager`) | **Storage/sync logic portable; OAuth flow is desktop-coupled.** The backends are just `SimpleURLLoader` + JSON, no Views. But `GoogleAuthProvider`/`MicrosoftAuthProvider`'s sign-in flow hard-codes opening a new desktop tab (`chrome::AddTabAt`) and watching it for a `localhost` redirect | OAuth must be rewritten for mobile (Android Custom Tabs + AppAuth pattern is the standard approach) before the otherwise-reusable sync backend can be wired up |

This lines up with the roadmap's own suggested MVP subset — **ad blocker,
RSS reader, AI agent chat, sync** — and the portability findings confirm
that subset is a reasonable one: three of the four need only a new UI
shell, and the fourth (sync) needs one well-understood mobile OAuth
rewrite before its backend is reusable.

Everything else in the desktop feature set (sidebar, vertical tabs, split
view, BitTorrent, EPUB reader, privacy shield's Views-based panel) is
either UI-paradigm-specific to desktop chrome (sidebar/vertical
tabs/split view don't map to a phone's single-pane browsing model at all)
or hasn't been assessed — deliberately out of scope for a first MVP.

## Phased approach

**Phase 0 — Build environment bring-up (no fork code yet).** Re-sync
`.gclient` with `target_os` including `"android"`, fetch the Android
SDK/NDK, and confirm a **vanilla, unmodified** Chromium Android build
boots in an emulator/device from this checkout. This validates the
toolchain in isolation before any fork-specific risk is introduced. This
step alone is the large, disruptive, multi-hour/multi-GB operation
flagged when this strategy was scoped — do not combine it with feature
work in the same sitting.

**Phase 1 — Ad blocker.** Lowest-risk first port: fully portable backend,
no OAuth/UI-shell complexity. Proves the custom-fork-code-on-Android
pipeline (patch application, `sources.gni`-equivalent wiring, jumbo build
settings if used) end to end on the simplest possible feature.

**Phase 2 — AI agent chat.** Second: portable backend, one well-scoped
seam (frame lookup) to fix, and a genuinely new native chat UI to build.
Validates the "backend reuse + new mobile UI shell" pattern this whole
strategy depends on.

**Phase 3 — RSS reader.** Same pattern as Phase 2, slightly larger
UI surface (feed list + item list + article view instead of one chat
screen).

**Phase 4 — Cloud sync.** Last, because it's the one item requiring new
mobile-specific engineering (Custom Tabs/AppAuth OAuth) rather than pure
backend reuse — do this once the reuse pattern is proven and trusted.

Each phase should ship and be used before starting the next — this is
sized as roughly one initiative per phase, not one sprint.

## iOS: treat as a separate, later initiative

Recommendation: **do not fold iOS into the same effort as Android.**
Concretely:

- It needs a Mac + Xcode, unavailable in this dev environment.
- `ios/chrome/` is WebKit-based and shares no C++ feature code with
  `custom/browser/` — none of the Android portability findings above
  transfer. Every ported feature (ad blocker, AI agent, RSS reader, sync)
  would need to be re-implemented against WebKit's APIs from scratch,
  not reused from either the desktop or the Android port.
- The existing 19-file iOS Remote-NTP layer is the *only* precedent in
  this fork for "how do we build custom UI against `ios/chrome/`" — it's
  a reasonable reference for engineering pattern, but doesn't reduce the
  amount of net-new work for any other feature.

If iOS parity becomes a priority, scope it as its own strategy doc once
Android Phase 1-2 are complete and there's a proven "port backend, build
new mobile UI shell" playbook to adapt — even though the WebKit rewrite
work itself won't be reusable, the *decisions* (which features, in what
order, what's explicitly out of scope) likely will be.

## Why this is a strategy doc, not a sprint

Tiers 1-3 of the roadmap were "extend infrastructure that already
exists and already builds" — a shape that fits within a single working
session. Tier 4 is categorically different: it starts by re-syncing the
checkout's dependency footprint (large, one-time, disruptive), targets a
platform this dev environment has never built for, and even its
"smallest" slice (ad blocker) requires setting up and validating a whole
second build pipeline before any fork code changes. Scoping this as a
strategy document — verified current state, honest feasibility
assessment, concrete phased plan — gives the next session (or a
dedicated mobile engineering effort) a running start without committing
to the large irreversible first step (the `.gclient` re-sync) without
explicit, separate sign-off.
