# Custom WebUI: Getting Started

How the React + Tailwind WebUI build pipeline works, and how to add a new
`chrome://example/` page from scratch.

The companion [`README.md`](README.md) is settings-specific and exhaustive —
this doc is the trimmed "what you actually need to ship a new WebUI" version.
For complete worked examples once you've read this, look at:

- [`src/custom/components/custom_reader/`](../../src/custom/components/custom_reader/) — single-page `chrome://reader`
- [`src/custom/components/custom_sidebar/`](../../src/custom/components/custom_sidebar/) — multi-route SPA at `chrome://sidebar/{bookmarks,history,rss}`
- [`src/custom/components/custom_settings/`](../../src/custom/components/custom_settings/) — 30-page hub-and-sub-pages

---

## How it works

```
src/custom/components/<name>/         ← React app source (.tsx, .css, .html)
        │
        │   build_react_webui("<name>")  [GN template]
        │
        ▼
react_bundler.py ─► node bundle.mjs   [Python invokes Node]
        │                │
        │                ├─► esbuild     (TSX → ESM, tree-shaken)
        │                ├─► Tailwind CLI (content-scanned CSS)
        │                └─► manifest.json
        │
        ▼
generate_grd ─► grit ─► <name>_resources.pak
                                 │
                                 ▼
                  <Name>UI controller (C++)
                                 │
                                 ▼
                       chrome://<host>/  ✓
```

Three scripts do the work:

| Script | What it does |
|---|---|
| [`build_react_webui.gni`](../../src/custom/tools/webui/build_react_webui.gni) | GN template. One `build_react_webui("name") { … }` block produces `bundle` → `generate_grd` → `grit` → `<name>_resources.pak`. Drop-in companion to upstream `build_webui()`. |
| [`react_bundler.py`](../../src/custom/tools/react/react_bundler.py) | Thin Python wrapper invoked by GN. Writes args to a temp JSON file and shells out to Node. |
| [`bundle.mjs`](../../src/custom/tools/react/bundle.mjs) | The actual bundler. Runs esbuild (TSX → one `.js`) and Tailwind CLI (content-scanned → one `.css`), then writes a `generate_grd` manifest. esbuild is resolved via `createRequire` pointed at the shared `webui_node_modules`. |

Shared toolchain lives at [`src/custom/third_party/webui_node_modules/`](../../src/custom/third_party/webui_node_modules/)
(`react`, `react-dom`, `esbuild`, `tailwindcss`). Run `npm install` once after a
fresh checkout — `node_modules/` is gitignored. The component library at
[`src/custom/third_party/pathfinder_ui/`](../../src/custom/third_party/pathfinder_ui/)
is vendored and imported as `pathfinder-ui` via an esbuild alias.

---

## Adding a new chrome:// page

Worked example: `chrome://example/`. Substitute your own host/grd_prefix
everywhere it says `example` / `custom_example`. The convention this fork
uses: `chrome://<host>` served from `//custom/components/custom_<host>/`,
GRD prefix `custom_<host>`.

### 1. Create the React app directory

```
src/custom/components/custom_example/
├── BUILD.gn
├── index.html
├── main.tsx
├── App.tsx
├── cr.ts
├── tsconfig.json
└── styles/
    └── tailwind.css
```

**`index.html`** — bare shell. The `.js` and `.css` are emitted by the bundler:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Example</title>
  <link rel="stylesheet" href="/custom_example.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/custom_example.js"></script>
</body>
</html>
```

**`main.tsx`** — boot. Importing `./cr` for the side-effect installs `window.cr`:

```tsx
import { createRoot } from 'react-dom/client';
import './cr';
import { App } from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('chrome://example: #root missing from index.html');
}
createRoot(container).render(<App />);
```

**`App.tsx`** — your UI. `usePref` and `chrome.send` are wired through `cr.ts`:

```tsx
export function App() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Example</h1>
      <button
        className="mt-4 rounded bg-brand-500 text-white px-4 py-2"
        onClick={() => window.cr.sendWithPromise('exampleDoThing').then(console.log)}
      >
        Do thing
      </button>
    </div>
  );
}
```

**`cr.ts`** — copy verbatim from [custom_sidebar/cr.ts](../../src/custom/components/custom_sidebar/cr.ts).
Polyfills `cr.sendWithPromise` / `cr.addWebUIListener` / `cr.webUIResponse` so
the bundle stays self-contained (no runtime import from `chrome://resources/js/cr.js`,
which keeps CSP tight). The protocol matches `ResolveJavascriptCallback` /
`FireWebUIListener` so any C++ handler talks to it the same way.

