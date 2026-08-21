# What's New Feed (chrome://whats-new)

A real, server-backed feature-announcement feed — fetches from
wanderlust-api directly, with a hardcoded client-side fallback if that
fetch fails.

---

## Architecture

**Controller/handler:** `CustomWhatsNewUI` / `CustomWhatsNewHandler`
(`custom/browser/ui/webui/whats_new/custom_whats_new_{ui,handler}.{h,cc}`).
Host: `kChromeUICustomWhatsNewHost = "whats-new"`. No dedicated GN flag.

**Endpoint:** a real `network::SimpleURLLoader` GET to
`{CUSTOM_OMAHA_PUBLIC_URL}/api/whatsnew?appId={CUSTOM_WINDOWS_APP_GUID}`
— resolves to `https://api.wander-lust.tech/api/whatsnew?appId=...` in
a stock build. Runs browser-side, so it isn't subject to the page's own
CSP/CORS restrictions. Sent with `credentials_mode: kOmit`; response
capped at 64KB.

| Message | Purpose |
|---|---|
| `getWhatsNewEntries` | Triggers the fetch; resolves with the entry list |

---

## Fallback behavior

On any failure — network error, non-200 status, malformed JSON, or an
empty `data` array — `OnEntriesFetched` resolves with an **empty list**,
not an error. The hardcoded fallback entries are supplied by the
**frontend**, not this handler: the React app shows its own baked-in
content when it receives an empty list back.

---

## When it's shown

There's no "once per version" gating logic in the handler — this is a
fetch-on-visit page. Every time `chrome://whats-new` loads,
`getWhatsNewEntries` fires and re-fetches; it isn't an auto-shown
startup/NTP surface.

---

## Known limitations

- No caching — every page load re-fetches from the network (or falls
  back) rather than remembering the last successful response.
- No per-user read/dismissed state; the feed is stateless.
