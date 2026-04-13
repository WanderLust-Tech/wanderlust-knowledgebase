# State Pattern in Chromium v134+

The State pattern enables objects to alter their behavior when internal state changes, appearing as if the object changed its class. Modern Chromium v134+ leverages sophisticated state machines for navigation, downloads, security contexts, service lifecycles, and complex UI interactions with type safety and performance optimization.

---

## 1. Modern State Pattern Applications (v134+)

### Core Browser States
- **Navigation State Management**: Multi-phase navigation with security boundaries
- **Download Pipeline States**: Progressive download phases with resume capability  
- **Service Lifecycle States**: Mojo service initialization, active, and cleanup phases
- **Security Context States**: Site isolation, permission states, and capability management
- **Renderer Process States**: Loading, active, backgrounded, and memory optimization
- **Network Request States**: DNS resolution, connection establishment, data transfer phases

### Advanced State Machines
- **Privacy Sandbox States**: Consent flow, feature enablement, and configuration phases
- **WebRTC Connection States**: ICE gathering, connection establishment, and media flow
- **Cache Management States**: Storage allocation, eviction policies, and cleanup cycles
- **Extension Lifecycle States**: Installation, activation, suspension, and removal phases

---

## 2. Modern C++ State Implementation Patterns

### Type-Safe State Machines with std::variant

```cpp
// Modern state machine using C++20 features
namespace content {

// State definitions with strong typing
struct NavigationPending {
  GURL url;
  base::TimeTicks start_time;
  NavigationRequest::Priority priority = NavigationRequest::Priority::kNormal;
};

struct NavigationInProgress {
  std::unique_ptr<NavigationRequest> request;
  base::TimeTicks navigation_start;
  int64_t request_id;
  bool is_same_process = false;
};

struct NavigationComplete {
  NavigationResult result;
  base::TimeTicks completion_time;
  std::optional<NavigationMetrics> metrics;
};

struct NavigationFailed {
  net::Error error_code;
  std::string error_description;
  base::TimeTicks failure_time;
  bool is_recoverable = false;
};

// Type-safe state variant
using NavigationState = std::variant<
    NavigationPending,
    NavigationInProgress, 
    NavigationComplete,
    NavigationFailed>;

class NavigationStateMachine {
 public:
  // Modern state transition with error handling
  base::expected<void, NavigationError> TransitionTo(NavigationState new_state) {
    if (!IsValidTransition(current_state_, new_state)) {
      return base::unexpected(NavigationError::kInvalidStateTransition);
    }
    
    // Execute state exit actions
    ExecuteExitActions(current_state_);
    
    // Update state atomically
    current_state_ = std::move(new_state);
    
    // Execute state entry actions  
    ExecuteEntryActions(current_state_);
    
    // Notify observers with new state
    NotifyStateChanged();
    
    return base::ok();
  }

  // Pattern matching for state-specific behavior
  template<typename Visitor>
  auto Visit(Visitor&& visitor) const {
    return std::visit(std::forward<Visitor>(visitor), current_state_);
  }

  // Type-safe state queries
  bool IsPending() const { 
    return std::holds_alternative<NavigationPending>(current_state_); 
  }
  
  bool IsInProgress() const { 
    return std::holds_alternative<NavigationInProgress>(current_state_); 
  }

 private:
  NavigationState current_state_{NavigationPending{}};
  base::ObserverList<NavigationStateObserver> observers_;
  
  bool IsValidTransition(const NavigationState& from, const NavigationState& to) const {
    // Implementation of state transition validation
    return state_transition_table_.IsValidTransition(
        GetStateType(from), GetStateType(to));
  }
};

}  // namespace content
```

### Hierarchical State Machines for Complex Components

