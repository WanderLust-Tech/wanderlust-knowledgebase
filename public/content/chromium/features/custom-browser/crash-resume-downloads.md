# Crash-Resilient Downloads

Automatically resumes interrupted downloads when the browser restarts after a crash.
Ported from the Gecko `nsDownloadManager` crash-persistent state design (Timberwolf F11).

---

## Build flag

Gated by `BUILDFLAG(ENABLE_CRASH_RESUME_DOWNLOADS)`. Controlled by `enable_crash_resume_downloads = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

---

## What it does

When Chromium crashes mid-download, the downloads are left in an `INTERRUPTED` state in
the download database. On the next launch, Chromium reloads them from disk but does not
resume them automatically — the user must manually click "Resume" on each one.

`CrashResumeDownloadService` attaches to the `DownloadManager` as an observer and, once
the download database has finished loading (`OnManagerInitialized`), iterates all
downloads and calls `Resume()` on any that are `INTERRUPTED` and `CanResume()`. This
happens transparently on every browser start, with no user action required.

---

## Architecture

```
CrashResumeDownloadServiceFactory (ProfileKeyedServiceFactory)
  │  ServiceIsCreatedWithBrowserContext() = true  ← eager: must observe before init fires
  │  Regular profiles: kOwnInstance
  │  Guest / Ash internals: kNone (no downloads)
  │
  └─► CrashResumeDownloadService (KeyedService, per-profile)
        │  Constructor:
        │    download_manager_ = profile->GetDownloadManager()
        │    download_manager_->AddObserver(this)
        │    if (IsManagerInitialized()) → ResumeInterruptedDownloads()
        │
        OnManagerInitialized():
          → ResumeInterruptedDownloads()
        │
        ManagerGoingDown(manager):
          → RemoveObserver, null download_manager_
        │
        ResumeInterruptedDownloads():
          1. Guard: kCustomAutoResumeInterruptedDownloads pref must be true.
          2. GetAllDownloads(&downloads)
          3. For each item: if INTERRUPTED && CanResume() → item->Resume(false)
```

### Why eager creation matters

`ServiceIsCreatedWithBrowserContext()` returns `true` so the service is instantiated
at profile creation time. If it were lazy, the `DownloadManager` could finish
`OnManagerInitialized()` before the service is first accessed, causing the callback to
be missed. Eager creation guarantees the observer is attached before any initialization
races occur.

### Why `IsManagerInitialized()` is checked in the constructor

In rare cases (e.g., profile restoration when the download manager is kept warm across
some code paths), the manager may already be initialized by the time the service
constructor runs. The inline check handles this without duplicating the resume logic.

---

## Prefs

| Pref key | Type | Default | Purpose |
|---|---|---|---|
| `custom.download.auto_resume_interrupted` | bool | `true` | Auto-resume on startup. Set to `false` to disable and rely on manual resume. |

---

## What "interrupted" means

Chromium classifies a download as `INTERRUPTED` when:
- The network connection dropped mid-transfer
- The browser process crashed while the download was in-flight
- The server closed the connection unexpectedly
- The file write failed (e.g., disk full)

`CanResume()` returns `true` when:
- The server indicated it supports HTTP `Range` requests (`Accept-Ranges: bytes`)
- The partial file is still on disk and the ETag / Last-Modified hasn't changed

If `CanResume()` returns `false` (server doesn't support ranges, partial file missing),
the download cannot be resumed and is left as-is.

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/download/crash_resume_download_service.h/.cc` | `KeyedService` + `DownloadManager::Observer`; `ResumeInterruptedDownloads()` |
| `custom/browser/download/crash_resume_download_service_factory.h/.cc` | `ProfileKeyedServiceFactory`; eager creation |
| `custom/common/custom_pref_names.h` | `kCustomAutoResumeInterruptedDownloads` |
| `custom/browser/prefs/custom_prefs.cc` | Pref registration (default `true`) |
| `custom/browser/sources.gni` | Source listing |
| `custom/browser/custom_browser_context_keyed_service_factories.cc` | Factory registration |

---

## Difference from Timberwolf's approach

Timberwolf's `nsDownloadManager` used a SQLite database to persist every download's
state (URL, path, MIME type, progress, byte offset) and drove resumption from that store.
This implementation does not replace Chromium's existing download persistence — it
delegates to `DownloadItem::Resume()` which uses Chromium's own partial-file + ETag
state for the actual HTTP Range request. The value added is the **automatic** invocation
of resume at startup, which Chrome does not do out of the box.

---

## Related docs

- [custom-download-shelf.md](custom-download-shelf.md) — custom shelf UI for active downloads
