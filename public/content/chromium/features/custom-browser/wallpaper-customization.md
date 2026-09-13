# Wallpaper Customization Consolidation

Consolidates the wallpaper source/topic/color/effects logic that used to
be duplicated across six places — every NTP layout plus the settings
sidebar — into a single shared hook and a single shared picker
component. Adds Bing and Unsplash support to layouts that never had it,
plus a brand-new "Custom uploaded image" wallpaper source. Added
v1.9.16 (2026-09-11).

---

## Where to find it

**NTP Settings sidebar** → Background section → wallpaper source picker
(Default / Bing Daily / Unsplash / Colour), topic chips, color input,
blur/brightness sliders — available on any layout that shows a
background (Full, Glass, Hub, Wallpaper, Focus).

**Wallpaper layout's own settings** — gear icon on the NTP itself opens
an in-page picker with the same controls, plus a fifth source: **Custom**
(upload your own image).

**Prefs** (`window.custom.settings`, `NtpSettings`):

| Setting | Default | Meaning |
|---|---|---|
| `wallpaperSource` | `'default'` | `'default'` \| `'bing'` \| `'unsplash'` \| `'color'` \| `'custom'` |
| `unsplashTopic` | `'nature'` | One of `nature/architecture/city/abstract/travel/minimal` |
| `wallpaperColor` | `'#1e293b'` | Solid color for the `'color'` source |
| `wallpaperBlur` | `0` | 0-20px |
| `wallpaperBrightness` | `1` | 0.2-1.0 (20%-100%) |

The `'custom'` source has no persisted setting of its own beyond
`wallpaperSource: 'custom'` — the actual image lives in IndexedDB, not
in synced settings (see [Custom image storage](#custom-image-storage)).

---

## How it works

### `useWallpaper` (`remote_ntp/src/hooks/useWallpaper.ts`)

The single implementation replacing what used to be six near-identical
copies (`NewTab`, `Wallpaper`, `FocusLayout`, `GlassLayout`, `HubLayout`,
`DialLayout`) of: reading `wallpaperSource`/etc. from
`window.custom.settings.settingsJson`, the chain-and-restore
`onNtpSettingsChanged` subscription pattern, and computing a background
URL. Returns a `backgroundProps` object that spreads directly into
`<BlurBackground>`, plus the raw state/setters a picker UI needs.

- **Bing**: daily-photo fetch, cached in `localStorage` by
  day+offset, with a UHD toggle and prev/next cycling. Merges what used
  to be two separate, slightly different implementations (`Wallpaper.tsx`
  had offset-cycling, `NewTab.tsx` had a download-to-disk button) into
  one, exposing both.
- **Unsplash**: unchanged, reuses the existing `utils/unsplash.ts` topic
  list and URL builder, plus seed-based reseeding.
- **Custom image storage**: `remote_ntp/src/utils/customWallpaperStore.ts`,
  a small vanilla-`indexedDB` wrapper (one object store, one fixed key)
  storing the raw uploaded `File` directly — a `File` already *is* a
  `Blob`, so no conversion or base64 encoding happens. This deliberately
  avoids embedding image data in the synced settings JSON blob, which
  would otherwise bloat every settings read/write.

Before this, Focus/Glass/Hub/Dial layouts only ever checked
`wallpaperSource === 'color'` — anything else fell through to a static
random photo, silently ignoring a Bing/Unsplash choice made from the
Wallpaper layout's own picker or the sidebar. Migrating them onto
`useWallpaper` fixed this as a side effect of the refactor, not a
separate change.

### `WallpaperPicker` (`pathfinder-ui`)

A purely-controlled presentational component — no `window.custom`
coupling, no fetching — following the same "no browser API coupling"
convention as `DomainTile`. Takes the current source/topic/color/blur/
brightness plus callbacks, and a `sources` prop restricting which
options are offered (the sidebar passes 4, omitting `'custom'`; the
Wallpaper layout passes all 5). A `showEffects` prop lets a caller hide
the blur/brightness sliders entirely, needed because the sidebar shows
the source picker without effects on some layouts (Full, Hub) but with
effects on others (Glass, Wallpaper, Focus).

The `'custom'` source renders pathfinder-ui's existing `FileUpload`
component plus a thumbnail preview of the currently-stored image.

Consumed via `custom_sidebar`'s existing `@pf/*` deep-import aliasing
(a new `@pf/WallpaperPicker` entry in `tools/react/bundle.mjs`) in
`NtpSettingsPage.tsx`, and directly from the `pathfinder-ui` package in
`remote_ntp`'s `Wallpaper.tsx`.

---

## File map

| Path | Purpose |
|---|---|
| `pathfinder-ui/src/components/WallpaperPicker/WallpaperPicker.tsx` | The shared picker component |
| `remote_ntp/src/hooks/useWallpaper.ts` | Settings/Bing/Unsplash/custom-image logic |
| `remote_ntp/src/utils/customWallpaperStore.ts` | IndexedDB wrapper for the custom image |
| `remote_ntp/src/components/Wallpaper/Wallpaper.tsx` | In-page picker (all 5 sources) |
| `remote_ntp/src/components/NewTab/NewTab.tsx` | Full layout — now a function component |
| `remote_ntp/src/layouts/{FocusLayout,GlassLayout,HubLayout,DialLayout}.tsx` | Migrated to `useWallpaper` |
| `custom-browser/src/custom/tools/react/bundle.mjs` | `@pf/WallpaperPicker` esbuild alias |
| `custom-browser/src/custom/components/custom_sidebar/pages/NtpSettingsPage.tsx` | Sidebar picker (4 sources, no custom) |

---

## Known limitations

- The "Custom" wallpaper image source can only be *set* from the
  Wallpaper layout's own in-page picker — the native settings sidebar
  runs in a different origin (`chrome://`) than the NTP page itself and
  cannot read or write that IndexedDB store. Adding a cross-origin
  bridge for this would require a new native WebUI message handler; not
  done here.
- `NtpSettingsPage.tsx`'s own `UNSPLASH_TOPICS` constant and
  `remote_ntp`'s `utils/unsplash.ts` list are still two separately
  maintained constants (different repos, no shared module boundary) —
  kept in sync by matching `id` values, not by a single source of truth.
