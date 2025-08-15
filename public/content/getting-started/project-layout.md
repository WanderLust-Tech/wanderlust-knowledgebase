# Project Layout

Chromium’s source tree is vast. This guide gives you a high-level tour of the most important directories and files so you know where to look for specific functionality.

---

## 1. Top-Level Structure

```text
<repo-root>/
├── .gclient                 # gclient configuration
├── .gitignore               # files to ignore in Git
├── DEPS                      # external dependencies manifest
├── LICENSE                  # project license
├── README.md                # high-level overview & links
├── chrome/                  # browser UI, Chrome‐specific code
├── content/                 # core browser/renderer logic
├── build/                   # build scaffolding & CI scripts
├── tools/                   # code generators, formatters, linting
├── third_party/             # bundled external libraries
├── ui/                      # cross‐platform UI toolkit
└── src/                     # actual Chromium source (see §2)
.gclient / DEPS
Define how to fetch submodules (including src/), and pin versions of third-party dependencies.

chrome/ & content/
chrome/ holds Chrome‐flavored UI and high-level glue; content/ is the shared browser/renderer engine.

build/
GN/Ninja helper files, presubmit scripts, and CI definitions.

tools/
Code generators (e.g. protobuf), formatters (e.g. clang‐format), and various scripts.

third_party/
Prebuilt or source-checked libraries like V8, Skia, ICU, etc.

2. The src/ Directory
After running fetch chromium, most of the code lives in src/. Its top‐level layout:

text
Copy
Edit
src/
├── chrome/            # Chrome browser shell & UI centric code
├── cc/                # Compositor & layered rendering
├── content/           # Blink/V8 embedder & shared browser logic
├── gpu/               # GPU process, drivers, and command buffer
├── net/               # Networking stack (HTTP, QUIC, proxies)
├── ui/                # Cross-platform abstraction for windows, events
├── third_party/       # Mirrors of upstream projects (Chromium‐specific)
├── tools/             # Build‐time codegen & helper scripts
└── components/        # Reusable modules (e.g. feed, payments)
chrome/
Entry points, Chrome UI (tabs, omnibox, menus), and platform‐specific glue.

content/
Integrates Blink (rendering) and V8 (JS), plus IPC, navigation, and resource loading.

cc/ & gpu/
Handle compositing layers and talking to the GPU process/drivers respectively.

net/
Implements HTTP(S), QUIC, SPDY, caching, cookies, proxy resolution, etc.

ui/
Abstracts windowing, input events, and vector graphics across platforms.

components/
Higher-level features decoupled from Chrome (e.g. autofill, payments, feed).

3. Build Outputs & Intermediates
text
Copy
Edit
out/
└── Default/           # Your default build directory
    ├── obj/           # Intermediate object files
    ├── chrome         # Built executable (or .exe on Windows)
    ├── lib*.so/.dll   # Shared libraries if component build enabled
    └── *.ninja_log    # Build logs
You generate this with gn gen out/Default.

Ninja writes objects under obj/ and outputs binaries at the top level.

4. Configuration & Metadata
BUILD.gn files
Scattered throughout the tree, define targets (libraries, executables).

.gn files
Templates for code formatting, license headers, or tooling.

gn args
Controls build flags (debug vs. release, component vs. monolithic).

PRESUBMIT.py
Hooks run before uploading patches to catch style/build errors.

5. Writing & Finding Docs
Inline README.md
Many subdirectories have their own README.md explaining local conventions.

docs/ folder
Longer design docs and architecture overviews (e.g. process model, sandbox).

Amber-style comments
Look for //-style comments at the tops of files or functions for quick context.

6. How to Navigate
Directory ↔ Feature

Need networking? Start in src/net/.

Want to tweak the UI widget? Look under src/ui/gtk/ or src/ui/views/.

BUILD.gn ↔ Source

Use find . -name BUILD.gn | xargs grep <target> to locate the definition.

Code Search

Use https://source.chromium.org for full-text search of identifiers, commits, and reviews.

With this map in hand, you’ll know exactly where to dive for the next deep-dive in our KB.

yaml
Copy
Edit

---

**Usage tips:**
- Link each directory name in this doc to its detailed KB article (once written).
- Update the examples when folder names change (Chromium reorganizes periodically).
- Encourage readers to bookmark the online code search for rapid lookup.