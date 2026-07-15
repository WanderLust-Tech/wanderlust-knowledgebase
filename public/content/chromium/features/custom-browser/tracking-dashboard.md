# Tracking Relationship Dashboard

A passive network observer that records first-party / third-party domain
relationships during the browsing session and visualises them at
`chrome://tracking-dashboard` as a force-directed graph. No requests are
blocked or modified — the feature is purely observational.

---

## Build flag

Gated by `BUILDFLAG(ENABLE_TRACKING_DASHBOARD)`. Controlled by `enable_tracking_dashboard = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

---

## What it does

Every time the browser loads a subresource whose host differs from the
initiating page's host, the relationship is recorded:

```
user visits:         news.example.com
  └─ requests:       cdn.tracker.com  → recorded as  news.example.com → cdn.tracker.com
                     fonts.gstatic.com → recorded as  news.example.com → fonts.gstatic.com
```

The dashboard page shows:
- **Stat cards** — unique tracker count and first-party site count for the session.
- **Force-directed graph** — blue nodes are first-party sites (larger); orange
  nodes are third-party trackers (smaller); grey edges connect them. The graph
  animates to a stable layout using a spring-physics simulation (pure SVG +
  React, no D3 dependency).
- **Clear data** button — wipes all recorded relationships for the session.

Relationships are persisted to a per-profile LevelDB database at `<profile_dir>/TrackingRelationships/` and survive browser restarts. The in-memory map is the authoritative copy; LevelDB is written asynchronously as a durable mirror.

---

## Architecture

```
TrackingRelationshipThrottle (blink::URLLoaderThrottle)
│  Created per-request in CustomContentBrowserClient::CreateURLLoaderThrottles.
│  WillStartRequest: if request.request_initiator.host ≠ request.url.host
│    → posts RecordCallback to UI thread (base::BindPostTask)
│  Does not block or defer requests.
│
RecordCallback (WeakPtr<TrackingRelationshipService> + UI PostTask)
│  Posted from any sequence → UI thread.
│  Calls TrackingRelationshipService::RecordRelationship(fp, tp).
│
TrackingRelationshipService (KeyedService, per-profile)
│  Stores: flat_map<string, flat_set<string>>  (first_party → {third_parties})
│  Bounds:  ≤ 500 first-party entries; ≤ 100 third-party entries each.
│           Oldest first-party entry evicted when cap is reached.
│  Persistence: LevelDB at <profile_dir>/TrackingRelationships/.
│    - DB opened asynchronously at construction on a MayBlock task runner.
│    - All keys loaded into memory on open; writes are fire-and-forget.
│    - Writes before the DB is ready are buffered in pending_db_keys_.
│    - Clear() issues a LevelDB WriteBatch deleting all keys.
│  Notifies Observer list after every RecordRelationship() and Clear() call.
│
TrackingRelationshipServiceFactory
│  OTR profiles redirect to their parent profile's instance
│  (GetBrowserContextRedirectedInIncognito).
│  Registered in EnsureBrowserContextKeyedServiceFactoriesBuilt().
│
TrackingDashboardUI  (WebUIController, chrome://tracking-dashboard)
│  Registers TrackingDashboardHandler.
│
TrackingDashboardHandler (WebUIMessageHandler)
│  Observes TrackingRelationshipService while JS is active.
│  ├── trackingGetGraph()  → {nodes, edges, trackerCount, siteCount}
│  ├── trackingClear()     → calls service->Clear()
│  └── trackingDataChanged (pushed on RecordRelationship / Clear)
│
React app (custom_tracking_dashboard component)
  ForceGraph.tsx: pure-SVG spring simulation using requestAnimationFrame.
  Repulsion between all node pairs + spring attraction along edges +
  centering force. Alpha decays to 0, at which point ticking stops.
```

---

## Third-party detection

The throttle compares:

```
first_party = request.request_initiator->GetURL().host()
third_party  = request.url.host()
```

A request is recorded when both hosts are non-empty, different, and the
resource URL uses `http://` or `https://`. Internal schemes (`chrome://`,
`chrome-extension://`, `data:`, etc.) are skipped.

