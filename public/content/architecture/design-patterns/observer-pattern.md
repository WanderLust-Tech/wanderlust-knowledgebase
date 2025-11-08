# Observer Pattern in Modern Chromium (v134+)

The Observer pattern is fundamental to Chromium's event-driven architecture, enabling loose coupling between components that need to react to state changes. In modern Chromium v134+, the observer pattern has evolved to support thread-safe notifications, weak pointer management, and integration with Mojo services for cross-process observation.

---

## 1. Modern Observer Pattern Evolution (v134+)

### Core Principles
- **Decoupled Communication**: Subjects notify observers without tight coupling
- **Event-Driven Architecture**: Real-time notifications for state changes
- **Memory Safety**: Automatic cleanup using weak pointers and RAII
- **Thread Safety**: Safe cross-thread notification mechanisms
- **Service Integration**: Seamless integration with Mojo IPC for cross-process events

### Contemporary Applications
- **Cross-Process Events**: Mojo-based observer patterns for multi-process coordination
- **UI State Management**: Modern reactive UI updates with efficient batching
- **Service Lifecycle**: Service state change notifications with capability management
- **Performance Monitoring**: Real-time metrics collection and reporting
- **Security Events**: Privacy and security state change notifications

---

## 2. Modern Observer Implementations (v134+)

### 2.1. Thread-Safe Observer Pattern

Modern thread-safe observer implementation with weak pointer management:

```cpp
// Modern observer interface with weak pointer support
template<typename ObserverType>
class ThreadSafeObserverList {
 public:
  ThreadSafeObserverList() = default;
  ~ThreadSafeObserverList() = default;

  // Non-copyable, movable
  ThreadSafeObserverList(const ThreadSafeObserverList&) = delete;
  ThreadSafeObserverList& operator=(const ThreadSafeObserverList&) = delete;
  ThreadSafeObserverList(ThreadSafeObserverList&&) = default;
  ThreadSafeObserverList& operator=(ThreadSafeObserverList&&) = default;

  void AddObserver(ObserverType* observer) {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    CHECK(observer);
    observers_.push_back(observer->AsWeakPtr());
  }

  void RemoveObserver(ObserverType* observer) {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    CHECK(observer);
    
    auto it = std::find_if(observers_.begin(), observers_.end(),
                          [observer](const auto& weak_observer) {
                            return weak_observer.get() == observer;
                          });
    if (it != observers_.end()) {
      observers_.erase(it);
    }
  }

  // Notify all observers with automatic cleanup of expired weak pointers
  template<typename Method, typename... Args>
  void NotifyObservers(Method method, Args&&... args) {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    
    // Remove expired weak pointers while notifying
    auto it = observers_.begin();
    while (it != observers_.end()) {
      if (auto observer = it->get()) {
        (observer->*method)(std::forward<Args>(args)...);
        ++it;
      } else {
        it = observers_.erase(it);
      }
    }
  }

  // Async notification for cross-thread scenarios
  template<typename Method, typename... Args>
  void NotifyObserversAsync(const base::Location& location,
                           base::SequencedTaskRunner* task_runner,
                           Method method,
                           Args&&... args) {
    // Capture weak pointers for async execution
    std::vector<base::WeakPtr<ObserverType>> observer_copies;
    {
      DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
      observer_copies = observers_;
    }
    
    task_runner->PostTask(
        location,
        base::BindOnce(&ThreadSafeObserverList::NotifyObserversOnSequence<Method, Args...>,
                      std::move(observer_copies), method, std::forward<Args>(args)...));
  }

  bool HasObservers() const {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    // Clean up expired pointers when checking
    auto& mutable_observers = const_cast<std::vector<base::WeakPtr<ObserverType>>&>(observers_);
    mutable_observers.erase(
        std::remove_if(mutable_observers.begin(), mutable_observers.end(),
                      [](const auto& weak_ptr) { return !weak_ptr; }),
        mutable_observers.end());
    return !observers_.empty();
  }

 private:
  template<typename Method, typename... Args>
  static void NotifyObserversOnSequence(
      std::vector<base::WeakPtr<ObserverType>> observers,
      Method method,
      Args... args) {
    for (auto& weak_observer : observers) {
      if (auto observer = weak_observer.get()) {
        (observer->*method)(args...);
      }
    }
  }

  std::vector<base::WeakPtr<ObserverType>> observers_;
  SEQUENCE_CHECKER(sequence_checker_);
};
```

### 2.2. Mojo Observer Pattern

Cross-process observer pattern using Mojo for service communication:

```cpp
// Mojo-based observer for cross-process notifications
namespace download {

// Observer interface for download events
class DownloadObserver : public base::SupportsWeakPtr<DownloadObserver> {
 public:
  virtual ~DownloadObserver() = default;
  
  virtual void OnDownloadCreated(const std::string& download_id,
                                const DownloadMetadata& metadata) {}
  virtual void OnDownloadUpdated(const std::string& download_id,
                                const DownloadProgress& progress) {}
  virtual void OnDownloadCompleted(const std::string& download_id,
                                  const base::FilePath& file_path) {}
  virtual void OnDownloadFailed(const std::string& download_id,
                               DownloadError error) {}
};

// Modern download service with observer support
class DownloadServiceImpl : public mojom::DownloadService {
 public:
  explicit DownloadServiceImpl(Profile* profile)
      : profile_(profile) {}
  
  ~DownloadServiceImpl() override = default;

  // Mojo service methods
  void StartDownload(const GURL& url,
                    const std::string& referrer,
                    StartDownloadCallback callback) override {
    auto download_id = base::Uuid::GenerateRandomV4().AsLowercaseString();
    
    // Create download item
    auto download_item = std::make_unique<DownloadItem>(
        download_id, url, profile_->GetPath());
    
    // Notify local observers
    DownloadMetadata metadata;
    metadata.url = url;
    metadata.file_name = ExtractFileNameFromUrl(url);
    metadata.total_bytes = -1;  // Unknown initially
    
    observers_.NotifyObservers(&DownloadObserver::OnDownloadCreated,
                              download_id, metadata);
    
    // Notify remote observers via Mojo
    for (auto& remote_observer : remote_observers_) {
      if (remote_observer.is_connected()) {
        remote_observer->OnDownloadCreated(download_id, metadata.Clone());
      }
    }
    
    // Start the download asynchronously
    StartDownloadInternal(std::move(download_item), std::move(callback));
  }

  void AddObserver(mojo::PendingRemote<mojom::DownloadObserver> observer) override {
    mojo::Remote<mojom::DownloadObserver> remote_observer(std::move(observer));
    
    // Set up disconnect handler for cleanup
    remote_observer.set_disconnect_handler(
        base::BindOnce(&DownloadServiceImpl::OnRemoteObserverDisconnected,
                      weak_factory_.GetWeakPtr(),
                      remote_observer.get()));
    
    remote_observers_.push_back(std::move(remote_observer));
  }

  // Local observer management
  void AddLocalObserver(DownloadObserver* observer) {
    observers_.AddObserver(observer);
  }

  void RemoveLocalObserver(DownloadObserver* observer) {
    observers_.RemoveObserver(observer);
  }

 private:
  void StartDownloadInternal(std::unique_ptr<DownloadItem> item,
                           StartDownloadCallback callback) {
    const std::string download_id = item->GetId();
    
    // Set up progress tracking
    item->SetProgressCallback(
        base::BindRepeating(&DownloadServiceImpl::OnDownloadProgress,
                           weak_factory_.GetWeakPtr(), download_id));
    
    item->SetCompletionCallback(
        base::BindOnce(&DownloadServiceImpl::OnDownloadCompleted,
                      weak_factory_.GetWeakPtr(), download_id));
    
    // Store and start download
    active_downloads_[download_id] = std::move(item);
    active_downloads_[download_id]->Start();
    
    std::move(callback).Run(DownloadResult::kSuccess);
  }

  void OnDownloadProgress(const std::string& download_id,
                         int64_t bytes_downloaded,
                         int64_t total_bytes) {
    DownloadProgress progress;
    progress.bytes_downloaded = bytes_downloaded;
    progress.total_bytes = total_bytes;
    progress.percentage = total_bytes > 0 ? 
        static_cast<float>(bytes_downloaded) / total_bytes * 100.0f : 0.0f;
    
    // Notify local observers
    observers_.NotifyObservers(&DownloadObserver::OnDownloadUpdated,
                              download_id, progress);
    
    // Notify remote observers
    for (auto& remote_observer : remote_observers_) {
      if (remote_observer.is_connected()) {
        remote_observer->OnDownloadUpdated(download_id, progress.Clone());
      }
    }
  }

  void OnDownloadCompleted(const std::string& download_id,
                          const base::FilePath& file_path) {
    // Notify local observers
    observers_.NotifyObservers(&DownloadObserver::OnDownloadCompleted,
                              download_id, file_path);
    
    // Notify remote observers
    for (auto& remote_observer : remote_observers_) {
      if (remote_observer.is_connected()) {
        remote_observer->OnDownloadCompleted(download_id, file_path);
      }
    }
    
    // Clean up completed download
    active_downloads_.erase(download_id);
  }

  void OnRemoteObserverDisconnected(mojom::DownloadObserver* observer) {
    auto it = std::find_if(remote_observers_.begin(), remote_observers_.end(),
                          [observer](const auto& remote) {
                            return remote.get() == observer;
                          });
    if (it != remote_observers_.end()) {
      remote_observers_.erase(it);
    }
  }

  Profile* profile_;
  ThreadSafeObserverList<DownloadObserver> observers_;
  std::vector<mojo::Remote<mojom::DownloadObserver>> remote_observers_;
  std::unordered_map<std::string, std::unique_ptr<DownloadItem>> active_downloads_;
  
  base::WeakPtrFactory<DownloadServiceImpl> weak_factory_{this};
};

} // namespace download
```

