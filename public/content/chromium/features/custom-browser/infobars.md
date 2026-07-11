# Custom HTML infobars

Gated by `BUILDFLAG(CUSTOM_EXTENSION_INFOBAR)`. Two callers can drop a
horizontal HTML panel above a tab's content area:

1. **Extensions** via `chrome.infobars.show({tabId, path, height})` — public
   extension API that mirrors the Brave/Vivaldi/historical-Chrome `infobars`
   namespace.
2. **Browser-side C++** via `custom::CustomInfobarDelegate::Create(...)` —
   used by anything in the browser process that wants to drop a banner
   without going through the extension layer.

Both paths land on the same Views renderer (`CustomInfobar`), which embeds
a plain `WebContents` inside `InfoBarView` via `views::WebView`. There is
intentionally no per-page chrome rendered by C++ — icons, buttons, copy,
and dismiss controls all live inside the caller's HTML.

## Build / activation

| Where | What |
|---|---|
| [`custom_browser_config.gni`](../src/custom/custom_browser_config.gni) | `custom_extension_infobar = true` — gates source compilation and the extension API surface |
| [`branding_buildflags.h`](../src/custom/custom_browser_config.gni) | Emits `BUILDFLAG(CUSTOM_EXTENSION_INFOBAR)` for `#if`-gating |
| Sources (delegate) | [`browser/sources.gni`](../src/custom/browser/sources.gni) — `custom/browser/infobars/custom_infobar_delegate.{cc,h}` join `custom_browser_sources`, rebased into the chrome/browser target |
| Sources (view) | [`browser/ui/sources.gni`](../src/custom/browser/ui/sources.gni) — `custom/browser/ui/views/infobars/custom_infobar.{cc,h}` join `custom_browser_ui_sources`, rebased into the chrome/browser/ui target |
| Sources (extension API) | [`browser/extensions/api/infobars/BUILD.gn`](../src/custom/browser/extensions/api/infobars/BUILD.gn) — its own `source_set("infobars")` is pulled in from [`chrome/browser/extensions/BUILD.gn`](../src/chrome/browser/extensions/BUILD.gn) under `if (custom_extension_infobar)` |
| IDL | [`custom/common/extensions/api/infobars.json`](../src/custom/common/extensions/api/infobars.json) (schema) + [`_infobars_api_features.json`](../src/custom/common/extensions/api/_infobars_api_features.json) (context restrictions) + [`_permission_features.json`](../src/custom/common/extensions/api/_permission_features.json) (permission registration) |
| Function registration | The codegen target `//custom/browser/extensions/api:generated_api_registration` produces a function table; `CustomExtensionsBrowserAPIProvider::RegisterExtensionFunctions` calls `api::CustomGeneratedFunctionRegistry::RegisterAll`, which the upstream `ExtensionsBrowserClient` pulls in |

## Architecture

```
                  EXTENSION PATH                                INLINE PATH
                  ──────────────                                ───────────
   chrome.infobars.show({tabId, path, height})       custom::CustomInfobarDelegate::Create(
     │  (from extension JS / popup / service worker)    web_contents, url, height,
     │                                                  base::OnceClosure on_dismiss)
     │
     ▼
   InfobarsShowFunction::Run
     │ (json_schema_compiler bindings unpack args)
     │ resolves tabId → WebContents via ExtensionTabUtil
     │ builds chrome-extension://<id>/<path> GURL
     │
     └──────────────────────────────┬─────────────────────────────────────┘
                                    ▼
                custom::CustomInfobarDelegate::Create
                  │
                  │  - looks up tab's ContentInfoBarManager
                  │  - if missing (system WebContents) → nullptr
                  │  - constructs CustomInfobarDelegate
                  │     │ creates an off-screen WebContents in the tab's
                  │     │ BrowserContext (initially_hidden=true), loads URL
                  │     │ clamps height into [kMinHeight=0, kMaxHeight=72],
                  │     │ kDefaultHeight=36 when caller passes 0
                  │  - calls CreateInfoBar(delegate)
                  │     │ extern decl resolves to
                  │     │ custom::CreateCustomInfobarView()
                  │     │ which constructs a CustomInfobar (InfoBarView subclass)
                  │  - manager->AddInfoBar(infobar)
                  │     │ InfoBarManager fires OnInfoBarAdded → InfoBarContainer
                  │     │ InfoBarContainerView::PlatformSpecificAddInfoBar
                  │     │   static_cast<InfoBarView*>(infobar) → AddChildViewAt
                  │
                  ▼
        CustomInfobar (subclass of InfoBarView)
          │
          │ ViewHierarchyChanged on first attach:
          │   - builds views::WebView(browser_context)
          │   - WebView->SetWebContents(delegate->hosted_web_contents())
          │   - AddChildView(web_view)
          │
          │ Layout(PassKey):
          │   - LayoutSuperclass<InfoBarView>(this)  ← positions icon + close X
          │   - web_view_->SetSize(GetEndX() - GetStartX(), delegate->height())
          │   - web_view_->SetPosition(GetStartX(), OffsetY(web_view_))
          │     OffsetY handles the slide-in animation
          ▼
        InfoBarView paints background + close (X) button
        WebView renders the WebContents
```

