# Factory Pattern in Modern Chromium (v134+)

The Factory pattern is fundamental to Chromium's architecture, providing flexible object creation that abstracts implementation details and enables platform-specific, feature-gated, and service-oriented instantiation. In modern Chromium v134+, factory patterns have evolved to support Mojo services, modern C++ practices, and sophisticated dependency injection.

---

## 1. Modern Factory Pattern Evolution (v134+)

### Core Principles
- **Abstraction**: Hide complex instantiation logic behind clean interfaces
- **Flexibility**: Support multiple implementations based on runtime conditions
- **Testability**: Enable easy mocking and dependency injection for tests
- **Service Integration**: Seamless integration with Mojo service architecture
- **Memory Safety**: Modern C++ RAII and smart pointer practices

### Contemporary Applications
- **Service Factories**: Creating Mojo service implementations
- **Platform Abstraction**: OS-specific component instantiation
- **Feature Flags**: Conditional feature implementation based on experiments
- **Renderer Components**: Process-safe object creation with IPC awareness
- **Privacy Sandbox**: Secure component instantiation with capability restrictions

---

## 2. Factory Pattern Types in Chromium v134+

### 2.1. Static Factory Methods

Modern static factories with enhanced type safety and error handling:

```cpp
// Modern factory with base::expected for error handling
class NetworkContextFactory {
 public:
  static base::expected<std::unique_ptr<NetworkContext>, NetworkError>
  CreateForProfile(Profile* profile, 
                   const NetworkContextParams& params) {
    if (!profile || !profile->IsValidForNetworking()) {
      return base::unexpected(NetworkError::kInvalidProfile);
    }
    
    auto context = std::make_unique<NetworkContextImpl>(profile);
    if (auto result = context->Initialize(params); !result.has_value()) {
      return base::unexpected(result.error());
    }
    
    return context;
  }
  
  // Factory method with modern C++20 concepts
  template<typename ContextType>
    requires std::derived_from<ContextType, NetworkContext>
  static std::unique_ptr<ContextType> CreateCustomContext(
      const CustomNetworkParams& params) {
    return std::make_unique<ContextType>(params);
  }
};
```

### 2.2. Mojo Service Factories

Modern service factories integrated with Mojo IPC and capability-based security:

```cpp
// Service factory with Mojo integration
class DownloadServiceFactory {
 public:
  static void Create(
      Profile* profile,
      mojo::PendingReceiver<download::mojom::DownloadService> receiver) {
    // Validate profile and permissions
    if (!profile || !profile->HasDownloadPermission()) {
      receiver.ResetWithReason(1, "Insufficient permissions");
      return;
    }
    
    // Create service with proper context
    auto service = std::make_unique<DownloadServiceImpl>(
        profile->GetPath(),
        profile->GetPrefs(),
        profile->GetDownloadManager());
    
    // Bind with automatic cleanup on disconnect
    mojo::MakeSelfOwnedReceiver(std::move(service), std::move(receiver));
  }
  
  // Factory for testing with dependency injection
  static std::unique_ptr<download::mojom::DownloadService> CreateForTesting(
      std::unique_ptr<DownloadManager> manager,
      std::unique_ptr<PrefService> prefs) {
    return std::make_unique<MockDownloadService>(
        std::move(manager), std::move(prefs));
  }
};
```

### 2.3. Abstract Factory Pattern

Modern abstract factories for platform-specific and feature-specific implementations:

```cpp
// Abstract factory for UI components with modern C++
class UIComponentFactory {
 public:
  virtual ~UIComponentFactory() = default;
  
  // Pure virtual factory methods
  virtual std::unique_ptr<TabStripModel> CreateTabStripModel(
      Browser* browser) = 0;
  virtual std::unique_ptr<LocationBar> CreateLocationBar(
      Browser* browser) = 0;
  virtual std::unique_ptr<BookmarkBar> CreateBookmarkBar(
      Browser* browser) = 0;
  
  // Static factory to get platform-specific implementation
  static std::unique_ptr<UIComponentFactory> Create();
};

// Platform-specific implementation
class WindowsUIComponentFactory : public UIComponentFactory {
 public:
  std::unique_ptr<TabStripModel> CreateTabStripModel(
      Browser* browser) override {
    return std::make_unique<WindowsTabStripModel>(browser);
  }
  
  std::unique_ptr<LocationBar> CreateLocationBar(
      Browser* browser) override {
    return std::make_unique<WindowsLocationBar>(browser);
  }
  
  std::unique_ptr<BookmarkBar> CreateBookmarkBar(
      Browser* browser) override {
    return std::make_unique<WindowsBookmarkBar>(browser);
  }
};
```

