# C++ and Chromium Development Playground

Explore C++ concepts and Chromium-specific patterns in this interactive playground. While full C++ compilation requires a server, you can learn syntax, understand patterns, and experiment with code structure.

## Basic C++ Concepts

### Memory Management and Smart Pointers

```cpp
#include <iostream>
#include <memory>
#include <vector>
#include <string>

// Modern C++ memory management example
class ChromiumComponent {
private:
    std::string name_;
    int priority_;
    
public:
    ChromiumComponent(const std::string& name, int priority) 
        : name_(name), priority_(priority) {
        std::cout << "Creating component: " << name_ << std::endl;
    }
    
    ~ChromiumComponent() {
        std::cout << "Destroying component: " << name_ << std::endl;
    }
    
    const std::string& GetName() const { return name_; }
    int GetPriority() const { return priority_; }
    
    void Process() {
        std::cout << "Processing " << name_ << " with priority " << priority_ << std::endl;
    }
};

// Factory pattern commonly used in Chromium
class ComponentFactory {
public:
    static std::unique_ptr<ChromiumComponent> CreateComponent(
        const std::string& type, const std::string& name) {
        
        int priority = (type == "ui") ? 1 : (type == "network") ? 2 : 3;
        return std::make_unique<ChromiumComponent>(name, priority);
    }
};

int main() {
    // Smart pointer usage - automatic memory management
    std::vector<std::unique_ptr<ChromiumComponent>> components;
    
    // Create components using factory
    components.push_back(ComponentFactory::CreateComponent("ui", "MainWindow"));
    components.push_back(ComponentFactory::CreateComponent("network", "HttpClient"));
    components.push_back(ComponentFactory::CreateComponent("storage", "CacheManager"));
    
    // Process all components
    std::cout << "\n--- Processing Components ---\n";
    for (const auto& component : components) {
        component->Process();
    }
    
    // Memory is automatically cleaned up when vector goes out of scope
    std::cout << "\n--- Cleanup ---\n";
    return 0;
}
```

**Learning Points:**
- RAII (Resource Acquisition Is Initialization) principle
- Smart pointers for automatic memory management
- Factory pattern for object creation
- Const correctness in member functions

---

## Chromium-Style Code Patterns

### Observer Pattern Implementation

```cpp
#include <iostream>
#include <vector>
#include <algorithm>
#include <memory>

// Observer pattern - widely used in Chromium for event handling
class Observer {
public:
    virtual ~Observer() = default;
    virtual void OnNotify(const std::string& event) = 0;
};

class Subject {
private:
    std::vector<Observer*> observers_;
    
public:
    void AddObserver(Observer* observer) {
        observers_.push_back(observer);
    }
    
    void RemoveObserver(Observer* observer) {
        observers_.erase(
            std::remove(observers_.begin(), observers_.end(), observer),
            observers_.end()
        );
    }
    
    void NotifyAll(const std::string& event) {
        for (Observer* observer : observers_) {
            observer->OnNotify(event);
        }
    }
};

// Concrete observers
class UIObserver : public Observer {
private:
    std::string name_;
    
public:
    UIObserver(const std::string& name) : name_(name) {}
    
    void OnNotify(const std::string& event) override {
        std::cout << "[UI:" << name_ << "] Received event: " << event << std::endl;
        // Handle UI updates here
    }
};

class NetworkObserver : public Observer {
public:
    void OnNotify(const std::string& event) override {
        std::cout << "[Network] Handling event: " << event << std::endl;
        // Handle network-related events
    }
};

// Example usage
int main() {
    Subject browserEvents;
    
    UIObserver mainWindow("MainWindow");
    UIObserver toolbar("Toolbar");
    NetworkObserver networkManager;
    
    // Register observers
    browserEvents.AddObserver(&mainWindow);
    browserEvents.AddObserver(&toolbar);
    browserEvents.AddObserver(&networkManager);
    
    // Simulate browser events
    std::cout << "=== Browser Events Simulation ===\n";
    browserEvents.NotifyAll("page_load_started");
    browserEvents.NotifyAll("navigation_completed");
    browserEvents.NotifyAll("network_error");
    
    return 0;
}
```

**Chromium Usage:**
- Content API notifications
- UI event propagation
- Browser process communication
- Preference change notifications

---