## File map

### Inline browser-side API

| File | Purpose |
|---|---|
| [`custom/browser/infobars/custom_infobar_delegate.h`](../src/custom/browser/infobars/custom_infobar_delegate.h) | Public surface — `CustomInfobarDelegate::Create()` factory, height constants `kMinHeight`/`kMaxHeight`/`kDefaultHeight`, `DismissCallback` alias |
| [`custom/browser/infobars/custom_infobar_delegate.cc`](../src/custom/browser/infobars/custom_infobar_delegate.cc) | Implementation. Builds off-screen `WebContents`, loads URL, attaches to `ContentInfoBarManager`. Calls extern-declared `CreateCustomInfobarView()` so the delegate target stays free of views deps |

### Views renderer

| File | Purpose |
|---|---|
| [`custom/browser/ui/views/infobars/custom_infobar.h`](../src/custom/browser/ui/views/infobars/custom_infobar.h) | `CustomInfobar` class — extends `InfoBarView`, overrides `Layout(PassKey)` / `ViewHierarchyChanged` / `GetContentMinimumWidth` |
| [`custom/browser/ui/views/infobars/custom_infobar.cc`](../src/custom/browser/ui/views/infobars/custom_infobar.cc) | Renderer. Also defines the free function `CreateCustomInfobarView()` that the delegate calls via `extern` — keeps the delegate target free of `//ui/views` deps; linker resolves at link time |

### Extension API

| File | Purpose |
|---|---|
| [`custom/common/extensions/api/infobars.json`](../src/custom/common/extensions/api/infobars.json) | IDL — `chrome.infobars.show({tabId, path, height})`. `height` is optional, clamped to [0,72] by the schema (bindings reject values outside that range before they reach C++) |
| [`custom/common/extensions/api/_infobars_api_features.json`](../src/custom/common/extensions/api/_infobars_api_features.json) | Context whitelist — available in `privileged_extension` contexts (background SW / popups / extension pages) + a specific `https://*.wander-lust.tech/` web origin |
| [`custom/common/extensions/api/_permission_features.json`](../src/custom/common/extensions/api/_permission_features.json) | Permission registration — `"infobars"` is `channel: stable`, no allowlist |
| [`custom/browser/extensions/api/infobars/infobars_extension_api.{h,cc}`](../src/custom/browser/extensions/api/infobars/infobars_extension_api.cc) | `InfobarsShowFunction::Run()` — resolves tab, builds `chrome-extension://` URL, hands off to `CustomInfobarDelegate::Create` |
| [`custom/browser/extensions/api/infobars/BUILD.gn`](../src/custom/browser/extensions/api/infobars/BUILD.gn) | `source_set("infobars")` — `check_includes = false`; the cross-target `custom/browser/infobars/...` include is linker-resolved through the chrome/browser dep chain |

## Inline API reference

```cpp
// custom/browser/infobars/custom_infobar_delegate.h
namespace custom {

class CustomInfobarDelegate : public infobars::InfoBarDelegate {
 public:
  using DismissCallback = base::OnceClosure;

  static infobars::InfoBar* Create(content::WebContents* tab_web_contents,
                                   const GURL& url,
                                   int height,
                                   DismissCallback on_dismiss);

  static constexpr int kMinHeight = 0;
  static constexpr int kMaxHeight = 72;
  static constexpr int kDefaultHeight = 36;
};

}  // namespace custom
```

Typical use:

