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

## 7. Common Issues & Comprehensive Troubleshooting

This section covers common problems encountered during Chromium source code download, synchronization, and build setup, with practical solutions based on real-world experience.

### 7.1 Basic Setup Issues

| Symptom | Possible Fix |
|---------|-------------|
| `fetch is not found` | Ensure depot_tools is in your PATH |
| `gclient sync errors out` | Delete `src/.gclient_entries` and retry |
| `GN complains about bad args` | Run `gn args out/Default --list` to verify flags |
| `Out-of-memory during build` | Lower `-j` jobs or increase swap space |

### 7.2 Network and SSL/TLS Issues

Network instability is one of the most common causes of Chromium source download failures. These issues typically manifest as SSL/TLS errors, connection timeouts, or partial download failures.

#### SSL/TLS Decryption Errors

**Common Error Pattern**:
```bash
error: RPC failed; curl 56 OpenSSL SSL_read: error:1408F119:SSL routines:ssl3_get_record:decryption failed or bad record mac, errno 0
fatal: The remote end hung up unexpectedly
fatal: early EOF
fatal: index-pack failed
```

**Root Cause**: This error typically occurs due to:
1. Network instability causing connection interruptions
2. Incompatible SSL/TLS protocol versions
3. Git compiled with GnuTLS instead of OpenSSL

**Solution 1: Recompile Git with OpenSSL**
If you're experiencing persistent SSL decryption errors, recompile Git with libcurl using OpenSSL instead of GnuTLS:

```bash
# Remove existing Git installation
sudo apt-get remove git

# Install dependencies
sudo apt-get install make libssl-dev libghc-zlib-dev libcurl4-openssl-dev libncurses5-dev autoconf build-essential gettext

# Download and compile Git with OpenSSL
cd /tmp
wget https://github.com/git/git/archive/v2.43.0.tar.gz
tar -xzf v2.43.0.tar.gz
cd git-2.43.0

# Configure with OpenSSL
make configure
./configure --with-openssl --with-curl --prefix=/usr/local

# Compile and install
make all
sudo make install

# Verify installation
/usr/local/bin/git --version
```

**Solution 2: Update Git Configuration for TLS Version**
Configure Git to use a specific TLS version:

```bash
# Set TLS version to 1.2 (recommended)
git config --global http.sslVersion tlsv1.2

# Alternative: Set minimum TLS version
git config --global http.minTlsVersion tlsv1.2

# Verify configuration
git config --global --list | grep ssl
```

#### CIPD (Chrome Infrastructure Package Deployment) Errors

**Common Error Pattern**:
```bash
[P76426 19:14:44.681 client.go:439 E] Response body limit 181 exceeded.
{"host":"chrome-infra-packages.appspot.com", "method":"ResolveVersion", "service":"cipd.Repository"}
Errors:
  failed to resolve chromium/third_party/android_deps/libs/androidx_legacy_legacy_support_v4@version:1.0.0-cr0 (line 127): prpc: response too big
Error: Command 'cipd ensure -log-level error -root /home/zsm/vivaldi-source -ensure-file /tmp/tmp9wmcrr1a.ensure' returned non-zero exit status 1
```

**Solution**: Disable automatic depot_tools updates temporarily:

```bash
# Disable depot_tools auto-update
export DEPOT_TOOLS_UPDATE=0

# Then retry gclient sync
gclient sync --nohooks --no-history

# To re-enable auto-updates later (optional)
unset DEPOT_TOOLS_UPDATE
```

#### Protocol Version Errors

**Common Error Pattern**:
```bash
fatal: unable to access 'https://chromium.googlesource.com/external/github.com/kennethreitz/requests.git/': error:1409442E:SSL routines:ssl3_read_bytes:tlsv1 alert protocol version
error: Could not fetch origin
```

**Solution**: This indicates the server doesn't support the TLS protocol version being used by your Git client.

```bash
# Update Git to use TLS 1.2
git config --global http.sslVersion tlsv1.2

# If the above doesn't work, try forcing TLS 1.3
git config --global http.sslVersion tlsv1.3

# Alternative: Disable SSL verification (NOT RECOMMENDED for production)
# Only use this as a last resort and re-enable SSL verification afterwards
git config --global http.sslVerify false
```

### 7.3 Download Interruption and Recovery

#### Handling Partial Downloads

**Problem**: Large repository downloads often get interrupted, leading to corrupted partial downloads.

**Solution**: Use robust retry mechanisms and incremental sync:

```bash
# For initial checkout with retry capability
fetch chromium --nohooks --no-history

# If fetch fails, clean up and retry
rm -rf src
fetch chromium --nohooks --no-history

# For ongoing synchronization with better error handling
gclient sync --nohooks --no-history --with_branch_heads --verbose
```

#### Network Timeout Configuration

Configure Git for better handling of slow or unstable networks:

```bash
# Increase HTTP timeout (default is 60 seconds)
git config --global http.lowSpeedLimit 1000
git config --global http.lowSpeedTime 300

# Increase post buffer size for large pushes
git config --global http.postBuffer 524288000

# Enable connection reuse
git config --global http.keepAlive true

# Set retry attempts
git config --global http.maxRequestBuffer 100M
```

