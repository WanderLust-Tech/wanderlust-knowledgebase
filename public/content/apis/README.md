# API Documentation

This section contains documentation for Chromium's APIs, IPC mechanisms, and service architecture.

## Mojo & Services

- [Intro to Mojo & Services](mojo_and_services.md) - Core concepts and usage
- [Mojo IPC Conversion](mojo_ipc_conversion.md) - Converting legacy IPC to Mojo
- [Mojo Testing](mojo_testing.md) - Testing Mojo interfaces
- [Servicification](servicification.md) - Converting components to services

## Key Concepts

**Mojo** is Chromium's IPC system that enables communication between processes through strongly-typed interfaces. It provides:

- **Type Safety**: Compile-time interface validation
- **Performance**: Efficient message passing with shared memory
- **Security**: Process isolation with capability-based access
- **Cross-Platform**: Works across all supported platforms

**Services** are discrete components that communicate through Mojo interfaces, enabling better modularity and testing.

## Related Documentation

- [Architecture Overview](../architecture/overview.md)
- [Process Model](../architecture/process_model_and_site_isolation.md)
- [Security Model](../security/security-model.md)
