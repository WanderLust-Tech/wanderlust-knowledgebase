# Delegate Pattern in Modern Chromium (v134+)

The **Delegate Pattern** is a cornerstone architectural pattern in modern Chromium, enabling sophisticated component decoupling, dependency injection, and extensibility throughout the browser's complex service-oriented architecture. In v134+, this pattern has evolved to support advanced features like Mojo interfaces, capability-based security, and cross-process communication.

---

## Modern Delegate Pattern Overview (v134+)

The Delegate Pattern in Chromium v134+ represents a sophisticated evolution of traditional delegation, incorporating modern C++20/23 features, type safety, and integration with the browser's advanced service architecture.

### Enhanced Key Features:
- **Type-Safe Delegation**: Modern C++ templates and concepts for compile-time safety
- **Mojo Integration**: Seamless integration with Chromium's IPC system
- **Capability-Based Security**: Delegates respect process boundaries and security policies
- **Service-Oriented Architecture**: Delegates work across Chromium's microservice ecosystem
- **Async/Await Support**: Modern asynchronous programming patterns
- **Memory Safety**: Smart pointer usage and RAII principles

---

## Modern Chromium Architecture Integration (v134+)

Chromium's delegate pattern has evolved to support the browser's sophisticated multi-process, service-oriented architecture:

### Service Manager Integration
```cpp
// Modern service-aware delegate pattern
class ServiceAwareDelegate {
 public:
  virtual ~ServiceAwareDelegate() = default;
  
  // Capability-based access to services
  virtual void OnServiceConnected(
      mojo::PendingReceiver<mojom::SomeService> receiver) {}
  
  // Handle service disconnection gracefully
  virtual void OnServiceDisconnected() {}
  
  // Modern async patterns with callbacks
  virtual void ProcessRequestAsync(
      mojom::RequestPtr request,
      base::OnceCallback<void(mojom::ResponsePtr)> callback) = 0;
};
```

### Cross-Process Delegate Communication
Modern delegates can operate across process boundaries using Mojo interfaces:

```cpp
// Mojo-based delegate for cross-process communication
class CrossProcessDelegate : public mojom::ProcessDelegate {
 public:
  // Mojo interface implementation
  void HandleCrossProcessRequest(
      mojom::CrossProcessRequestPtr request,
      HandleCrossProcessRequestCallback callback) override {
    
    // Process request with modern async patterns
    ProcessRequestInBackground(
        std::move(request),
        base::BindOnce(&CrossProcessDelegate::OnRequestProcessed,
                       weak_ptr_factory_.GetWeakPtr(),
                       std::move(callback)));
  }

 private:
  void OnRequestProcessed(
      HandleCrossProcessRequestCallback callback,
      mojom::CrossProcessResponsePtr response) {
    std::move(callback).Run(std::move(response));
  }

  base::WeakPtrFactory<CrossProcessDelegate> weak_ptr_factory_{this};
};
```

---

## Advanced Download Manager Example (v134+)

The modern Download Manager showcases sophisticated delegate patterns with enhanced security, performance, and integration:

### Enhanced Download Manager Delegate
```cpp
// Modern download manager delegate with comprehensive capabilities
class DownloadManagerDelegate {
 public:
  virtual ~DownloadManagerDelegate() = default;

  // Security-enhanced path selection with sandbox integration
  virtual base::FilePath DetermineDownloadTarget(
      const GURL& url,
      const std::string& suggested_filename,
      const std::string& mime_type,
      const std::optional<std::string>& content_disposition,
      DownloadSecurity::ThreatLevel threat_level) = 0;

  // Modern async validation with comprehensive security checks
  virtual void ValidateDownloadAsync(
      const base::FilePath& path,
      const DownloadMetadata& metadata,
      base::OnceCallback<void(DownloadValidationResult)> callback) = 0;

  // Enhanced progress tracking with performance metrics
  virtual void OnDownloadProgress(
      const DownloadProgressInfo& progress,
      const PerformanceMetrics& metrics) {}

  // Integration with modern privacy controls
  virtual bool ShouldBlockDownload(
      const DownloadSecurityInfo& security_info,
      const PrivacySettings& privacy_settings) = 0;

  // Support for modern download features
  virtual void HandleParallelDownload(
      const ParallelDownloadConfig& config) {}
  
  // Integration with cloud services and sync
  virtual void OnDownloadSyncRequest(
      const DownloadSyncInfo& sync_info) {}
};
```