### 2.4. Builder-Style Factories

Modern fluent interfaces for complex object construction:

```cpp
// Builder-style factory for complex configuration
class RenderFrameHostFactory {
 public:
  class Builder {
   public:
    Builder& SetSiteInstance(scoped_refptr<SiteInstance> site_instance) {
      site_instance_ = std::move(site_instance);
      return *this;
    }
    
    Builder& SetRenderViewHost(RenderViewHost* render_view_host) {
      render_view_host_ = render_view_host;
      return *this;
    }
    
    Builder& SetFrameTreeNode(FrameTreeNode* frame_tree_node) {
      frame_tree_node_ = frame_tree_node;
      return *this;
    }
    
    Builder& EnableFeatures(const std::vector<std::string>& features) {
      enabled_features_.insert(enabled_features_.end(), 
                              features.begin(), features.end());
      return *this;
    }
    
    // Build with validation and error handling
    base::expected<std::unique_ptr<RenderFrameHost>, FrameError> Build() {
      if (!site_instance_ || !render_view_host_ || !frame_tree_node_) {
        return base::unexpected(FrameError::kMissingRequiredComponents);
      }
      
      auto frame_host = std::make_unique<RenderFrameHostImpl>(
          site_instance_, render_view_host_, frame_tree_node_);
      
      // Apply feature configuration
      for (const auto& feature : enabled_features_) {
        frame_host->EnableFeature(feature);
      }
      
      return frame_host;
    }
    
   private:
    scoped_refptr<SiteInstance> site_instance_;
    RenderViewHost* render_view_host_ = nullptr;
    FrameTreeNode* frame_tree_node_ = nullptr;
    std::vector<std::string> enabled_features_;
  };
  
  static Builder CreateBuilder() { return Builder{}; }
};
```

---

## 3. Key Factory Implementations in v134+

### 3.1. BrowserContextKeyedServiceFactory

Modern service factory with enhanced lifecycle management:

```cpp
class DownloadCoreServiceFactory : public BrowserContextKeyedServiceFactory {
 public:
  static DownloadCoreService* GetForBrowserContext(BrowserContext* context) {
    return static_cast<DownloadCoreService*>(
        GetInstance()->GetServiceForBrowserContext(context, true));
  }
  
  static DownloadCoreServiceFactory* GetInstance() {
    static base::NoDestructor<DownloadCoreServiceFactory> instance;
    return instance.get();
  }
  
 private:
  friend base::NoDestructor<DownloadCoreServiceFactory>;
  
  DownloadCoreServiceFactory()
      : BrowserContextKeyedServiceFactory(
            "DownloadCoreService",
            BrowserContextDependencyManager::GetInstance()) {
    // Declare dependencies
    DependsOn(SimpleDownloadManagerCoordinatorFactory::GetInstance());
    DependsOn(HistoryServiceFactory::GetInstance());
  }
  
  KeyedService* BuildServiceInstanceFor(
      content::BrowserContext* context) const override {
    if (!base::FeatureList::IsEnabled(features::kDownloadService)) {
      return nullptr;
    }
    
    auto* profile = Profile::FromBrowserContext(context);
    return new DownloadCoreServiceImpl(
        profile, 
        std::make_unique<DownloadDriverImpl>(),
        std::make_unique<TaskSchedulerImpl>());
  }
  
  bool ServiceIsCreatedWithBrowserContext() const override { return true; }
  bool ServiceIsNULLWhileTesting() const override { return false; }
};
```

### 3.2. URLLoaderFactory Pattern

Modern network factory with enhanced security and capability delegation:

```cpp
class NetworkServiceURLLoaderFactory {
 public:
  // Create factory with proper security context
  static mojo::PendingRemote<network::mojom::URLLoaderFactory>
  CreateForFrame(RenderFrameHost* frame_host,
                 const url::Origin& request_initiator) {
    if (!frame_host || !frame_host->IsRenderFrameLive()) {
      return mojo::PendingRemote<network::mojom::URLLoaderFactory>();
    }
    
    // Create with appropriate security restrictions
    auto factory_params = network::mojom::URLLoaderFactoryParams::New();
    factory_params->process_id = frame_host->GetProcess()->GetID();
    factory_params->request_initiator_origin_lock = request_initiator;
    factory_params->is_corb_enabled = true;
    factory_params->is_trusted = false;
    
    // Apply Content Security Policy
    if (auto* policy = frame_host->GetContentSecurityPolicy()) {
      factory_params->client_security_state = 
          policy->CreateClientSecurityState();
    }
    
    mojo::PendingRemote<network::mojom::URLLoaderFactory> factory_remote;
    frame_host->GetStoragePartition()
        ->GetNetworkContext()
        ->CreateURLLoaderFactory(
            factory_remote.InitWithNewPipeAndPassReceiver(),
            std::move(factory_params));
    
    return factory_remote;
  }
  
  // Factory for service workers with restricted capabilities
  static mojo::PendingRemote<network::mojom::URLLoaderFactory>
  CreateForServiceWorker(
      ServiceWorkerVersion* version,
      const blink::StorageKey& storage_key) {
    
    auto factory_params = network::mojom::URLLoaderFactoryParams::New();
    factory_params->process_id = version->embedded_worker()->process_id();
    factory_params->request_initiator_origin_lock = storage_key.origin();
    factory_params->is_trusted = false;
    factory_params->automatically_assign_isolation_info = true;
    
    // Restrict to same-origin and specific schemes
    factory_params->unsafe_non_webby_requestor = false;
    
    mojo::PendingRemote<network::mojom::URLLoaderFactory> factory_remote;
    version->GetStoragePartition()
        ->GetNetworkContext()
        ->CreateURLLoaderFactory(
            factory_remote.InitWithNewPipeAndPassReceiver(),
            std::move(factory_params));
    
    return factory_remote;
  }
};
```

### 3.3. GPU Service Factory

Modern graphics factory with advanced GPU capabilities:

```cpp
class GpuServiceFactory {
 public:
  static std::unique_ptr<viz::GpuServiceImpl> Create(
      const gpu::GpuPreferences& gpu_preferences,
      base::WeakPtr<viz::ImageTransportSurfaceDelegate> delegate) {
    
    // Initialize GPU feature info
    auto gpu_feature_info = gpu::GetGpuFeatureInfo(
        gpu::GpuDriverBugWorkarounds(), gpu_preferences);
    
    // Create with WebGPU support if available
    auto gpu_service = std::make_unique<viz::GpuServiceImpl>(
        gpu_feature_info,
        gpu_preferences,
        std::move(delegate),
        /*enable_webgpu=*/base::FeatureList::IsEnabled(features::kWebGPU));
    
    // Configure advanced features
    if (gpu_feature_info.IsWebGPUSupported()) {
      gpu_service->EnableWebGPUService();
    }
    
    if (base::FeatureList::IsEnabled(features::kVaapiVideoDecoding)) {
      gpu_service->EnableHardwareVideoDecoding();
    }
    
    return gpu_service;
  }
  
  // Factory for testing with mock GPU capabilities
  static std::unique_ptr<viz::GpuServiceImpl> CreateForTesting(
      std::unique_ptr<gpu::GpuMemoryBufferFactory> memory_buffer_factory,
      std::unique_ptr<gpu::ImageFactory> image_factory) {
    
    auto gpu_service = std::make_unique<MockGpuServiceImpl>();
    gpu_service->SetMemoryBufferFactory(std::move(memory_buffer_factory));
    gpu_service->SetImageFactory(std::move(image_factory));
    
    return gpu_service;
  }
};
```

---

## 4. Modern C++ Factory Techniques (v134+)

### 4.1. Template-Based Factories

Using concepts and template metaprogramming for type-safe factories:

```cpp
// Concept for factory-creatable types
template<typename T>
concept FactoryCreatable = requires(T t) {
  typename T::InitParams;
  { T::Create(std::declval<typename T::InitParams>()) } 
    -> std::convertible_to<std::unique_ptr<T>>;
};

// Generic factory with compile-time validation
template<FactoryCreatable T>
class GenericFactory {
 public:
  template<typename... Args>
  static base::expected<std::unique_ptr<T>, FactoryError> 
  Create(Args&&... args) {
    try {
      auto params = typename T::InitParams{std::forward<Args>(args)...};
      if (auto result = ValidateParams(params); !result.has_value()) {
        return base::unexpected(result.error());
      }
      
      return T::Create(std::move(params));
    } catch (const std::exception& e) {
      return base::unexpected(FactoryError::kCreationFailed);
    }
  }
  
 private:
  static base::expected<void, FactoryError> ValidateParams(
      const typename T::InitParams& params) {
    // Generic validation logic
    if constexpr (requires { params.Validate(); }) {
      return params.Validate() ? base::expected<void, FactoryError>{}
                               : base::unexpected(FactoryError::kInvalidParams);
    }
    return {};
  }
};
```

### 4.2. Registry-Based Factories

Modern factory registration with type safety:

```cpp
// Factory registry for extensible component creation
template<typename BaseType>
class FactoryRegistry {
 public:
  using FactoryFunction = std::function<std::unique_ptr<BaseType>()>;
  using ConditionalFactory = std::function<std::unique_ptr<BaseType>(
      const FactoryContext&)>;
  
  // Register factory with type information
  template<typename DerivedType>
    requires std::derived_from<DerivedType, BaseType>
  static void RegisterFactory(const std::string& name,
                              ConditionalFactory factory) {
    GetRegistry()[name] = FactoryEntry{
      .factory = std::move(factory),
      .type_info = typeid(DerivedType),
      .creation_flags = DerivedType::GetCreationFlags()
    };
  }
  
  // Create with automatic selection based on context
  static base::expected<std::unique_ptr<BaseType>, FactoryError>
  Create(const std::string& name, const FactoryContext& context) {
    auto& registry = GetRegistry();
    auto it = registry.find(name);
    
    if (it == registry.end()) {
      return base::unexpected(FactoryError::kUnknownType);
    }
    
    const auto& entry = it->second;
    if (!IsCompatibleWithContext(entry, context)) {
      return base::unexpected(FactoryError::kIncompatibleContext);
    }
    
    try {
      auto instance = entry.factory(context);
      if (!instance) {
        return base::unexpected(FactoryError::kCreationFailed);
      }
      
      return instance;
    } catch (const std::exception& e) {
      LOG(ERROR) << "Factory creation failed: " << e.what();
      return base::unexpected(FactoryError::kCreationFailed);
    }
  }
  
 private:
  struct FactoryEntry {
    ConditionalFactory factory;
    std::type_info type_info;
    uint32_t creation_flags;
  };
  
  static std::unordered_map<std::string, FactoryEntry>& GetRegistry() {
    static base::NoDestructor<std::unordered_map<std::string, FactoryEntry>> 
        registry;
    return *registry;
  }
  
  static bool IsCompatibleWithContext(const FactoryEntry& entry,
                                      const FactoryContext& context) {
    return (entry.creation_flags & context.GetRequiredFlags()) == 
           context.GetRequiredFlags();
  }
};
```

### 4.3. Async Factory Pattern

Modern async factories with coroutine support:

