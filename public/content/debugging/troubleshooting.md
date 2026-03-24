---
title: "Custom Browser Troubleshooting"
description: "Common issues, solutions, and troubleshooting techniques for the Wanderlust Custom Browser project"
category: "Debugging" 
tags: ["troubleshooting", "issues", "solutions", "debugging", "problems"]
difficulty: "beginner"
date: "2025-01-15"
author: "Wanderlust Team"
estimated_reading_time: "8 minutes"
---

# Troubleshooting Guide

## Common Issues and Solutions

This guide covers common problems encountered during development and their solutions.

## Environment Setup Issues

### Git Not Found

#### Symptoms
```
ERROR: git command not found
ERROR: Git is required but not available
```

#### Solutions
1. **Install Git for Windows**
   ```powershell
   # Download from https://git-scm.com/download/win
   # Or using Chocolatey
   choco install git
   ```

2. **Add Git to PATH**
   ```powershell
   # Add to system PATH
   $env:PATH += ";C:\Program Files\Git\bin"
   
   # Verify installation
   git --version
   ```

3. **Restart Command Prompt/PowerShell**
   - Close and reopen terminal after installation
   - Verify Git is available: `git --version`

### Python Issues

#### Python Not Found
```
ERROR: Python is not properly configured
ERROR: 'python' is not recognized as an internal or external command
```

**Solutions**:
```powershell
# Install Python 3.8+ from python.org
# Or using Microsoft Store
# Or using Chocolatey
choco install python

# Verify installation
python --version
pip --version
```

#### Python Module Import Errors
```
ModuleNotFoundError: No module named 'rich'
ModuleNotFoundError: No module named 'click'
```

**Solutions**:
```powershell
# Install Python dependencies
pip install -r requirements.txt

# Or install individually
pip install rich click aiohttp packaging
```

#### Python Path Issues
```
ERROR: No module named 'lib'
ImportError: attempted relative import with no known parent package
```

**Solutions**:
- Ensure you're running scripts from project root directory
- Use `python -m` prefix for module execution:
  ```powershell
  python -m lib.logger_demo
  ```

### NPM and Node.js Issues

#### NPM Not Found
```
ERROR: NPM is not available
'npm' is not recognized as an internal or external command
```

**Solutions**:
```powershell
# Install Node.js (includes NPM)
# Download from https://nodejs.org
# Or using Chocolatey
choco install nodejs

# Verify installation
node --version
npm --version
```

#### NPM Permission Issues
```
EACCES: permission denied
npm ERR! Error: EACCES: permission denied, mkdir
```

**Solutions**:
```powershell
# Run as Administrator (temporary)
# Or configure NPM global directory
npm config set prefix %APPDATA%\npm
```

### Visual Studio Build Tools

#### MSVC Compiler Not Found
```
ERROR: Microsoft Visual Studio not found
ERROR: Cannot find cl.exe
```

**Solutions**:
1. **Install Visual Studio Build Tools**
   - Download Visual Studio Build Tools
   - Select "C++ build tools" workload
   - Include Windows 10/11 SDK
   - Include CMake tools

2. **Verify Installation**
   ```powershell
   # Find cl.exe
   where cl.exe
   
   # Should return path like:
   # C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\...\bin\Hostx64\x64\cl.exe
   ```

3. **Environment Setup**
   ```powershell
   # Run Visual Studio Developer Command Prompt
   # Or source the environment script:
   & "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
   ```

## Build Process Issues

### Initialization Failures

#### Repository Clone Failures
```
ERROR: Failed to clone repository
fatal: unable to access 'https://github.com/...': SSL certificate problem
```

**Solutions**:
1. **Network Configuration**
   ```bash
   # Configure Git to handle SSL
   git config --global http.sslbackend schannel
   
   # Or disable SSL verification (not recommended for production)
   git config --global http.sslverify false
   ```

