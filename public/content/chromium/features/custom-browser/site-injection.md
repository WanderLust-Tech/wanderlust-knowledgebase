# Site Injection

Per-site CSS and JS injection driven by a user-editable rules directory in the
browser profile. Lets power users apply persistent stylesheet overrides or
run scripts on specific sites without installing an extension.

Gated by `BUILDFLAG(ENABLE_SITE_INJECTION)`.

---

## Build / activation

| Where | What |
|---|---|
| [`custom_browser_config.gni`](../src/custom/custom_browser_config.gni) | `enable_site_injection = true` (default) |
| [`buildflags/BUILD.gn`](../src/custom/buildflags/BUILD.gn) | Emits `BUILDFLAG(ENABLE_SITE_INJECTION)` |
| [`browser/sources.gni`](../src/custom/browser/sources.gni) | Adds `site_injection/` source files to `custom_browser_sources` |
| [`custom_browser_context_keyed_service_factories.cc`](../src/custom/browser/custom_browser_context_keyed_service_factories.cc) | Registers `SiteInjectionServiceFactory` |
| [`chrome/browser/ui/tab_helpers.cc`](../src/chrome/browser/ui/tab_helpers.cc) | `SiteInjectionTabHelper::CreateForWebContents` under the buildflag |

---

## Architecture

```
Profile directory
  └─ site_injection/
       ├─ rules.ini          ← address→file mapping
       ├─ overrides.css      ← payload files (any name)
       └─ fixes.js

SiteInjectionServiceFactory (KeyedService per profile)
  └─ SiteInjectionService
       └─ SiteInjectionManager
            ├─ global_rules_    ← address == "*"
            ├─ domain_rules_    ← address == "*.example.com"  (keyed by eTLD+1)
            └─ host_rules_      ← address == "sub.example.com" (exact)

Every tab:
  SiteInjectionTabHelper (WebContentsObserver)
    ├─ DidFinishNavigation (primary main frame commit)
    │    └─ GetRulesForUrl(url) → inject kAtCommit rules via ExecuteRule()
    │
    └─ DocumentOnLoadCompletedInPrimaryMainFrame
         └─ GetRulesForUrl(committed_url_) → inject kAtDomReady rules via ExecuteRule()

ExecuteRule(rfh, rule):
  CSS → ExecuteJavaScript("(function(){var s=document.createElement('style');
                             s.textContent=<JSON-escaped CSS>;
                             document.documentElement.appendChild(s);}())")
  JS  → ExecuteJavaScript(content)
```

Init is async: the service posts `SiteInjectionManager::InitFromDirectory` to
a `MayBlock` thread-pool task on construction. `GetRulesForUrl` returns an
empty set safely until that task completes (early navigations skip injection,
which is harmless in practice — the rules directory is read in well under a
second on any normal storage).

---

## Rule file format

Rules live in `<profile>/site_injection/`. Create the directory and populate
`rules.ini` to activate the feature; if the directory or file does not exist,
the feature is a no-op.

### `rules.ini`

```ini
# Site Injection Rules
# Lines starting with # are comments. Blank lines are ignored.

[rules]
# Format: <address>  <file>  <type>  <time>
#
#   address  — one of:
#               *                   apply to every page
#               *.example.com       apply to example.com and all subdomains
#               sub.example.com     exact hostname match only
#
#   file     — filename (no path separators) of a CSS or JS file in this
#               same directory. Shared files are loaded once and cached.
#
#   type     — css   inject as a stylesheet
#               js    execute as JavaScript
#
#   time     — commit    inject immediately when the navigation commits
#                        (before the first paint — best for CSS)
#               domready  inject after the load event fires
#                        (full DOM available — best for JS that queries elements)

# Hide the cookie banner on every page.
*                   cookie-banner.css   css   commit

# Override the font stack on all GitHub pages.
*.github.com        github-fonts.css    css   commit

# Remove a specific element only on the exact host.
legacy.example.com  cleanup.css         css   commit

# Inject a helper script after the page is fully loaded.
app.example.com     helpers.js          js    domready
```

### Rules are matched in order of specificity

`GetRulesForUrl` accumulates rules in three passes, in this order:

