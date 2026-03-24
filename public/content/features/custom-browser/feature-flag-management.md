# Feature Flag Management System

## Overview

The Feature Flag Management System provides centralized control over Chromium feature flags through build-time configuration and runtime preferences. This system replaces the original patch's hardcoded feature overrides with a modern, configurable approach.

## Architecture

- **Location**: `src/custom/chrome/browser/features/custom_feature_manager.*`
- **Pattern**: Singleton with preference integration
- **Build Integration**: `custom_browser_config.gni` configuration flags

## Features

### Core Capabilities
- ✅ **Centralized Configuration**: All feature flags controlled from `custom_browser_config.gni`
- ✅ **Build-time Control**: Compile-time feature enablement/disablement
- ✅ **Runtime Preferences**: Optional runtime configuration through preferences
- ✅ **Chromium Compatibility**: Uses standard Chromium feature flag mechanisms

### Supported Feature Flags
1. **Tab Hover Cards**: Control tab hover preview functionality
2. **Reader Mode**: Enable/disable reader mode features
3. **Enhanced Scrolling**: Control custom scroll animation behavior
4. **JavaScript Controls**: Enable advanced JavaScript content management
5. **Download Options**: Enable enhanced download management features

## Configuration

### Build-time Configuration (`custom_browser_config.gni`)
```gn
# Feature Flag Management System
custom_feature_management_enabled = true

# Individual feature controls
custom_disable_tab_hover_cards = true
custom_enable_reader_mode = true
custom_enhanced_scrolling = true  
custom_javascript_controls = true
custom_download_options = true
```

### Compile-time Defines
The build system automatically generates compile-time defines:
```cpp
#define CUSTOM_FEATURE_MANAGEMENT_ENABLED 1
#define DISABLE_TAB_HOVER_CARDS 1
#define ENABLE_READER_MODE 1
// ... additional defines based on configuration
```

## API Reference  

### CustomFeatureManager Class

#### Initialization
```cpp
// Get singleton instance
CustomFeatureManager* manager = CustomFeatureManager::GetInstance();

// Initialize (called automatically during browser startup)
manager->Initialize();
```

#### Feature State Query
```cpp
// Check if feature management is enabled
bool enabled = manager->IsFeatureManagementEnabled();

// Check specific feature states
bool hover_cards_disabled = manager->IsTabHoverCardsDisabled();
bool reader_mode_enabled = manager->IsReaderModeEnabled();
```

#### Runtime Configuration
```cpp
// Update feature configuration (if runtime changes are supported)
FeatureConfig config;
config.tab_hover_cards_enabled = false;
config.reader_mode_enabled = true;
manager->UpdateConfiguration(config);
```

## Integration with Original Patch

The original patch directly modified `base/feature_list.cc`:
```cpp
// Original patch approach (deprecated)
RegisterOverride("TabHoverCards", FeatureList::OVERRIDE_DISABLE_FEATURE, nullptr);
RegisterOverride("ReaderMode", FeatureList::OVERRIDE_ENABLE_FEATURE, nullptr);
```

The modernized approach uses the Custom Feature Manager:
```cpp
// Modern approach
#ifdef DISABLE_TAB_HOVER_CARDS
  CustomFeatureManager::GetInstance()->DisableTabHoverCards();
#endif

#ifdef ENABLE_READER_MODE  
  CustomFeatureManager::GetInstance()->EnableReaderMode();
#endif
```

## Benefits Over Original Patch

### Maintainability
- **No Core Chromium Modifications**: Avoids patching `base/feature_list.cc`
- **Future-proof**: Compatible with Chromium updates
- **Centralized Configuration**: Single source of truth for feature settings

### Flexibility  
- **Build-time Control**: Features can be enabled/disabled without code changes
- **Runtime Configuration**: Optional preference-based feature control
- **Conditional Compilation**: Unused features don't impact binary size

### Professional Architecture
- **Chromium Patterns**: Uses standard Chromium singleton and preference patterns
- **Testability**: Isolated functionality that can be unit tested
- **Documentation**: Self-documenting through clear API design

## Development Workflow

### Adding New Feature Flags
1. Add configuration option to `custom_browser_config.gni`
2. Update `BUILD.gn` to include new compile-time define
3. Add corresponding method to `CustomFeatureManager`
4. Implement feature flag logic in appropriate Chromium integration points

### Testing Feature Flags
```bash
# Build with specific feature configuration
npm run build

# Verify feature flags are applied correctly
# Check browser behavior matches expected configuration
```

## Migration from Original Patch

The Feature Flag Management System replaces the original patch's direct `base/feature_list.cc` modifications:

### Original Approach Problems
- ❌ Required modifying core Chromium files
- ❌ Hardcoded feature overrides
- ❌ Difficult to maintain across Chromium updates
- ❌ No build-time configurability

### Modern Solution Benefits
- ✅ No core Chromium file modifications
- ✅ Build-time configurable feature flags
- ✅ Compatible with Chromium update cycles  
- ✅ Professional singleton architecture
- ✅ Extensible for future feature additions

## Related Components

- **Enhanced Scroll Manager**: Uses feature flags for scroll animation control
- **JavaScript Controller**: Controlled by feature flag system
- **Reader Mode Manager**: Enabled/disabled through feature flags
- **Download Manager**: Advanced features controlled by feature flags

## See Also

- [Enhanced Scroll Animation System](enhanced-scroll-animations.md)
- [JavaScript Content Controls](javascript-content-controls.md) 
- [Reader Mode Integration](reader-mode-integration.md)
- [Custom Browser Configuration](../build-system/configuration.md)