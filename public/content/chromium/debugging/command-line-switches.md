# Chromium Command Line Switches

[TOC]

## Overview

Chromium and Chrome browsers support a comprehensive set of command line switches (also called flags or options) that modify browser behavior for development, testing, debugging, and specialized use cases. These switches are passed when starting the browser and can control everything from rendering behavior to security policies.

## Understanding Switch Structure

Command line switches in Chromium follow a consistent pattern:

```bash
# Single dash for single-letter switches
chrome -incognito

# Double dash for multi-character switches  
chrome --disable-web-security

# Switches with values
chrome --user-data-dir=/path/to/profile

# Multiple switches
chrome --incognito --disable-extensions --remote-debugging-port=9222
```

### Switch Categories

Chromium switches are organized into several categories based on their functionality:

- **Content Switches**: Core browser content and rendering behavior
- **Chrome Switches**: Browser UI and feature-specific options  
- **Debug Switches**: Development and debugging functionality
- **Security Switches**: Security policy modifications
- **Performance Switches**: Performance testing and optimization
- **Platform-Specific**: Operating system specific options

## Essential Development Switches

### Debugging and Development

#### `--remote-debugging-port=<port>`
**Purpose**: Enables remote debugging interface for DevTools
**Example**: `--remote-debugging-port=9222`
**Use Cases**: 
- Automated testing with Selenium/Puppeteer
- External DevTools connections
- Headless browser debugging

#### `--enable-logging`
**Purpose**: Enables detailed console logging
**Example**: `--enable-logging --v=1`
**Use Cases**:
- Debugging browser internals
- Tracking network requests
- Performance analysis

#### `--user-data-dir=<path>`
**Purpose**: Specifies custom profile directory
**Example**: `--user-data-dir=/tmp/chrome-test-profile`
**Use Cases**:
- Isolated testing environments
- Multiple browser instances
- Clean development profiles

#### `--incognito`
**Purpose**: Starts browser in incognito/private mode
**Use Cases**:
- Testing without existing cookies/cache
- Privacy-focused development
- Clean session testing

### Security and Testing

#### `--disable-web-security`
**Purpose**: Disables same-origin policy enforcement
**⚠️ Warning**: Only use for development/testing
**Use Cases**:
- Cross-origin development testing
- Local file testing
- API development without CORS

#### `--allow-running-insecure-content`
**Purpose**: Allows mixed HTTP/HTTPS content
**Use Cases**:
- Local development with HTTPS
- Testing legacy integrations
- Mixed content debugging

#### `--ignore-certificate-errors`
**Purpose**: Ignores SSL/TLS certificate errors
**Use Cases**:
- Testing with self-signed certificates
- Local HTTPS development
- Certificate debugging

#### `--disable-extensions`
**Purpose**: Disables all browser extensions
**Use Cases**:
- Clean testing environment
- Extension conflict debugging
- Performance baseline testing

## Content and Rendering Switches

### Web API Control

#### `--enable-experimental-web-platform-features`
**Purpose**: Enables experimental web APIs
**Use Cases**:
- Testing new web standards
- Feature preview development
- Cutting-edge API experimentation

#### `--disable-blink-features=<features>`
**Purpose**: Disables specific Blink rendering features
**Example**: `--disable-blink-features=CSSGridLayout,Flexbox`
**Use Cases**:
- Feature regression testing
- Compatibility testing
- Performance impact analysis

#### `--enable-blink-features=<features>`
**Purpose**: Enables specific Blink features
**Example**: `--enable-blink-features=WebAssemblyThreads`
**Use Cases**:
- Early feature adoption
- Experimental development
- Feature flag testing

### Media and Graphics

#### `--disable-accelerated-video-decode`
**Purpose**: Disables hardware video acceleration
**Use Cases**:
- Graphics driver debugging
- Software rendering testing
- Performance comparison

#### `--disable-gpu`
**Purpose**: Disables GPU acceleration entirely
**Use Cases**:
- Software rendering testing
- GPU driver issue debugging
- Compatibility testing