2. **Corporate Firewall/Proxy**
   ```bash
   # Configure Git proxy
   git config --global http.proxy http://proxy.company.com:8080
   git config --global https.proxy http://proxy.company.com:8080
   ```

3. **Authentication Issues**
   ```bash
   # Use personal access token instead of password
   git config --global credential.helper manager-core
   ```

#### Timeout Issues
```
ERROR: npm install failed
ERROR: Operation timed out
Command timed out after 7200.0 seconds: npm.cmd
Command timed out after 7200 seconds: gclient.bat
```

**Solutions**:
```powershell
# For NPM timeouts
npm config set timeout 300000

# Use different registry
npm config set registry https://registry.npmjs.org/

# Clear NPM cache
npm cache clean --force
```

**Sync Operation Timeouts (Automatic Retry)**:
The initialization script now handles gclient sync timeouts automatically:
- **Initial attempt**: 2 hours timeout
- **Retry 1**: 3 hours timeout  
- **Retry 2**: 4.5 hours timeout
- **Total possible time**: Up to 9.5 hours across all attempts
- **Progress indication**: Look for "Operation completed over X objects" messages

**Patch Application Timeouts**:
Patch application now has extended timeouts and better error handling:
- **Timeout**: 30 minutes for applying all patches (70+ patch files)
- **Progress tracking**: Shows [X/Y] patch application progress
- **Circular dependency protection**: Prevents infinite loops in patch application
- **Fallback mechanism**: Direct patch application if script method fails

**What to do during sync timeouts**:
1. **Let it retry automatically** - The script handles retries without interruption
2. **Monitor progress** - Sync will show progress even during long operations
3. **Check network stability** - Ensure stable internet for large Chromium downloads
4. **Be patient** - Initial sync can take hours depending on connection speed
5. **Watch for patch progress** - Look for "[X/Y] Applying patch" messages during patch application

### Source Synchronization Issues

#### gclient sync Failures
```
ERROR: gclient sync failed
Error: Command 'gclient sync' returned non-zero exit status 1
```

**Automatic Retry Behavior**:
The initialization script now automatically retries failed sync operations:
- Handles timeout scenarios with progressive timeout increases
- Provides clear feedback about retry attempts
- Continues from where the sync left off when possible

**Manual Solutions if all retries fail**:
1. **Clean and Retry**
   ```powershell
   # Clean gclient state
   Remove-Item -Recurse -Force .gclient_entries
   
   # Retry initialization
   npm run init
   ```

2. **Patch Application Issues**
   ```powershell
   # If patches fail to apply, try manual patch application
   cd src/custom
   python build/commands/lib/applyPatches.py --print-patch-failures-in-json
   
   # Check for conflicting changes
   git status
   git diff
   ```

3. **Disk Space Issues**
   ```powershell
   # Check available disk space (Chromium needs ~50GB)
   Get-PSDrive C
   
   # Clean temporary files if needed
   Remove-Item -Recurse -Force $env:TEMP\*
   ```

3. **Network Issues**
   ```bash
   # Configure gclient for slow networks
   gclient config --spec 'solutions=[{"name":"src","url":"https://github.com/chromium/chromium","managed":False}]'
   ```

#### Patch Application Failures
```
ERROR: Failed to apply patch
error: patch failed: depot_tools/upload_to_google_storage_first_class.py:123
```

**Solutions**:
1. **Check Patch Compatibility**
   ```powershell
   # Verify patch files exist
   Get-ChildItem patches\*.patch
   
   # Check depot_tools version
   gclient version
   ```

2. **Manual Patch Application**
   ```powershell
   # Apply patches manually
   cd src\custom
   git apply ..\..\patches\depot_tools_upload_regex_fix.patch
   ```

### Build Failures

#### Version Script Argument Errors
```
ERROR: version.py: error: Unexpected arguments: ['--eval', ...]
FAILED: gen/base/check_version_internal.h
```

