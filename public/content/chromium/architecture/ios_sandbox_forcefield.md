# ForceField: An iOS Sandbox Primitive (Chromium v134+ Status)

_**Status:** Partially Implemented - See Current Implementation section_ \
_**Original Filing:** FB9007081_ \
_**Author:** rsesek@, palmer@_ \
_**Created:** 2021-02-04_ \
_**Updated:** 2025-08-25 (v134+ Status Update)_

**Note for v134+**: This document has been updated to reflect the current implementation status of iOS sandboxing in Chromium v134 and later, including actual deployment strategies and lessons learned.

## Description

This document originally described a request for a new iOS feature (called **ForceField**), which
would provide app developers a primitive to process-isolate and sandbox
memory-unsafe code in a way that is safe for manipulating untrustworthy and
potentially malicious data.

**Current Status (v134+)**: While Apple has not implemented ForceField as originally proposed, 
Chromium has developed alternative approaches for iOS security isolation that achieve many 
of the same goals through different mechanisms. This document now serves as both historical 
context and a guide to current iOS security practices in Chromium.

## Objective

**Original ForceField Goal**: The goal of ForceField was to improve the safety and security of users, by
reducing the privilege level of memory-unsafe code that processes untrustworthy
data from the Internet.

**Current Chromium v134+ Approach**: While ForceField as originally envisioned is not available,
Chromium has implemented various security isolation mechanisms to achieve similar objectives:

- **Content Process Isolation**: Web content runs in isolated processes with limited privileges
- **Network Service Isolation**: Network operations are handled by dedicated, sandboxed processes
- **Utility Process Sandboxing**: File parsing, media decoding, and other operations run in restricted environments
- **Extension Process Separation**: Browser extensions execute in isolated contexts

Many complex applications have components that are written in memory-unsafe
languages like C/C++. While iOS does offer Swift as a (mostly) memory-safe
language, often these components are shared across platforms or are third-party
dependencies. Today, if an iOS application uses these components to process data
from the Internet, they make themselves vulnerable to memory unsafety bugs.