```cpp
// Async factory for heavy initialization
class AsyncResourceFactory {
 public:
  // Coroutine-based async factory
  static base::expected<std::unique_ptr<Resource>, ResourceError>
  CreateAsync(const ResourceParams& params) {
    // Validate parameters synchronously
    if (auto validation = ValidateParams(params); !validation.has_value()) {
      return base::unexpected(validation.error());
    }
    
    // Create resource with async initialization
    auto resource = std::make_unique<ResourceImpl>(params);
    
    // Schedule async initialization
    auto init_result = co_await resource->InitializeAsync();
    if (!init_result.has_value()) {
      return base::unexpected(init_result.error());
    }
    
    return resource;
  }
  
  // Traditional callback-based async factory
  static void CreateAsync(
      const ResourceParams& params,
      base::OnceCallback<void(base::expected<std::unique_ptr<Resource>, 
                                           ResourceError>)> callback) {
    
    base::ThreadPool::PostTaskAndReplyWithResult(
        FROM_HERE,
        {base::TaskPriority::USER_BLOCKING, base::MayBlock()},
        base::BindOnce(&DoAsyncCreation, params),
        std::move(callback));
  }
  
 private:
  static base::expected<std::unique_ptr<Resource>, ResourceError>
  DoAsyncCreation(const ResourceParams& params) {
    // Heavy initialization work on background thread
    auto resource = std::make_unique<ResourceImpl>(params);
    
    if (auto result = resource->LoadData(); !result.has_value()) {
      return base::unexpected(result.error());
    }
    
    if (auto result = resource->InitializeConnections(); !result.has_value()) {
      return base::unexpected(result.error());
    }
    
    return resource;
  }
};
```

---

## 5. Testing Factory Patterns (v134+)

### 5.1. Test Factory Implementation

Modern test factories with comprehensive mocking:

```cpp
class TestDownloadServiceFactory {
 public:
  // Create mock service for unit tests
  static std::unique_ptr<MockDownloadService> CreateMockService() {
    auto mock_service = std::make_unique<MockDownloadService>();
    
    // Set up default expectations
    EXPECT_CALL(*mock_service, StartDownload(testing::_))
        .WillRepeatedly(testing::Return(DownloadResult::kSuccess));
    
    EXPECT_CALL(*mock_service, GetDownloadState(testing::_))
        .WillRepeatedly(testing::Return(DownloadState::kComplete));
    
    return mock_service;
  }
  
  // Create fake service for integration tests
  static std::unique_ptr<FakeDownloadService> CreateFakeService(
      const FakeServiceConfig& config) {
    auto fake_service = std::make_unique<FakeDownloadService>();
    
    // Configure behavior based on test needs
    fake_service->SetSimulatedBandwidth(config.bandwidth);
    fake_service->SetFailureRate(config.failure_rate);
    fake_service->SetLatencyRange(config.min_latency, config.max_latency);
    
    return fake_service;
  }
  
  // Factory for parameterized tests
  template<typename ServiceType>
    requires std::derived_from<ServiceType, DownloadService>
  static std::unique_ptr<ServiceType> CreateParameterizedService(
      const TestParameters& params) {
    auto service = std::make_unique<ServiceType>();
    
    // Apply test-specific configuration
    for (const auto& [key, value] : params.GetConfigMap()) {
      service->SetConfiguration(key, value);
    }
    
    return service;
  }
};
```

### 5.2. Google Mock Integration

Modern factory testing with enhanced mock validation:

```cpp
// Test fixture with factory-created mocks
class DownloadServiceTest : public testing::Test {
 protected:
  void SetUp() override {
    // Create mock dependencies
    mock_download_manager_ = std::make_unique<MockDownloadManager>();
    mock_file_system_ = std::make_unique<MockFileSystem>();
    mock_network_service_ = std::make_unique<MockNetworkService>();
    
    // Configure factory to use mocks
    DownloadServiceFactory::SetDownloadManagerForTesting(
        mock_download_manager_.get());
    DownloadServiceFactory::SetFileSystemForTesting(
        mock_file_system_.get());
    DownloadServiceFactory::SetNetworkServiceForTesting(
        mock_network_service_.get());
    
    // Create service under test
    service_ = DownloadServiceFactory::CreateForTesting(
        TestProfile::CreateProfile());
  }
  
  void TearDown() override {
    // Clean up factory state
    DownloadServiceFactory::ResetForTesting();
  }
  
  // Test helper methods
  void ExpectSuccessfulDownload() {
    EXPECT_CALL(*mock_download_manager_, StartDownload(testing::_))
        .WillOnce(testing::Return(DownloadId{123}));
    
    EXPECT_CALL(*mock_file_system_, CreateTempFile(testing::_))
        .WillOnce(testing::Return(base::FilePath("/tmp/download_123")));
    
    EXPECT_CALL(*mock_network_service_, CreateURLLoader(testing::_))
        .WillOnce(testing::Return(std::make_unique<MockURLLoader>()));
  }
  
 private:
  std::unique_ptr<MockDownloadManager> mock_download_manager_;
  std::unique_ptr<MockFileSystem> mock_file_system_;
  std::unique_ptr<MockNetworkService> mock_network_service_;
  std::unique_ptr<DownloadService> service_;
};

TEST_F(DownloadServiceTest, FactoryCreatesValidService) {
  ASSERT_TRUE(service_);
  EXPECT_TRUE(service_->IsInitialized());
  EXPECT_FALSE(service_->HasActiveDownloads());
}
```

