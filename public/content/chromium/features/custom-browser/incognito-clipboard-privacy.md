# Incognito Clipboard Privacy

Clears the system clipboard when the last incognito window closes, preventing data
copied during a private browsing session from persisting after the session ends.
Ported from Timberwolf (AmigaOS Firefox fork) feature #8 — Dual Clipboard with Privacy Hooks.

---

## Build flag

Gated by `BUILDFLAG(ENABLE_INCOGNITO_CLIPBOARD_PRIVACY)`. Controlled by `enable_incognito_clipboard_privacy = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

---

## What it does

When the last incognito (OTR) window belonging to a profile closes, the service clears
both the copy-paste clipboard buffer and the selection buffer (where supported by the OS).
Regular profile clipboard contents are never touched; only incognito session data is cleared.

The feature is on by default and controlled by a pref.

---

## Architecture

```
IncognitoClipboardServiceFactory (ProfileKeyedServiceFactory)
  └─► IncognitoClipboardService (KeyedService, per OTR profile)
        │  Created eagerly when any OTR profile is created.
        │  Observes BrowserList for window open/close events.
        │
        OnBrowserRemoved(browser):
          1. Guard: browser must be OTR, same original profile as this service.
          2. Scan BrowserList for remaining OTR windows for this profile.
          3. If none remain → call ClearIfEnabled().
        │
        ClearIfEnabled():
          1. Check kClearClipboardOnIncognitoClose pref.
          2. ui::Clipboard::GetForCurrentThread()->Clear(kCopyPaste)
          3. ui::Clipboard::GetForCurrentThread()->Clear(kSelection)
```

The factory returns `nullptr` for regular profiles and only creates a service for
OTR profiles (`GetBrowserContextToUse` returns `context` for OTR, `nullptr` otherwise).
`ServiceIsCreatedWithBrowserContext() = true` ensures the observer registers immediately
when the OTR profile is created, not lazily.

---

## Prefs

| Pref key | Type | Default | Purpose |
|---|---|---|---|
| `privacy.clear_clipboard_on_incognito_close` | bool | `true` | Master on/off switch |

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/clipboard/incognito_clipboard_service.h/.cc` | `KeyedService` + `BrowserListObserver`; `ClearIfEnabled()` |
| `custom/browser/clipboard/incognito_clipboard_service_factory.h/.cc` | OTR-only factory; eager creation |
| `custom/common/custom_pref_names.h` | `kClearClipboardOnIncognitoClose` |
| `custom/browser/prefs/custom_prefs.cc` | Pref registration |
| `custom/browser/sources.gni` | Source listing |
| `custom/browser/custom_browser_context_keyed_service_factories.cc` | Factory registration |

---

## Edge cases

- **Multiple OTR windows:** The service counts remaining OTR windows in `BrowserList`
  before clearing. Closing the second-to-last incognito window does not clear — only the
  last close triggers the clear.
- **Multiple profiles:** Each OTR profile gets its own `IncognitoClipboardService` instance.
  Closing all incognito windows for profile A clears the clipboard even if profile B still
  has incognito windows open (by design — clipboard is shared and any OTR close should clear).
- **Pref change at runtime:** Changing the pref mid-session takes effect on the next
  incognito window close. No restart required.

---

## Related docs

- [security-privacy-features.md](security-privacy-features.md) — companion security features
