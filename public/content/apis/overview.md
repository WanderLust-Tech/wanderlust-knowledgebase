# APIs & Services Overview

Chromium's modern architecture relies heavily on well-defined APIs and service-oriented design. This section covers the key APIs and service architecture patterns used throughout the codebase.

## What You'll Learn

- **Mojo IPC System**: Modern inter-process communication with type safety and security
- **Service Architecture**: How Chromium's discrete service components are organized
- **API Design Patterns**: Common patterns for building robust, maintainable APIs
- **Testing Strategies**: How to test complex service interactions and Mojo interfaces

## Key Technologies

**Mojo** is Chromium's IPC system that enables communication between processes through strongly-typed interfaces. It provides:

- **Type Safety**: Compile-time interface validation
- **Performance**: Efficient message passing with shared memory
- **Security**: Process isolation with capability-based access
- **Cross-Platform**: Works across all supported platforms

**Services** are discrete components that communicate through Mojo interfaces, enabling better modularity, testing, and process isolation.

## Topics Covered

### Core Concepts
- [Mojo & Services](mojo_and_services) - Introduction to Chromium's service architecture (Updated for v134+)
- [Servicification](servicification) - The process of converting legacy code to services (Updated for v134+)
- [Mojo IPC Conversion](mojo_ipc_conversion) - Migrating from legacy IPC to Mojo (Updated for v134+)

### Testing & Development
- [Mojo Testing](mojo_testing) - Testing strategies for Mojo-based services (Updated for v134+)

## Getting Started

If you're new to Chromium's service architecture, start with [Mojo & Services](mojo_and_services) to understand the fundamental concepts.

**Note**: All documentation in this section has been updated to reflect Chromium v134+ standards, including modern error handling patterns, security considerations, and testing approaches.

## Related Sections

- [Core Architecture](../architecture/overview) - Understanding Chromium's overall design
- [Process Model](../architecture/process-model) - How processes are organized and isolated
- [Security Model](../security/security-model) - Security architecture and considerations
- [Extension API System](../features/extension-api-system) - Extension API architecture and custom implementation
- [Testing & QA](../development/testing/testing_in_chromium) - Testing methodologies
- [Core Modules](../modules/javascript-v8) - How modules interact with services
