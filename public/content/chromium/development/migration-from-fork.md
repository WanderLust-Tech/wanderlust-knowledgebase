# Migration from Direct Chromium Fork to Patch-Based Architecture

This guide explains how to migrate from an older custom Chromium repository (direct fork) to the modern patch-based architecture used in this project.

## Overview

### Old Approach (Direct Fork)
- Single repository that is a clone/fork of Chromium
- Custom changes applied directly to Chromium source files
- Difficult to update to newer Chromium versions
- Manual merge conflicts when updating
- Large repository size with full Chromium history

### New Approach (Patch-Based)
- Separate repositories for build system and custom code
- Vanilla Chromium synced via depot_tools/gclient
- Custom code in isolated `src/custom/` directory
- Integration via patches and conditional compilation  
- Easy Chromium version updates
- Smaller repository sizes

## Migration Process

### Phase 1: Analysis and Preparation

#### 1.1 Analyze Current Custom Changes
First, identify all custom modifications in your existing fork:

```bash
# In your old custom chromium repo
cd /path/to/old-custom-chromium

# Find all custom files (not in original Chromium)
git log --name-only --pretty=format: --diff-filter=A | sort -u > custom_added_files.txt

# Find all modified files
git log --name-only --pretty=format: --diff-filter=M | sort -u > custom_modified_files.txt

# Get a diff of all changes from a clean Chromium base
git diff ORIG_HEAD > all_custom_changes.patch
```

#### 1.2 Categorize Changes
Organize your changes into categories:

**A. Custom Implementation Files**
- New source files that implement custom features
- Custom UI components
- New browser services
- These will go into `src/custom/`

**B. Integration Points** 
- Modifications to existing Chromium files to call custom code
- Build system modifications (BUILD.gn files)
- These will become patches

**C. Configuration Changes**
- Branding modifications
- Default settings changes
- Feature flag modifications

**D. Third-party Dependencies**
- Additional libraries or components
- These may need DEPS entries or custom build rules

#### 1.3 Document Architecture
Create a mapping document:

```bash
# Create architecture mapping
echo "# Custom Changes Mapping

## Custom Implementation Files (→ src/custom/)
- src/chrome/browser/my_feature/ → src/custom/chrome/browser/features/my_feature/
- src/components/my_component/ → src/custom/components/my_component/

## Integration Points (→ patches/)
- src/chrome/browser/main.cc (modified)
- src/chrome/app/chrome_command_ids.h (modified)  
- src/chrome/browser/ui/BUILD.gn (modified)

## Build System Changes
- src/custom/BUILD.gn (new)
- Various BUILD.gn modifications

## Configuration/Branding
- Resource files
- Default preferences
- Brand strings
" > migration_mapping.md
```

### Phase 2: Repository Setup

#### 2.1 Create New Repository Structure
Set up the new repository structure based on the current custom-browser project:

```bash
# Create new custom-browser repository
mkdir new-custom-browser
cd new-custom-browser

# Copy build system structure from current project
cp -r /path/to/current-custom-browser/{scripts,lib,package.json,requirements.txt} .
cp -r /path/to/current-custom-browser/src/custom/build .
```

#### 2.2 Create Custom-Core Repository
Create a separate repository for your custom code:

```bash
# Create custom-core repository
mkdir custom-core
cd custom-core
git init

# Create directory structure
mkdir -p chrome/browser/features
mkdir -p chrome/browser/ui/views/custom
mkdir -p chrome/browser/services/custom  
mkdir -p components
mkdir -p chrome/app/custom
mkdir -p build/commands/{lib,scripts}
mkdir -p patches
```

#### 2.3 Configure Package.json
Set up the configuration to target your current Chromium version:

```json
{
  "config": {
    "projects": {
      "chromium": {
        "dir": "src",
        "tag": "YOUR_CURRENT_CHROMIUM_VERSION",
        "repository": {
          "url": "https://github.com/chromium/chromium"
        }
      }
    }
  }
}
```

### Phase 3: Code Migration

#### 3.1 Extract Custom Implementation Files
Move your custom implementation files to the new structure:

```bash
# Example migration script
#!/bin/bash

# Function to migrate custom source files
migrate_custom_files() {
    local old_repo=$1
    local new_custom_dir=$2
    
    # Migrate custom browser features
    for feature_dir in $old_repo/src/chrome/browser/my_*; do
        if [ -d "$feature_dir" ]; then
            feature_name=$(basename "$feature_dir")
            mkdir -p "$new_custom_dir/chrome/browser/features/$feature_name"
            cp -r "$feature_dir"/* "$new_custom_dir/chrome/browser/features/$feature_name/"
            echo "Migrated: $feature_name"
        fi
    done
    
    # Migrate custom components
    for comp_dir in $old_repo/src/components/my_*; do
        if [ -d "$comp_dir" ]; then
            comp_name=$(basename "$comp_dir")
            mkdir -p "$new_custom_dir/components/$comp_name"
            cp -r "$comp_dir"/* "$new_custom_dir/components/$comp_name/"
            echo "Migrated component: $comp_name"
        fi
    done
}

# Run migration
migrate_custom_files "/path/to/old-custom-chromium" "src/custom"
```

