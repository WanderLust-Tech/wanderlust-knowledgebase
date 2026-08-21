# Advanced Preferences (chrome://advanced-prefs)

A full profile-preference editor — the about:config equivalent — listing
every registered pref with its type, current value, default-state, and
whether it's user-modifiable, editable inline. Added v1.8.31 (2026-08-18).

Deliberately **not** a Settings sub-page. It used to live at
`chrome://settings/advanced-prefs`, but was moved to its own dedicated,
unlisted host so it doesn't show up in the Settings nav or the omnibox's
`settings:` quick actions — this is an expert-only surface, not something
a casual user should stumble into.

---

## Where to find it

`chrome://advanced-prefs` — typed directly. No link to it exists anywhere
in the UI.

---

## Architecture

Follows the same standalone-WebUI pattern as `chrome://password-manager`:
a real `chrome://` host with its own `WebUIController`/`WebUIDataSource`
and a small, self-contained React bundle — not a sub-route inside the
`custom_settings` hub.

```
CustomAdvancedPrefsUIConfig / CustomAdvancedPrefsUI
  (custom/browser/ui/webui/advanced_prefs/custom_advanced_prefs_ui.{h,cc})
    │
    ├─ WebUIDataSource, host "advanced-prefs"
    │  CSP: script-src/style-src chrome://resources 'self'
    │
    └─ AdvancedPrefsHandler
       (custom/browser/ui/webui/settings/advanced_prefs_handler.{h,cc})
       — the only message handler attached to this WebUI.
```

`AdvancedPrefsHandler` used to be attached to `CustomSettingsUI`
(backing `chrome://settings/advanced-prefs`) as well; it's now attached
**only** to `CustomAdvancedPrefsUI`. The handler class itself didn't
change — only where it's mounted.

### Messages

| Message | Direction | Payload |
|---|---|---|
| `advancedPrefsGetAll` | JS → C++ (promise) | none → `PrefEntry[]` |
| `advancedPrefsSet` | JS → C++ (fire-and-forget) | `(key, value)` |
| `advancedPrefsReset` | JS → C++ (fire-and-forget) | `(key)` |

`PrefEntry` shape: `{ key, type, value, isDefault, isUserModifiable }`.
`type` is one of `boolean | integer | double | string | dict | list | other`.

`HandleGetAll` walks every registered pref via
`PrefService::IteratePreferenceValues` and **omits managed (policy-locked)
prefs entirely** — they never reach the JS side, so there's no way to
even see them here, let alone edit them. `HandleSet` type-checks the
incoming value against the pref's real `base::Value::Type` before
writing; a mismatched type is silently dropped.

---

## UI

React app at `src/custom/components/custom_advanced_prefs/` — a filter
box plus a sortable table (unmodified prefs sort last, alphabetically).
Boolean prefs render as a checkbox; everything else is click-to-edit
inline (a `<textarea>` for `dict`/`list` values, parsed as JSON on blur).
Modified rows highlight amber and get a reset (↺) button.

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/ui/webui/advanced_prefs/custom_advanced_prefs_ui.{h,cc}` | `WebUIController`/`WebUIConfig` for the standalone host |
| `custom/browser/ui/webui/settings/advanced_prefs_handler.{h,cc}` | Message handler (pref enumerate/set/reset) — shared class, single owner now |
| `custom/components/custom_advanced_prefs/App.tsx` | The table UI (moved verbatim from the old `custom_settings/components/AdvancedPrefsPage.tsx`) |
| `custom/common/webui_url_constants.h` | `kChromeUICustomAdvancedPrefsHost = "advanced-prefs"` |

---

## Known limitations

- Managed/policy-locked prefs are invisible here by design — there's no
  read-only "view but can't edit" mode for them.
- No search-by-value, only by key substring.
- Editing a `dict`/`list` pref requires hand-writing valid JSON in the
  textarea; malformed JSON is silently discarded on blur rather than
  showing a validation error.
