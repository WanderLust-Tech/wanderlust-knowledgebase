---
title: "WanderLust Browser - Debugging & Troubleshooting Guide"
description: "Comprehensive guide for debugging and troubleshooting WanderLust custom browser features and manager systems"
category: "Development"
tags: ["debugging", "troubleshooting", "visual studio", "development", "chromium"]
difficulty: "intermediate"
date: "2026-05-05"
author: "Wanderlust Team"
estimated_reading_time: "10 minutes"
---

# WanderLust Browser - Debugging & Troubleshooting Guide

This guide provides comprehensive solutions for common debugging and troubleshooting scenarios when developing with WanderLust custom browser features.

## 🔧 **Debugger Configuration**

### **Visual Studio Code Setup**

#### **Correct launch.json Configuration**

**File**: `.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Browser (Debug Build)",
      "type": "cppvsdbg",
      "request": "launch",
      "program": "${workspaceFolder}/src/out/Debug/Wanderlust.exe",
      "args": [
        "--enable-ui-devtools",
        "--enable-logging",
        "--log-level=0",
        "--v=1"
      ],
      "stopAtEntry": false,
      "cwd": "${workspaceFolder}/src/out/Debug/",
      "environment": [],
      "externalConsole": true,
      "sourceFileMap": {
        "O:/": "${workspaceFolder}/src/",
        "o:/": "${workspaceFolder}/src/",
        "/cygdrive/o/": "${workspaceFolder}/src/"
      }
    },
    {
      "name": "Debug Manager Systems",
      "type": "cppvsdbg",
      "request": "launch",
      "program": "${workspaceFolder}/src/out/Debug/Wanderlust.exe",
      "args": [
        "--enable-logging",
        "--log-level=0",
        "--v=2",
        "--vmodule=*custom*=3,*manager*=3"
      ],
      "stopAtEntry": false,
      "cwd": "${workspaceFolder}",
      "environment": [],
      "console": "internalConsole",
      "sourceFileMap": {
        "O:/": "${workspaceFolder}/src/",
        "o:/": "${workspaceFolder}/src/",
        "/cygdrive/o/": "${workspaceFolder}/src/"
      }
    }
  ]
}
```

#### **Source Path Mapping Issues**

**Problem**: Debugger shows "file not found" errors

**Root Cause**: Debug symbols contain absolute paths (e.g., `O:/build/path/`) that don't match your local filesystem

**Solution**: The `sourceFileMap` configuration maps debug symbol paths to actual file locations:

```json
"sourceFileMap": {
  "O:/": "${workspaceFolder}/src/",      // Maps O:/ drive to local src/
  "o:/": "${workspaceFolder}/src/",      // Handles lowercase
  "/cygdrive/o/": "${workspaceFolder}/src/"  // Handles Cygwin paths
}
```

---

## 🚨 **Common Startup Crashes & Solutions**

### **1. Preference Access Crash**

#### **Problem Symptoms**
```
components_prefs.dll!PrefService::GetBoolean() 
-> FATAL ERROR: Preference not registered
```

#### **Root Cause Analysis**
```
Stack Trace:
components_prefs.dll!PrefService::GetBoolean()
chrome.dll!custom::UpdateManager::LoadPreferences() Line 362
chrome.dll!custom::UpdateManager::Initialize() Line 68
chrome.dll!custom::CustomFeatureManager::InitializeAutoUpdateSystem() Line 548
```

#### **Solution Steps**

1. **Ensure Preferences are Registered BEFORE Usage**:

```cpp
// ❌ WRONG - Registering after PrefService creation
void CustomFeatureManager::InitializeAutoUpdateSystem() {
  UpdateManager::GetInstance()->RegisterPrefs(nullptr);  // TOO LATE!
}

// ✅ CORRECT - Register in browser startup
void RegisterLocalState(PrefRegistrySimple* registry) {
  custom::UpdateManager::RegisterPrefs(registry);  // BEFORE PrefService creation
}
```

2. **Fix Initialization Order**:

```cpp
// File: chrome/browser/chrome_browser_main.cc
void ChromeBrowserMainParts::PostBrowserStart() {
  // PrefService is already created at this point
  PrefService* local_state = g_browser_process->local_state();  // ✅ Available
  
  // Now safe to initialize managers that use preferences
  custom::UpdateManager::GetInstance()->Initialize(local_state);  // ✅ Works
}
```

3. **Remove Duplicate Registration**:

```cpp
// ❌ Remove this from CustomFeatureManager
void CustomFeatureManager::InitializeAutoUpdateSystem() {
  // REMOVE: UpdateManager::GetInstance()->RegisterPrefs(static_cast<PrefRegistrySimple*>(nullptr));
  
  // ✅ Just initialize without registering
  DLOG(INFO) << "Auto-update system initialized successfully";
}
```

### **2. Missing PrefService Parameter**

#### **Problem**
```
error: too few arguments to function call, single argument 'prefs' was not specified
custom::UpdateManager::GetInstance()->Initialize();  // ❌ Missing parameter
```

#### **Solution**
```cpp
// ✅ Pass the PrefService parameter
custom::UpdateManager::GetInstance()->Initialize(local_state);
```

### **3. Build Dependency Errors**

#### **Problem**
```
LINK : error LNK2019: unresolved external symbol 
"public: static void __cdecl custom::UpdateManager::RegisterPrefs"
```

#### **Solution**
Ensure proper build dependencies in `chrome/browser/BUILD.gn`:

```gni
if (is_custom_browser) {
  deps += [
    "//custom/chrome/browser/features",      # Required for manager headers
    "//custom/chrome/browser/autoupdate",   # Required for UpdateManager
    # ... other dependencies
  ]
}
```

---

## 🔍 **Debugging Manager Initialization**

### **Enable Detailed Logging**

```cpp
// Add to browser command line arguments
--enable-logging --log-level=0 --v=2 --vmodule=*custom*=3,*manager*=3
```

### **Initialization Checkpoint Logging**

```cpp
void ChromeBrowserMainParts::PostBrowserStart() {
  DLOG(INFO) << "=== WanderLust Manager Initialization Start ===";
  
  PrefService* local_state = g_browser_process->local_state();
  if (!local_state) {
    LOG(FATAL) << "PrefService not available during manager initialization";
    return;
  }
  
  DLOG(INFO) << "PrefService available, proceeding with manager initialization";
  
  // Central coordinator MUST be first
  auto* feature_manager = new custom::CustomFeatureManager(local_state);
  DLOG(INFO) << "✅ CustomFeatureManager initialized";
  
  // Initialize other managers
  custom::UpdateManager::GetInstance()->Initialize(local_state);
  DLOG(INFO) << "✅ UpdateManager initialized";
  
  // ... continue for all managers
  
  DLOG(INFO) << "=== All 14 Manager Systems Initialized Successfully ===";
}
```

### **Preference Verification**

```cpp
void UpdateManager::Initialize(PrefService* prefs) {
  if (!prefs) {
    LOG(ERROR) << "UpdateManager: Cannot initialize without PrefService";
    return;
  }
  
  // Verify preference exists before accessing
  if (!prefs->FindPreference(kAutoUpdateEnabledPref)) {
    LOG(FATAL) << "UpdateManager: Preference not registered: " << kAutoUpdateEnabledPref;
    return;
  }
  
  DLOG(INFO) << "UpdateManager: Preferences verified, loading configuration";
  LoadPreferences();
}
```

---

## 🧪 **Build System Troubleshooting**

### **Clean Build Issues**

#### **Problem**: Changes not taking effect after rebuild

#### **Solution**: 
```bash
# Clean build directories
rm -rf src/out/Debug
rm -rf src/out/Release

# Regenerate build files
cd src
gn gen out/Debug --args='is_custom_browser=true is_debug=true'
gn gen out/Release --args='is_custom_browser=true is_debug=false'

# Rebuild
ninja -C out/Debug chrome
```

