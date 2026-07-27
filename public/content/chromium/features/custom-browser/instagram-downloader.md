# Instagram Downloader

Two related Instagram enhancements, sharing one injected script and one
tab helper:

1. A floating **Save** button on Instagram post/reel pages
   (`instagram.com/{p,reel,tv}/<shortcode>/`) that downloads the post's
   image(s) or video. Toggleable via `custom.instagram_downloader.enabled`
   (default on).
2. **"You liked this" badges** on post/reel thumbnails anywhere they
   appear — profile grids, the home feed, explore, etc — for any post
   you've previously opened in this browser, so re-encountering it in a
   grid doesn't require re-opening it just to check. Toggleable
   independently via `custom.instagram_downloader.show_like_status`
   (default on). See "Like status badges" below.
   - Coverage can also be bulk-populated from Instagram's own **Liked
     posts** activity list in one pass, rather than only building up from
     posts you happen to open — see "Bulk sync from Instagram's own
     'Liked posts' list" below.

## Why passive capture, not just a direct API call

The obvious approach (and the one initially proposed) was: extract the
shortcode from the URL, then directly call Instagram's internal GraphQL
endpoint —

```
https://www.instagram.com/graphql/query/?doc_id=24368985919464652&variables=%7B%22shortcode%22%3A%22...%22%2C...%7D
```

— and parse the response for the media URL. That endpoint is **not a
public API**: `doc_id` identifies a specific compiled query on
Instagram's backend, it's reverse-engineered, and it rotates without
notice whenever Instagram ships a new frontend build. Calling it
independently is also a clearer Terms-of-Service violation than saving
content the page already shows you.

This feature instead **passively captures the media URL from data
Instagram's own page already loads** — its server-rendered embedded JSON
and its own client-side API calls — and only falls back to the direct
`doc_id` query if nothing was captured by the time the user clicks Save.
This is meaningfully different from the naive approach: no independent
request is made to Instagram's private API in the common case, and the
mechanism doesn't depend on knowing which internal query Instagram
currently uses to render a post.

## Architecture

```
InstagramDownloaderTabHelper (WebContentsObserver, per-tab)
  DidFinishNavigation (primary main frame, commit OR same-document)
    │  Instagram is a client-routed SPA -- page-to-page/reel-to-reel
    │  navigation is usually pushState, so same-document navigations are
    │  handled too (unlike SiteInjectionTabHelper, which skips them).
    ├─ ExtractShortcode(url) — matches /p/, /reel/, /tv/ paths; empty on
    │     any other instagram.com page (profile, home feed, explore, ...)
    ├─ if not instagram.com, or both sub-features disabled → nothing
    └─ InjectScript(rfh, shortcode)  — runs on EVERY instagram.com page,
          not just post pages, so passive capture (media + like status)
          accumulates from ordinary browsing, and grid badges (below)
          have something to draw on wherever they're shown
  DocumentOnLoadCompletedInPrimaryMainFrame
    re-runs InjectScript once the DOM has fully loaded, so both the
    passive-capture script-tag scan and the grid-badge decoration pass
    (below) see the complete page
```

`InjectScript` runs `kInstagramDownloaderScriptTemplate` via
`RenderFrameHost::ExecuteJavaScript`, with `$SHORTCODE$`,
`$DOWNLOADER_ENABLED$`, and `$LIKE_STATUS_ENABLED$` textually replaced
(same JSON-quoting escaping approach as `SiteInjectionTabHelper`'s CSS
injection). Everything below happens in injected page-world JavaScript —
there is no C++ networking involved at all for either feature; the
browser process only ever runs the tab-helper logic above.

## Injected script (`instagram_downloader_tab_helper.cc`)

Runs on every commit and again at DOM-ready, on every instagram.com page.
Each run:

1. **Scans embedded JSON** — every
   `<script type="application/json">` tag on the page — for any object
   matching the modern private-API item shape (see "Media JSON schema"
   below), extracting both its media URL(s) into
   `window.__wlInstaMedia[code]` and its `has_liked` boolean into
   `window.__wlInstaLiked[code]`, independently of each other (a
   grid-listing response may carry `has_liked` without the full media
   payload a single-post view has, or vice versa). This is what catches
   the common case of directly loading a specific reel/post URL, where
   Instagram's server-rendered payload already contains everything needed
   and no client fetch ever happens.
