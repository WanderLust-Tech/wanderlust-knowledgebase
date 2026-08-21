# Manage Profile (chrome://settings/manageProfile)

A deep-link-only Settings route — not in the left-nav, matching vanilla
Chromium — that the profile menu's "Edit" pencil, the app menu's
"Customize profile" item, and the profile-picker card's "Edit" option all
navigate to. Added v1.8.33 (2026-08-19).

Before this, all three of those real, unmodified Chromium entry points
navigated to `chrome://settings/manageProfile`, but the Settings React
router didn't recognize that slug and silently fell back to the "You and
Wanderlust" page instead — so clicking "Edit" on your profile just
looked broken.

---

## Where to find it

Not linked from the Settings left-nav. Reached via:

- Profile menu (avatar icon) → the pencil "Edit" icon
- App menu (⋮) → "Customize profile"
- Profile picker → a profile card's "Edit" option
- Direct navigation to `chrome://settings/manageProfile`

---

## Architecture

`manageProfile` is a route inside the existing `custom_settings` React
hub (`components/custom_settings/App.tsx`'s `ROUTES` map), rendered by a
new `ManageProfilePage.tsx` — it is **not** a separate WebUI host. It's
excluded from `SIDEBAR` the same way vanilla Chromium never lists it in
`chrome://settings`'s own nav.

```
custom_settings/App.tsx
  ROUTES['manageProfile'] → <ManageProfilePage />
    (present in ROUTES, absent from SIDEBAR — deep-link only)
```

On the native side, `CustomSettingsUI` (the `WebUIController` backing
`chrome://settings`) attaches an additional message handler just for
this page:

```cpp
// custom/browser/ui/webui/settings/custom_settings_ui.cc
web_ui->AddMessageHandler(
    std::make_unique<CustomProfileCustomizationHandler>());
```

`ManageProfilePage.tsx` reuses `CustomProfileCustomizationHandler`
**verbatim** — the same handler class that backs the standalone
`chrome://profile-customization` first-run wizard (see
[Profile Picker & Customization](profile-picker-customization.md)).
No new C++ was written for this page at all.

### Why edits just save, with no Skip/Done

`CustomProfileCustomizationHandler`'s avatar/name/theme-color messages
(`setAvatarIcon`, `setProfileName`, `setThemeColor`, etc.) all apply
their change immediately and unconditionally — `ThemeService`,
`ProfileAttributesEntry`, and friends update live regardless of which
page sent the message. The wizard's `done`/`skip` messages are pure
frontend signals to navigate away (typically back to the profile
picker); they don't do anything on the C++ side beyond that. Since
`ManageProfilePage.tsx` simply never sends `done`/`skip`, reusing the
same handler here required zero backend changes — the difference
between "first-run wizard" and "settings page" is entirely which
buttons the frontend chooses to show.

---

## File map

| Path | Purpose |
|---|---|
| `custom/components/custom_settings/components/ManageProfilePage.tsx` | The page itself |
| `custom/components/custom_settings/App.tsx` | `ROUTES['manageProfile']` entry (not in `SIDEBAR`) |
| `custom/browser/ui/webui/settings/custom_settings_ui.cc` | Attaches `CustomProfileCustomizationHandler` alongside the other settings handlers |
| `custom/browser/ui/webui/profile_customization/custom_profile_customization_handler.{h,cc}` | The shared backend (see Profile Picker & Customization doc) |

---

## Known limitations

None specific to this page — it inherits whatever `CustomProfileCustomizationHandler` can and can't do (see that doc's limitations, e.g. no real Google/DICE avatar sync).