### 2.3. Reactive Observer Pattern

Modern reactive observer pattern with efficient batching and filtering:

```cpp
// Reactive observer pattern with batching and filtering
template<typename EventType>
class ReactiveObserver : public base::SupportsWeakPtr<ReactiveObserver<EventType>> {
 public:
  virtual ~ReactiveObserver() = default;
  
  // Override this method to handle events
  virtual void OnEvent(const EventType& event) = 0;
  
  // Optional: Override for batch processing
  virtual void OnEventBatch(const std::vector<EventType>& events) {
    for (const auto& event : events) {
      OnEvent(event);
    }
  }
  
  // Optional: Override to filter events
  virtual bool ShouldReceiveEvent(const EventType& event) const {
    return true;
  }
};

template<typename EventType>
class ReactiveSubject {
 public:
  ReactiveSubject() : weak_factory_(this) {}
  
  void AddObserver(ReactiveObserver<EventType>* observer) {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    observers_.AddObserver(observer);
  }
  
  void RemoveObserver(ReactiveObserver<EventType>* observer) {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    observers_.RemoveObserver(observer);
  }
  
  // Emit single event with optional batching
  void EmitEvent(EventType event) {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    
    if (batch_events_) {
      pending_events_.push_back(std::move(event));
      ScheduleBatchFlush();
    } else {
      NotifyObserversOfEvent(event);
    }
  }
  
  // Emit multiple events efficiently
  void EmitEvents(std::vector<EventType> events) {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    
    if (batch_events_) {
      pending_events_.insert(pending_events_.end(),
                            std::make_move_iterator(events.begin()),
                            std::make_move_iterator(events.end()));
      ScheduleBatchFlush();
    } else {
      for (const auto& event : events) {
        NotifyObserversOfEvent(event);
      }
    }
  }
  
  // Configure batching behavior
  void SetBatchingEnabled(bool enabled) {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    batch_events_ = enabled;
    
    if (!enabled && !pending_events_.empty()) {
      FlushPendingEvents();
    }
  }
  
  void SetBatchDelay(base::TimeDelta delay) {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    batch_delay_ = delay;
  }
  
 private:
  void NotifyObserversOfEvent(const EventType& event) {
    std::vector<base::WeakPtr<ReactiveObserver<EventType>>> filtered_observers;
    
    // Apply filtering
    auto it = observers_.begin();
    while (it != observers_.end()) {
      if (auto observer = it->get()) {
        if (observer->ShouldReceiveEvent(event)) {
          filtered_observers.push_back(*it);
        }
        ++it;
      } else {
        it = observers_.erase(it);
      }
    }
    
    // Notify filtered observers
    for (auto& weak_observer : filtered_observers) {
      if (auto observer = weak_observer.get()) {
        observer->OnEvent(event);
      }
    }
  }
  
  void ScheduleBatchFlush() {
    if (batch_flush_pending_) {
      return;
    }
    
    batch_flush_pending_ = true;
    base::SequencedTaskRunner::GetCurrentDefault()->PostDelayedTask(
        FROM_HERE,
        base::BindOnce(&ReactiveSubject::FlushPendingEvents,
                      weak_factory_.GetWeakPtr()),
        batch_delay_);
  }
  
  void FlushPendingEvents() {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    batch_flush_pending_ = false;
    
    if (pending_events_.empty()) {
      return;
    }
    
    std::vector<EventType> events_to_flush;
    events_to_flush.swap(pending_events_);
    
    // Group events by observer for efficient batch processing
    std::unordered_map<ReactiveObserver<EventType>*, std::vector<EventType>> 
        observer_events;
    
    for (const auto& event : events_to_flush) {
      auto it = observers_.begin();
      while (it != observers_.end()) {
        if (auto observer = it->get()) {
          if (observer->ShouldReceiveEvent(event)) {
            observer_events[observer].push_back(event);
          }
          ++it;
        } else {
          it = observers_.erase(it);
        }
      }
    }
    
    // Notify observers with batched events
    for (auto& [observer, events] : observer_events) {
      if (events.size() == 1) {
        observer->OnEvent(events[0]);
      } else if (!events.empty()) {
        observer->OnEventBatch(events);
      }
    }
  }
  
  std::vector<base::WeakPtr<ReactiveObserver<EventType>>> observers_;
  std::vector<EventType> pending_events_;
  bool batch_events_ = false;
  bool batch_flush_pending_ = false;
  base::TimeDelta batch_delay_ = base::Milliseconds(16);  // ~60 FPS
  
  SEQUENCE_CHECKER(sequence_checker_);
  base::WeakPtrFactory<ReactiveSubject<EventType>> weak_factory_;
};
```

---

## 3. Key Observer Implementations in v134+

### 3.1. TabStripModelObserver

Modern tab management with enhanced lifecycle tracking:

```cpp
// Modern tab strip observer with comprehensive event handling
class TabStripModelObserver : public base::SupportsWeakPtr<TabStripModelObserver> {
 public:
  virtual ~TabStripModelObserver() = default;

  // Tab lifecycle events
  virtual void OnTabStripModelChanged(
      TabStripModel* tab_strip_model,
      const TabStripModelChange& change,
      const TabStripSelectionChange& selection) {}

  // Enhanced tab events for v134+
  virtual void OnTabWillBeAdded(TabStripModel* model, 
                               content::WebContents* contents,
                               int index) {}
  
  virtual void OnTabAdded(TabStripModel* model,
                         content::WebContents* contents,
                         int index,
                         bool foreground) {}
  
  virtual void OnTabWillBeRemoved(TabStripModel* model,
                                 content::WebContents* contents,
                                 int index,
                                 TabStripModelChange::RemoveReason reason) {}
  
  virtual void OnTabRemoved(TabStripModel* model,
                           content::WebContents* contents,
                           int index,
                           TabStripModelChange::RemoveReason reason) {}

  // Modern navigation and security events
  virtual void OnTabSecurityStateChanged(TabStripModel* model,
                                        content::WebContents* contents,
                                        int index,
                                        SecurityLevel security_level) {}
  
  virtual void OnTabPrivacySandboxStateChanged(TabStripModel* model,
                                              content::WebContents* contents,
                                              int index,
                                              bool privacy_sandbox_enabled) {}

  // Performance and resource events
  virtual void OnTabResourceUsageChanged(TabStripModel* model,
                                        content::WebContents* contents,
                                        int index,
                                        const ResourceUsageInfo& usage) {}
  
  virtual void OnTabFrozenStateChanged(TabStripModel* model,
                                      content::WebContents* contents,
                                      int index,
                                      bool is_frozen) {}
};

// Modern TabStripModel implementation
class TabStripModel {
 public:
  void AddObserver(TabStripModelObserver* observer) {
    observers_.AddObserver(observer);
  }
  
  void RemoveObserver(TabStripModelObserver* observer) {
    observers_.RemoveObserver(observer);
  }
  
  // Modern tab addition with comprehensive notification
  void AddWebContents(std::unique_ptr<content::WebContents> contents,
                     int index,
                     ui::PageTransition transition,
                     int add_types) {
    DCHECK(contents);
    
    // Notify observers before addition
    observers_.NotifyObservers(&TabStripModelObserver::OnTabWillBeAdded,
                              this, contents.get(), index);
    
    // Add tab to model
    auto* raw_contents = contents.get();
    web_contents_.insert(web_contents_.begin() + index, std::move(contents));
    
    // Set up content observers for enhanced events
    SetupContentObservers(raw_contents, index);
    
    // Notify observers after addition
    bool foreground = (add_types & ADD_ACTIVE) != 0;
    observers_.NotifyObservers(&TabStripModelObserver::OnTabAdded,
                              this, raw_contents, index, foreground);
    
    // Update selection if necessary
    if (foreground) {
      SetActiveIndex(index);
    }
  }
  
  // Enhanced removal with detailed reason tracking
  std::unique_ptr<content::WebContents> DetachWebContentsAt(
      int index,
      TabStripModelChange::RemoveReason reason) {
    DCHECK(IsValidIndex(index));
    
    auto* contents = web_contents_[index].get();
    
    // Notify observers before removal
    observers_.NotifyObservers(&TabStripModelObserver::OnTabWillBeRemoved,
                              this, contents, index, reason);
    
    // Clean up content observers
    CleanupContentObservers(contents);
    
    // Remove from model
    auto detached_contents = std::move(web_contents_[index]);
    web_contents_.erase(web_contents_.begin() + index);
    
    // Notify observers after removal
    observers_.NotifyObservers(&TabStripModelObserver::OnTabRemoved,
                              this, detached_contents.get(), index, reason);
    
    // Update active index if necessary
    if (active_index_ >= index && active_index_ > 0) {
      SetActiveIndex(active_index_ - 1);
    }
    
    return detached_contents;
  }
  
 private:
  void SetupContentObservers(content::WebContents* contents, int index) {
    // Set up security state observer
    auto security_observer = std::make_unique<SecurityStateObserver>(
        base::BindRepeating(&TabStripModel::OnSecurityStateChanged,
                           weak_factory_.GetWeakPtr(), contents, index));
    content_observers_[contents] = std::move(security_observer);
  }
  
  void OnSecurityStateChanged(content::WebContents* contents,
                             int index,
                             SecurityLevel level) {
    observers_.NotifyObservers(&TabStripModelObserver::OnTabSecurityStateChanged,
                              this, contents, index, level);
  }
  
  ThreadSafeObserverList<TabStripModelObserver> observers_;
  std::vector<std::unique_ptr<content::WebContents>> web_contents_;
  std::unordered_map<content::WebContents*, 
                     std::unique_ptr<SecurityStateObserver>> content_observers_;
  int active_index_ = -1;
  
  base::WeakPtrFactory<TabStripModel> weak_factory_{this};
};
```

