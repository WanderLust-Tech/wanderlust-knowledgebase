# Tab Search (chrome://tab-search.top-chrome)

**Status: stub.** The toolbar surface itself is correctly wired up as a
real top-chrome bubble, but it renders no functional tab list — no
search, no recently-closed/synced sections, no close/switch/pin actions.

> Note: the QA testing checklist's Fleet Smoke Test entry for this page
> ("loads and searches open tabs") is inaccurate as written; the bubble
> opens but the search list itself does nothing.

---

## What exists today

`CustomTabSearchUI`/`CustomTabSearchUIConfig`
(`custom/browser/ui/webui/tab_search/custom_tab_search_ui.{h,cc}`) is
correctly implemented as a **top-chrome** surface — it extends
`TopChromeWebUIController`/`DefaultTopChromeWebUIConfig<CustomTabSearchUI>`,
not a plain `WebUIController`, and overrides `ShouldAutoResizeHost()` →
`true` and `IsPreloadable()` → `true`. It's registered in the
`TopChromeWebUIConfig` registry, which is required —
`WebUIContentsPreloadManager` hardcodes a `FixedCandidateSelector`
pinned at `kChromeUITabSearchURL` and `DCHECK`s on startup that the URL
is registered there, so getting this class hierarchy right (rather than
a plain `WebUIController`) was necessary just to avoid a startup crash.

Host constant: `kChromeUICustomTabSearchHost = "tab-search.top-chrome"`
— the literal `.top-chrome` suffix is what tells the bubble machinery
this is a popup surface anchored to a toolbar button, not tab content.

No `WebUIMessageHandler` exists — no `chrome.send` calls, no mojo
`tab_search.mojom` binding. The React component
(`custom/components/custom_tab_search/App.tsx`) renders a disabled
search input and a "Tab search list not wired up yet" message.

No dedicated GN build flag — invocation (toolbar button / keyboard
shortcut) is whatever stock top-chrome plumbing already wires to
`kChromeUITabSearchURL`'s bubble; nothing custom was added there.

---

## What real implementation would need

A message handler or mojo binding backing `chrome.tabs`-equivalent
enumeration across windows, fuzzy search, and the close/switch/pin
actions the placeholder currently omits entirely.

---

## Where to find it

The toolbar tab-search button opens the bubble normally — it's just
empty of real content once open.
