# Custom Feature Manager

`CustomFeatureManager` is a `KeyedService` that owns the lifecycle of all WanderLust-specific runtime subsystems and exposes a unified API for enabling or disabling custom features per-profile.

## Build flag

The entire system is compiled only when `custom_feature_management_enabled = true` in `src/custom/custom_browser_config.gni`. At the C++ level this surfaces as:

```cpp
#include "custom/buildflags/custom_features_buildflags.h"
#if BUILDFLAG(ENABLE_ENHANCED_FEATURE_MANAGEMENT)
// ...
#endif
```

The corresponding raw preprocessor define `CUSTOM_FEATURE_MANAGEMENT_ENABLED=1` is injected by `config("custom_feature_config")` in [src/custom/chrome/browser/features/BUILD.gn](../../src/custom/chrome/browser/features/BUILD.gn) for code that cannot use the buildflag header.

## Startup flow

`CustomFeatureManager` is constructed in `ChromeBrowserMainParts::PostBrowserStart()` with the profile's `PrefService`. The constructor calls `Initialize()` which runs in this order:

1. `RegisterFeatures()` — populates `managed_features_` map (name → `base::Feature*`)
2. `ApplyFeatureOverrides()` — replays any pref-stored overrides onto the command line
3. `WanderLustPlatformUtil::InitializePerformanceOptimizations()`
4. `InitializeAutoUpdateSystem()`
5. `InitializeSecurityPolicySystem()`
6. `InitializePerformanceSystem()`
7. `InitializeLifecycleSystem()`
8. `InitializeNetworkSystem()`
9. `InitializeInputSystem()`

All subsystems are shut down in `Shutdown()` (called by the `KeyedService` framework during profile teardown) in reverse order.

## Feature state lookup

`IsFeatureEnabled(name)` uses a **pref-first** policy:

```
if pref_service has "custom_browser.features.<name>"
    return pref value          // user/admin override wins
else
    return base::FeatureList::IsEnabled(feature)  // compile-time default
```

This means overrides survive restarts and can be managed via policy without touching the command line at runtime.

## Runtime overrides

`base::FeatureList` is immutable after browser startup. To let `SetFeatureEnabled()` take effect immediately for the *next* session, `ApplyFeatureOverride()` manipulates the `--enable-features` / `--disable-features` command-line switches directly:

1. Remove the feature name from whichever switch currently lists it.
2. Append it to the opposite switch, merging with any existing comma-separated values.

The preference is also written so the override is replayed on future launches via step 2 of the startup flow above.

## Subsystems

| Subsystem | Key classes | Guard |
|---|---|---|
| Auto-update | `UpdateManager`, `UpdateNotificationUI` | `kAutoUpdateEnabled` feature |
| Security policy | `SecurityPolicyManager`, `UrlAccessController`, `FunctionControlManager` | `kSecurityPolicyEnforcement` feature |
| Performance | `PerformanceManager` | `kPerformanceManagement` feature |
| Lifecycle | `SystemLifecycleManager` | `kSystemLifecycleManagement` feature |
| Network / DNS | `PrivateDnsManager`, `DomainAuthIntegration`, `NetworkEventMonitor` | `kNetworkEnhancementEnabled` feature |
| Input / events | `AcceleratorManager`, `XPathLoginDetector`, `EventMonitor`, `DevToolsIntegration` | `kAdvancedInputHandling` feature |

### Security policy subsystem

The security subsystem is split into three singletons:

- **`SecurityPolicyManager`** — loads/saves the full `SecurityPolicyConfig` struct to prefs under the `custom_security.*` prefix. Call `GetPolicyConfiguration()` / `SetPolicyConfiguration()` to read or write the active policy.
- **`UrlAccessController`** — enforces allow/block URL pattern lists. Call `IsUrlAllowed(url)` at navigation time.
- **`FunctionControlManager`** — enforces function restrictions (cut/copy, print, save, right-click). Query `IsCutCopyEnabled()` etc. from the relevant UI handlers.

Security prefs are registered in `custom::RegisterProfilePrefs()` ([src/custom/browser/prefs/custom_prefs.cc](../../src/custom/browser/prefs/custom_prefs.cc)) via `SecurityPolicyManager::RegisterPrefs(registry)`. They must be registered before `CustomFeatureManager` is constructed.

Pref keys (all under `PrefService` for the profile):

| Pref | Type | Default |
|---|---|---|
| `custom_security.url_filtering` | bool | false |
| `custom_security.popup_blocking` | bool | false |
| `custom_security.popup_block_level` | int | 0 |
| `custom_security.enforce_domain` | bool | false |
| `custom_security.enterprise_domain` | string | "" |
| `custom_security.cut_copy` | bool | true |
| `custom_security.print` | bool | true |
| `custom_security.save_file` | bool | true |
| `custom_security.mouse_right_button` | bool | true |

## Adding a new managed feature

**1. Declare the feature** in [src/custom/chrome/browser/features/custom_feature_manager.h](../../src/custom/chrome/browser/features/custom_feature_manager.h):

```cpp
namespace features {
BASE_DECLARE_FEATURE(kMyNewFeature);
}
```

**2. Define it** in [src/custom/chrome/browser/features/custom_feature_manager.cc](../../src/custom/chrome/browser/features/custom_feature_manager.cc):

```cpp
BASE_FEATURE(kMyNewFeature, "MyNewFeature", base::FEATURE_ENABLED_BY_DEFAULT);
```

**3. Register it** in `RegisterFeatures()`:

```cpp
managed_features_["MyNewFeature"] = &features::kMyNewFeature;
```

That's it. `IsFeatureEnabled("MyNewFeature")` and `SetFeatureEnabled("MyNewFeature", false)` will work automatically, including pref persistence and command-line override injection.

**4. Add a GN flag** (optional, for compile-time gating) in `src/custom/custom_browser_config.gni`:

```gn
custom_my_new_feature = true
```

And a corresponding define in `config("custom_feature_config")` in [src/custom/chrome/browser/features/BUILD.gn](../../src/custom/chrome/browser/features/BUILD.gn):

```gn
if (custom_my_new_feature) {
  defines += [ "CUSTOM_MY_NEW_FEATURE=1" ]
}
```

## Adding a new subsystem

1. Create the subsystem under `//custom/chrome/browser/<subsystem>/` with its own `BUILD.gn`.
2. Add `"//custom/chrome/browser/<subsystem>:<subsystem>"` to [features/BUILD.gn](../../src/custom/chrome/browser/features/BUILD.gn) deps (conditionally guarded if appropriate).
3. Add `Initialize<Subsystem>()` and `Shutdown<Subsystem>()` methods to `CustomFeatureManager`.
4. Call them from `Initialize()` and `Shutdown()` in the correct order.
5. If the subsystem uses prefs, call `MySubsystem::RegisterPrefs(registry)` from `custom::RegisterProfilePrefs()` in [src/custom/browser/prefs/custom_prefs.cc](../../src/custom/browser/prefs/custom_prefs.cc).