### 3.2. PermissionObserver

Modern permission system observer with Privacy Sandbox integration:

```cpp
// Observer for permission and privacy state changes
class PermissionObserver : public base::SupportsWeakPtr<PermissionObserver> {
 public:
  virtual ~PermissionObserver() = default;
  
  // Traditional permission events
  virtual void OnPermissionChanged(const url::Origin& origin,
                                  ContentSettingsType type,
                                  ContentSetting setting) {}
  
  // Privacy Sandbox events (v134+)
  virtual void OnTopicsPermissionChanged(const url::Origin& origin,
                                        bool allowed) {}
  
  virtual void OnFledgePermissionChanged(const url::Origin& origin,
                                        bool allowed) {}
  
  virtual void OnAttributionReportingPermissionChanged(const url::Origin& origin,
                                                      bool allowed) {}
  
  // Trust Token events
  virtual void OnTrustTokenPermissionChanged(const url::Origin& origin,
                                           bool allowed) {}
  
  // Device permission events
  virtual void OnDevicePermissionChanged(const url::Origin& origin,
                                        blink::mojom::PermissionName permission,
                                        blink::mojom::PermissionStatus status) {}
};

// Modern permission manager with comprehensive notification
class PermissionManagerImpl {
 public:
  void AddObserver(PermissionObserver* observer) {
    observers_.AddObserver(observer);
  }
  
  void RemoveObserver(PermissionObserver* observer) {
    observers_.RemoveObserver(observer);
  }
  
  // Set permission with automatic notification
  void SetPermission(const url::Origin& origin,
                    ContentSettingsType type,
                    ContentSetting setting) {
    // Update internal state
    permission_store_[{origin, type}] = setting;
    
    // Notify observers
    observers_.NotifyObservers(&PermissionObserver::OnPermissionChanged,
                              origin, type, setting);
    
    // Handle Privacy Sandbox specific permissions
    if (type == ContentSettingsType::PRIVACY_SANDBOX_TOPICS_API) {
      bool allowed = (setting == CONTENT_SETTING_ALLOW);
      observers_.NotifyObservers(&PermissionObserver::OnTopicsPermissionChanged,
                                origin, allowed);
    }
    
    // Update related permissions and notify
    UpdateRelatedPermissions(origin, type, setting);
  }
  
  // Async permission request with observer notification
  void RequestPermissionAsync(
      const url::Origin& origin,
      ContentSettingsType type,
      base::OnceCallback<void(ContentSetting)> callback) {
    
    // Check if permission is already granted
    auto current_setting = GetPermission(origin, type);
    if (current_setting != CONTENT_SETTING_ASK) {
      std::move(callback).Run(current_setting);
      return;
    }
    
    // Show permission prompt asynchronously
    permission_prompt_->ShowPrompt(
        origin, type,
        base::BindOnce(&PermissionManagerImpl::OnPermissionPromptComplete,
                      weak_factory_.GetWeakPtr(), origin, type, 
                      std::move(callback)));
  }
  
 private:
  void OnPermissionPromptComplete(const url::Origin& origin,
                                 ContentSettingsType type,
                                 base::OnceCallback<void(ContentSetting)> callback,
                                 ContentSetting result) {
    // Update permission state
    SetPermission(origin, type, result);
    
    // Complete the request
    std::move(callback).Run(result);
  }
  
  void UpdateRelatedPermissions(const url::Origin& origin,
                               ContentSettingsType type,
                               ContentSetting setting) {
    // Handle cascading permission changes
    if (type == ContentSettingsType::NOTIFICATIONS && 
        setting == CONTENT_SETTING_BLOCK) {
      // Also block push messaging
      SetPermission(origin, ContentSettingsType::PUSH_MESSAGING, 
                   CONTENT_SETTING_BLOCK);
    }
    
    // Privacy Sandbox cascading
    if (type == ContentSettingsType::COOKIES && 
        setting == CONTENT_SETTING_BLOCK) {
      // Disable Privacy Sandbox APIs when cookies are blocked
      SetPermission(origin, ContentSettingsType::PRIVACY_SANDBOX_TOPICS_API,
                   CONTENT_SETTING_BLOCK);
      SetPermission(origin, ContentSettingsType::PRIVACY_SANDBOX_FLEDGE_API,
                   CONTENT_SETTING_BLOCK);
    }
  }
  
  ContentSetting GetPermission(const url::Origin& origin,
                              ContentSettingsType type) {
    auto key = std::make_pair(origin, type);
    auto it = permission_store_.find(key);
    return it != permission_store_.end() ? it->second : CONTENT_SETTING_ASK;
  }
  
  ThreadSafeObserverList<PermissionObserver> observers_;
  std::map<std::pair<url::Origin, ContentSettingsType>, ContentSetting> permission_store_;
  std::unique_ptr<PermissionPrompt> permission_prompt_;
  
  base::WeakPtrFactory<PermissionManagerImpl> weak_factory_{this};
};
```

### 3.3. Performance Observer

Modern performance monitoring with Core Web Vitals integration:

```cpp
// Performance event types for v134+
struct PerformanceEvent {
  enum class Type {
    kPageLoad,
    kResourceLoad,
    kCoreWebVitals,
    kMemoryUsage,
    kCPUUsage,
    kNetworkLatency,
    kRenderingMetrics
  };
  
  Type type;
  base::TimeTicks timestamp;
  url::Origin origin;
  std::unordered_map<std::string, double> metrics;
  std::unordered_map<std::string, std::string> metadata;
};

// Performance observer with filtering and aggregation
class PerformanceObserver : public ReactiveObserver<PerformanceEvent> {
 public:
  virtual ~PerformanceObserver() = default;
  
  // Implement filtering for specific performance events
  bool ShouldReceiveEvent(const PerformanceEvent& event) const override {
    // Filter by event type
    if (!interested_types_.empty() && 
        interested_types_.find(event.type) == interested_types_.end()) {
      return false;
    }
    
    // Filter by origin
    if (!interested_origins_.empty() &&
        interested_origins_.find(event.origin) == interested_origins_.end()) {
      return false;
    }
    
    return true;
  }
  
  // Override for batch processing of performance events
  void OnEventBatch(const std::vector<PerformanceEvent>& events) override {
    ProcessPerformanceBatch(events);
  }
  
  // Configuration methods
  void SetInterestedTypes(std::set<PerformanceEvent::Type> types) {
    interested_types_ = std::move(types);
  }
  
  void SetInterestedOrigins(std::set<url::Origin> origins) {
    interested_origins_ = std::move(origins);
  }
  
 protected:
  virtual void ProcessPerformanceBatch(const std::vector<PerformanceEvent>& events) {
    for (const auto& event : events) {
      OnEvent(event);
    }
  }
  
 private:
  std::set<PerformanceEvent::Type> interested_types_;
  std::set<url::Origin> interested_origins_;
};

// Modern performance monitor with Core Web Vitals
class PerformanceMonitor {
 public:
  PerformanceMonitor() {
    // Enable batching for efficient performance data collection
    subject_.SetBatchingEnabled(true);
    subject_.SetBatchDelay(base::Milliseconds(100));  // 10 Hz reporting
  }
  
  void AddObserver(PerformanceObserver* observer) {
    subject_.AddObserver(observer);
  }
  
  void RemoveObserver(PerformanceObserver* observer) {
    subject_.RemoveObserver(observer);
  }
  
  // Report Core Web Vitals
  void ReportCoreWebVitals(const url::Origin& origin,
                          double lcp,    // Largest Contentful Paint
                          double fid,    // First Input Delay
                          double cls) {  // Cumulative Layout Shift
    PerformanceEvent event;
    event.type = PerformanceEvent::Type::kCoreWebVitals;
    event.timestamp = base::TimeTicks::Now();
    event.origin = origin;
    event.metrics["lcp"] = lcp;
    event.metrics["fid"] = fid;
    event.metrics["cls"] = cls;
    
    // Calculate Web Vitals score
    double score = CalculateWebVitalsScore(lcp, fid, cls);
    event.metrics["score"] = score;
    
    subject_.EmitEvent(std::move(event));
  }
  
  // Report resource loading performance
  void ReportResourceLoad(const url::Origin& origin,
                         const GURL& resource_url,
                         base::TimeDelta load_time,
                         size_t resource_size) {
    PerformanceEvent event;
    event.type = PerformanceEvent::Type::kResourceLoad;
    event.timestamp = base::TimeTicks::Now();
    event.origin = origin;
    event.metrics["load_time_ms"] = load_time.InMillisecondsF();
    event.metrics["size_bytes"] = static_cast<double>(resource_size);
    event.metrics["throughput_mbps"] = 
        (resource_size * 8.0) / (load_time.InSecondsF() * 1024 * 1024);
    event.metadata["resource_url"] = resource_url.spec();
    
    subject_.EmitEvent(std::move(event));
  }
  
  // Report memory usage with detailed breakdown
  void ReportMemoryUsage(const url::Origin& origin,
                        const MemoryUsageInfo& usage_info) {
    PerformanceEvent event;
    event.type = PerformanceEvent::Type::kMemoryUsage;
    event.timestamp = base::TimeTicks::Now();
    event.origin = origin;
    event.metrics["heap_used_mb"] = usage_info.heap_used / (1024.0 * 1024.0);
    event.metrics["heap_total_mb"] = usage_info.heap_total / (1024.0 * 1024.0);
    event.metrics["external_mb"] = usage_info.external / (1024.0 * 1024.0);
    event.metrics["dom_nodes"] = static_cast<double>(usage_info.dom_nodes);
    
    subject_.EmitEvent(std::move(event));
  }
  
 private:
  double CalculateWebVitalsScore(double lcp, double fid, double cls) {
    // Implement Google's Core Web Vitals scoring algorithm
    double lcp_score = lcp <= 2500 ? 1.0 : (lcp <= 4000 ? 0.5 : 0.0);
    double fid_score = fid <= 100 ? 1.0 : (fid <= 300 ? 0.5 : 0.0);
    double cls_score = cls <= 0.1 ? 1.0 : (cls <= 0.25 ? 0.5 : 0.0);
    
    return (lcp_score + fid_score + cls_score) / 3.0;
  }
  
  ReactiveSubject<PerformanceEvent> subject_;
};
```

---

## 4. Advanced Observer Patterns (v134+)

### 4.1. Hierarchical Observer Pattern

Observer pattern with parent-child relationships and event bubbling:

```cpp
// Hierarchical observer for tree-structured events
template<typename EventType>
class HierarchicalObserver : public base::SupportsWeakPtr<HierarchicalObserver<EventType>> {
 public:
  virtual ~HierarchicalObserver() = default;
  
  // Handle events at this level
  virtual bool OnEvent(const EventType& event, bool from_child = false) {
    return false;  // Return true to stop event propagation
  }
  
  // Handle events bubbling up from children
  virtual bool OnChildEvent(const EventType& event, 
                           HierarchicalObserver* child) {
    return OnEvent(event, true);
  }
  
  // Set parent for event bubbling
  void SetParent(HierarchicalObserver* parent) {
    parent_ = parent ? parent->AsWeakPtr() : base::WeakPtr<HierarchicalObserver>();
  }
  
  // Add child observer
  void AddChild(HierarchicalObserver* child) {
    if (child) {
      children_.push_back(child->AsWeakPtr());
      child->SetParent(this);
    }
  }
  
  // Remove child observer
  void RemoveChild(HierarchicalObserver* child) {
    auto it = std::find_if(children_.begin(), children_.end(),
                          [child](const auto& weak_child) {
                            return weak_child.get() == child;
                          });
    if (it != children_.end()) {
      children_.erase(it);
      if (child) {
        child->SetParent(nullptr);
      }
    }
  }
  
 protected:
  // Emit event with automatic bubbling
  bool EmitEvent(const EventType& event) {
    // Handle locally first
    if (OnEvent(event)) {
      return true;  // Event handled, stop propagation
    }
    
    // Bubble up to parent
    if (auto parent = parent_.get()) {
      return parent->OnChildEvent(event, this);
    }
    
    return false;
  }
  
  // Broadcast event down to children
  void BroadcastToChildren(const EventType& event) {
    auto it = children_.begin();
    while (it != children_.end()) {
      if (auto child = it->get()) {
        if (child->OnEvent(event)) {
          break;  // Stop broadcast if child handles event
        }
        ++it;
      } else {
        it = children_.erase(it);
      }
    }
  }
  
 private:
  base::WeakPtr<HierarchicalObserver> parent_;
  std::vector<base::WeakPtr<HierarchicalObserver>> children_;
};
```

### 4.2. Filtered Observer Pattern

Observer pattern with sophisticated filtering and transformation:

```cpp
// Event filter interface
template<typename EventType>
class EventFilter {
 public:
  virtual ~EventFilter() = default;
  virtual bool ShouldProcess(const EventType& event) const = 0;
  virtual EventType Transform(EventType event) const { return event; }
};

// Compound filter for complex filtering logic
template<typename EventType>
class CompoundEventFilter : public EventFilter<EventType> {
 public:
  enum class Logic { kAnd, kOr };
  
  CompoundEventFilter(Logic logic) : logic_(logic) {}
  
  void AddFilter(std::unique_ptr<EventFilter<EventType>> filter) {
    filters_.push_back(std::move(filter));
  }
  
  bool ShouldProcess(const EventType& event) const override {
    if (filters_.empty()) {
      return true;
    }
    
    if (logic_ == Logic::kAnd) {
      return std::all_of(filters_.begin(), filters_.end(),
                        [&event](const auto& filter) {
                          return filter->ShouldProcess(event);
                        });
    } else {
      return std::any_of(filters_.begin(), filters_.end(),
                        [&event](const auto& filter) {
                          return filter->ShouldProcess(event);
                        });
    }
  }
  
  EventType Transform(EventType event) const override {
    for (const auto& filter : filters_) {
      event = filter->Transform(std::move(event));
    }
    return event;
  }
  
 private:
  Logic logic_;
  std::vector<std::unique_ptr<EventFilter<EventType>>> filters_;
};

// Filtered observer implementation
template<typename EventType>
class FilteredObserver : public base::SupportsWeakPtr<FilteredObserver<EventType>> {
 public:
  virtual ~FilteredObserver() = default;
  
  // Pure virtual method for handling filtered events
  virtual void OnFilteredEvent(const EventType& event) = 0;
  
  // Set event filter
  void SetFilter(std::unique_ptr<EventFilter<EventType>> filter) {
    filter_ = std::move(filter);
  }
  
  // Internal event processing with filtering
  bool ProcessEvent(const EventType& event) {
    if (!filter_ || filter_->ShouldProcess(event)) {
      EventType processed_event = filter_ ? filter_->Transform(event) : event;
      OnFilteredEvent(processed_event);
      return true;
    }
    return false;
  }
  
 private:
  std::unique_ptr<EventFilter<EventType>> filter_;
};
```