### **BuildFlag Configuration Issues**

#### **Problem**: Features not compiling due to BuildFlag errors

#### **Verification Script**:
```bash
# Check if custom buildflags are generated
ls src/out/Debug/gen/custom/buildflags/

# Should contain:
# - custom_browser_buildflags.h
# - custom_features_buildflags.h
```

#### **Manual BuildFlag Verification**:
```cpp
// Add to debug build to verify flags
#include "custom/buildflags/custom_browser_buildflags.h"
#include "custom/buildflags/custom_features_buildflags.h"

void VerifyBuildFlags() {
#if BUILDFLAG(CUSTOM_BROWSER)
  DLOG(INFO) << "✅ CUSTOM_BROWSER is enabled";
#else
  DLOG(ERROR) << "❌ CUSTOM_BROWSER is disabled";
#endif

#if BUILDFLAG(CUSTOM_DOWNLOAD_MANAGER)
  DLOG(INFO) << "✅ CUSTOM_DOWNLOAD_MANAGER is enabled";
#endif
  // ... verify other flags
}
```

---

## 📊 **Performance Debugging**

### **Manager Initialization Performance**

```cpp
// Add timing measurements
void ChromeBrowserMainParts::PostBrowserStart() {
  auto start_time = base::TimeTicks::Now();
  
  // Initialize managers...
  new custom::CustomFeatureManager(local_state);
  auto feature_manager_time = base::TimeTicks::Now() - start_time;
  
  custom::UpdateManager::GetInstance()->Initialize(local_state);
  auto update_manager_time = base::TimeTicks::Now() - start_time - feature_manager_time;
  
  DLOG(INFO) << "Manager initialization times:";
  DLOG(INFO) << "  CustomFeatureManager: " << feature_manager_time.InMilliseconds() << "ms";
  DLOG(INFO) << "  UpdateManager: " << update_manager_time.InMilliseconds() << "ms";
  
  auto total_time = base::TimeTicks::Now() - start_time;
  DLOG(INFO) << "Total manager initialization: " << total_time.InMilliseconds() << "ms";
}
```

### **Memory Usage Monitoring**

```cpp
void PerformanceManager::LogMemoryUsage() {
  base::SystemMemoryInfoKB memory_info;
  if (base::GetSystemMemoryInfo(&memory_info)) {
    DLOG(INFO) << "System Memory Usage:";
    DLOG(INFO) << "  Total: " << memory_info.total / 1024 << " MB";
    DLOG(INFO) << "  Available: " << memory_info.available / 1024 << " MB";
    DLOG(INFO) << "  Free: " << memory_info.free / 1024 << " MB";
  }
  
  // Log browser process memory
  size_t browser_memory = GetBrowserProcessMemoryUsage();
  DLOG(INFO) << "Browser Process Memory: " << browser_memory / 1024 / 1024 << " MB";
}
```

---

## 🔧 **Testing & Validation**

### **Manager System Integration Test**

```cpp
// Test file: custom_browser_integration_test.cc
class CustomBrowserIntegrationTest : public InProcessBrowserTest {
protected:
  void SetUpCommandLine(base::CommandLine* command_line) override {
    command_line->AppendSwitch(switches::kEnableCustomBrowser);
    command_line->AppendSwitchASCII(switches::kLogLevel, "0");
  }
};

IN_PROC_BROWSER_TEST_F(CustomBrowserIntegrationTest, AllManagersInitialized) {
  // Verify all 14 managers are properly initialized
  EXPECT_TRUE(custom::CustomFeatureManager::GetInstance() != nullptr);
  EXPECT_TRUE(custom::UpdateManager::GetInstance() != nullptr);
  EXPECT_TRUE(custom::PerformanceManager::GetInstance() != nullptr);
  EXPECT_TRUE(custom::SystemLifecycleManager::GetInstance() != nullptr);
  // ... test all managers
}

IN_PROC_BROWSER_TEST_F(CustomBrowserIntegrationTest, PreferencesAccessible) {
  auto* prefs = g_browser_process->local_state();
  ASSERT_TRUE(prefs != nullptr);
  
  // Verify key preferences are registered and accessible
  EXPECT_TRUE(prefs->FindPreference("custom.auto_update.enabled"));
  EXPECT_TRUE(prefs->FindPreference("custom.auto_update.check_interval_hours"));
  
  // Test preference values
  bool auto_update_enabled = prefs->GetBoolean("custom.auto_update.enabled");
  EXPECT_TRUE(auto_update_enabled);  // Default should be true
}
```