### Production Implementation
```cpp
// Production-ready delegate with modern security and performance
class ProductionDownloadDelegate : public DownloadManagerDelegate {
 public:
  explicit ProductionDownloadDelegate(
      Profile* profile,
      scoped_refptr<SafeBrowsingService> safe_browsing_service,
      std::unique_ptr<QuarantineService> quarantine_service)
      : profile_(profile),
        safe_browsing_service_(std::move(safe_browsing_service)),
        quarantine_service_(std::move(quarantine_service)) {}

  base::FilePath DetermineDownloadTarget(
      const GURL& url,
      const std::string& suggested_filename,
      const std::string& mime_type,
      const std::optional<std::string>& content_disposition,
      DownloadSecurity::ThreatLevel threat_level) override {
    
    // Modern path selection with security validation
    auto sanitized_filename = SanitizeFilename(suggested_filename);
    auto download_path = profile_->GetDownloadPath();
    
    // Apply threat-level specific restrictions
    if (threat_level >= DownloadSecurity::ThreatLevel::DANGEROUS) {
      return quarantine_service_->GetQuarantinePath(sanitized_filename);
    }
    
    return download_path.Append(sanitized_filename);
  }

  void ValidateDownloadAsync(
      const base::FilePath& path,
      const DownloadMetadata& metadata,
      base::OnceCallback<void(DownloadValidationResult)> callback) override {
    
    // Modern async validation chain
    safe_browsing_service_->CheckDownloadAsync(
        path, metadata,
        base::BindOnce(&ProductionDownloadDelegate::OnSafeBrowsingCheck,
                       weak_ptr_factory_.GetWeakPtr(),
                       path, std::move(callback)));
  }

 private:
  void OnSafeBrowsingCheck(
      const base::FilePath& path,
      base::OnceCallback<void(DownloadValidationResult)> callback,
      SafeBrowsingResult result) {
    
    if (result.is_safe()) {
      // Proceed with additional validation
      quarantine_service_->ScanFileAsync(
          path,
          base::BindOnce(&ProductionDownloadDelegate::OnQuarantineScan,
                         weak_ptr_factory_.GetWeakPtr(),
                         std::move(callback)));
    } else {
      std::move(callback).Run(
          DownloadValidationResult::CreateBlocked(result.threat_type()));
    }
  }

  void OnQuarantineScan(
      base::OnceCallback<void(DownloadValidationResult)> callback,
      QuarantineResult result) {
    std::move(callback).Run(
        result.is_clean() 
            ? DownloadValidationResult::CreateAllowed()
            : DownloadValidationResult::CreateQuarantined());
  }

  raw_ptr<Profile> profile_;
  scoped_refptr<SafeBrowsingService> safe_browsing_service_;
  std::unique_ptr<QuarantineService> quarantine_service_;
  base::WeakPtrFactory<ProductionDownloadDelegate> weak_ptr_factory_{this};
};
```

### Modern UML Architecture
```text
┌─────────────────────┐    delegates to    ┌──────────────────────────┐
│   DownloadManager   │ ──────────────────► │  DownloadManagerDelegate │
│                     │                     │                          │
│ + StartDownload()   │                     │ + DetermineDownloadTarget│
│ + PauseDownload()   │                     │ + ValidateDownloadAsync  │
│ + CancelDownload()  │                     │ + OnDownloadProgress     │
│ + SetDelegate()     │                     │ + ShouldBlockDownload    │
└─────────────────────┘                     └──────────────────────────┘
         │                                              △
         │                                              │
         ▼                                              │
┌─────────────────────┐                     ┌──────────────────────────┐
│   Mojo IPC Layer    │                     │ ProductionDownloadDelegate│
│                     │                     │                          │
│ + SendProgress()    │                     │ + Integration with:      │
│ + HandleErrors()    │                     │   - SafeBrowsingService  │
│ + CrossProcess()    │                     │   - QuarantineService    │
└─────────────────────┘                     │   - Privacy Controls     │
                                            │   - Cloud Sync           │
                                            └──────────────────────────┘
```

---

## Modern Testing Patterns (v134+)

Advanced testing delegates leverage modern C++ features and Chromium's testing infrastructure:

### Enhanced Test Delegate
```cpp
// Modern test delegate with comprehensive mocking capabilities
class MockDownloadManagerDelegate : public DownloadManagerDelegate {
 public:
  MOCK_METHOD(base::FilePath, DetermineDownloadTarget,
              (const GURL& url,
               const std::string& suggested_filename,
               const std::string& mime_type,
               const std::optional<std::string>& content_disposition,
               DownloadSecurity::ThreatLevel threat_level), (override));

  MOCK_METHOD(void, ValidateDownloadAsync,
              (const base::FilePath& path,
               const DownloadMetadata& metadata,
               base::OnceCallback<void(DownloadValidationResult)> callback),
              (override));

  MOCK_METHOD(bool, ShouldBlockDownload,
              (const DownloadSecurityInfo& security_info,
               const PrivacySettings& privacy_settings), (override));

  // Helper methods for test setup
  void SetupSuccessfulValidation() {
    ON_CALL(*this, ValidateDownloadAsync)
        .WillByDefault([](const base::FilePath&,
                         const DownloadMetadata&,
                         base::OnceCallback<void(DownloadValidationResult)> callback) {
          std::move(callback).Run(DownloadValidationResult::CreateAllowed());
        });
  }

  void SetupSecurityBlocking() {
    ON_CALL(*this, ShouldBlockDownload)
        .WillByDefault(Return(true));
  }
};
```

### Modern Test Implementation
```cpp
// Advanced test case with modern patterns
class DownloadManagerTest : public testing::Test {
 public:
  void SetUp() override {
    // Modern dependency injection with mock services
    auto mock_delegate = std::make_unique<MockDownloadManagerDelegate>();
    mock_delegate_ = mock_delegate.get();
    
    download_manager_ = std::make_unique<DownloadManager>(
        &profile_, std::move(mock_delegate));
  }

  void TearDown() override {
    // Modern RAII cleanup
    download_manager_.reset();
  }

 protected:
  base::test::TaskEnvironment task_environment_;
  TestingProfile profile_;
  std::unique_ptr<DownloadManager> download_manager_;
  raw_ptr<MockDownloadManagerDelegate> mock_delegate_;
};

TEST_F(DownloadManagerTest, HandlesSecureDownloadWithModernValidation) {
  // Setup modern expectations
  mock_delegate_->SetupSuccessfulValidation();
  
  EXPECT_CALL(*mock_delegate_, DetermineDownloadTarget)
      .WillOnce(Return(base::FilePath(FILE_PATH_LITERAL("/safe/downloads/file.pdf"))));
  
  EXPECT_CALL(*mock_delegate_, ShouldBlockDownload)
      .WillOnce(Return(false));

  // Execute with modern async patterns
  base::RunLoop run_loop;
  download_manager_->StartDownload(
      GURL("https://example.com/secure-file.pdf"),
      "secure-file.pdf",
      base::BindLambdaForTesting([&](DownloadResult result) {
        EXPECT_EQ(result.status(), DownloadStatus::SUCCESS);
        run_loop.Quit();
      }));
  
  run_loop.Run();
}
```

---

## Advanced Delegate Patterns in v134+

### Service-Oriented Delegates
Modern Chromium uses delegates extensively in its service architecture:

```cpp
// Network service delegate with modern capabilities
class NetworkServiceDelegate : public mojom::NetworkServiceClient {
 public:
  // Modern SSL certificate handling
  void OnCertificateRequested(
      const std::optional<base::UnguessableToken>& window_id,
      uint32_t process_id,
      uint32_t routing_id,
      const scoped_refptr<net::SSLCertRequestInfo>& cert_info,
      mojo::PendingRemote<mojom::ClientCertificateResponder> responder) override;

  // Advanced privacy controls
  void OnCanSendReportingReports(
      const std::vector<url::Origin>& origins,
      base::OnceCallback<void(const std::vector<url::Origin>&)> callback) override;

  // Modern cookie management with privacy sandbox
  void OnCookiesRead(
      const GURL& url,
      const GURL& site_for_cookies,
      const net::CookieAccessResultList& cookie_list,
      OnCookiesReadCallback callback) override;
};
```

### GPU Process Delegates
Advanced graphics delegates for the Viz compositor:

```cpp
// Modern GPU process delegate with Viz integration
class GpuProcessDelegate : public mojom::GpuHost {
 public:
  // Advanced GPU memory management
  void DidCreateContextSuccessfully() override;
  
  // Modern graphics diagnostics
  void DidCreateOffscreenContext(const GURL& url) override;
  
  // Enhanced GPU process monitoring
  void DidLoseContext(bool offscreen,
                     gpu::error::ContextLostReason reason,
                     const GURL& active_url) override;
  
  // Viz compositor integration
  void SetChildSurface(gpu::SurfaceHandle parent,
                      gpu::SurfaceHandle child) override;
};
```

---

## Modern Benefits & Best Practices (v134+)

