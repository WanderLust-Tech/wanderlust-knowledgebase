# Origin Permission Grants

Per-origin capability pre-grants: allow or deny specific browser permissions for
chosen origins without user prompts. Useful for enterprise intranet deployments,
kiosk configurations, and trusted internal web apps.
Ported from the Gecko/Timberwolf `nsIPrincipal` capability grant system (F12).

---

## Build flag

Gated by `BUILDFLAG(ENABLE_ORIGIN_PERMISSION_GRANTS)`. Controlled by `enable_origin_permission_grants = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

---

## What it does

Normally, Chromium asks the user before granting permissions like camera, microphone,
or geolocation. This service lets an administrator (or the user via settings) pre-set
the answer for specific origins. A camera grant for `https://meet.corp.example.com`
means the browser never prompts for camera access on that origin — it is silently
allowed. A geolocation deny for `https://ads.example.com` silently blocks requests
without a prompt.

Grants are stored in a pref as a JSON array, loaded at profile startup, and applied
immediately to `HostContentSettingsMap` before any navigation occurs.

---

## Supported permissions

| Permission key | Covers |
|---|---|
| `camera` | `ContentSettingsType::MEDIASTREAM_CAMERA` |
| `microphone` | `ContentSettingsType::MEDIASTREAM_MIC` |
| `notifications` | `ContentSettingsType::NOTIFICATIONS` |
| `geolocation` | `ContentSettingsType::GEOLOCATION` |
| `javascript` | `ContentSettingsType::JAVASCRIPT` |
| `popups` | `ContentSettingsType::POPUPS` |
| `clipboard` | `ContentSettingsType::CLIPBOARD_READ_WRITE` |

## Grant states

| State | Effect |
|---|---|
| `allow` | Permission silently granted — no prompt shown |
| `deny` | Permission silently blocked — request rejected without prompt |
| `default` | Defers to the normal per-site prompt behaviour (same as no grant) |

---

## Architecture

```
OriginPermissionServiceFactory (ProfileKeyedServiceFactory)
  │  ServiceIsCreatedWithBrowserContext() = true  ← grants applied before any nav
  │  Regular profiles: kOwnInstance
  │  Guest / Ash internals: kNone
  │
  └─► OriginPermissionService (KeyedService, per-profile)
        │  Constructor → LoadAndApply():
        │    1. Parse kCustomOriginPermissionGrants pref (JSON array).
        │    2. For each valid grant → ApplySingle(grant).
        │
        ApplySingle(grant):
          GURL origin_url(grant.origin)   // must be valid http/https
          HostContentSettingsMapFactory::GetForProfile(profile_)
            ->SetContentSettingDefaultScope(
                origin_url, GURL(),
                ToContentSettingsType(grant.permission),
                ToContentSetting(grant.state))
        │
        SetGrant(origin, permission, state):
          - If state == kDefault → delegate to RemoveGrant
          - Find existing (origin, permission) entry; update or append
          - Persist() → write grants_ back to pref as JSON
          - ApplySingle() → apply the change immediately
        │
        RemoveGrant(origin, permission):
          - Apply kDefault to HCSM (resets to global default)
          - Erase from grants_ vector
          - Persist()
        │
        RemoveAllGrantsForOrigin(origin):
          - Iterate grants_, reset HCSM + erase for every matching entry
          - Persist()
```

---

## Pref

| Pref key | Type | Default | Purpose |
|---|---|---|---|
| `custom.origin_permission.grants` | string (JSON) | `"[]"` | Serialised grant list |

### JSON storage format

```json
[
  {
    "origin": "https://meet.corp.example.com",
    "permission": "camera",
    "state": "allow"
  },
  {
    "origin": "https://meet.corp.example.com",
    "permission": "microphone",
    "state": "allow"
  },
  {
    "origin": "https://ads.example.com",
    "permission": "notifications",
    "state": "deny"
  }
]
```

Origins must be valid `http://` or `https://` URLs (scheme + host + optional port).
Other schemes are silently ignored on load and rejected in `ApplySingle`.

---

## API

```cpp
// Read
const std::vector<OriginPermissionGrant>& grants = svc->GetGrants();

// Write — apply immediately and persist
svc->SetGrant("https://internal.example.com",
              custom::OriginPermission::kCamera,
              custom::OriginPermissionState::kAllow);

// Remove one capability for an origin
svc->RemoveGrant("https://internal.example.com",
                 custom::OriginPermission::kCamera);

// Wipe all grants for an origin
svc->RemoveAllGrantsForOrigin("https://internal.example.com");
```

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/permissions/origin_permission_service.h/.cc` | `KeyedService`; grant struct, HCSM integration, JSON parse/write |
| `custom/browser/permissions/origin_permission_service_factory.h/.cc` | `ProfileKeyedServiceFactory`; eager creation |
| `custom/common/custom_pref_names.h` | `kCustomOriginPermissionGrants` |
| `custom/browser/prefs/custom_prefs.cc` | Pref registration (default `"[]"`) |
| `custom/browser/sources.gni` | Source listing |
| `custom/browser/custom_browser_context_keyed_service_factories.cc` | Factory registration |

---

## Design notes

### Why HCSM instead of `PermissionManager`

`HostContentSettingsMap::SetContentSettingDefaultScope` is the same mechanism
Chrome's own settings UI uses when the user grants/denies a permission in
`chrome://settings/content`. Using it means:

- Grants appear in `chrome://settings/content` per-site exception lists.
- The same enforcement path applies (no renderer bypass possible).
- Resetting to `CONTENT_SETTING_DEFAULT` cleanly removes the grant.

### Relationship to Gecko `nsIPrincipal`

Gecko's principal system encodes capabilities in every document's security context
and propagates them through cross-origin checks. Our implementation is scoped to the
browser process (via HCSM) rather than per-document — a simpler model that covers the
practical enterprise use case (pre-granting known-good intranet origins) without
requiring renderer changes.

### Incognito behaviour

Incognito profiles get no `OriginPermissionService` (factory returns `kNone` for
OTR via the `WithRegular(kOwnInstance)` + no incognito override). Grants set on the
regular profile do **not** carry over to incognito sessions, consistent with
Chromium's policy that incognito content settings are always at the default level.

---

## Related docs

- [security-privacy-features.md](security-privacy-features.md) — connection control and other security features
- [content-policy-chain.md](content-policy-chain.md) — per-content-type URL filtering
