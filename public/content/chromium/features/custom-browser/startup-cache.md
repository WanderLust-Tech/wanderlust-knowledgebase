# Startup Cache

Per-profile JSON key-value store with deferred disk writes: reads from disk
asynchronously at profile creation (background thread, `OnFileRead` callback
populates the in-memory dict), then holds all mutations in memory and flushes
to disk only after the first browser window has been open for 5 seconds. All
writes use a `BLOCK_SHUTDOWN` task runner to guarantee persistence even if the
browser exits quickly.
Ported from Timberwolf (Mozilla) deferred startup cache write pattern (#13).

---

## Build flag

Gated by `BUILDFLAG(CUSTOM_CACHE)`. Controlled by `custom_cache = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

---

## What it does

### Deferred writes

All `Set()` / `Remove()` calls during the startup phase update an in-memory
`base::Value::Dict`. The write to `{profile}/startup_cache.json` is deferred:

```
Profile created
  └─► StartupCacheService constructed
        │  PostTaskAndReplyWithResult(background → ReadFromDisk)
        │  BrowserList::AddObserver(this)
        │
        OnFileRead() [UI-thread callback]:
        │  Set "last_clean_shutdown" = false  ← in memory only
        │  Set "last_startup_time" = now       ← in memory only
        │  Increment "launch_count"            ← in memory only
        │
        [startup runs — zero disk writes from this service]
        │
        OnBrowserAdded() fires for the first browser window
        │  RemoveObserver
        │  Start 5-second timer
        │
        Timer fires → DoFlush()
          PostTask(background MayBlock thread)
            └─► WriteToDisk(cache_path, data_.Clone())
```

On clean shutdown `Shutdown()` fires:
- Sets `last_clean_shutdown = true`
- Posts the write to `task_runner_` (BLOCK_SHUTDOWN — guaranteed to run
  before the process exits without blocking the UI thread)

### Crash detection

Because `last_clean_shutdown` is set to `false` in memory in `OnFileRead` (and
flushed to disk 5 s into the session), if the browser subsequently crashes, the
next launch will read `false` and `PreviousSessionCrashed()` will return `true`.
A clean exit always writes `true` via `Shutdown()` before the process terminates.

### General-purpose cache

Callers can store arbitrary session metadata that survives restarts:

```cpp
auto* cache = StartupCacheServiceFactory::GetForProfile(profile);

// Write (deferred)
cache->Set("my_feature.last_sync_time", base::Value(timestamp));

// Read (immediate, from in-memory dict)
auto val = cache->Get("my_feature.last_sync_time");
if (val && val->is_double())
  last_sync = val->GetDouble();
```

---

## Architecture

```
StartupCacheServiceFactory (ProfileKeyedServiceFactory)
  │  ServiceIsCreatedWithBrowserContext() = true  ← must observe BrowserList early
  │  Regular: kOriginalOnly  Guest/Ash: kNone
  │
  └─► StartupCacheService (KeyedService + BrowserListObserver)
        │
        Constructor:
          PostTaskAndReplyWithResult(background → ReadFromDisk(path))
          BrowserList::AddObserver(this)
        │
        OnFileRead(dict) [UI-thread callback]:
          data_ = dict
          previous_session_crashed_ = (last_clean_shutdown == false)
          data_.Set("last_clean_shutdown", false)   ← crash sentinel
          data_.Set("last_startup_time", now)
          data_.Set("launch_count", prev + 1)
        │
        Get(key)  → data_.Find(key)  [sync, no I/O]
        Set(key)  → data_.Set(key)   [sync, marks dirty, no I/O until flush]
        Remove(k) → data_.Remove(k)  [sync, no I/O]
        │
        OnBrowserAdded(browser):
          Guard: profile matches.
          BrowserList::RemoveObserver(this)
          flush_timer_.Start(5s, DoFlush)
        │
        DoFlush():
          task_runner_->PostTask(WriteToDisk, cache_path_, data_.Clone())
                         ↑ MayBlock, BEST_EFFORT, BLOCK_SHUTDOWN
        │
        Shutdown():
          flush_timer_.Stop()
          data_.Set("last_clean_shutdown", true)
          task_runner_->PostTask(WriteToDisk)   ← BLOCK_SHUTDOWN, guaranteed
```

---

## Cache file

**Location:** `{profile_dir}/startup_cache.json`

**Format:**
```json
{
  "last_clean_shutdown": false,
  "last_startup_time": 1748822400.0,
  "launch_count": 42
}
```

The file is capped at **4 KB** on read (anything larger is treated as corrupt and
discarded). It is a plain JSON object — callers add arbitrary top-level keys.

**Built-in keys:**

| Key | Type | Set by | Meaning |
|---|---|---|---|
| `last_clean_shutdown` | bool | service (auto) | `true` after a clean exit; `false` while running |
| `last_startup_time` | double | service (auto) | Unix timestamp (seconds) of this launch |
| `launch_count` | int | service (auto) | Cumulative successful-launch counter |

---

## I/O design

### Read — async with BLOCK_SHUTDOWN task runner

The initial read is posted as `PostTaskAndReplyWithResult` on the same sequenced
`BLOCK_SHUTDOWN` task runner that handles writes:

- **No UI thread blocking** — the constructor never calls
  `ReadFileToStringWithMaxSize` directly. The background read completes well
  before `OnBrowserAdded` fires (profile init precedes any browser window
  creation by hundreds of milliseconds).
- **File is tiny** — capped at 4 KB; I/O latency is negligible.
- **Shared BLOCK_SHUTDOWN runner** — read and write tasks share one sequenced
  runner. Using `BLOCK_SHUTDOWN` everywhere ensures the task queue drains in
  order; a write cannot overtake an in-flight read during startup.

### Write — always async, always BLOCK_SHUTDOWN

Both the deferred flush (`DoFlush`) and the shutdown write (`Shutdown`) post to
the `BLOCK_SHUTDOWN` task runner. The process cannot exit until all
`BLOCK_SHUTDOWN` tasks have run, so `last_clean_shutdown = true` is guaranteed
to reach disk even if the user closes the browser immediately after opening it.

> **Why not `base::ScopedAllowBlocking`?** In this Chromium version,
> `ScopedAllowBlocking` has a private constructor/destructor gated to an
> approved friend list. It cannot be used in custom service code.
> `BLOCK_SHUTDOWN` achieves the same persistence guarantee without modifying
> Chromium's thread restrictions.

---

## Crash detection usage example

```cpp
// In CustomMainExtraParts::PostProfileInit():
auto* cache = StartupCacheServiceFactory::GetForProfile(profile);
if (cache && cache->PreviousSessionCrashed()) {
  // Offer to restore the session, skip auto-play, show a recovery banner, etc.
  LOG(WARNING) << "Previous session ended unexpectedly.";
}
```

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/startup/startup_cache_service.h/.cc` | `KeyedService` + `BrowserListObserver`; async read/write, in-memory dict, flush timer, crash detection |
| `custom/browser/startup/startup_cache_service_factory.h/.cc` | `ProfileKeyedServiceFactory`; eager creation (`kOriginalOnly`); cache path = `{profile}/startup_cache.json` |
| `custom/browser/sources.gni` | Source listing |
| `custom/browser/custom_browser_context_keyed_service_factories.cc` | Factory registration |

---

## Difference from Timberwolf's StartupCache

Mozilla's startup cache serialised compiled XPCOM component objects to a ZIP file for
fast subsequent loads — essentially a precompiled module cache. Our implementation is
a simpler key-value metadata store (no object serialisation). The design principle that
transfers directly is the **deferred write rule**: nothing in the cache write path ever
runs before the first browser window has settled, keeping the startup I/O budget clean.

---

## Related docs

- [crash-resume-downloads.md](crash-resume-downloads.md) — uses the crash signal to resume interrupted downloads