**`styles/tailwind.css`** — Tailwind v4 entry. `@source` directives drive
content scanning:

```css
@import "tailwindcss";

@source "../../../third_party/pathfinder_ui/src/**/*.{ts,tsx}";
@source "../**/*.{ts,tsx}";
```

Add an `@theme { … }` block if you want shared brand tokens — copy the one
from [custom_sidebar/styles/tailwind.css](../../src/custom/components/custom_sidebar/styles/tailwind.css)
so all three custom WebUIs render with the same palette.

**`tsconfig.json`** — copy from [custom_sidebar/tsconfig.json](../../src/custom/components/custom_sidebar/tsconfig.json).
The `paths` block points TS at the vendored `react` / `react-dom` /
`pathfinder-ui` so editor / type-check works without `npm install` in this
directory.

**`BUILD.gn`** — the single block that drives the whole pipeline. Every
`.ts` / `.tsx` file the bundler should treat as an input must be listed in
`sources` so ninja knows when to rebuild — esbuild follows imports
automatically, but GN needs the explicit list:

```gn
import("//custom/custom_browser_config.gni")
import("//custom/tools/webui/build_react_webui.gni")

build_react_webui("custom_example") {
  grd_prefix = "custom_example"

  entry      = "main.tsx"
  css_input  = "styles/tailwind.css"

  static_files = [ "index.html" ]

  sources = [
    "App.tsx",
    "cr.ts",
    "main.tsx",
  ]

  grit_output_dir = "$root_gen_dir/custom/components/custom_example"
}
```

### 2. Write the C++ controller

```
src/custom/browser/ui/webui/example/
├── example_ui.h
├── example_ui.cc
├── example_dom_handler.h          ← only if you need chrome.send actions
└── example_dom_handler.cc
```

**`example_ui.h`** — the WebUIConfig + WebUIController:

```cpp
#ifndef CUSTOM_BROWSER_UI_WEBUI_EXAMPLE_EXAMPLE_UI_H_
#define CUSTOM_BROWSER_UI_WEBUI_EXAMPLE_EXAMPLE_UI_H_

#include "content/public/browser/web_ui_controller.h"
#include "content/public/browser/webui_config.h"

namespace custom {
class ExampleUI;

class ExampleUIConfig : public content::DefaultWebUIConfig<ExampleUI> {
 public:
  ExampleUIConfig();
};

class ExampleUI : public content::WebUIController {
 public:
  explicit ExampleUI(content::WebUI* web_ui);
  ~ExampleUI() override;

  ExampleUI(const ExampleUI&) = delete;
  ExampleUI& operator=(const ExampleUI&) = delete;
};

}  // namespace custom

#endif
```

**`example_ui.cc`** — sets up the WebUIDataSource, attaches resources from the
grit-generated map, tightens CSP, attaches the message handler:

```cpp
#include "custom/browser/ui/webui/example/example_ui.h"

#include "chrome/browser/profiles/profile.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "custom/browser/ui/webui/example/example_dom_handler.h"
#include "custom/common/webui_url_constants.h"
#include "custom/components/custom_example/grit/custom_example_resources.h"
#include "custom/components/custom_example/grit/custom_example_resources_map.h"
#include "services/network/public/mojom/content_security_policy.mojom.h"
#include "ui/webui/webui_util.h"

namespace custom {

ExampleUIConfig::ExampleUIConfig()
    : DefaultWebUIConfig(content::kChromeUIScheme,
                         custom::kChromeUIExampleHost) {}

ExampleUI::ExampleUI(content::WebUI* web_ui)
    : content::WebUIController(web_ui) {
  auto* profile = Profile::FromWebUI(web_ui);
  content::WebUIDataSource* source = content::WebUIDataSource::CreateAndAdd(
      profile, custom::kChromeUIExampleHost);

  webui::SetupWebUIDataSource(source, kCustomExampleResources,
                              IDR_CUSTOM_EXAMPLE_INDEX_HTML);

  // ESM bundle from 'self'; inline styles allowed for React style={{...}}.
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc,
      "script-src chrome://resources 'self';");
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::StyleSrc,
      "style-src chrome://resources 'self' 'unsafe-inline';");

  web_ui->AddMessageHandler(std::make_unique<ExampleDOMHandler>());
}

ExampleUI::~ExampleUI() = default;

}  // namespace custom
```