```cpp
// Hierarchical state management for download system
namespace download {

class DownloadStateMachine : public base::RefCountedThreadSafe<DownloadStateMachine> {
 public:
  // Nested state hierarchy
  enum class MainState {
    kInitializing,
    kActive,      // Has sub-states
    kPaused,
    kCompleted,
    kFailed
  };
  
  enum class ActiveSubState {
    kConnecting,
    kDownloading,
    kVerifying,
    kMovingToFinalLocation
  };
  
  struct StateContext {
    MainState main_state = MainState::kInitializing;
    std::optional<ActiveSubState> sub_state;
    base::FilePath target_path;
    int64_t total_bytes = 0;
    int64_t received_bytes = 0;
    base::TimeTicks last_update;
    DownloadDangerType danger_type = DownloadDangerType::kNotDangerous;
  };

  // Modern async state transitions
  void TransitionToState(MainState new_main_state, 
                        std::optional<ActiveSubState> new_sub_state = std::nullopt) {
    DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
    
    // Validate transition on UI thread
    if (!IsValidStateTransition(context_.main_state, new_main_state)) {
      LOG(ERROR) << "Invalid state transition attempted: " 
                 << static_cast<int>(context_.main_state) 
                 << " -> " << static_cast<int>(new_main_state);
      return;
    }
    
    // Execute async state transition
    base::ThreadPool::PostTaskAndReplyWithResult(
        FROM_HERE,
        {base::MayBlock(), base::TaskPriority::USER_VISIBLE},
        base::BindOnce(&DownloadStateMachine::ExecuteStateTransition,
                      base::Unretained(this), new_main_state, new_sub_state),
        base::BindOnce(&DownloadStateMachine::OnStateTransitionComplete,
                      weak_factory_.GetWeakPtr()));
  }

 private:
  StateContext context_;
  base::WeakPtrFactory<DownloadStateMachine> weak_factory_{this};
  
  // Executed on background thread
  bool ExecuteStateTransition(MainState new_main_state, 
                             std::optional<ActiveSubState> new_sub_state) {
    // Perform heavy state transition work
    return true;  // Success
  }
  
  // Back on UI thread
  void OnStateTransitionComplete(bool success) {
    if (success) {
      NotifyObserversOfStateChange();
    }
  }
};

}  // namespace download
```

---

## 3. Mojo Service State Management

### Service Lifecycle State Patterns

```cpp
// Modern Mojo service with comprehensive state management
namespace network {

class NetworkServiceImpl : public mojom::NetworkService {
 public:
  enum class ServiceState {
    kInitializing,
    kConfiguring,
    kActive,
    kShuttingDown,
    kTerminated
  };

  class StateManager {
   public:
    // Thread-safe state transitions with validation
    bool TransitionTo(ServiceState new_state) {
      base::AutoLock lock(state_lock_);
      
      if (!IsValidTransition(current_state_, new_state)) {
        DLOG(WARNING) << "Invalid service state transition: "
                      << StateToString(current_state_) 
                      << " -> " << StateToString(new_state);
        return false;
      }
      
      ServiceState old_state = current_state_;
      current_state_ = new_state;
      
      // Execute state change callbacks without holding lock
      {
        base::AutoUnlock unlock(state_lock_);
        ExecuteStateChangeCallbacks(old_state, new_state);
      }
      
      return true;
    }
    
    ServiceState GetCurrentState() const {
      base::AutoLock lock(state_lock_);
      return current_state_;
    }
    
    // Wait for specific state with timeout
    base::expected<void, base::TimeDelta> WaitForState(
        ServiceState target_state, 
        base::TimeDelta timeout = base::Seconds(30)) {
      
      base::WaitableEvent state_reached;
      base::OneShotTimer timeout_timer;
      
      auto callback = base::BindRepeating([&](ServiceState old_state, ServiceState new_state) {
        if (new_state == target_state) {
          state_reached.Signal();
        }
      });
      
      AddStateChangeCallback(callback);
      
      // Set up timeout
      timeout_timer.Start(FROM_HERE, timeout, base::BindOnce([&]() {
        state_reached.Signal();  // Signal timeout
      }));
      
      state_reached.Wait();
      
      RemoveStateChangeCallback(callback);
      
      base::AutoLock lock(state_lock_);
      if (current_state_ == target_state) {
        return base::ok();
      } else {
        return base::unexpected(timeout);
      }
    }

   private:
    mutable base::Lock state_lock_;
    ServiceState current_state_ = ServiceState::kInitializing;
    std::vector<base::RepeatingCallback<void(ServiceState, ServiceState)>> callbacks_;
    
    bool IsValidTransition(ServiceState from, ServiceState to) const {
      // Define valid state transition matrix
      static const std::set<std::pair<ServiceState, ServiceState>> valid_transitions = {
        {ServiceState::kInitializing, ServiceState::kConfiguring},
        {ServiceState::kConfiguring, ServiceState::kActive},
        {ServiceState::kActive, ServiceState::kShuttingDown},
        {ServiceState::kShuttingDown, ServiceState::kTerminated},
        // Allow emergency shutdown from any state
        {ServiceState::kInitializing, ServiceState::kTerminated},
        {ServiceState::kConfiguring, ServiceState::kTerminated},
      };
      
      return valid_transitions.count({from, to}) > 0;
    }
  };

 private:
  std::unique_ptr<StateManager> state_manager_;
};

}  // namespace network
```