---

## 6. Advanced Factory Patterns (v134+)

### 6.1. Dependency Injection Factory

Modern dependency injection with automatic resolution:

```cpp
// Dependency injection container
class DIContainer {
 public:
  template<typename Interface, typename Implementation>
    requires std::derived_from<Implementation, Interface>
  void RegisterSingleton() {
    auto factory = []() -> std::unique_ptr<Interface> {
      return std::make_unique<Implementation>();
    };
    
    singletons_[typeid(Interface)] = SingletonEntry{
      .factory = std::move(factory),
      .instance = nullptr
    };
  }
  
  template<typename Interface, typename Implementation>
    requires std::derived_from<Implementation, Interface>
  void RegisterTransient() {
    auto factory = []() -> std::unique_ptr<Interface> {
      return std::make_unique<Implementation>();
    };
    
    transients_[typeid(Interface)] = std::move(factory);
  }
  
  template<typename T>
  std::unique_ptr<T> Resolve() {
    const std::type_info& type = typeid(T);
    
    // Check for singleton
    if (auto it = singletons_.find(type); it != singletons_.end()) {
      auto& entry = it->second;
      if (!entry.instance) {
        entry.instance = entry.factory();
      }
      // Return a copy for singletons (or use weak_ptr pattern)
      return std::unique_ptr<T>(static_cast<T*>(entry.instance.get()));
    }
    
    // Check for transient
    if (auto it = transients_.find(type); it != transients_.end()) {
      return std::unique_ptr<T>(static_cast<T*>(it->second().release()));
    }
    
    return nullptr;
  }
  
 private:
  struct SingletonEntry {
    std::function<std::unique_ptr<void>()> factory;
    std::unique_ptr<void> instance;
  };
  
  std::unordered_map<std::type_index, SingletonEntry> singletons_;
  std::unordered_map<std::type_index, 
                     std::function<std::unique_ptr<void>()>> transients_;
};
```

### 6.2. Plugin Factory System

Modern plugin architecture with dynamic loading:

```cpp
// Plugin factory for extensible components
class PluginFactory {
 public:
  struct PluginInfo {
    std::string name;
    std::string version;
    std::vector<std::string> dependencies;
    std::function<std::unique_ptr<Plugin>()> creator;
  };
  
  static void RegisterPlugin(const PluginInfo& info) {
    auto& registry = GetRegistry();
    
    // Validate dependencies
    for (const auto& dep : info.dependencies) {
      if (registry.find(dep) == registry.end()) {
        LOG(WARNING) << "Plugin " << info.name 
                     << " depends on unregistered plugin: " << dep;
      }
    }
    
    registry[info.name] = info;
  }
  
  static base::expected<std::unique_ptr<Plugin>, PluginError>
  CreatePlugin(const std::string& name) {
    auto& registry = GetRegistry();
    auto it = registry.find(name);
    
    if (it == registry.end()) {
      return base::unexpected(PluginError::kPluginNotFound);
    }
    
    const auto& info = it->second;
    
    // Check and load dependencies
    for (const auto& dep : info.dependencies) {
      if (auto result = EnsurePluginLoaded(dep); !result.has_value()) {
        return base::unexpected(result.error());
      }
    }
    
    try {
      auto plugin = info.creator();
      if (!plugin) {
        return base::unexpected(PluginError::kCreationFailed);
      }
      
      // Initialize plugin
      if (auto result = plugin->Initialize(); !result.has_value()) {
        return base::unexpected(PluginError::kInitializationFailed);
      }
      
      return plugin;
    } catch (const std::exception& e) {
      LOG(ERROR) << "Plugin creation failed: " << e.what();
      return base::unexpected(PluginError::kCreationFailed);
    }
  }
  
 private:
  static std::unordered_map<std::string, PluginInfo>& GetRegistry() {
    static base::NoDestructor<std::unordered_map<std::string, PluginInfo>> 
        registry;
    return *registry;
  }
  
  static std::unordered_set<std::string>& GetLoadedPlugins() {
    static base::NoDestructor<std::unordered_set<std::string>> loaded;
    return *loaded;
  }
  
  static base::expected<void, PluginError> EnsurePluginLoaded(
      const std::string& name) {
    auto& loaded = GetLoadedPlugins();
    if (loaded.find(name) != loaded.end()) {
      return {};  // Already loaded
    }
    
    auto plugin_result = CreatePlugin(name);
    if (!plugin_result.has_value()) {
      return base::unexpected(plugin_result.error());
    }
    
    loaded.insert(name);
    return {};
  }
};
```

