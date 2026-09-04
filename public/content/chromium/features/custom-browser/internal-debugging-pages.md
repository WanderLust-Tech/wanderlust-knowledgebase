# Internal Debugging Pages

Lets a user unlock Chromium's internal-only `chrome://` pages (`chrome://
memory-internals`, `chrome://discards`, `chrome://local-state`, and
~30 others) directly from `chrome://chrome-urls`, without a command-line
flag or `about:flags` entry. Added v1.9.4 (2026-09-04).

---

## Background

Any page whose `WebUIConfig` subclasses `content::InternalWebUIConfig` is
always registered, but Chromium's `ChromeContentBrowserClient` rewrites
navigation to it into the `chrome://internal-debug-pages-disabled`
interstitial unless the `chrome_urls::kInternalOnlyUisEnabled` local-state
pref is on. Upstream exposes a toggle for this pref on its own
`chrome://chrome-urls` page; this fork's version of that page had no
message handler at all prior to v1.9.4, and its React frontend was a
fully static, hand-curated URL list that didn't mention internal-only
hosts, so there was previously no way to reach these pages in this fork
short of hand-editing local state.

---

## Where to find it

`chrome://chrome-urls` → **Internal Debugging Page URLs** section, below
the existing hand-curated groups. An **Enable internal debugging pages**
button flips the pref; once enabled, the section becomes a list of
clickable links.

**Pref:** `chrome_urls::kInternalOnlyUisEnabled` (bool, default `false`,
local state — not per-profile). The flip takes effect immediately, no
restart required.

---

## How it works

`CustomChromeUrlsHandler` (classic `chrome.send`/`cr.sendWithPromise`,
matching this fork's other WebUI pages rather than the Mojo interface
upstream's own `chrome_urls_handler.cc` uses) backs two messages:

- `getChromeUrls` — enumerates `content::WebUIConfigMap` the same way
  upstream does, tags each entry via `content::IsInternalWebUI()`, sorts
  chrome:// before chrome-untrusted:// then by host (matching upstream's
  `CompareWebuiUrlInfos`), and returns the list alongside the current
  value of `kInternalOnlyUisEnabled`.
- `setDebugPagesEnabled` — sets `kInternalOnlyUisEnabled` directly. This
  pref flip *is* the entire enforcement mechanism (`Chrome
  ContentBrowserClient` reads it on every navigation), so there's no
  further plumbing needed for a page to become reachable.

`App.tsx` renders the internal-only entries from `getChromeUrls` in their
own section, independent of the existing hand-curated groups, and honors
the same `?host=` redirect-after-enable and `#internal-debug-pages`
anchor-scroll behavior upstream's `app.ts` uses — so the disabled-page
interstitial's own "enable it here" link back to this page still lands
in the right spot and can redirect straight through once enabled.

---

## File map

| Path | Purpose |
|---|---|
| `custom/browser/ui/webui/chrome_urls/custom_chrome_urls_handler.{h,cc}` | `getChromeUrls`/`setDebugPagesEnabled` message handler |
| `custom/browser/ui/webui/chrome_urls/custom_chrome_urls_ui.cc` | Registers the handler on the WebUI |
| `custom/components/custom_chrome_urls/App.tsx` | Internal Debugging Page URLs section + enable toggle |
| `custom/components/custom_chrome_urls/cr.ts` | Standard `cr.sendWithPromise`/`addWebUIListener` shim for this component |

---

## Known limitations

- The pref is local-state (machine-wide, not per-profile) — enabling it
  in one profile enables it for all profiles on the install, matching
  upstream's own scope for this pref.
- No confirmation dialog before enabling — internal pages can expose
  process/memory internals not meant for end users, but this fork treats
  that the same way upstream's own toggle does (a single button, no
  extra friction).