#### 3.2 Create BUILD.gn Files
Create BUILD.gn files for your custom code following the current project patterns:

```gn
# src/custom/chrome/browser/features/BUILD.gn
source_set("features") {
  sources = [
    # List your feature source files
    "my_feature/my_feature_manager.cc",
    "my_feature/my_feature_manager.h",
  ]
  
  deps = [
    "//base",
    "//chrome/browser", 
    "//content/public/browser",
  ]
  
  public_deps = [
    "//chrome/common",
  ]
}
```

#### 3.3 Update Source File Headers and Includes
Update your migrated files to use the new structure:

```bash
# Script to update include paths
#!/bin/bash
update_includes() {
    local custom_dir=$1
    
    # Update includes to reference new paths
    find "$custom_dir" -name "*.cc" -o -name "*.h" | while read file; do
        # Update includes for custom components
        sed -i 's|#include "chrome/browser/my_|#include "custom/chrome/browser/features/my_|g' "$file"
        sed -i 's|#include "components/my_|#include "custom/components/my_|g' "$file"
        
        # Add custom browser build flag guards if needed
        if grep -q "custom::" "$file"; then
            # Add build flag include if not present
            if ! grep -q "custom_browser_config.h" "$file"; then
                sed -i '1i#include "custom/chrome/browser/custom_browser_config.h"' "$file"
            fi
        fi
    done
}
```

### Phase 4: Create Integration Patches

#### 4.1 Identify Integration Points
From your analysis, create patches for vanilla Chromium modifications:

```bash
# Generate patches for integration points
#!/bin/bash
create_integration_patch() {
    local file_path=$1
    local patch_name=$2
    local old_repo=$3
    local temp_chromium=$4
    
    # Get the original Chromium version of the file
    (cd "$temp_chromium" && git show "origin/main:$file_path") > "original_$patch_name"
    
    # Get your modified version
    cp "$old_repo/src/$file_path" "modified_$patch_name"
    
    # Create patch
    diff -u "original_$patch_name" "modified_$patch_name" > "patches/${patch_name}.patch"
    
    # Cleanup
    rm "original_$patch_name" "modified_$patch_name"
}

# Create patches for key integration files
create_integration_patch "chrome/browser/main.cc" "browser_main_integration" "$OLD_REPO" "$TEMP_CHROMIUM"
create_integration_patch "chrome/app/chrome_command_ids.h" "command_ids_integration" "$OLD_REPO" "$TEMP_CHROMIUM"
```

#### 4.2 Modernize Integration Patches
Update your patches to use conditional compilation patterns:

```cpp
// Example patch content - browser_main_integration.patch
@@ -150,6 +150,12 @@ void ChromeBrowserMainParts::PreBrowserStart() {
   // existing code...
 }
 
+#if BUILDFLAG(CUSTOM_BROWSER)
+#include "custom/chrome/browser/features/custom_feature_manager.h"
+
+void ChromeBrowserMainParts::PostBrowserStart() {
+  // Initialize custom browser features
+  custom::CustomFeatureManager::GetInstance()->Initialize();
+#endif
+
 void ChromeBrowserMainParts::PostBrowserStart() {
   // existing chromium code...
 }
```

#### 4.3 Test Patch Application
Create a test script to verify patches apply correctly:

```python
#!/usr/bin/env python3
# test_patches.py

import subprocess
import tempfile
import os
from pathlib import Path

def test_patch_application():
    """Test that all patches apply cleanly to current Chromium."""
    
    # Create temporary Chromium checkout
    with tempfile.TemporaryDirectory() as temp_dir:
        chromium_dir = Path(temp_dir) / "chromium"
        
        # Sync clean Chromium
        subprocess.run([
            "gclient", "sync", "--revision", f"src@{CHROMIUM_VERSION}"
        ], cwd=temp_dir)
        
        # Test each patch
        patches_dir = Path("src/custom/patches")
        for patch_file in patches_dir.glob("*.patch"):
            print(f"Testing patch: {patch_file.name}")
            
            result = subprocess.run([
                "git", "apply", "--check", str(patch_file)
            ], cwd=chromium_dir)
            
            if result.returncode != 0:
                print(f"❌ Patch {patch_file.name} failed to apply")
                return False
            else:
                print(f"✅ Patch {patch_file.name} applies cleanly")
    
    return True

if __name__ == "__main__":
    if test_patch_application():
        print("🎉 All patches apply successfully!")
    else:
        print("⚠️  Some patches need updating")
```

### Phase 5: Build System Integration

#### 5.1 Update Custom Browser Build Configuration
Create the main build configuration:

```gni
# src/custom/custom_browser_config.gni
declare_args() {
  # Enable custom browser features
  enable_custom_browser = true
  
  # Custom browser branding
  custom_browser_product_name = "Your Custom Browser"
  custom_browser_company_name = "Your Company"
  
  # Feature flags
  enable_custom_feature_x = true
  enable_custom_feature_y = false
}
```