### Enhanced Architectural Benefits
1. **Type Safety**: Modern C++ templates and concepts ensure compile-time correctness
2. **Memory Safety**: RAII and smart pointers prevent memory leaks and use-after-free bugs
3. **Async Programming**: Integration with Chromium's modern async patterns
4. **Service Integration**: Seamless integration with Chromium's microservice architecture
5. **Security**: Capability-based delegation respects process boundaries
6. **Performance**: Zero-cost abstractions and efficient IPC integration

### Modern Best Practices
```cpp
// Best practice: Modern delegate interface design
class ModernDelegate {
 public:
  virtual ~ModernDelegate() = default;

  // Use strong types instead of primitive parameters
  virtual void ProcessRequest(
      const TypedRequest& request,
      base::OnceCallback<void(TypedResponse)> callback) = 0;

  // Prefer span<> for array parameters
  virtual void ProcessBatch(
      base::span<const RequestItem> items) = 0;

  // Use std::optional for optional parameters
  virtual bool Configure(
      const Config& config,
      std::optional<SecurityLevel> security_level = std::nullopt) = 0;

  // Modern error handling with base::expected
  virtual base::expected<ProcessResult, ProcessError> TryProcess(
      const Request& request) = 0;
};
```

### Performance Considerations
- **Minimal Virtual Function Calls**: Use templates where appropriate
- **Efficient Memory Management**: Leverage move semantics and perfect forwarding
- **Cache-Friendly Design**: Consider memory layout and access patterns
- **IPC Optimization**: Minimize cross-process delegate calls

---

## Integration with Modern Chromium Features (v134+)

### Privacy Sandbox Integration
```cpp
class PrivacySandboxDelegate {
 public:
  // Topics API integration
  virtual void OnTopicsCalculated(
      const std::vector<Topic>& topics,
      const PrivacyBudget& budget) = 0;

  // FLEDGE auction support
  virtual void OnAuctionComplete(
      const AuctionResult& result,
      const std::vector<InterestGroup>& winning_groups) = 0;

  // Attribution reporting
  virtual void OnAttributionReportScheduled(
      const AttributionReport& report) = 0;
};
```

### WebGPU Integration
```cpp
class WebGPUDelegate {
 public:
  // Modern GPU resource management
  virtual void OnGPUResourceCreated(
      const WebGPUResource& resource,
      const SecurityContext& context) = 0;

  // Compute shader delegation
  virtual void OnComputeShaderExecution(
      const ComputeShaderInfo& shader_info,
      const ExecutionMetrics& metrics) = 0;
};
```

---

## Migration Guide: Legacy to Modern Delegates

### Legacy Pattern (Pre-v134)
```cpp
// Old-style delegate with raw pointers and synchronous methods
class LegacyDelegate {
 public:
  virtual bool Process(const char* data, int size) = 0;
  virtual void SetCallback(Callback* callback) = 0;  // Raw pointer!
};
```

### Modern Pattern (v134+)
```cpp
// Modern delegate with type safety and async patterns
class ModernDelegate {
 public:
  virtual ~ModernDelegate() = default;
  
  virtual void ProcessAsync(
      base::span<const uint8_t> data,
      base::OnceCallback<void(ProcessResult)> callback) = 0;
      
  virtual base::expected<void, ProcessError> ProcessSync(
      base::span<const uint8_t> data) = 0;
};
```

---

## Conclusion

The Delegate Pattern in Chromium v134+ represents a sophisticated evolution of traditional design patterns, incorporating modern C++ features, type safety, and deep integration with the browser's advanced architecture. This pattern enables:

- **Scalable Architecture**: Support for Chromium's massive, service-oriented codebase
- **Security**: Respect for process boundaries and capability-based access
- **Performance**: Efficient implementations with modern C++ optimizations
- **Maintainability**: Clear separation of concerns and testable interfaces
- **Extensibility**: Easy customization for different browser configurations

By mastering modern delegate patterns, developers can effectively contribute to and extend Chromium's sophisticated browser architecture while maintaining the high standards of security, performance, and reliability that modern web browsers demand.

**Key Takeaways**:
- Modern delegates integrate deeply with Chromium's service architecture
- Type safety and memory safety are paramount in v134+ implementations
- Async patterns are preferred for non-blocking operations
- Security considerations are built into the delegate design
- Testing is enhanced through modern mocking and dependency injection

**Next Steps**:
- Explore [Mojo IPC Integration](../ipc-internals.md) for cross-process delegate communication
- Study [Service Architecture](../browser-components.md) for advanced delegate usage patterns
- Review [Security Model](../../security/security-model.md) for security-aware delegate design
