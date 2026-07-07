# Bloomberg Diagnostic Handlers

Five diagnostic / tuning handlers ported from Bloomberg's chromium.bb (M104) fork.
All are exposed through `CustomSettingsHandler`
(`src/custom/browser/ui/webui/settings/custom_settings_handler.*`) and accessible
from `chrome://custom-settings`.

---

## 14. Renderer Memory Snapshot

Returns the OS-level memory usage for every renderer process associated with the
current profile's open tabs, grouped by process.

### Settings handler

| Message | Returns |
|---------|---------|
| `customGetRendererMemory` | `[{pid: int, memKb: int, urls: string[]}]` |

- **`pid`** — OS process ID of the renderer.
- **`memKb`** — Private bytes (Windows) or RSS (other platforms) in kilobytes,
  read via `base::ProcessMetrics::GetMemoryInfo()`.
- **`urls`** — Last-committed URLs of all tabs running in this renderer.

### Implementation

```
BrowserList (current profile only)
  └── TabStripModel → WebContents
        └── GetPrimaryMainFrame()->GetProcess()  →  RenderProcessHost*
              └── GetProcess().Handle()  →  base::ProcessMetrics
                    └── GetMemoryInfo().private_bytes (Win) / .resident_set_bytes
```

---

## 15. Page Performance Metrics (CDP)

Queries the Chrome DevTools Protocol `Performance.getMetrics` command on the
active tab and returns all metrics as a flat dict.

### Settings handler

| Message | Returns |
|---------|---------|
| `customGetPageMetrics` | `{RecalcStyleCount, LayoutCount, Nodes, JSHeapUsedSize, JSHeapTotalSize, ScriptDuration, LayoutDuration, ...}` |

### Implementation

An inline `PageMetricsSession` class (anonymous namespace in
`custom_settings_handler.cc`) implements `content::DevToolsAgentHostClient`:

1. Attaches to `content::DevToolsAgentHost::GetOrCreateFor(active_wc)`.
2. Sends CDP `Performance.enable` (id=1), then `Performance.getMetrics` (id=2).
3. On receiving the id=2 response, flattens the `metrics[]` array into a dict
   and fires the JS callback.
4. Detaches automatically.

The session is stored in the `page_metrics_session_` member and torn down in
`OnJavascriptDisallowed`.

### Key CDP metrics returned

| Metric | Meaning |
|--------|---------|
| `RecalcStyleCount` | Total style recalculations since page load |
| `LayoutCount` | Total full layout passes |
| `Nodes` | Current live DOM node count |
| `JSHeapUsedSize` | V8 heap in use (bytes) |
| `JSHeapTotalSize` | V8 heap total capacity (bytes) |
| `ScriptDuration` | Cumulative JS execution time (seconds) |
| `LayoutDuration` | Cumulative layout time (seconds) |

---

## 16. Log Throttle

A process-wide token-bucket rate limiter installed as Chromium's global log message
handler. Prevents runaway components from flooding logs and consuming memory.

### Source

`src/custom/common/log_throttle.h/.cc` — `custom::LogThrottle` singleton.

### Algorithm

```
On each log message:
  elapsed = now - last_refill
  tokens  = min(max_tokens, tokens + elapsed * rate_per_sec)
  last_refill = now
  if tokens < 1.0 → suppress message, increment suppressed_count
  else            → tokens -= 1.0, pass through
```

Burst capacity equals the steady-state rate (1 second's worth of tokens).

### Prefs

| Pref key | Type | Default | Purpose |
|---|---|---|---|
| `custom.log_throttle.enabled` | bool | `false` | Master enable |
| `custom.log_throttle.rate_per_sec` | int | `100` | Max messages per second |

Prefs are seeded into the singleton in `CustomSettingsHandler::OnJavascriptAllowed`.
Install the handler at startup with `custom::LogThrottle::GetInstance().Install()`.

### Settings handlers

| Message | Args | Returns |
|---------|------|---------|
| `customGetLogThrottle` | — | `{enabled, ratePerSec, suppressedCount}` |
| `customSetLogThrottleEnabled` | `[bool]` | — |
| `customSetLogThrottleRate` | `[int]` | — |

`suppressedCount` is read-and-reset on each `customGetLogThrottle` call
(`TakeSuppressedCount()` atomically exchanges the counter with zero).

---

## 17. Socket Pool Tuning

Exposes the three `net::ClientSocketPoolManager` limits that govern how many TCP
connections the browser opens simultaneously.

### Settings handlers

| Message | Args | Returns |
|---------|------|---------|
| `customGetSocketPoolConfig` | — | `{maxPerProxy, maxPerGroup, maxPerPool}` |
| `customSetSocketPoolConfig` | `[{maxPerProxy?, maxPerGroup?, maxPerPool?}]` | — |

### Limits

| Field | Default | What it controls |
|-------|---------|-----------------|
| `maxPerProxy` | 32 | Max sockets to a single proxy server |
| `maxPerGroup` | 6 | Max sockets to a single origin (host:port) |
| `maxPerPool` | 256 | Total sockets across all origins in the pool |

### Routing

- **`maxPerProxy`** — routes through
  `content::GetNetworkService()->SetMaxConnectionsPerProxyChain()`, the proper
  Mojo path that reaches the out-of-process network service (mirrors
  `NetworkService::SetMaxConnectionsPerProxyChain` in
  `services/network/network_service.cc`).
- **`maxPerGroup` / `maxPerPool`** — call `net::ClientSocketPoolManager` static
  setters directly; effective when the network service is in-process.

### Prefs

| Pref key | Type | Default | Purpose |
|---|---|---|---|
| `custom.socket_pool.max_per_proxy` | int | `0` | 0 = Chromium default |
| `custom.socket_pool.max_per_group` | int | `0` | 0 = Chromium default |
| `custom.socket_pool.max_per_pool` | int | `0` | 0 = Chromium default |

Values are applied in `CustomSettingsHandler::OnJavascriptAllowed` each time the
settings page opens.

---

## 18. Web Cache Flush

Clears the browser's entire HTTP disk cache on demand via a single settings
button.

### Settings handler

| Message | Returns |
|---------|---------|
| `customFlushWebCache` | `true` (when flush is complete) |

### Implementation

```cpp
profile->GetDefaultStoragePartition()
  ->GetNetworkContext()
  ->ClearHttpCache(
      base::Time(),        // from: beginning of time
      base::Time::Max(),   // to:   all entries
      nullptr,             // filter: none (clear everything)
      callback);
```

The JS promise resolves with `true` after the network service confirms the cache
has been flushed. The operation is async but typically completes in under a second
for typical cache sizes.