---

## 5. Testing Observer Patterns (v134+)

### 5.1. Mock Observer Implementation

Comprehensive mock observer for testing:

```cpp
// Mock observer with expectation validation
template<typename EventType>
class MockObserver : public ReactiveObserver<EventType> {
 public:
  MockObserver() = default;
  ~MockObserver() override = default;
  
  // Mock method that can be configured
  MOCK_METHOD(void, OnEvent, (const EventType& event), (override));
  MOCK_METHOD(void, OnEventBatch, (const std::vector<EventType>& events), (override));
  MOCK_METHOD(bool, ShouldReceiveEvent, (const EventType& event), (const override));
  
  // Helper methods for test setup
  void ExpectEvent(const EventType& expected_event) {
    EXPECT_CALL(*this, OnEvent(testing::Eq(expected_event)))
        .Times(1);
  }
  
  void ExpectEventCount(int count) {
    EXPECT_CALL(*this, OnEvent(testing::_))
        .Times(count);
  }
  
  void ExpectEventSequence(const std::vector<EventType>& sequence) {
    testing::InSequence seq;
    for (const auto& event : sequence) {
      EXPECT_CALL(*this, OnEvent(testing::Eq(event)))
          .Times(1);
    }
  }
  
  void ExpectNoEvents() {
    EXPECT_CALL(*this, OnEvent(testing::_))
        .Times(0);
  }
  
  // Set up filtering behavior for tests
  void SetupFiltering(std::function<bool(const EventType&)> filter_func) {
    ON_CALL(*this, ShouldReceiveEvent(testing::_))
        .WillByDefault(testing::Invoke(filter_func));
  }
  
  // Record events for verification
  void EnableEventRecording() {
    ON_CALL(*this, OnEvent(testing::_))
        .WillByDefault(testing::Invoke([this](const EventType& event) {
          recorded_events_.push_back(event);
        }));
  }
  
  const std::vector<EventType>& GetRecordedEvents() const {
    return recorded_events_;
  }
  
  void ClearRecordedEvents() {
    recorded_events_.clear();
  }
  
 private:
  std::vector<EventType> recorded_events_;
};

// Test helper for observer pattern testing
template<typename SubjectType, typename EventType>
class ObserverTestHelper {
 public:
  ObserverTestHelper() : mock_observer_(std::make_unique<MockObserver<EventType>>()) {}
  
  void SetUp() {
    subject_.AddObserver(mock_observer_.get());
  }
  
  void TearDown() {
    subject_.RemoveObserver(mock_observer_.get());
  }
  
  MockObserver<EventType>* mock_observer() { return mock_observer_.get(); }
  SubjectType* subject() { return &subject_; }
  
  // Verify observer was called within timeout
  void VerifyObserverCalledWithin(base::TimeDelta timeout) {
    base::RunLoop run_loop;
    base::OneShotTimer timer;
    
    EXPECT_CALL(*mock_observer_, OnEvent(testing::_))
        .WillOnce(testing::InvokeWithoutArgs([&run_loop]() {
          run_loop.Quit();
        }));
    
    timer.Start(FROM_HERE, timeout, 
                base::BindOnce([](base::RunLoop* loop) { loop->Quit(); }, 
                              &run_loop));
    
    run_loop.Run();
  }
  
 private:
  SubjectType subject_;
  std::unique_ptr<MockObserver<EventType>> mock_observer_;
};
```

### 5.2. Test Examples

Comprehensive test examples for observer patterns:

```cpp
// Test fixture for download observer testing
class DownloadObserverTest : public testing::Test {
 protected:
  void SetUp() override {
    download_service_ = std::make_unique<DownloadServiceImpl>(
        TestProfile::CreateProfile());
    mock_observer_ = std::make_unique<MockDownloadObserver>();
    download_service_->AddLocalObserver(mock_observer_.get());
  }
  
  void TearDown() override {
    download_service_->RemoveLocalObserver(mock_observer_.get());
  }
  
  std::unique_ptr<DownloadServiceImpl> download_service_;
  std::unique_ptr<MockDownloadObserver> mock_observer_;
};

TEST_F(DownloadObserverTest, NotifiesOnDownloadCreated) {
  const GURL test_url("https://example.com/file.pdf");
  const std::string expected_id = "test-download-id";
  
  // Set up expectation
  EXPECT_CALL(*mock_observer_, OnDownloadCreated(expected_id, testing::_))
      .Times(1);
  
  // Trigger download creation
  download_service_->StartDownload(test_url, "", base::DoNothing());
  
  // Verify expectation
  testing::Mock::VerifyAndClearExpectations(mock_observer_.get());
}

TEST_F(DownloadObserverTest, BatchNotificationForMultipleDownloads) {
  std::vector<GURL> urls = {
    GURL("https://example.com/file1.pdf"),
    GURL("https://example.com/file2.pdf"),
    GURL("https://example.com/file3.pdf")
  };
  
  // Expect three creation events
  EXPECT_CALL(*mock_observer_, OnDownloadCreated(testing::_, testing::_))
      .Times(3);
  
  // Start multiple downloads
  for (const auto& url : urls) {
    download_service_->StartDownload(url, "", base::DoNothing());
  }
  
  // Allow event processing
  base::RunLoop().RunUntilIdle();
  
  testing::Mock::VerifyAndClearExpectations(mock_observer_.get());
}

// Test for filtered observer
TEST_F(DownloadObserverTest, FilteredObserverReceivesOnlyRelevantEvents) {
  auto filtered_observer = std::make_unique<MockFilteredDownloadObserver>();
  
  // Set up filter to only receive PDF downloads
  filtered_observer->SetFilter(
      std::make_unique<FileTypeFilter>("application/pdf"));
  
  download_service_->AddLocalObserver(filtered_observer.get());
  
  // Expect only PDF download to be notified
  EXPECT_CALL(*filtered_observer, OnFilteredEvent(testing::_))
      .Times(1);
  
  // Start downloads of different types
  download_service_->StartDownload(GURL("https://example.com/image.jpg"), "", base::DoNothing());
  download_service_->StartDownload(GURL("https://example.com/document.pdf"), "", base::DoNothing());
  download_service_->StartDownload(GURL("https://example.com/video.mp4"), "", base::DoNothing());
  
  base::RunLoop().RunUntilIdle();
  
  download_service_->RemoveLocalObserver(filtered_observer.get());
}

// Test for async observer notification
TEST_F(DownloadObserverTest, AsyncNotificationWorksCorrectly) {
  base::test::TaskEnvironment task_environment{
      base::test::TaskEnvironment::TimeSource::MOCK_TIME};
  
  auto async_observer = std::make_unique<MockAsyncDownloadObserver>();
  download_service_->AddLocalObserver(async_observer.get());
  
  // Set up expectation for async notification
  base::RunLoop run_loop;
  EXPECT_CALL(*async_observer, OnDownloadCreated(testing::_, testing::_))
      .WillOnce(testing::InvokeWithoutArgs([&run_loop]() {
        run_loop.Quit();
      }));
  
  // Start download
  download_service_->StartDownload(GURL("https://example.com/file.pdf"), "", base::DoNothing());
  
  // Fast-forward time and run pending tasks
  task_environment.FastForwardBy(base::Milliseconds(100));
  run_loop.Run();
  
  download_service_->RemoveLocalObserver(async_observer.get());
}
```

---

## 6. Observer Pattern Best Practices (v134+)

### 6.1. Memory Management

```cpp
// RAII observer registration helper
template<typename SubjectType, typename ObserverType>
class ScopedObserverRegistration {
 public:
  ScopedObserverRegistration(SubjectType* subject, ObserverType* observer)
      : subject_(subject), observer_(observer) {
    DCHECK(subject_);
    DCHECK(observer_);
    subject_->AddObserver(observer_);
  }
  
  ~ScopedObserverRegistration() {
    if (subject_ && observer_) {
      subject_->RemoveObserver(observer_);
    }
  }
  
  // Non-copyable, movable
  ScopedObserverRegistration(const ScopedObserverRegistration&) = delete;
  ScopedObserverRegistration& operator=(const ScopedObserverRegistration&) = delete;
  
  ScopedObserverRegistration(ScopedObserverRegistration&& other) noexcept
      : subject_(std::exchange(other.subject_, nullptr)),
        observer_(std::exchange(other.observer_, nullptr)) {}
  
  ScopedObserverRegistration& operator=(ScopedObserverRegistration&& other) noexcept {
    if (this != &other) {
      if (subject_ && observer_) {
        subject_->RemoveObserver(observer_);
      }
      subject_ = std::exchange(other.subject_, nullptr);
      observer_ = std::exchange(other.observer_, nullptr);
    }
    return *this;
  }
  
  void Reset() {
    if (subject_ && observer_) {
      subject_->RemoveObserver(observer_);
      subject_ = nullptr;
      observer_ = nullptr;
    }
  }
  
 private:
  SubjectType* subject_;
  ObserverType* observer_;
};
```

