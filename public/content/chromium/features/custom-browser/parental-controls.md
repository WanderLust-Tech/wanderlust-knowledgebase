# Parental Controls

PIN-gates sensitive actions and hosts a basic site blocker, so a shared
device can't have its history wiped, its exit-time data-clearing behavior
changed, or its website restrictions turned off without the PIN. Two
pieces so far:

- **PIN lock** — deleting browsing history (both `chrome://history` and
  the sidebar history panel) and the "Clear browsing data on exit" toggle
  group in Settings require the PIN. Added v1.8.42 (2026-08-20).
- **Website Restrictions** — a domain blocklist/allowlist plus forced
  SafeSearch and YouTube Restricted Mode. Added v1.8.43 (2026-08-21).

---

## Where to find it

Settings → a Parental Controls sub-page (`ParentalControlsPage.tsx`) sets
up and manages the PIN, and — once unlocked — hosts the Website
Restrictions section too. The PIN-gated actions themselves (history
delete, the clear-on-exit toggle) don't require a visit to this page
first — the PIN prompt appears at the point of the blocked action, on
whatever page you're already on.

---

## Unlock model: sliding idle window, not a session

`ParentalControlsService::IsCurrentlyUnlocked()` is the only thing that
decides whether a gated action proceeds. There's no persisted "unlocked"
flag — unlock state is purely an in-memory `base::TimeTicks` expiry, so
it's always locked again on a fresh browser launch. Each successful
check extends the window by another 10 minutes (`kIdleTimeout`), which
gives idle-timeout behavior without a background timer: the window only
extends when a gated feature is actually being used.

```cpp
bool ParentalControlsService::IsCurrentlyUnlocked() {
  if (base::TimeTicks::Now() >= unlock_expiry_) return false;
  unlock_expiry_ = base::TimeTicks::Now() + kIdleTimeout;  // extend
  return true;
}
```

---

## PIN storage and verification

The PIN is never stored recoverably — only a salted SHA-256 hash
(`custom.parental_controls.pin_hash` / `custom.parental_controls.pin_salt`
prefs). `VerifyAndUnlock()` re-derives the hash from the entered PIN and
the stored salt and compares. Changing the PIN (`ChangePin`) or turning
the feature off (`Disable`) both require the *current* PIN — otherwise
someone locked out could just set a fresh PIN to bypass the gate
entirely.

### "Forgot PIN?" — device reauth, not a recovery question

`CustomParentalControlsHandler::HandleRequestDeviceReauthReset` uses the
same `device_reauth::DeviceAuthenticator` pattern already used for
revealing saved passwords (see
[Password Manager: view/copy, add/edit, and checkup](password-manager-view-edit-checkup.md))
— a real Windows Hello (or platform-equivalent) OS prompt. On success,
`ParentalControlsService::ResetPinAfterDeviceAuth()` sets a new PIN
without needing the old one. There's no email/security-question fallback
at all — device auth is the only recovery path.

---

## Website Restrictions: domain block/allow list

A basic "Net Nanny"-style site blocker — real category-based filtering
(gambling/adult/social-media buckets) is a deliberate future step, not
part of this pass (see Future plans below).

Two prefs drive it: `custom.parental_controls.restriction_mode` (`"off"`
/ `"blocklist"` / `"allowlist"`) and
`custom.parental_controls.restriction_domains` (a JSON array of plain
hostnames, e.g. `["youtube.com","reddit.com"]`). A domain entry matches a
request's host if it's equal, or if the host is a subdomain of it — so
blocking `youtube.com` also blocks `m.youtube.com`.

```cpp
// static
bool ParentalControlsService::EvaluateRestriction(
    const GURL& url, const std::string& mode,
    const std::vector<std::string>& domains) {
  if (!url.SchemeIsHTTPOrHTTPS()) return true;
  if (mode != "blocklist" && mode != "allowlist") return true;

  bool matched = false;
  for (const std::string& domain : domains) {
    if (DomainMatches(url.host(), domain)) { matched = true; break; }
  }
  return mode == "blocklist" ? !matched : matched;
}
```

`ParentalControlsThrottle` (a `blink::URLLoaderThrottle`, registered in
`CustomContentBrowserClient::CreateURLLoaderThrottles()`) calls this for
frame-level requests only — `RequestDestination::kDocument` (top-level
navigation) and `kIframe`/`kFrame` (nested frames). Subresources on a
blocked domain (images, scripts, XHR) are **not** blocked — the intent is
"block this website," not "block anything hosted there." A blocked
navigation gets the generic `ERR_BLOCKED_BY_CLIENT` net-error page —
there's no dedicated "blocked by your parent" interstitial yet.

Like `ContentPolicyThrottle`'s own rule snapshot, the mode + domain list
are captured **once, on the UI thread**, at throttle-construction time —
`WillStartRequest` isn't guaranteed to run on the UI thread, so the
throttle never holds a live `Profile*`/`PrefService*`.

**Enforcement is independent of the PIN unlock state** — restrictions
apply whether or not Parental Controls is currently unlocked. The PIN
only gates *editing* the mode/domain list, since that section lives
inside `ParentalControlsPage.tsx`'s `ManageCard` alongside Change
PIN/Disable/Lock now.

---

## Forced SafeSearch and YouTube Restricted Mode

No new C++ at all for this half. Chromium already has fully-working,
non-policy-gated enforcement:

- `settings.force_google_safesearch` (bool) — enforced by
  `GoogleURLLoaderThrottle`, which appends `safe=active`/`ssui=on` to
  Google/Bing search URLs.
- `settings.force_youtube_restrict` (int: `0`=Off, `1`=Moderate,
  `2`=Strict) — enforced by the same throttle via a `YouTube-Restrict`
  request header.