### 7.4 Repository State Issues

#### Corrupted Repository State

**Symptoms**: 
- `gclient sync` fails with unclear errors
- Repository appears to be in an inconsistent state
- Missing dependencies or outdated hooks

**Solution**: Reset repository state:

```bash
# Clean up gclient state
cd /path/to/chromium/src
gclient sync --delete_unversioned_trees --reset --upstream

# If problems persist, force clean state
rm -f .gclient_entries
gclient sync --nohooks --force

# Update hooks after successful sync
gclient runhooks
```

#### Disk Space Issues

**Problem**: Chromium source code requires substantial disk space (20+ GB).

**Solution**: Monitor and manage disk usage:

```bash
# Check current repository size
du -sh /path/to/chromium

# Clean build artifacts
ninja -C out/Default -t clean

# Remove old build directories
rm -rf out/old_build_name

# Use shallow clone for space savings (initial checkout only)
fetch chromium --nohooks --no-history
```

### 7.5 Platform-Specific Issues

#### Windows-Specific Problems

**Long Path Names**:
```powershell
# Enable long path support (requires Admin privileges)
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force

# Configure Git for long paths
git config --global core.longpaths true
```

**Antivirus Interference**:
- Add Chromium source directory to antivirus exclusions
- Temporarily disable real-time scanning during initial download

#### Linux-Specific Problems

**Package Dependencies**:
```bash
# Install required packages for Ubuntu/Debian
sudo apt-get install curl lsb-release sudo

# For CentOS/RHEL
sudo yum install curl redhat-lsb-core sudo
```

### 7.6 Advanced Troubleshooting Techniques

#### Enable Verbose Logging

```bash
# Enable verbose Git output
export GIT_TRACE=1
export GIT_TRACE_PACKET=1
export GIT_TRACE_CURL=1

# Enable verbose gclient output
gclient sync --verbose --nohooks

# Disable verbose logging when done
unset GIT_TRACE GIT_TRACE_PACKET GIT_TRACE_CURL
```

#### Network Diagnostics

```bash
# Test connectivity to Chromium servers
curl -I https://chromium.googlesource.com/

# Check DNS resolution
nslookup chromium.googlesource.com

# Test with different DNS servers
dig @8.8.8.8 chromium.googlesource.com
```

#### Proxy and Firewall Issues

If you're behind a corporate proxy or firewall:

```bash
# Configure Git to use proxy
git config --global http.proxy http://proxy.company.com:port
git config --global https.proxy https://proxy.company.com:port

# Configure proxy authentication
git config --global http.proxy http://username:password@proxy.company.com:port

# Remove proxy configuration
git config --global --unset http.proxy
git config --global --unset https.proxy
```

### 7.7 Emergency Recovery Procedures

#### Complete Repository Reset

When all else fails, perform a complete clean reset:

```bash
# Backup any local changes first
cd /path/to/chromium/src
git stash push -u -m "backup before reset"

# Complete repository reset
cd ..
rm -rf src
fetch chromium --nohooks --no-history
cd src
gclient runhooks

# Restore local changes if needed
git stash pop
```

#### Alternative Download Methods

If standard methods fail completely:

```bash
# Try shallow clone with minimal history
git clone --depth 1 https://chromium.googlesource.com/chromium/src.git

# Or use pre-packaged source archives (if available)
# Check Chromium release pages for tarball downloads
```

### 7.8 Prevention and Best Practices

#### Stable Network Environment

1. **Use wired connection** when possible for initial download
2. **Monitor network stability** before starting large downloads
3. **Schedule downloads** during off-peak hours for better bandwidth
4. **Use download acceleration** tools if available in your region

#### Regular Maintenance

```bash
# Regular repository cleanup (weekly)
gclient sync --delete_unversioned_trees

# Update depot_tools regularly
depot_tools/update_depot_tools

# Monitor repository health
gclient sync --dry-run --verbose
```

#### Backup Strategies

```bash
# Create backup of working repository
tar -czf chromium-backup-$(date +%Y%m%d).tar.gz /path/to/chromium

# Or use rsync for incremental backups
rsync -av --progress /path/to/chromium/ /backup/location/
```

### 7.9 Getting Additional Help

If you continue experiencing issues:

1. **Check official documentation**: [Chromium Build Instructions](https://chromium.googlesource.com/chromium/src/+/main/docs/)
2. **Search existing issues**: [Chromium Bug Tracker](https://bugs.chromium.org/)
3. **Community forums**: Stack Overflow, Reddit r/chromium_dev
4. **Corporate support**: If building for enterprise use, consider professional support options

## 8. Next Steps

- **Optimization**: Learn about [Build Performance & Optimization](build-performance-optimization.md) for faster builds
- Dive into Project Layout: see how src/ is organized
- Explore Architecture → Process Model: understand multi-process design
- Try a Debug Build and play with logging flags