**Problem**: `custom_process_version_arguments` in `custom_browser_config.gni` uses wrong format.

**Solution**:
```gni
# CORRECT format in custom_browser_config.gni:
custom_process_version_arguments = [
  "-e", "CUSTOM_BROWSER_NAME=\"${custom_browser_name}\"",
  "-e", "CUSTOM_BROWSER_COMPANY=\"${custom_browser_company}\"",
  "-e", "CUSTOM_PACKAGE=\"${custom_package}\"",
]

# INCORRECT format (causes error):
custom_process_version_arguments = [
  "--eval=CUSTOM_BROWSER_NAME=\"${custom_browser_name}\"",
]
```
```powershell
# After fixing, clean build directory:
Remove-Item -Recurse -Force out\Debug
npm run build
```

#### GN Duplicate Definition Errors
```
ERROR at //build/config/BUILDCONFIG.gn:763:5: Duplicate definition
```

**Solutions**:
1. **Rename Conflicting Targets**
   ```gn
   # In BUILD.gn, rename duplicate targets:
   # OLD: create_branded_grd("ios_strings") { ... }
   #      create_branded_grd("ios_strings") { ... }  # DUPLICATE!
   
   # NEW: Unique names with descriptive suffixes
   create_branded_grd("ios_strings_app") { ... }
   create_branded_grd("ios_strings_extension") { ... }
   ```

#### Missing Resource File Errors
```
ERROR: ninja: error: '../../custom/app/generated_resources.grdp', missing
```

**Solutions**:
1. **Create Missing .grdp Files**
   ```xml
   <!-- Create src/custom/app/generated_resources.grdp -->
   <?xml version="1.0" encoding="utf-8"?>
   <grit-part>
     <message name="IDS_PRODUCT_NAME" desc="Application name">
       Wanderlust Browser
     </message>
   </grit-part>
   ```

2. **Fix .grd File Paths**
   ```gn
   # Use $root_gen_dir for generated files in BUILD.gn:
   # CORRECT:
   sources = [ "$root_gen_dir/custom/generated_resources/generated_resources.grd" ]
   
   # INCORRECT:
   sources = [ "//custom/app/generated_resources.grd" ]
   ```

#### GN Configuration Errors
```
ERROR: gn gen failed
ERROR: Unable to load "//build/config/BUILDCONFIG.gn"
```

**Solutions**:
1. **Check Build Arguments**
   ```bash
   # Verify args.gn file
   cat out/Release/args.gn
   
   # Regenerate with minimal arguments
   gn gen out/Release --args="is_debug=false"
   ```

2. **Clean Build Directory**
   ```powershell
   # Remove and recreate build directory
   Remove-Item -Recurse -Force out
   New-Item -Type Directory out\Release
   
   # Regenerate build files
   npm run build
   ```

#### Ninja Build Errors
```
ERROR: ninja build failed
FAILED: obj/chrome/browser/browser_static_lib.lib
```

**Solutions**:
1. **Check Available Resources**
   ```powershell
   # Check memory usage (build needs 16GB+ RAM)
   Get-Process | Sort-Object WS -Descending | Select-Object -First 10
   
   # Check disk space
   Get-PSDrive C
   ```

2. **Reduce Build Parallelism**
   ```bash
   # Build with fewer parallel jobs
   ninja -j4 -C out/Release chrome
   
   # Or single-threaded for debugging
   ninja -j1 -v -C out/Release chrome
   ```

3. **Clean Build**
   ```powershell
   # Clean and rebuild
   ninja -C out/Release -t clean
   npm run build
   ```

## Performance Issues

### Build Performance

#### Slow Builds
```
# Symptoms: Build takes hours instead of minutes
# Build process appears stuck
```

**Solutions**:
1. **Windows Defender Exclusions**
   ```powershell
   # Run as Administrator
   cd scripts\av
   .\setup-defender-exclusions.ps1
   
   # Verify exclusions
   Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
   ```