**`example_dom_handler.{h,cc}`** — register message callbacks. Skip this file
entirely if your page is read-only and never calls `chrome.send`.

```cpp
// example_dom_handler.h
class ExampleDOMHandler : public content::WebUIMessageHandler {
 public:
  void RegisterMessages() override;
 private:
  void HandleDoThing(const base::Value::List& args);
};
```

```cpp
// example_dom_handler.cc
void ExampleDOMHandler::RegisterMessages() {
  web_ui()->RegisterMessageCallback(
      "exampleDoThing",
      base::BindRepeating(&ExampleDOMHandler::HandleDoThing,
                          base::Unretained(this)));
}

void ExampleDOMHandler::HandleDoThing(const base::Value::List& args) {
  AllowJavascript();
  const std::string& callback_id = args[0].GetString();
  base::Value::Dict result;
  result.Set("ok", true);
  ResolveJavascriptCallback(base::Value(callback_id), result);
}
```

The `cr.sendWithPromise('exampleDoThing')` call in `App.tsx` prepends a
callback id automatically — `args[0]` is always that id, real arguments
start at `args[1]`.

### 3. Hook it up — five files outside your component directory

Each one is a single line or stanza. All five are required.

**a. URL constants** — [`src/custom/common/webui_url_constants.h`](../../src/custom/common/webui_url_constants.h):

```cpp
inline constexpr char kChromeUIExampleHost[] = "example";
inline constexpr char kChromeUIExampleURL[]  = "chrome://example/";
```

**b. WebUI registration** — patches
[`chrome/browser/ui/webui/chrome_web_ui_configs.cc`](../../src/chrome/browser/ui/webui/chrome_web_ui_configs.cc).
After editing, run `npm run update_patches` to regenerate the captured
patch at [`src/custom/patches/chrome-browser-ui-webui-chrome_web_ui_configs.cc.patch`](../../src/custom/patches/chrome-browser-ui-webui-chrome_web_ui_configs.cc.patch):

```cpp
#if BUILDFLAG(ENABLE_EXAMPLE)
#include "custom/browser/ui/webui/example/example_ui.h"
#endif

// inside RegisterChromeWebUIConfigs():
#if BUILDFLAG(ENABLE_EXAMPLE)
  map.AddWebUIConfig(std::make_unique<custom::ExampleUIConfig>());
#endif
```

(If your page is always on, drop the `BUILDFLAG` gate. Most custom WebUIs in
this fork are gated — see the existing `ENABLE_RSS_READER`,
`ENABLE_SIDEBAR`, `ENABLE_CUSTOM_WEBUI` examples.)

**c. WebUI BUILD.gn deps** — [`src/custom/browser/ui/webui/BUILD.gn`](../../src/custom/browser/ui/webui/BUILD.gn):

```gn
sources = [
  …
  "example/example_dom_handler.cc",
  "example/example_dom_handler.h",
  "example/example_ui.cc",
  "example/example_ui.h",
]

deps = [
  …
  "//custom/components/custom_example:resources",
]
```

**d. Resource ID range** — [`src/custom/tools/gritsettings/resource_ids_custom.spec`](../../src/custom/tools/gritsettings/resource_ids_custom.spec).
Append a new block after the existing custom_* entries. The `includes` value
must be unique across the spec — bump by 30 from the last entry:

```python
"<(SHARED_INTERMEDIATE_DIR)/custom/components/custom_example/custom_example_resources.grd": {
  "META": {"sizes": {"includes": [30],}},
  "includes": [31190],
},
```

**e. PAK repack** — [`src/custom/components/resources/BUILD.gn`](../../src/custom/components/resources/BUILD.gn).
The `repack("resources")` target bundles everything into the single
`custom_components_resources.pak` that the browser loads:

```gn
repack("resources") {
  deps = [
    …
    "//custom/components/custom_example:resources",
  ]

  sources = [
    …
    "$root_gen_dir/custom/components/custom_example/custom_example_resources.pak",
  ]
}
```

### 4. Build and test

```sh
autoninja -C out/Default chrome
out/Default/chrome --user-data-dir=/tmp/cb chrome://example/
```

