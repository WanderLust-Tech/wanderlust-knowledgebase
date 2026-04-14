# RenderFrameHost Use-After-Free Vulnerability Analysis

> **CVE-2020-6416 (Issue 1068395)** - A comprehensive analysis of a Use-After-Free vulnerability in Chromium's Browser Process that can be exploited to escape the sandbox on Android devices.

[TOC]

## Overview

This document provides an in-depth technical analysis of a critical Use-After-Free (UAF) vulnerability discovered in Chromium's RenderFrameHost implementation. The vulnerability, tracked as **issue 1068395**, demonstrates a dangerous pattern that has repeatedly appeared in the Chromium codebase and represents a significant security risk for Android devices.

### Vulnerability Summary

- **Issue ID**: 1068395
- **Type**: Use-After-Free in Browser Process
- **Impact**: Sandbox escape on Android devices
- **Root Cause**: Improper lifetime management between RenderFrameHost objects and Mojo interface implementations
- **Attack Vector**: Compromised Renderer Process + JavaScript-controlled iframe manipulation

## Background: RenderFrameHost Architecture

### What is RenderFrameHost?

When a website is navigated to, Chromium's Browser Process spawns a new Renderer Process to parse and display the website's content (JavaScript, HTML, CSS). To track and communicate with the main frame, the Browser Process instantiates a **RenderFrameHostImpl (RFH)** object.

The complexity increases with **child-frames (iframes)**:
- **Same-origin iframes**: Renderer Process creates a frame object, Browser Process creates corresponding RFH
- **Cross-origin iframes**: Browser Process spawns new Renderer Process (Site Isolation)

**Critical Insight**: JavaScript can control RFH object creation and destruction through iframe manipulation!

### RenderFrameHost and Mojo Interfaces

Modern Chromium uses **Mojo IPC** for inter-process communication. Mojo interfaces are typically bound per-frame, meaning each iframe creation can allocate new Mojo interface objects in the Browser Process.

#### Safe Mojo Interface Pattern

```cpp
// Safe pattern - lifetime tied to RenderFrameHost
void RenderFrameHostImpl::GetSensorProvider(
    mojo::PendingReceiver<device::mojom::SensorProvider> receiver) {
  if (!sensor_provider_proxy_) {
    sensor_provider_proxy_ = std::make_unique<SensorProviderProxyImpl>(
        PermissionControllerImpl::FromBrowserContext(
            GetProcess()->GetBrowserContext()),
        this);  // RFH pointer stored
  }
  sensor_provider_proxy_->Bind(std::move(receiver));
}
```

In this safe pattern, the `SensorProviderProxyImpl` is a member variable of `RenderFrameHostImpl`, ensuring lifetimes are properly synchronized.

#### Dangerous Mojo Interface Pattern

```cpp
// Dangerous pattern - self-owned receiver
mojo::MakeSelfOwnedReceiver(
    std::make_unique<SomeInterface>(render_frame_host),
    std::move(receiver)
);
```

Self-owned receivers tie object lifetime to the Mojo connection rather than the RFH, creating UAF opportunities.

## The SmsReceiver Vulnerability

### Vulnerability Discovery

The vulnerability was discovered in the `SmsReceiver` Mojo interface implementation through analysis of `browser_interface_binders.cc` changes.

### Vulnerable Code Path

#### 1. SmsReceiver Binding

```cpp
void RenderFrameHostImpl::BindSmsReceiverReceiver(
    mojo::PendingReceiver<blink::mojom::SmsReceiver> receiver) {
  
  // Get or create SmsFetcher tied to BrowserContext
  auto* fetcher = SmsFetcher::Get(GetProcess()->GetBrowserContext(), this);
  
  // Create self-owned SmsService
  SmsService::Create(fetcher, this, std::move(receiver));
}
```

#### 2. SmsFetcher Creation

```cpp
SmsFetcher* SmsFetcher::Get(BrowserContext* context, RenderFrameHost* rfh) {
  auto* stored_fetcher = static_cast<SmsFetcherImpl*>(
      context->GetUserData(kSmsFetcherImplKeyName));
  
  if (!stored_fetcher || !stored_fetcher->CanReceiveSms()) {
    auto fetcher = std::make_unique<SmsFetcherImpl>(
        context, SmsProvider::Create(rfh));  // RFH passed to SmsProvider
    context->SetUserData(kSmsFetcherImplKeyName, std::move(fetcher));
  }
  
  return static_cast<SmsFetcherImpl*>(
      context->GetUserData(kSmsFetcherImplKeyName));
}
```

**Key Issue**: `SmsFetcher` lifetime is tied to `BrowserContext` (Profile), which lives longer than individual RFH objects!

#### 3. SmsProvider Creation

```cpp
std::unique_ptr<SmsProvider> SmsProvider::Create(RenderFrameHost* rfh) {
#if defined(OS_ANDROID)
  if (base::CommandLine::ForCurrentProcess()->GetSwitchValueASCII(
          switches::kWebOtpBackend) ==
      switches::kWebOtpBackendSmsVerification) {
    return std::make_unique<SmsProviderGmsVerification>();
  }
  return std::make_unique<SmsProviderGmsUserConsent>(rfh);  // RFH stored as raw pointer!
#else
  return nullptr;
#endif
}
```

