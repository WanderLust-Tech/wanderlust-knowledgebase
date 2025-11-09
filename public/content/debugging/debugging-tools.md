# Debugging Tools

When working on Chromium you’ll rely on a variety of built-in tools and flags to inspect, profile, and diagnose both browser and renderer behavior. This guide surveys the most useful techniques, commands, and UIs for catching bugs, measuring performance, and analyzing crashes.

---

## 1. Logging & Verbose Flags

Chromium uses VLOG and `--v` logging levels throughout. To enable:

```bash
out/Default/chrome \
  --enable-logging=stderr \
  --v=1             # basic INFO-level logs
  --vmodule="*.cc=2"  # more verbose logging for specific source files
Levels

--v=0 (WARN & above)

--v=1 (INFO)

--v=2..5 (DEBUG with increasing detail)

Redirecting

--log-net-log=netlog.json to capture network internals

--log-file=chrome.log to write all logs to a file

2. Crash Reporting & Breakpad
Chromium’s built-in crash handler (Crashpad on Windows/macOS):

Crash dumps are written under out/Default/crashes/ by default.

Symbolization:

bash
Copy
Edit
out/Default/format_symbolized_stacktrace \
  --symbols-dir=./out/Default \
  crashes/<dump>.dmp
Integration

Under Git workflows you can upload to a Breakpad server or run locally with minidump_stackwalk.

## 3. Chrome Developer Tools

Chromium provides multiple DevTools interfaces for different debugging scenarios: standard web content debugging and specialized desktop UI debugging.

### 3.1 Standard DevTools (Web Content)

Accessible via F12 or chrome://inspect, DevTools offers:

**Elements & Styles**

Live DOM/CSS inspection and editing

**Console**

Runtime errors, logging APIs, and JS REPL

**Sources**

Set breakpoints in JS, step through V8 bytecode/native code

**Performance**

Record CPU & heap profiles; "flamethrower" view of main-thread tasks

**Network**

Inspect HTTP headers, payloads, timing breakdowns

### 3.2 UI DevTools (Desktop UI System)

UI DevTools allows inspection of the Chrome desktop UI system itself (not web content) using a DevTools-like interface. This specialized tool helps developers debug native UI components like Views, Windows, and Widgets.

#### Enabling UI DevTools

**Method 1: Command Line Flag**
```bash
out/Default/chrome --enable-ui-devtools
```

To use a custom port:
```bash
out/Default/chrome --enable-ui-devtools=9000
```

**Method 2: Chrome Flags**
1. Navigate to `chrome://flags`
2. Enable `ui-debug-tools` feature flag
3. Restart Chrome

#### Accessing UI DevTools

Once enabled:
1. Navigate to `chrome://inspect#native-ui`
2. Click the **Inspect Native UI** button
3. UI DevTools opens in a separate tab

#### Features & Capabilities

**Elements Tree Inspection**
- View hierarchical tree of View, Window, and Widget elements
- Right-click root element → "Expand Recursively" for full tree view
- Click any element to inspect its properties

**Property Modification**
- Modify basic element properties in real-time
- Changes are immediately reflected in the UI
- Useful for prototyping UI changes and understanding component behavior

**UI Component Analysis**
- Examine native UI component structure
- Understand parent-child relationships in Views hierarchy
- Analyze layout and positioning of desktop UI elements

#### Supported Platforms

UI DevTools works on all desktop platforms:
- Linux
- Windows  
- macOS
- ChromeOS

#### Common Use Cases

**UI Development & Debugging**
- Debug layout issues in Chrome's desktop interface
- Understand component hierarchies during UI development
- Prototype property changes before implementing code changes

**Quality Assurance**
- Verify UI element properties in different states
- Test UI behavior across different platforms
- Validate accessibility properties of native UI components

**Performance Analysis**
- Identify unnecessarily complex UI hierarchies
- Analyze View structure for optimization opportunities
- Debug UI rendering issues

#### Integration with Development Workflow

UI DevTools integrates seamlessly with standard Chromium development:

```bash
# Typical debugging session
out/Default/chrome --enable-ui-devtools --enable-logging=stderr --v=1
```

This enables both UI DevTools and verbose logging for comprehensive debugging of both UI and backend systems.

4. Tracing & Flame Charts
4.1 chrome://tracing
Record IPC, rendering, and thread-level events.

Filter by categories (--trace-startup, --trace-mem).

Export to JSON and view in the Trace Event Profiling Tool.

4.2 Perfetto (Android & Desktop)
--enable-perfetto and chrome://perfetto for system-wide tracing.

Captures kernel, GPU, and user-space events together.

5. Memory & Heap Analysis
5.1 Heap Profiling
JS heap: use DevTools’ Memory tab → Heap snapshots.

Native heap:

bash
Copy
Edit
out/Default/chrome --enable-heap-checking --heap-profiler
generates .heap files, viewable with pprof or Chrome’s heap profiler UI.

5.2 Address Sanitizer (ASan)
Enable with GN args:

gn
Copy
Edit
is_asan = true
Detects use-after-free, buffer-overflow errors at runtime.

5.3 Leak Sanitizer (LSan) & Thread Sanitizer (TSan)
Similar flags (is_lsan, is_tsan) to catch leaks and data races.

6. CPU Profiling
Sampling profiler via DevTools Performance → CPU.

In-process profiler:

bash
Copy
Edit
out/Default/chrome --prof
writes isolate-0x*.log for V8 CPU sampling.

External tools

Linux: perf record -g -- out/Default/chrome

macOS: Instruments → Time Profiler

7. GDB & Native Debugging
Launch Chrome under GDB:

bash
Copy
Edit
gdb --args out/Default/chrome --enable-logging=stderr
Set breakpoints in C++ (content/browser/..., render_process_main.cc).

Use thread apply all bt to get stacks from all threads.

8. Network & Protocol Inspection
chrome://net-export to record HTTP/QUIC traces; then view in NetLog Viewer.

chrome://webrtc-internals for WebRTC peer-connection stats.

Wireshark: enable --log-net-log and import the JSON trace.

9. Automated Tests & Debug Builds
Debug Builds (is_debug=true) include assertions and symbol info.

Unit / Browser Tests:

bash
Copy
Edit
autoninja -C out/Default content_unittests
out/Default/content_unittests --gtest_filter=YourTest.*
Instrumentation Tests run via run_local_tests.py (Android).

10. Remote & Headless Debugging
Remote Debugging

bash
Copy
Edit
out/Default/chrome --remote-debugging-port=9222
then connect DevTools to localhost:9222.

Headless Mode

bash
Copy
Edit
out/Default/chrome --headless --dump-dom https://example.com
11. Common Pitfalls & Tips
Stale binaries: remember to gn gen after changing args.

Cache issues: use --disable-application-cache or --user-data-dir=<tmp> to avoid profile interference.

DevTools hooks: use --remote-debugging-allow-hosts=* when debugging CI environments.

12. Next Steps
Pair Traces → Flame Charts with CPU profiles to correlate jank.

Use ASan/TSan in your CI builds to catch low-level bugs early.

Integrate --enable-heap-checking into nightly runs for memory leak detection.