2. **Installs a fetch/XHR observer, once per page lifetime** (guarded by
   `window.__wlInstaHooked`) — wraps `window.fetch` and
   `XMLHttpRequest.prototype.open`/`send`. Any response from a URL
   matching `/instagram\.com\/(graphql|api)\//` is parsed as JSON and fed
   through the same scanning function. This is what catches later SPA
   navigations (scrolling to the next reel, loading more of a profile
   grid) that fetch new data without a full document reload.
3. **Renders/refreshes the floating Save button** (`#__wlInstaDownloadBtn`,
   fixed bottom-right, `z-index: 2147483647`) for the current shortcode,
   if `downloaderEnabled` and this is a post/reel/tv page.
4. **Decorates post/reel thumbnails with like-status badges**, if
   `likeStatusEnabled` — see "Like status badges" below.

### On click

```js
onButtonClick()
  → window.__wlInstaMedia[shortcode] already populated?
       yes → saveUrls(shortcode, cached)
       no  → fetchViaGraphQLFallback(shortcode)   // the doc_id query, as a last resort
               → saveUrls(shortcode, urls)
```

`fetchViaGraphQLFallback` builds the exact request from the original
proposal (`doc_id=24368985919464652`, `variables` JSON-encoding
`shortcode` + the three `null` fields Instagram's client always sends),
with `credentials: 'include'` so the request carries the user's existing
Instagram session cookies — this matters for private-but-followed
accounts.

`saveUrls` downloads each URL via `fetch(url).then(blob)` → `URL.
createObjectURL` → a synthetic `<a download>` click, which forces a real
save rather than an in-browser navigation/playback. If the blob fetch
fails (the CDN doesn't always send permissive CORS headers for
cross-origin `fetch`), it falls back to a plain anchor click, which still
triggers a native download in most cases even without script-level
control over the response bytes.

## Like status badges

Shows a small ❤ badge (top-left corner, `.__wlLikeBadge`) on any
post/reel thumbnail link (`a[href*="/p/"]`, `a[href*="/reel/"]`) found
anywhere on the page, whenever `window.__wlInstaLiked[code] === true`.

**Active only for the post actually being viewed; passive everywhere
else.** Grid thumbnails themselves are never queried on demand — the
straightforward way to build this would be to actively look up each
visible grid thumbnail's like status as it scrolls into view, which was
considered and rejected: it would mean firing a private-API request per
grid item scrolled past, a meaningfully heavier and more bot-like traffic
pattern than the download button (one explicit click → one request), and
exactly what platforms' anti-scraping systems watch for.

A single post/reel *page view*, however, is different: when the tab
helper detects a shortcode (i.e. the user has actually navigated to that
specific post), and `window.__wlInstaLiked` doesn't yet have an entry for
it, the script calls `fetchViaGraphQLFallback(shortcode)` once to confirm
its like status — the same `doc_id` request the download button's
fallback already uses, this time run automatically rather than only on a
Save click. This turned out to be necessary in practice: Instagram's own
page traffic doesn't appear to surface `has_liked` passively even when
directly viewing a single post (confirmed via the `[WL-IG]` console
diagnostics — `liked cache size: 0` persisted even after loading a post
page whose `has_liked` field was independently confirmed present in that
same `doc_id` response), so relying purely on incidentally-observed
traffic left the cache permanently empty. One request per genuine
single-post view is a normal cost for rendering that page — not
meaningfully different from what the page needs to show its own
engagement info — and is categorically different from probing every grid
thumbnail. Grid thumbnails still only ever show a badge from *this*
recorded data, never from their own on-demand fetch; coverage builds up
as you view individual posts/reels, not from scraping the grid you're
currently looking at.

### Detecting a like made *while* viewing (DOM-based, not network-based)

The active on-view confirmation above only captures like status at the
moment the post loads. If the user likes the post *during* that same
view, the cached value goes stale unless something else catches the
change. Two network-based approaches were tried and rejected before
landing on reading the like button's own DOM state directly:

1. **Guessing a dedicated like/unlike endpoint URL** (e.g.
   `/api/v1/web/likes/<id>/like/`) — wrong. Instagram doesn't use a
   distinct URL for this at all.
2. **Inspecting the `/api/graphql` POST request body** for
   `fb_api_req_friendly_name=PolarisAPILikePostMutation` (confirmed, via
   DevTools Network tab, to be the real friendly name Instagram sends) —
   correct for a post opened by navigating directly to its URL, but
   **did not fire when the post was opened from a grid/thumbnail via
   Instagram's overlay modal** instead of a full navigation. Instagram
   evidently handles the overlay case differently (most likely an
   optimistic client-side update synced to the server some other way),
   so no fetch/XHR pattern reliably caught it — and the overlay is how
   users normally browse and like posts from a grid, making this the
   common case, not an edge case.

Given two wrong guesses about the underlying network mechanism, the fix
switches to something that can't be wrong about *current* state by
construction: **the like button's own DOM state**. Confirmed via
inspecting the button in both states — the `<svg>`'s `aria-label` (and
`<title>`) reads `"Like"` when not liked and `"Unlike"` when liked
(Instagram labels the button by the action it would perform, not the
current state's name, but the two values map 1:1 to state either way).
`checkLikeButtonState()` queries
`svg[aria-label="Like"], svg[aria-label="Unlike"]` and records whichever
it finds via `markCurrentShortcodeLiked()`. This is authoritative
regardless of how Instagram's client persists the like underneath, and
needed no further debugging once found.

Only trusted when a single post/reel is being viewed (`shortcode` is
non-empty) — on a grid/feed page there can be many post cards visible at
once, each with its own like button, making "the first Like/Unlike svg
on the page" ambiguous. `checkLikeButtonState()` runs:

- Once right after the network-based confirmation, in case the button
  has already rendered by then.
- Alongside `decorateGridLinks()` in the same debounced `MutationObserver`
  callback (see "Keeping up with the grid" below) — this is what catches
  the button's *later* appearance (if it wasn't rendered yet at first
  injection) and the user actually toggling it while viewing the post.
  Reusing the existing observer avoids adding a second one.