2. **Disk I/O Optimization**
   ```powershell
   # Use SSD for build directory if available
   # Disable real-time scanning for build directories
   # Close unnecessary applications during build
   ```

3. **Build Configuration**
   ```gn
   # Use component builds for development
   is_component_build = true
   
   # Disable symbols if not needed
   symbol_level = 0
   
   # Use minimal configuration
   enable_nacl = false
   ```

#### Memory Issues
```
FATAL ERROR: Reached heap limit
ninja: build stopped: subcommand failed
```

**Solutions**:
```powershell
# Increase virtual memory
# Close other applications
# Reduce build parallelism:
ninja -j2 -C out/Release chrome

# Use component builds to reduce memory usage
gn gen out/Release --args="is_component_build=true"
```

### Development Performance

#### Slow Script Execution
```
# Python scripts run slowly
# Long delays during initialization
```

**Solutions**:
1. **Antivirus Exclusions**
   ```powershell
   # Add project directory to antivirus exclusions
   # Disable real-time scanning for development folders
   ```

2. **Optimize Python Environment**
   ```powershell
   # Use virtual environment
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

## Network and Connectivity Issues

### Repository Access

#### GitHub Access Issues
```
ERROR: Failed to connect to github.com
fatal: unable to access 'https://github.com/...': Could not resolve host
```

**Solutions**:
1. **DNS Configuration**
   ```powershell
   # Use public DNS servers
   # Google DNS: 8.8.8.8, 8.8.4.4
   # Cloudflare DNS: 1.1.1.1, 1.0.0.1
   ```

2. **Corporate Network**
   ```bash
   # Configure corporate proxy
   git config --global http.proxy http://proxy:port
   npm config set proxy http://proxy:port
   npm config set https-proxy http://proxy:port
   ```

3. **Alternative Access Methods**
   ```bash
   # Use SSH instead of HTTPS
   git config --global url."git@github.com:".insteadOf "https://github.com/"
   
   # Or use GitHub CLI
   gh auth login
   ```

### Download Failures

#### Slow Downloads
```
# Chromium source download very slow
# Timeout during large file downloads
```

**Solutions**:
```bash
# Use shallow clone for faster initial download
gclient sync --no-history --shallow

# Configure larger timeout
git config --global http.lowSpeedLimit 1000
git config --global http.lowSpeedTime 300
```

## Debugging Techniques

### Verbose Logging

#### Enable Debug Output
```python
# In Python scripts
import logging
logging.basicConfig(level=logging.DEBUG)

# Use logger debug methods
from lib.logger import logger
logger.debug("Debug information")
```

#### Script Debugging
```powershell
# Run with Python debugger
python -m pdb scripts\init.py

# Add debug prints
python -v scripts\init.py  # Verbose Python execution
```

### Build Debugging

#### GN Debugging
```bash
# Show GN trace
gn gen out/Release --tracelog=trace.json

# Analyze GN configuration
gn desc out/Release chrome
gn args out/Release --list
```

#### Ninja Debugging
```bash
# Show Ninja commands
ninja -v -C out/Release chrome

# Show dependency graph  
ninja -C out/Release -t graph chrome | dot -Tpng > graph.png

# Show build statistics
ninja -C out/Release -t compdb chrome > compile_commands.json
```

## Prevention and Best Practices

### Environment Maintenance

#### Regular Updates
```powershell
# Update Python dependencies
pip install --upgrade -r requirements.txt

# Update NPM packages
npm update

# Update Git
git update-git-for-windows
```

#### System Cleanup
```powershell
# Clean build artifacts
ninja -C out/Release -t clean

# Clean NPM cache
npm cache clean --force

# Clean Python cache
python -c "import sys; print(sys.path)"
Remove-Item -Recurse __pycache__
```

### Development Hygiene

#### Project State Management
```powershell
# Regular git status checks
git status