```cpp
custom::CustomInfobarDelegate::Create(
    tab_web_contents,
    GURL("chrome://my-prompt/"),
    /*height=*/40,
    base::BindOnce(&MyOwner::OnInfobarDismissed,
                   weak_factory_.GetWeakPtr()));
```

Semantics:

- Returns the new `InfoBar*` on success, **`nullptr` if the tab has no
  `ContentInfoBarManager`** (e.g. a system/service `WebContents`). Don't
  delete the returned pointer; ownership flows to the InfoBarManager.
- `url` can be any scheme the browser process can load — `chrome://`,
  `chrome-extension://`, `chrome-untrusted://`, `data:`, `https://`. The
  page renders inside an off-screen `WebContents` that the views renderer
  embeds via `views::WebView`.
- `height` is clamped to `[kMinHeight, kMaxHeight]`. Pass `0` to use
  `kDefaultHeight` (36 DIPs).
- `on_dismiss` is fired **exactly once** when the infobar goes away —
  whether via the X close button, tab navigation, tab close, or an
  explicit `infobar->RemoveSelf()`. May be a null callback.

## Extension API reference

```js
// From an MV3 extension's background SW / popup / extension page:
await chrome.infobars.show({
  tabId: 123,
  path: "bar.html",     // resolved against chrome-extension://<id>/
  height: 48,           // optional; clamped to [0, 72]
});
```

`tabId` is required. The extension must declare `"infobars"` in
`permissions` and (typically) `"activeTab"` or `"tabs"` to obtain `tabId`.
The `bar.html` (and any sibling JS/CSS) must be listed in
`web_accessible_resources` so the chrome-extension:// URL serves it.

## Lifetime & ownership

```
InfoBarManager (tab-helper, lives with the tab WebContents)
   │
   │ owns:
   ▼
InfoBar (the views::InfoBarView in our case)
   │
   │ owns:
   ▼
CustomInfobarDelegate
   │
   │ owns:
   ▼
content::WebContents (off-screen, hosts the URL)
   │
   │ non-owning ptr held by:
   ▼
views::WebView (child of CustomInfobar)
```

**Dismiss triggers** (any of them fires `on_dismiss` exactly once, then
destroys the delegate + hosted WebContents in the right order):

| Trigger | Path |
|---|---|
| User clicks X close button | `InfoBarView::CloseButtonPressed` → `delegate()->InfoBarDismissed()` → `RemoveSelf()` → `InfoBarManager::RemoveInfoBar` |
| Tab navigates | `ContentInfoBarManager::NavigationEntryCommitted` calls `RemoveAllInfoBars(animate=true)` for non-redirect commits |
| Tab closes | `ContentInfoBarManager::WebContentsDestroyed` |
| Caller explicitly removes | `infobar->RemoveSelf()` |

`InfoBarDismissed()` uses a move-then-check on `on_dismiss_` to guarantee
the callback fires at most once even under the user-click/tab-nav race.

## Why the extension path routes through `CustomInfobarDelegate`

The extension API today calls `CustomInfobarDelegate::Create` (not the
legacy `ExtensionInfoBarDelegate::Create`). History:

1. The fork inherited `ExtensionInfoBarDelegate` + a matching Views
   renderer `ExtensionInfoBar` from Brave/Chromium-of-the-past. The
   delegate's `CreateInfoBar()` was supposed to return an
   `ExtensionInfoBar` (which inherits `InfoBarView`) so that
   `InfoBarContainerView`'s `static_cast<InfoBarView*>` cast would be
   valid.
2. The `extension_infobar.{cc,h}` files were **never wired into any GN
   target** — they're not listed in [`custom/browser/ui/sources.gni`](../src/custom/browser/ui/sources.gni)
   or anywhere else. As a result, the only definition the linker found
   was the placeholder in [`extension_infobar_delegate.cc`](../src/custom/browser/extensions/extension_infobar_delegate.cc),
   which returns `std::make_unique<infobars::InfoBar>` — a plain
   base-class object that is **not** an `InfoBarView`.
3. First time the API was actually invoked, the `static_cast` in
   `InfoBarContainerView::PlatformSpecificAddInfoBar` produced an invalid
   pointer; `AddChildViewAt` crashed in `View::AddChildViewAtImpl`.
