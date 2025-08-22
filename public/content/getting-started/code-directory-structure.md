# Code Directory Structure

This page expands on *Project Layout* with a detailed directory-by-directory tour of the custom-browser project's code organization, including both the top-level project structure and the Chromium `src/` tree.

---

## Project Root Directories

### Configuration & Setup Files

- **`.gclient`** – Controls Chromium source synchronization and dependency management
- **`.gitignore`** – Specifies files to ignore in version control
- **`package.json`** – Project metadata, npm scripts, and custom project configurations
- **`package-lock.json`** – Locked npm dependency versions for reproducible builds
- **`requirements.txt`** – Python package dependencies for development tools
- **`.npmrc`** – npm registry settings and configuration

### Development Support Directories

#### `lib/` – Python Development Utilities
- **`__init__.py`** – Python package initialization file
- **`logger.py`** – Advanced colored console logging with progress bars and spinners
- **`logger_demo.py`** – Interactive demonstration of logging system capabilities
- **`utils.py`** – Common utility functions used across development scripts
- **`__pycache__/`** – Python bytecode cache (auto-generated)

#### `scripts/` – Automation & Build Scripts
- **`init.py`** – Main project initialization script that handles dependency fetching
- **`av/`** – Additional automation and validation scripts for development workflow

#### `patches/` – Chromium Modifications
- Contains custom patches and modifications to upstream Chromium code
- Organized patches for specific features or bug fixes
- Used when direct source modifications aren't feasible

#### `docs/` – Project Documentation
- Currently empty but designated for project-specific documentation
- Future home for custom browser feature documentation and development guides

---

## The `src/` Directory Structure

After running `npm run init`, the Chromium source code is synchronized into the `src/` directory. Here's a comprehensive breakdown:

### Core Browser Components

#### `chrome/` – Browser Shell & UI
- **`app/`** – Application entry points and main() functions
- **`browser/`** – Browser process logic, UI controllers, and feature implementations
- **`common/`** – Shared code between browser and renderer processes
- **`renderer/`** – Renderer process specific code and extensions
- **`test/`** – Chrome-specific test utilities and test data
- **Platform directories**: `android/`, `ios/`, `mac/`, `win/`, `linux/` for platform-specific code

#### `content/` – Core Browser Engine
- **`browser/`** – Browser process implementation (navigation, resource loading, IPC)
- **`renderer/`** – Renderer process implementation (DOM, JavaScript execution)
- **`common/`** – Shared interfaces and utilities between processes
- **`gpu/`** – GPU process integration code
- **`utility/`** – Utility process implementations
- **`public/`** – Public APIs for embedders

#### `custom/` – **Our Custom Modifications** 🎯
- **Custom-core project** with our browser enhancements and modifications
- Contains project-specific features and customizations
- Organized to minimize conflicts with upstream Chromium updates

### Rendering & Graphics

#### `cc/` – Compositor & Rendering Pipeline
- **`layers/`** – Layer tree implementation for hardware acceleration
- **`trees/`** – Layer tree host and commit/activation logic
- **`animation/`** – Animation system integration
- **`raster/`** – Tile rasterization and GPU texture management

#### `gpu/` – Graphics Processing
- **`command_buffer/`** – GPU command buffer implementation
- **`config/`** – GPU driver and capability detection
- **`ipc/`** – Inter-process communication for GPU operations
- **`vulkan/`** – Vulkan graphics API integration

#### `ui/` – Cross-Platform UI Toolkit
- **`base/`** – Fundamental UI primitives and utilities
- **`views/`** – Native widget toolkit abstraction
- **`gfx/`** – 2D graphics, fonts, and image handling
- **`events/`** – Input event handling and dispatch
- **Platform directories**: `gtk/`, `win/`, `cocoa/`, `ozone/` for platform UI

### Networking & Communication

#### `net/` – Networking Stack
- **`http/`** – HTTP/HTTPS protocol implementation
- **`quic/`** – QUIC protocol support
- **`dns/`** – DNS resolution and caching
- **`cookies/`** – Cookie storage and management
- **`proxy/`** – Proxy detection and configuration
- **`ssl/`** – SSL/TLS certificate handling

