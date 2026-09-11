# Speed-Dial Tiles & Dial Layout

A speed-dial style New Tab Page experience ported from the third-party
[Toolbar Dial](https://toolbardial.com) browser extension: bookmarks
rendered as large, colorful tiles with a typographic breakdown of the
domain instead of a favicon, plus a dedicated 7th NTP layout built
entirely around them. Added v1.9.16 (2026-09-11).

---

## Where to find it

Two separate places, both driven by the same `DomainTile` component:

1. **A new NTP layout flavor** — NTP Settings sidebar → layout selector →
   "Dial". A dedicated speed-dial bookmark grid, replacing the whole NTP
   body.
2. **An alternate top-sites tile style** — NTP Settings sidebar → Content
   (Full layout's drag-reorder list) → enable "Top sites (dial)", then
   pick "Dial tiles" in the style picker that appears. This activates a
   dynamic, `TilesAPI`-backed top-sites section that previously existed
   in code but was never actually rendered anywhere (see
   [Known limitations](#known-limitations)). Hub layout renders this same
   dynamic section automatically, alongside its existing static tiles.

**Settings** (`NtpSettings`, `custom_sidebar`'s `NtpSettingsPage.tsx`):

| Setting | Default | Meaning |
|---|---|---|
| `layout: 'dial'` | not default | Selects the Dial layout flavor |
| `showDynamicTopSites` | `false` | Shows the new "Top sites (dial)" section in Full layout |
| `tileStyle` | `'favicon'` | `'favicon'` \| `'dial'` — render mode for that section's tiles |

---

## How it works

### The `DomainTile` component (`pathfinder-ui`)

A new component in the shared `pathfinder-ui` library
(`src/components/DomainTile/`), consumed by `remote_ntp` via its existing
`pathfinder-ui` dependency:

- **`parseDomain.ts`** — splits a URL's hostname into dot-separated
  labels (`https://mail.google.com/...` → `["mail", "google", "com"]`),
  stripping a leading `www.`.
- **`domainColors.ts`** — a curated table of ~90 popular domains mapped
  to brand-ish Material colors (regex-matched against the joined
  domain), falling back to a small fixed palette of Material "700"-shade
  colors picked by a deterministic string hash of the domain — so an
  unrecognized domain still gets a *consistent* color across reloads,
  not a different random one each time.
- **`useAutoScaleText`** (a new hook, `src/hooks/useAutoScaleText.ts`) —
  measures a rendered text block after layout and applies a CSS
  `scale()` transform if it overflows a given box, so long domain names
  shrink to fit the fixed-size tile instead of wrapping or clipping.
- **`DomainTile.tsx`** — ties the above together: a 130px-tall colored
  tile showing either a folder glyph (`type="folder"`) or one of five
  typographic layouts for the domain labels (e.g. a short first label
  renders small-top-left / large-center / small-bottom-right), plus a
  title-strip pill below.

This is a from-scratch TypeScript/Tailwind port of Toolbar Dial's
Emotion-CSS implementation — no code or dependencies were copied from
the original extension (which is MIT-licensed), just the visual
algorithm and curated color table.

### Dial layout (`remote_ntp`)

`src/layouts/DialLayout.tsx` is the 7th entry in `LayoutFlavor`
(alongside `full`/`clean`/`focus`/`wallpaper`/`glass`/`hub`), wired
through `useLayoutFlavor`, `LayoutContext`'s `VALID_FLAVORS`/
`FLAVOR_CARDS`, and `LayoutShell`'s render branch — the same three-plus
places any new layout flavor needs touching in this codebase.

It subscribes to bookmarks via `BookmarksAPI` (`browser_api`), which
returns root `BookmarkFolder[]`, each with `children` (direct bookmarks)
and one level of `subfolders` (each with their own `children`). Local
component state tracks a folder-id path (max depth 2, matching the
API's shape) for drill-down: clicking a folder tile pushes its id;
a "back" pill button (showing the current folder's name) pops it. This
is a simplified, local-state analog of Toolbar Dial's own
`history.pushState`-based drill-down — not wired to the browser's
back/forward buttons in this port.

### Dial-style top sites (existing `Tiles` component)

`Tile`/`TileView`/`Tiles.tsx` (`remote_ntp/src/components/Tiles/`) gained
a `variant: 'favicon' | 'dial'` prop. When `'dial'`, `TileView` renders a
`DomainTile` instead of its usual favicon-and-title stack; the favicon
path (icon resolution, monogram fallback, etc.) is untouched.
`Tiles.tsx` reads its own `tileStyle` setting directly (same
`window.custom.settings` pattern used elsewhere in the codebase) rather
than requiring a prop from its parent.

`NewTab.tsx`'s section registry (the `sectionOrder`/`DEFAULT_SECTION_ORDER`
mechanism that already drives Full layout's Search/Bookmarks/Sessions)
gained a new `'topSites'` id, rendering `<Tiles />` when
`showDynamicTopSites` is on. The pre-existing `'tiles'` id (which
actually renders the *static* Settings/History/Speedtest tiles, not this
dynamic grid — a naming quirk that predates this feature) was left
untouched.

---

## File map

| Path | Purpose |
|---|---|
| `pathfinder-ui/src/components/DomainTile/{DomainTile.tsx,domainColors.ts,parseDomain.ts,index.ts}` | The tile component, color engine, and domain parser |
| `pathfinder-ui/src/hooks/useAutoScaleText.ts` | Measure-then-scale-to-fit text hook |
| `remote_ntp/src/layouts/DialLayout.tsx` | The new Dial layout |
| `remote_ntp/src/hooks/useLayoutFlavor.ts` | `LayoutFlavor` union (`+= 'dial'`) |
| `remote_ntp/src/context/LayoutContext.tsx` | `VALID_FLAVORS`, `FLAVOR_CARDS` |
| `remote_ntp/src/components/LayoutShell/LayoutShell.tsx` | Layout render branch |
| `remote_ntp/src/components/Tiles/Tile/{Tile.tsx,TileView.tsx}` | `variant` prop, dial-mode render branch |
| `remote_ntp/src/components/Tiles/Tiles.tsx` | `tileStyle` settings read |
| `remote_ntp/src/components/NewTab/NewTab.tsx` | `'topSites'` section registry entry |
| `remote_ntp/src/layouts/HubLayout.tsx` | Renders the dynamic `Tiles` grid alongside `StaticTiles` |
| `custom-browser/src/custom/components/custom_sidebar/pages/NtpSettingsPage.tsx` | `'dial'` layout card, `tileStyle`/`showDynamicTopSites` controls |
| `custom-browser/src/custom/DEPS` | `third_party/remote_ntp` pin, new `third_party/browser_api` entry |

---

## Known limitations

- Dial layout's folder drill-down is local component state, not native
  `history.pushState` — the browser's back button does not navigate up a
  folder level (unlike Toolbar Dial's own approach).
- `BookmarksAPI`'s `BookmarkFolder`/`BookmarkSubfolder` shape only
  carries two levels of nesting. A bookmark entry marked `isFolder` at
  the deepest level has no children data available and can't be drilled
  into further — it renders as a non-interactive folder tile.
- The dial-style top-sites section and the Dial layout are two separate
  code paths that happen to share the same `DomainTile` component — there
  is no single "make everything dial-styled" switch.
- `third_party/browser_api`'s DEPS entry ships its build output committed
  in `lib/`, so no build hook was needed for it — unlike `pathfinder_ui`,
  which needs `script/build_pathfinder_ui.py` to run since its `dist/` is
  gitignored.