### 6.2. Performance Optimization

```cpp
// High-performance observer list with minimal allocations
template<typename ObserverType>
class OptimizedObserverList {
 public:
  OptimizedObserverList() {
    observers_.reserve(kInitialCapacity);
  }
  
  void AddObserver(ObserverType* observer) {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    CHECK(observer);
    
    // Check if already exists to avoid duplicates
    if (std::find(observers_.begin(), observers_.end(), observer) == observers_.end()) {
      observers_.push_back(observer);
    }
  }
  
  void RemoveObserver(ObserverType* observer) {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    CHECK(observer);
    
    auto it = std::find(observers_.begin(), observers_.end(), observer);
    if (it != observers_.end()) {
      // Use swap-and-pop for O(1) removal
      std::swap(*it, observers_.back());
      observers_.pop_back();
    }
  }
  
  // High-performance notification with minimal overhead
  template<typename Method, typename... Args>
  void NotifyObservers(Method method, Args&&... args) {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    
    // Use simple iteration for maximum performance
    for (auto* observer : observers_) {
      if (observer) {
        (observer->*method)(args...);
      }
    }
  }
  
  size_t size() const {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    return observers_.size();
  }
  
  bool empty() const {
    DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
    return observers_.empty();
  }
  
 private:
  static constexpr size_t kInitialCapacity = 4;
  
  std::vector<ObserverType*> observers_;
  SEQUENCE_CHECKER(sequence_checker_);
};
```

---

## 7. Real-World Examples from Chromium v134+

### 7.1. WebContents Observer

Modern web contents observer with enhanced security and privacy events:

```cpp
// Simplified WebContentsObserver for v134+
class WebContentsObserver : public base::SupportsWeakPtr<WebContentsObserver> {
 public:
  explicit WebContentsObserver(content::WebContents* web_contents)
      : web_contents_(web_contents) {
    if (web_contents_) {
      web_contents_->AddObserver(this);
    }
  }
  
  virtual ~WebContentsObserver() {
    if (web_contents_) {
      web_contents_->RemoveObserver(this);
    }
  }
  
  // Navigation events
  virtual void DidStartNavigation(content::NavigationHandle* navigation) {}
  virtual void DidFinishNavigation(content::NavigationHandle* navigation) {}
  
  // Security events (v134+)
  virtual void DidChangeSecurityState(SecurityLevel security_level) {}
  virtual void OnPermissionStatusChanged(blink::mojom::PermissionName permission,
                                        blink::mojom::PermissionStatus status) {}
  
  // Privacy Sandbox events (v134+)
  virtual void OnTopicsAPIUsed(const std::vector<int>& topic_ids) {}
  virtual void OnFledgeAuctionCompleted(const GURL& seller_origin,
                                       bool success) {}
  
  // Performance events (v134+)
  virtual void OnCoreWebVitalsUpdated(double lcp, double fid, double cls) {}
  virtual void OnMemoryUsageUpdated(const MemoryUsageInfo& usage) {}
  
 protected:
  content::WebContents* web_contents() const { return web_contents_; }
  
 private:
  content::WebContents* web_contents_;
};
```

### 7.2. Preference Observer

Modern preference system observer with hierarchical settings:

```cpp
// Preference observer with fine-grained change detection
class PrefObserver : public base::SupportsWeakPtr<PrefObserver> {
 public:
  virtual ~PrefObserver() = default;
  
  // Called when a preference value changes
  virtual void OnPreferenceChanged(const std::string& pref_name,
                                  const base::Value& old_value,
                                  const base::Value& new_value) {}
  
  // Called for Privacy Sandbox preference changes
  virtual void OnPrivacySandboxPrefChanged(const std::string& pref_name,
                                          bool enabled) {}
  
  // Called for security-related preference changes
  virtual void OnSecurityPrefChanged(const std::string& pref_name,
                                    const base::Value& value) {}
};

class ModernPrefService {
 public:
  void AddObserver(PrefObserver* observer) {
    observers_.AddObserver(observer);
  }
  
  void RemoveObserver(PrefObserver* observer) {
    observers_.RemoveObserver(observer);
  }
  
  void SetUserPref(const std::string& pref_name, base::Value value) {
    auto old_value = GetValue(pref_name);
    
    // Update preference
    user_prefs_[pref_name] = value.Clone();
    
    // Notify observers
    observers_.NotifyObservers(&PrefObserver::OnPreferenceChanged,
                              pref_name, old_value, value);
    
    // Handle special preference categories
    if (IsPrivacySandboxPref(pref_name)) {
      bool enabled = value.is_bool() ? value.GetBool() : false;
      observers_.NotifyObservers(&PrefObserver::OnPrivacySandboxPrefChanged,
                                pref_name, enabled);
    }
    
    if (IsSecurityPref(pref_name)) {
      observers_.NotifyObservers(&PrefObserver::OnSecurityPrefChanged,
                                pref_name, value);
    }
  }
  
 private:
  bool IsPrivacySandboxPref(const std::string& pref_name) const {
    return base::StartsWith(pref_name, "privacy_sandbox.") ||
           pref_name == "profile.cookie_controls_mode";
  }
  
  bool IsSecurityPref(const std::string& pref_name) const {
    return base::StartsWith(pref_name, "security.") ||
           pref_name == "safebrowsing.enabled";
  }
  
  base::Value GetValue(const std::string& pref_name) const {
    auto it = user_prefs_.find(pref_name);
    return it != user_prefs_.end() ? it->second.Clone() : base::Value();
  }
  
  ThreadSafeObserverList<PrefObserver> observers_;
  std::unordered_map<std::string, base::Value> user_prefs_;
};
```

---

## 7. CheckedObserver Pattern - Memory Safety Enhancement

### 7.1. Overview

The `base::CheckedObserver` pattern is a critical memory safety enhancement introduced to prevent Use-After-Free (UAF) vulnerabilities in observer patterns. This pattern transforms potential UAF crashes when attempting to notify a deleted observer into deterministic `CHECK()` failures, making debugging significantly easier and preventing potential security exploits.

### 7.2. The UAF Problem in Observer Patterns

Traditional observer patterns in large codebases like Chromium are susceptible to UAF vulnerabilities:

```cpp
// Problematic traditional pattern
class UnsafeSubject {
 private:
  std::vector<Observer*> observers_;  // Raw pointers - dangerous!
  
 public:
  void NotifyObservers() {
    for (Observer* observer : observers_) {
      observer->OnEvent();  // UAF if observer was deleted!
    }
  }
};

class Observer {
 public:
  ~Observer() {
    // If observer is deleted without removing from subject,
    // future notifications will cause UAF
  }
};
```

**Problems with this approach:**
- **Late Detection**: UAF bugs often only manifest under high memory pressure
- **Misattributed Crashes**: Stack traces point to the notification site, not the root cause
- **Timing Dependencies**: Bugs slip through until Chrome runs long enough for memory to be fragmented
- **Security Risk**: UAF vulnerabilities can potentially be exploited

### 7.3. CheckedObserver Solution

`base::CheckedObserver` provides WeakPtr-like semantics for observer interfaces through a virtual destructor mechanism:

```cpp
// Safe CheckedObserver implementation
class base::CheckedObserver {
 public:
  CheckedObserver() = default;
  
  // Virtual destructor provides notification opportunity
  virtual ~CheckedObserver() {
    // Automatically notifies all CheckedObserverLists
    // that this observer is being destroyed
    CheckedObserverImpl::NotifyObserverDestroyed(this);
  }
  
  // Non-copyable to prevent accidental duplication
  CheckedObserver(const CheckedObserver&) = delete;
  CheckedObserver& operator=(const CheckedObserver&) = delete;
  
 private:
  // Internal implementation details managed by framework
  mutable CheckedObserverImpl impl_;
};

// Safe observer list that works with CheckedObserver
template<typename T>
class base::ObserverList {
 public:
  // Default behavior now requires CheckedObserver inheritance
  static_assert(std::is_base_of_v<CheckedObserver, T>,
               "Observers should inherit from base::CheckedObserver. "
               "Use ObserverList<T>::Unchecked for raw pointers.");
  
  void AddObserver(T* observer) {
    DCHECK(observer);
    CheckedObserverAdapter adapter(observer);
    observer_adapters_.push_back(adapter);
  }
  
  void RemoveObserver(T* observer) {
    auto it = std::find_if(observer_adapters_.begin(), observer_adapters_.end(),
                          [observer](const auto& adapter) {
                            return adapter.GetObserver() == observer;
                          });
    if (it != observer_adapters_.end()) {
      observer_adapters_.erase(it);
    }
  }
  
  template<typename Method, typename... Args>
  void NotifyObservers(Method method, Args&&... args) {
    // Create a snapshot to handle concurrent modifications
    auto adapters_copy = observer_adapters_;
    
    for (auto& adapter : adapters_copy) {
      if (T* observer = adapter.GetObserver()) {
        // Observer is still valid
        (observer->*method)(std::forward<Args>(args)...);
      } else {
        // Observer was deleted - CHECK() will fire with clear message
        CHECK(false) << "Attempting to notify deleted observer. "
                    << "Observer was destroyed without proper cleanup.";
      }
    }
    
    // Clean up any deleted observers
    CleanupDeletedObservers();
  }
  
  // Legacy support for unchecked raw pointers
  using Unchecked = base::ObserverList<T, false>;
  
 private:
  void CleanupDeletedObservers() {
    observer_adapters_.erase(
        std::remove_if(observer_adapters_.begin(), observer_adapters_.end(),
                      [](const auto& adapter) {
                        return adapter.GetObserver() == nullptr;
                      }),
        observer_adapters_.end());
  }
  
  std::vector<CheckedObserverAdapter<T>> observer_adapters_;
};
```

### 7.4. CheckedObserver Implementation Example

Here's how to implement a safe observer pattern using CheckedObserver:

```cpp
// Safe observer interface
class DownloadObserver : public base::CheckedObserver {
 public:
  ~DownloadObserver() override = default;
  
  virtual void OnDownloadStarted(const std::string& download_id) {}
  virtual void OnDownloadProgress(const std::string& download_id, 
                                 int percent) {}
  virtual void OnDownloadCompleted(const std::string& download_id) {}
  virtual void OnDownloadFailed(const std::string& download_id,
                               const std::string& error) {}
};

// Safe subject implementation
class DownloadManager {
 public:
  DownloadManager() = default;
  ~DownloadManager() = default;
  
  void AddObserver(DownloadObserver* observer) {
    observers_.AddObserver(observer);
  }
  
  void RemoveObserver(DownloadObserver* observer) {
    observers_.RemoveObserver(observer);
  }
  
  void StartDownload(const std::string& url) {
    std::string download_id = GenerateDownloadId();
    
    // Safe notification - will CHECK() if any observer was deleted
    observers_.NotifyObservers(&DownloadObserver::OnDownloadStarted, 
                              download_id);
    
    // Start the download asynchronously...
    StartDownloadInternal(download_id, url);
  }
  
 private:
  void OnDownloadProgressUpdate(const std::string& download_id, int percent) {
    // Safe progress notifications
    observers_.NotifyObservers(&DownloadObserver::OnDownloadProgress,
                              download_id, percent);
  }
  
  void OnDownloadComplete(const std::string& download_id) {
    // Safe completion notification
    observers_.NotifyObservers(&DownloadObserver::OnDownloadCompleted,
                              download_id);
  }
  
  base::ObserverList<DownloadObserver> observers_;
  // ... other implementation details
};

// Safe observer implementation
class DownloadStatusDisplay : public DownloadObserver {
 public:
  DownloadStatusDisplay(DownloadManager* manager) : manager_(manager) {
    // Register with manager
    manager_->AddObserver(this);
  }
  
  ~DownloadStatusDisplay() override {
    // Cleanup happens automatically via CheckedObserver destructor
    // But explicit cleanup is still good practice:
    if (manager_) {
      manager_->RemoveObserver(this);
    }
  }
  
  void OnDownloadStarted(const std::string& download_id) override {
    std::cout << "Download started: " << download_id << std::endl;
  }
  
  void OnDownloadProgress(const std::string& download_id, int percent) override {
    std::cout << "Download " << download_id << " progress: " 
              << percent << "%" << std::endl;
  }
  
  void OnDownloadCompleted(const std::string& download_id) override {
    std::cout << "Download completed: " << download_id << std::endl;
  }
  
 private:
  DownloadManager* manager_;
};
```

### 7.5. Migration Strategy

When migrating existing observer patterns to CheckedObserver:

```cpp
// Step 1: Make observer inherit from CheckedObserver
class MyObserver : public base::CheckedObserver {  // Add base class
 public:
  ~MyObserver() override = default;  // Make destructor virtual
  
  // ... observer methods remain unchanged
};

// Step 2: Update ObserverList declaration (if needed)
class MySubject {
 private:
  // Old: base::ObserverList<MyObserver>::Unchecked observers_;
  base::ObserverList<MyObserver> observers_;  // New: checked by default
};

// Step 3: Handle any remaining unchecked observers
class LegacyObserver {
  // Some observers may not be ready for CheckedObserver yet
};

class MySubject {
 private:
  // Keep using unchecked for legacy observers
  base::ObserverList<LegacyObserver>::Unchecked legacy_observers_;
  
  // Use checked for new observers
  base::ObserverList<MyObserver> modern_observers_;
};
```

### 7.6. Benefits and Trade-offs

**Benefits:**
- **Immediate Detection**: UAF bugs become deterministic CHECK() failures
- **Better Stack Traces**: Clear indication of the problematic notification
- **Easier Debugging**: Failures point to the actual problem, not symptoms
- **Security Improvement**: Prevents potential UAF exploits
- **Minimal Code Changes**: Easy migration path for existing code

**Trade-offs:**
- **Virtual Destructor Overhead**: Small performance cost for virtual destructor calls
- **Memory Overhead**: Slight increase in observer object size
- **Compilation Errors**: Template errors when using raw pointers with checked lists
- **Migration Complexity**: Large codebases require systematic migration

### 7.7. Common Patterns and Best Practices

```cpp
// Pattern 1: RAII Observer Registration
class SafeObserverRegistration {
 public:
  SafeObserverRegistration(Subject* subject, Observer* observer)
      : subject_(subject), observer_(observer) {
    if (subject_ && observer_) {
      subject_->AddObserver(observer_);
    }
  }
  
  ~SafeObserverRegistration() {
    if (subject_ && observer_) {
      subject_->RemoveObserver(observer_);
    }
  }
  
  // Make non-copyable
  SafeObserverRegistration(const SafeObserverRegistration&) = delete;
  SafeObserverRegistration& operator=(const SafeObserverRegistration&) = delete;
  
 private:
  Subject* subject_;
  Observer* observer_;
};

// Pattern 2: Observer with automatic cleanup
class AutoCleanupObserver : public base::CheckedObserver {
 public:
  AutoCleanupObserver() = default;
  
  ~AutoCleanupObserver() override {
    // Cleanup all registrations
    for (auto& subject : subjects_) {
      if (subject) {
        subject->RemoveObserver(this);
      }
    }
  }
  
  void ObserveSubject(Subject* subject) {
    if (subject) {
      subject->AddObserver(this);
      subjects_.push_back(subject);
    }
  }
  
 private:
  std::vector<Subject*> subjects_;
};

// Pattern 3: Conditional observer cleanup
class ConditionalObserver : public base::CheckedObserver {
 public:
  explicit ConditionalObserver(bool auto_cleanup = true)
      : auto_cleanup_(auto_cleanup) {}
  
  ~ConditionalObserver() override {
    if (auto_cleanup_ && subject_) {
      subject_->RemoveObserver(this);
    }
  }
  
  void StartObserving(Subject* subject) {
    subject_ = subject;
    if (subject_) {
      subject_->AddObserver(this);
    }
  }
  
  void StopObserving() {
    if (subject_) {
      subject_->RemoveObserver(this);
      subject_ = nullptr;
    }
  }
  
 private:
  bool auto_cleanup_;
  Subject* subject_ = nullptr;
};
```

### 7.8. Testing CheckedObserver Patterns