#### 4. Dangerous Raw Pointer Storage

```cpp
SmsProviderGmsUserConsent::SmsProviderGmsUserConsent(RenderFrameHost* rfh)
    : SmsProvider(), render_frame_host_(rfh) {  // Raw pointer stored!
  JNIEnv* env = AttachCurrentThread();
  j_sms_receiver_.Reset(Java_SmsUserConsentReceiver_create(
      env, reinterpret_cast<intptr_t>(this)));
}

void SmsProviderGmsUserConsent::Retrieve() {
  JNIEnv* env = AttachCurrentThread();
  
  // VULNERABLE: Uses potentially freed RFH pointer
  WebContents* web_contents = 
      WebContents::FromRenderFrameHost(render_frame_host_);
      
  if (!web_contents || !web_contents->GetTopLevelNativeWindow())
    return;
    
  Java_SmsUserConsentReceiver_listen(
      env, j_sms_receiver_,
      web_contents->GetTopLevelNativeWindow()->GetJavaObject());
}
```

### Vulnerability Mechanism

The core issue is a **lifetime mismatch**:

1. **SmsFetcher** is created once and stored in `BrowserContext` (Profile lifetime)
2. **SmsProviderGmsUserConsent** stores raw pointer to the creating RFH
3. **RenderFrameHost** can be destroyed when iframe is removed
4. **SmsFetcher reuse** means subsequent `SmsReceiver` bindings use the same `SmsProviderGmsUserConsent` with a **dangling RFH pointer**

### Attack Scenario

```
Timeline of Exploitation:

1. Create iframe A → Bind SmsReceiver → Creates SmsFetcherImpl with SmsProviderGmsUserConsent(rfh_A)
2. Create iframe B → Bind SmsReceiver → Reuses existing SmsFetcherImpl 
3. Delete iframe A → RFH A destroyed, but SmsProviderGmsUserConsent still holds rfh_A pointer
4. Call SmsReceiver.receive() on iframe B → Uses freed rfh_A pointer → UAF!
```

## Exploitation Analysis

### UAF Trigger Point

The UAF occurs in `WebContents::FromRenderFrameHost()`:

```cpp
WebContents* WebContents::FromRenderFrameHost(RenderFrameHost* rfh) {
  if (!rfh)
    return nullptr;
    
  // First virtual call - IsCurrent()
  if (!rfh->IsCurrent() && base::FeatureList::IsEnabled(
      kCheckWebContentsAccessFromNonCurrentFrame)) {
    base::debug::DumpWithoutCrashing();
  }
  
  // Second virtual call - delegate()->GetAsWebContents()
  return static_cast<RenderFrameHostImpl*>(rfh)->delegate()->GetAsWebContents();
}
```

Both `IsCurrent()` and `GetAsWebContents()` are **virtual methods**, making them excellent targets for control flow hijacking through vtable manipulation.

### Android Zygote ASLR Weakness

On Android, the **Zygote process model** creates a significant security weakness:

- All processes spawned from Zygote **share the same ASLR base** for shared libraries
- Browser Process and Renderer Process have **identical virtual memory mappings** for shared libraries
- **Compromised Renderer** can determine addresses in Browser Process

This eliminates the primary protection against ROP/JOP attacks.

### Exploitation Technique: libllvm-glnext.so GOT Hijacking

The exploit leverages a specific Android library:

1. **Target**: `libllvm-glnext.so` contains function pointer to `system()` in `.GOT` segment
2. **Technique**: Replace RFH vtable pointer to point to `libllvm-glnext.so .GOT`
3. **Payload**: RFH object content becomes `system()` command argument
4. **Result**: Arbitrary command execution in Browser Process context

### ARM Assembly Analysis

```armasm
; WebContents::FromRenderFrameHost() disassembly
0x00: 10 B5     push  {r4, lr}
0x02: 98 B1     cbz   r0, #0x2c
0x04: 04 46     mov   r4, r0      ; R4 = RFH pointer
0x06: 00 68     ldr   r0, [r0]    ; R0 = RFH->vtable
0x08: D0 F8 BC 10  ldr.w r1, [r0, #0xbc]  ; R1 = vtable[0xBC/4] (system ptr)
0x0c: 20 46     mov   r0, r4      ; R0 = RFH pointer (system argument)
0x0e: 88 47     blx   r1          ; Call system(RFH) - EXPLOITATION POINT

; Second virtual call for crash avoidance
0x20: E0 6F     ldr   r0, [r4, #0x7c]     ; R0 = RFH->member_7c
0x22: 01 68     ldr   r1, [r0]            ; R1 = member_7c->vtable  
0x24: 49 6E     ldr   r1, [r1, #0x64]     ; R1 = vtable[0x64/4]
0x2a: 08 47     bx    r1                  ; Call GetAsWebContents()
```