> **Note:** This is host-level comparison, not eTLD+1. `api.example.com`
> loaded from `www.example.com` will appear as a cross-host relationship
> even though both share the `example.com` registrable domain. A future
> improvement can use `net::registry_controlled_domains` to compare
> registrable domains instead.

---

## Memory bounds

| Limit | Value | Rationale |
|---|---|---|
| Max first-party entries | 500 | Prevents unbounded map growth in long sessions |
| Max third-parties per site | 100 | Most sites load far fewer; cap prevents pathological cases |
| Eviction policy | FIFO (oldest first-party) | Simple, predictable; does not require a clock |

---

## File map

| Path | Purpose |
|---|---|
| `custom/common/webui_url_constants.h` | `kChromeUITrackingDashboardHost` / `kChromeUITrackingDashboardURL` |
| `custom/browser/tracking/tracking_relationship_service.h/.cc` | Per-profile KeyedService, bounded map storage, Observer API |
| `custom/browser/tracking/tracking_relationship_service_factory.h/.cc` | BCKF — OTR redirect, singleton registration |
| `custom/browser/tracking/tracking_relationship_throttle.h/.cc` | Non-blocking `URLLoaderThrottle` — detection + callback |
| `custom/browser/custom_content_browser_client.cc` | Wires throttle in `CreateURLLoaderThrottles()` |
| `custom/browser/custom_browser_context_keyed_service_factories.cc` | Registers factory at startup |
| `custom/browser/ui/webui/tracking_dashboard/tracking_dashboard_ui.h/.cc` | WebUIController + config |
| `custom/browser/ui/webui/tracking_dashboard/tracking_dashboard_handler.h/.cc` | WebUIMessageHandler + service observer |
| `custom/browser/ui/webui/BUILD.gn` | Adds handler + UI `.cc` pairs to the webui target |
| `custom/browser/sources.gni` | Adds service, factory, throttle to `custom_browser_net` |
| `custom/components/custom_tracking_dashboard/` | React app bundle |
| `custom/components/custom_tracking_dashboard/ForceGraph.tsx` | Pure-SVG spring simulation, no D3 required |
| `custom/patches/chrome-browser-ui-webui-chrome_web_ui_configs.cc.patch` | Registers `TrackingDashboardUIConfig` |

---

## JS ↔ C++ message protocol

```typescript
// JS → C++
window.cr.sendWithPromise<GraphData>('trackingGetGraph')
window.chrome.send('trackingClear', [])

// C++ → JS (pushed after every new edge and after clear)
cr.addWebUIListener('trackingDataChanged', (data: GraphData) => {})

// GraphData shape
interface GraphNode {
  id:           string;
  label:        string;
  isFirstParty: boolean;
}
interface GraphEdge {
  source: string;   // first-party host
  target: string;   // third-party host
}
interface GraphData {
  nodes:        GraphNode[];
  edges:        GraphEdge[];
  trackerCount: number;   // unique third-party domains across all sites
  siteCount:    number;   // unique first-party sites
}
```

---

## Opening the dashboard

Navigate to `chrome://tracking-dashboard` directly, or add a toolbar button
(future work — the dashboard is a full-tab page, not a bubble).

---

## Future enhancements

| Area | Description | Notes |
|---|---|---|
| eTLD+1 comparison | Use `net::registry_controlled_domains::GetDomainAndRegistry()` to compare registrable domains instead of raw hosts. `api.example.com` and `www.example.com` would then not appear as cross-party. | See the third-party detection note above. |
| Toolbar quick-access button | A toolbar button that shows a badge with the tracker count for the current tab, and opens the dashboard on click. The per-tab count is already available via `TrackingRelationshipService::GetTrackerCountForSite()`. | Pattern: same as `PrivacyShieldButton`. |
| Filter by first-party site | Add a search/filter input to the dashboard React app to highlight or isolate a single first-party node and its edges. | Pure frontend change — no new C++ required. |

---

## Related docs

- [security-privacy-features.md](security-privacy-features.md) — the request-blocking features that complement this dashboard
- [privacy-shield.md](privacy-shield.md) — the unified privacy feature toggle panel
