# Development Documentation

This section contains documentation for developing Chromium, including build instructions, development tools, workflows, and best practices.

## Build System

### [Build Instructions](build/)
Platform-specific build instructions and configuration.

- [Windows Build Instructions](build/windows_build_instructions.md)
- [Mac Build Instructions](build/mac_build_instructions.md)
- [iOS Build Instructions](build/ios_build_instructions.md)
- [Android Build Instructions](build/android_build_instructions.md)
- [ChromeOS Build Instructions](build/chromeos_build_instructions.md)

## Development Tools

### Code Analysis & Formatting
- [Clang](clang.md) - Compiler setup and usage
- [Clang Format](clang_format.md) - Code formatting
- [Clang Tidy](clang_tidy.md) - Static analysis
- [ClangD](clangd.md) - Language server for IDEs

### Version Control
- [Git Cookbook](git_cookbook.md) - Common Git workflows
- [Git Tips](git_tips.md) - Advanced Git techniques
- [Git Submodules](git_submodules.md) - Working with submodules

### Code Review
- [Code Reviews](code_reviews.md) - Code review process and best practices

## Modern Language Support

### Rust Integration
- [Rust in Chromium](rust.md) - Using Rust in Chromium
- [Rust Unsafe Guidelines](rust-unsafe.md) - Safety guidelines for unsafe Rust

## Testing

### [Testing Framework](testing/)
Comprehensive testing documentation including unit tests, integration tests, and testing best practices.

## Development Workflows

### Code Quality
- Follow the [Coding Standards](../contributing/contributing.md#coding-conventions--style)
- Use [Static Analysis Tools](clang_tidy.md)
- Implement [Comprehensive Testing](testing/)

### Performance
- [Profiling Tools](../performance/)
- [Optimization Guidelines](../performance/)

## Related Documentation

- [Contributing Guide](../contributing/contributing.md)
- [Architecture Overview](../architecture/)
- [Security Guidelines](../security/)
- [Platform-Specific Docs](../platforms/)