```cpp
// Test helper for CheckedObserver patterns
class CheckedObserverTest : public testing::Test {
 protected:
  class TestObserver : public base::CheckedObserver {
   public:
    MOCK_METHOD(void, OnTestEvent, (int value), ());
  };
  
  class TestSubject {
   public:
    void AddObserver(TestObserver* observer) {
      observers_.AddObserver(observer);
    }
    
    void RemoveObserver(TestObserver* observer) {
      observers_.RemoveObserver(observer);
    }
    
    void NotifyEvent(int value) {
      observers_.NotifyObservers(&TestObserver::OnTestEvent, value);
    }
    
   private:
    base::ObserverList<TestObserver> observers_;
  };
  
  TestSubject subject_;
  std::unique_ptr<TestObserver> observer_;
  
  void SetUp() override {
    observer_ = std::make_unique<TestObserver>();
    subject_.AddObserver(observer_.get());
  }
  
  void TearDown() override {
    if (observer_) {
      subject_.RemoveObserver(observer_.get());
    }
  }
};

// Test that deleted observer causes CHECK failure
TEST_F(CheckedObserverTest, DeletedObserverCausesCHECK) {
  // Set up expectation
  EXPECT_CALL(*observer_, OnTestEvent(42)).Times(1);
  
  // First notification should work
  subject_.NotifyEvent(42);
  
  // Delete observer without removing from subject
  observer_.reset();
  
  // This should cause a CHECK failure
  EXPECT_CHECK_DEATH({
    subject_.NotifyEvent(43);
  }, "Attempting to notify deleted observer");
}

// Test proper cleanup prevents CHECK failure
TEST_F(CheckedObserverTest, ProperCleanupPreventsFailure) {
  EXPECT_CALL(*observer_, OnTestEvent(42)).Times(1);
  
  // First notification should work
  subject_.NotifyEvent(42);
  
  // Properly remove observer before deletion
  subject_.RemoveObserver(observer_.get());
  observer_.reset();
  
  // This should not cause any failure
  subject_.NotifyEvent(43);  // Should be safe
}
```

### 7.9. Real-World Migration Example

Here's how Chromium migrated existing observer patterns:

```cpp
// Before: Traditional observer pattern (unsafe)
class WebContentsObserver {
 public:
  virtual ~WebContentsObserver() {
    // Manual cleanup required - error-prone
    if (web_contents_) {
      web_contents_->RemoveObserver(this);
    }
  }
  
  virtual void DidStartNavigation(NavigationHandle* handle) {}
  virtual void DidFinishNavigation(NavigationHandle* handle) {}
};

class WebContents {
 private:
  base::ObserverList<WebContentsObserver>::Unchecked observers_;  // Unsafe!
};

// After: CheckedObserver pattern (safe)
class WebContentsObserver : public base::CheckedObserver {  // Now inherits from CheckedObserver
 public:
  explicit WebContentsObserver(WebContents* web_contents)
      : web_contents_(web_contents) {
    if (web_contents_) {
      web_contents_->AddObserver(this);
    }
  }
  
  ~WebContentsObserver() override {
    // CheckedObserver destructor automatically handles cleanup
    // Manual cleanup still recommended for clarity:
    if (web_contents_) {
      web_contents_->RemoveObserver(this);
    }
  }
  
  // Observer methods remain unchanged
  virtual void DidStartNavigation(NavigationHandle* handle) {}
  virtual void DidFinishNavigation(NavigationHandle* handle) {}

 protected:
  WebContents* web_contents() const { return web_contents_; }
  
 private:
  WebContents* web_contents_;
};

class WebContents {
 public:
  void AddObserver(WebContentsObserver* observer) {
    observers_.AddObserver(observer);
  }
  
  void RemoveObserver(WebContentsObserver* observer) {
    observers_.RemoveObserver(observer);
  }
  
 private:
  base::ObserverList<WebContentsObserver> observers_;  // Now safe by default!
  
  void NotifyDidStartNavigation(NavigationHandle* handle) {
    // Will CHECK() if any observer was improperly deleted
    observers_.NotifyObservers(&WebContentsObserver::DidStartNavigation, handle);
  }
};
```

### 7.10. Debugging CheckedObserver Issues

When CheckedObserver CHECK() failures occur:

```cpp
// Typical CHECK failure message:
// CHECK failed: Attempting to notify deleted observer. 
// Observer was destroyed without proper cleanup.
//   at ../../base/observer_list.h:123
//   at WebContents::NotifyDidStartNavigation()
//   at WebContents::StartNavigation()

// Debugging steps:
// 1. Identify the observer type from the stack trace
// 2. Look for recent destruction of that observer type
// 3. Check if RemoveObserver() was called in destructor
// 4. Verify observer lifetime vs. subject lifetime

// Common debugging patterns:
class DebuggableObserver : public base::CheckedObserver {
 public:
  DebuggableObserver(const std::string& debug_name) 
      : debug_name_(debug_name) {
    VLOG(1) << "Creating observer: " << debug_name_;
  }
  
  ~DebuggableObserver() override {
    VLOG(1) << "Destroying observer: " << debug_name_;
    // CheckedObserver destructor will log if observer lists still contain this
  }
  
 private:
  std::string debug_name_;
};
```

The CheckedObserver pattern represents a significant improvement in memory safety for Chromium's observer patterns, transforming hard-to-debug UAF vulnerabilities into immediately detectable programming errors.

---

## 8. Real-World Examples from Chromium v134+

### 8.1. WebContents Observer

Modern web contents observer with enhanced security and privacy events:

```cpp
// Simplified WebContentsObserver for v134+ with CheckedObserver
class WebContentsObserver : public base::CheckedObserver {
 public:
  explicit WebContentsObserver(content::WebContents* web_contents)
      : web_contents_(web_contents) {
    if (web_contents_) {
      web_contents_->AddObserver(this);
    }
  }
  
  ~WebContentsObserver() override {
    if (web_contents_) {
      web_contents_->RemoveObserver(this);
    }
  }
  
  // Navigation events with enhanced context
  virtual void DidStartNavigation(content::NavigationHandle* handle) {}
  virtual void DidFinishNavigation(content::NavigationHandle* handle) {}
  virtual void DidFailNavigation(content::NavigationHandle* handle,
                                const net::Error& error) {}
  
  // Modern security and privacy events  
  virtual void OnSecurityStateChanged() {}
  virtual void OnPrivacySandboxSettingChanged() {}
  virtual void OnPermissionStatusChanged() {}
  
 protected:
  content::WebContents* web_contents() const { return web_contents_; }
  
 private:
  content::WebContents* web_contents_;
};
```

### 8.2. Preference Observer

Advanced preference observation with hierarchical change tracking:

```cpp
// Modern preference observer with CheckedObserver base
class PrefObserver : public base::CheckedObserver {
 public:
  ~PrefObserver() override = default;
  
  // Enhanced preference change notification
  virtual void OnPreferenceChanged(const std::string& pref_name,
                                  const base::Value& old_value,
                                  const base::Value& new_value) {}
  
  // Batch preference changes
  virtual void OnPreferencesBatchChanged(
      const std::map<std::string, std::pair<base::Value, base::Value>>& changes) {
    // Default implementation calls individual notifications
    for (const auto& [pref_name, values] : changes) {
      OnPreferenceChanged(pref_name, values.first, values.second);
    }
  }
};
```

---

## 9. Observer Pattern Summary (v134+)

### Key Advantages
- **Decoupled Architecture**: Subjects and observers remain loosely coupled
- **Real-Time Updates**: Immediate notification of state changes
- **Scalability**: Multiple observers can monitor a single subject
- **Testability**: Easy mocking and verification of event handling
- **Flexibility**: Dynamic subscription and unsubscription

### Modern Enhancements (v134+)
- **Memory Safety**: Automatic cleanup using weak pointers, CheckedObserver, and RAII
- **Thread Safety**: Safe cross-thread notification mechanisms
- **Performance**: Optimized notification with batching and filtering
- **Service Integration**: Seamless Mojo IPC for cross-process observation
- **Error Handling**: Robust error propagation and recovery
- **UAF Prevention**: CheckedObserver pattern eliminates use-after-free vulnerabilities

### Best Practices
1. **Inherit from CheckedObserver** to prevent UAF vulnerabilities
2. **Use weak pointers** to prevent memory leaks and dangling references
3. **Implement proper cleanup** in destructors and scope guards
4. **Consider batching** for high-frequency events to improve performance
5. **Apply filtering** to reduce unnecessary notifications
6. **Test thoroughly** with mock observers and comprehensive scenarios
7. **Document event contracts** clearly for maintainable code
8. **Handle edge cases** like observer removal during notification
9. **Migrate systematically** from raw pointer observer patterns to CheckedObserver

### CheckedObserver Migration Checklist
- [ ] Make observer classes inherit from `base::CheckedObserver`
- [ ] Update `ObserverList<T>::Unchecked` to `ObserverList<T>`
- [ ] Ensure virtual destructors in observer base classes
- [ ] Test for CHECK() failures in existing code
- [ ] Document any remaining unchecked observer lists with justification

The Observer pattern, enhanced with CheckedObserver safety mechanisms, continues to be essential in modern Chromium architecture. It provides the foundation for event-driven communication across the complex browser ecosystem while maintaining performance, security, and maintainability standards. The CheckedObserver pattern specifically addresses one of the most challenging aspects of large-scale C++ development: preventing use-after-free vulnerabilities in observer relationships.
