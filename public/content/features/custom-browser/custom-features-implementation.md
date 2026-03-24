# Custom Browser Features Implementation

## Overview

The `src/custom` directory contains the core custom implementations for the WanderLust browser, providing a comprehensive set of features that enhance and customize the Chromium base. This documentation catalogs all implemented features, their architecture, and integration patterns.

## 🏗️ Architecture Overview

The custom implementation follows Chromium's architectural patterns by:

- **Mirroring Directory Structure**: Custom components follow the same organization as Chromium core
- **Conditional Compilation**: Uses `BUILDFLAG(CUSTOM_BROWSER)` for selective feature activation
- **Minimal Patches**: Only essential integration points are patches to maintain update compatibility
- **Component-Based Design**: Features are modularized into discrete components

## 📁 Directory Structure

```
src/custom/
├── android/                     # Android-specific customizations
├── app/                         # Application-level configurations
├── base/                        # Base utilities and foundations
├── branding/                    # Multi-brand support system
├── browser/                     # Browser-level customizations
├── build/                       # Build system modifications
├── chrome/                      # Chrome-specific customizations
├── components/                  # Reusable feature components
├── content/                     # Content layer customizations
├── demos/                       # Feature demonstrations
├── extensions/                  # Extension system modifications
├── installer/                   # Installation system customizations
├── net/                         # Network layer modifications
├── patches/                     # Integration patches
├── renderer/                    # Renderer process customizations
├── resources/                   # Custom resources and assets
├── services/                    # Service layer implementations
├── third_party/                 # Third-party integrations
├── tools/                       # Development and build tools
├── ui/                          # User interface customizations
└── vector_icons/               # Custom vector icons
```

## 🎨 Branding System

### Multi-Brand Support
The custom browser supports multiple brand configurations:

- **WanderLust** (Default): Primary browser brand with travel-oriented branding
- **OlaBar**: Alternative browser variant
- **Rebel**: Reference implementation for minimal branding approach

### Key Files
- **`custom_browser_config.gni`**: Central configuration for branding parameters
- **`branding/BRANDING`**: Branding template file for build system integration
- **`branding/createBrandedGrd.py`**: Automated resource generation for brands
- **`branding/wanderlust/`**: WanderLust-specific assets and resources

### Features
- Conditional product naming and branding
- Custom application icons and themes
- Brand-specific configuration templates
- Automated resource generation per brand

## 🔧 Core Browser Features

### 1. RSS Feed Support
**Location**: `components/rss/` + `browser/rss/` + `browser/ui/webui/reader/`

#### Implementation
- **RSSTabHelper**: Core RSS detection and management functionality
- **RSSInfoBarDelegate**: User interface for RSS feed discovery notifications
- **RSSDelegate**: Abstraction layer for RSS operations
- **RSSService**: Backend service for RSS feed management and storage
- **RSSServiceFactory**: Profile-based RSS service instantiation
- **RSS Reader WebUI**: Built-in RSS reader interface

#### Features
- ✅ **Fully Functional** - Automatic RSS feed detection on web pages
- ✅ Information bar notifications for discovered feeds
- ✅ JavaScript-based validation of RSS content
- ✅ Complete RSS subscription and management system
- ✅ Built-in RSS reader at `wanderlust://reader/`
- ✅ OPML import/export functionality
- ✅ User preference integration and configuration

#### Files
- `rss_tab_helper.h/.cc`: Main RSS detection functionality
- `rss_infobar_delegate.h/.cc`: InfoBar notification components  
- `rss_delegate.h`: Interface abstraction
- `pref_names.h`: RSS-related preference definitions
- **Backend Services**:
  - `browser/rss/rss_service.h/.cc`: Core RSS backend service
  - `browser/rss/rss_service_factory.h/.cc`: Service factory
  - `browser/rss/rss_feed.h/.cc`: Feed data management
- **WebUI Reader**:
  - `browser/ui/webui/reader/reader_ui.h/.cc`: WebUI interface
  - `browser/ui/webui/reader/reader_dom_handler.h/.cc`: DOM manipulation

### 2. Privacy Guard
**Location**: `components/privacy_guard/`

#### Implementation
- **URL Purification**: Removes tracking parameters from URLs
- **Rule-Based System**: Configurable rules for URL cleaning
- **Default Rules**: Pre-configured tracking parameter removal

#### Features
- Automatic removal of common tracking parameters
- Configurable rule system for custom privacy protections
- URL purification without breaking functionality
- Integration with navigation system

#### Files
- `url_purify_rule.h/.cc`: Core rule definition and processing
- `url_purify_rule_parser.h/.cc`: Rule parsing and validation
- `url_purify_default_rules.h/.cc`: Default privacy protection rules

### 3. Vertical Tabs UI
**Location**: `components/vertical_tabs_ui/`

#### Implementation
- **React/TypeScript Interface**: Modern UI built with React and TypeScript
- **Vite Integration**: Fast development and build system
- **Chrome Extension Architecture**: Utilizes Chrome's extension system

#### Features
- Vertical tab layout option for users
- Modern React-based interface
- TypeScript for type safety
- Hot reload development environment