#### `--force-device-scale-factor=<factor>`
**Purpose**: Override device pixel ratio
**Example**: `--force-device-scale-factor=2`
**Use Cases**:
- High-DPI testing
- Responsive design testing
- Scaling behavior debugging

## Performance and Testing Switches

### Performance Analysis

#### `--no-sandbox`
**Purpose**: Disables security sandboxing
**⚠️ Warning**: Security risk - only use for testing
**Use Cases**:
- Performance testing
- Debugging sandbox issues
- Automated testing environments

#### `--disable-background-timer-throttling`
**Purpose**: Prevents background tab throttling
**Use Cases**:
- Background processing testing
- Timer accuracy testing
- Performance benchmarking

#### `--max-active-webgl-contexts=<number>`
**Purpose**: Controls WebGL context limits
**Example**: `--max-active-webgl-contexts=16`
**Use Cases**:
- Graphics performance testing
- Memory usage analysis
- WebGL application development

### Memory and Resources

#### `--memory-pressure-off`
**Purpose**: Disables memory pressure notifications
**Use Cases**:
- Memory usage testing
- Performance benchmarking
- Memory leak detection

#### `--aggressive-cache-discard`
**Purpose**: Aggressively discards cached resources
**Use Cases**:
- Memory pressure testing
- Cache behavior analysis
- Low-memory device simulation

## Mobile and Touch Switches

### Touch and Input

#### `--touch-events=enabled`
**Purpose**: Forces touch event support
**Use Cases**:
- Touch interface testing on desktop
- Mobile web development
- Cross-platform input testing

#### `--simulate-touch-screen-with-mouse`
**Purpose**: Simulates touch events with mouse
**Use Cases**:
- Touch development without touch hardware
- Mobile testing on desktop
- Touch gesture debugging

### Mobile Emulation

#### `--user-agent=<string>`
**Purpose**: Sets custom User-Agent string
**Example**: `--user-agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)"`
**Use Cases**:
- Mobile device testing
- User-Agent dependent feature testing
- Compatibility testing

## Specialized Testing Switches

### Automation and Testing

#### `--headless`
**Purpose**: Runs browser without UI
**Use Cases**:
- Automated testing
- Server-side rendering
- CI/CD pipeline testing

#### `--disable-dev-shm-usage`
**Purpose**: Uses /tmp instead of /dev/shm for shared memory
**Use Cases**:
- Docker container testing
- Limited shared memory environments
- CI/CD compatibility

#### `--no-first-run`
**Purpose**: Skips first-run setup
**Use Cases**:
- Automated testing
- Clean startup testing
- Scripted browser launching

### Network and Connectivity

#### `--proxy-server=<proxy>`
**Purpose**: Configures proxy settings
**Example**: `--proxy-server=http://proxy.company.com:8080`
**Use Cases**:
- Corporate network testing
- Network debugging
- Proxy configuration testing

#### `--host-resolver-rules=<rules>`
**Purpose**: Custom DNS resolution rules
**Example**: `--host-resolver-rules="MAP *.google.com 127.0.0.1"`
**Use Cases**:
- Local development testing
- DNS debugging
- Network simulation

## Platform-Specific Switches

### Windows

#### `--disable-d3d11`
**Purpose**: Disables Direct3D 11 acceleration
**Use Cases**:
- Graphics driver compatibility
- Performance comparison
- Windows-specific debugging

#### `--disable-direct-composition`
**Purpose**: Disables DirectComposition
**Use Cases**:
- Windows display debugging
- Composition issue troubleshooting
- Performance analysis

### Linux

#### `--no-zygote`
**Purpose**: Disables zygote process forking
**Use Cases**:
- Process debugging
- Security testing
- Linux-specific development

#### `--enable-native-notifications`
**Purpose**: Enables native Linux notifications
**Use Cases**:
- Desktop integration testing
- Notification debugging
- Linux-specific features

### macOS

#### `--disable-metal`
**Purpose**: Disables Metal graphics API
**Use Cases**:
- macOS graphics debugging
- Performance comparison
- Metal-specific issue diagnosis