---

## 7. Factory Pattern Best Practices (v134+)

### 7.1. Error Handling and Validation

```cpp
// Modern error handling in factories
class SecureComponentFactory {
 public:
  static base::expected<std::unique_ptr<SecureComponent>, SecurityError>
  CreateSecureComponent(const SecurityContext& context) {
    // Pre-creation validation
    if (auto validation = ValidateSecurityContext(context); 
        !validation.has_value()) {
      return base::unexpected(validation.error());
    }
    
    // Capability check
    if (!context.HasRequiredCapabilities()) {
      return base::unexpected(SecurityError::kInsufficientCapabilities);
    }
    
    // Create with security restrictions
    auto component = std::make_unique<SecureComponentImpl>(context);
    
    // Post-creation verification
    if (auto verification = VerifyComponent(*component); 
        !verification.has_value()) {
      return base::unexpected(verification.error());
    }
    
    // Set up security monitoring
    component->EnableSecurityMonitoring();
    
    return component;
  }
  
 private:
  static base::expected<void, SecurityError> ValidateSecurityContext(
      const SecurityContext& context) {
    if (!context.IsValid()) {
      return base::unexpected(SecurityError::kInvalidContext);
    }
    
    if (context.GetTrustLevel() < SecurityLevel::kMinimumRequired) {
      return base::unexpected(SecurityError::kInsufficientTrustLevel);
    }
    
    return {};
  }
  
  static base::expected<void, SecurityError> VerifyComponent(
      const SecureComponent& component) {
    if (!component.IsProperlySandboxed()) {
      return base::unexpected(SecurityError::kSandboxingFailed);
    }
    
    if (!component.HasValidSignature()) {
      return base::unexpected(SecurityError::kInvalidSignature);
    }
    
    return {};
  }
};
```

### 7.2. Performance Optimization

```cpp
// High-performance factory with object pooling
template<typename T>
class PooledFactory {
 public:
  // Get object from pool or create new one
  static std::unique_ptr<T> Acquire() {
    auto& pool = GetPool();
    
    if (!pool.empty()) {
      auto obj = std::move(pool.back());
      pool.pop_back();
      
      // Reset object state
      obj->Reset();
      return obj;
    }
    
    // Create new object if pool is empty
    return std::make_unique<T>();
  }
  
  // Return object to pool for reuse
  static void Release(std::unique_ptr<T> obj) {
    if (!obj) return;
    
    auto& pool = GetPool();
    
    // Limit pool size to prevent memory bloat
    constexpr size_t kMaxPoolSize = 64;
    if (pool.size() < kMaxPoolSize) {
      pool.push_back(std::move(obj));
    }
    // Object is automatically destroyed if pool is full
  }
  
  // Pre-warm pool with objects
  static void PrewarmPool(size_t count) {
    auto& pool = GetPool();
    pool.reserve(count);
    
    for (size_t i = 0; i < count; ++i) {
      pool.push_back(std::make_unique<T>());
    }
  }
  
 private:
  static std::vector<std::unique_ptr<T>>& GetPool() {
    static base::NoDestructor<std::vector<std::unique_ptr<T>>> pool;
    return *pool;
  }
};
```

---

## 8. Real-World Examples from Chromium v134+

### 8.1. Content Settings Factory

