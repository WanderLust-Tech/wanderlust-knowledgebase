# Scheme Aliases (Pluggable Protocol Handlers)

Per-profile registry of `wanderlust://` URL shortcuts that redirect to any
destination — `chrome://` internal pages or `https://` external URLs.
Ported from Timberwolf (Mozilla) F9 Pluggable Protocol Handlers concept.

---

## Build flag

Gated by `BUILDFLAG(ENABLE_SCHEME_ALIASES)`. Controlled by `enable_scheme_aliases = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

---

## What it does

When the user navigates to `wanderlust://<name>` and `<name>` is registered as
an alias, the browser transparently redirects to the configured destination:

```
wanderlust://home       → chrome://newtab          (built-in)
wanderlust://prefs      → chrome://settings         (built-in)
wanderlust://addons     → chrome://extensions       (built-in)
wanderlust://about      → chrome://version          (built-in)
wanderlust://network    → chrome://net-internals    (built-in)
wanderlust://memory     → chrome://memory-internals (built-in)
wanderlust://mail       → https://gmail.com         (user-defined example)
wanderlust://corp       → https://intranet.company.com (user-defined example)
```

`wanderlust://` URLs that are neither registered aliases nor real `wanderlust://`
pages resolve naturally (and fail, if no handler exists). The throttle only fires
on known aliases — it does not interfere with real `wanderlust://` pages.

---

## Architecture

```
SchemeAliasServiceFactory (ProfileKeyedServiceFactory)
  │  Regular: kOwnInstance   Guest/Ash: kNone
  │  Lazy creation (no ServiceIsCreatedWithBrowserContext)
  │
  └─► SchemeAliasService (KeyedService)
        │
        Constructor:
          LoadUserAliases() ← parse kCustomSchemeAliases pref
          RebuildRegistry() ← merge built-ins + user aliases
          PrefChangeRegistrar.Add(kCustomSchemeAliases, ...)
        │
        Resolve(url):
          if url.scheme != kCustomUIScheme → nullopt
          registry_.find(url.host()) → optional<GURL>
        │
        SetAlias(name, url):
          insert/update user_aliases_  → Persist() → RebuildRegistry()
        │
        RemoveAlias(name):
          erase from user_aliases_ → Persist() → RebuildRegistry()

SchemeAliasNavigationThrottle (content::NavigationThrottle)
  MaybeCreateThrottleFor():
    - main frame only
    - URL scheme must be kCustomUIScheme
  WillStartRequest():
    - SchemeAliasService::Resolve(url)
    - if matched → PostTask(OpenURL(dest)) → CANCEL_AND_IGNORE
    - if not matched → PROCEED
```

The throttle is registered in `CustomContentBrowserClient::CreateThrottlesForNavigation()`.

---

## Registry priority

| Priority | Source | Overrides |
|---|---|---|
| Highest | User-defined aliases (pref) | shadows built-ins with same name |
| Lowest | Built-in aliases (compile-time) | — |

User-defined aliases can override built-in aliases — e.g. `wanderlust://home`
can be pointed at a custom dashboard instead of `chrome://newtab`.

---

## Pref format

**Key:** `custom.scheme_aliases`  
**Type:** string (JSON)  
**Default:** `"[]"`

```json
[
  {"name": "mail",  "url": "https://gmail.com"},
  {"name": "corp",  "url": "https://intranet.example.com"},
  {"name": "home",  "url": "https://my-dashboard.example.com"}
]
```

---

## Built-in aliases

| Name | Destination |
|---|---|
| `home` | `chrome://newtab` |
| `prefs` | `chrome://settings` |
| `addons` | `chrome://extensions` |
| `plugins` | `chrome://extensions` |
| `about` | `chrome://version` |
| `network` | `chrome://net-internals` |
| `memory` | `chrome://memory-internals` |

---

## Redirect mechanism

The throttle uses `CANCEL_AND_IGNORE` + a posted `OpenURL()` call, identical to
the `MagnetNavigationThrottle` pattern. Calling `OpenURL()` directly inside
`WillStartRequest()` would race with the cancellation and briefly show
`about:blank`. Posting to the current `SequencedTaskRunner` ensures the throttle
has fully unwound before the destination navigation starts.

---

## C++ API

```cpp
// Get the service for the current profile.
auto* aliases = SchemeAliasServiceFactory::GetForProfile(profile);

// Register a user alias (persisted immediately).
aliases->SetAlias("mail", "https://gmail.com");

// Remove a user alias.
aliases->RemoveAlias("mail");

// Query the full user alias list (built-ins not included).
for (const auto& a : aliases->GetUserAliases())
  DVLOG(1) << a.name << " → " << a.url;

// Resolve programmatically.
auto dest = aliases->Resolve(GURL("wanderlust://mail"));
// dest == GURL("https://gmail.com")
```

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/scheme_aliases/scheme_alias_service.h/.cc` | `KeyedService`; alias registry; `Resolve()`, `SetAlias()`, `RemoveAlias()` |
| `custom/browser/scheme_aliases/scheme_alias_service_factory.h/.cc` | `ProfileKeyedServiceFactory`; lazy creation |
| `custom/browser/scheme_aliases/scheme_alias_navigation_throttle.h/.cc` | `NavigationThrottle`; intercepts `wanderlust://` navigations |
| `custom/browser/custom_content_browser_client.cc` | Registers throttle in `CreateThrottlesForNavigation()` |
| `custom/browser/prefs/custom_prefs.cc` | Registers `kCustomSchemeAliases` pref |
| `custom/common/custom_pref_names.h` | `kCustomSchemeAliases` constant |
| `custom/browser/sources.gni` | Source listing |
| `custom/browser/custom_browser_context_keyed_service_factories.cc` | Factory registration |

---

## Difference from Timberwolf's Pluggable Protocol Handlers

Mozilla's F9 registered full `nsIProtocolHandler` XPCOM components via contract
IDs, allowing extensions to handle entire URI schemes (e.g. `feed://`, `news://`,
custom schemes) without patching core. Each handler ran in the content process
and implemented full request/response semantics.

WanderLust's approach is simpler and scoped to the existing `wanderlust://`
namespace: aliases are resolved at navigation time before the request reaches the
network stack, redirecting to any valid destination URL. No new URI scheme
registration is required, and no extension API or XPCOM machinery is needed.
The underlying design principle — user-configurable per-scheme routing without
source patches — maps directly.