### Persistence

`window.__wlInstaLiked` is seeded from `localStorage['__wlInstaLikedCache']`
on script install and written back (`saveLikedCacheIfDirty`) any time a
scan adds or changes an entry — so badges persist across page loads and
browser restarts, not just within one tab's session. Capped at 3000
entries via a simple FIFO eviction (oldest insertion-order entries
dropped first) — approximate, not true LRU, but sufficient to bound
growth without a real cache data structure.

### Bulk sync from Instagram's own "Liked posts" list

Coverage described so far only comes from posts you've actually opened.
Instagram's account settings still have a **Liked posts** list (Settings
→ Your Activity → Interactions → Likes) that gives a much faster way to
populate the whole cache at once — visiting it and clicking a **"❤ Sync
all my likes"** button (injected automatically the first time that list's
data is observed) walks the *entire* list and marks every post in it as
liked, with no per-post page views needed.

**This is the single most fragile piece of the whole feature**, and
deliberately built to avoid being *more* fragile than it has to be:

- The list loads via **two different Bloks async actions** — the initial
  page load uses `appid=com.instagram.privacy.activity_center.liked_media_screen`,
  and subsequent pagination switches to
  `activity_center.liked_next` — both matched by `LIKED_NEXT_URL_RE`,
  since both are rendered from the same underlying item template. Missing
  the first of these was an actual bug during development: the sync
  button never appeared on first landing on the page, only after
  scrolling far enough to trigger the second request type.
- Both are **Bloks async actions** — Facebook/Instagram's
  server-driven-UI framework. Their response is a huge action-tree DSL
  (nested `bk.action.*` s-expressions describing how to *render* the
  page), not a clean data payload like everything else this feature
  parses.
