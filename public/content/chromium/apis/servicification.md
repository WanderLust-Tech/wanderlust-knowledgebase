# Servicifying Chromium Features (v134+)

## Overview

Much to the dismay of Chromium developers, practicing linguists, and keyboard
operators everywhere, the term **servicificificification** [sic] has been
egregiously smuggled into the Chromium parlance.

Lots of Chromium code is contained in reasonably well-isolated component
libraries with some occasionally fuzzy boundaries and often a surprising number
of gnarly runtime interdependencies among a complex graph of components. Y
implements one of Z's delegate interfaces, while X implements one of Y's
delegate interfaces, and now it's possible for some ridiculous bug to creep in
where W calls into Z at the wrong time and causes a crash in X. Yikes.

Servicification embodies the ongoing process of **servicifying** Chromium
features and subsystems, or refactoring these collections of library code into
services with well-defined public API boundaries and very strong runtime
isolation via Mojo interfaces.

**Note for v134+**: As of Chromium v134, most major subsystems have been servicified.
New servicification efforts should focus on remaining components that would benefit
from isolation, testing improvements, or multi-process architecture flexibility.

The primary goals are to improve maintainability and extensibility of the system
over time, while also allowing for more flexible runtime configuration. For
example, with the Network Service in place we can now run the entire network
stack either inside or outside of the browser process with the flip of a
command-line switch. Client code using the Network Service stays the same,
independent of that switch.

This document focuses on helpful guidelines and patterns for servicifying parts
of Chromium.

Also see general [Mojo & Services](mojo_and_services.md)
documentation for other introductory guides, API references, *etc.*

## Setting Up The Service

This section briefly covers early decisions and implementation concerns when
introducing a new service.

### Where in the Tree?