### Async State Coordination with Mojo

```cpp
// Coordinated state management across processes
namespace content {

class RenderProcessHostStateCoordinator {
 public:
  enum class ProcessState {
    kLaunching,
    kInitializing,
    kReady,
    kBackgrounded,
    kSuspended,
    kTerminating
  };

  // Coordinate state changes across process boundaries
  void CoordinateStateTransition(ProcessState target_state) {
    auto coordinator_request = CreateCoordinationRequest(target_state);
    
    // Coordinate with browser process
    coordinator_request->CoordinateWithBrowser(base::BindOnce(
        &RenderProcessHostStateCoordinator::OnBrowserCoordinationComplete,
        weak_factory_.GetWeakPtr(), target_state));
  }

 private:
  void OnBrowserCoordinationComplete(ProcessState target_state, bool browser_ready) {
    if (!browser_ready) {
      LOG(ERROR) << "Browser process coordination failed for state: "
                 << static_cast<int>(target_state);
      return;
    }
    
    // Coordinate with renderer process via Mojo
    if (renderer_coordinator_.is_bound()) {
      renderer_coordinator_->PrepareForStateTransition(
          ConvertToMojoState(target_state),
          base::BindOnce(&RenderProcessHostStateCoordinator::OnRendererReady,
                        weak_factory_.GetWeakPtr(), target_state));
    }
  }
  
  void OnRendererReady(ProcessState target_state, bool renderer_ready) {
    if (renderer_ready) {
      ExecuteStateTransition(target_state);
    } else {
      HandleStateTransitionFailure(target_state);
    }
  }
  
  mojo::Remote<mojom::RendererStateCoordinator> renderer_coordinator_;
  base::WeakPtrFactory<RenderProcessHostStateCoordinator> weak_factory_{this};
};

}  // namespace content
```

---

## 4. Privacy Sandbox State Management

### Consent and Configuration State Patterns

```cpp
// Privacy Sandbox state management with compliance tracking
namespace privacy_sandbox {

class PrivacySandboxStateManager {
 public:
  enum class ConsentState {
    kNotRequired,
    kRequired,
    kPending,
    kGranted,
    kDenied,
    kWithdrawn
  };
  
  enum class FeatureState {
    kDisabled,
    kEnabledWithConsent,
    kEnabledWithoutConsent,
    kTemporarilyDisabled,
    kPermanentlyDisabled
  };

  struct PrivacySandboxContext {
    ConsentState consent_state = ConsentState::kNotRequired;
    std::map<PrivacySandboxFeature, FeatureState> feature_states;
    base::Time consent_timestamp;
    std::string consent_jurisdiction;
    bool is_measurement_enabled = false;
    bool is_topics_enabled = false;
    bool is_fledge_enabled = false;
  };

  // Complex state validation with regulatory compliance
  base::expected<void, PrivacySandboxError> UpdateConsentState(
      ConsentState new_consent_state,
      const ConsentMetadata& metadata) {
    
    if (!IsValidConsentTransition(context_.consent_state, new_consent_state)) {
      return base::unexpected(PrivacySandboxError::kInvalidConsentTransition);
    }
    
    // Validate regulatory compliance
    if (auto compliance_check = ValidateRegulatoryCompliance(new_consent_state, metadata);
        !compliance_check.has_value()) {
      return compliance_check;
    }
    
    // Update consent state atomically
    context_.consent_state = new_consent_state;
    context_.consent_timestamp = base::Time::Now();
    context_.consent_jurisdiction = metadata.jurisdiction;
    
    // Propagate state changes to dependent features
    UpdateDependentFeatureStates();
    
    // Log compliance event
    RecordComplianceEvent(new_consent_state, metadata);
    
    return base::ok();
  }

 private:
  PrivacySandboxContext context_;
  
  void UpdateDependentFeatureStates() {
    // Update Topics API state
    if (context_.consent_state == ConsentState::kGranted) {
      context_.feature_states[PrivacySandboxFeature::kTopics] = 
          FeatureState::kEnabledWithConsent;
    } else if (context_.consent_state == ConsentState::kDenied) {
      context_.feature_states[PrivacySandboxFeature::kTopics] = 
          FeatureState::kPermanentlyDisabled;
    }
    
    // Update FLEDGE state based on consent and feature flags
    UpdateFledgeState();
    UpdateMeasurementState();
  }
};

}  // namespace privacy_sandbox
```

