# Ad blocker

Gated by `BUILDFLAG(ENABLE_AD_BLOCKER)`. Drops requests to known ad and
tracker hosts before the network fetch starts via a `blink::URLLoaderThrottle`
attached to every navigable request. Matches go through a vendored
Adblock-Plus filter engine (curated 50-rule bundled list, expandable to
EasyList in a future iteration) with a tiny hardcoded substring list as a
belt-and-braces fallback if the engine fails to initialize.

When something is blocked, a per-tab helper records the entry, an omnibox
PageAction icon appears, and clicking opens a bubble with the list of
blocked URLs. The omnibox icon and per-tab state are reset on every
primary-frame commit so the surfacing reflects the page currently shown.

## Build / activation

| Where | What |
|---|---|
| [`custom_browser_config.gni`](../src/custom/custom_browser_config.gni) | `enable_ad_blocker = true` (default) — gates source compilation, the throttle hook, the omnibox icon enum entry, and the controller wiring |
| [`branding_buildflags.h`](../src/custom/custom_browser_config.gni) | Emits `BUILDFLAG(ENABLE_AD_BLOCKER)` for `#if`-gating |
| [`custom_prefs.cc`](../src/custom/browser/prefs/custom_prefs.cc#L53) | `prefs::kEnableAdBlock` (`custom.enable_ad_block`) — user toggle, defaults to `true` when the build flag is on |
| Engine + bridge sources | [`browser/sources.gni`](../src/custom/browser/sources.gni#L212) — `custom_browser_net` |
| UI sources (omnibox icon + bubble) | [`browser/ui/sources.gni`](../src/custom/browser/ui/sources.gni) under `if (enable_ad_blocker)` |
| PageActionIconType enum | [`page_action_icon_type.h`](../src/chrome/browser/ui/page_action/page_action_icon_type.h) — `kAdBlock = 35`, conditional on `ENABLE_AD_BLOCKER` |
| Icon construction | [`page_action_icon_controller.cc`](../src/chrome/browser/ui/views/page_action/page_action_icon_controller.cc) — `case kAdBlock:` in the switch |
| Icon registration | [`location_bar_view.cc`](../src/chrome/browser/ui/views/location_bar/location_bar_view.cc) — `params.types_enabled.push_back(kAdBlock)` |
| Tab helper attachment | [`chrome/browser/ui/tab_helpers.cc`](../src/chrome/browser/ui/tab_helpers.cc) — `AdBlockTabHelper::CreateForWebContents` under the buildflag |
| Throttle injection | [`custom_content_browser_client.cc`](../src/custom/browser/custom_content_browser_client.cc) — `CreateURLLoaderThrottles` override |

## Architecture

```
Network request leaves a frame (image/script/xhr/...)
   │
   ▼
content::ContentBrowserClient::CreateURLLoaderThrottles
   │  (called on UI thread per content_browser_client.h)
   │
   │  CustomContentBrowserClient override:
   │   - Reads prefs::kEnableAdBlock on UI thread (no thread hop)
   │   - If false → returns upstream throttles unchanged
   │   - If true  → prepends AdBlockThrottle to the chain
   │
   ▼
AdBlockThrottle::WillStartRequest
   │  (called on the loader's sequence — may be IO/network thread)
   │
   ├── Fast-path: non-HTTP(S) schemes skip immediately (data:, blob:, etc.)
   │
   ├── Engine check (Phase 6 + Phase 5):
   │     BlockersWorker::Get()->ShouldAdBlockUrl(
   │         /*base_host=*/initiator_origin->host(),
   │         /*url=*/request.url.spec(),
   │         /*destination=*/request.destination)
   │     │
   │     ▼
   │     BlockersWorker (process-wide singleton via base::NoDestructor)
   │     │
   │     │  First call: parses bundled_filter_rules.cc text under
   │     │  base::Lock; subsequent calls go straight to matches().
   │     ▼
   │     AdBlockClient::matches(url, FilterOption, base_host)
   │       — vendored ABP engine, host-anchored + bloom-filter prefiltering
   │
   ├── Fallback check (Phase 1): tiny hardcoded substring list. Used only
   │   if the engine missed AND the host is in the static set — gives
   │   defense-in-depth in case the engine fails to initialize.
   │
   └── If either matches:
         │
         ├── PostTask to UI: AdBlockTabHelper::RecordBlocked(url, dest)
         │     │
         │     ▼
         │     AdBlockTabHelper (WebContentsUserData)
         │       - Appends to blocked_ list (url, destination, time)
         │       - Notifies observers (the icon view)
         │
         └── delegate_->CancelWithError(net::ERR_BLOCKED_BY_CLIENT,
                                        "wanderlust-adblock")
              — DevTools network panel shows "blocked:other" + tooltip

On commit of a primary-frame navigation, AdBlockTabHelper clears
blocked_ and notifies observers (icon hides, bubble — if open — refreshes
to empty state).

       LocationBarView builds its PageActionIconContainer with
       types_enabled = [..., kAdBlock, ...]
                        │
                        ▼
       PageActionIconController::case kAdBlock:
                        │
                        ▼
       AdBlockIconView (PageActionIconView subclass)
         - Observes AdBlockTabHelper (rebinds on each UpdateImpl, which
           the framework calls on tab switches + navigations).
         - SetVisible(helper->count() > 0)
         - SetTooltipText(N requests blocked on this page)
         - OnExecuting → AdBlockBubbleView::ShowBubble(this, helper, ...)
                        │
                        ▼
       AdBlockBubbleView (BubbleDialogDelegateView)
         - Vertical list of {host, kind} rows in a ScrollView
         - Observes the same helper so live blocks during the bubble
           being open append a new row
         - On close → notifies the icon to clear its bubble_ pointer
```

## File map

### Net layer (engine + throttle + helper)

| File | Purpose |
|---|---|
| [`net/blockers/ad_block_throttle.{cc,h}`](../src/custom/browser/net/blockers/ad_block_throttle.cc) | URLLoaderThrottle. Calls the engine first, then the hardcoded fallback. PostTasks block records to UI thread, then `CancelWithError` |
| [`net/blockers/ad_block_tab_helper.{cc,h}`](../src/custom/browser/net/blockers/ad_block_tab_helper.cc) | `WebContentsUserData<AdBlockTabHelper>` + `WebContentsObserver`. Stores `[{url, destination, time}]` for the current page load; resets on primary-main-frame committed navigations |
| [`net/blockers/blockers_worker.{cc,h}`](../src/custom/browser/net/blockers/blockers_worker.cc) | Bridge between Chromium types (`network::mojom::RequestDestination`) and the engine (`FilterOption`). Process-wide singleton via `BlockersWorker::Get()`. Lazy `parse()` of the bundled rule list under `base::Lock` |
| [`net/blockers/bundled_filter_rules.{cc,h}`](../src/custom/browser/net/blockers/bundled_filter_rules.cc) | Compiled-in ABP-format rule list. Curated, ~50 rules. The single point of edit for adding/removing rules — no filesystem dependency |
| [`net/blockers/ad_block_client.{cc,h}`](../src/custom/browser/net/blockers/ad_block_client.cc) | Vendored ABP filter engine (Brian Bondy / Brave origin). Parses ABP text, matches URLs. ~1200 lines. Modified in Phase 5 to restore the half-finished refactor of HashSet (see comments in `add()` and `deserialize()`) |
| [`net/blockers/{filter,bloom_filter,cosmetic_filter,hash_set,hash_item,hash_fn,bad_fingerprint{s}}.{cc,h}`](../src/custom/browser/net/blockers/) | Engine internals — hash sets, bloom filters, fingerprint tables. ~9000 lines including the 7000-line fingerprint data table |

### UI layer (omnibox icon + bubble)

| File | Purpose |
|---|---|
| [`ui/views/ad_block/ad_block_icon_view.{cc,h}`](../src/custom/browser/ui/views/ad_block/ad_block_icon_view.cc) | `PageActionIconView` subclass. Observes the tab helper, visible iff `count > 0`, click opens the bubble. Uses upstream's `kAdsOffChromeRefreshIcon` vector |
| [`ui/views/ad_block/ad_block_bubble_view.{cc,h}`](../src/custom/browser/ui/views/ad_block/ad_block_bubble_view.cc) | `BubbleDialogDelegateView`. Scrollable list of blocked `{host, kind}` rows. Observes the same helper for live updates; notifies the icon when closing |

### Settings UI

| File | Purpose |
|---|---|
| [`components/custom_settings/components/PrivacyPage.tsx`](../src/custom/components/custom_settings/components/PrivacyPage.tsx) | Hosts the user-facing toggle in the chrome://settings → Privacy and security page. Binds to `custom.enable_ad_block` via `usePref` |

### Patches into vanilla Chromium

| File | What it changes |
|---|---|
| [`chrome/browser/ui/page_action/page_action_icon_type.h`](../src/chrome/browser/ui/page_action/page_action_icon_type.h) | Adds `kAdBlock = 35` to the `PageActionIconType` enum, gated by `BUILDFLAG(ENABLE_AD_BLOCKER)`. Mirrors the existing `kRSS` pattern. Also adds the matching `static_assert` |
| [`chrome/browser/ui/views/page_action/page_action_icon_controller.cc`](../src/chrome/browser/ui/views/page_action/page_action_icon_controller.cc) | `case PageActionIconType::kAdBlock:` in the icon-construction switch |
| [`chrome/browser/ui/views/location_bar/location_bar_view.cc`](../src/chrome/browser/ui/views/location_bar/location_bar_view.cc) | `params.types_enabled.push_back(kAdBlock)` and includes `branding_buildflags.h` for the buildflag |
| [`chrome/browser/ui/tab_helpers.cc`](../src/chrome/browser/ui/tab_helpers.cc) | `AdBlockTabHelper::CreateForWebContents` under the buildflag |

## Phases & evolution

The code landed in a deliberate phase sequence so that the runtime path was
validated end-to-end before the heavy engine work began. Useful context if
you're reading the file comments which still reference phase numbers.

| Phase | What landed | Key files |
|---|---|---|
| 1 | URLLoaderThrottle with a tiny hardcoded host-substring list. Validates interception, cancellation, and the DevTools network-panel signalling | `ad_block_throttle.cc` (hardcoded list) |
| 2 | Per-tab state (`AdBlockTabHelper`) — counts + record list, reset on commit, observer notifications | `ad_block_tab_helper.cc` |
| 3 | Omnibox `PageActionIcon` driven by the helper's count, with the upstream `kAdsOffChromeRefreshIcon` vector | `ad_block_icon_view.cc` + the upstream patches |
| 4 | Click-to-see-blocks bubble (`AdBlockBubbleView`) — scrollable list, observes the helper for live updates | `ad_block_bubble_view.cc` |
| 5 | Modernized the vendored ABP engine (`raw_ptr` + `delete` → `unique_ptr`, `std::mutex` → `base::Lock`, removed `content::ResourceType` → `network::mojom::RequestDestination`, fixed the half-finished HashSet refactor) | `blockers_worker.{cc,h}`, `hash_set.h` |
| 6 | Compiled-in ABP rule list, `BlockersWorker::Get()` singleton, throttle wired to call the engine before the hardcoded fallback | `bundled_filter_rules.{cc,h}`, plus rewrites of `blockers_worker.cc` + `ad_block_throttle.cc` |
| 7 | User-facing toggle in chrome://settings, throttle gated on the pref so it pays nothing when off | `custom_content_browser_client.cc`, `PrivacyPage.tsx` |

## Adding a rule

Edit [`bundled_filter_rules.cc`](../src/custom/browser/net/blockers/bundled_filter_rules.cc). The file is a single `const char kBundledFilterRules[]` containing newline-separated ABP-syntax filters. The engine parses it once at startup; no codegen step.

ABP syntax cheat-sheet (subset the engine supports):

| Syntax | Meaning |
|---|---|
| `||example.com^` | Block any URL whose host is or ends in `example.com`, terminated by a separator char |
| `/banner/*` | Block URLs containing the literal `/banner/` anywhere in the URL string |
| `||t.example.com$third-party` | Block only when loaded as a third-party resource (modifier supported but see "Known gaps" below — we feed an approximate `base_host`) |
| `@@||allowlist.example.com^` | Exception rule — allow even if a block rule matches |
| `! comment` | Ignored by the parser |

Restart the browser to pick up changes — the parse happens during the first request after startup.

## Threading

The throttle's lifecycle crosses two sequences:

1. **Creation: UI thread.** `CreateURLLoaderThrottles` runs on UI per the upstream contract. We do the pref check here (`Profile::GetPrefs()->GetBoolean(...)`) — no thread hop needed.
2. **`WillStartRequest`: the loader's sequence.** May be the IO thread or a network-service sequence depending on the loader. We can't synchronously touch the tab helper from here, so block records get `PostTask`ed to the UI thread before `CancelWithError` is invoked — that way the helper has been notified by the time the throttle's destruction tears down the wc_getter.

The engine itself is process-wide. `BlockersWorker::Get()` returns a `base::NoDestructor`-backed singleton; the engine is profile-independent (rules don't depend on user state), so per-profile factories aren't worth the complexity. The lazy `parse()` runs under `base::Lock` to handle concurrent first-callers; after that, `AdBlockClient::matches()` is read-only and thread-safe per the engine's contract.

## Known gaps / latent issues

- **Bundled rule list is curated, not EasyList.** ~50 rules cover the most visible offenders (Google Ads, DoubleClick, GA, Hotjar, Segment, Mixpanel, social-graph beacons). Production-quality coverage would want EasyList (~50K rules) and EasyPrivacy. The engine handles that volume fine; what's missing is the build-time generation step that pulls EasyList sources, parses them, and either bakes them into the binary or ships a precompiled `.dat`. The engine's `serialize()` + `deserialize()` exist for exactly this — `BlockersWorker::InitAdBlock` would gain a `.dat`-first / `parse()`-fallback path.

- **`base_host` is the request initiator's host, not the top frame's.** Set in `ad_block_throttle.cc:WillStartRequest` from `request->request_initiator->host()`. For cross-frame requests (an iframe loading a sub-resource) this returns the iframe's origin, not the top-level frame's. ABP host-anchored rules (`||example.com^`) don't care about this; rules with `$third-party` / `$domain=...` modifiers will be slightly off for cross-frame initiators. None of the bundled rules use those modifiers, so this is a latent footgun, not an active bug. Reliable fix: synchronously access the WebContents on UI by deferring the request — but the latency cost on every URL is too high.

- **`kEnableSmartAdBlock` is unused.** Registered in `custom_prefs.cc` alongside `kEnableAdBlock`, but no code reads it. Placeholder slot for a future "engine + heuristics" mode.

- **Pref toggle has a per-request latency.** Reading `kEnableAdBlock` on every `CreateURLLoaderThrottles` call adds a `GetBoolean` to the request path. PrefService caches the boolean, so it's a hash lookup, but if profiling later shows it's expensive we can switch to a `PrefChangeRegistrar` + `std::atomic<bool>` cache.

- **No cosmetic filtering.** The engine has cosmetic-filter machinery (element-hiding rules like `##.ad-banner`) but the throttle only does network blocking — it can't hide DOM elements after the fact. Adding cosmetic filtering would mean a renderer-side component that receives the active rules and applies them on each page load. Out of scope for the current pipeline.

## Testing

Smoke test recipe:

1. Build with `enable_ad_blocker = true` (the default).
2. Open `chrome://settings` → Privacy and security → confirm the "Ad blocker" toggle is on.
3. Visit a typical news site or any page that loads `doubleclick.net` / `google-analytics.com` / `connect.facebook.net` resources.
4. The omnibox should show the "ads off" badge icon shortly after navigation.
5. Click the icon → bubble appears with the list of blocked hosts.
6. Toggle the pref off → reload the page → icon disappears, blocked count zero.
7. Navigate to a fresh tab → icon hidden, bubble (if still open) shows empty state.

What "broken" looks like:

| Symptom | Likely cause |
|---|---|
| Icon never appears | `enable_ad_blocker = false` at build time, OR the pref is off, OR the page doesn't load any matched hosts |
| Icon appears but bubble is empty | The `AdBlockTabHelper` reset on commit fired between the block and your click. Tab navigations clear the list — reload the page and click faster |
| `LOG(WARNING)` from BlockersWorker on first request | Engine parse failed — check `bundled_filter_rules.cc` syntax. The throttle's fallback substring list still works in this case |
| Toggling the pref doesn't seem to do anything | The toggle takes effect for **next** requests. Already-in-flight throttles keep their existing decision. Reload to see the new behavior |
| Blocked resources show in DevTools but the icon stays hidden | Verify `AdBlockTabHelper::CreateForWebContents` is being called in `chrome/browser/ui/tab_helpers.cc` for this WebContents — system / service WebContents don't get tab helpers attached |

For deeper inspection, enable VLOG: launch with `--enable-logging --v=1 --vmodule=blockers_worker=1,ad_block_throttle=1`. You'll see the "engine initialized" line on first navigation with the filter count, and the engine-vs-fallback decision for each blocked request.