Based on the
[service development guidelines](https://source.chromium.org/chromium/chromium/src/+/main:services/README.md;drc=main), any service which could
be reasonably justified as a core system service in a hypothetical,
well-designed operating system may belong in the top-level `//services`
directory. If that sounds super hand-wavy and unclear, that's because it is!
There isn't really a great universal policy here, so when in doubt, contact your
favorite local
[services-dev@chromium.org](https://groups.google.com/a/chromium.org/forum#!forum/services-dev)
mailing list and start a friendly discussion.

**Modern Guidelines (v134+)**: Consider these factors when choosing location:
- **Security isolation requirements**: High-risk code should be in separate processes
- **Resource constraints**: Services with heavy resource usage should be isolatable
- **Testing complexity**: Services are easier to test in isolation
- **API stability**: Well-defined APIs are candidates for `//services`
mailing list and start a friendly discussion.

Other common places where developers place services, and why:

- `//components/services` for services which haven't yet made the cut for
  `//services` but which are either used by Content directly or by multiple
  Content embedders.
- `//chrome/services` for services which are used exclusively within Chrome and
  not shared with other Content embedders.
- `//chromeos/services` for services which are used on Chrome OS by more than
  just Chrome itself (for example, if the `ash` service must also connect to
  them for use in system UI).

### Launching Service Processes

Content provides a simple
[`ServiceProcessHost`](https://source.chromium.org/chromium/chromium/src/+/main:content/public/browser/service_process_host.h;drc=main)
API to launch a new Service Process. The Mojo Remote corresponding to each
process launch is effectively a lifetime control for the launched process.

**Modern Pattern (v134+)**: Use `ServiceProcessHost::Launch` with proper error handling:

```cpp
// Modern service launching pattern
auto service_remote = content::ServiceProcessHost::Launch<mojom::MyService>(
    content::ServiceProcessHost::Options()
        .WithDisplayName("My Service")
        .WithSandboxType(sandbox::mojom::Sandbox::kService)
        .Pass());

service_remote.set_disconnect_handler(
    base::BindOnce(&MyServiceClient::OnServiceDisconnected,
                   weak_ptr_factory_.GetWeakPtr()));
```

You may choose to maintain only a single concurrent instance of your service
at a time, similar to the Network or Storage services. In this case, typically
you will have some browser code maintain a lazy Mojo Remote to the service
process, and any clients of the service will have their connections brokered
through this interface.

In other cases you may want to manage multiple independent service processes.
The Data Decoder service, for example, allows for arbitrary browser code
to launch a unique isolated instance to process a single decode operation or
a batch of related operations (e.g. to decode a bunch of different objects
from the same untrusted origin).

Insofar as the browser can use ServiceProcessLauncher however it likes, and the
corresponding Mojo Remotes can be owned just like any other object, developers
are free to manage their service instances however they like.

### Hooking Up the Service Implementation

For out-of-process service launching, Content uses its "utility" process type.

For services known to content, this is accomplished by adding an appropriate
factory function to
[`//content/utility/services.cc`](https://source.chromium.org/chromium/chromium/src/+/main:content/utility/services.cc;drc=main)

For other services known only to Chrome, we have a similar file at
[`//chrome/utility/services.cc`](https://source.chromium.org/chromium/chromium/src/+/main:chrome/utility/services.cc;drc=main).

**Modern Registration Pattern (v134+)**:

```cpp
// In content/utility/services.cc or chrome/utility/services.cc
void RegisterMyService(mojo::PendingReceiver<mojom::MyService> receiver) {
  static base::NoDestructor<std::unique_ptr<MyServiceImpl>> service;
  if (!*service) {
    *service = std::make_unique<MyServiceImpl>();
  }
  (*service)->BindReceiver(std::move(receiver));
}

// Register in the service map
auto RunMyService(mojo::PendingReceiver<mojom::MyService> receiver) {
  return std::make_unique<MyServiceImpl>(std::move(receiver));
}
```

Once an appropriate service factory is registered for your main service
interface in one of these places, `ServiceProcessHost::Launch` can be used to
acquire a new isolated instance from within the browser process.

To run a service in-process, you can simply instantiate your service
implementation (e.g. on a background thread) like you would any other object,
and you can then bind a Mojo Remote which is connected to that instance.

This is useful if you want to avoid the overhead of extra processes in some
scenarios, and it allows the detail of where and how the service runs to be
fully hidden behind management of the main interface's Mojo Remote.

## Modern Service Architecture (v134+)

### Service Lifecycle Management

Modern services should implement proper lifecycle management:

```cpp
class MyServiceImpl : public mojom::MyService {
 public:
  explicit MyServiceImpl(mojo::PendingReceiver<mojom::MyService> receiver)
      : receiver_(this, std::move(receiver)) {
    receiver_.set_disconnect_handler(
        base::BindOnce(&MyServiceImpl::OnDisconnected, 
                       base::Unretained(this)));
  }

  ~MyServiceImpl() override = default;

  // mojom::MyService implementation
  void DoWork(const std::string& data, DoWorkCallback callback) override {
    // Implementation here
    std::move(callback).Run(ProcessData(data));
  }

 private:
  void OnDisconnected() {
    // Clean up resources
    // Service will be destroyed when this returns
  }

  mojo::Receiver<mojom::MyService> receiver_;
};
```

### Error Handling Patterns

Modern services should handle errors gracefully:

```cpp
void MyServiceImpl::ProcessRequest(ProcessRequestCallback callback) {
  if (!IsValidState()) {
    std::move(callback).Run(
        mojom::Result::NewError("Service in invalid state"));
    return;
  }

  // Process request...
  auto result = DoProcessing();
  if (result.has_value()) {
    std::move(callback).Run(mojom::Result::NewSuccess(result.value()));
  } else {
    std::move(callback).Run(
        mojom::Result::NewError("Processing failed"));
  }
}
```

### Security Considerations

- **Sandboxing**: All services should run in appropriate sandboxes
- **Input validation**: Validate all inputs at service boundaries
- **Capability-based access**: Limit service capabilities to minimum required
- **Process isolation**: Consider whether the service needs its own process

## Incremental Servicification

For large Chromium features it is not feasible to convert an entire subsystem
to a service all at once. As a result, it may be necessary for the subsystem
to spend a considerable amount of time (weeks or months) split between the old
implementation and your beautiful, sparkling new service implementation.

In creating your service, you likely have two goals:

- Making the service available to its consumers
- Making the service self-contained

Those two goals are not the same, and to some extent are at tension:

- To satisfy the first, you need to build out the API surface of the service to
  a sufficient degree for the anticipated use cases.

- To satisfy the second, you need to convert all clients of the code that you
  are servicifying to instead use the service, and then fold that code into the
  internal implementation of the service.

Whatever your goals, you will need to proceed incrementally if your project is
at all non-trivial (as they basically all are given the nature of the effort).
You should explicitly decide what your approach to incremental bringup and
conversion will be. Here are some approaches that have been taken for various
services:

- Build out your service depending directly on existing code,
  convert the clients of that code 1-by-1, and fold the existing code into the
  service implementation when complete. **Note**: Some legacy service designs used this pattern.
- Build out the service with new code and make the existing code
  into a client library of the service. In that fashion, all consumers of the
  existing code get converted transparently. **Note**: This pattern is less common in v134+.
- Build out the new service piece-by-piece by picking a given
  bite-size piece of functionality and entirely servicifying that functionality.
  **Recommended for v134+**: This approach ensures clean API boundaries from the start.

These all have tradeoffs:

- The first lets you incrementally validate your API and implementation, but
  leaves the service depending on external code for a long period of time.
- The second can create a self-contained service more quickly, but leaves
  all the existing clients in place as potential cleanup work.
- The third ensures that you're being honest as you go, but delays having
  the breadth of the service API up and going.

Which makes sense depends both on the nature of the existing code and on
the priorities for doing the servicification. The first two enable making the
service available for new use cases sooner at the cost of leaving legacy code in
place longer, while the last is most suitable when you want to be very exacting
about doing the servicification cleanly as you go.

## Platform-Specific Issues: Android

As you servicify code running on Android, you might find that you need to port
interfaces that are served in Java. Here are modern patterns for handling this:

### JNI Integration in Services (v134+)

```cpp
// Modern JNI registration pattern
// service_jni_registrar.cc
#include "base/android/jni_registrar.h"
#include "my_service_jni_headers/MyServiceJni_jni.h"

namespace my_service {

bool RegisterJni(JNIEnv* env) {
  return base::android::RegisterNativeMethods(
      env, my_service::kMyServiceRegisteredMethods,
      my_service::kMyServiceRegisteredMethodsSize);
}

}  // namespace my_service
```

### Android Context Handling

Modern services should handle Android contexts through dependency injection:

```cpp
class AndroidServiceImpl : public mojom::AndroidService {
 public:
  explicit AndroidServiceImpl(
      mojo::PendingReceiver<mojom::AndroidService> receiver,
      base::android::ScopedJavaGlobalRef<jobject> context)
      : receiver_(this, std::move(receiver)),
        java_context_(std::move(context)) {}

 private:
  mojo::Receiver<mojom::AndroidService> receiver_;
  base::android::ScopedJavaGlobalRef<jobject> java_context_;
};
```

Finally, it is possible that your feature will have coupling to UI process state
(e.g., the Activity) via Android system APIs. To handle this challenging
issue, see the section on [Coupling to UI](#Coupling-to-UI).

## Platform-Specific Issues: iOS

*** aside
**Note for v134+:** iOS support for services has matured. All services run 
in-process on iOS due to platform constraints, but the same Mojo interfaces
work seamlessly across platforms.
***

Services are fully supported on iOS. However, Chrome on
iOS is strictly single-process, and all services thus must run in-process on
iOS. This is handled automatically by the service infrastructure.

Modern iOS service patterns:

```cpp
// iOS-specific service considerations
class MyServiceImpl : public mojom::MyService {
 public:
  explicit MyServiceImpl(mojo::PendingReceiver<mojom::MyService> receiver)
      : receiver_(this, std::move(receiver)) {
#if BUILDFLAG(IS_IOS)
    // iOS-specific initialization
    ConfigureForIOS();
#endif
  }

 private:
#if BUILDFLAG(IS_IOS)
  void ConfigureForIOS() {
    // Handle iOS-specific requirements
  }
#endif
  
  mojo::Receiver<mojom::MyService> receiver_;
};
```

## Client-Specific Issues

#### Mocking Interface Impls in JS
It is a common pattern in Blink's web tests to mock a remote Mojo interface
in JS so that native Blink code requests interfaces from the test JS rather
than whatever would normally service them in the browser process.

The current way to set up that sort of thing uses modern Web Platform Tests (WPT) infrastructure:

```javascript
// Modern mock pattern for web tests
import {MyServiceReceiver} from '/gen/my_service.mojom.m.js';

class MockMyService {
  constructor() {
    this.receiver_ = new MyServiceReceiver(this);
    this.interceptor_ = new MojoInterfaceInterceptor(MyService.$interfaceName);
    this.interceptor_.oninterfacerequest = e => {
      this.receiver_.$.bindHandle(e.handle);
    };
    this.interceptor_.start();
  }

  // Implement service methods
  async doWork(data) {
    return {result: 'mocked_result'};
  }

  reset() {
    this.interceptor_.stop();
  }
}
```

#### Feature Impls That Depend on Blink Headers
In the course of servicifying a feature that has Blink as a client, you might
encounter cases where the feature implementation has dependencies on Blink
public headers (e.g., defining POD structs that are used both by the client and
by the feature implementation). These dependencies pose a challenge:

- Services should not depend on Blink, as this is a dependency inversion (Blink
is a client of services).
- However, Blink is very careful about accepting dependencies from Chromium.

To meet this challenge, you have these options:

1. **Move the code to mojom** (e.g., if it is simple structs) - Preferred for v134+
2. **Use shared common libraries** that both Blink and the service can depend on
3. Move the code into the service's C++ client library, being very explicit
   about its usage by Blink.

**Modern Pattern (v134+)**:
```cpp
// Preferred: Define in mojom
module my_service.mojom;

struct SharedDataStructure {
  string name;
  int32 value;
  array<uint8> data;
};

interface MyService {
  ProcessData(SharedDataStructure data) => (bool success);
};
```

#### Frame-Scoped Connections
You must think carefully about the scoping of the connection being made
from Blink. In particular, some feature requests are necessarily scoped to a
frame in the context of Blink (e.g., geolocation, where permission to access the
interface is origin-scoped). Servicifying these features is then challenging, as
Blink has no frame-scoped connection to arbitrary services (by design, as
arbitrary services have no knowledge of frames or even a notion of what a frame
is).

After a
[long discussion](https://groups.google.com/a/chromium.org/forum/#!topic/services-dev/CSnDUjthAuw),
the policy that we have adopted for this challenge is the following:

**CURRENT (v134+) BEST PRACTICE:**

- The renderer makes a request through its frame-scoped connection to the
  browser (using `BrowserInterfaceBroker`).
- The browser validates permissions and origin constraints.
- The browser forwards the request to the underlying service, optionally
  including validated context information.

**Modern Implementation Pattern:**

```cpp
// In the browser process
void RenderFrameHostImpl::CreateMyService(
    mojo::PendingReceiver<mojom::MyService> receiver) {
  // Validate permissions for this frame/origin
  if (!IsAllowedForOrigin(GetLastCommittedOrigin())) {
    return;  // Reject the request
  }

  // Forward to the actual service with context
  GetMyService()->CreateFrameScopedInterface(
      std::move(receiver), 
      GetGlobalFrameRoutingId(),
      GetLastCommittedOrigin());
}
```

Notably, from the renderer's POV essentially nothing changes here.

## Strategies for Challenges to Decoupling from //content

### Coupling to UI

Some feature implementations have hard constraints on coupling to UI on various
platforms. An example is NFC on Android, which requires the Activity of the view
in which the requesting client is hosted in order to access the NFC platform
APIs. This coupling is at odds with the vision of servicification, which is to
make the service physically isolatable. However, when it occurs, we need to
accommodate it.

The high-level decision that we have reached is to scope the coupling to the
feature *and* platform in question (rather than e.g. introducing a
general-purpose FooServiceDelegate), in order to make it completely explicit
what requires the coupling and to avoid the coupling creeping in scope.

The basic strategy to support this coupling while still servicifying the feature
in question is to inject a mechanism of mapping from an opaque "context ID" to
the required context. The embedder (e.g., //content) maintains this map, and the
service makes use of it. The embedder also serves as an intermediary: it
provides a connection that is appropriately context-scoped to clients. When
clients request the feature in question, the embedder forwards the request on
along with the appropriate context ID. The service impl can then map that
context ID back to the needed context on-demand using the mapping functionality
injected into the service impl.

**Modern Context Injection Pattern (v134+)**:

```cpp
// Service interface with context support
interface MyService {
  SetContextProvider(pending_remote<ContextProvider> provider);
  DoWorkWithContext(int32 context_id, string data) => (bool success);
};

// Implementation
class MyServiceImpl : public mojom::MyService {
 public:
  void SetContextProvider(
      mojo::PendingRemote<mojom::ContextProvider> provider) override {
    context_provider_.Bind(std::move(provider));
  }

  void DoWorkWithContext(int32 context_id, const std::string& data,
                        DoWorkWithContextCallback callback) override {
    context_provider_->GetContext(
        context_id,
        base::BindOnce(&MyServiceImpl::OnContextReceived,
                       weak_ptr_factory_.GetWeakPtr(),
                       data, std::move(callback)));
  }

 private:
  mojo::Remote<mojom::ContextProvider> context_provider_;
  base::WeakPtrFactory<MyServiceImpl> weak_ptr_factory_{this};
};
```

### Shutdown of Singletons

You might find that your feature includes singletons that are shut down as part
of //content's shutdown process. As part of decoupling the feature
implementation entirely from //content, the shutdown of these singletons must be
either ported into your service or eliminated:

- **First priority (v134+)**: Eliminate the need for graceful shutdown entirely.
  Modern Chromium favors fast shutdown over graceful cleanup in most cases.
- If you need to preserve shutdown of the singleton, move the shutdown logic
  to the service's destructor or implement a proper shutdown sequence.
- Carefully examine timing differences between old and new shutdown behavior.

**Modern Shutdown Pattern (v134+)**:

```cpp
class MyServiceImpl : public mojom::MyService {
 public:
  ~MyServiceImpl() override {
    // Clean shutdown if needed
    if (needs_cleanup_) {
      PerformCriticalCleanup();
    }
  }

  void Shutdown(ShutdownCallback callback) override {
    // Implement explicit shutdown if required
    PerformGracefulShutdown();
    std::move(callback).Run();
    
    // Service will be destroyed after callback
  }

 private:
  bool needs_cleanup_ = true;
};
```

## Modern Best Practices (v134+)

### Service Design Principles

1. **Single Responsibility**: Each service should have one clear purpose
2. **Minimal Dependencies**: Avoid coupling between services
3. **Testability**: Design services to be easily testable in isolation
4. **Error Handling**: Implement comprehensive error handling and recovery
5. **Performance**: Consider the overhead of process boundaries

### Testing Servicified Code

```cpp
// Modern service testing pattern
class MyServiceTest : public testing::Test {
 protected:
  void SetUp() override {
    service_impl_ = std::make_unique<MyServiceImpl>(
        service_remote_.BindNewPipeAndPassReceiver());
  }

  void TearDown() override {
    service_remote_.reset();
    service_impl_.reset();
    task_environment_.RunUntilIdle();
  }

  base::test::TaskEnvironment task_environment_;
  mojo::Remote<mojom::MyService> service_remote_;
  std::unique_ptr<MyServiceImpl> service_impl_;
};

TEST_F(MyServiceTest, BasicFunctionality) {
  base::test::TestFuture<bool> future;
  service_remote_->DoWork("test_data", future.GetCallback());
  EXPECT_TRUE(future.Get());
}
```

### Migration Checklist

When servicifying existing code:

- [ ] Define clear Mojo interfaces
- [ ] Implement proper error handling
- [ ] Add comprehensive tests
- [ ] Handle connection errors gracefully
- [ ] Consider security implications
- [ ] Document the service API
- [ ] Plan for incremental rollout
- [ ] Monitor performance impact

### Service Monitoring

Modern services should include monitoring and metrics:

```cpp
class MyServiceImpl : public mojom::MyService {
 private:
  void RecordMetrics(const std::string& operation, bool success) {
    base::UmaHistogramBoolean(
        base::StrCat({"MyService.", operation, ".Success"}), success);
  }
  
  void DoWork(const std::string& data, DoWorkCallback callback) override {
    base::TimeTicks start_time = base::TimeTicks::Now();
    
    bool success = ProcessData(data);
    
    base::UmaHistogramTimes(
        "MyService.DoWork.Duration",
        base::TimeTicks::Now() - start_time);
    RecordMetrics("DoWork", success);
    
    std::move(callback).Run(success);
  }
};
```

## Additional Support

If this document was not helpful in some way, please post a message to your
friendly local
[chromium-mojo@chromium.org](https://groups.google.com/a/chromium.org/forum/#!forum/chromium-mojo)
or
[services-dev@chromium.org](https://groups.google.com/a/chromium.org/forum/#!forum/services-dev)
mailing list.