### Heap Manipulation Strategy

#### Object Replacement via Heap Spraying

1. **Target Size**: RFH object is `0x880` bytes
2. **Spray Technique**: Use existing "Virtually Unlimited Memory" technique
3. **jemalloc Considerations**: 
   - Browser Process uses jemalloc with **thread-specific caches**
   - RFH created/destroyed on **UI thread**
   - Heap spray happens on **IO thread**
   - Requires **cache flush** to enable cross-thread allocation

#### Payload Structure

```
Offset 0x00: Fake vtable pointer = libllvm-glnext.so.GOT - 0xBC
Offset 0x04: Shell command = " || (toybox nc -p 4444 -l /bin/sh)"
Offset 0x7C: Magic pointer = libllvm-glnext.so function returning 0
```

## Mitigation Strategies

### Chromium's Built-in Protections

#### 1. WebContentsObserver Pattern

```cpp
class SafeMojoInterface : public WebContentsObserver {
  void RenderFrameDeleted(RenderFrameHost* render_frame_host) override {
    if (render_frame_host_ == render_frame_host) {
      render_frame_host_ = nullptr;  // Clear dangling pointer
    }
  }
private:
  RenderFrameHost* render_frame_host_;
};
```

#### 2. FrameServiceBase Pattern

```cpp
class SmsService : public FrameServiceBase {
  // Automatically destroyed when RenderFrameHost is deleted
};
```

`FrameServiceBase` guarantees the Mojo interface object is freed when its associated RFH is deleted.

### Modern Mitigation Efforts

Google has implemented several mitigations:

1. **PartitionAlloc Everywhere**: Improved heap isolation
2. **MiraclePtr**: Smart pointer to detect UAF
3. ***Scan**: Memory safety scanning
4. **Site Isolation**: Process-level isolation

## Security Implications

### Attack Chain Requirements

1. **Renderer Compromise**: Attacker needs code execution in Renderer Process
2. **MojoJS Access**: Ability to bind Mojo interfaces from JavaScript
3. **Heap Manipulation**: Control over Browser Process heap allocations
4. **Android Platform**: Zygote ASLR weakness specific to Android

### Impact Assessment

- **Immediate**: Browser Process code execution
- **Limitation**: Still within Android app sandbox
- **Escalation**: Requires additional kernel exploit for full device compromise

## Detection and Prevention

### Detection Strategies

1. **Static Analysis**: Look for patterns where Mojo interfaces store raw RFH pointers
2. **Dynamic Analysis**: Monitor RFH destruction and subsequent Mojo method calls
3. **Fuzzing**: Test iframe creation/destruction with Mojo interface bindings

### Code Review Guidelines

1. **Lifetime Analysis**: Ensure Mojo interface lifetime ≤ RFH lifetime
2. **Use Safe Patterns**: Prefer `FrameServiceBase` over `MakeSelfOwnedReceiver`
3. **Validate Object State**: Check RFH validity before use
4. **Audit BrowserContext Storage**: Review objects stored in Profile-level data

## Conclusion

The RenderFrameHost UAF vulnerability demonstrates the complexity of lifetime management in multi-process browsers. The interaction between:

- JavaScript-controlled iframe lifecycle
- Mojo interface binding patterns
- BrowserContext-scoped object storage
- Android's Zygote ASLR weakness

Created a perfect storm for exploitation. This analysis serves as both a learning resource and a warning about the importance of careful lifetime management in browser architecture.

The vulnerability pattern has appeared multiple times in Chromium history, emphasizing the need for:
- Robust static analysis tools
- Clear lifetime management guidelines
- Defensive coding patterns like `FrameServiceBase`
- Comprehensive security reviews of Mojo interface implementations

## Related Vulnerabilities

This UAF pattern has manifested in multiple Chromium issues:
- [Issue 1134480](https://bugs.chromium.org/p/chromium/issues/detail?id=1134480)
- [Issue 1101509](https://bugs.chromium.org/p/chromium/issues/detail?id=1101509)
- [Issue 1128270](https://bugs.chromium.org/p/chromium/issues/detail?id=1128270)
- [Issue 1122917](https://bugs.chromium.org/p/chromium/issues/detail?id=1122917)
- [Issue 1078671](https://bugs.chromium.org/p/chromium/issues/detail?id=1078671)
- [Issue 1106342](https://bugs.chromium.org/p/chromium/issues/detail?id=1106342)

## References

- [Original Microsoft Edge Vulnerability Research Post](https://microsoftedge.github.io/edgevr/posts/yet-another-uaf/)
- [Chromium Bug 1068395](https://bugs.chromium.org/p/chromium/issues/detail?id=1068395)
- [Chrome Vulnerability Rewards Program](https://www.google.com/about/appsecurity/chrome-rewards/)
- [Site Isolation Documentation](https://www.chromium.org/Home/chromium-security/site-isolation)
- [Virtually Unlimited Memory: Escaping the Chrome Sandbox](https://googleprojectzero.blogspot.com/2019/04/virtually-unlimited-memory-escaping.html)