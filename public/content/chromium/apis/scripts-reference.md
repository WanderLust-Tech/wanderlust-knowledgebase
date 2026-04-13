---
title: "Custom Browser Scripts Reference"
description: "Comprehensive documentation of automation scripts and utilities for the Wanderlust Custom Browser project"
category: "APIs"
tags: ["scripts", "automation", "python", "utilities", "reference", "cli"]
difficulty: "intermediate"
date: "2025-01-15"
author: "Wanderlust Team"
estimated_reading_time: "12 minutes"
---

# Scripts Reference

## Overview

This document provides comprehensive documentation for all Python scripts and utilities in the Custom Browser project.

## Main Scripts

### scripts/init.py

**Purpose**: Project initialization and environment setup

#### Description
The initialization script handles the complete setup process for the Custom Browser development environment. It validates prerequisites, clones the custom-core repository, installs dependencies, and prepares the build environment.

#### Usage
```bash
python scripts/init.py [options]
npm run init
```

#### Key Functions

##### `main()`
Main entry point with comprehensive error handling and system prerequisite validation.

**Flow**:
1. Check system prerequisites (Python, Git, NPM)
2. Run initialization process
3. Handle errors and provide user feedback

##### `run()`
Core initialization logic that performs the actual setup work.

**Operations**:
- Set up directory paths
- Validate Git availability
- Get project version configuration
- Clone or update custom-core repository
- Install NPM dependencies
- Run source synchronization with automatic retry on timeout
- Apply compatibility patches after successful sync

##### `clone_repository(browser_core_dir, browser_core_ref)`
Handles cloning and checkout of the custom-core repository.

**Parameters**:
- `browser_core_dir` (Path): Target directory for repository
- `browser_core_ref` (str): Git branch or tag to checkout

**Returns**: Boolean indicating success/failure

#### Error Handling
- Validates all inputs and system prerequisites
- Provides clear error messages with suggested solutions
- Gracefully handles KeyboardInterrupt (Ctrl+C)
- Comprehensive logging of all operations
- **Timeout Retry Logic**: Automatically retries sync operations that timeout
- **Progressive Timeouts**: Each retry uses longer timeout periods (2h → 3h → 4.5h)
- **Network Resilience**: Handles network interruptions during large downloads
- **Patch Application Resilience**: 30-minute timeout for applying 70+ patch files
- **Circular Dependency Prevention**: Prevents infinite loops in patch application scripts

#### Configuration
Uses NPM configuration from package.json:
```json
{
  "config": {
    "projects": {
      "custom-core": {
        "directory": "src/custom",
        "branch": "master",
        "repository": {
          "url": "https://github.com/WanderLust-Tech/custom-core.git"
        }
      }
    }
  }
}
```

### scripts/av/setup-defender-exclusions.ps1

**Purpose**: Windows Defender exclusion configuration

#### Description
PowerShell script that configures Windows Defender to exclude development directories from real-time scanning, preventing build performance issues.

#### Usage
```powershell
# Run as Administrator
.\setup-defender-exclusions.ps1
```

#### Exclusions Applied
- Project root directory
- Build output directories
- Temporary build files
- depot_tools directory
- Node.js cache directories

## Utility Modules

### lib/utils.py

**Purpose**: General utility functions and system operations

#### Key Functions

##### `get_npm_config(path)`
Retrieves configuration values from NPM environment or package.json.

**Parameters**:
- `path` (list): List of keys to traverse

**Returns**: Configuration value or None

**Example**:
```python
repo_url = get_npm_config(['projects', 'custom-core', 'repository', 'url'])
```

##### `get_project_version(project_name)`
Gets the version (tag or branch) for a specified project.

**Parameters**:
- `project_name` (str): Name of the project

**Returns**: Version string or None

**Example**:
```python
version = get_project_version('custom-core')
```

##### `run(cmd, args=None, **options)`
Executes commands with comprehensive error handling and logging.

**Parameters**:
- `cmd` (str): Command to execute
- `args` (list): Command arguments
- `**options`: Additional subprocess options

**Returns**: subprocess.CompletedProcess object

**Features**:
- Command logging with directory context
- Timeout handling
- Stream output support
- Environment variable management
- Cross-platform compatibility

##### `validate_git_available()`
Validates Git installation and availability.

**Returns**: Boolean indicating Git availability

**Checks**:
- Git command existence
- Git version compatibility
- PATH configuration

##### `validate_npm_available()`
Validates NPM installation and returns command to use.

**Returns**: NPM command string or None