#### 5.2 Create Master BUILD.gn
Create the main BUILD.gn file for your custom code:

```gn
# src/custom/BUILD.gn
import("custom_browser_config.gni")

group("custom") {
  if (enable_custom_browser) {
    deps = [
      "//custom/chrome/browser/features",
      "//custom/components",
      "//custom/chrome/app/custom",
    ]
  }
}

# Add to main Chromium BUILD.gn via patch
```

#### 5.3 Update Main Chromium BUILD.gn (via patch)
Create a patch to include your custom targets:

```diff
# patches/main_build_integration.patch
@@ -100,6 +100,10 @@ group("chrome") {
     deps += [ "//chrome/installer" ]
   }
 
+  if (enable_custom_browser) {
+    deps += [ "//custom" ]
+  }
+
   if (is_linux || is_chromeos) {
     deps += [ "//chrome/installer/linux" ]
   }
```

### Phase 6: Migration Testing and Validation

#### 6.1 Sync and Build Test
Test the complete migration:

```bash
# Initialize new repository
cd new-custom-browser
npm run init

# This should:
# 1. Download depot_tools
# 2. Sync Chromium to specified version  
# 3. Apply all patches
# 4. Set up build environment

# Test build
npm run build
```

#### 6.2 Feature Verification
Create test scripts to verify your custom features work:

```python
# verify_migration.py
#!/usr/bin/env python3

def verify_custom_features():
    """Verify that custom features are properly integrated."""
    
    # Test 1: Check that custom code compiled
    build_dir = Path("out/Debug")  # or Release
    custom_targets = [
        "custom_browser",
        # Add your custom target names
    ]
    
    for target in custom_targets:
        if not (build_dir / target).exists():
            print(f"❌ Target {target} not found")
            return False
        print(f"✅ Target {target} built successfully")
    
    # Test 2: Check that patches were applied
    patches_applied = []
    # Add logic to verify patch application
    
    # Test 3: Run basic functionality tests
    # Add your specific feature tests
    
    return True

if __name__ == "__main__":
    if verify_custom_features():
        print("🎉 Migration verification passed!")
    else:
        print("⚠️  Migration verification failed")
```

#### 6.3 Regression Testing
Test that existing functionality still works:

```bash
# Run comprehensive tests
npm run test  # If you have tests
npm run start  # Test that browser launches
```

### Phase 7: Documentation and Cleanup

#### 7.1 Document Changes
Create documentation for the new architecture:

```markdown
# Migration Complete

## What Changed
- Moved from direct fork to patch-based architecture
- Custom code now in separate `src/custom/` repository
- Integration via conditional compilation and patches
- Easier Chromium version management

## New Development Workflow
1. Make changes in `src/custom/` for new features
2. Create patches for vanilla Chromium integration
3. Test with `npm run build`
4. Update patches when Chromium updates

## Benefits Gained
- Easier Chromium version updates
- Cleaner separation of custom vs vanilla code
- Smaller repository sizes
- Better conflict resolution
```

#### 7.2 Archive Old Repository
Archive the old repository safely:

```bash
# Create archive of old repository
cd /path/to/old-custom-chromium
git archive --format=tar.gz --prefix=old-custom-chromium/ HEAD > ../old-custom-chromium-archive.tar.gz

# Tag the final state
git tag "final-fork-state-before-migration"
git push origin "final-fork-state-before-migration"
```

### Phase 8: Ongoing Maintenance

#### 8.1 Chromium Version Updates
The new architecture makes updating easier:

```bash
# Update to new Chromium version
# 1. Update package.json with new Chromium tag
# 2. Run sync
npm run sync

# 3. Fix any patch conflicts
npm run apply_patches

# 4. Test build
npm run build
```

#### 8.2 Patch Management
Establish workflows for patch maintenance:

```bash
# Update patches after making vanilla Chromium changes
npm run update_patches

# Test patches against new Chromium versions
python test_patches.py
```

## Common Migration Issues

### Issue 1: Include Path Updates
**Problem**: Old includes don't work with new structure
**Solution**: Update all include paths systematically

### Issue 2: Build Dependencies
**Problem**: Missing dependencies in new BUILD.gn files  
**Solution**: Carefully migrate all dependencies from old BUILD.gn files

### Issue 3: Patch Conflicts
**Problem**: Patches don't apply to current Chromium version
**Solution**: Update patches manually, use 3-way merge tools

### Issue 4: Feature Flag Integration
**Problem**: Custom code always enabled
**Solution**: Add proper BUILDFLAG guards and configuration

## Best Practices for Migration

1. **Incremental Migration**: Migrate one feature at a time
2. **Test Early and Often**: Test builds after each major migration step  
3. **Preserve Git History**: Tag important states before major changes
4. **Document Everything**: Keep detailed notes of what was changed and why
5. **Automate Testing**: Create scripts to verify the migration
6. **Backup Strategy**: Always have backups of the old repository

## Conclusion

This migration transforms your custom Chromium project from a hard-to-maintain direct fork into a modern, patch-based architecture that's easier to maintain and update. The investment in migration pays off through easier Chromium version updates and cleaner code organization.