#### Files
- `page/vertical_tabs_page.tsx`: Main React interface component
- `page/vertical_tabs_page.html`: HTML container for React app
- `tsconfig.json`: TypeScript configuration
- `BUILD.gn`: Build system integration

### 4. Custom Settings UI
**Location**: `components/custom_settings_ui/`

#### Implementation
- Enhanced settings interface for custom browser features
- Integration with Chrome's settings architecture
- Custom preference management

### 5. Enhanced Omnibox
**Location**: `components/omnibox/`

#### Implementation
- Custom search and navigation enhancements
- Enhanced URL formatting and display
- Custom search provider integration

## 🆕 Modernized Browser Features (v1.1.0)

### 6. Feature Flag Management System
**Location**: `chrome/browser/features/custom_feature_manager.*`

#### Implementation
- **Centralized Configuration**: Build-time control over Chromium feature flags via `custom_browser_config.gni`
- **Modern Architecture**: Singleton pattern with preference integration
- **Conditional Compilation**: Feature-specific defines based on GN args

#### Features
- ✅ **Tab Hover Cards Control**: Disable/enable tab hover card feature
- ✅ **Reader Mode Control**: Enable/disable reader mode functionality
- ✅ **Build-time Configuration**: All features configurable via GN build flags
- ✅ **Preference Integration**: Runtime preference system support

#### Configuration Options
```gn
custom_feature_management_enabled = true
custom_disable_tab_hover_cards = true
custom_enable_reader_mode = true
```

### 7. Enhanced Scroll Animation System
**Location**: `chrome/browser/features/custom_scroll_manager.*`

#### Implementation
- **Configurable Parameters**: Customizable scroll animation duration and velocity
- **Animation Curve Control**: Support for different easing functions (ease-in-out, linear, etc.)
- **Command-line Support**: Runtime configuration via command-line switches

#### Features
- ✅ **Custom Duration Control**: Configurable scroll animation timing (default: 30ms)
- ✅ **Velocity Parameters**: Enhanced scroll velocity settings (default: 700px)
- ✅ **Runtime Configuration**: Command-line switches for fine-tuning
- ✅ **Backward Compatibility**: Graceful fallback to default Chromium behavior

#### Configuration Options
```gn
custom_enhanced_scrolling = true
custom_smooth_scroll_duration = 30.0
custom_smooth_scroll_velocity = 700.0
```

### 8. JavaScript Content Control System  
**Location**: `chrome/browser/features/custom_javascript_controller.*`

#### Implementation
- **Content Settings Integration**: Uses Chromium's modern content settings system
- **Per-page Controls**: Granular JavaScript control per URL/domain
- **Command Integration**: Browser command system integration
- **WebContents Observer**: Real-time navigation monitoring

#### Features  
- ✅ **Per-page JavaScript Blocking**: Block/allow JavaScript on specific pages
- ✅ **Content Settings Integration**: Uses HostContentSettingsMap for persistence
- ✅ **Browser Command Support**: Command IDs 35080 (Block), 35081 (Default), 35082 (Allow)
- ✅ **Real-time Application**: Immediate JavaScript state changes

#### Command Integration
```cpp
IDC_PAGE_BLOCK_JAVASCRIPT = 35080
IDC_PAGE_DEFAULT_JAVASCRIPT = 35081  
IDC_PAGE_ALLOW_JAVASCRIPT = 35082
```

### 9. Advanced Download Management
**Location**: `chrome/browser/features/custom_download_manager.*`

#### Implementation
- **Observer Pattern**: Event-driven architecture for download state monitoring  
- **Enhanced Shelf Management**: Improved download shelf behavior and controls
- **Custom Options Dialog**: Advanced download configuration interface
- **Profile Integration**: Per-profile download settings and preferences

#### Features
- ✅ **Auto-hide Download Shelf**: Automatically hide shelf when downloads complete
- ✅ **Enhanced Notifications**: Improved download completion notifications
- ✅ **Custom Download Paths**: User-configurable download directories
- ✅ **Advanced Options Dialog**: Rich download configuration interface
- ✅ **Download Item Controls**: Per-download custom settings

#### Configuration Options
```gn
custom_download_options = true
custom_download_shelf_enhanced = true
```

### 10. Reader Mode Integration
**Location**: `chrome/browser/features/custom_reader_mode_manager.*`

#### Implementation
- **DOM Distiller Integration**: Uses Chromium's dom_distiller components
- **Auto-detection System**: Automatic article content recognition
- **WebContents Observer**: Page navigation and content monitoring
- **State Management**: Per-tab reader mode state tracking

#### Features
- ✅ **Automatic Article Detection**: Smart content analysis for reader suitability
- ✅ **Content Distillation**: Article extraction and formatting
- ✅ **Reader Mode State Management**: Per-tab reader mode states
- ✅ **Command Integration**: Browser command integration (Command ID: 35083)
- ✅ **Enhanced Readability**: Clean, distraction-free reading experience

#### Reader Mode States
```cpp
enum class ReaderModeState {
  kNotAvailable = 0,
  kAvailable = 1, 
  kActive = 2,
  kDistilling = 3,
  kError = 4
};
```