Both are already registered by vanilla `Profile::RegisterProfilePrefs`
and already read live by `RendererUpdater` — no enterprise policy
required (there's existing vanilla precedent for this too:
`SupervisedUserService` sets `force_google_safesearch` directly for
supervised profiles, bypassing the policy path entirely). So the two
new toggles in `WebsiteRestrictionsSection.tsx` just read/write these
prefs through the same generic pref bridge every other settings toggle
uses (`customGetPrefs`/`customSetPref`/`customObservePrefs`) — no new
WebUI messages, no new handler methods.

---

## What's actually gated

| Surface | Handler | Gate point |
|---|---|---|
| `chrome://history` delete | `CustomHistoryHandler::HandleRemoveHistoryEntries` | Checked before calling into `HistoryService` |
| Sidebar history panel delete | `SidebarDOMHandler::RemoveHistoryEntry` | Same check, same shape |
| Settings → "Clear browsing data on exit" | `OthersPage.tsx`'s controls, backed by `CustomParentalControlsHandler` | Wraps the existing toggle group |

Each gate is the identical pattern: if Parental Controls is enabled and
`IsCurrentlyUnlocked()` is false, the action is dropped and a
`parentalControlsLocked` WebUI listener event fires instead (the
frontend responds by showing a PIN prompt) — the underlying
delete/toggle logic itself is completely unmodified.

---

## Messages

| Message | Purpose |
|---|---|
| `parentalControlsGetState` | Current enabled/unlocked state |
| `parentalControlsSetPin` | First-time setup — enables the feature and unlocks immediately |
| `parentalControlsVerifyPin` | Unlock with an existing PIN |
| `parentalControlsChangePin` | Requires current PIN |
| `parentalControlsDisable` | Requires current PIN |
| `parentalControlsLockNow` | Explicit re-lock (e.g. a "Lock now" button) |
| `parentalControlsRequestDeviceReauthReset` | "Forgot PIN?" — Windows Hello reset |

Website Restrictions added no new messages — it rides the existing
generic pref bridge (`customGetPrefs`/`customSetPref`/`customObservePrefs`,
same as every other settings toggle):

| Pref | Type | Purpose |
|---|---|---|
| `custom.parental_controls.restriction_mode` | string | `"off"` / `"blocklist"` / `"allowlist"` |
| `custom.parental_controls.restriction_domains` | string (JSON array) | The domain list |
| `settings.force_google_safesearch` | bool | Vanilla Chromium pref, reused as-is |
| `settings.force_youtube_restrict` | int | Vanilla Chromium pref, reused as-is |

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/parental_controls/parental_controls_service.{h,cc}` | `KeyedService` — PIN hash/salt, unlock window |
| `custom/browser/parental_controls/parental_controls_service_factory.{h,cc}` | Standard `BrowserContextKeyedServiceFactory` |
| `custom/browser/ui/webui/parental_controls/custom_parental_controls_handler.{h,cc}` | WebUI message handler + device-reauth reset flow |
| `custom/components/custom_settings/components/ParentalControlsPage.tsx` | Setup/management UI |
| `custom/browser/ui/webui/history/custom_history_handler.cc` | Gate check before history deletion |
| `custom/browser/ui/webui/sidebar/sidebar_dom_handler.cc` | Gate check before sidebar-panel history deletion |
| `custom/browser/parental_controls/parental_controls_throttle.{h,cc}` | `URLLoaderThrottle` enforcing Website Restrictions |
| `custom/browser/custom_content_browser_client.cc` | Registers the throttle in `CreateURLLoaderThrottles()` |
| `custom/components/custom_settings/components/WebsiteRestrictionsSection.tsx` | Domain list + SafeSearch/YouTube UI, rendered inside `ParentalControlsPage.tsx`'s `ManageCard` |

---

## Known limitations

- Single global PIN, not per-user or per-child-profile.
- Website Restrictions blocks by exact hostname/subdomain only — no
  wildcard/glob patterns (unlike the power-user Content Policy Chain
  rules engine it deliberately avoids reusing; see below) and no
  category-based filtering (gambling, adult content, social media, etc.).
- Restricted navigations get Chromium's generic `ERR_BLOCKED_BY_CLIENT`
  net-error page, not a dedicated "blocked by your parent" interstitial.
- Only frame-level requests are checked — a blocked domain's resources
  embedded on an otherwise-allowed page (a script, an image, an API
  call) are not blocked, only its own pages/iframes.
- The 10-minute unlock window is a fixed constant (`kIdleTimeout`), not
  user-configurable.
- Not integrated with the separate `ContentPolicyManager`/
  `ContentPolicyThrottle` power-user URL-filter engine (Settings →
  Security & Privacy) by design — mixing simple parent-facing domain
  entries into that shared, order-sensitive rules array would be fragile
  (see [Security & Privacy Features](security-privacy-features.md)).

---

## Future plans

- **Category-based filtering** — block whole categories (gambling,
  adult content, social media, etc.) without listing individual domains.
  Needs either a commercial URL-categorization API/database or a
  self-maintained category list; a real follow-up project, not a small
  addition to the current domain-list approach.
- **A dedicated block page** — replace the generic net-error page with
  one that explains *why* the site is blocked and (maybe) offers a
  PIN-unlock shortcut right there, instead of requiring a trip to
  Settings.
- **Per-profile PINs / restriction lists** — today it's one PIN and one
  restriction list per browser profile, not per child if multiple people
  share a profile.
- **Extending the PIN gate to bookmark deletion** —
  `custom_bookmarks_handler.cc` isn't covered yet; would reuse the exact
  same `ParentalControlsService` check already used for history.
- **Configurable idle timeout** — the 10-minute window would become a
  setting instead of a compile-time constant.
