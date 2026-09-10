# Reverse Image Search (TinEye)

A right-click context menu item on any image — "Search image with TinEye" —
that opens TinEye's URL-based reverse image search for that image in a new
tab. Modeled on the `tineye-chrome` reference extension's context-menu
approach rather than an NTP-native drag-and-drop flow. Added v1.9.13
(2026-09-08).

---

## Where to find it

Right-click any real `<img>` on a webpage. Toggle: Settings → Others → Web
content → "Show 'Search image with TinEye' in the right-click menu on
images" (on by default).

**Pref:** `custom.reverse_image_search.enabled` (bool, default `true`).

---

## How it works

TinEye's free search only needs the URL of an already-hosted image — no
file upload or image-bytes round trip is required, unlike the existing
"Search web for image" item (`ExecSearchWebForImage()`), which does need
`CoreTabHelper` to grab the image's raw bytes for sites that require an
upload.

`RenderViewContextMenu::AppendReverseImageSearchItem()` adds the menu item
only when the click target has real image contents
(`params_.has_image_contents`) and a valid `src_url`, and only if the
Settings toggle is on. `ExecReverseImageSearch()` builds
`https://www.tineye.com/search?url=<url-escaped src_url>`
(`base::EscapeQueryParamValue`) and opens it via `OpenURL()` in a new
foreground tab (or whatever disposition the click modifiers request —
middle-click for a background tab, etc., same as any other context menu
navigation item).

A new raw `IDC_CONTENT_CONTEXT_SEARCHIMAGE_TINEYE` command ID was added
rather than reusing an existing one (this fork's convention for
custom-browser-only context menu items, alongside e.g.
`IDC_PAGE_BLOCK_JAVASCRIPT` and the split-view items) — gated behind a new
`ENABLE_REVERSE_IMAGE_SEARCH` buildflag.

**Gotcha found during implementation:** a new `IDC_*` command needs an
entry in `GetIdcToUmaMap()`'s general map in `render_view_context_menu.cc`.
Custom command IDs in the renderer/extension "custom command" ranges are
exempted automatically (`RenderViewContextMenu::IsContentCustomCommandId()`
returns an early `0`/`1` sentinel for those), but a plain `IDC_*` constant
outside those ranges is not — `RecordUsedItem()` calls
`FindUMAEnumValueForCommand()`, and if that returns `-1` (unmapped),
`RecordUsedItem()` hits a `NOTREACHED()` and crashes the browser the moment
the menu item is clicked. The existing `ENABLE_SPLIT_VIEW` item
(`IDC_CONTENT_CONTEXT_OPEN_IN_SPLIT_VIEW`) already established the pattern
for this; the new item follows it (added at UMA value 159, sentinel bumped
to 160).

---

## File map

| Path | Purpose |
|---|---|
| `custom/custom_browser_config.gni` | `enable_reverse_image_search` declare_arg |
| `custom/buildflags/BUILD.gn` | `ENABLE_REVERSE_IMAGE_SEARCH` buildflag |
| `custom/common/custom_pref_names.h` | `kReverseImageSearchEnabled` |
| `custom/browser/prefs/custom_prefs.cc` | Registers the pref, default `true` |
| `custom/components/custom_settings/components/OthersPage.tsx` | The Settings toggle |
| `chrome/app/chrome_command_ids.h` *(vanilla, patched)* | `IDC_CONTENT_CONTEXT_SEARCHIMAGE_TINEYE` |
| `chrome/browser/renderer_context_menu/render_view_context_menu.{h,cc}` *(vanilla, patched)* | Menu item append/exec, `IsCommandIdEnabled`/`ExecuteCommand` wiring, `GetIdcToUmaMap()` entry |

---

## Known limitations

- TinEye only, no per-search-engine choice (the reference extension this
  was modeled on offered TinEye exclusively too — a "choose your reverse
  image search provider" option, mirroring the NTP search box's
  cycle-search-engine button, wasn't built).
- Works only on real `<img>` elements with a resolvable `src_url` —
  background-image CSS, canvas-rendered images, and `chrome://`-scheme
  images are excluded (same restriction the existing "Search web for
  image"/"Search image with Google Lens" items already have).
- No NTP-native entry point (e.g. drag-and-drop an image onto the search
  box) — that was considered as an alternative implementation approach and
  explicitly not built in favor of the simpler, extension-parity
  context-menu-only version.
