# Release builds (mini_installer)

How to produce a Wanderlust release `mini_installer.exe` from the Wanderlust source tree, plus the issues we had to fix to make this work and the traps that remain.

## TL;DR

From the repo root:

```powershell
npm run build -- Release `
  --channel release `
  --target mini_installer `
  --gn is_official_build:true `
  --gn ffmpeg_branding:Chrome `
  --gn proprietary_codecs:true `
  --gn enable_widevine:true
```

Output: `src\out\Release\mini_installer.exe`.

Re-runs that don't need to regenerate the gn project:

```powershell
npm run build -- Release --target mini_installer --no_gn_gen
```

If gn complains about Widevine cert signing, add `--gn ignore_missing_widevine_signing_cert:true` — that's what [buildChromiumRelease.py](../../src/custom/build/commands/lib/buildChromiumRelease.py) does for its stock-Chromium variant.

---

## What each flag does

| Flag | Effect |
|---|---|
| `Release` (positional) | Sets `build_config = 'Release'`. Drives `is_debug=false` and `is_component_build=false` ([config.py:628-634](../../src/custom/build/commands/lib/config.py#L628-L634)). Output dir becomes `src\out\Release`. |
| `--channel release` | Sets the browser channel. When combined with `is_official_build`, this is what marks the binary as a Stable-channel build (vs. dev/beta/nightly). |
| `--target mini_installer` | Overrides the default ninja target (`chrome`). `mini_installer` is the chained target that produces `chrome.7z` + `setup.exe` + `mini_installer.exe`. |
| `--gn is_official_build:true` | Enables PGO, LTO, jumbo, optimize_webui, and a heap of other "ship-quality" toggles. **This is the flag that triggers the issues below.** |
| `--gn ffmpeg_branding:Chrome` | Builds ffmpeg with the full proprietary codec set (H.264, AAC, MP3) — the licensing matrix for a shipped browser. |
| `--gn proprietary_codecs:true` | Enables proprietary codec usage throughout the browser. |
| `--gn enable_widevine:true` | Enables Widevine DRM (needed for Netflix/Spotify et al.). |

---

## How the wiring works

```
npm run build -- <args>
       │
       │   root package.json:
       │   "build": "cd src/custom && python build/commands/lib/build.py"
       ▼
python build/commands/lib/build.py Release --target mini_installer …
       │
       │   argparse (in __main__) populates a Namespace
       ▼
build() coerces dict→Namespace, sets the singleton's build_config
       │
       ▼
config.update(args)
   ├─ parses --gn  key:value pairs into config.config.extra_gn_args
   ├─ parses --ninja into config.config.extra_ninja_opts
   └─ stores --channel, --target, --target_os, --target_arch, etc.
       │
       ▼
utils.generate_ninja_files()  ─►  run_gn_gen()
   ├─ config.config.build_args() emits the defaults dict:
   │       is_debug, is_component_build, target_cpu, channel,
   │       custom_browser_*, enable_widevine, etc., then
   │       **self.extra_gn_args (last write wins)
   ├─ build_optimizer.apply_optimizations() appends host-tuned args
   │       (is_clang, use_lld, enable_jumbo_build, symbol_level=1, …)
   ├─ build_args_to_string() ─► "is_debug=false target_cpu=\"x64\" …"
   └─ gn gen out/Release --args="…" --filters=//chrome;//chrome/installer/setup;//base;//custom
       │
       ▼
utils.build_target()
   └─ autoninja -C out/Release mini_installer -k 1
```

---

## Issues we hit and fixed

### 1. `npm run build -- --flags` stripped the flags

**Symptom:** `--channel`, `--target`, `--gn` arguments disappeared between the outer shell and `build.py`'s argparse. The echo from npm showed only the values: `Release release mini_installer is_official_build:true …`.

**Cause:** the root `package.json` chained `npm run build` → inner `npm run build --` → `python build.py`. Two layers of npm. Each layer re-parses args after `--` and strips anything that looks like an npm-config flag (`--channel` happens to match `npm config set channel ...`).

**Fix:** collapsed the chain to a single Python invocation in [package.json](../../package.json):

```diff
- "build": "cd src/custom && npm run build --"
+ "build": "cd src/custom && python build/commands/lib/build.py"
```

The inner `src/custom/package.json` `build` script still exists for direct use (`cd src/custom && npm run build -- …`) and now works for the same reason — there's only one npm hop.

### 2. `build.py` ignored CLI args entirely

**Symptom:** even with a single npm hop, `python build.py Release --target mini_installer` ignored all CLI args.

**Cause:** `build.py`'s `__main__` block was:

```python
if __name__ == "__main__":
    async def main():
        await build()
    asyncio.run(main())
```

That's `build()` with no args — argparse was never wired up. The `--target` flag also wasn't declared anywhere.

**Fix:** [build.py](../../src/custom/build/commands/lib/build.py) now has a full argparse in `__main__` matching the [commands.py](../../src/custom/build/commands/scripts/commands.py) build subparser, including `--target`. The parsed `Namespace` is passed straight through to `build()`.

The legacy code path (`build({...dict})` from other modules) still works because `build()` coerces dicts to `SimpleNamespace` at entry.

### 3. The `is_debug=true && is_official_build=true` assertion

**Symptom:**
```
ERROR at //build/config/BUILDCONFIG.gn:177:1: Assertion failed.
assert(!(is_debug && is_official_build), "Can't do official debug builds")
```

This fired even though `build_config = 'Release'` should set `is_debug=false`.

**Cause:** [config.py](../../src/custom/build/commands/lib/config.py) exports the singleton instance as `config.config` and re-exports `update` as a *bound method* (live reference) but `build_config` as a *value snapshot* (one-time copy at module import). So `config.build_config = 'Release'` was setting a fresh module-level shadow — the singleton's `self.build_config` stayed at the default `'Debug'`. Then `is_debug()` and `is_component_build()` both returned `True`.

**Fix:** [build.py](../../src/custom/build/commands/lib/build.py#L101) and [buildChromiumRelease.py](../../src/custom/build/commands/lib/buildChromiumRelease.py#L128-L129) now write through the instance:

```python
config.config.build_config = build_config  # was: config.build_config = build_config
```

Same fix applied to `setattr(config, 'is_chromium', True)` in `buildChromiumRelease.py`.

**Sanity-check trick:** if you suspect a config field isn't taking effect, the quickest verification is

```powershell
python -c "import sys; sys.path.insert(0, 'src/custom/build/commands/lib'); `
  import config; config.config.build_config = 'Release'; `
  args = config.config.build_args(); `
  print('is_debug =', args['is_debug']); `
  print('is_component_build =', args['is_component_build'])"
```

That bypasses gn entirely and tells you what `build_args()` would emit.

### 4. `transpile-web-ui.py` didn't accept `--production`

**Symptom:**
```
transpile-web-ui.py: error: unrecognized arguments: --production
```

**Cause:** [components/common/typescript.gni](../../src/custom/components/common/typescript.gni) appends `--production` to the script's args whenever `is_official_build = true`:

```gn
if (is_official_build) {
  args += [ "--production" ]
}
```

But [transpile-web-ui.py](../../src/custom/script/transpile-web-ui.py) didn't declare that flag in its argparse, so the script aborted before doing anything. Like #3, this only fires in official builds.

**Fix:** added `--production` as a recognised (no-op) argparse flag. The script itself is a stub — it copies `.tsx` files as-is rather than actually transpiling, so there's no real production-mode logic to wire up yet. The flag is accepted so the build can proceed; real production optimisation goes in once the script grows actual webpack/vite invocation.

**Long-term:** this script and the `transpile_web_ui` GN template only serve legacy Polymer/Lit WebUIs. Once those migrate to the React pipeline (same "gate Polymer entirely" cleanup tracked in [custom-webui/README.md](../custom-webui/README.md)), both can be deleted.

### 5. `base::ThreadRestrictions::SetIOAllowed` removed upstream

**Symptom:**
```
custom/base/wanderlust_platform_util.cc(82,9): error: no member named 'ThreadRestrictions' in namespace 'base'
   base::ThreadRestrictions::SetIOAllowed(true);
```

Four identical errors in [wanderlust_platform_util.cc](../../src/custom/base/wanderlust_platform_util.cc) — two functions (`WanderLustPlatformUtil::DisableBlockingAssertions` and `WanderLustThreadingUtil::DisableBlockingAssertions`) each calling `SetIOAllowed(true)` + `SetWaitAllowed(true)` under `#if defined(OFFICIAL_BUILD)`. Debug skipped the block; Release didn't.

**Cause:** the upstream Chromium API was removed. The replacement is `base::ScopedAllowBlocking` — but that's RAII / scope-bound, not the permanent thread-global toggle the original code wanted. There is *no* upstream API left that does what `SetIOAllowed(true)` did.

The methods were also a no-op in production already: the blocking assertions they tried to silence are `DCHECK`-based and compile out in `is_official_build && !dcheck_always_on`.

**Fix:** removed both function bodies, kept the signatures (so callers still link). Added comments explaining the API removal and the RAII-vs-toggle mismatch so this isn't "fixed forward" by an incorrect ScopedAllowBlocking inside the function (which would expire immediately on return and do nothing).

### 6. `ui::ET_*` constants renamed to `ui::EventType::k*`

**Symptom:**
```
custom/browser/mouse_gesture/mouse_gesture_widget_delegate_view_win.cc(113,28):
  error: no member named 'ET_MOUSEWHEEL' in namespace 'ui'
   if (event->type() == ui::ET_MOUSEWHEEL) {
```

**Cause:** upstream rewrote [ui/events/types/event_type.h](../../src/ui/events/types/event_type.h) from a C-style `enum EventType { ET_FOO, … }` to a scoped `enum class EventType { kFoo, … }`. Every `ui::ET_X` site now needs `ui::EventType::kX`. Mapping is mechanical — `ET_MOUSEWHEEL` → `EventType::kMousewheel`, `ET_MOUSE_PRESSED` → `EventType::kMousePressed`, etc. The full kCase list is in `event_type.h`.

These compile in any build config, so Debug should've caught them — but the affected TUs only build under `is_official_build` (demos are tagged that way) or are platform-specific (the mouse-gesture file is Windows-only and only links into Release).

**Fix:** swept all `ui::ET_*` call sites in `src/custom`. Five files: `mouse_gesture_widget_delegate_view_win.cc` (1), `demos/demo_gl/demo_gl.cc` (6), `demos/demo_skia/demo_skia.cc` (6), `demos/demo_viz/demo_viz_layer.cc` (2), `demos/demo_viz/demo_viz_layer_offscreen.cc` (2).

### 7. Patched installer file missing `custom/build/buildflag.h` include

**Symptom:**
```
chrome/installer/setup/installer_crash_reporter_client.cc(106,30):
  error: expected ';' at end of declaration
   L"SOFTWARE\\Policies\\" CUSTOM_STRING_BUILDFLAG(CUSTOM_BROWSER_COMPANY_PATH) "\\" …
```

**Cause:** the patch in [installer_crash_reporter_client.cc](../../src/chrome/installer/setup/installer_crash_reporter_client.cc) adds a `#elif BUILDFLAG(CUSTOM_BROWSER)` branch using the fork's `CUSTOM_STRING_BUILDFLAG(...)` macro, but didn't add `#include "custom/build/buildflag.h"`. Without the include, the preprocessor leaves the macro name as a stray identifier; the compiler sees `L"…" SOMETOKEN(…)` and demands a `;` after the string literal.

This is the installer's setup binary — it's reachable from the `mini_installer` target chain, which is only built for Release / official builds. Debug never compiles this TU, so the missing include slept.

**Fix:** added the include alongside the other branding/buildflag headers ([util_constants.cc](../../src/chrome/installer/util/util_constants.cc), [google_update_constants.cc](../../src/chrome/installer/util/google_update_constants.cc), and other patched files in `installer/util/` follow the same pattern). The mixed `L"…"` + narrow-string concat in the affected line is fine — C++11+ string-literal concatenation promotes to wide when *any* operand is `L"…"`.

**Watch-out:** when patching upstream files to use the fork's BUILDFLAG macros, always include `custom/build/buildflag.h` alongside `build/branding_buildflags.h`. The lint check `gn check` won't catch this — only a full compile of the TU will.

### 8. `create_installer_archive.py` crashed on `None` exe name

**Symptom:**
```
File "…/configparser.py", line 1201, in _validate_value_types
  raise TypeError("option keys must be strings")
TypeError: option keys must be strings
```

…thrown from line 610 of [chrome/tools/build/win/create_installer_archive.py](../../src/chrome/tools/build/win/create_installer_archive.py):

```python
config.set('GENERAL', options.custom_browser_exe, value)
```

**Cause:** the patch in `create_installer_archive.py` adds a `--custom_browser_exe` option to its argparse and uses the value as a configparser key — replacing the upstream `chrome.exe` entry with the branded name. But [chrome/installer/mini_installer/BUILD.gn](../../src/chrome/installer/mini_installer/BUILD.gn) never passes that flag. So `options.custom_browser_exe` is `None`, configparser refuses a non-string key, and the archive step blows up before producing `chrome.7z`.

The BUILD.gn was already half-patched — line 156 conditionally swaps `chrome.exe` for `$custom_browser_name.exe` in the action's `inputs` list, but never extends the `args` list to pass the same name to the script.

**Fix:** finished the half-patch in [mini_installer/BUILD.gn:220-222](../../src/chrome/installer/mini_installer/BUILD.gn#L220-L222):

```gn
if (is_custom_browser) {
  args += [ "--custom_browser_exe=$custom_browser_name.exe" ]
}
```

The `.exe` suffix matches the `chrome.exe` key the script removes and replaces.

### 9. Polymer settings BUILD.gn missing sub-targets

**Symptom:**
```
ERROR at //chrome/browser/resources/settings/BUILD.gn:448:26:
Unable to load ".../privacy_sandbox/BUILD.gn".
   extra_grdp_deps = [ "privacy_sandbox:build_grdp" ]
```

**Cause:** `is_official_build=true` flips on `optimize_webui`, which activates a block in [chrome/browser/resources/settings/BUILD.gn](../../src/chrome/browser/resources/settings/BUILD.gn) that depends on two sub-targets the Wanderlust fork removed:

- `privacy_sandbox:build_grdp` — the per-subdir `BUILD.gn` files for the Polymer settings tree were all stripped from the fork (Wanderlust replaced the Polymer settings UI with the React `custom_settings` build).
- `//custom/browser/resources/settings:resources` — the custom settings `BUILD.gn` only defines a `preprocess` target, not `resources`.

Debug builds skip this block (`optimize_webui` is false for non-official builds), which is why the failure had stayed hidden until the first Release attempt.

**Fix:** commented those three lines out in [chrome/browser/resources/settings/BUILD.gn:447-462](../../src/chrome/browser/resources/settings/BUILD.gn#L447-L462). The Polymer settings still builds — just without the dead grdp deps.

**Future cleanup:** once *all* WebUI components migrate to React (not just settings), gate the entire `build_webui("build")` target behind `if (!enable_custom_webui)` so the Polymer settings doesn't build at all. Tracked in [docs/custom-webui/README.md](../custom-webui/README.md) under "Gate the Polymer settings UI entirely (future cleanup)".

---

## Verifying the output

After a successful build:

```powershell
ls src\out\Release\mini_installer.exe
ls src\out\Release\chrome.7z
ls src\out\Release\setup.exe
```

`mini_installer.exe` is the user-facing installer; it bundles `setup.exe` + `chrome.7z` and self-extracts on first run.

`args.gn` in the output dir is the canonical record of what got built. If a future build acts weird, diff it against the previous run — `should_run_gn_gen` in [utils.py](../../src/custom/build/commands/lib/utils.py#L880-L886) compares the *full* args string against the previous run's stored copy (`custom_build_args.txt`) to decide whether to re-run gn.

## Things still to watch

- **Stock-Chromium vs. branded path.** The wrapper command [`build_chromium_release`](../../src/custom/build/commands/lib/buildChromiumRelease.py) also builds `mini_installer`, but with `setattr(config.config, 'is_chromium', True)` and a `git clean -f -d` on `src/`. It's intended for performance baselines, **not** shipping Wanderlust. Use the plain `build` command for releases.
- **Bundle-size assertions.** Some release builds enforce binary-size budgets via `chrome_pgo_phase` and friends. None of those have fired yet, but they will if the bundle balloons unexpectedly.
- **Patch drift.** The Polymer settings `BUILD.gn` comment-outs above are a tracked diff against upstream Chromium. If upstream rearranges that file in a future sync, the patch will conflict.