## C++ Templates and Modern Features

### Template Metaprogramming Example

```cpp
#include <iostream>
#include <type_traits>
#include <string>
#include <vector>

// Template metaprogramming - used extensively in Chromium's base library
template<typename T>
class Optional {
private:
    bool has_value_;
    alignas(T) char storage_[sizeof(T)];
    
public:
    Optional() : has_value_(false) {}
    
    Optional(const T& value) : has_value_(true) {
        new(storage_) T(value);
    }
    
    ~Optional() {
        if (has_value_) {
            reinterpret_cast<T*>(storage_)->~T();
        }
    }
    
    bool has_value() const { return has_value_; }
    
    const T& value() const {
        if (!has_value_) {
            throw std::runtime_error("Optional has no value");
        }
        return *reinterpret_cast<const T*>(storage_);
    }
    
    T value_or(const T& default_value) const {
        return has_value_ ? value() : default_value;
    }
};

// SFINAE (Substitution Failure Is Not An Error) example
template<typename T>
typename std::enable_if<std::is_arithmetic<T>::value, void>::type
PrintValue(const T& value) {
    std::cout << "Numeric value: " << value << std::endl;
}

template<typename T>
typename std::enable_if<!std::is_arithmetic<T>::value, void>::type
PrintValue(const T& value) {
    std::cout << "Non-numeric value: " << value << std::endl;
}

// Variadic templates - used in Chromium's callback system
template<typename... Args>
void LogInfo(const std::string& format, Args&&... args) {
    std::cout << "[INFO] " << format;
    // In real implementation, would format with args
    ((std::cout << " " << args), ...); // C++17 fold expression
    std::cout << std::endl;
}

int main() {
    // Optional usage
    std::cout << "=== Optional Example ===\n";
    Optional<std::string> maybe_name("Chromium");
    Optional<std::string> empty_name;
    
    std::cout << "Has name: " << maybe_name.has_value() << std::endl;
    std::cout << "Name: " << maybe_name.value_or("Unknown") << std::endl;
    std::cout << "Empty name: " << empty_name.value_or("Default") << std::endl;
    
    // SFINAE demonstration
    std::cout << "\n=== SFINAE Example ===\n";
    PrintValue(42);
    PrintValue(std::string("Hello"));
    
    // Variadic templates
    std::cout << "\n=== Variadic Templates ===\n";
    LogInfo("Browser started", "version", "1.0", "build", 12345);
    
    return 0;
}
```

**Modern C++ Features:**
- Perfect forwarding with `std::forward`
- SFINAE for template specialization
- Variadic templates for flexible APIs
- Placement new for custom memory management

---

## Chromium Base Library Patterns

### Callback System Simulation

```cpp
#include <iostream>
#include <functional>
#include <memory>
#include <vector>

// Simplified version of Chromium's callback system
template<typename Signature>
class Callback;

template<typename R, typename... Args>
class Callback<R(Args...)> {
private:
    std::function<R(Args...)> callback_;
    
public:
    Callback() = default;
    
    template<typename F>
    Callback(F&& f) : callback_(std::forward<F>(f)) {}
    
    R Run(Args... args) const {
        if (callback_) {
            return callback_(args...);
        }
        if constexpr (!std::is_void_v<R>) {
            return R{};
        }
    }
    
    bool is_null() const { return !callback_; }
    
    explicit operator bool() const { return !is_null(); }
};

// Factory functions for creating callbacks
template<typename F>
auto BindOnce(F&& f) {
    return Callback<std::invoke_result_t<F>()>{std::forward<F>(f)};
}

template<typename F, typename... Args>
auto BindOnce(F&& f, Args&&... args) {
    return [f = std::forward<F>(f), args...](auto&&... remaining_args) {
        return f(args..., remaining_args...);
    };
}

// Example usage in a hypothetical browser component
class NetworkRequest {
private:
    std::string url_;
    Callback<void(int, const std::string&)> completion_callback_;
    
public:
    NetworkRequest(const std::string& url) : url_(url) {}
    
    void SetCompletionCallback(Callback<void(int, const std::string&)> callback) {
        completion_callback_ = std::move(callback);
    }
    
    void Start() {
        std::cout << "Starting request to: " << url_ << std::endl;
        
        // Simulate async operation
        // In real code, this would be asynchronous
        int status_code = 200;
        std::string response = "Response data from " + url_;
        
        if (completion_callback_) {
            completion_callback_.Run(status_code, response);
        }
    }
};

// Response handler
void HandleResponse(const std::string& context, int status, const std::string& data) {
    std::cout << "[" << context << "] Status: " << status 
              << ", Data: " << data << std::endl;
}

int main() {
    std::cout << "=== Chromium-Style Callback System ===\n";
    
    NetworkRequest request("https://example.com/api/data");
    
    // Bind callback with context
    auto callback = BindOnce(&HandleResponse, "MainFrame");
    request.SetCompletionCallback(
        Callback<void(int, const std::string&)>{callback}
    );
    
    request.Start();
    
    // Lambda callback example
    std::cout << "\n=== Lambda Callback ===\n";
    NetworkRequest request2("https://api.example.com/users");
    request2.SetCompletionCallback(
        Callback<void(int, const std::string&)>{
            [](int status, const std::string& data) {
                std::cout << "Lambda handler - Status: " << status 
                          << ", Data length: " << data.length() << std::endl;
            }
        }
    );
    
    request2.Start();
    
    return 0;
}
```

