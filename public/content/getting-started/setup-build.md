# Setup & Build

This guide shows you how to fetch, build, and run Chromium from source on **Linux**, **macOS**, or **Windows**.

---

## 1. Prerequisites

Before you begin, make sure you have:

- A supported OS:
  - **Linux**: Ubuntu 20.04+ or equivalent
  - **macOS**: 10.15+ (Intel or Apple Silicon)
  - **Windows**: 10 (x64)
- **Disk space**: At least 30 GB free
- **RAM**: ≥ 8 GB (16 GB+ recommended)
- **Tools**:
  - **Python 3.8+** (for build scripts)
  - **Git** (2.25+)
  - **Depot Tools** (Google’s repo of Chromium helper scripts)

### 1.1 Installing Depot Tools

```bash
# Clone Depot Tools somewhere in your PATH:
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git ~/depot_tools
export PATH="$PATH:$HOME/depot_tools"
# (Add the export line to your shell rc: ~/.bashrc, ~/.zshrc, or PowerShell profile)
```

## 2. Fetching the Source

### 2.1 Create a working directory:

```bash
mkdir -p ~/chromium && cd ~/chromium
```

### 2.2 Fetch the code:

```bash
fetch --nohooks chromium
cd src
```

### 2.3 Install additional hooks:

```bash
gclient sync --with_branch_heads --with_tags
```

## 3. Configuring Your Build

Chromium uses GN for meta-build configuration and Ninja as the build engine.

### 3.1 Generate build files:

```bash
gn gen out/Default --args='
  is_debug=false            # or true for a debug build
  symbol_level=1            # 0=no symbols, 1=debug symbols only
  is_component_build=true   # modules are built as shared libs
'
```

### 3.2 Common args:

```text
is_debug=true               # Debug build (with assertions & logging)
is_official_build=false     # Disable Google-branded splash screens
enable_nacl=false           # Disable Native Client (optional)
remove_webcore_debug_symbols=true  # Strip extra symbols
```

### 4. Building

From the src/ directory:

```bash
ninja -C out/Default chrome
```

- -C out/Default tells Ninja where your build files live.
- chrome is the target; you can also build content_shell, browser_tests, etc.

Tip: On multi-core machines you can speed up builds:

```bash
ninja -C out/Default -j8
```

(where 8 ≈ number of CPU cores)

## 5. Running Your Build

- Linux & macOS:

```bash
out/Default/chrome        # Launches your custom build
```

- Windows (PowerShell):

```powershell
.\out\Default\chrome.exe
```

You can pass any Chromium CLI flags, for example:

```bash
out/Default/chrome --enable-logging --v=1
```

## 6. Iterating & Incremental Builds

After code changes, simply rerun:

```bash
ninja -C out/Default
```

Ninja only rebuilds what’s necessary, so incremental iterations are fast.

## 7. Common Issues & Troubleshooting

Symptom	Possible Fix
fetch is not found	Ensure depot_tools is in your PATH
gclient sync errors out	Delete src/.gclient_entries and retry
GN complains about bad args	Run gn args out/Default --list to verify flags
Out-of-memory during build	Lower -j jobs or increase swap space

## 8. Next Steps

- **Optimization**: Learn about [Build Performance & Optimization](build-performance-optimization.md) for faster builds
- Dive into Project Layout: see how src/ is organized
- Explore Architecture → Process Model: understand multi-process design
- Try a Debug Build and play with logging flags