### **Feature Flag Test**

```cpp
IN_PROC_BROWSER_TEST_F(CustomBrowserIntegrationTest, FeatureFlagsWorking) {
  auto* feature_manager = custom::CustomFeatureManager::GetInstance();
  ASSERT_TRUE(feature_manager != nullptr);
  
  // Test feature enable/disable
  EXPECT_TRUE(feature_manager->IsFeatureEnabled("AutoUpdate"));
  feature_manager->DisableFeature("AutoUpdate");
  EXPECT_FALSE(feature_manager->IsFeatureEnabled("AutoUpdate"));
  feature_manager->EnableFeature("AutoUpdate");
  EXPECT_TRUE(feature_manager->IsFeatureEnabled("AutoUpdate"));
}
```

---

## 🚦 **Health Check Commands**

### **Browser Health Verification**

Add these debug commands to verify system health:

```cpp
// Command line: --custom-health-check
void RunCustomHealthCheck() {
  DLOG(INFO) << "=== WanderLust Browser Health Check ===";
  
  // 1. Check manager initialization
  bool all_managers_ok = true;
  all_managers_ok &= (custom::CustomFeatureManager::GetInstance() != nullptr);
  all_managers_ok &= (custom::UpdateManager::GetInstance() != nullptr);
  // ... check all 14 managers
  
  DLOG(INFO) << "Manager Systems: " << (all_managers_ok ? "✅ OK" : "❌ FAIL");
  
  // 2. Check preference system
  auto* prefs = g_browser_process->local_state();
  bool prefs_ok = (prefs != nullptr);
  if (prefs_ok) {
    prefs_ok &= (prefs->FindPreference("custom.auto_update.enabled") != nullptr);
  }
  DLOG(INFO) << "Preference System: " << (prefs_ok ? "✅ OK" : "❌ FAIL");
  
  // 3. Check feature flags
  bool features_ok = custom::CustomFeatureManager::GetInstance()->IsFeatureEnabled("SystemHealthCheck");
  DLOG(INFO) << "Feature Flags: " << (features_ok ? "✅ OK" : "❌ FAIL");
  
  // Overall status
  bool overall_health = all_managers_ok && prefs_ok && features_ok;
  DLOG(INFO) << "Overall Health: " << (overall_health ? "✅ HEALTHY" : "❌ UNHEALTHY");
}
```

---

## 📚 **Quick Reference**

### **Common Debug Commands**
```bash
# Basic debugging
--enable-logging --log-level=0

# Verbose custom system logging  
--v=2 --vmodule=*custom*=3,*manager*=3

# Memory debugging
--enable-heap-profiling --enable-memory-testing

# UI debugging
--enable-ui-devtools --auto-open-devtools-for-tabs
```

### **Key Files to Check**
- `chrome/browser/prefs/browser_prefs.cc` - Preference registration
- `chrome/browser/chrome_browser_main.cc` - Manager initialization  
- `chrome/browser/BUILD.gn` - Build dependencies
- `custom/custom_browser_config.gni` - Feature configuration

### **Manager Status Check**
```cpp
// Quick manager availability check
bool IsManagerSystemHealthy() {
  return custom::CustomFeatureManager::GetInstance() &&
         custom::UpdateManager::GetInstance() &&
         custom::PerformanceManager::GetInstance();
         // ... check others as needed
}
```

---

*This troubleshooting guide covers the most common issues encountered during WanderLust custom browser development and debugging.*