# Keep branches clean
git branch --merged | Remove-Item

# Regular dependency updates
npm audit fix
```

## Feature-Specific Issues

### RSS Feed Support Problems

#### RSS TabHelper Not Attached

**Symptoms**:
- RSS feeds not detected on any website
- No RSS InfoBar appearing
- Debug logs missing RSS TabHelper initialization

**New Tab Page Hanging Issue**:
- Browser hangs when loading first new tab page
- Unresponsive UI during new tab creation
- High CPU usage on new tab

**Diagnosis**:
   ```bash
   # Check if ENABLE_RSS_READER build flag is enabled
   grep -r "BUILDFLAG_INTERNAL_ENABLE_RSS_READER.*1" out/Release/gen/custom/buildflags/
   ```

**Solutions**:

**For New Tab Page Hanging**:
1. **RSS URL Filtering** (Fixed in latest build):
   ```cpp
   // RSS TabHelper now automatically skips special URLs
   // Located in: src/custom/components/rss/rss_tab_helper.cc
   bool ShouldSkipRSSProcessing(const GURL& url) const {
     // Excludes chrome://, chrome-extension://, about:, data:, file:// URLs
   }
   ```

2. **Verify Fix Applied**:
   ```bash
   # Check for RSS URL filtering logs
   ./out/Release/chrome.exe --enable-logging --vmodule=rss*=2
   # Should see: "Skipping RSS processing for: chrome://newtab/"
   ```

**For General RSS Issues**:

1. **Verify Build Flag Configuration**:
   ```gn
   # Check custom_browser_config.gni
   enable_rss_reader = true  # Should be true
   ```

2. **Rebuild with RSS Enabled**:
   ```powershell
   # Clean build and regenerate
   Remove-Item -Recurse -Force out/Release
   npm run build -- --enable_rss_reader=true
   ```

3. **Check TabHelper Patch Applied**:
   ```bash
   # Verify tab_helpers.cc patch is applied
   grep -n "RSSDelegateImpl::AttachTabHelperIfNeeded" src/chrome/browser/ui/tab_helpers.cc
   ```

#### RSS Extension API Not Available

**Symptoms**:
- Extensions cannot access RSS functionality
- RSS API missing from chrome://extensions-internals/
- Extension API errors in console

**Diagnosis**:
```javascript
// Test in browser console
chrome.rss === undefined  // Should be false if RSS API is available
```

**Solutions**:

1. **Check Extension API Patch**:
   ```bash
   # Verify API factory registration patch
   grep -n "RSSAPIFactory::GetInstance" \
     src/chrome/browser/extensions/api/api_browser_context_keyed_service_factories.cc
   ```

2. **Verify Build Dependencies**:
   ```gn
   # Check browser BUILD.gn includes RSS dependencies
   grep -A5 -B5 "enable_rss_reader" src/chrome/browser/BUILD.gn
   ```

3. **Restart Browser Completely**:
   ```bash
   # Close all browser processes
   taskkill /f /im chrome.exe
   # Restart with fresh profile
   ./out/Release/chrome.exe --user-data-dir=./debug-profile --enable-logging
   ```

#### RSS Commands Not Working

**Symptoms**:
- RSS menu items not appearing
- Keyboard shortcuts not working
- IDC_SHOW_RSS command not found

**Diagnosis**:
```bash
# Check command IDs are defined
grep -n "IDC.*RSS" src/chrome/app/chrome_command_ids.h
```

**Solutions**:

1. **Verify Command ID Patch**:
   ```bash
   # Should find RSS command definitions
   grep -n "IDC_OPEN_RSS_LIST\|IDC_SHOW_RSS" src/chrome/app/chrome_command_ids.h
   ```

2. **Check Menu Integration**:
   - Ensure browser menu files include RSS commands
   - Verify command.cc files handle RSS commands

3. **Clear Browser State**:
   ```powershell
   # Clear browser state and preferences
   Remove-Item -Recurse -Force debug-profile/
   ```

### Build Flag Issues

#### Build Flag Not Generated

**Symptoms**:
```cpp
// Compiler error
error: 'BUILDFLAG_INTERNAL_ENABLE_RSS_READER' is not defined
```

**Solutions**:

1. **Check GNI Flag Definition**:
   ```gn
   # In custom_browser_config.gni
   declare_args() {
     enable_rss_reader = true  # Must be properly declared
   }
   ```

2. **Verify BuildFlag Header Target**:
   ```gn
   # In buildflags/BUILD.gn  
   buildflag_header("custom_features_buildflags") {
     header = "custom_features_buildflags.h"
     flags = [ "ENABLE_RSS_READER=$enable_rss_reader" ]
   }
   ```

3. **Include BuildFlag Header**:
   ```cpp
   // In C++ files using the flag
   #include "custom/buildflags/custom_features_buildflags.h"
   ```

4. **Add BuildFlag Dependency**:
   ```gn
   # In component BUILD.gn
   deps = [
     "//custom/buildflags:custom_features_buildflags",
   ]
   ```

#### Conflicting Build Flags

**Symptoms**:
```
ERROR: Multiple definitions of build flag ENABLE_RSS_READER
```

**Solutions**:

1. **Check Duplicate Definitions**:
   ```bash
   # Search for duplicate flag definitions
   grep -r "ENABLE_RSS_READER" --include="*.gn" --include="*.gni" src/
   ```

2. **Consolidate Flag Definitions**:
   ```gn
   # Keep only one definition in custom_browser_config.gni
   enable_rss_reader = true
   ```

3. **Fix Import Order**:
   ```gn
   # Ensure custom_browser_config.gni is imported before use
   import("//custom/custom_browser_config.gni")
   ```

### Patch Integration Issues

#### Patch Application Failures

**Symptoms**:
```bash
error: patch does not apply cleanly to src/chrome/browser/ui/tab_helpers.cc
```

**Solutions**:

1. **Check Chromium Version Compatibility**:
   ```bash
   # Verify Chromium version matches patch expectations
   git log --oneline -1  # Check current Chromium commit
   ```

2. **Manual Patch Resolution**:
   ```bash
   # Apply patch manually if automatic application fails
   cd src/
   patch -p1 < ../patches/chrome-browser-ui-tab_helpers.cc.patch
   ```

3. **Update Patch for New Chromium**:
   ```bash
   # Create new patch after manual integration
   git diff > ../patches/chrome-browser-ui-tab_helpers.cc.patch
   ```

#### Missing Integration Points

**Symptoms**:
- Feature builds but doesn't integrate with browser
- No automatic feature activation
- Manual feature initialization required

**Solutions**:

1. **Verify All Integration Patches Applied**:
   ```bash
   # Check critical integration points
   grep -n "RSS" src/chrome/browser/ui/tab_helpers.cc
   grep -n "RSS" src/chrome/app/chrome_command_ids.h
   grep -n "RSS" src/chrome/browser/extensions/api/api_browser_context_keyed_service_factories.cc
   ```

2. **Add Missing Integration Code**:
   ```cpp
   // Add to appropriate Chromium integration points
   #if BUILDFLAG(ENABLE_RSS_READER)
     CustomFeature::Initialize();
   #endif
   ```

3. **Test Integration Manually**:
   ```cpp
   // Add test code to verify integration
   #if BUILDFLAG(ENABLE_RSS_READER)
     LOG(INFO) << "RSS feature successfully integrated";
   #endif
   ```

### Debug and Logging Issues

#### Missing RSS Debug Output

**Symptoms**:
- No RSS-related log messages  
- Debug console silent for RSS operations
- Cannot trace RSS execution flow

**RSS Crash on Financial Times (Jump List Error)**:

**Symptoms**:
- Browser crashes when viewing RSS feeds (especially Financial Times)
- Error: `Check failed: window.tabs.empty()` in jumplist.cc:447
- Fatal error during tab lifecycle management
- Crash occurs during RSS processing with InfoBar creation

**Root Cause**: Asynchronous RSS JavaScript callbacks interfering with tab cleanup during browser shutdown or navigation, causing race condition with Windows Jump List functionality.

**Solutions**:

1. **Enable Verbose RSS Logging**:
   ```bash
   # Launch with RSS debug logging
   ./out/Release/chrome.exe --enable-logging --vmodule=rss*=2
   ```

2. **Add Debug Logging to RSS Components**:
   ```cpp
   // Add to RSS source files
   #include "base/logging.h"
   
   VLOG(1) << "RSS TabHelper initialized for " << url.spec();
   DLOG(INFO) << "RSS feed detected: " << feed_url;
   ```

3. **Check Log File Location**:
   ```bash
   # Logs are typically in user data directory
   tail -f debug-profile/chrome_debug.log | grep RSS
   ```

## RSS-Specific Crash Fixes\n\n### Jump List Crash When Viewing RSS Feeds\n\n**Error Signature**: `Check failed: window.tabs.empty()` in jumplist.cc:447\n\n**Affected Scenarios**: \n- Viewing Financial Times RSS feed\n- Any RSS feed processing during tab transitions\n- InfoBar creation during browser shutdown\n\n**Root Cause**: Race condition between asynchronous RSS JavaScript callbacks and Windows Jump List tab lifecycle management.\n\n**Fix Applied** (Latest build):\n```cpp\n// Enhanced safety checks in OnDOMInspectionDone callback\n// Better error logging: \"Tab may be closing\" messages\n// Additional URL filtering to prevent conflicts\n```\n\n**Verification**:\n```bash\n# Test with detailed logging\n./out/Debug/chrome.exe --enable-logging --vmodule=rss*=2\n\n# Look for these improved messages:\n# \"Tab may be closing\" instead of generic errors\n# \"Skipping RSS processing for special URL\"\n```\n\n**Status**: ✅ **Fixed** - RSS crash prevention implemented\n\n---\n\n## Prevention Best Practices