4. Phase 2 had already built `CustomInfobarDelegate` + `CustomInfobar`
   as the inline-API path, which works correctly. Rather than resurrect
   the legacy code (which would need a rewrite against modern Chromium
   anyway), [`infobars_extension_api.cc`](../src/custom/browser/extensions/api/infobars/infobars_extension_api.cc)
   now calls `CustomInfobarDelegate::Create` directly.

This delivers a working API path today. Two semantics are different from
the textbook "extension infobar":

- **No extension renderer process.** The hosted `WebContents` is created
  in the tab's `BrowserContext` but **not** in the extension's renderer
  process. `chrome-extension://<id>/<path>` URLs **load** fine (the
  extension URL loader serves any caller), but `chrome.*` APIs are not
  available inside the bar's page. For most banner-style UIs (status
  text, action buttons that fire `window.close()`) this is irrelevant.
- ~~**No auto-removal on extension unload.**~~ **Fixed.** `infobars_extension_api.cc`
  now attaches a self-owning `InfobarExtensionGuard` after each successful
  `CustomInfobarDelegate::Create`. The guard observes both `ExtensionRegistry`
  (to call `RemoveSelf()` on `OnExtensionUnloaded`) and `InfoBarManager`
  (to self-delete when the infobar is removed by any means — navigation, X
  button, or the extension unload path itself).

The remaining known gap is the extension renderer process — restoring
`chrome.*` API access inside the bar page requires a proper Views renderer
wrapping `ExtensionViewHost`. The legacy `extension_infobar.cc` is a
reference but needs significant API modernization.

## Dead-code notes

These files exist in tree but are not in any active build target. They're
left behind from the legacy/incomplete paths and should be deleted in a
future cleanup pass:

- [`custom/browser/extensions/extension_infobar_delegate.{cc,h}`](../src/custom/browser/extensions/extension_infobar_delegate.cc) —
  still in [`custom/browser/extensions/sources.gni`](../src/custom/browser/extensions/sources.gni)
  under `if (custom_extension_infobar)`, so it compiles, but its
  `Create` is no longer called. (Replacing it with a stub or removing
  it requires also removing its sources.gni entry and confirming nothing
  else in the extensions tree still references the header.)
- [`custom/browser/ui/views/infobars/extension_infobar.{cc,h}`](../src/custom/browser/ui/views/infobars/extension_infobar.cc) —
  the legacy Views renderer. Not compiled by any target. Useful as a
  reference if/when we restore the extension-renderer-aware path.

## Testing

[`test-extensions/infobars-test/`](../test-extensions/infobars-test/) —
MV3 smoke-test extension. Eight buttons exercising basic / edge-case /
content-variant / stacking scenarios. Each call's result is logged in
the popup's bottom pane. See [its README](../test-extensions/infobars-test/README.md)
for load steps, per-button expectations, and a troubleshooting table.

Quick recipe:

1. `chrome://extensions` → toggle Developer mode → **Load unpacked** →
   point at `test-extensions/infobars-test/`.
2. Open any `http(s)` page (chrome:// pages don't host a
   `ContentInfoBarManager` and the API will reject them with "Unable to
   attach infobar to tab").
3. Click the toolbar icon → click any of the test buttons.

For the inline API, the cheapest test trigger is to call
`CustomInfobarDelegate::Create` from any existing browser-side code path
(e.g. a debug-only keyboard accelerator or a `chrome://` handler). See
the "Inline API (Phase 2)" notes in earlier session work for sample
trigger snippets.

## Adding a new inline caller

1. Find a browser-side WebContents reference — usually
   `browser->tab_strip_model()->GetActiveWebContents()` or a
   tab-observer callback's `web_contents`.
2. Build a URL the off-screen WebContents can load. A `data:` URL is
   fine for prototypes; in production prefer a registered `chrome://`
   page so its resources are tracked and its CSP is enforced.
3. Call `custom::CustomInfobarDelegate::Create(wc, url, height,
   on_dismiss)`. Capture the return only if you intend to call
   `RemoveSelf()` later — otherwise let it own itself.
4. Add `#include "custom/browser/infobars/custom_infobar_delegate.h"`.
   Your target needs no new deps if it already depends on
   `chrome/browser` (the delegate is compiled into that target via
   `custom_browser_sources`). If `gn check` enforcement tightens
   later, the canonical fix is to expose `:infobars` as a public
   subtarget under `custom/browser/`.
