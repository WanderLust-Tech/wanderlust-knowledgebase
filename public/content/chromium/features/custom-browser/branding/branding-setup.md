# Minimal Branding Configuration for Custom Browser

This directory contains a **minimal branding configuration** for creating a custom Chromium-based browser. The configuration focuses solely on **name changes** to minimize conflicts when applying patches to future Chromium versions.

## Current Configuration Status

### ✅ ENABLED (Minimal Branding Only)
- **Browser name**: "WanderLust Browser"
- **Company name**: "WanderLust Tech"
- **Package identifier**: `com.wanderlusttech.wanderlustbrowser`
- **Branding directory**: `wanderlust/`
- **Custom schema**: `wanderlust://`
- **Basic contact info**: support@wander-lust.tech

### ❌ DISABLED (Commented Out to Avoid Conflicts)
All advanced features have been commented out to minimize changes to Chromium source:

- Custom New Tab Page URLs
- Crash reporting systems
- Omaha/Sparkle update servers
- Custom UI modifications
- Extension system changes
- Ad blocking features
- RSS reader
- Tab shapes and vertical tabs
- Sidebar modifications
- Privacy guard features
- Mouse gestures
- Split view functionality
- Custom cache implementations

## Files Modified

### 1. Essential Configuration
- **`custom_browser_config.gni`** - Main configuration file with branding variables
  - Only basic naming variables are set
  - All advanced features are commented out
  - Backup created as `custom_browser_config.gni.backup`

### 2. Required Patches (Minimal)
- **`.gn.patch`** - Imports custom configuration into build system
- **`BUILD.gn.patch`** - Adds custom build targets
- **`.clang-format.patch`** - Adds custom header includes (optional)

## Quick Start

### 1. Apply Minimal Branding
```bash
cd src/custom
python applyMinimalBranding.py
```

### 2. Build the Browser
```bash
cd src
gn gen out/Default
ninja -C out/Default chrome
```

The resulting browser will be branded as "WanderLust Browser" with minimal changes to Chromium source.

## Conflict-Minimized Approach

This configuration follows a **conflict-minimized approach**:

1. **Only Essential Changes**: Only name-related variables are modified
2. **Advanced Features Disabled**: All UI/functionality changes are commented out
3. **Minimal Patches**: Only 2-3 essential patches are applied
4. **Easy Updates**: Future Chromium versions can be updated with minimal conflicts

## Updating to New Chromium Versions

When updating to a new Chromium version:

### 1. Backup Current Configuration
```bash
cp custom_browser_config.gni custom_browser_config.gni.backup
```

### 2. Update Chromium Source
```bash
git fetch origin
git checkout main
git pull origin main
# Or your preferred Chromium update method
```

### 3. Re-apply Minimal Patches
```bash
cd src/custom
python applyMinimalBranding.py
```

### 4. Resolve Any Conflicts
- Check if patches apply cleanly
- Manually resolve any `.rej` files if needed
- Most conflicts should be minimal due to our conservative approach

### 5. Test Build
```bash
gn gen out/Default
ninja -C out/Default chrome
```

## Enabling Additional Features

To enable more features, edit `custom_browser_config.gni` and uncomment desired features:

```gn
# Example: Enable custom sidebar
enable_sidebar = true

# Example: Enable RSS reader
enable_rss_reader = true
```

**Warning**: Enabling more features increases the risk of conflicts with future Chromium updates.

## Directory Structure

```
custom/
├── configureBranding.py          # Configuration script
├── applyMinimalBranding.py       # Patch application script
├── custom_browser_config.gni       # Main configuration (modified)
├── custom_browser_config.gni.backup # Backup of original
├── branding/                       # Brand assets
│   ├── wanderlust/                # WanderLust brand assets
│   ├── olabar/                    # Alternative brand
│   └── rebel/                     # Alternative brand
├── patches/                       # Minimal patches
│   ├── .gn.patch                 # Build system integration
│   ├── BUILD.gn.patch            # Custom build targets
│   └── .clang-format.patch       # Header includes
├── build/                         # Build scripts
└── vendor/                        # Third-party assets
```

## Branding Assets

Brand assets are located in `branding/wanderlust/`:
- Icons and logos (various sizes)
- Platform-specific resources
- Vector graphics
- Certificates and signing keys

## Build System Integration

The minimal configuration integrates with Chromium's build system via:

1. **`.gn`** - Imports `custom_browser_config.gni`
2. **`BUILD.gn`** - Adds `custom_all` build target
3. **GN variables** - Passed to build system via `custom_branding_flags`

## Development Commands

### Configuration Management
```bash
# Apply minimal branding
python configureBranding.py --minimal

# Apply with custom names
python configureBranding.py --name "My Browser" --company "My Company"

# Apply all patches
python applyMinimalBranding.py
```

### Build Commands
```bash
# Generate build files
gn gen out/Default

# Build browser
ninja -C out/Default chrome

# Build custom target
ninja -C out/Default custom_all
```

### Verification
```bash
# Check configuration
gn args out/Default --list | grep custom

# Verify branding
strings out/Default/chrome | grep "WanderLust"
```

## Troubleshooting

### Patch Application Fails
1. Check if patches are compatible with current Chromium version
2. Apply patches manually if needed
3. Update patch files for new Chromium version

### Build Failures
1. Ensure all required dependencies are installed
2. Check that custom configuration variables are properly set
3. Verify that branding assets exist in expected locations

### Branding Not Applied
1. Check that `is_custom_browser = true` in configuration
2. Verify custom branding flags are being passed to build
3. Ensure brand assets exist in `branding/wanderlust/`

## Best Practices

1. **Keep It Minimal**: Only enable features you actually need
2. **Test Regularly**: Build and test with each Chromium update
3. **Document Changes**: Keep track of any custom modifications
4. **Backup Configuration**: Always backup before making changes
5. **Monitor Conflicts**: Watch for increasing conflicts as Chromium evolves

## Contributing

When adding new features:
1. Consider the conflict impact
2. Document the feature thoroughly
3. Provide disable/enable options
4. Test with multiple Chromium versions

---

This minimal branding approach prioritizes **maintainability** and **update compatibility** over feature richness, making it easier to stay current with Chromium development while maintaining your custom brand identity.