**Key Concepts:**
- Type erasure with `std::function`
- Perfect forwarding for efficient parameter passing
- RAII for automatic resource management
- Callback binding for asynchronous operations

---

## Learning Exercises

### Exercise 1: Implement a Simple Chrome-style Process Manager

```cpp
#include <iostream>
#include <map>
#include <memory>
#include <string>

// TODO: Implement a ProcessManager that can:
// 1. Create and track different types of processes (renderer, gpu, network)
// 2. Monitor process health
// 3. Handle process crashes gracefully

enum class ProcessType {
    BROWSER,
    RENDERER,
    GPU,
    NETWORK
};

class Process {
private:
    int pid_;
    ProcessType type_;
    bool is_running_;
    
public:
    Process(int pid, ProcessType type) 
        : pid_(pid), type_(type), is_running_(true) {}
    
    // TODO: Add methods for:
    // - GetPID()
    // - GetType()
    // - IsRunning()
    // - Terminate()
    // - GetMemoryUsage()
};

class ProcessManager {
private:
    std::map<int, std::unique_ptr<Process>> processes_;
    
public:
    // TODO: Implement these methods:
    // - CreateProcess(ProcessType type)
    // - KillProcess(int pid)
    // - GetProcessCount()
    // - GetProcessesByType(ProcessType type)
    // - HandleProcessCrash(int pid)
};

int main() {
    ProcessManager manager;
    
    // TODO: Test your implementation
    // Create processes, simulate crashes, clean up resources
    
    return 0;
}
```

### Exercise 2: Implement Chrome's WeakPtr Pattern

```cpp
#include <iostream>
#include <memory>

// TODO: Implement a WeakPtr system similar to Chromium's
// WeakPtr is used to safely reference objects that might be deleted

template<typename T>
class WeakPtr;

template<typename T>
class WeakPtrFactory {
    // TODO: Implement factory for creating weak pointers
    // Should invalidate all weak pointers when destroyed
};

template<typename T>
class WeakPtr {
    // TODO: Implement weak pointer that:
    // - Can safely check if object still exists
    // - Returns nullptr if object was deleted
    // - Can be used like a regular pointer when valid
};

// Test class
class BrowserWindow {
private:
    WeakPtrFactory<BrowserWindow> weak_factory_{this};
    
public:
    WeakPtr<BrowserWindow> GetWeakPtr() {
        return weak_factory_.GetWeakPtr();
    }
    
    void DoSomething() {
        std::cout << "BrowserWindow is doing something\n";
    }
};

int main() {
    // TODO: Test weak pointer behavior
    // Create window, get weak ptr, delete window, test weak ptr
    
    return 0;
}
```

---

## Next Steps

Ready to dive deeper into Chromium development? Here are some areas to explore:

1. **Content API**: Learn the public interface for embedding Chromium
2. **Mojo IPC**: Understand inter-process communication
3. **V8 Integration**: JavaScript engine integration patterns
4. **Blink Rendering**: How web content gets rendered
5. **Network Stack**: HTTP/HTTPS handling and caching

The code playground helps you understand these concepts before diving into the actual Chromium codebase!