#### Command Integration
```cpp
IDC_PAGE_DISTILL = 35083  // Enter Reader Mode command
```

### Build Integration Summary
All modernized features integrate with the Custom Browser build system through:

- **`chrome/browser/features/BUILD.gn`**: Unified build target with conditional compilation
- **Feature-specific Defines**: Compile-time feature enablement via GN args
- **Dependency Management**: Proper dependency chains for Chromium components
- **Cross-platform Support**: Compatible with Chromium's cross-platform architecture

## 🔒 API Integration Features

### Google API InfoBar Suppression
**Implementation**: Core Chromium API integration modification

#### Purpose
Eliminates confusing "Google API keys missing" warning banners that are inappropriate for custom browsers not using Google services.

#### Features
- Professional browser startup without Google-specific warnings
- Maintains clean interface without technical error messages
- Conditional compilation integration using `BUILDFLAG(CUSTOM_BROWSER)`
- Non-breaking implementation that preserves all functionality

#### Implementation Details
- **File Modified**: `chrome/browser/ui/startup/infobar_utils.cc`
- **Pattern**: Conditional compilation around Google API key validation
- **Impact**: 2-line change with significant user experience improvement

## 🛠️ Build System Integration

### Configuration Management
- **`custom_browser_config.gni`**: Central configuration file (427+ lines)
- **`sources.gni`**: Source file management for custom components
- **`custom_grit_args.gni`**: Resource compilation arguments
- **`custom_paks.gni`**: Resource packaging configuration

### Conditional Compilation
- Extensive use of `BUILDFLAG(CUSTOM_BROWSER)` for feature gating
- String handling macros in `build/buildflag.h`
- Channel-specific build configurations

### Development Tools
- **Vite Integration**: Modern development server for UI components
- **TypeScript Support**: Full TypeScript compilation pipeline
- **Python Tooling**: Automation scripts for resource generation

## 📦 Third-Party Integrations

### Vendor Directory
**Location**: `vendor/`
- External dependencies and libraries
- Custom modifications to third-party components
- Integration scripts and utilities

### Extension System
**Location**: `extensions/`
- Custom extension APIs
- Enhanced extension capabilities
- Security and permission modifications

## 🔄 Update Compatibility

### Minimal Patch Strategy
The implementation follows a "Rebel-style" minimal branding approach:

- **~70 lines of changes** across core Chromium files
- **Conditional compilation** prevents conflicts during updates
- **Isolated custom code** in separate directory structure
- **Clean integration points** for essential functionality

### Documentation
- **REBEL_STYLE_IMPLEMENTATION_SUMMARY.md**: Implementation methodology
- **Analysis files**: Detailed analysis of reference implementations
- **Migration guides**: Update compatibility strategies

## 📊 Feature Status Matrix

| Component | Status | Integration | Documentation | Recent Updates |
|-----------|--------|-------------|---------------|----------------|
| RSS Support | ✅ Complete | Tab Helper + WebUI | Full | **March 2026** - Restored processing logic, fixed build integration |
| Privacy Guard | ✅ Complete | URL Processing | Full | - |
| Vertical Tabs | ✅ Complete | React/TS UI | Full | - |
| Custom Settings | ✅ Complete | Settings API | Partial | - |
| Multi-Branding | ✅ Complete | Build System | Full | - |
| Google API Suppression | ✅ Complete | InfoBar System | Full | - |
| Enhanced Omnibox | 🔄 In Progress | Search API | Partial | - |

## 🚀 Development Workflow

### Adding New Features
1. Create feature directory in appropriate `components/` subdirectory
2. Follow Chromium directory structure conventions
3. Add `BUILD.gn` for build system integration
4. Update `sources.gni` with new file references
5. Use conditional compilation for integration points
6. Document implementation in feature-specific README

### Directory Naming Conventions
- **Feature components**: `components/feature_name/`
- **Browser integrations**: `chrome/browser/feature_name/`
- **UI components**: `ui/views/feature_name/`
- **Service implementations**: `services/feature_name/`

## 📋 Integration Patterns

### Component Registration
Components integrate with Chromium through established patterns:
- **Tab Helpers**: For per-tab functionality (RSS, Privacy Guard)
- **InfoBar Delegates**: For user notifications and interactions
- **Settings Integration**: For user preference management
- **Build System**: For resource compilation and packaging

### Service Architecture
- **Delegate Pattern**: For abstract interface implementation
- **Observer Pattern**: For event-driven functionality
- **Factory Pattern**: For component instantiation
- **Strategy Pattern**: For configurable behavior

## 🔍 Future Development

### Planned Features
- Enhanced password management
- Advanced privacy controls
- Custom download management
- Improved bookmark organization
- Custom New Tab Page

### Architecture Improvements
- Enhanced TypeScript integration
- Expanded React component library
- Improved build system performance
- Better development tooling

## 📚 References

- **Chromium Architecture**: Standard Chromium component patterns
- **Rebel Browser**: Reference implementation for minimal patching
- **Build System**: GN build system integration patterns
- **TypeScript/React**: Modern UI development stack

---

*Last Updated: March 2026*
*Maintainer: WanderLust Browser Development Team*