# Profile Picker & Customization

Real, functional profile management: `chrome://profile-picker` lists,
creates, renames, deletes, and launches profiles against actual
`ProfileAttributesStorage` data; `chrome://profile-customization` is the
second step of the new-profile flow (avatar/name/theme color), and its
handler is reused verbatim by
[`chrome://settings/manageProfile`](manage-profile.md).

Both are registered under their vanilla Chromium host names
(`profile-picker`, `profile-customization`) via the same
`#if BUILDFLAG(ENABLE_CUSTOM_WEBUI)` swap pattern used across this
fork's custom WebUI pages — real trigger points (profile menu "Add",
new-profile creation) fire unmodified.

---

## chrome://profile-picker

**Controller/handler:** `CustomProfilePickerUI` / `CustomProfilePickerHandler`
(`custom/browser/ui/webui/profile_picker/custom_profile_picker_{ui,handler}.{h,cc}`).

Backed by a real `ProfileAttributesStorage` observer (add/remove/avatar/
name changes reflected live).

| Message | Purpose |
|---|---|
| `getProfiles` / `profilesChanged` | Full list — path, local profile name, GAIA name, signed-in state, avatar (as a data URL) |
| `launchProfile` | `profiles::SwitchToProfile`, then hides the picker |
| `createProfile` | `ProfileManager::CreateMultiProfileAsync` → opens a window → navigates to `chrome://profile-customization` |
| `renameProfile` | Rename in place |
| `removeProfile` | `webui::DeleteProfileAtPath` |
| `signInWithGoogle` | **No-op** — fires `sign-in-not-available`; Google/DICE sign-in for new profiles isn't implemented |

### Runs pre-Browser

The picker normally lives inside the real upstream `ProfilePickerView` —
a chrome-less `views::Widget` with **no `Browser` object** behind it.
`launchProfile`/`createProfile` therefore call `ProfilePicker::Hide()`
rather than closing a tab. A fallback path exists for the non-standard
case of the picker being opened as a plain tab instead.

---

## chrome://profile-customization

**Controller/handler:** `CustomProfileCustomizationUI` /
`CustomProfileCustomizationHandler`
(`custom/browser/ui/webui/profile_customization/custom_profile_customization_{ui,handler}.{h,cc}`).

| Message | Purpose |
|---|---|
| `getProfileInfo` | Current name/avatar |
| `getAvailableIcons` | Avatar picker options |
| `setAvatarIcon`, `setProfileName` | Apply immediately |
| `getSuggestedColors` | Reads `chrome_colors::kSelectedColorsInfo` |
| `setThemeColor` | `ThemeService::SetUserColor` |
| `getCustomTheme` / `setCustomTheme` / `resetCustomTheme` | The shareable JSON theme (see [Shareable Theme JSON](shareable-theme-json.md)) — `ThemeService::BuildCustomJsonTheme`/`UseDefaultTheme` |
| `done`, `skip` | Frontend-only navigation signals — see below |

All edits (name, avatar, color) apply live via `ProfileAttributesEntry`/
`ThemeService` regardless of caller — **`done` and `skip` are no-ops on
the C++ side.** The wizard's Done/Skip buttons just navigate away
(typically back to the profile picker) once clicked; nothing about the
edits themselves depends on which button was pressed.

This is exactly why [`chrome://settings/manageProfile`](manage-profile.md)
could reuse this handler with zero backend changes: it's the same
handler, same messages, just without Done/Skip buttons in the frontend
— edits there simply save in place.

---

## Known limitations

- No real Google/DICE sign-in for new-profile creation
  (`signInWithGoogle` is inert) — this fork ships without bundled OAuth
  client credentials (see [Sync Confirmation](sync-confirmation.md)).
- Avatar choices come from a fixed local icon set, not a synced/GAIA
  avatar.
