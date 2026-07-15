# EPUB Reader

Gated by `BUILDFLAG(ENABLE_EPUB_READER)`. Serves a full EPUB renderer at
`chrome://epub-reader/` powered by the vendored [epub.js](https://github.com/futurepress/epub.js)
library. Users can open any local or remote EPUB file and control font size,
colour theme, and scroll/paginate mode. Preferences persist across sessions.
A companion Polymer/Lit settings page lives under the custom browser settings
section.

## Build / activation

| Where | What |
|---|---|
| [`custom_browser_config.gni`](../src/custom/custom_browser_config.gni) | `enable_epub_reader = true` — gates source compilation |
| [`buildflags`](../src/custom/buildflags/BUILD.gn) | Emits `BUILDFLAG(ENABLE_EPUB_READER)` for `#if`-gating |
| [`custom_prefs.cc`](../src/custom/browser/prefs/custom_prefs.cc) | Registers all `epub_reader.*` prefs (default: enabled) |
| [`browser/ui/sources.gni`](../src/custom/browser/ui/sources.gni) | 4 `epub_reader/` source files under `if (enable_epub_reader)` |
| [`browser/resources/settings/sources.gni`](../src/custom/browser/resources/settings/sources.gni) | 1 `epub_reader_page/` TS file under `if (enable_epub_reader)` |
| [`components/custom_epub_reader/BUILD.gn`](../src/custom/components/custom_epub_reader/BUILD.gn) | `build_react_webui("custom_epub_reader")` — esbuild + GRD |
| [`components/resources/BUILD.gn`](../src/custom/components/resources/BUILD.gn) | Repack includes `custom_epub_reader_resources.pak` |
| [`resource_ids_custom.spec`](../src/custom/tools/gritsettings/resource_ids_custom.spec) | GRD resource ID range starting at `31790` |

## Architecture

```
User navigates to chrome://epub-reader/?url=<encoded-epub-url>
   │
   ▼
EpubReaderUIConfig  (registered in chrome_web_ui_configs.cc)
   │  kChromeUIScheme + kChromeUIEpubReaderHost ("epub-reader")
   │
   ▼
EpubReaderUI  (content::WebUIController)
   │  Serves React bundle from //custom/components/custom_epub_reader/
   │  CSP: script-src 'self'; style-src 'unsafe-inline'; worker-src blob:
   │
   ├── EpubReaderDOMHandler  (WebUIMessageHandler)
   │     onPageLoaded       → AllowJavascript
   │     getEpubPrefs       → returns prefs dict (font_size, theme, scrolled)
   │     setEpubPrefs       → writes prefs; fires epubPrefsChanged listener
   │     loadEpubFile       → reads local file bytes on a ThreadPool task,
   │                          returns base64 data so epub.js can parse it
   │                          (file:// URLs can't be fetched from chrome://)
   │     getEpubPosition    → returns { cfi, progress } for a given EPUB URL,
   │                          or null if no position has been saved yet
   │     setEpubPosition    → writes { cfi, progress } for a given EPUB URL
   │                          into the per-URL position map pref
   │
   └── React App  (chrome://epub-reader/)
         main.tsx  → createRoot → <App>
         App.tsx
           useEpubPrefs()    — fetches prefs; listens for epubPrefsChanged
           useEpubBook()     — mounts epub.js rendition into <Viewer> div;
                               re-applies theme/font on pref change without
                               re-rendering the book
           <Toolbar>         — prev/next, font ±2px, theme picker, scroll toggle
           <TableOfContents> — recursive TOC tree built from book.navigation
           <Viewer>          — div that epub.js renders its iframe into
```

### File URL handling

epub.js calls `fetch()` internally. A `chrome://` page cannot directly fetch
`file://` URLs, so the app detects `url.startsWith('file://')`, sends
`loadEpubFile(filePath)` to `EpubReaderDOMHandler`, and reconstructs an
`ArrayBuffer` from the returned base64 string before passing it to `ePub()`.
HTTP(S) URLs are passed directly to `ePub()` with no C++ round-trip.

### epub.js vendoring

epub.js is vendored as a pre-built minified bundle at:

```
src/custom/components/custom_epub_reader/epub.js
```

The file is the unmodified `dist/epub.min.js` from the
[epubjs npm package](https://www.npmjs.com/package/epubjs) (currently v0.3.93).
`index.html` loads it via `<script src="epub.js">` before the React module so
that `window.ePub` is available when the app mounts.

To update the bundle:

```
npm pack epubjs
tar xf epubjs-*.tgz
cp package/dist/epub.min.js src/custom/components/custom_epub_reader/epub.js
rm -rf epubjs-*.tgz package
```

TypeScript declarations for the `ePub` global are in
[`types.ts`](../src/custom/components/custom_epub_reader/types.ts). They are
minimal stubs; replace with `@types/epubjs` if upstream ships one.

## Preferences

| Pref key | Type | Default | Description |
|---|---|---|---|
| `epub_reader.enabled` | bool | `true` | Master on/off toggle (settings page) |
| `epub_reader.font_size` | int | `16` (px) | Body font size applied via epub.js `themes.fontSize()` |
| `epub_reader.theme` | string | `"auto"` | Colour theme — `auto`, `light`, `dark`, or `sepia` |
| `epub_reader.scrolled_mode` | bool | `false` | `true` → epub.js `flow: "scrolled"`, `false` → `"paginated"` |
| `epub_reader.last_position` | string | `"{}"` | JSON map from EPUB URL → `{ "cfi": string, "progress": number }`. Written by `setEpubPosition`; read by `getEpubPosition` on load to restore the last reading location. |

Prefs are registered in [`custom_prefs.cc`](../src/custom/browser/prefs/custom_prefs.cc)
under `#if BUILDFLAG(ENABLE_EPUB_READER)`.  Constants live in
[`custom_pref_names.h`](../src/custom/common/custom_pref_names.h).

## Theme implementation

`applyTheme()` in `useEpubReader.ts` is called whenever prefs change:

```
prefs.theme
  "auto"  → read prefers-color-scheme media query
  "light" → white background, near-black text
  "dark"  → #1a1a2e background, #e8e8e8 text
  "sepia" → #f4ecd8 background, #5b4636 text

rendition.themes.register("custom", { body: { background, color } })
rendition.themes.select("custom")
rendition.themes.fontSize(`${prefs.fontSize}px`)
```

epub.js injects these styles into its inner iframe so they apply to the book
content without touching the chrome frame's CSS.

## Settings page

A Polymer/Lit settings page is registered under the custom browser settings
section:

| File | Purpose |
|---|---|
| [`epub_reader_page/epub_reader_page.ts`](../src/custom/browser/resources/settings/epub_reader_page/epub_reader_page.ts) | Element class — `settings-custom-epub-reader-page` |
| [`epub_reader_page/epub_reader_page.html`](../src/custom/browser/resources/settings/epub_reader_page/epub_reader_page.html) | Polymer template — toggle, font-size slider, theme dropdown, scrolled checkbox, link to open the reader |

The page reads/writes prefs via Polymer's two-way `{{prefs.*}}` binding; no
explicit `chrome.send` calls are needed.

## File map

| File | Purpose |
|---|---|
| [`browser/ui/webui/epub_reader/epub_reader_ui.{cc,h}`](../src/custom/browser/ui/webui/epub_reader/epub_reader_ui.cc) | `EpubReaderUIConfig` + `EpubReaderUI` — registers the WebUI data source and message handler |
| [`browser/ui/webui/epub_reader/epub_reader_dom_handler.{cc,h}`](../src/custom/browser/ui/webui/epub_reader/epub_reader_dom_handler.cc) | Pref get/set, file-byte proxy for local EPUBs, and reading-position persistence |
| [`browser/epub/epub_navigation_throttle.{cc,h}`](../src/custom/browser/epub/epub_navigation_throttle.cc) | `NavigationThrottle` — intercepts `http(s)://…*.epub` navigations and redirects to `chrome://epub-reader/?url=<encoded>` |
| [`common/webui_url_constants.h`](../src/custom/common/webui_url_constants.h) | `kChromeUIEpubReaderHost` / `kChromeUIEpubReaderURL` |
| [`common/custom_pref_names.h`](../src/custom/common/custom_pref_names.h) | `kEpubReader*` pref name constants |
| [`components/custom_epub_reader/`](../src/custom/components/custom_epub_reader/) | React app root — BUILD.gn, index.html, App.tsx, cr.ts, types.ts |
| [`components/custom_epub_reader/hooks/useEpubReader.ts`](../src/custom/components/custom_epub_reader/hooks/useEpubReader.ts) | `useEpubPrefs` + `useEpubBook` hooks |
| [`components/custom_epub_reader/components/`](../src/custom/components/custom_epub_reader/components/) | `Toolbar`, `Viewer`, `TableOfContents` React components |
| [`components/custom_epub_reader/epub.js`](../src/custom/components/custom_epub_reader/epub.js) | Vendored epub.js v0.3.93 minified bundle |
| [`browser/resources/settings/epub_reader_page/`](../src/custom/browser/resources/settings/epub_reader_page/) | Polymer/Lit settings page |

## Opening an EPUB

Navigate directly:

```
chrome://epub-reader/?url=file:///path/to/book.epub
chrome://epub-reader/?url=https://example.com/book.epub
```

The URL is read from `location.search` on mount — no round-trip to C++ is
needed for the URL itself.

## Navigation throttle

`EpubNavigationThrottle` (gated by `BUILDFLAG(ENABLE_EPUB_READER)`) is
registered in `CustomContentBrowserClient::CreateThrottlesForNavigation`. It
intercepts any `http://` or `https://` navigation whose URL path ends with
`.epub` (case-insensitive) and redirects it to
`chrome://epub-reader/?url=<percent-encoded-epub-url>` using the standard
`CANCEL_AND_IGNORE` + `WebContents::OpenURL` throttle pattern. The original
navigation is cleanly aborted before a new top-level navigation to the reader
begins.

**Limitation:** `file://` `.epub` navigations are not intercepted — the
throttle only handles http/https schemes. Users can still open local EPUBs
by navigating directly to `chrome://epub-reader/?url=file:///path/to/book.epub`.

## Known gaps

- **No file picker.** There is no "Open file…" button in the toolbar; users
  must construct the URL manually or navigate directly.

- **epub.js cross-origin image loading.** EPUBs with images hosted on external
  servers may fail to load under the default CSP because the epub.js iframe
  does not inherit the `chrome://` page's origin. No `img-src` override is
  currently set.