---

## 5. Performance-Optimized State Machines

### Cache-Friendly State Management

```cpp
// High-performance state management for renderer processes
namespace blink {

class RenderFrameStateManager {
 public:
  // Bit-packed state for cache efficiency
  struct CompactFrameState {
    uint32_t lifecycle_state : 4;      // FrameLifecycleState (16 values max)
    uint32_t visibility_state : 2;     // VisibilityState (4 values max)
    uint32_t loading_state : 3;        // LoadingState (8 values max)
    uint32_t is_main_frame : 1;        // Boolean
    uint32_t is_cross_origin : 1;      // Boolean
    uint32_t has_committed_navigation : 1;  // Boolean
    uint32_t is_frozen : 1;             // Boolean
    uint32_t reserved : 19;             // Reserved for future use
    
    // Fast state queries using bit operations
    bool IsActiveAndVisible() const {
      return (lifecycle_state == static_cast<uint32_t>(FrameLifecycleState::kActive)) &&
             (visibility_state == static_cast<uint32_t>(mojom::VisibilityState::kVisible));
    }
    
    bool CanStartNavigation() const {
      return (lifecycle_state <= static_cast<uint32_t>(FrameLifecycleState::kActive)) &&
             !is_frozen;
    }
  };

  // Lockless state updates using atomic operations
  void UpdateState(const StateUpdate& update) {
    CompactFrameState current_state;
    CompactFrameState new_state;
    
    do {
      current_state.value = state_.load(std::memory_order_acquire);
      new_state = current_state;
      
      // Apply state update
      ApplyUpdate(new_state, update);
      
    } while (!state_.compare_exchange_weak(
        current_state.value, new_state.value, 
        std::memory_order_release, std::memory_order_relaxed));
    
    // Notify state change observers if necessary
    if (HasStateChangeObservers() && StateChangeRequiresNotification(current_state, new_state)) {
      NotifyStateChangeAsync(current_state, new_state);
    }
  }

 private:
  // Atomic state storage for lockless access
  std::atomic<uint32_t> state_{0};
  
  // Observer notification queue to avoid blocking state updates
  base::circular_deque<StateChangeNotification> pending_notifications_;
  base::SequenceBound<StateChangeNotifier> notifier_;
};

}  // namespace blink
```

### Memory-Efficient State History

```cpp
// Efficient state history tracking for debugging and rollback
namespace base {

template<typename StateType, size_t MaxHistorySize = 32>
class CompactStateHistory {
 public:
  struct StateEntry {
    StateType state;
    base::TimeTicks timestamp;
    uint32_t transition_id;
    
    // Optional debug information (only in debug builds)
#if DCHECK_IS_ON()
    std::string debug_info;
    base::Location location;
#endif
  };

  void RecordStateTransition(const StateType& new_state, 
                           const base::Location& location = FROM_HERE) {
    uint32_t transition_id = next_transition_id_++;
    
    StateEntry entry{
      .state = new_state,
      .timestamp = base::TimeTicks::Now(),
      .transition_id = transition_id
    };
    
#if DCHECK_IS_ON()
    entry.location = location;
#endif
    
    // Circular buffer for memory efficiency
    history_[history_index_] = std::move(entry);
    history_index_ = (history_index_ + 1) % MaxHistorySize;
    
    if (size_ < MaxHistorySize) {
      ++size_;
    }
  }
  
  // Efficient state history queries
  std::optional<StateType> GetStateAt(base::TimeTicks timestamp) const {
    for (size_t i = 0; i < size_; ++i) {
      const auto& entry = history_[i];
      if (entry.timestamp <= timestamp) {
        return entry.state;
      }
    }
    return std::nullopt;
  }

 private:
  std::array<StateEntry, MaxHistorySize> history_;
  size_t history_index_ = 0;
  size_t size_ = 0;
  std::atomic<uint32_t> next_transition_id_{1};
};

}  // namespace base
```