**Detection Order**:
1. `npm` command
2. `npm.cmd` (Windows)
3. Full path resolution

##### `validate_python_available()`
Validates Python installation and configuration.

**Returns**: Boolean indicating Python availability

**Checks**:
- Python 3.8+ requirement
- Module import capabilities
- Environment configuration

##### `run_git(directory, args)`
Executes Git commands in specified directory.

**Parameters**:
- `directory` (Path): Working directory
- `args` (list): Git command arguments

**Returns**: Command output or None

**Example**:
```python
sha = run_git(repo_dir, ['rev-parse', 'HEAD'])
```

##### `ensure_directory_exists(path, description)`
Creates directory if it doesn't exist with error handling.

**Parameters**:
- `path` (Path): Directory path
- `description` (str): Human-readable description

**Returns**: Boolean indicating success

### lib/logger.py

**Purpose**: Advanced logging and console output system

#### Logger Class

The Logger class provides a comprehensive logging system with Rich console output, colored messages, and progress indicators.

#### Core Methods

##### `info(message)`
Logs informational messages with blue info icon.
```python
logger.info("Starting initialization process")
```

##### `status(message)`
Logs status updates with blue status indicator.
```python
logger.status("Downloading dependencies...")
```

##### `success(message)`
Logs success messages with green checkmark.
```python
logger.success("Build completed successfully")
```

##### `error(message)`
Logs error messages with red X indicator.
```python
logger.error("Build failed: missing dependency")
```

##### `warning(message)`
Logs warning messages with yellow warning icon.
```python
logger.warning("Deprecated configuration detected")
```

##### `debug(message)`
Logs debug messages with dimmed output.
```python
logger.debug("Internal state: processing file list")
```

##### `progress(message)`
Logs progress updates with cyan progress indicator.
```python
logger.progress("Processing file 5 of 10")
```

##### `step(current, total, message)`
Logs step progress in multi-step operations.
```python
logger.step(3, 10, "Configuring build environment")
```

##### `title(message)`
Logs section titles with bold formatting.
```python
logger.title("Environment Setup")
```

##### `command(cwd, cmd, args)`
Logs command execution with directory context.
```python
logger.command("/path/to/dir", "git", ["clone", "repository"])
```

#### Context Managers

##### `spinner_context(message)`
Creates a spinner for long-running operations.
```python
with logger.spinner_context("Building project..."):
    # Long running operation
    build_project()
```

##### `progress_context(description)`
Creates a progress bar for tracked operations.
```python
with logger.progress_context("Downloading files") as progress:
    for file in files:
        # Process file
        progress.update(f"Processing {file}")
```

#### Global Functions
The module exports convenience functions for backward compatibility:
- `info()`, `status()`, `success()`, `error()`, `warning()`, `debug()`
- `progress()`, `step()`, `title()`, `subtitle()`
- `command()`, `list_items()`

### lib/logger_demo.py

**Purpose**: Demonstration of logger capabilities

#### Description
Interactive demonstration script that showcases all logging features and output formatting options.

#### Usage
```bash
python lib/logger_demo.py
npm run demo:logger
```

#### Demonstrates
- All message types and formatting
- Progress indicators and spinners
- Command logging with context
- Error handling scenarios
- Color and formatting capabilities

## NPM Script Integration

### Package.json Scripts

#### Main Scripts
```json
{
  "scripts": {
    "init": "python scripts/init.py",
    "build": "cd src/custom && npm run build --",
    "demo:logger": "python lib/logger_demo.py", 
    "install:python": "pip install -r requirements.txt",
    "apply_patches": "cd src/custom && npm run apply_patches --",
    "update_patches": "cd src/custom && npm run update_patches --"
  }
}
```

#### Script Descriptions

##### `npm run init`
- Executes project initialization
- Validates system prerequisites
- Sets up development environment
- Clones custom-core repository

##### `npm run build`
- Builds the custom browser
- Runs in custom-core directory
- Passes additional arguments to build script

##### `npm run demo:logger`
- Demonstrates logging capabilities
- Shows all output formatting options
- Interactive logger testing

##### `npm run install:python`
- Installs Python dependencies
- Uses requirements.txt
- Ensures development environment setup

