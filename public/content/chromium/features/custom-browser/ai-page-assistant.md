# AI Page Assistant

A read-only chat assistant that can see the current tab's visible text and
answer questions about it, backed by the Claude API. Accessible from the
**AI Page Assistant** button in the sidebar top pane (`chrome://sidebar/agent`).

This is a deliberately scoped-down v1 of a much larger "AI Agentic Browsing"
proposal that asked for autonomous multi-step web automation (form filling,
cross-site workflows, clicking/typing on the user's behalf). None of that
infrastructure exists in this fork — there's no accessibility-tree or
DevTools-Protocol automation layer to build on, and a real per-action
safety/confirmation model is its own project. v1 answers questions about a
page; it cannot act on one.

## Build flag

Gated by `BUILDFLAG(ENABLE_AI_AGENT)`. Controlled by `enable_ai_agent = true` in
[`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni).
Also requires `BUILDFLAG(ENABLE_SIDEBAR)` — the assistant is surfaced
exclusively through the sidebar panel.

## Architecture

```
SidebarTopPane (AGENT_BUTTON)
  └─ SidebarContainerView::TopPaneButtonPressed(TYPE_AGENT)
       └─ LoadURL(kChromeUISidebarAgentURL)
            └─ AgentDOMHandler
                 ├─ ExecuteJavaScript(kPageExtractionScript) on the active
                 │    tab's main frame — extracts visible text, browser-side
                 └─ AiAgentServiceFactory → AiAgentService
                      └─ AiAgentClient
                           └─ POST https://api.anthropic.com/v1/messages
```

No renderer-side network access is involved: the WebUI's JS only ever calls
`chrome.send('agentSendMessage', ...)`. Page-content extraction and the
Claude HTTPS call both happen in the browser process in C++, so no CSP
changes were needed for this feature.

## C++ service — `AiAgentService`

[`src/custom/browser/ai_agent/ai_agent_service.h`](../src/custom/browser/ai_agent/ai_agent_service.h)
[`src/custom/browser/ai_agent/ai_agent_service.cc`](../src/custom/browser/ai_agent/ai_agent_service.cc)

A `KeyedService` per profile. Holds the Claude API key (read from prefs on
each send, not cached) and the chat transcript (`std::vector<ChatTurn>`,
**in-memory only** — see "Known v1 simplifications" below).

| Method | Description |
|---|---|
| `RegisterProfilePrefs(registry)` | Registers `ai_agent.api_key` (string, default empty). |
| `SendMessage(user_text, page_context, callback)` | Builds the full transcript + new turn, calls `AiAgentClient::SendMessage`. On success, appends both the user turn and the assistant reply to `history_`. |
| `GetHistory()` | Returns the in-memory transcript. |
| `ClearHistory()` | Empties the transcript. |

## HTTP client — `AiAgentClient`

[`src/custom/browser/ai_agent/ai_agent_client.h`](../src/custom/browser/ai_agent/ai_agent_client.h)
[`src/custom/browser/ai_agent/ai_agent_client.cc`](../src/custom/browser/ai_agent/ai_agent_client.cc)

Calls the Claude Messages API directly, mirroring
[`PageNotesBackendClient`](page-notes)'s `SimpleURLLoader` shape:

```
POST https://api.anthropic.com/v1/messages
  x-api-key: <key>
  anthropic-version: 2023-06-01
  content-type: application/json

  {
    "model": "claude-sonnet-5",
    "max_tokens": 2048,
    "system": "<read-only assistant system prompt>",
    "messages": [
      { "role": "user" | "assistant", "content": "..." },
      ...
      { "role": "user", "content": "<page URL/title/text>\n---\n<question>" }
    ]
  }
```

- Page text is truncated to ~15,000 characters (character count, not
  token-aware) before being folded into the latest user turn.
- `net::LOAD_DISABLE_CACHE | net::LOAD_DO_NOT_SAVE_COOKIES`, 2 retries on
  network change, 2 MB response cap.
- HTTP 401 → "rejected the configured API key"; 429 → rate-limit message;
  5xx → "temporarily unavailable"; the Claude API's own `error.message`
  field is used when present, overriding the generic message.
- Response parsing concatenates every `{"type":"text","text":"..."}` block
  in the `content` array (Claude can return multiple text blocks).

## Factory — `AiAgentServiceFactory`

[`src/custom/browser/ai_agent/ai_agent_service_factory.h`](../src/custom/browser/ai_agent/ai_agent_service_factory.h)

Standard `BrowserContextKeyedServiceFactory`, no dependencies (mirrors
`RSSServiceFactory`). Registered in
[`EnsureBrowserContextKeyedServiceFactoriesBuilt`](../src/custom/browser/custom_browser_context_keyed_service_factories.cc)
under `BUILDFLAG(ENABLE_AI_AGENT)`.

## IPC — `AgentDOMHandler`

[`src/custom/browser/ui/webui/sidebar/agent_dom_handler.h`](../src/custom/browser/ui/webui/sidebar/agent_dom_handler.h)
[`src/custom/browser/ui/webui/sidebar/agent_dom_handler.cc`](../src/custom/browser/ui/webui/sidebar/agent_dom_handler.cc)

Kept as its own `WebUIMessageHandler` class rather than folded into the
existing `SidebarDOMHandler` — the agent's backend work (async external
HTTP round-trips, page-content extraction, an in-memory transcript) is
qualitatively different from the other panes' local KeyedService
read/observe pattern. Registered alongside `SidebarDOMHandler` in
`SidebarUI`'s constructor.

### Writes — `chrome.send(name, args)`

| Message | Args | Effect |
|---|---|---|
| `agentSendMessage` | `[userText]` | Resolves the active tab via `chrome::FindBrowserWithProfile`, runs the extraction script on its main frame, then calls `AiAgentService::SendMessage`. Fire-and-forget — the reply arrives via a listener event. |
| `agentClearHistory` | — | Clears the transcript. |

### Reads — `cr.sendWithPromise(name, ...args)`

| Message | Args | Resolves with |
|---|---|---|
| `agentGetHistory` | — | `ChatMessage[]` — the current in-memory transcript, so reopening the pane shows prior turns. |

### Listener events — `cr.addWebUIListener(name, fn)`

| Event | Payload | Sent when |
|---|---|---|
| `agentResponseReady` | `text: string` | Claude replied successfully. |
| `agentError` | `message: string` | No active tab to read from, the service is unavailable, or the Claude API call failed (missing/invalid key, rate limit, network error, etc). |

### Page-text extraction script

`kPageExtractionScript` (a `const char[]` constant in `agent_dom_handler.cc`,
same idiom as `kRSSTagInspectionScript` in `rss_tab_helper.cc`) clones
`document.body`, strips `<script>`/`<style>`/`<nav>`/`<noscript>`, reads
`innerText`, and caps the result at 20,000 characters. It's a simple
text-strip, not a Readability-grade distiller — good enough for
"summarize/ask about this page," not trying to be more than that.

## React component — `AgentPage`

[`src/custom/components/custom_sidebar/pages/AgentPage.tsx`](../src/custom/components/custom_sidebar/pages/AgentPage.tsx)
[`src/custom/components/custom_sidebar/hooks/useAgentChat.ts`](../src/custom/components/custom_sidebar/hooks/useAgentChat.ts)

Message list (auto-scrolls to the latest turn) + input textarea (Enter to
send, Shift+Enter for a newline) + a "Thinking…" indicator shown between
`agentSendMessage` and the matching `agentResponseReady`/`agentError`
event. `useAgentChat` restores the transcript via `agentGetHistory` on
mount and subscribes to both listener events for the lifetime of the pane.

## Native integration

### `SidebarService::Type`

[`sidebar_service.h`](../src/custom/browser/sidebar/sidebar_service.h):

```cpp
TYPE_AGENT = 8,
```

Appended (never inserted/renumbered — the value is persisted in the
`sidebar.type` pref).

### `SidebarTopPane` button

[`sidebar_top_pane.h/.cc`](../src/custom/browser/ui/views/frame/):

- `AGENT_BUTTON = 11` in the `ButtonKind` enum.
- `agent_button_` — themed vector icon (`kChatSparkIcon` from
  `components/vector_icons/vector_icons.h`) rather than a static raster
  icon, so it re-colors correctly on a light/dark theme switch without an
  `OnThemeChanged` hook — same pattern as the dock-toggle button.
- Tooltip: `IDS_TOOLTIP_SIDEBAR_AGENT` ("AI Page Assistant").
- Positioned after the NTP-settings button, before the blank drag-grip gap
  and the fixed bottom cluster (dock-toggle / expand-collapse / options).

### `SidebarContainerView::TopPaneButtonPressed`

```cpp
case sidebar::SidebarService::TYPE_AGENT:
  ResetWebViewIfNeeded();
  LoadURL(GURL(custom::kChromeUISidebarAgentURL));
  break;
```

## Known v1 simplifications (deliberate, not oversights)

- **API key stored in plaintext prefs** (`ai_agent.api_key`). Real Chromium
  secret storage (saved passwords, etc.) uses `OSCrypt`; a v1 text pref is
  the same complexity tradeoff every other feature in this fork has made.
  Set via the **AI** settings page (`AiPage.tsx`, a `type="password"` field
  under the "AI Page Assistant" section) — no C++ changes were needed for
  this, since the settings UI already has a generic pref bridge
  (`customGetPrefs`/`customSetPref`/`customObservePrefs` in
  `custom_settings_handler.cc`, wrapped by the `usePref<T>()` React hook)
  that works for any registered pref by key, with no per-feature allowlist.
- **Chat transcript is in-memory only, never persisted to disk.** It
  contains full page text sent to Claude, and persisting it would be a
  second, larger plaintext-secret-adjacent surface beyond the API key
  itself. Clears on tab navigation is *not* implemented — only on browser
  shutdown or an explicit "Clear" click; the transcript is shared across
  whatever page the user asks about next in the same session.
- **No streaming.** One request → one full response per turn, with a
  "Thinking…" indicator. True token-by-token streaming needs a different,
  lower-level `SimpleURLLoader` API (parsing partial SSE chunks) for
  marginal v1 UX gain.
- **Extraction is a simple text-strip script, not Readability-grade.**
  See "Page-text extraction script" above.
- **Read-only.** No DOM interaction, no automation, no per-action
  confirmation UI — none of that infrastructure exists yet in this fork.
  The system prompt explicitly tells Claude to decline action requests and
  explain that it can only read and discuss the current page.

## Beyond v1 — other options for AI agentic browsing

The original "AI Agentic Browsing" proposal asked for a lot more than a
read-only Q&A pane: autonomous multi-step web automation (form filling,
cross-site workflows), a contextual task queue running in the background,
proactive suggestions based on browsing patterns, and a developer-facing
API/webhook layer for external integrations. None of that is implemented,
and most of it isn't a small extension of what's here — it's a different
project. This section records the real options along each axis, so a
future phase starts from an informed choice rather than re-deriving them.

### Capability level

| Option | Description | Tradeoff |
|---|---|---|
| **Read-only (chosen for v1)** | Answers questions about the current page; cannot act on it. | Zero automation risk, but doesn't touch most of the original proposal's use cases (expense reports from emails, multi-site price comparison, etc). |
| **Semi-automated** | The assistant proposes a concrete action (click this, fill this field with that value); the user reviews and confirms each one before it executes. | Closer to the proposal's value, but needs a real per-action preview/confirmation UI — showing *what* will happen before it happens is most of the engineering effort, not the automation itself. |
| **Fully autonomous** | Executes multi-step plans without per-action confirmation, only a high-level "go" from the user. | What the proposal actually describes. Highest value, highest risk — a bug or a prompt-injected page can take real actions (submit forms, navigate to attacker-controlled pages, leak page content to further requests) with no human in the loop. Would need a strong sandboxing/permission model before this is defensible. |

### Automation mechanism (needed for semi-automated or fully autonomous)

None of these exist in this fork today; all three are real options for a
Chromium-based browser specifically:

- **Accessibility tree walking** (`content::BrowserAccessibility` /
  `ui::AXTree`) — Chromium already builds a full accessibility tree for
  every page for screen readers. Walking it gives element roles, labels,
  and bounding boxes without injecting any script into the page, and
  degrades gracefully on odd/legacy sites. Anthropic's own "computer use" /
  browser agent work is built on a similar accessibility-first approach.
  This is the most natural fit for a Chromium fork since the tree is
  already maintained by the engine for other purposes.
- **DevTools Protocol (CDP)** — `content::DevToolsAgentHost` already
  exists in Chromium and gives full `Input.dispatchMouseEvent`/
  `Input.dispatchKeyEvent`/`DOM.*`/`Runtime.evaluate` control, which is
  what Puppeteer/Playwright use externally. Embedding a CDP client
  in-process (rather than the usual out-of-process debugging use) is more
  invasive of Chromium's security model — CDP access is normally gated
  behind an explicit debugging flag for good reason — but gives the most
  automation power.
- **Content-script injection** (`ExecuteJavaScript`, what
  `kPageExtractionScript` already does for read-only extraction) —
  simplest to build on since the plumbing already exists, but a
  content-script-based automation layer is the easiest for a malicious or
  adversarially-crafted page to detect and fight back against (overriding
  `document.querySelector`, feeding poisoned data back), and every action
  primitive (click, type, submit) has to be hand-rolled in JS rather than
  reusing Chromium's own input-dispatch code.

### LLM backend

| Option | Status |
|---|---|
| **Claude API (chosen)** | Direct HTTPS call from the browser process, per-token billing via an Anthropic Console API key. See "Known gaps" below for the OAuth-subscription alternative that was considered and skipped. |
| **On-device model** | Explicitly disabled fork-wide — see [`de-googling.md`](de-googling) for why `optimization_guide`'s on-device model path is turned off in this browser. Reversing that decision is its own project, not something this feature should do unilaterally. |
| **Other cloud providers (OpenAI, Gemini, etc.)** | Not implemented. `AiAgentClient` is Claude-specific (message format, auth headers); supporting another provider would mean either a second client class or an abstraction layer over both — not worth building until there's a concrete reason to support more than one provider. |

### UI surface

| Option | Status |
|---|---|
| **Sidebar pane (chosen)** | Reuses the existing sidebar-pane pattern (button → route → WebContents), consistent with Bookmarks/History/RSS/Notes/NTP-Settings. |
| **Omnibox-integrated command** (e.g. typing "@ai" in the address bar) | Would need new omnibox provider infrastructure; not attempted. |
| **Dedicated tab/page** (`chrome://ai-assistant`) | Would lose the "glance at this while reading the page" quality of a sidebar pane docked alongside the content. |
| **Command palette / quick-action overlay** | Would need a new overlay UI primitive that doesn't currently exist in this fork. |

## File map

| Path | Role |
|---|---|
| `src/custom/browser/ai_agent/ai_agent_types.h/.cc` | `ChatTurn`, `PageContext`, `AgentResponse` structs |
| `src/custom/browser/ai_agent/ai_agent_client.h/.cc` | Claude Messages API HTTP client |
| `src/custom/browser/ai_agent/ai_agent_service.h/.cc` | KeyedService — API key + in-memory transcript |
| `src/custom/browser/ai_agent/ai_agent_service_factory.h/.cc` | BCKF — profile scoping |
| `src/custom/browser/ui/webui/sidebar/agent_dom_handler.h/.cc` | 3 message handlers + page-extraction script |
| `src/custom/browser/ui/webui/sidebar/sidebar_ui.cc` | Registers `AgentDOMHandler` alongside `SidebarDOMHandler` |
| `src/custom/common/custom_pref_names.h` | `kAiAgentApiKey = "ai_agent.api_key"` |
| `src/custom/common/webui_url_constants.h` | `kChromeUISidebarAgentURL = "chrome://sidebar/agent"` |
| `src/custom/browser/sidebar/sidebar_service.h` | `TYPE_AGENT = 8` |
| `src/custom/browser/ui/views/frame/sidebar_top_pane.h/.cc` | `AGENT_BUTTON`, `agent_button_`, layout + selection |
| `src/custom/browser/ui/views/frame/sidebar_container_view.cc` | `TYPE_AGENT` → `LoadURL` |
| `src/custom/browser/sources.gni` | Adds `ai_agent/*` source files |
| `src/custom/browser/ui/BUILD.gn` | Adds `agent_dom_handler.cc/.h` under `enable_sidebar` + `enable_ai_agent` |
| `src/custom/browser/custom_browser_context_keyed_service_factories.cc` | Registers `AiAgentServiceFactory` |
| `src/chrome/browser/prefs/browser_prefs.cc` (patched) | Calls `AiAgentService::RegisterProfilePrefs` |
| `src/custom/custom_browser_config.gni` | `enable_ai_agent = true`; `ENABLE_AI_AGENT` branding flag |
| `src/custom/buildflags/BUILD.gn` | `ENABLE_AI_AGENT=$enable_ai_agent` |
| `src/custom/app/generated_resources.grdp` | `IDS_TOOLTIP_SIDEBAR_AGENT` |
| `src/custom/components/custom_sidebar/types.ts` | `'agent'` added to `SidebarRoute`; `ChatMessage` interface |
| `src/custom/components/custom_sidebar/App.tsx` | `agent` route detection + `<AgentPage />` render |
| `src/custom/components/custom_sidebar/pages/AgentPage.tsx` | React component — message list + input |
| `src/custom/components/custom_sidebar/hooks/useAgentChat.ts` | Chat state — send/clear, listener subscriptions |
| `src/custom/components/custom_settings/components/AiPage.tsx` | Settings-page API key field (`type="password"`, via `usePref`) |

## Known gaps / future work

| Item | Notes |
|---|---|
| Streaming responses | Would need a lower-level `SimpleURLLoader` SSE-parsing path. |
| Persisted transcript | Deliberately not implemented — see "Known v1 simplifications." Could be added per-tab with an explicit "this history contains page content sent to an external API" disclosure. |
| Per-tab transcript scoping | The transcript is currently one flat list for the whole profile, not scoped per tab/URL. Switching tabs doesn't clear or separate the conversation. |
| Automation / action-taking | Out of scope for v1 entirely — see "Known v1 simplifications." A future phase would need an accessibility-tree or DevTools-Protocol layer plus a real per-action confirmation model. |
| Readability-grade extraction | Current extraction is a blunt text-strip; a proper distiller (or reusing Reader Mode's existing distillation pipeline) would produce cleaner input for long/complex pages. |
| OAuth "sign in with Claude" instead of an API key | Considered and deliberately skipped. There's no public API for replaying a logged-in claude.ai web session (cookie-based, not meant for third-party replay). Claude Code / Claude Desktop authenticate Pro/Max subscribers via an OAuth flow that avoids per-token billing, but that's Anthropic's own first-party client auth, not a published third-party integration API — reusing it here would mean depending on an undocumented protocol that could change without notice and sits in a legal gray area for a non-Anthropic app. The API key stays the only supported auth path unless Anthropic publishes a real third-party OAuth flow. |
