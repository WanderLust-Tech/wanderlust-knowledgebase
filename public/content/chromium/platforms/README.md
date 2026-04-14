# Platform-Specific Documentation

This section contains documentation specific to each platform that Chromium supports.

## Platforms

### [Android](android/)
Mobile platform documentation including build instructions, JNI best practices, and Android-specific features.

- [Build Instructions](android/android_build_instructions.md)
- [Debugging Instructions](android/android_debugging_instructions.md)
- [JNI Ownership Best Practices](android/android_jni_ownership_best_practices.md)
- [Android Studio Setup](android/android_studio.md)

### [iOS](ios/)
iOS platform documentation including build instructions and platform-specific considerations.

- [Build Instructions](ios/ios_build_instructions.md)
- [iOS Infrastructure](ios/ios_infra.md)
- [VoiceOver Support](ios/ios_voiceover.md)

### [ChromeOS](chromeos/)
ChromeOS-specific documentation including build instructions and platform features.

- [Build Instructions](chromeos/chromeos_build_instructions.md)
- [ChromeOS Glossary](chromeos/chromeos_glossary.md)

### [Windows](windows/)
Windows platform documentation including build instructions and Windows-specific features.

- [Build Instructions](windows/windows_build_instructions.md)
- [Native Window Occlusion Tracking](windows/windows_native_window_occlusion_tracking.md)
- [PWA Integration](windows/windows_pwa_integration.md)

### [macOS](mac/)
macOS platform documentation including build instructions and macOS-specific features.

- [Build Instructions](mac/mac_build_instructions.md)
- [ARM64 Support](mac/mac_arm64.md)
- [LLD Linker](mac/mac_lld.md)

## Cross-Platform Considerations

When developing for multiple platforms, consider:

- **API Availability**: Not all APIs are available on all platforms
- **Performance Characteristics**: Different platforms have different performance profiles
- **Security Models**: Platform-specific security requirements and capabilities
- **UI Guidelines**: Each platform has its own design guidelines

## Related Documentation

- [Architecture Overview](../architecture/overview.md)
- [Development Guidelines](../development/)
- [Security Considerations](../security/)
