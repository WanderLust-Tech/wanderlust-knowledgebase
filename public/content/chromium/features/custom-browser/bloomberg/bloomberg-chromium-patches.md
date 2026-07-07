# Bloomberg Chromium Patches

Six low-level patches ported from Bloomberg's chromium.bb (M104) fork. These modify
vanilla Chromium files directly (guarded by `BUILDFLAG(CUSTOM_BROWSER)` where
applicable) and are maintained as patch files under `src/custom/patches/`.

---

## 1. LayoutNG Text Shaping Cache

**File**: `src/third_party/blink/renderer/core/layout/ng/inline/ng_inline_node.cc`

Guards `ShapeTextIncludingFirstLine` with a token-bucket invalidation check.
Skips re-shaping when the inline node's layout hasn't changed since the last
shape pass, reducing redundant text-shaping work during style-recalc-heavy pages.

---

## 2. Raster Invalidation Skip for Empty Paint Chunks

**File**: `src/cc/layers/picture_layer_impl.cc` (paint chunker path)

When the paint chunk list produced for a layer is empty, raster invalidation
propagation is skipped entirely. Avoids unnecessary GPU tile invalidations on
invisible or zero-size layers (common in complex DOM-heavy applications).

---

## 3. Canvas Memory Clearing at Renderer Startup

**File**: `src/third_party/blink/renderer/core/html/canvas/html_canvas_element.cc`

Zeroes the canvas backing store on allocation. Prevents information leakage from
recycled graphics-memory pages into canvas `getImageData()` / `toDataURL()` reads.

---

## 4. GPU Log Rate Limiter

**File**: `src/content/browser/gpu/gpu_data_manager_impl_private.cc`  
**Function**: `GpuDataManagerImplPrivate::AddLogMessage` (~line 1416)

Token-bucket rate limiter applied to GPU process log messages:
- Steady-state: **2 messages/second**
- Burst capacity: **100 messages**

Prevents runaway GPU components from consuming gigabytes of browser memory via
unbounded log accumulation. See [Chromium bug 798012](https://crbug.com/798012).

```cpp
static double tokens = 100.0;
static base::TimeTicks last_refill = base::TimeTicks::Now();
tokens = std::min(100.0, tokens + elapsed_seconds * 2.0);
if (tokens < 1.0) return;  // drop
tokens -= 1.0;
```

---

## 5. DevTools `.mjs` + `.map` MIME Types

**File**: `src/chrome/browser/devtools/devtools_ui_bindings.cc` (or equivalent)

Registers two MIME-type associations that Chromium's built-in DevTools server
omits by default:

| Extension | MIME type |
|-----------|-----------|
| `.mjs` | `application/javascript` |
| `.map` | `application/json` |

Without this patch, ES-module scripts loaded in DevTools fail with MIME-type
errors, and source maps are rejected as invalid JSON responses.

---

## 6. `Sec-CH-UA` Suppression Toggle

**Integration file**: `src/content/browser/client_hints/client_hints.cc`  
**Pref**: `privacy_guard.sec_ch_ua_suppressed` (`prefs::kCustomSecChUaSuppressed`)

When the pref is `true`, all `Sec-CH-UA*` client-hint request headers are stripped
before they leave the browser process. Prevents UA-CH-based browser fingerprinting
without disabling JavaScript's `navigator.userAgentData` API.

### Prefs

| Pref key | Type | Default |
|---|---|---|
| `privacy_guard.sec_ch_ua_suppressed` | bool | `false` |

### Settings handler

| Message | Args |
|---------|------|
| `customSetSecChUaSuppressed` | `[bool]` |
