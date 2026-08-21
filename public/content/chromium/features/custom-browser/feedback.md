# Feedback Submission (chrome://feedback)

A real, functional anonymous feedback form — submits directly to
wanderlust-api, not a Google-backed feedback pipeline.

---

## Where to find it

`chrome://feedback`, or via whatever menu entry triggers it (App menu →
Help/Feedback, standard Chromium convention).

---

## What it sends

**Handler:** `CustomFeedbackHandler`
(`custom/browser/ui/webui/feedback/custom_feedback_handler.{h,cc}`).

| Message | Direction | Payload |
|---|---|---|
| `submitFeedback` | JS → C++ (promise) | `(description, contactEmail?)` → `boolean` success |

Request body (JSON, `POST {CUSTOM_OMAHA_PUBLIC_URL}/api/feedback` —
resolves to `https://api.wander-lust.tech/api/feedback`):

```json
{
  "description": "<user-entered text>",
  "url": "<active tab's last-committed URL>",
  "systemInfo": "Wanderlust <version>; <OS name> <OS version>",
  "contactEmail": "<optional, only if the user typed one>"
}
```

The tab URL and system info are gathered **server-side** in the
handler (`Browser::tab_strip_model()->GetActiveWebContents()`, the
build's `CUSTOM_PRODUCT_VERSION`, and OS APIs) — not by JS reading
`window.location` — so the frontend only ever sends the description and
optional email.

Sent via `network::SimpleURLLoader` with `credentials_mode: kOmit` — no
cookies, no auth headers attached. This is genuinely anonymous
submission; the response is just an HTTP status check (2xx → success),
the body isn't parsed.

If the description field is empty, no request is sent at all —
`ResolveJavascriptCallback(callback_id, false)` fires immediately.

---

## Known limitations

- **No screenshot support.** Only description text, the active tab's
  URL, system info, and an optional contact email are ever sent —
  nothing captures or attaches a page/tab image.
- No delivery confirmation beyond a raw HTTP status — no ticket ID,
  no way to follow up on a specific submission.
- The endpoint is a build-time constant
  (`custom_omaha_public_url` in `custom_browser_config.gni`); there's
  no per-environment override at runtime.