```cpp
// Simplified version of HostContentSettingsMapFactory
class HostContentSettingsMapFactory : public RefcountedBrowserContextKeyedServiceFactory {
 public:
  static HostContentSettingsMap* GetForProfile(Profile* profile) {
    return static_cast<HostContentSettingsMap*>(
        GetInstance()->GetServiceForBrowserContext(profile, true).get());
  }
  
  static HostContentSettingsMapFactory* GetInstance() {
    static base::NoDestructor<HostContentSettingsMapFactory> instance;
    return instance.get();
  }
  
 private:
  HostContentSettingsMapFactory()
      : RefcountedBrowserContextKeyedServiceFactory(
            "HostContentSettingsMap",
            BrowserContextDependencyManager::GetInstance()) {
    DependsOn(PrefServiceSyncableFromProfile::GetInstance());
  }
  
  scoped_refptr<RefcountedKeyedService> BuildServiceInstanceFor(
      content::BrowserContext* context) const override {
    Profile* profile = Profile::FromBrowserContext(context);
    
    auto map = base::MakeRefCounted<HostContentSettingsMapImpl>(
        profile->GetPrefs(),
        profile->IsOffTheRecord(),
        profile->IsGuestSession(),
        profile->IsExtensionProfile());
    
    // Configure for modern privacy features
    if (base::FeatureList::IsEnabled(features::kPrivacySandboxSettings)) {
      map->EnablePrivacySandboxSupport();
    }
    
    return map;
  }
};
```

### 8.2. Media Device Factory

```cpp
// Factory for media device access with permissions
class MediaDeviceFactory {
 public:
  static void CreateMediaDeviceService(
      RenderFrameHost* frame_host,
      mojo::PendingReceiver<blink::mojom::MediaDevicesDispatcherHost> receiver) {
    
    if (!frame_host || !frame_host->IsRenderFrameLive()) {
      receiver.ResetWithReason(1, "Invalid frame");
      return;
    }
    
    // Check permissions
    auto* permission_controller = 
        frame_host->GetBrowserContext()->GetPermissionController();
    
    auto mic_status = permission_controller->GetPermissionStatus(
        ContentSettingsType::MEDIASTREAM_MIC,
        frame_host->GetLastCommittedOrigin(),
        frame_host->GetLastCommittedOrigin());
    
    auto camera_status = permission_controller->GetPermissionStatus(
        ContentSettingsType::MEDIASTREAM_CAMERA,
        frame_host->GetLastCommittedOrigin(),
        frame_host->GetLastCommittedOrigin());
    
    // Create service with appropriate capabilities
    auto service = std::make_unique<MediaDevicesDispatcherHostImpl>(
        frame_host->GetProcess()->GetID(),
        frame_host->GetRoutingID(),
        mic_status == blink::mojom::PermissionStatus::GRANTED,
        camera_status == blink::mojom::PermissionStatus::GRANTED);
    
    mojo::MakeSelfOwnedReceiver(std::move(service), std::move(receiver));
  }
};
```

---

## 9. Factory Pattern Summary (v134+)

### Key Advantages
- **Flexibility**: Easy to swap implementations based on runtime conditions
- **Testability**: Simplified dependency injection and mocking
- **Maintainability**: Centralized object creation logic
- **Security**: Controlled instantiation with proper validation
- **Performance**: Object pooling and lazy initialization support

### Modern Considerations
- **Memory Safety**: Use smart pointers and RAII principles
- **Error Handling**: Leverage `base::expected` for graceful error propagation
- **Async Support**: Modern async patterns with coroutines and callbacks
- **Type Safety**: Template metaprogramming and concepts for compile-time validation
- **Service Integration**: Seamless Mojo service creation and capability management

### Best Practices
1. **Always validate inputs** before object creation
2. **Use `base::expected`** for error-aware factory methods
3. **Implement proper cleanup** and resource management
4. **Consider object pooling** for frequently created objects
5. **Document factory contracts** and expected behavior
6. **Test factory behavior** with comprehensive unit tests
7. **Follow security guidelines** for capability-restricted components

The Factory pattern remains essential in modern Chromium architecture, enabling flexible, secure, and maintainable object creation across the complex browser ecosystem.
