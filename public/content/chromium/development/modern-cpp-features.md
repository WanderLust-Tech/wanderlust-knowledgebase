# Modern C++ Features in Chromium

## Table of Contents
1. [Overview](#overview)
2. [C++ Standards Support](#c-standards-support)
3. [Feature Categories](#feature-categories)
4. [C++11 Guidelines](#c11-guidelines)
5. [C++14 Guidelines](#c14-guidelines)
6. [C++17 Guidelines](#c17-guidelines)
7. [Abseil Library Guidelines](#abseil-library-guidelines)
8. [Chromium-Specific Alternatives](#chromium-specific-alternatives)
9. [Best Practices](#best-practices)
10. [Migration Guidelines](#migration-guidelines)
11. [Related Documentation](#related-documentation)

## Overview

This document is part of the Chromium C++ style guide and summarizes the supported state of new and updated language and library features in recent C++ standards and the Abseil library. It provides comprehensive guidance on which modern C++ features are allowed, banned, or under review in the Chromium codebase.

### Approval Process

The C++ language receives updated standards every three years (C++11, C++14, C++17, etc.). Chromium does not immediately allow new features upon publication. Instead, once Chromium supports the toolchain to a certain extent, a standard is declared "initially supported," with new features requiring explicit approval.

**Feature Status Categories:**
- **✅ Allowed**: Safe to use in Chromium codebase
- **❌ Banned**: Explicitly prohibited with reasons
- **⏳ TBD (To Be Determined)**: Under review, not yet approved

### Proposing Changes

To propose changing a feature's status:
1. Send email to [cxx@chromium.org](https://groups.google.com/a/chromium.org/forum/#!forum/cxx)
2. Include feature description and reasoning
3. Link to relevant previous discussions
4. Submit code review if consensus is reached

## C++ Standards Support

### Current Status Summary

| Standard | Status | Notes |
|----------|--------|-------|
| **C++11** | ✅ Default allowed | See banned features below |
| **C++14** | ✅ Default allowed | See banned features below |
| **C++17** | ⏳ Initially supported | December 23, 2021 - individual features under review |
| **C++20** | ❌ Not yet supported | Toolchain support pending |
| **C++23** | ❌ Not standardized | Future consideration |

### Abseil Library Support

| Component | Status | Initial Support Date |
|-----------|--------|---------------------|
| **Core Abseil** | ✅ Default allowed | See specific restrictions |
| **AnyInvocable** | ⏳ Under review | June 20, 2022 |
| **Log library** | ⏳ Under review | August 31, 2022 |
| **CRC32C library** | ⏳ Under review | December 5, 2022 |

## Feature Categories

### Security and Safety Considerations

Modern C++ features are evaluated based on:

- **Memory Safety**: Prevention of use-after-free, buffer overflows
- **Type Safety**: Compile-time type checking and validation
- **Exception Safety**: Compatibility with Chromium's no-exceptions policy
- **Performance Impact**: Runtime overhead and compilation time
- **Toolchain Support**: Cross-platform compiler compatibility

## C++11 Guidelines

### ❌ Banned Language Features

#### Inline Namespaces
```cpp
// ❌ BANNED
inline namespace foo { ... }
```
**Reason**: Unclear interaction with Chromium's component system. Banned in Google Style Guide.

#### User-Defined Literals
```cpp
// ❌ BANNED
auto duration = 42s;  // std::chrono literals
auto distance = 3.14_km;  // Custom literals
```
**Reason**: Can make code less readable and create naming conflicts.

#### thread_local Storage Class
```cpp
// ❌ BANNED
thread_local int counter = 0;
```
**Reason**: Surprising effects on macOS. Use Chromium alternatives instead.

**✅ Alternatives:**
- `base::SequenceLocalStorageSlot` for sequence-local storage
- `base::ThreadLocal` / `base::ThreadLocalStorage` for thread-local storage

### ❌ Banned Library Features

#### Bind Operations
```cpp
// ❌ BANNED
std::bind(&Class::method, instance, std::placeholders::_1)
```
**✅ Alternative:** Use lambdas or `base::BindOnce` / `base::BindRepeating`

#### std::function
```cpp
// ❌ BANNED
std::function<int(int)> callback;
```
**✅ Alternative:** Use `base::OnceCallback` / `base::RepeatingCallback`

#### Random Number Generation
```cpp
// ❌ BANNED
std::random_device rd;
std::mt19937 gen(rd());
```
**✅ Alternative:** Use `base/rand_util.h` for cryptographically secure random generation

#### Regular Expressions
```cpp
// ❌ BANNED
#include <regex>
std::regex pattern("\\d+");
```
**✅ Alternative:** Use `re2` library when regular expressions are needed

#### Shared/Weak Pointers
```cpp
// ❌ BANNED
std::shared_ptr<Object> shared;
std::weak_ptr<Object> weak;
```
**✅ Alternatives:**
- `base::WeakPtr` for weak references
- Raw pointers with proper lifetime management
- Smart pointer alternatives from `base/memory/`

#### String-Number Conversions
```cpp
// ❌ BANNED
int value = std::stoi(str);
std::string text = std::to_string(42);
```
**Reason**: Exception-based error handling and locale dependencies.

**✅ Alternative:** Use `base/strings/string_number_conversions.h`

#### Thread Library
```cpp
// ❌ BANNED
#include <thread>
#include <mutex>
#include <condition_variable>
std::thread worker;
```
**✅ Alternative:** Use `base/` threading classes (`base::Thread`, `base::Lock`, etc.)

## C++14 Guidelines

### ❌ Banned Library Features

#### std::chrono literals
```cpp
// ❌ BANNED
using namespace std::chrono_literals;
auto timeout = 30s;
auto delay = 500ms;
```
**Reason**: `<chrono>` library is banned in Chromium.

## C++17 Guidelines

### ✅ Allowed Language Features

#### Nested Namespaces
```cpp
// ✅ ALLOWED
namespace chromium::base::internal {
    // Implementation details
}
```

#### Template Argument Deduction for Class Templates
```cpp
// ✅ ALLOWED
std::vector values{1, 2, 3, 4, 5};  // Deduced as std::vector<int>
std::pair coordinate{3.14, 2.71};   // Deduced as std::pair<double, double>
```

#### Fold Expressions
```cpp
// ✅ ALLOWED
template <typename... Args>
auto sum(Args... args) {
    return (... + args);  // Fold expression
}

template <typename... Args>
void print_all(Args... args) {
    ((std::cout << args << " "), ...);
}
```

#### Selection Statements with Initializer
```cpp
// ✅ ALLOWED
if (auto result = TryOperation(); result.has_value()) {
    return result.value();
}

switch (auto status = GetStatus(); status) {
    case Status::kOk:
        break;
    // ...
}
```

#### Attributes
```cpp
// ✅ ALLOWED
[[fallthrough]]  // Explicit fallthrough in switch
[[nodiscard]]    // Must use return value
[[maybe_unused]] // Suppress unused warnings
```

#### constexpr if
```cpp
// ✅ ALLOWED
template<typename T>
void process(T value) {
    if constexpr (std::is_integral_v<T>) {
        // Integer-specific logic
    } else {
        // Non-integer logic
    }
}
```

### ✅ Allowed Library Features

#### std::string_view
```cpp
// ✅ ALLOWED
void ProcessString(std::string_view text) {
    // Efficient string processing without copying
}
```

#### Structured Bindings
```cpp
// ✅ ALLOWED
auto [key, value] = map.find(search_key);
auto [x, y, z] = GetCoordinates();
```

### ❌ Banned Library Features

#### std::optional
```cpp
// ❌ BANNED
std::optional<int> maybe_value;
```
**Reason**: Safety concerns with misuse.
**✅ Alternative:** Use `absl::optional`

#### std::variant
```cpp
// ❌ BANNED
std::variant<int, std::string> data;
```
**Reason**: Safety concerns with misuse.
**✅ Alternative:** Use `absl::variant`

#### std::any
```cpp
// ❌ BANNED
std::any container;
```
**Reason**: Type safety concerns.

#### Parallel Algorithms
```cpp
// ❌ BANNED
std::sort(std::execution::par, vec.begin(), vec.end());
```
**Reason**: Exceptions required for error handling.

### ⏳ TBD (Under Review) Language Features

#### Non-type Template Parameters with auto
```cpp
// ⏳ TBD
template <auto Value>
struct ConstantHolder {
    static constexpr auto value = Value;
};
```

#### Structured Bindings in Declarations
```cpp
// ⏳ TBD  
for (auto [key, value] : map) {
    // Process key-value pairs
}
```

## Abseil Library Guidelines

### ✅ Allowed Features

#### Core Utilities
```cpp
// ✅ ALLOWED
#include "absl/base/macros.h"
#include "absl/meta/type_traits.h"

ABSL_ARRAYSIZE(array)
absl::make_unique<Type>(args...)
```

#### Optional and Variant
```cpp
// ✅ ALLOWED (Abseil versions)
absl::optional<int> maybe_value;
absl::variant<int, std::string> data;
```

### ❌ Banned Abseil Features

#### Random Number Generation
```cpp
// ❌ BANNED
absl::BitGen generator;
```
**Reason:** Use cryptographically secure generators from `base/rand_util.h`

#### Span
```cpp
// ❌ BANNED
absl::Span<int> data_view;
```
**✅ Alternative:** Use `base::span` (more std::-compliant)

#### StatusOr
```cpp
// ❌ BANNED
absl::StatusOr<Result> operation_result;
```
**✅ Alternative:** Use `base::expected`

#### String Utilities
```cpp
// ❌ BANNED
absl::StrSplit(text, ",");
absl::StrJoin(parts, ",");
absl::StrCat(a, b, c);
```
**Reason:** Overlap with `base/strings/` functionality

#### String Formatting
```cpp
// ❌ BANNED
absl::StrFormat("Value: %d", number);
```
**✅ Alternative:** Use `base::StringPrintf()`

#### Synchronization
```cpp
// ❌ BANNED
absl::Mutex mutex;
absl::MutexLock lock(&mutex);
```
**✅ Alternative:** Use `base/synchronization/` primitives

#### Time Library
```cpp
// ❌ BANNED
absl::Duration timeout = absl::Seconds(30);
absl::Time now = absl::Now();
```
**✅ Alternative:** Use `base/time/` classes

## Chromium-Specific Alternatives

### Memory Management
```cpp
// Chromium's memory management
#include "base/memory/scoped_refptr.h"
#include "base/memory/weak_ptr.h"
#include "base/memory/raw_ptr.h"

scoped_refptr<RefCountedType> ref_counted;
base::WeakPtr<Object> weak_ref;
raw_ptr<Object> safe_raw_ptr;  // Safer than raw pointers
```

### Containers
```cpp
// Chromium's enhanced containers
#include "base/containers/flat_map.h"
#include "base/containers/flat_set.h"
#include "base/containers/span.h"

base::flat_map<Key, Value> efficient_map;
base::flat_set<Key> efficient_set;
base::span<const int> array_view;
```

### Threading and Synchronization
```cpp
// Chromium's threading model
#include "base/threading/thread.h"
#include "base/synchronization/lock.h"
#include "base/task/thread_pool.h"

base::Thread worker_thread("WorkerThread");
base::Lock mutex;
base::ThreadPool::PostTask(FROM_HERE, base::BindOnce(&Function));
```

### Functional Programming
```cpp
// Chromium's callback system
#include "base/functional/bind.h"
#include "base/functional/callback.h"

base::OnceCallback<void()> one_time_callback = 
    base::BindOnce(&Class::Method, base::Unretained(object));

base::RepeatingCallback<int(int)> repeating_callback = 
    base::BindRepeating([](int x) { return x * 2; });
```

## Best Practices

### 1. Prefer Chromium Base Libraries
When both std:: and base:: alternatives exist, prefer base:: for:
- Better integration with Chromium's architecture
- Enhanced safety features
- Consistent error handling
- Cross-platform compatibility

### 2. Safety-First Approach
```cpp
// ✅ Good: Safe memory management
auto weak_ptr = object->AsWeakPtr();
if (weak_ptr) {
    weak_ptr->Method();
}

// ❌ Avoid: Raw pointer without lifetime validation
object->Method();  // Potential use-after-free
```

### 3. Exception-Free Design
```cpp
// ✅ Good: Error handling without exceptions
base::expected<Result, Error> TryOperation() {
    if (precondition_failed) {
        return base::unexpected(Error::kPreconditionFailed);
    }
    return Result{};
}

// ❌ Avoid: Exception-based error handling
Result Operation() {
    if (precondition_failed) {
        throw std::runtime_error("Precondition failed");  // Banned
    }
    return Result{};
}
```

### 4. Modern C++ Idioms (Where Allowed)
```cpp
// ✅ Good: Modern C++ with Chromium conventions
class DataProcessor {
 public:
    explicit DataProcessor(std::string_view config) : config_(config) {}
    
    template<typename... Args>
    void ProcessMultiple(Args&&... args) {
        (ProcessSingle(std::forward<Args>(args)), ...);  // Fold expression
    }
    
 private:
    std::string config_;
};
```

## Migration Guidelines

### From Legacy C++ to Modern C++

#### 1. Auto Type Deduction
```cpp
// Old style
std::map<std::string, std::vector<int>>::iterator it = container.find(key);

// ✅ Modern style
auto it = container.find(key);
```

#### 2. Range-Based Loops
```cpp
// Old style
for (std::vector<Item>::const_iterator it = items.begin(); 
     it != items.end(); ++it) {
    ProcessItem(*it);
}

// ✅ Modern style  
for (const auto& item : items) {
    ProcessItem(item);
}
```

#### 3. Lambda Expressions
```cpp
// Old style with functors
class Comparator {
 public:
    bool operator()(const Item& a, const Item& b) const {
        return a.priority() > b.priority();
    }
};
std::sort(items.begin(), items.end(), Comparator{});

// ✅ Modern style with lambdas
std::sort(items.begin(), items.end(), 
    [](const Item& a, const Item& b) {
        return a.priority() > b.priority();
    });
```

#### 4. Smart Pointers
```cpp
// Old style
void Function() {
    Object* obj = new Object();
    // ... use obj
    delete obj;  // Error-prone
}

// ✅ Modern style
void Function() {
    auto obj = std::make_unique<Object>();
    // ... use obj
    // Automatic cleanup
}
```

### From std:: to base:: Alternatives

#### 1. Optional Values
```cpp
// Replace std::optional with absl::optional or base::expected
// Old: std::optional<int> maybe_value;
absl::optional<int> maybe_value;

// Or for error handling:
base::expected<int, ErrorType> result_value;
```

#### 2. String Processing
```cpp
// Replace std::string functions with base/strings/
// Old: std::to_string(number)
base::NumberToString(number);

// Old: std::stoi(str)  
int result;
base::StringToInt(str, &result);
```

## Related Documentation

### Core C++ Guidelines
- [Chromium C++ Style Guide](https://chromium.googlesource.com/chromium/src/+/main/styleguide/c++/c++.md) - Complete style guide
- [Google C++ Style Guide](https://google.github.io/styleguide/cppguide.html) - Upstream style guide

### Chromium Base Library
- [Base Library Overview](../architecture/browser-components.md) - Core Chromium utilities
- [Smart Pointer Implementation](smart-pointer-implementation.md) - Memory management patterns

### Development Tools
- [Clang Format](clang_format.md) - Automated code formatting
- [Clang Tidy](clang_tidy.md) - Static analysis for modern C++
- [Code Reviews](code_reviews.md) - Review process for C++ changes

### Language Alternatives
- [Rust in Chromium](rust.md) - Using Rust in Chromium
- [Rust Unsafe Guidelines](rust-unsafe.md) - Memory safety considerations

### Testing and Quality
- [Testing in Chromium](testing/testing_in_chromium.md) - C++ testing best practices
- [Code Coverage](testing/code_coverage.md) - Measuring test effectiveness

---

## Quick Reference

### Feature Status Lookup

| Feature | C++11 | C++14 | C++17 | Alternative |
|---------|--------|--------|--------|------------|
| `auto` type deduction | ✅ | ✅ | ✅ | - |
| Range-based loops | ✅ | ✅ | ✅ | - |
| Lambda expressions | ✅ | ✅ | ✅ | - |
| `std::function` | ❌ | ❌ | ❌ | `base::RepeatingCallback` |
| `std::bind` | ❌ | ❌ | ❌ | lambdas, `base::BindRepeating` |
| `std::shared_ptr` | ❌ | ❌ | ❌ | `scoped_refptr`, `base::WeakPtr` |
| `std::optional` | - | - | ❌ | `absl::optional` |
| `std::variant` | - | - | ❌ | `absl::variant` |
| `std::string_view` | - | - | ✅ | - |
| Structured bindings | - | - | ✅ | - |
| `if constexpr` | - | - | ✅ | - |
| Fold expressions | - | - | ✅ | - |

Remember: When in doubt, prefer Chromium base:: alternatives for better integration and safety.