---

## 6. Testing State Machines in Chromium v134+

### Comprehensive State Machine Testing

```cpp
// Modern testing patterns for state machines
namespace content {

class NavigationStateMachineTest : public testing::Test {
 public:
  void SetUp() override {
    state_machine_ = std::make_unique<NavigationStateMachine>();
    
    // Set up test observers
    state_observer_ = std::make_unique<TestStateObserver>();
    state_machine_->AddObserver(state_observer_.get());
  }

  // Test state transition validation
  TEST_F(NavigationStateMachineTest, ValidatesStateTransitions) {
    // Test valid transition
    EXPECT_TRUE(state_machine_->TransitionTo(NavigationInProgress{}).has_value());
    
    // Test invalid transition (should fail)
    auto result = state_machine_->TransitionTo(NavigationPending{});
    EXPECT_FALSE(result.has_value());
    EXPECT_EQ(result.error(), NavigationError::kInvalidStateTransition);
  }

  // Test state machine behavior under concurrent access
  TEST_F(NavigationStateMachineTest, HandlesConcurrentStateChanges) {
    constexpr int kNumThreads = 10;
    constexpr int kTransitionsPerThread = 100;
    
    std::vector<std::thread> threads;
    std::atomic<int> successful_transitions{0};
    
    for (int i = 0; i < kNumThreads; ++i) {
      threads.emplace_back([&]() {
        for (int j = 0; j < kTransitionsPerThread; ++j) {
          if (state_machine_->TransitionTo(GenerateRandomValidState()).has_value()) {
            successful_transitions.fetch_add(1);
          }
        }
      });
    }
    
    for (auto& thread : threads) {
      thread.join();
    }
    
    // Verify state machine remained consistent
    EXPECT_GT(successful_transitions.load(), 0);
    EXPECT_TRUE(state_machine_->IsInValidState());
  }

 private:
  std::unique_ptr<NavigationStateMachine> state_machine_;
  std::unique_ptr<TestStateObserver> state_observer_;
};

// Property-based testing for state machines
class StatePropertyTest : public testing::TestWithParam<StateTransitionTestCase> {
 public:
  // Generate comprehensive test cases
  static std::vector<StateTransitionTestCase> GenerateTestCases() {
    std::vector<StateTransitionTestCase> test_cases;
    
    // Generate all valid state transitions
    for (auto from_state : AllPossibleStates()) {
      for (auto to_state : AllPossibleStates()) {
        test_cases.push_back({
          .from_state = from_state,
          .to_state = to_state,
          .should_succeed = IsValidTransition(from_state, to_state),
          .expected_side_effects = ComputeExpectedSideEffects(from_state, to_state)
        });
      }
    }
    
    return test_cases;
  }
};

INSTANTIATE_TEST_SUITE_P(
    AllStateTransitions,
    StatePropertyTest,
    testing::ValuesIn(StatePropertyTest::GenerateTestCases())
);

}  // namespace content
```

### Mock State Coordination Testing