- Rather than write a real parser for that DSL, each liked item's data
  appears as a literal, fixed-key-order run of text — but note it's
  `\"media_id\", \"media_code\", \"media_product_type\", ...` with
  **backslash-escaped quotes and a space after each comma** in the raw
  response body, not plain `"media_id","media_code"` — this is a JSON
  *string value* containing embedded quoted DSL text, not a bare
  JS/JSON array, so every literal quote inside it is escaped as it would
  be in any JSON string. Getting this wrong was a second actual bug
  during development: the request was being seen and the response body
  was non-empty, but the regex silently matched zero items because it
  expected unescaped, space-free quotes. `extractLikedMediaCodes()`
  regexes the escaped key sequence out directly and captures the second
  value (`media_code`, the shortcode) — inherently more brittle than JSON-
  key access, since it depends on Instagram's exact DSL text layout
  rather than a stable schema, but writing a full Bloks interpreter for
  one feature wasn't worth it.
- Rather than reconstruct these requests ourselves (which would need
  session tokens — `fb_dtsg`, `lsd`, `jazoest`, `__req`, `__rev`, etc. —
  scraped from the page and kept in sync across each page as pagination
  advances), pagination is driven by **scrolling**. The captured response
  showed the loading spinner at the bottom of the list wrapped in an
  `ig.components.ViewpointExtension` with an `on_appear` handler — i.e.
  Instagram's own client fetches the next page when *that spinner scrolls
  into view*. `likesSyncStep()` exploits this directly: it scrolls the
  last `<img>` on the page into view (`scrollIntoView` walks up the DOM
  to whatever ancestor actually needs to scroll, so this doesn't require
  knowing whether the list uses a nested scroll container or the main
  document), waits, and lets Instagram's own client do the actual
  request-building. Our fetch/XHR hook harvests whatever comes back, the
  same way it does for every other response this feature reads.