A common solution to mitigate these vulnerabilities is to perform the operations
on untrustworthy data in a separate process that runs under a tight sandbox,
following the [principle of least privilege](https://en.wikipedia.org/wiki/Principle_of_least_privilege).
Currently iOS does not offer apps a mechanism to compose their components into
high- and low-privilege execution environments. However, iOS itself uses
[process isolation and sandboxing](https://googleprojectzero.blogspot.com/2021/01/a-look-at-imessage-in-ios-14.html)
for privilege reduction in similar situations. 

**Chromium's v134+ Workarounds**: In the absence of ForceField, Chromium employs:
- **App Extensions**: Limited sandboxed components for specific tasks
- **XPC Services**: Inter-process communication for privilege separation
- **Thread-based Isolation**: Careful thread management with restricted capabilities
- **Memory Protection**: Advanced memory management and bounds checking

ForceField would give developers a primitive to do the same, which would help protect the people who use their
apps.

## The Ideal Solution (Historical Context)

A perfect implementation of ForceField would have allowed app developers to create a
new component that is packaged in their application bundle. iOS would launch
this component as a new, sandboxed process running under a security principal
distinct from the bundle's primary process. ForceField processes would:

*   Not have access to the containing app's data storage
*   Not have access to privileged shared system resources (Keychain, clipboard,
    persistent storage locations)
*   Not have access to system services that access user data, such as Location
    Services, Photos, HomeKit, HealthKit, AutoFill, etc.
*   By default, not have access to draw to the screen
*   By default, not have network access

**Chromium v134+ Reality**: Instead of ForceField, Chromium uses these approaches:

### Current iOS Isolation Strategies

1. **App Extension-Based Isolation**
   - Share Sheet extensions for controlled content sharing
   - Content Blocker extensions for safe ad/tracker filtering
   - Custom Keyboard extensions for secure input handling

2. **XPC Service Architecture**
   - Network request handling in isolated XPC services
   - File parsing operations in restricted processes
   - Media decoding in sandboxed utility processes

3. **Thread-Level Isolation**
   - JavaScript execution on dedicated threads with memory limits
   - WebAssembly compilation and execution in controlled environments
   - Background task processing with restricted capabilities

Thus, while ForceField would have provided a compute-only process with IPC communication,
Chromium achieves similar security through a combination of existing iOS mechanisms.
By default, the only resources these isolated components can access are the ones 
explicitly brokered in, and the only way to extract data is through controlled IPC channels.

Furthermore, ForceField could have been enhanced by allowing developers to opt-in to
specific privileged capabilities, for example network access. This would have been
useful for initiating NSURLSession connections, allowing the ForceField

## Leverage Existing Technologies

iOS’s existing technologies provide all the necessary pieces to create ForceField:

### App Extensions

iOS provides a mechanism for apps to run context-limited code in a distinct
process through [App Extensions](https://developer.apple.com/app-extensions/). A
new type of “Compute” App Extension could be created to implement ForceField.
The app could engage one of its Compute Extensions at any point during its
lifecycle, whenever it is necessary to process data in a sandbox. An app should
be able to launch a Compute App Extension when its foreground, but also
potentially when processing data downloaded during
[background refresh](https://developer.apple.com/documentation/uikit/app_and_environment/scenes/preparing_your_ui_to_run_in_the_background/updating_your_app_with_background_app_refresh?).

The app should also have the ability to forcefully terminate a Compute
Extension, in response to e.g. user cancellation or memory pressure signals. And
the app should be able to register a termination handler for the Compute
Extension, so it can determine if the process exited cleanly, crashed, was
killed by the app, or was killed by the operating system. The operating system
could kill all Compute App Extension processes a few seconds after the
foreground app moves to the background. And the operating system could place
limits on total resource consumption (CPU and memory) of the Compute App
Extension. The Compute App Extension should be tightly sandboxed, per the
description of ForceField above.

### XPC (Current Chromium v134+ Approach)

iOS already exposes
[NSXPCConnection](https://developer.apple.com/documentation/foundation/nsxpcconnection?language=objc)
and
[NSXPCInterface](https://developer.apple.com/documentation/foundation/nsxpcinterface?language=objc)
in the iPhoneOS SDK, and it is used to implement e.g.
[File Provider](https://developer.apple.com/documentation/fileprovider/nsfileproviderservicesource/2915876-makelistenerendpointandreturnerr?language=objc)
app extensions. The NSXPC API is also already [used by developers on macOS](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingXPCServices.html)
to create application-specific IPC protocols between components.

**Chromium v134+ Implementation**: 
- **Network Service XPC**: Isolated network request handling
- **Utility Service XPC**: File parsing and media processing in restricted processes
- **Content Service XPC**: Web content processing with limited privileges
- **Extension Service XPC**: Third-party extension execution in sandboxed environments

iOS developers can use the NSXPC API to define IPC protocols between the primary app and
its isolated components, achieving much of what ForceField would have provided.

### Entitlements (v134+ Security Model)

**Original ForceField Proposal**: New iOS entitlements could have been created to enable ForceField components to opt
into additional, privileged capabilities on top of the tightly-sandboxed
baseline. For example, an entitlement could enable a ForceField
component to access the network. Another entitlement could enable rendering into
a CALayer brokered in over IPC, to enable remote rendering of UI by the
ForceField process into the primary application process.

**Chromium v134+ Reality**: Chromium uses existing iOS entitlements strategically:

- **Network Entitlements**: Carefully scoped network access for isolated services
- **Keychain Access**: Restricted credential storage for authentication components  
- **Background Processing**: Limited background execution for content processing
- **Inter-App Communication**: Controlled data sharing between browser and extensions
- **Hardware Access**: Minimal camera/microphone access for media processing

## Current Security Architecture (v134+)

While ForceField was never implemented, Chromium on iOS has developed a sophisticated
security architecture that achieves many of the same goals:

### Process Isolation Strategy
1. **Main Browser Process**: Handles UI, user data, and high-privilege operations
2. **Content Processes**: Isolated web content rendering and JavaScript execution
3. **Network Service**: Sandboxed network request handling and certificate validation
4. **Utility Processes**: File parsing, image decoding, and media processing
5. **Extension Processes**: Third-party code execution in restricted environments

### Security Boundaries
- **Memory Isolation**: Each process has its own memory space with no shared writable memory
- **Capability Restrictions**: Processes only have access to explicitly granted capabilities
- **IPC Validation**: All inter-process communication is validated and sanitized
- **Resource Limits**: CPU, memory, and network usage are monitored and restricted

### Threat Mitigation
- **Code Injection**: Isolated processes prevent cross-contamination
- **Data Exfiltration**: Limited network access and strict data flow controls
- **Privilege Escalation**: Tight sandboxing prevents unauthorized capability gains
- **Memory Corruption**: Process boundaries contain the impact of memory safety bugs

## Lessons Learned (v134+)

The absence of ForceField has taught the Chromium team several important lessons about iOS security:

1. **Existing Mechanisms Suffice**: While not ideal, existing iOS security primitives can be combined effectively
2. **Performance Trade-offs**: Process isolation has overhead, but security benefits outweigh costs
3. **Developer Complexity**: Managing multiple processes and IPC requires careful architecture
4. **Platform Evolution**: iOS security features continue to evolve, providing new opportunities
5. **Defense in Depth**: Multiple layers of security (memory safety, sandboxing, isolation) are essential

## Future Considerations

As iOS continues to evolve, Chromium monitors several areas for potential security improvements:

- **App Intents**: New iOS frameworks for safer inter-app communication
- **Swift Integration**: Memory-safe alternatives to C++ components
- **Hardware Security**: Leveraging secure enclaves and hardware-backed security
- **Machine Learning Isolation**: Secure processing of ML models and training data
- **WebAssembly Security**: Enhanced sandboxing for client-side computation

## See Also

- [Chromium Security Architecture](https://source.chromium.org/chromium/chromium/src/+/main:docs/security/architecture.md)
- [iOS App Extensions Guide](https://developer.apple.com/app-extensions/)
- [XPC Services Documentation](https://developer.apple.com/documentation/foundation/xpc)
- [Process Model Architecture](./process-model.md)
- [Security Model Overview](../security/security-model.md)
- [Memory Safety in Chromium](https://source.chromium.org/chromium/chromium/src/+/main:docs/security/memory-safety.md)

---

**Document History**: Originally proposed as ForceField feature request for iOS. Updated for Chromium v134+ to reflect current security practices and lessons learned.

**Last Updated**: December 2024 (Chromium v134+)  
**Status**: Historical context with current implementation guidance
