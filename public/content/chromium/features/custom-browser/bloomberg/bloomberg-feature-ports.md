# Bloomberg Feature Ports

Seven browser features ported from Bloomberg's chromium.bb (M104) fork. All expose
settings through `CustomSettingsHandler`
(`src/custom/browser/ui/webui/settings/custom_settings_handler.*`) and are accessible
from `chrome://custom-settings`.

---

## 7. Runtime Timezone Override

Allows the active timezone to be overridden per-profile without changing the OS
clock. Useful in environments where users need to work in a specific market timezone
regardless of their physical location.

### Architecture

```
Profile pref (custom.timezone)
  │
  ▼
TimezoneService (KeyedService)
  │  src/custom/browser/timezone/timezone_service.*
  │  src/custom/browser/timezone/timezone_service_factory.*
  │
  ▼ BindTimeZoneMonitor() + SetTimezone()
DeviceService → TimeZoneMonitor (Mojo)
  │  services/device/public/mojom/time_zone_monitor.mojom
  │
  ▼
icu::TimeZone::createTimeZone(tz_id)   ← empty string = system default
```

`TimezoneServiceFactory` is registered in
`src/custom/browser/custom_browser_context_keyed_service_factories.cc`.

### Prefs

| Pref key | Type | Default | Purpose |
|---|---|---|---|
| `custom.timezone` | string | `""` | IANA timezone ID, e.g. `"America/New_York"`. Empty = system default. |

### Settings handlers

| Message | Args | Returns |
|---------|------|---------|
| `customGetTimezone` | — | `{timezone: string}` |
| `customSetTimezone` | `[string]` | — |

### Mojo addition

`SetTimezone(string tz_id)` was added to `TimeZoneMonitor` in
`services/device/public/mojom/time_zone_monitor.mojom`. The implementation
(`time_zone_monitor.cc`) converts an empty string to the detected host timezone
via `DetectHostTimeZoneFromIcu()`.

---

## 8. GPU Mode Monitor

Exposes the live GPU hardware-acceleration state to the settings UI and fires an
event whenever it changes (e.g. GPU process crash or blocklist update).

`CustomSettingsHandler` inherits `content::GpuDataManagerObserver` and
registers/deregisters in `OnJavascriptAllowed` / `OnJavascriptDisallowed`.

### Settings handlers

| Message | Returns |
|---------|---------|
| `customGetGpuMode` | `{hardwareAccelerationEnabled: bool, gpuAccessAllowed: bool, gpuAccessBlockedReason: string}` |

### WebUI event

`customGpuModeChanged` — fired with the same dict on `OnGpuInfoUpdate` and
`OnGpuProcessCrashed`.

---

## 9. `bb-simple-overflow-clip` CSS Property

A custom Blink CSS property that switches hit-testing to use the element's border
box instead of its full visual overflow rect. Apply to fixed-size widgets where
the visual overflow extends beyond the intended interactive area.

### Registration

**File**: `src/third_party/blink/renderer/core/css/css_properties.json5`

```json5
{
  name: "bb-simple-overflow-clip",
  property_methods: ["CSSValueFromComputedStyleInternal"],
  field_group: "*",
  field_template: "keyword",
  keywords: ["auto", "clip"],
  default_value: "auto",
  invalidate: ["paint"],
},
```

The build system auto-generates enum `EBbSimpleOverflowClip` (`kAuto` / `kClip`)
and accessor `ComputedStyle::BbSimpleOverflowClip()`.

### Hit-test fast path

**File**: `src/third_party/blink/renderer/core/layout/layout_box_hot.cc`  
**Function**: `LayoutBox::MayIntersect()`

```cpp
if (StyleRef().BbSimpleOverflowClip() != EBbSimpleOverflowClip::kAuto) {
  PhysicalRect border_box = PhysicalBorderBoxRect();
  border_box.Move(accumulated_offset);
  return hit_test_location.Intersects(border_box);
}
```

### Usage

```css
.fixed-size-widget {
  bb-simple-overflow-clip: clip;
}
```

---

## 10. Silent Print-to-PDF

Exports the active tab to PDF without showing the print dialog, returning the
result as a Base64-encoded data URI.

### Settings handler

| Message | Returns |
|---------|---------|
| `customPrintToPdf` | `{success: true, data: string}` or `{success: false, error: string}` |

### Implementation notes

- Gets the active tab via `chrome::FindTabbedBrowser(profile, false)` →
  `TabStripModel::GetActiveWebContents()`.
- Calls `PrintViewManager::FromWebContents(wc)->PrintToPdf()` with params from
  `print_to_pdf::GetPrintPagesParams()`.
- Callback `OnPrintToPdfDone` Base64-encodes the PDF bytes before resolving the
  JS promise.

---

## 11. Per-Profile Spellcheck

Exposes full spellcheck configuration (enable/disable, language list, custom
dictionary) through the settings UI.

### Prefs used

| Pref key | Type | Purpose |
|---|---|---|
| `spellcheck.use_spelling_service` | bool | Master enable/disable |
| `spellcheck.dictionaries` | list | Active language codes |
| Custom dictionary | (managed by `SpellcheckCustomDictionary`) | Per-word additions |

### Settings handlers

| Message | Args | Returns |
|---------|------|---------|
| `customGetSpellcheck` | — | `{enabled, languages: string[], words: string[]}` |
| `customSetSpellcheckEnabled` | `[bool]` | — |
| `customSetSpellcheckLanguages` | `[string[]]` | — |
| `customAddSpellcheckWord` | `[string]` | — |
| `customRemoveSpellcheckWord` | `[string]` | — |

Words are managed via `SpellcheckServiceFactory::GetForContext(profile)
→ GetCustomDictionary() → AddWord() / RemoveWord()`.

---

## 12. Side-Loaded Custom Fonts (Windows)

Allows users to register additional `.ttf` / `.otf` font files that web content
can access via `font-family`, without installing them system-wide. Fonts are
registered with the DirectWrite private font collection on Windows.

### Pref

| Pref key | Type | Default | Purpose |
|---|---|---|---|
| `custom.sideloaded_fonts` | list | `[]` | Absolute paths to font files |

Registered in `src/chrome/browser/profiles/profile_impl.cc`.

### Settings handlers

| Message | Args | Returns |
|---------|------|---------|
| `customGetSideloadedFonts` | — | `{fonts: string[]}` |
| `customRemoveSideloadedFont` | `[path: string]` | — |
| `customSelectFontFile` | — | opens `SelectFileDialog` |

`customSelectFontFile` reuses the existing `ui::SelectFileDialog` from the
folder-picker flow. The `pending_font_file_pick_` bool flag on the handler
distinguishes font picks from folder picks inside `FileSelected()`.

---

## 13. DevTools Attach/Detach Callbacks

Fires WebUI events whenever a DevTools session opens or closes on any page, and
exposes a snapshot of all current DevTools targets.

`CustomSettingsHandler` inherits `content::DevToolsAgentHostObserver` and calls
the static `DevToolsAgentHost::AddObserver` / `RemoveObserver` in
`OnJavascriptAllowed` / `OnJavascriptDisallowed`.

### Settings handler

| Message | Returns |
|---------|---------|
| `customGetDevToolsTargets` | `[{targetId, url, title, type}]` |

### WebUI events

| Event | Payload |
|-------|---------|
| `customDevToolsAttached` | `{targetId, url, title, type}` |
| `customDevToolsDetached` | `{targetId, url, title, type}` |
