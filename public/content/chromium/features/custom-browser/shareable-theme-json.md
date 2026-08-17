---
title: "Shareable Theme JSON"
description: "A lightweight, hand-authorable light/dark JSON theme format applied directly onto Chrome's ColorProvider, bypassing the single-seed-color pipeline."
category: "Architecture"
tags: ["theming", "webui", "colors", "profile-customization"]
difficulty: "advanced"
date: "2026-08-11"
author: "Wanderlust Team"
estimated_reading_time: "8 minutes"
---

# Shareable Theme JSON

## Overview

Added in 1.8.4, prompted by the same feature-comparison review that produced
1.8.1 (home page presets) and 1.8.2 (favicon dominant-color tab tinting).
The review flagged Chromium's stock theming (`ThemeService::SetUserColor`) as
a gap: it only accepts a single seed color, which Chrome's Material Design 3
/ HCT pipeline algorithmically expands into a full palette. There was no
concept of a user-editable, hand-authorable, or shareable theme file anywhere
in the fork.

This feature adds one: a small JSON format with light/dark variants of five
named colors, editable in-app on `chrome://profile-customization`, and
exportable/importable as a plain `.json` file.

## Schema

```json
{
  "name": "My Theme",
  "light": {
    "background": "#ffffff",
    "element": "#f1f3f4",
    "border": "#dadce0",
    "accent": "#1a73e8",
    "titlebar": "#ffffff"
  },
  "dark": {
    "background": "#202124",
    "element": "#292a2d",
    "border": "#3c4043",
    "accent": "#8ab4f8",
    "titlebar": "#202124"
  },
  "cornerRadius": 8,
  "focusShadow": "0 0 0 2px rgba(26, 115, 232, 0.5)"
}
```

`name` is optional (used only to derive the exported filename). All five
colors are required in **both** `light` and `dark` — an incomplete or
unparseable document is rejected outright (see "Validation" below), not
partially applied.

`cornerRadius` (px) and `focusShadow` (a raw CSS `box-shadow` string) are
**WebUI-preview-only** — see "Known limitation" below.

There is deliberately no "icon variant" property, unlike the toy browser
whose format this idea originated from (Ferny's `themes/ferny.json`, which
ships duplicate black/white icon sprite sets and picks between them). This
fork's toolbar icons are already single-color SVGs driven by
`ui::ColorId`/`kColorToolbarButtonIcon`, so there's nothing for a separate
"icon variant" switch to do — the accent color already retints icons via the
normal color-mixer path.

## Architecture

### Why this isn't "a second single-seed-color algorithm"

The key discovery that shaped this feature: Chromium already has a fully
generic override mechanism for exactly this purpose, currently only fed by
extension-based theme packs.

`ui::ColorProviderKey` carries an optional `custom_theme` field (a
`scoped_refptr<ThemeInitializerSupplier>`). `AddChromeColorMixers()`
(`chrome/browser/ui/color/chrome_color_mixers.cc`) builds the full mixer
chain in a fixed order — base Chrome mixer → NTP/omnibox/tab-strip mixers →
Material mixers → native mixer — and then, **last**, calls
`key.custom_theme->AddColorMixers(provider, key)` if a supplier is present.
Because later mixers win, whatever a supplier's `AddColorMixers` sets
overrides the entire M3/HCT palette pipeline unconditionally, for whichever
`ui::ColorId` tokens it chooses to touch.

`BrowserThemePack` (the class backing extension theme packs) is the existing
proof of concept: it implements `AddColorMixers` by mapping ~25 named theme
properties straight onto real `ui::ColorId`s via `mixer[color_id] = {color}`.

This feature adds a second, much lighter implementation of that same
override point — `CustomJsonThemeSupplier`
(`custom/browser/themes/custom_json_theme_supplier.h/.cc`) — driven by the
JSON schema above instead of an extension manifest's `theme.colors` dict, and
requiring none of the extension install/manifest/lifecycle machinery
(`UnpackedInstaller`, `ExtensionRegistrar`, disable-reason bookkeeping) that
loading an actual theme extension needs.

### Color mapping

`CustomJsonThemeSupplier::AddColorMixers` picks the `light` or `dark` color
set based on `key.color_mode`, computes two contrast-derived text colors via
`color_utils::GetColorWithMaxContrast`, and maps the five inputs onto ~25
real `ui::ColorId`/`kColorXxx` tokens:

| Schema key | Colors it drives |
|---|---|
| `titlebar` | `kColorFrameActive`/`Inactive`, `kColorCaptionButtonBackground`, `kColorWindowControlButtonBackgroundActive`/`Inactive` |
| `background` | `kColorToolbar`, `kColorToolbarText(Default)`, `kColorNewTabPageBackground`/`Text`, `kColorOmniboxText` |
| `element` | `kColorTabBackgroundInactiveFrameActive`/`Inactive`, `kColorTabForeground*` (all four), `kColorBookmarkBarBackground`/`Foreground` |
| `border` | `kColorToolbarButtonBorder`, `kColorToolbarSeparator`, `kColorNewTabPageSectionBorder`, `ui::kColorMenuBorder`, `ui::kColorSeparator` |
| `accent` | `kColorNewTabPageLink`, `kColorToolbarButtonIcon(Hovered/Pressed)`, `kColorTabThrobber(Preconnect)` |

### Integration points

