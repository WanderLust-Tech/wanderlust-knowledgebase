# Project Layout

The custom-browser project is a Chromium-based browser implementation with a structured development environment. This guide provides a comprehensive tour of the project's directories and files to help you navigate and understand the codebase effectively.

---

## 1. Top-Level Structure

```text
custom-browser/
├── .gclient                 # gclient configuration for Chromium sync
├── .gitignore               # files to ignore in Git
├── package.json             # project configuration and npm scripts
├── package-lock.json        # locked npm dependencies
├── requirements.txt         # Python dependencies
├── .npmrc                   # npm configuration
├── README.md                # project overview and setup guide
├── lib/                     # Python utilities and libraries
├── scripts/                 # automation and build scripts
├── patches/                 # Chromium patches and modifications
├── docs/                    # project documentation (currently empty)
└── src/                     # Chromium source code and custom modules
```

### Configuration Files

- **`.gclient`** - Defines how to fetch Chromium source and dependencies
- **`package.json`** - Contains project metadata, npm scripts, and custom project configurations
- **`requirements.txt`** - Python packages required for development tools
- **`.npmrc`** - npm registry and configuration settings

### Development Directories

- **`lib/`** - Python utilities for logging, development tools, and helper functions
- **`scripts/`** - Automation scripts for project initialization and build processes
- **`patches/`** - Custom patches and modifications to Chromium source
- **`docs/`** - Project documentation (expandable for future documentation)
- **`src/`** - Main Chromium source tree with custom modifications

---

## 2. The lib/ Directory

The `lib/` directory contains Python utilities that support the development workflow:

```text
lib/
├── __init__.py              # Python package initialization
├── logger.py                # Advanced colored console logging utility
├── logger_demo.py           # Demonstration of logging capabilities
├── utils.py                 # General utility functions
└── __pycache__/             # Python bytecode cache
```

### Key Components

- **`logger.py`** - Provides rich console output with progress bars, spinners, and colored logging
- **`logger_demo.py`** - Shows examples of how to use the logging system
- **`utils.py`** - Common utility functions used across the project

---

## 3. The scripts/ Directory

Contains automation scripts for project setup and development:

```text
scripts/
├── init.py                  # Main project initialization script
└── av/                      # Additional automation scripts
```

### Main Scripts

- **`init.py`** - Handles project setup, dependency fetching, and environment configuration
- **`av/`** - Directory for additional automation and validation scripts

---

## 4. The src/ Directory

After running project initialization, the Chromium source code lives in `src/`. This follows the standard Chromium layout with custom additions:

```text
src/
├── chrome/                  # Chrome browser shell & UI code
├── content/                 # Blink/V8 embedder & shared browser logic  
├── cc/                      # Compositor & layered rendering
├── gpu/                     # GPU process, drivers, and command buffer
├── net/                     # Networking stack (HTTP, QUIC, proxies)
├── ui/                      # Cross-platform UI abstraction
├── components/              # Reusable modules (autofill, payments, etc.)
├── third_party/             # External dependencies and libraries
├── tools/                   # Build-time code generation & helper scripts
├── custom/                  # Custom-core project (our modifications)
├── build/                   # Build system configuration
├── base/                    # Fundamental utilities and abstractions
├── sandbox/                 # Security sandbox implementation
├── services/                # Mojo-based services
└── out/                     # Build output directory
```

### Core Directories

- **`chrome/`** - Entry points, Chrome UI (tabs, omnibox, menus), and platform-specific code
- **`content/`** - Integrates Blink (rendering) and V8 (JavaScript), plus IPC and navigation
- **`custom/`** - **Our custom modifications and extensions to Chromium**
- **`net/`** - Implements HTTP(S), QUIC, caching, cookies, proxy resolution
- **`ui/`** - Cross-platform windowing, input events, and vector graphics

### Custom Integration

- **`custom/`** - Contains the custom-core project with our browser modifications
- **`out/`** - Generated during build process, contains compiled binaries and intermediates

---

## 5. Build Outputs & Configuration

```text
src/out/
└── Default/               # Default build configuration
    ├── obj/               # Intermediate object files
    ├── chrome.exe         # Built browser executable (Windows)
    ├── *.dll              # Shared libraries (if component build)
    └── *.ninja_log        # Build logs and timing information
```

Build outputs are generated using the GN (Generate Ninja) build system:
- Use `gn gen out/Default` to generate build files
- Use `ninja -C out/Default chrome` to build the browser

---

## 6. Project Configuration & Metadata

### Build Configuration Files

- **`BUILD.gn`** files - Scattered throughout the tree, define build targets
- **`.gn`** files - Build system templates and configuration
- **`DEPS`** - External dependency definitions and version pinning
- **`PRESUBMIT.py`** - Pre-commit hooks for code quality checks

### Project Management

- **`package.json` config section** - Defines custom project dependencies and their locations
- **`scripts/init.py`** - Automates the fetching and setup of configured projects
- **`.gclient`** - Controls Chromium source synchronization

---

## 7. Development Workflow

### Initial Setup

1. **Install dependencies**: `npm run install:python`
2. **Initialize project**: `npm run init`
3. **Configure build**: Navigate to `src/` and run `gn gen out/Default`
4. **Build browser**: `ninja -C out/Default chrome`

### Directory Navigation Tips

| Need to... | Look in... |
|------------|------------|
| Modify networking behavior | `src/net/` |
| Customize UI components | `src/ui/` or `src/chrome/browser/ui/` |
| Add browser features | `src/custom/` (our modifications) |
| Debug build issues | `src/build/` or build logs in `src/out/` |
| Work with Python tools | `lib/` directory |
| Add automation scripts | `scripts/` directory |

### Code Search and Navigation

- Use **VS Code** or your preferred IDE for local code navigation
- **Chromium Code Search**: https://source.chromium.org for upstream Chromium reference
- **grep/ripgrep**: Fast text search across the large codebase
- **BUILD.gn search**: `find . -name BUILD.gn | xargs grep <target>` to locate build definitions

---

## 8. Custom Integration Points

### Our Modifications

- **`src/custom/`** - Contains the custom-core project with our browser enhancements
- **`lib/`** - Development tools and utilities specific to our workflow
- **`scripts/`** - Automation for project management and initialization
- **`patches/`** - Any required patches to upstream Chromium code

### Development Best Practices

- Keep custom code in the `src/custom/` directory when possible
- Use the Python utilities in `lib/` for consistent logging and development experience
- Follow Chromium's coding standards for modifications to core directories
- Document custom features and modifications in the `docs/` directory

---

**Navigation Tips:**
- Start with the `README.md` for project overview and setup
- Use `lib/logger_demo.py` to understand the development tools
- Explore `src/custom/` for our specific browser modifications
- Reference upstream Chromium documentation for core functionality understanding
