---
title: "Custom Browser Project Overview"
description: "Comprehensive overview of the Wanderlust Custom Browser project, including features, architecture, and technology stack"
category: "Introduction"
tags: ["custom browser", "chromium", "project overview", "features", "architecture"]
difficulty: "beginner"
date: "2025-01-15"
author: "Wanderlust Team"
estimated_reading_time: "10 minutes"
---

# Custom Browser Project Overview

## Introduction

The Custom Browser project is a Chromium-based browser with custom branding, features, and configuration. It provides a complete development environment for building, customizing, and maintaining a browser based on the latest Chromium source code.

## Project Goals

- **Custom Browser Development**: Build a fully customized browser with unique branding and features
- **Automated Environment Setup**: Streamlined initialization and dependency management
- **Modern Development Workflow**: Python-based automation with rich console output and comprehensive error handling
- **Cross-Platform Support**: Designed primarily for Windows with Visual Studio Build Tools

## Key Features

### Custom Branding System
- Comprehensive branding replacement throughout the browser UI
- Customizable browser name, icons, and visual elements
- Channel-specific branding configurations
- Automated branding application scripts

### RSS Feed Support
- Automatic RSS/Atom feed detection on web pages
- Built-in RSS reader with WebUI interface (`wanderlust://reader/`)
- Feed subscription management and OPML import/export
- Modern C++ backend with SQLite storage and async operations
- Security-hardened feed fetching with UXSS protection
- **Full Extension API**: Complete RSS extension API for browser extensions with real-time event notifications

### Modernized Browser Features (v1.1.0)
- **Feature Flag Management**: Centralized control over Chromium feature flags with build-time configuration
- **Enhanced Scroll Animations**: Customizable smooth scrolling with configurable duration and velocity parameters
- **JavaScript Content Controls**: Per-page JavaScript blocking/allowing with enhanced content settings integration
- **Advanced Download Management**: Enhanced download shelf with auto-hide, custom options dialog, and improved notifications
- **Reader Mode Integration**: Automatic article detection with content distillation and reader-friendly formatting

### Build Automation
- Automated Chromium source fetching and synchronization
- Patch management for depot_tools compatibility
- Build process automation with progress tracking
- Dependency validation and installation

### Development Tools
- Rich console output with colored logging
- Progress indicators and status reporting
- Comprehensive error handling and debugging
- Windows Defender exclusion management

## Technology Stack

### Core Technologies
- **Chromium**: Version 134.0.6998.95 (configurable)
- **Python 3.8+**: Automation scripts and build tools
- **Node.js/NPM**: Package management and script execution
- **Git**: Source code management and repository operations

### Development Dependencies
- **Visual Studio Build Tools**: Windows C++ compilation toolchain
- **depot_tools**: Google's repository management tools
- **Rich**: Python library for enhanced console output
- **Click**: Command-line interface framework
- **aiohttp**: Asynchronous HTTP client library

## Architecture Overview

### Component Structure
```
Custom Browser Project
├── Environment Setup (lib/utils.py)
├── Logging System (lib/logger.py)  
├── Project Initialization (scripts/init.py)
├── Custom Chromium Core (src/custom/)
│   ├── Branding System
│   ├── RSS Feed Backend (browser/rss/)
│   ├── RSS Components (components/rss/)
│   ├── Modernized Browser Features (chrome/browser/features/)
│   │   ├── Feature Flag Management
│   │   ├── Enhanced Scroll Animations
│   │   ├── JavaScript Content Controls
│   │   ├── Advanced Download Management
│   │   └── Reader Mode Integration
│   ├── Build Configuration
│   └── Patches and Customizations
└── Compatibility Patches (patches/)
```

### Data Flow
1. **Initialization**: Clone custom-core repository and setup environment
2. **Dependency Management**: Install NPM packages and Python requirements
3. **Source Synchronization**: Fetch Chromium source code via depot_tools
4. **Build Process**: Compile custom browser with applied branding and patches

## Repository Structure

### Main Repositories
- **custom-browser**: Main project repository
- **custom-core**: Chromium customization and branding repository

### Directory Layout
```
custom-browser/                 # Main project
├── lib/                       # Python utilities
│   ├── logger.py             # Colored logging system
│   └── utils.py              # General utilities
├── scripts/                   # Automation scripts
│   ├── init.py              # Project initialization
│   └── av/                  # Windows Defender scripts
├── patches/                   # depot_tools compatibility fixes
├── src/custom/               # Custom Chromium core (auto-managed)
└── docs/                     # Project documentation
```

## Version Management

### Chromium Version
- Current Target: **134.0.6998.95**
- Configured in: `src/custom/package.json`
- Updated through custom-core repository

### Project Versioning
- Main Project: **1.1.0**
- Custom Core: **1.0.0**
- Semantic versioning for all components

## Development Philosophy

### Automation First
All repetitive tasks are automated through Python scripts with comprehensive error handling and user feedback.

### Rich User Experience
Console output uses the Rich library to provide colored, formatted output with progress indicators and clear status reporting.

### Error Resilience
Scripts include extensive validation, error handling, and recovery mechanisms to ensure reliable operation.

### Cross-Platform Consideration
While primarily designed for Windows, the codebase includes cross-platform compatibility considerations.

## Next Steps

To get started with the Custom Browser project:

1. **[Development Setup](../development/custom-browser-development.md)** - Complete development environment configuration
2. **[Build System Guide](../development/custom-browser-build-system.md)** - Understanding the build process
3. **[Architecture Deep Dive](../architecture/custom-browser-architecture.md)** - Detailed system architecture
4. **[Feature Documentation](../features/custom-browser/)** - Individual feature guides

## License

MIT License - This project is open source and available for modification and distribution under the MIT license terms.