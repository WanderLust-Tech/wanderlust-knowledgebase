# Typed Input History

Per-profile persistent store of URLs typed directly into the address bar, with frecency
scoring for ranked autocomplete suggestions. Ported from the Gecko/Firefox Places
`moz_inputhistory` table design (Timberwolf F2).

---

## Build flag

Gated by `BUILDFLAG(ENABLE_TYPED_INPUT_HISTORY)`. Controlled by `enable_typed_input_history = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

---

## What it does

Every time a user types a URL directly into the omnibox (i.e., `PAGE_TRANSITION_TYPED`
navigation), the service records the raw typed text (e.g., `"github"`) alongside the
committed URL (e.g., `"https://github.com/"`), a visit count, and a last-visit timestamp.
On subsequent typing, suggestions are returned ranked by **frecency** — a score combining
visit frequency and recency.

Data is persisted to `{profile}/typed_input_history.json` and loaded lazily on first use.
Write flushes are debounced by 1 second to avoid excessive disk I/O.

---

## Architecture

```
TypedInputHistoryServiceFactory (BrowserContextKeyedServiceFactory)
  │  OTR profiles redirect to parent (GetBrowserContextRedirectedInIncognito) so
  │  incognito browsing can use inline suggestions without recording new private visits.
  │
  └─► TypedInputHistoryService (KeyedService, per-profile)
        │  Observes BrowserList to attach to new browsers.
        │  Observes TabStripModel to attach to new tabs.
        │
        TypedInputTabObserver (content::WebContentsObserver)
          │  Heap-allocated, self-deleting (deleted in WebContentsDestroyed).
          │  Holds base::WeakPtr<TypedInputHistoryService>.
          │  DidFinishNavigation():
          │    - Guard: primary main frame, committed, not same-doc, not error page
          │    - Guard: PAGE_TRANSITION_TYPED only
          │    - Get typed text from NavigationEntry::GetUserTypedURL() (falls back
          │      to committed URL spec if GetUserTypedURL is empty)
          │    - Call service->RecordNavigation(typed_text, url)
        │
        EnsureLoaded(callback):
          - Async read from {profile}/typed_input_history.json on MayBlock sequence
          - Queues callbacks while loading; fires all on OnFileLoaded()
        │
        DoRecord(typed_text, url, now_seconds):
          - Find or create entry matching (typed_text, url)
          - Increment count, update last_visit
          - If entries > 1000: evict the lowest-frecency entry
          - Schedule debounced write (1s timer → PostPersist)
        │
        GetSuggestionsForPrefix(prefix, max_count, callback):
          - Score all entries where typed_text.starts_with(prefix)
          - Sort by frecency score descending, return top max_count
```

### Frecency scoring

```
score = log1p(count) × exp(−age_days / 14.0)
```

| Variable | Meaning |
|---|---|
| `count` | Number of times this (typed_text, url) pair was recorded |
| `age_days` | `(now − last_visit_unix_seconds) / 86400` |
| `14.0` | Half-life in days: score halves every 14 days of inactivity |

Higher count and more recent activity → higher score.

---

## Storage format

`{profile}/typed_input_history.json`:

```json
{
  "version": 1,
  "entries": [
    {
      "typed": "github",
      "url": "https://github.com/",
      "count": 12,
      "last": 1748822400
    }
  ]
}
```

`last` is a Unix timestamp (seconds). Entries exceeding 1000 are pruned by lowest frecency.

---

## Prefs

No prefs. The service is always active for regular profiles. To disable, the factory
would need to return `nullptr` from `GetBrowserContextToUse()`.

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/typed_history/typed_input_history_service.h/.cc` | `KeyedService`, frecency, EnsureLoaded, disk I/O, `TypedInputTabObserver` |
| `custom/browser/typed_history/typed_input_history_service_factory.h/.cc` | `BrowserContextKeyedServiceFactory`; OTR redirect |
| `custom/browser/sources.gni` | Source listing |
| `custom/browser/custom_browser_context_keyed_service_factories.cc` | Factory registration |

---

## Notes

- **OTR sharing:** Incognito profiles share the parent's `TypedInputHistoryService`
  (read-only via `GetSuggestionsForPrefix`). Typed navigations in incognito do NOT call
  `RecordNavigation` — the observer only fires for navigation commits, not for the service
  to distinguish OTR. A future improvement could guard `RecordNavigation` by checking
  `profile_->IsOffTheRecord()`.
- **Self-deleting observer:** `TypedInputTabObserver` is heap-allocated and holds a
  `WeakPtr` to the service. When the service shuts down (profile destruction), the WeakPtr
  becomes null and subsequent navigations are silently dropped. The observer self-deletes
  in `WebContentsDestroyed()`.
- **No `TabStripModelDestroyed` override:** This Chromium version does not declare
  `TabStripModelDestroyed` as virtual in `TabStripModelObserver`. Cleanup on browser
  removal is handled by `OnBrowserRemoved` calling `RemoveObserver` directly.

---

## Related docs

- [tracking-dashboard.md](tracking-dashboard.md) — passive navigation relationship observer