- **`ThemeService::BuildCustomJsonTheme(json, store_in_prefs)`** (patch to
  `chrome/browser/themes/theme_service.cc`/`.h`) — parses `json` into a
  `CustomJsonThemeSupplier`; if valid, installs it via the existing
  `SwapThemeSupplier()` (same call `BuildAutogeneratedThemeFromColor` and
  `BuildFromExtension` use) and persists the raw JSON to a new pref. Returns
  `false` without touching the current theme if the JSON is invalid —
  callers must check the return value.
- **`ThemeService::GetCustomThemeJson()`** — returns the currently-applied
  JSON, or an empty string if a custom JSON theme isn't the active theme
  type.
- **New pref**: `prefs::kCustomThemeJson` (`"wanderlust.theme.custom_json"`),
  a plain string pref registered in `ThemeServiceFactory::RegisterProfilePrefs`
  alongside `kUserColor`/`kBrowserColorScheme`. Read back on startup via a new
  branch in `ThemeService::InitFromPrefs()`, keyed off a new sentinel
  `ThemeService::kCustomJsonThemeID` (mirrors the existing
  `kAutogeneratedThemeID`/`kUserColorThemeID` sentinel pattern in
  `prefs::kCurrentThemeID`).
- **WebUI bridge**: three new `chrome.send`/`cr.sendWithPromise` messages on
  `chrome://profile-customization` (`custom_profile_customization_handler.cc`):
  `getCustomTheme` (prefill), `setCustomTheme` (apply + persist), and
  `resetCustomTheme` (revert to the default theme via the existing
  `ThemeService::UseDefaultTheme()`).

## The editor (`chrome://profile-customization`)

A "Custom theme" section was added below the existing preset-color swatch
row. It has:

- A Light/Dark tab toggle, five color swatches per variant (`<input
  type="color">`), a corner-radius slider, and a free-text focus-shadow CSS
  field.
- A live preview card (titlebar strip + background body + an "element"
  sub-card + an accent button) that reflects the current draft — including
  `cornerRadius`/`focusShadow`, which apply **only within this preview**
  (see "Known limitation").
- **Apply theme** — calls `setCustomTheme`, which both applies live and
  persists to the new pref.
- **Export JSON** — client-side only: `JSON.stringify` the current draft
  into a `Blob`, downloaded via a synthetic `<a download>` click. No native
  file dialog, no C++ file I/O — the same pattern
  `BackupRestorePage.tsx`'s settings export already uses.
- **Import JSON** — a hidden `<input type="file" accept="application/json">`
  + `FileReader.readAsText`, parsed client-side, validated for the presence
  of `light`/`dark`, then applied via the same `setCustomTheme` call.
- **Reset** — calls `resetCustomTheme`, reverting to Chrome's default theme
  and resetting the editor back to its built-in placeholder values.

## Known limitation: `cornerRadius`/`focusShadow` can't reach native chrome

`ui::ColorId`/`ColorProvider` has no concept of geometry — only color — so
there is no override point analogous to `AddColorMixers` for border-radius
or box-shadow in native Views UI. Applying these to the actual native window
chrome (title bar, tab strip, frame) would need separate, materially larger
Views-layer work (per-View style knobs, not a color-mixer override), which
remains explicitly out of scope.

Both values are still stored and round-tripped losslessly through
export/import — so a theme file remains completely portable and
future-proof.

**`custom_settings` follow-up: done (v1.8.30).** `cornerRadius`/`focusShadow`
are no longer profile-customization-preview-only — `App.tsx`'s root effect
(`custom/components/custom_settings/App.tsx`) reads the same
`wanderlust.theme.custom_json` pref via `custom_settings`' existing generic
`usePref()` bridge (read-only; never writes it, so
`CustomSettingsHandler::HandleSetPref`'s unvalidated generic write path is
never exercised for this pref) and sets two CSS custom properties,
`--wanderlust-corner-radius`/`--wanderlust-focus-shadow`, on
`document.documentElement`. `custom_settings/styles/tailwind.css` consumes
them two ways:
- `.rounded-\[20px\]` (pathfinder-ui's `Card` component's own hardcoded
  className — vendored third-party code, not edited directly) is overridden
  via plain CSS cascade, so every `Card`/`Section`/`HubCard` across all ~40
  settings pages picks up the theme's corner radius from one rule.
- Every native focusable element (`button`, `a`, `input`, `select`,
  `[role="switch"]`, `[role="checkbox"]`) gets the theme's focus shadow via
  a `:focus-visible` selector, site-wide, regardless of whether the element
  is pathfinder-vendored or hand-rolled in `widgets.tsx`.

Defaults (`20px`, `none`) match the pre-existing hardcoded look exactly, so
a profile with no custom theme set renders identically to before this
existed. No C++ changes were needed — `cornerRadius`/`focusShadow` already
lived in the same JSON string this pref always stored.

## Validation

`CustomJsonThemeSupplier::is_valid()` requires both `light` and `dark`
sub-objects to exist and all five color keys in each to parse as valid
`#rgb`/`#rrggbb`/`#rrggbbaa` hex strings (via
`content::ParseHexColorString`). If validation fails, `BuildCustomJsonTheme`
returns `false` and the previously-applied theme (of any kind — default,
user-color, extension, or a prior custom JSON theme) is left completely
untouched; nothing is partially applied.
