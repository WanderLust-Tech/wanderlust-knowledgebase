# Browser Components

This article walks through the major C++ components that live in the **browser process** (the “embedder” around Blink/V8). Understanding these is key to seeing how Chromium boots up, hosts tabs, and wires together UI, IPC, storage and network.

---

## 1. High-Level Architecture

> **Browser ↔ Renderer**  
> The browser process drives UI, navigation, storage, security, and launches one or more renderer processes. Renderers host the Blink/V8 engines.

```text
+----------------+    Mojo IPC    +-------------+
| Browser        | <------------> | Renderer    |
| process        |                | process     |
+----------------+                +-------------+
Major browser-side modules live under src/chrome/, src/content/, src/net/, and src/components/.

2. Application Startup
BrowserMain

Entry point (chrome/app/chrome_main.cc)

Initializes logging, crash upload (Breakpad/Crashpad), feature flags

ProfileManager

Loads user profile (preferences, bookmarks, extensions)

Creates a Profile object per user data directory

BrowserProcessImpl

Brings up global services:

PrefService (settings)

DownloadService

HistoryService

CookieManager

UI Loop

Creates the BrowserWindow (NativeWindow wrapper)

Begins platform event loop (RunMessageLoop)

3. Tab & Window Management
TabStripModel (chrome/browser/ui/tab_strip_model.cc)

Manages a list of WebContents (each a tab)

Handles adding, removing, reordering, and session restore

Browser (chrome/browser/ui/browser.cc)

High-level controller for a window

Routes commands (New Tab, Close Tab, Navigate) to TabStripModel

WebContents

Represents the content of one “tab”

Owns the RenderProcessHost, NavigationController, and attendants

4. Navigation & Session
NavigationController

Keeps history stack and current URL

Implements back/forward, reload, and session restoration

NavigationRequest (content/browser/loader/navigation_request.cc)

One-per-navigation round-trip: coordinates URLLoader, history update, and commit

SessionService

Periodically writes the list of open tabs/windows to disk for crash recovery

5. Networking & Resource Loading
Network Service (services/network/)

Runs in its own process by default

Handles all HTTP(S), QUIC, caching, proxy resolution

URLLoaderFactory

Factory for network requests, passed over Mojo to renderers

ResourceScheduler

Prioritizes and throttles resource requests (CSS, images, fonts)

6. Storage & State
Profile (chrome/browser/profiles/profile.cc)

Root for per-profile paths (cache, cookies, local storage)

CookieManager (services/network/public/cpp/cookie_manager.cc)

Exposes cookie APIs to renderers over Mojo

Storage Partitions

Each WebContents can have isolated storage for cookies, indexedDB, cache, etc.

7. UI Layer
BrowserView / BrowserFrame

Cross-platform C++ classes wrapping native windows and views

Omnibox (chrome/browser/ui/omnibox/)

URL/address bar, autocomplete popup, suggestion ranking

Toolbar & Menus

Actions (reload, devtools) wired to commands on Browser

8. Extensions & Plugins
Extension System (extensions/)

Manages loading, permissions, lifecycle of Chrome extensions

Injects content scripts into pages via ScriptContext

Plugin Host

Hosts NPAPI or PPAPI plugins in a sandboxed “plugin process”

9. Security & Sandboxing
Site Isolation

Browser enforces “site-per-process” — renderer can only talk to its own site

Permission Model

Chrome’s permission prompts are implemented in the browser (PermissionPrompt UI)

Safe Browsing

Checks URLs against blacklist (SafeBrowsingDatabase), shows interstitials

10. Diagnostics & Metrics
PerformanceManager (chrome/browser/performance_manager/)

Observes WebContents, tracks memory and CPU for background tab throttling

TaskManager

In-browser UI to view per-process resource usage

Tracing & Metrics

chrome://tracing integration, UMA histogram reporting

11. Next Steps
Read Architecture → Process Model to see how browser and renderer interact.

Explore Modules → Networking (HTTP) for full details on the network service.

Dive into Security → Security Model to understand sandbox implementation.

End of Browser Components deep-dive.

markdown
Copy
Edit

**Usage tips:**

- Link each code-path (`chrome/browser/ui/...`, `services/network/…`) to your code‐search viewer.  
- Consider adding a diagram showing major browser services and their IPC channels.  
- Update paths if upstream rearranges folders.