Pagination stops after 3 consecutive scroll cycles produce no new liked
codes (end of the list reached) or after a 2000-iteration safety cap,
whichever comes first. Each cycle waits 600ms before checking progress —
a deliberately paced full sync (per an explicit choice: full-history
syncs shouldn't fire a burst of requests back-to-back, even though this
is the user's own account data, not scraping other content) rather than
looping as fast as possible.

### Keeping up with the grid

Instagram's grid is virtualized and paginates via infinite scroll, so
badges need to be applied to elements that don't exist yet at injection
time. `decorateGridLinks()` re-runs:

- Immediately on each injection (commit + DOM-ready).
- On every fetch/XHR response matching the API pattern, via
  `window.__wlInstaDecorateGrid()` (so a lazily-loaded page of grid items
  gets badged as soon as its data arrives, not just on the next full
  script re-injection).
- On DOM mutations, via a `MutationObserver` on `document.body`
  (debounced 150ms, since Instagram's grid can mutate in bursts while
  scrolling) — this is what catches newly-rendered thumbnail elements as
  the user scrolls, independently of whether new data arrived.

If `likeStatusEnabled` is false, any existing observer is disconnected
and `window.__wlInstaDecorateGrid` cleared, so toggling the pref off
mid-session actually stops the work rather than just hiding badges.

### A stale badge is removed, not just left alone

If a cached entry says a post is liked but a later scan reveals
`has_liked: false` for the same code (the user unliked it since it was
last seen, from another device or Instagram's own UI), the badge is
removed on the next decoration pass rather than staying stuck showing
outdated state.

## `InstagramDownloaderTabHelper::ExtractShortcode`

Manual parsing (no `<regex>`/RE2 dependency): validates the host is
`instagram.com`/`www.instagram.com`, splits the path on `/`, checks the
first segment is `p`, `reel`, or `tv`, and validates the second segment
is non-empty and made up only of `[A-Za-z0-9_-]` — Instagram shortcodes'
actual charset.

## Build flag

Gated by `BUILDFLAG(ENABLE_INSTAGRAM_DOWNLOADER)`. Controlled by
`enable_instagram_downloader = true` in
[`custom_browser_config.gni`](../src/custom/custom_browser_config.gni).

## Preferences

| Pref key | Type | Default | Description |
|---|---|---|---|
| `custom.instagram_downloader.enabled` | bool | `true` | Save-button toggle, checked in `InstagramDownloaderTabHelper::IsDownloaderEnabled()`. |
| `custom.instagram_downloader.show_like_status` | bool | `true` | Like-status badge toggle, checked in `IsLikeStatusEnabled()`. Independent of the pref above — either can be off while the other stays on, since both share one injection but render separately based on the two `$..._ENABLED$` flags passed into the script. |

The injected script only runs at all if at least one of the two is true
(`DidFinishNavigation`/`DocumentOnLoadCompletedInPrimaryMainFrame` both
skip injection entirely when both are false, not just skip individual
pieces of the script) — turning off both means zero JS runs on
instagram.com, not merely JS that does nothing.

Registered unconditionally under `BUILDFLAG(ENABLE_INSTAGRAM_DOWNLOADER)`
in [`custom_prefs.cc`](../src/custom/browser/prefs/custom_prefs.cc).

## Media JSON schema

Instagram's response (both the embedded page JSON and the `doc_id` GraphQL
fallback) uses the modern private-API item shape, **not** the older
public-GraphQL `xdt_shortcode_media` shape a lot of still-circulating
documentation/tools assume:

```
data.xdt_api__v1__media__shortcode__web_info.items[] = {
  code: "DY0E2RbN0kb",          // the shortcode -- NOT called "shortcode"
  media_type: 2,                 // 1 = photo, 2 = video, 8 = carousel
  video_versions: [ { url, width, height, type }, ... ],   // highest quality first
  image_versions2: { candidates: [ { url, width, height }, ... ] },  // highest quality first
  carousel_media: [ /* one item per slide, each shaped like the above */ ],
  has_liked: true,                // what the like-status badge reads
  ...
}
```

`scanForShortcodeMedia` matches on `cur.code` (string) **plus** the
presence of `video_versions`/`image_versions2`/`carousel_media` as a
companion signal for the *media* extraction — `code` alone is too generic
a property name (country codes, language codes, etc. also use it) to
trust without that second check. The `has_liked` capture is separate and
doesn't require that companion signal (just `typeof cur.has_liked ===
'boolean'` alongside a `code` or legacy `shortcode` field), since a
grid/feed-listing item may carry like status without the full media
payload a single-post view has. A legacy path matching the old
`shortcode`/`edge_sidecar_to_children` shape is also kept for media
extraction in case that ever resurfaces in some embed, but the modern
shape above is what's actually hit in practice.

## Automatic save (no confirmation prompt)

The whole point of a one-click Save button is defeated if every click
still shows a native "Save As" file picker. Rather than changing the
browser-wide "Ask where to save each file before downloading" setting
(which would affect every download on every site), a small, scoped bypass
was added directly in `DownloadTargetDeterminer::NeedsConfirmation()`
(`chrome/browser/download/download_target_determiner.cc`, patched):

```cpp
#if BUILDFLAG(ENABLE_INSTAGRAM_DOWNLOADER)
  const GURL& referrer = download_->GetReferrerUrl();
  if (referrer.SchemeIsHTTPOrHTTPS() &&
      (referrer.host() == "www.instagram.com" ||
       referrer.host() == "instagram.com")) {
    return DownloadConfirmationReason::NONE;
  }
#endif
```

This checks the download's **referrer** (the page that initiated it), not
the download's own target URL. That distinction matters: the primary
blob-based download path produces a `blob:https://www.instagram.com/...`
URL (same-origin blob, not a CDN host at all), while the CORS-failure
anchor-click fallback produces the real, ever-changing CDN URL directly —
the referrer is the one thing both paths reliably have in common, and
unlike a CDN-hostname allowlist it doesn't need updating when Instagram's
CDN hostnames change.

Returning `NONE` here (rather than reusing the existing
`download_->GetOperation() == 2` mechanism already patched into this same
function, gated on `BUILDFLAG(CUSTOM_DOWNLOAD_SHELF)`) is deliberate: that
existing path redirects to `GetProfile()->GetCurrentCacheDownloadsPath()`
and calls `SetOpenWhenComplete(true)` — a transient cache directory with
auto-open, meant for a different feature's preview-style workflow, not a
persistent save to the user's normal Downloads folder. `NONE` alone falls
through to the same "no confirmation needed" branch every ordinary silent
download already uses, landing in the regular configured Downloads path.

## Known limitations

- **No settings-page toggle yet.** The pref exists and is checked, but
  there's no UI switch for it — same v1 gap as other recently-added
  features before their settings field lands. Set via the generic pref
  bridge (see [`ai-page-assistant.md`](ai-page-assistant)'s settings
  section for the pattern — `customGetPrefs`/`customSetPref` work for
  any registered pref by key) or direct pref-file edit in the interim.
- **Carousel posts download every item at once**, one `<a>` click per
  item in a tight loop — Chromium's `DownloadRequestLimiter` (per-tab,
  unpatched/vanilla in this fork) may still surface its own "this site is
  trying to download multiple files" infobar once a tab's download count
  crosses its threshold, independently of the save-location-prompt bypass
  above, since that limiter is a separate mechanism.