```cpp
// Testing complex state coordination scenarios
namespace content {

class MockRenderProcessStateCoordinator : public RenderProcessStateCoordinator {
 public:
  MOCK_METHOD(void, CoordinateStateTransition, (ProcessState target_state), (override));
  MOCK_METHOD(bool, WaitForStateTransition, (ProcessState state, base::TimeDelta timeout), (override));
  
  // Simulate state coordination failures
  void SimulateCoordinationFailure(ProcessState failing_state) {
    ON_CALL(*this, CoordinateStateTransition(failing_state))
        .WillByDefault(testing::Invoke([this](ProcessState state) {
          // Simulate failure after delay
          base::SequencedTaskRunner::GetCurrentDefault()->PostDelayedTask(
              FROM_HERE,
              base::BindOnce(&MockRenderProcessStateCoordinator::NotifyCoordinationFailure,
                            base::Unretained(this), state),
              base::Milliseconds(100));
        }));
  }
  
 private:
  void NotifyCoordinationFailure(ProcessState state) {
    // Notify observers of coordination failure
  }
};

// Integration test for state coordination
TEST_F(RenderProcessStateTest, HandlesCoordinationFailures) {
  auto mock_coordinator = std::make_unique<MockRenderProcessStateCoordinator>();
  
  // Configure mock to fail background state transition
  mock_coordinator->SimulateCoordinationFailure(ProcessState::kBackgrounded);
  
  // Attempt state transition
  bool transition_result = process_host_->TransitionToBackgroundState();
  
  // Verify graceful failure handling
  EXPECT_FALSE(transition_result);
  EXPECT_EQ(process_host_->GetCurrentState(), ProcessState::kReady);
  
  // Verify error was logged
  EXPECT_TRUE(HasLoggedError("State coordination failed"));
}

}  // namespace content
```

---

## 7. Real-World Examples from Chromium v134+

### Download State Management

**File**: `content/browser/download/download_item_impl.h`

Modern download state management with resumption support:

```cpp
// Simplified view of actual Chromium v134+ download states
enum class DownloadInternalState {
  kInitial,
  kTarget,
  kInterrupted,
  kInProgress, 
  kComplete,
  kCancelled
};

// Enhanced with security and privacy features
class DownloadItemImpl {
 private:
  DownloadInternalState internal_state_ = DownloadInternalState::kInitial;
  DownloadDangerType danger_type_ = DownloadDangerType::kNotDangerous;
  bool is_mixed_content_ = false;
  bool is_from_privacy_sandbox_ = false;
};
```

### Service Worker State Management  

**File**: `content/browser/service_worker/service_worker_version.h`

```cpp
// Service Worker lifecycle with enhanced security
enum class ServiceWorkerVersion::Status {
  kNew,
  kDownloading,
  kInstalling,
  kInstalled,
  kActivating,
  kActivated,
  kRedundant
};

// Modern state tracking with privacy considerations
class ServiceWorkerVersion {
 private:
  Status status_ = Status::kNew;
  bool is_privacy_sandbox_enabled_ = false;
  std::optional<PrivacySandboxPolicy> privacy_policy_;
};
```

### Navigation State with Site Isolation

**File**: `content/browser/renderer_host/navigation_request.h`

```cpp
// Enhanced navigation states for site isolation
enum class NavigationRequest::NavigationState {
  kWillStartRequest,
  kWillRedirectRequest, 
  kWillFailRequest,
  kWillProcessResponse,
  kReadyToCommit,
  kWillCommitNavigation
};

// Modern security-aware navigation tracking
class NavigationRequest {
 private:
  NavigationState state_ = NavigationState::kWillStartRequest;
  bool is_cross_site_cross_rph_ = false;
  SiteInstance* target_site_instance_ = nullptr;
};
```

---

## 8. Advanced State Pattern Best Practices (v134+)

### Modern C++ Best Practices

1. **Use std::variant for Type Safety**
   - Prefer `std::variant` over enum + union patterns
   - Leverage `std::visit` for exhaustive state handling
   - Use concepts to constrain state types

2. **Implement RAII for State Resources**
   - Acquire resources on state entry, release on exit
   - Use smart pointers for automatic cleanup
   - Implement exception-safe state transitions

3. **Leverage base::expected for Error Handling**
   - Return `base::expected<void, ErrorType>` from state transitions
   - Provide detailed error information for debugging
   - Support both synchronous and asynchronous error propagation

### Performance Optimization

1. **Memory Layout Optimization**
   - Pack state data for cache efficiency
   - Use atomic operations for lockless state updates
   - Minimize memory allocations during transitions

