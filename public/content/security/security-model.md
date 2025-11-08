# Security Model

Chromium’s security architecture is layered to protect users from malicious content, compromised sites, and browser vulnerabilities. This article breaks down the key pieces of that model—from sandboxing to origin isolation to transport security—and points you to the source files where each is implemented.

---

## 1. Threat Model & Goals

- **Threats Addressed**  
  - Arbitrary code execution via renderer or plugin bugs  
  - Cross-site data leakage (XSS, CSRF)  
  - Network eavesdropping or man-in-the-middle attacks  
- **Security Goals**  
  1. **Isolation**: ensure that untrusted web content cannot read or write user data outside its scope.  
  2. **Least Privilege**: run each component with minimal OS privileges.  
  3. **Defense in Depth**: multiple overlapping safeguards (sandbox, site isolation, CSP).  

---

## 2. Origin & Same-Origin Policy

- **Origin Definition**  
  - A tuple of (scheme, host, port). Two pages may interact only if all three match.  
- **Enforcement**  
  - Implemented in Blink’s DOM bindings under `third_party/blink/renderer/bindings/`.  
  - Checked in navigation, XHR/fetch, iframe embedding, `document.cookie`.  
- **Key Files**  
  - `security_origin.cc` (defines `SecurityOrigin` and policy checks)  
  - `script_security.cc` (enforces JS‐level checks)

---

## 3. Site Isolation & Process-Per-Site

- **Site-Per-Process**  
  - By default, Chromium maps each “site” (origin) into its own renderer process.  
  - Prevents a compromised renderer from poking into other sites’ memory.  
- **Implementation**  
  - Controlled by GN flag `site_per_process` in `content/browser/site_isolation/`.  
  - `SiteIsolationPolicy` and `SiteInstance` classes coordinate process mapping.  
- **Crash Containment**  
  - Renderer crash shows only that tab’s error page; other tabs unaffected.

---

## 4. OS-Level Sandboxing

Chromium runs its renderers and helper processes in strict OS sandboxes:

| Platform | Mechanism                                          | Source Location                           |
|----------|----------------------------------------------------|-------------------------------------------|
| **Windows** | Job objects + restricted tokens                 | `sandbox/win/`                            |
| **Linux**   | setuid “chrome-sandbox” or seccomp‐bpf filters  | `sandbox/linux/`                          |
| **macOS**   | Seatbelt profiles                                | `sandbox/mac/`                            |

- **Sandbox Brokers**  
  - A minimal “broker” process handles syscalls (e.g. DNS, font enumeration) on behalf of the sandboxed child.  
- **Key Files**  
  - `sandbox_init.cc`  
  - Platform‐specific policy headers under `sandbox/{win,linux,mac}/`.

---

## 5. Permissions & Feature Policy

- **Permissions API**  
  - JS interfaces for `geolocation`, `notifications`, `camera`, etc.  
  - Backed by `PermissionController` in `content/browser/permissions/`.  
- **Feature Policy / Permissions Policy**  
  - Page‐level opt-in/opt-out controls which APIs iframes can use.  
  - Defined via `FeaturePolicy` in Blink (`third_party/blink/renderer/core/feature_policy/`).  
- **UI Prompt**  
  - Browser UI for granting/denying lives in `chrome/browser/ui/permission_bubble/`.

---

## 6. Content Security Policy (CSP)

- **CSP Headers**  
  - Enforced by Blink’s `CSPContext` in `third_party/blink/renderer/core/loader/`.  
  - Prevents inline script, remote code, or framing per site’s policy.  
- **Reporting**  
  - Violation reports sent via `ReportSender` to configured endpoints.  

---

## 7. Transport Security & Certificate Validation

- **Trust Store**  
  - Uses OS‐provided roots on Windows/macOS; Mozilla’s on Linux.  
  - Managed in `net/cert/` (`cert_verifier.cc`, `root_store.cc`).  
- **HSTS / HPKP**  
  - HSTS enforced by `TransportSecurityState`.  
  - HPKP deprecated but still present in some code paths.  
- **OCSP & CRL Sets**  
  - Stapled OCSP responses validated in `net/ocsp/`.  
  - Chrome uses "CRLSet" updates via Safe Browsing service.

---

## 8. Memory Safety & Use-After-Free Prevention

Chromium employs sophisticated patterns to prevent memory safety vulnerabilities:

- **CheckedObserver Pattern**  
  - Prevents Use-After-Free (UAF) bugs in observer patterns by transforming potential crashes into deterministic CHECK() failures.  
  - Implemented in `base/checked_observer.h` with automatic cleanup in observer destructors.  
  - See **Design Patterns → Observer Pattern** for comprehensive implementation details.

- **WeakPtr & Weak References**  
  - Automatic null detection for deleted objects prevents stale pointer dereferences.  
  - Used extensively in callback patterns and async operations.

- **Smart Pointers & RAII**  
  - `std::unique_ptr`, `std::shared_ptr`, and Chromium's `scoped_refptr` for automatic resource management.  
  - Scoped resource holders like `ScopedObserverRegistration` ensure proper cleanup.

- **MiraclePtr Protection**  
  - Advanced memory safety system for detecting and preventing exploitation of use-after-free bugs.  
  - Provides deterministic protection against UAF exploitation in production builds.

- **Key Files**  
  - `base/checked_observer.h` - CheckedObserver implementation  
  - `base/memory/weak_ptr.h` - WeakPtr system  
  - `base/memory/` - Smart pointer implementations

---

## 9. Safe Browsing & Malware Protection

- **Phishing & Malware Lists**  
  - Maintained by Google; downloaded to browser periodically.  
  - Checks happen in `safe_browsing/` under `chrome/browser/`.  
- **Interstitial UI**  
  - Block pages with clear warnings.  
  - Code in `chrome/browser/safe_browsing/`.  

---

## 10. Extension Security

- **Isolated Worlds**  
  - Content scripts run in separate V8 contexts with limited DOM access.  
- **Permission Model**  
  - Declared in `manifest.json`, enforced by `ExtensionPermission` classes.  
- **Native Messaging**  
  - Host apps communicate via a JSON‐over‐stdin bridge with strict path restrictions.

---

## 11. Developer Tools & Auditing

- **chrome://security** (future) and `chrome://sandbox` pages  
- **chrome://webrtc-internals** for inspecting WebRTC security parameters  
- **Auditing Tools**  
  - `chrome://policy` for Enterprise policy enforcement  
  - Tracing categories: `SECURITY`, `NETWORK_SECURITY` in `chrome://tracing`

---

## 11. Testing & Hardening

- **Unit & Integration Tests**  
  - `content/browser/site_isolation_browsertest`  
  - `security_interstitial_browsertest`  
  - `sandbox_browsertest`  
- **Fuzzing**  
  - OSS-Fuzz integration for renderer, V8, PDFium, libogg, etc.  

---

## 12. Next Steps

1. **Advanced Security Research**: [Advanced Mojo IPC & Security Research](advanced-mojo-ipc-security.md) - Deep dive into Mojo vulnerabilities and exploitation techniques
2. Read **Debugging → Debugging Tools** to learn how to trace sandbox violations.  
3. Explore **Modules → Networking (HTTP)** for TLS handshake internals.  
4. Dive into **Architecture → Process Model** to see how sandboxed processes communicate.  
5. Learn about **Design Patterns → Observer Pattern** for memory-safe observer implementations.
6. Study **Modules → V8 Compiler Internals** for JavaScript engine security and JIT compilation vulnerabilities.

---