### Code Integration

#### Before Making Changes
- Test with both feature enabled and disabled
- Verify all build flags are properly configured  
- Check that patches apply cleanly
- Run integration tests for affected components

#### After Making Changes
- Test feature functionality end-to-end
- Verify clean builds with feature disabled
- Update documentation for new integration points  
- Create regression tests for critical pathways

### Build Management
- Regular dependency updates
npm audit fix
```

#### Documentation
- Keep this troubleshooting guide updated
- Document new issues and solutions
- Share solutions with team members
- Update project documentation regularly

## Getting Help

### Community Resources
- **Chromium Development Documentation**: https://chromium.googlesource.com/chromium/src/+/main/docs/
- **GitHub Issues**: Report bugs and get help
- **Stack Overflow**: Search for similar problems

### Internal Resources
- Check project README.md for updates
- Review [Development Guide](./development-guide.md) for setup instructions
- Consult [Architecture Guide](./architecture.md) for system understanding
- Reference [Scripts Reference](./scripts-reference.md) for detailed script documentation

### Emergency Recovery

#### Complete Environment Reset
```powershell
# 1. Remove all generated files
Remove-Item -Recurse -Force src, out, .gclient_entries

# 2. Clean NPM state
Remove-Item -Recurse -Force node_modules
npm cache clean --force

# 3. Reinstall dependencies
npm install
npm run install:python

# 4. Reinitialize project
npm run init
```

#### Backup and Recovery
```powershell
# Create backup before major changes
Compress-Archive -Path . -DestinationPath backup-$(Get-Date -Format 'yyyyMMdd').zip

# Restore from backup if needed
Expand-Archive -Path backup-20240205.zip -DestinationPath restored/
```