2. **Concurrent State Management**
   - Use thread-safe state machines for shared state
   - Implement lockless algorithms where possible
   - Provide async state coordination mechanisms

### Security Considerations

1. **State Validation**
   - Validate all state transitions against security policies
   - Implement capability-based state access control
   - Log security-relevant state changes for auditing

2. **Privacy-Aware State Management**
   - Consider privacy implications of state persistence
   - Implement appropriate state cleanup on privacy events
   - Support privacy sandbox state isolation

---

## 9. Modern Debugging and Monitoring

### State Machine Introspection

```cpp
// Advanced debugging support for state machines
class StateDebugInfo {
 public:
  struct StateSnapshot {
    std::string current_state_name;
    base::TimeTicks last_transition_time;
    std::vector<std::string> recent_transitions;
    std::map<std::string, base::Value> debug_properties;
  };
  
  // Export state for chrome://internals pages
  base::Value::Dict ExportToValue() const {
    base::Value::Dict result;
    result.Set("current_state", GetCurrentStateName());
    result.Set("transition_count", static_cast<int>(transition_count_));
    result.Set("uptime", GetUptimeString());
    result.Set("recent_transitions", GetRecentTransitionsAsValue());
    return result;
  }
};
```

### Performance Metrics Integration

```cpp
// Integration with Chromium's metrics system
class StateMetricsRecorder {
 public:
  void RecordStateTransition(const std::string& state_machine_name,
                           const std::string& from_state,
                           const std::string& to_state,
                           base::TimeDelta transition_duration) {
    // Record UMA histogram
    base::UmaHistogramTimes(
        base::StrCat({"StateTransition.", state_machine_name, ".Duration"}),
        transition_duration);
        
    // Record state distribution
    base::UmaHistogramEnumeration(
        base::StrCat({"StateTransition.", state_machine_name, ".ToState"}),
        HashStateString(to_state));
  }
};
```

---

## 10. Integration with Modern Chromium Architecture

### Mojo Service Integration

State machines in v134+ integrate seamlessly with Mojo services for cross-process state synchronization:

```cpp
// State coordination across process boundaries
interface StateCoordinator {
  // Prepare for state transition
  PrepareStateTransition(StateTransitionRequest request) 
      => (StateTransitionResponse response);
  
  // Commit state transition after coordination
  CommitStateTransition(StateCommitRequest request);
  
  // Observer interface for state changes
  AddStateObserver(pending_remote<StateObserver> observer);
};
```

### Privacy Sandbox Integration

State machines respect Privacy Sandbox boundaries and provide appropriate isolation:

```cpp
// Privacy-aware state management
class PrivacyAwareStateMachine {
 public:
  // State transitions respect privacy context
  bool CanTransitionTo(State new_state) const {
    return IsValidTransition(current_state_, new_state) &&
           privacy_policy_.AllowsStateTransition(current_state_, new_state);
  }
};
```

---

## 11. References and Further Reading

### Core Implementation Files
- `base/state_machine/` - Base state machine utilities
- `content/browser/navigation/navigation_request.h` - Navigation state management
- `content/browser/download/download_item_impl.h` - Download state implementation  
- `services/network/network_service.h` - Network service lifecycle states
- `chrome/browser/privacy_sandbox/` - Privacy Sandbox state management

### Architecture Documentation
- [Process Model](../process-model.md) - Multi-process state coordination
- [IPC Internals](../ipc-internals.md) - State synchronization via Mojo
- [Security Model](../../security/security-model.md) - Security-aware state management

### Modern C++ Patterns
- [RAII Patterns](../design-patterns/raii-pattern.md) - Resource management in state machines
- [Observer Pattern](../design-patterns/observer-pattern.md) - State change notification
- [Factory Pattern](../design-patterns/factory-pattern.md) - State object creation

### Testing and Debugging
- [Testing Strategies](../../debugging/testing-strategies.md) - State machine testing approaches
- [Chrome Internals](../../debugging/chrome-internals-urls.md) - State inspection tools

---

The State pattern in modern Chromium v134+ demonstrates sophisticated software engineering with type safety, performance optimization, security awareness, and seamless integration with the browser's multi-process architecture. Understanding these patterns is essential for contributing to or extending Chromium's state management systems.