## Security Considerations

### Safe Development Practices

When using command line switches for development:

1. **Isolate Test Profiles**: Always use `--user-data-dir` for testing
2. **Avoid Security Switches in Production**: Never deploy with `--disable-web-security`
3. **Document Usage**: Clearly document why specific switches are needed
4. **Regular Cleanup**: Remove unnecessary switches from development scripts

### Dangerous Switches

These switches disable security features and should only be used in controlled development environments:

- `--disable-web-security`
- `--allow-running-insecure-content`
- `--ignore-certificate-errors`
- `--no-sandbox`
- `--disable-same-origin-policy`

## Practical Usage Examples

### Local Development Setup

```bash
# Web development with CORS disabled
chrome --user-data-dir=/tmp/dev-profile \
       --disable-web-security \
       --allow-running-insecure-content \
       --remote-debugging-port=9222

# Mobile testing simulation
chrome --user-data-dir=/tmp/mobile-profile \
       --touch-events=enabled \
       --simulate-touch-screen-with-mouse \
       --user-agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)"
```

### Automated Testing

```bash
# Headless testing setup
chrome --headless \
       --no-sandbox \
       --disable-gpu \
       --disable-extensions \
       --disable-dev-shm-usage \
       --remote-debugging-port=9222

# Performance testing
chrome --user-data-dir=/tmp/perf-profile \
       --disable-background-timer-throttling \
       --disable-background-networking \
       --disable-default-apps \
       --no-first-run
```

### Extension Development

```bash
# Extension development and debugging
chrome --user-data-dir=/tmp/ext-profile \
       --load-extension=/path/to/extension \
       --enable-logging \
       --debug-packed-apps
```

## Finding More Switches

### Source Code Locations

Key files containing switch definitions:

- **Chrome Switches**: `src/chrome/common/chrome_switches.{h,cc}`
- **Content Switches**: `src/content/public/common/content_switches.{h,cc}`
- **Blink Switches**: `src/third_party/blink/public/common/switches.{h,cc}`
- **GPU Switches**: `src/gpu/command_buffer/service/gpu_switches.{h,cc}`

### Runtime Discovery

You can discover available switches at runtime:

```bash
# List all available switches (may not work in all versions)
chrome --help

# Check current switch state in DevTools
# Navigate to chrome://version/ to see active switches
```

## Best Practices

### Development Workflow

1. **Use Dedicated Profiles**: Separate profiles for different development scenarios
2. **Script Common Configurations**: Create shell scripts for frequently used switch combinations
3. **Document Dependencies**: Note which switches are required for specific features
4. **Version Awareness**: Some switches may change between Chrome versions

### Testing Strategy

1. **Baseline Testing**: Test with minimal switches first
2. **Incremental Addition**: Add switches one at a time to identify conflicts
3. **Cross-Platform Validation**: Test switch behavior across different operating systems
4. **Performance Impact**: Monitor performance impact of switch combinations

## Troubleshooting

### Common Issues

**Switch Not Working**: 
- Verify switch spelling and format
- Check if switch is available in your Chrome version
- Ensure proper escaping in shell environments

**Unexpected Behavior**:
- Check for conflicting switches
- Verify switch syntax (single vs double dash)
- Review switch dependencies

**Security Warnings**:
- Expected with security-disabling switches
- Ensure switches are only used in development
- Document security implications

## Related Documentation

- [Debugging Tools](debugging-tools.md) - Browser debugging techniques
- [Chrome Internal URLs](chrome-internals-urls.md) - Internal browser pages
- [Development Overview](../development/overview.md) - General development setup
- [Security Guidelines](../security/overview.md) - Security considerations

## References

- [Chromium Command Line Switch Source Code](https://source.chromium.org/chromium/chromium/src/+/main:chrome/common/chrome_switches.cc)
- [Content Switch Definitions](https://source.chromium.org/chromium/chromium/src/+/main:content/public/common/content_switches.cc)
- [Blink Feature Flags](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/platform/runtime_enabled_features.json5)