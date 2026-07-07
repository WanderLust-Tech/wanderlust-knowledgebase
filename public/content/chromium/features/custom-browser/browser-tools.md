# Browser Tools

Three utility commands in the three-dot app menu under `BUILDFLAG(CUSTOM_BROWSER)`:
Restart, Restart & Clear Cache, and Flush Memory. All appear at the bottom of
the menu just above the Exit item, after a normal separator that follows Settings.

---

## Build flag

Gated by `BUILDFLAG(CUSTOM_BROWSER)`. Controlled by `custom_browser = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

---

## Commands

### Restart — `IDC_CUSTOM_RESTART`

Calls `chrome::AttemptRestart()` directly. Equivalent to closing and reopening
the browser with session restore. All open tabs are saved and restored on the
next launch.

### Restart & Clear Cache — `IDC_CUSTOM_RESTART_CLEAR_CACHE`

Clears the HTTP cache for all unprotected web origins, then restarts.

Uses `BrowsingDataRemover::RemoveAndReply` with a heap-allocated
`RestartObserver` that fires `chrome::AttemptRestart()` once the cache removal
completes and self-deletes:

```cpp
class RestartObserver : public content::BrowsingDataRemover::Observer {
 public:
  void OnBrowsingDataRemoverDone(uint64_t failed_data_types) override {
    chrome::AttemptRestart();
    delete this;
  }
};

// In AppMenuModel::ExecuteCommand:
case IDC_CUSTOM_RESTART_CLEAR_CACHE:
  browser_->profile()->GetBrowsingDataRemover()
      ->RemoveAndReply(base::Time(), base::Time::Max(),
                       content::BrowsingDataRemover::DATA_TYPE_CACHE,
                       content::BrowsingDataRemover::ORIGIN_TYPE_UNPROTECTED_WEB,
                       new RestartObserver());
  return;
```

The observer is created on the heap and self-deletes in `OnBrowsingDataRemoverDone`
so no ownership plumbing is needed. `DATA_TYPE_CACHE` covers the HTTP disk cache
only — cookies, history, and stored passwords are not touched.

> **M137 API note:** `GetBrowsingDataRemover()` changed from a static method
> (`content::BrowserContext::GetBrowsingDataRemover(context*)`) to a non-static
> member in Chromium M137. See
> [chromium-136-to-137-migration.md §4.5](chromium-136-to-137-migration.md).

### Flush Memory — `IDC_CUSTOM_FLUSH_MEMORY`

Sends a critical memory pressure notification across all browser processes:

```cpp
case IDC_CUSTOM_FLUSH_MEMORY:
  base::MemoryPressureListener::NotifyMemoryPressure(
      base::MemoryPressureListener::MEMORY_PRESSURE_LEVEL_CRITICAL);
  return;
```

This triggers Chromium's built-in memory pressure response in every process:

- **Renderer processes** — V8 garbage collection, image cache eviction,
  parsed script cache purge
- **GPU process** — GPU resource cache flush
- **Browser process** — any `MemoryPressureListener` callbacks registered by
  browser subsystems

No tabs are closed. Effect is equivalent to the OS sending a low-memory signal
and can free several hundred MB in a typical browsing session with many open tabs.

---

## File map

| File | Change |
|---|---|
| `chrome/browser/ui/toolbar/app_menu_model.cc` (patch) | `RestartObserver` class definition; `ExecuteCommand` cases for all three IDs; `IsCommandIdEnabled` cases; `Build()` menu item additions |
| `chrome/app/chrome_command_ids.h` (patch) | Registers `IDC_CUSTOM_RESTART`, `IDC_CUSTOM_RESTART_CLEAR_CACHE`, `IDC_CUSTOM_FLUSH_MEMORY` |
| `custom/grd/custom_strings.grd` | `IDS_MENU_RESTART`, `IDS_MENU_RESTART_CLEAR_CACHE`, `IDS_MENU_FLUSH_MEMORY` string entries |

---

## Testing

- **Restart:** Open the app menu → click Restart. Browser closes and reopens;
  previously open tabs should restore.
- **Restart & Clear Cache:** Same path. After restart, force-reload
  (`Ctrl+Shift+R`) a previously visited page — the response should be a fresh
  200 (not a 304 from cache).
- **Flush Memory:** Open `chrome://memory-internals` and note the private memory
  footprint of renderer processes. Click Flush Memory. Reload
  `chrome://memory-internals` — footprint of renderer processes should decrease
  measurably (most visible after heavy JavaScript or many open tabs).

---

## Related docs

- [cyberfox-features.md](cyberfox-features.md) — origin analysis (features 2 and 3)
- [chromium-136-to-137-migration.md](chromium-136-to-137-migration.md) — §4.5 `GetBrowsingDataRemover` API change