- **CDN CORS is not guaranteed.** The primary blob-based download path
  requires the CDN response to allow cross-origin `fetch` reads; when it
  doesn't, the anchor-click fallback is used instead, which is less
  reliable at *forcing* a download (some browsers may open the resource
  in a new tab rather than saving it, depending on `Content-Disposition`
  and content type).
- **Passive capture depends on Instagram's page shape.** If Instagram
  changes its embedded-JSON structure or field names again (as it already
  has once, from the old public-GraphQL shape to the current private-API
  shape — see "Media JSON schema" above), `scanForShortcodeMedia` will
  need updating again. It isn't keyed to one specific JSON path, which
  reduces but doesn't eliminate how often that happens.
- **Stories, not just posts/reels, are not covered.** `ExtractShortcode`
  only matches `/p/`, `/reel/`, `/tv/` — Instagram Stories use a
  different URL shape and a different (also-private) API and aren't
  handled by this feature.
- **Like-status coverage is limited to posts you've actually opened.**
  A grid thumbnail never triggers its own like-status lookup (see "Like
  status badges" above) — badges only appear for posts/reels you've
  directly navigated to at some point, not for every post visible in a
  grid you're scrolling through. A post you've liked but never opened in
  this browser shows no badge.
- **The FIFO-capped like cache isn't a true LRU.** Once 3000 entries are
  exceeded, the oldest by *insertion order* are dropped regardless of how
  recently they were looked up/decorated — a post badged on every visit
  isn't protected from eviction the way a real LRU would protect it.
- **The `MutationObserver` runs on `document.body` with `subtree: true`
  whenever like-status is enabled** — on a DOM-mutation-heavy SPA like
  Instagram, this has some ongoing cost while browsing, bounded by a
  150ms debounce on the actual decoration work. Users who don't want that
  cost can disable `custom.instagram_downloader.show_like_status`.

## File map

| Path | Role |
|---|---|
| `src/custom/browser/instagram_downloader/instagram_downloader_tab_helper.h/.cc` | `WebContentsObserver` — shortcode extraction, script injection, the injected JS itself (download button + like-status badges) |
| `src/custom/common/custom_pref_names.h` | `kInstagramDownloaderEnabled`, `kInstagramShowLikeStatus` |
| `src/custom/browser/prefs/custom_prefs.cc` | Registers the pref under `BUILDFLAG(ENABLE_INSTAGRAM_DOWNLOADER)` |
| `src/custom/browser/sources.gni` | Adds the tab-helper source files |
| `src/chrome/browser/ui/tab_helpers.cc` (patched) | Attaches `InstagramDownloaderTabHelper` to every `WebContents` |
| `src/chrome/browser/download/download_target_determiner.cc` (patched) | Referrer-based bypass of the save-location confirmation prompt |
| `src/custom/custom_browser_config.gni` | `enable_instagram_downloader = true`; `ENABLE_INSTAGRAM_DOWNLOADER` branding flag |
| `src/custom/buildflags/BUILD.gn` | `ENABLE_INSTAGRAM_DOWNLOADER=$enable_instagram_downloader` |