#### `ipc/` – Inter-Process Communication
- **Core IPC** – Message passing between browser processes
- **Mojo integration** – Modern IPC system built on Mojo
- **Security boundaries** – Process isolation and sandboxing support

### Core Infrastructure

#### `base/` – Fundamental Utilities
- **`containers/`** – Custom container classes and algorithms
- **`memory/`** – Memory management utilities and smart pointers
- **`task/`** – Task scheduling and thread pool management
- **`files/`** – File system operations and path handling
- **`strings/`** – String utilities and manipulation functions

#### `build/` – Build System Configuration
- **GN files** – Build target definitions and dependencies
- **Config files** – Compiler flags, toolchain settings
- **Scripts** – Build automation and CI/CD integration

#### `tools/` – Development Tools
- **`gn/`** – Generate Ninja build system
- **`clang/`** – Clang-based tools (format, tidy, static analysis)
- **`metrics/`** – Performance and usage metrics collection
- **`variations/`** – A/B testing and feature flag infrastructure

### Web Technologies

#### `third_party/` – External Dependencies
- **`blink/`** – Web rendering engine (WebKit fork)
- **`v8/`** – JavaScript engine
- **`skia/`** – 2D graphics library
- **`webrtc/`** – Real-time communication
- **`protobuf/`** – Protocol buffer serialization
- **`zlib/`**, **`libpng/`**, **`libjpeg/`** – Media format libraries

#### `components/` – Reusable Feature Modules
- **`autofill/`** – Form auto-completion functionality
- **`bookmarks/`** – Bookmark management
- **`history/`** – Browsing history storage and search
- **`password_manager/`** – Password storage and auto-fill
- **`payments/`** – Web payments API implementation
- **`sync/`** – Cross-device data synchronization

### Security & Sandboxing

#### `sandbox/` – Security Isolation
- **Platform-specific** – Windows, macOS, Linux sandboxing implementations
- **Policy files** – Security policy definitions and enforcement
- **IPC restrictions** – Communication constraints between processes

#### `crypto/` – Cryptographic Operations
- **Encryption/decryption** – Symmetric and asymmetric cryptography
- **Hashing** – Secure hash algorithms
- **Certificate handling** – X.509 certificate validation

### Services & Extensions

#### `services/` – Mojo-Based Services
- **`network/`** – Network service for process isolation
- **`storage/`** – Storage APIs (IndexedDB, Cache API, etc.)
- **`device/`** – Hardware device access APIs
- **`media/`** – Media capture and playback services

#### `extensions/` – Browser Extensions
- **`api/`** – Extension API implementations
- **`browser/`** – Extension host and management
- **`renderer/`** – Extension content script injection

### Build Outputs

#### `out/` – Compilation Results
- **`Default/`** – Default build configuration output
  - **`obj/`** – Intermediate object files and libraries
  - **`chrome.exe`** – Main browser executable (Windows)
  - **`*.dll`** – Dynamic libraries (Windows component builds)
  - **`resources/`** – Packaged resources and assets
  - **`locales/`** – Internationalization files

---

## Directory Relationships & Dependencies

### Layer Architecture
```
┌─────────────────────────────────────┐
│ chrome/ (Browser Shell & Features)  │
├─────────────────────────────────────┤
│ components/ (Reusable Modules)      │
├─────────────────────────────────────┤
│ content/ (Browser Engine)           │
├─────────────────────────────────────┤
│ third_party/ (External Libraries)   │
├─────────────────────────────────────┤
│ base/ (Fundamental Utilities)       │
└─────────────────────────────────────┘
```

### Custom Integration Points
- **`custom/`** integrates at the `chrome/` and `components/` level
- **`lib/`** and **`scripts/`** support development workflow
- **`patches/`** modifies any level when direct changes aren't possible

### Development Workflow Directories
1. **Start here**: `lib/logger_demo.py` to understand tooling
2. **Project setup**: `scripts/init.py` for dependency management
3. **Custom features**: `src/custom/` for browser modifications
4. **Build configuration**: `src/build/` for compilation settings
5. **Output inspection**: `src/out/Default/` for built artifacts

---

**See also:**
- [Project Layout](project-layout.md) for high-level project organization
- [Architecture → Browser Components](../architecture/browser-components.md) for runtime component relationships
- [Setup & Build](setup-build.md) for development environment configurationructure