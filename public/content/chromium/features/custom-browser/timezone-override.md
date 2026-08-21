# Timezone Override (Anti-Fingerprinting)

Overrides the browser's reported timezone at the ICU level, applying
immediately (no restart) to every tab's `Intl.DateTimeFormat()` and
`Date` behavior, and persisting across restarts.

---

## Where to find it

Settings → Privacy and security → Timezone override. A dropdown of a
curated list of IANA zones, defaulting to "System default."

---

## Mechanism: a genuine ICU-level override, not a JS shim

This isn't a `TZ` environment variable or renderer-side JavaScript
override. It patches `services/device/public/mojom/time_zone_monitor.mojom`
and `time_zone_monitor.{h,cc}` to add a real
`TimeZoneMonitor::SetTimezone(string tz_id)` method. The implementation:

1. Calls `icu::TimeZone::createTimeZone(...)` for the chosen zone (or
   `DetectHostTimeZoneFromIcu()` if reverting to system default).
2. Calls `UpdateIcuAndNotifyClients()`, which sets ICU's process-wide
   default timezone in the Device Service and notifies every subscribed
   renderer `TimeZoneMonitorClient` via the *existing* `OnTimeZoneChange`
   mojo path — the same plumbing that already handles a **real OS
   timezone change** while the browser is running.

Because it reuses the OS-timezone-change notification path, every tab's
`Intl`/`Date` behavior updates live, with no reload and no restart
required, and no per-renderer special-casing needed — as far as V8/Blink
is concerned, this looks identical to the user having changed their
system clock's timezone.

---

## Backend

`CustomSettingsHandler::HandleGetTimezone` / `HandleSetTimezone` /
`OnTimezoneSet` (`custom_settings_handler.cc`), plus a separate
`custom::TimezoneService`
(`custom/browser/timezone/timezone_service.{h,cc}`) that re-applies the
saved pref on profile load, so the override survives a restart.

| Message | Purpose |
|---|---|
| `customGetTimezone` | Current override value |
| `customSetTimezone` | Apply a new override (or `""` for system default) |
| `customTimezoneChanged` (listener) | Live push when the value changes |

**Pref:** `custom.timezone` (`kCustomTimezone`) — an empty string means
system default.

---

## Available zones

A curated list of roughly 53 IANA zone IDs, hardcoded as
`kAvailableTimezones` in `custom_settings_handler.cc` — not the full
tzdata set.

---

## Known limitations

- Fixed ~53-zone list; no arbitrary IANA ID entry.
- Global per-profile override — no per-site or per-tab timezone.
