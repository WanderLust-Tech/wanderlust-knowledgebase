# Accessibility in Chromium

This section covers Chromium's comprehensive accessibility implementation, including assistive technologies, platform-specific features, development practices, and architectural design patterns. Whether you're implementing accessibility features, debugging accessibility issues, or contributing to assistive technologies, you'll find detailed technical documentation here.

## Quick Navigation

### 🏗️ [Core Overview](overview.md)
**Start here** to understand Chromium's accessibility fundamentals, the accessibility tree, events, actions, and multi-process architecture.

### 🤖 Assistive Technologies
Detailed implementation guides for Chrome's built-in assistive technologies:
- [**ChromeVox Screen Reader**](assistive-technologies/chromevox.md) - Chrome OS built-in screen reader
- [**ChromeVox on Desktop Linux**](assistive-technologies/chromevox-desktop-linux.md) - Development setup
- [**Select-to-Speak**](assistive-technologies/select-to-speak.md) - Text-to-speech selection tool
- [**Text-to-Speech (TTS)**](assistive-technologies/tts.md) - Speech synthesis architecture
- [**Automatic Clicks**](assistive-technologies/autoclick.md) - Dwell control for motor impairments
- [**BRLTTY Braille Support**](assistive-technologies/brltty.md) - Braille display integration
- [**eSpeak Speech Engine**](assistive-technologies/espeak.md) - Open-source TTS engine
- [**PATTS Speech Engine**](assistive-technologies/patts.md) - Google's internal TTS engine

### 🎯 Platform Features
Accessibility features and platform-specific implementations:
- [**Reader Mode**](features/reader-mode.md) - Simplified reading experience
- [**Android Accessibility**](features/android.md) - Chrome accessibility on Android
- [**Offscreen & Invisible Handling**](features/offscreen.md) - Visibility and bounding box calculations

### 🔧 Development & Testing
Tools and practices for accessibility development:
- [**Testing Framework**](development/testing.md) - Complete testing guide for accessibility
- [**Performance Considerations**](development/performance.md) - Accessibility performance testing

### 📋 Release Management
Process documentation for accessibility releases:
- [**Release Notes Process**](release-notes/relnotes.md) - AX-Relnotes requirements and guidelines

## Learning Path

This accessibility section is designed as **Phase 8.5** in the [Wanderlust Knowledge Base Learning Path](../learning-path-guide.md).

**Prerequisites:**
- Understanding of Chromium's [core architecture](../architecture/overview.md)
- Familiarity with [APIs & Services](../apis/overview.md)
- Basic knowledge of web accessibility standards (ARIA, WCAG)

**Recommended Study Order:**
1. **Foundation**: Start with [Core Overview](overview.md)
2. **Architecture**: Understand the accessibility tree and multi-process design
3. **Assistive Technologies**: Explore ChromeVox and other built-in tools
4. **Platform Features**: Learn about Reader Mode and platform-specific implementations
5. **Development**: Study testing frameworks and development practices

## Key Concepts Covered

### 🏗️ **Accessibility Architecture**
- **Accessibility Tree**: How Chromium represents UI as a tree of accessible objects
- **Multi-Process Coordination**: Renderer-to-browser accessibility data flow
- **Platform API Integration**: Windows IAccessible, macOS NSAccessibility, Linux ATK
- **Cross-Process Communication**: Mojo-based accessibility IPC

### 🤖 **Assistive Technology Integration**
- **Screen Reader Support**: ChromeVox implementation and debugging
- **Speech Synthesis**: TTS engines (eSpeak, PATTS) and web speech API
- **Braille Display Support**: BRLTTY integration and setup
- **Motor Accessibility**: Automatic clicks and dwell control

### 🎯 **User Experience Features**
- **Content Simplification**: Reader Mode DOM distiller integration
- **Text-to-Speech Selection**: Select-to-speak implementation
- **Mobile Accessibility**: Android WebView and Chrome accessibility
- **Cross-Platform Consistency**: Ensuring feature parity across platforms

### 🔧 **Development Practices**
- **Testing Methodologies**: Web tests, browser tests, and accessibility-specific test frameworks
- **Debugging Tools**: Chrome DevTools accessibility features and external debugging
- **Performance Optimization**: Efficient accessibility tree updates and IPC
- **Release Management**: AX-Relnotes process and user-facing change documentation

## Related Documentation

- **[Core Architecture](../architecture/overview.md)** - Understanding Chromium's overall design
- **[APIs & Services](../apis/overview.md)** - Modern API patterns and Mojo architecture
- **[Extension API System](../features/extension-api-system.md)** - Extension accessibility integration
- **[Security Architecture](../security/security-model.md)** - Accessibility and security considerations
- **[Testing & QA](../development/testing/testing_in_chromium.md)** - General testing methodologies

## Contributing

When contributing to accessibility features:
1. **Always include AX-Relnotes** in commit messages (see [Release Notes Process](release-notes/relnotes.md))
2. **Test across platforms** - accessibility behavior varies significantly between OS platforms
3. **Consider assistive technology compatibility** - test with actual screen readers and other AT
4. **Follow ARIA standards** - ensure web accessibility standards compliance
5. **Update documentation** - accessibility features require thorough documentation

---

**Time Investment:** 3-4 hours for comprehensive understanding  
**Difficulty Level:** Intermediate to Advanced  
**Best For:** Developers working on inclusive design, accessibility features, or assistive technology integration