##### `npm run apply_patches`
- Applies compatibility patches to depot_tools
- Fixes Python 3.12+ compatibility issues
- Essential for Windows development
- See [Patch Management](#patch-management) for details

##### `npm run update_patches`
- Creates/updates patch files from git modifications
- Supports feature-based organization
- Automatically categorizes changes by functionality
- See [Advanced Patch Management](#advanced-patch-management) for details

## Patch Management

### Basic Patch Operations

The Custom Browser project includes sophisticated patch management for organizing Chromium modifications.

#### Standard Patch Creation
```bash
# Create patches from all modified files
cd src/custom
npm run update_patches
```

#### Apply Existing Patches
```bash
# Apply depot_tools compatibility patches
npm run apply_patches
```

### Advanced Patch Management

#### Feature-Organized Patch Creation

**Command**:
```bash
cd src/custom
python build/commands/lib/updatePatches.py --organize-by-feature
```

**Features**: The system automatically categorizes files into:

- **Branding**: Browser theming, icons, visual identity, version info
- **UI**: Interface components, views, webui, toolbars, tabs
- **Privacy & Security**: Safe browsing, signin, authentication
- **Extensions**: Extension system modifications and APIs  
- **Downloads**: Download functionality and related UI
- **Networking**: Network stack, proxy configuration
- **Settings**: Browser settings, preferences, configuration  
- **New Tab Page**: Search functionality, NTP features
- **Custom Components**: Custom-specific modifications
- **Miscellaneous**: Uncategorized files

**Output Structure**:
```
patches/
└── features/
    ├── branding/       # Theme, icons, branding changes
    ├── ui/             # Interface modifications
    ├── privacy/        # Security & privacy features  
    ├── extensions/     # Extension system changes
    ├── downloads/      # Download functionality
    ├── networking/     # Network stack modifications
    ├── settings/       # Settings and preferences
    ├── new_tab_page/   # New Tab Page changes
    ├── custom_components/ # Custom browser components
    └── misc/           # Uncategorized modifications
```

**Benefits**:
- **Better maintainability**: Understand which patches affect which features
- **Selective application**: Apply only relevant patches for specific features
- **Cleaner organization**: Structured patches instead of monolithic files
- **Improved debugging**: Isolate issues to specific feature areas
- **Team collaboration**: Multiple developers can work independently

#### Path Filtering

The system uses intelligent filtering to exclude:
- Theme files (`chrome/app/theme/*`)
- Image files (`.png`, `.svg`, `.ico`)
- Localization files (`.xtb`)
- Resource files (`.grd`, `.grdp`)
- Google-specific update files
- Build artifacts and temporary files

#### Categorization Logic

Files are categorized using regex patterns:
```python
# Example patterns:
'branding': [
    r'chrome/app/theme',
    r'chrome/installer', 
    r'build.*branding'
],
'ui': [
    r'chrome/browser/ui/views',
    r'chrome/browser/ui/webui',
    r'ui/views'
],
'privacy': [
    r'chrome/browser/safe_browsing',
    r'components/safe_browsing',
    r'chrome/browser/signin'
]
```

## Error Handling Patterns

### Standard Error Handling
```python
def operation_with_error_handling():
    try:
        logger.status("Starting operation...")
        result = perform_operation()
        
        if not result:
            logger.error("Operation failed")
            return False
            
        logger.success("Operation completed")
        return True
        
    except SpecificException as e:
        logger.error(f"Specific error occurred: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        logger.debug(f"Error type: {type(e).__name__}")
        return False
```

### Command Execution Error Handling
```python
def safe_command_execution(cmd, args, cwd=None):
    try:
        logger.command(cwd, cmd, args)
        result = run(cmd, args, cwd=cwd, timeout=300)
        
        if result and result.returncode == 0:
            logger.success(f"Command completed successfully")
            return result
        else:
            logger.error(f"Command failed with exit code: {result.returncode}")
            return None
            
    except subprocess.TimeoutExpired:
        logger.error("Command timed out")
        return None
    except Exception as e:
        logger.error(f"Command execution failed: {e}")
        return None
```

## Best Practices

### Script Development
1. **Use Logger**: Always use lib/logger.py for output instead of print()
2. **Error Handling**: Implement comprehensive error handling with meaningful messages
3. **Validation**: Validate all inputs and system state before operations
4. **Documentation**: Include docstrings for all functions and classes
5. **Testing**: Create test cases for utility functions

### Configuration Management
1. **NPM Config**: Store configuration in package.json config section
2. **Environment Variables**: Use environment variables for runtime configuration
3. **Validation**: Validate all configuration values before use
4. **Defaults**: Provide sensible defaults for optional configuration

### Cross-Platform Compatibility
1. **Path Handling**: Use pathlib.Path for all path operations
2. **Command Detection**: Detect platform-specific command variations
3. **Environment Variables**: Handle platform-specific environment differences
4. **Error Messages**: Provide platform-specific troubleshooting guidance