1. **Global rules** (`*`) — applied to every page.
2. **Domain-wildcard rules** (`*.example.com`) — matched by eTLD+1
   (`example.com`). Both `example.com` and `sub.example.com` match
   `*.example.com`.
3. **Exact-host rules** (`sub.example.com`) — matched by the full hostname.

All three sets are appended, so a page can receive rules from all three passes
simultaneously.

### Payload files

Place any `.css` or `.js` file alongside `rules.ini`. No subdirectory support —
filenames must be plain names (no `/`, `\`, or `..`). The manager rejects
path-traversal attempts with a `DLOG(WARNING)` and skips the rule.

Each file is read once and cached in memory for the lifetime of the service
(per-profile, per-session). Edits to payload files take effect after the
browser restarts or the profile reloads.

**Size limit:** 1 MB per payload file. Files exceeding this are silently skipped.

---

## C++ components

### `SiteInjectionManager`

[`src/custom/browser/site_injection/site_injection_manager.h`](../src/custom/browser/site_injection/site_injection_manager.h)
[`src/custom/browser/site_injection/site_injection_manager.cc`](../src/custom/browser/site_injection/site_injection_manager.cc)

Parses `rules.ini`, loads payload files, and answers `GetRulesForUrl(GURL)`
queries. All state is written once during `InitFromDirectory`, then read-only.
Thread safety is achieved via `std::atomic<bool> loaded_` with
acquire/release semantics — see the comment in the header for the invariant.

| Method | Description |
|---|---|
| `InitFromDirectory(FilePath)` | Reads `rules.ini` and all referenced payload files. Sets `loaded_ = true` when done (or on any read error — the manager is always considered "ready" after this call returns). Must be called on a thread that allows blocking I/O. |
| `GetRulesForUrl(GURL)` | Returns matching rules for the given URL. Returns empty before init completes. Read-only and thread-safe after `loaded_` is true. |
| `is_loaded()` | Acquire-load of `loaded_`. |

### `SiteInjectionService`

[`src/custom/browser/site_injection/site_injection_service.h`](../src/custom/browser/site_injection/site_injection_service.h)
[`src/custom/browser/site_injection/site_injection_service.cc`](../src/custom/browser/site_injection/site_injection_service.cc)

`KeyedService` wrapper owning the manager. Constructor posts
`InitFromDirectory` to a `USER_BLOCKING` `MayBlock` thread-pool task.
Exposes `GetRulesForUrl(GURL)` which delegates directly to the manager.

### `SiteInjectionServiceFactory`

[`src/custom/browser/site_injection/site_injection_service_factory.h`](../src/custom/browser/site_injection/site_injection_service_factory.h)
[`src/custom/browser/site_injection/site_injection_service_factory.cc`](../src/custom/browser/site_injection/site_injection_service_factory.cc)

Standard `BrowserContextKeyedServiceFactory`. Passes
`profile->GetPath().AppendASCII("site_injection")` as the rules directory.
Each profile (including OTR) gets its own independent service and rule set.

### `SiteInjectionTabHelper`

[`src/custom/browser/site_injection/site_injection_tab_helper.h`](../src/custom/browser/site_injection/site_injection_tab_helper.h)
[`src/custom/browser/site_injection/site_injection_tab_helper.cc`](../src/custom/browser/site_injection/site_injection_tab_helper.cc)

`WebContentsUserData<SiteInjectionTabHelper>` + `WebContentsObserver`.
Attached to every tab by `TabHelpers::AttachTabHelpers`. Looks up the
profile's `SiteInjectionService` on each relevant navigation event and
dispatches injection via `RenderFrameHost`.

| Override | Fires when | Injects |
|---|---|---|
| `DidFinishNavigation` | Primary main frame commits (non-same-doc) | `kAtCommit` rules for the new URL |
| `DocumentOnLoadCompletedInPrimaryMainFrame` | `load` event fires on the primary main frame | `kAtDomReady` rules for `committed_url_` |

Same-document navigations (hash changes, pushState) do **not** re-inject —
the document is unchanged so CSS already applied persists and re-running JS
would likely cause duplicate side-effects.

---

## Threading

| Thread | What happens |
|---|---|
| UI thread | `SiteInjectionService` constructed; `SiteInjectionTabHelper` created; `GetRulesForUrl` and all injection calls happen here |
| Thread pool (`MayBlock`) | `SiteInjectionManager::InitFromDirectory` — file reads, parsing, map population, then `loaded_.store(release)` |

The thread pool task holds a raw pointer to the manager (`base::Unretained`).
This is safe because `SiteInjectionService` outlives the task: `KeyedService`
shutdown happens at profile teardown, and `TaskShutdownBehavior::SKIP_ON_SHUTDOWN`
ensures the task is dropped (not run) if shutdown races the init.

---

## File map

| Path | Role |
|---|---|
| [`src/custom/browser/site_injection/site_injection_manager.h/.cc`](../src/custom/browser/site_injection/site_injection_manager.cc) | Rule loader, URL matcher, payload cache |
| [`src/custom/browser/site_injection/site_injection_service.h/.cc`](../src/custom/browser/site_injection/site_injection_service.cc) | `KeyedService` wrapper; async init |
| [`src/custom/browser/site_injection/site_injection_service_factory.h/.cc`](../src/custom/browser/site_injection/site_injection_service_factory.cc) | Profile-scoped factory; routes to `<profile>/site_injection/` |
| [`src/custom/browser/site_injection/site_injection_tab_helper.h/.cc`](../src/custom/browser/site_injection/site_injection_tab_helper.cc) | `WebContentsObserver`; dispatches `InsertCSS` / `ExecuteJavaScript` on commit and load |
| [`src/custom/custom_browser_config.gni`](../src/custom/custom_browser_config.gni) | `enable_site_injection = true` |
| [`src/custom/buildflags/BUILD.gn`](../src/custom/buildflags/BUILD.gn) | `ENABLE_SITE_INJECTION` buildflag |
| [`src/custom/browser/sources.gni`](../src/custom/browser/sources.gni) | Adds source files to `custom_browser_sources` |
| [`src/custom/browser/custom_browser_context_keyed_service_factories.cc`](../src/custom/browser/custom_browser_context_keyed_service_factories.cc) | Registers `SiteInjectionServiceFactory` |
| [`src/chrome/browser/ui/tab_helpers.cc`](../src/chrome/browser/ui/tab_helpers.cc) | `SiteInjectionTabHelper::CreateForWebContents` |
| [`src/custom/patches/chrome-browser-ui-tab_helpers.cc.patch`](../src/custom/patches/chrome-browser-ui-tab_helpers.cc.patch) | Patch record of the `tab_helpers.cc` change |

---

## Known gaps / future work

| Item | Notes |
|---|---|
| Settings UI | No browser UI to view or edit injection rules yet. Rules must be managed manually in the profile directory. A settings page (similar to the `chrome://settings` privacy page) could list active rules and allow toggling/adding/removing entries without touching the filesystem directly. |
| Hot reload | Rule changes require a browser restart. A `FilePathWatcher` on `rules.ini` could trigger `SiteInjectionManager::ReloadFromDirectory` and notify open tab helpers to re-inject on the current page. |
| Sub-frame injection | `DidFinishNavigation` is only acted upon for the primary main frame. Sub-frames that match a rule are not injected into. This is intentional for now — injecting into cross-origin frames raises security concerns. |
| Same-document navigations | Hash changes and `pushState` navigations are explicitly skipped. Single-page apps that make significant DOM changes on `pushState` will not get re-injection. A `DOMContentLoaded`-equivalent MutationObserver in injected JS can work around this at the user script level. |
| `*.` wildcard depth | `*.example.com` matches any subdomain via eTLD+1 comparison. A rule for `*.co.uk` would match everything on `co.uk` — be careful with short eTLDs. The manager uses `INCLUDE_PRIVATE_REGISTRIES` which handles most PSL edge cases. |
| Rule ordering | Within each pass (global / domain / host), rules are applied in the order they appear in `rules.ini`. There is no explicit priority or conflict resolution beyond this. |
| No per-rule enable/disable | Rules are either in `rules.ini` or not. A `disabled` field or comment-out convention would improve usability. |