`webui::SetupWebUIDataSource` with `SetDefaultResource` makes *any* unknown
path under `chrome://example/*` serve `index.html` — that's how SPA
client-side routing works transparently. Read `window.location.pathname` in
React if you want multi-route inside one bundle (see custom_sidebar for the
pattern).

---

## The JS ↔ C++ protocol

Three flavors, in increasing complexity. Pick the one that fits.

### a. Read with reply — `sendWithPromise`

```tsx
const data = await window.cr.sendWithPromise<MyType>('myAction', arg1, arg2);
```

```cpp
void MyHandler::HandleMyAction(const base::Value::List& args) {
  AllowJavascript();
  const std::string& callback_id = args[0].GetString();
  // args[1], args[2], … are the real arguments.
  base::Value::Dict result;
  // …populate…
  ResolveJavascriptCallback(base::Value(callback_id), result);
}
```

### b. Fire-and-forget write — `chrome.send`

```tsx
window.chrome.send('myAction', [arg1, arg2]);
```

```cpp
void MyHandler::HandleMyAction(const base::Value::List& args) {
  // args[0], args[1], … are the real arguments — no callback id.
  // …do the thing…
}
```

### c. Pushed event from C++ → JS

```cpp
// On JS side:
window.cr.addWebUIListener('mythingChanged', (newValue) => { … });

// On C++ side:
AllowJavascript();  // before any FireWebUIListener call
FireWebUIListener("mythingChanged", base::Value(new_value));
```

For service-backed pages, inherit the observer interface
(`TemplateURLServiceObserver`, `BookmarkModelObserver`, etc.), hold a
`base::ScopedObservation<TheService, TheObserver>` member, subscribe in
`OnJavascriptAllowed`, reset in `OnJavascriptDisallowed`, and fire the
listener event from the observer callbacks. See
[`SidebarDOMHandler`](../../src/custom/browser/ui/webui/sidebar/sidebar_dom_handler.h)
for a 3-service example (bookmarks + history + RSS).

---

## Common gotchas

- **Pref reads from `usePref`** — that hook lives in `custom_settings/hooks/usePref.ts`
  and depends on the `customGetPrefs` / `customSetPref` / `customObservePrefs`
  message names registered by `CustomSettingsHandler`. Copying it into a new
  WebUI means either replicating those three message handlers or implementing
  your own equivalents.
- **Trusted Types CSP** — Chromium enforces `require-trusted-types-for 'script'`
  on `chrome://`. `dangerouslySetInnerHTML` throws. Use a `DOMParser`-based
  text extractor instead, or just render plain text.
- **`"sideEffects"` in pathfinder-ui** — `package.json` must keep
  `"sideEffects": ["**/*.css"]` for tree-shaking to actually drop unused
  exports. If a re-sync removes it, even a single `import { Foo } from 'pathfinder-ui'`
  pulls the entire library back in.
- **GN `sources` list** — esbuild follows imports automatically at runtime,
  but ninja only knows to rebuild when a file in `sources` changes. Forgetting
  to list a new `.tsx` means edits to that file silently no-op until you
  `gn clean`.

---

## Running the bundler manually

Useful for debugging without a full Chromium build. From any directory
(paths resolve against `cwd`, exactly like ninja does):

```sh
mkdir -p out_test/gen/custom/components/custom_example/bundled
cd out_test
python ../src/custom/tools/react/react_bundler.py \
  --entry              ../src/custom/components/custom_example/main.tsx \
  --css-input          ../src/custom/components/custom_example/styles/tailwind.css \
  --out-dir            gen/custom/components/custom_example/bundled \
  --out-base-dir       gen/custom/components/custom_example/bundled \
  --out-manifest       gen/custom/components/custom_example/custom_example_bundle_manifest.json \
  --grd-prefix         custom_example \
  --node-bin           ../src/third_party/node/win/node.exe \
  --node-modules-dir   ../src/custom/third_party/webui_node_modules/node_modules \
  --pathfinder-ui-dir  ../src/custom/third_party/pathfinder_ui \
  --minify
```

Outputs:
- `gen/custom/components/custom_example/bundled/custom_example.js`
- `gen/custom/components/custom_example/bundled/custom_example.css`
- `gen/custom/components/custom_example/custom_example_bundle_manifest.json`

Drop `--minify` (and add `--sourcemap`) for a debuggable build. The
`build_react_webui()` template picks between the two automatically based
on `is_official_build`.
