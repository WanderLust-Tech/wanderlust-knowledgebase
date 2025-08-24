# Converting Legacy IPC to Mojo

[TOC]

## Overview

A number of IPC messages sent (primarily between the browser and renderer
processes) are still defined using Chrome's old IPC system in `//ipc`. This
system uses
[`base::Pickle`](https://source.chromium.org/chromium/chromium/src/+/main:base/pickle.h;drc=main;l=128)
as the basis for message serialization and is supported by a number of `IPC_*`
preprocessor macros defined in `//ipc` and used around the source tree.

There is an ongoing, distributed effort to get these messages converted to Mojo
interface messages. As of Chromium v134+, most critical IPC conversions have been
completed, but some legacy messages remain. Messages that still need to be converted are tracked in two
spreadsheets:

- [Chrome IPC to Mojo migration](https://docs.google.com/spreadsheets/d/1pGWX_wxGdjAVtQOmlDDfhuIc3Pbwg9FtvFXAXYu7b7c/edit#gid=0) for non-web platform messages
- [Mojoifying Platform Features](https://docs.google.com/spreadsheets/d/1VIINt17Dg2cJjPpoJ_HY3HI0uLpidql-1u8pBJtpbGk/edit#gid=1603373208) for web platform messages

**Note for v134+**: Focus should be on converting remaining high-risk or frequently-used IPC messages,
as the majority of the migration work has been completed. New features should use Mojo from the start.

This document is concerned primarily with rote conversion of legacy IPC messages
to Mojo interface messages. If you are considering more holistic refactoring and
better isolation of an entire subsystem of the browser, you may consider
[servicifying](servicification.md) the feature instead of merely converting its
IPCs.

See other [Mojo &amp; Services](mojo_and_services.md) documentation
for introductory guides, API references, and more.

## Legacy IPC Concepts

Each Content child process has a single **`IPC::Channel`** implementation going
between it and the browser process, and this is used as the sole two-way FIFO
to send legacy IPC messages between the processes.

There are two fundamental types of legacy IPC messages: **control** messages,
defined via `IPC_MESSAGE_CONTROLn` macros (where `n` is some small integer) and
**routed** messages defined via `IPC_MESSAGE_ROUTEDn` macros.

Control messages generally go between a browser-side process host (*e.g.*,
`RenderProcessHost` or `GpuProcessHost`) and the child-side `ChildThreadImpl`
subclass. All of these classes implement `IPC::Sender` and thus have a `Send`
method for sending a control message to their remote counterpart, and they
implement `IPC::Listener` to receive incoming control messages via
`OnMessageReceived`.

Routed messages are relegated to **routes** which have arbitrary meaning
determined by their use within a given process. For example, renderers use
routes to isolate messages scoped to individual render frames, and so such
routed messages will travel between a `RenderFrameHostImpl` and its
corresponding `RenderFrameImpl`, both of which also implement `IPC::Sender` and
`IPC::Listener`.

## Mojo Interfaces as Routes

Routed messages in the old IPC system always carry a **routing ID** to identify
to the receiving endpoint which routed object (*e.g.* which `RenderFrameImpl`
or `RenderViewImpl` or whatever) the message is targeting. Each endpoint is thus
required to do some additional book-keeping to track what each routing ID means.

Mojo interfaces obviate the need for routing IDs, as new "routes" can be
established by simply creating a new interface pipe and passing one endpoint to
something which knows how to bind it.

When thinking about an IPC message conversion to Mojo, it's important to
consider whether the message is a control message or a routed message, as this
determines where you might find an existing Mojo interface to carry your
message, or where you will want to add a new end-to-end Mojo interface for that
purpose. This can mean the difference between a single per-process interface
going between each `RenderProcessHostImpl` and its corresponding
`RenderThreadImpl`, vs a per-frame interface going between each
`RenderFrameHostImpl` and its corresponding `RenderFrameImpl`.

## Ordering Considerations

One **very important** consideration when doing IPC conversions is the relative
ordering of IPC-driven operations. With the old IPC system, because every
message between two processes is globally ordered, it is quite easy for parts
of the system to (intentionally or often unintentionally) rely on strict
ordering guarantees.

For example, imagine a `WebContentsObserver` in the browser processes observes
a frame navigation and immediately sends an IPC message to the frame to
configure some new behavior. The implementation may be inadvertently relying on
this message arriving *before* some other tangentially related message sent to
the same frame shortly after the same navigation event.

While Mojo guarantees strict ordering within each message pipe, Mojo does not
(and in fact cannot) make any strict ordering guarantees between separate
message pipes, as message pipes may be freely moved across process boundaries
and thus cannot necessarily share a common FIFO at all times.

If the two messages described above were moved to separate Mojo interfaces on
separate message pipes, renderer behavior could break as the first message may
arrive after the second message.

The best solution to this problem is to rethink the IPC surface and/or
implementation on either side to eliminate ordering dependencies between two
interfaces that otherwise seem to be logically distinct. Failing that, Mojo's
solution to this problem is to support
[**associated interfaces**](/mojo/public/tools/bindings/README.md#Associated-Interfaces).
In a nutshell, these allow multiple distinct interfaces to be multiplexed over
a shared message pipe.

## Channel-Associated Interfaces

The previous section mentions **associated interfaces** as a general-purpose
solution for establishing a mutual FIFO between multiple logical Mojo interfaces
by having them share a single message pipe.

In Chrome, the `IPC::Channel` which carries all legacy IPC messages between
two processes is itself a Mojo message pipe. We provide a mechanism for
associating arbitrary Mojo interfaces with this pipe, which means messages can
be converted to Mojo while preserving strict FIFO with respect to other legacy
IPC messages. Such interfaces are designated in Chrome parlance as
**Channel-associated interfaces**.

*** aside
**NOTE:** Channel-associated interface acquisition is not constrained by
modern security infrastructure in the same way as regular Mojo interfaces,
so security reviewers need to be especially careful to inspect
new additions and uses of such interfaces.
***

Usage of Channel-associated interfaces should be rare but is considered a
reasonable intermediate solution for incremental IPC conversions where it would
be too risky or noisy to convert a large IPC surface all at once, but it would
also be impossible to split the IPC surface between legacy IPC and a dedicated
Mojo interface pipe without introducing timing bugs.

At this point in Chrome's development, practical usage of Channel-associated
interfaces is restricted to the `IPC::Channel` between the browser process and
a renderer process, as this is the most complex IPC surface with the most
implicit ordering dependencies. A few simple APIs exist to support this.

`RenderProcessHostImpl` owns an `IPC::Channel` to its corresponding
`RenderThreadImpl` in the render process. This object has a
`GetRemoteAssociatedInterfaces` method which can be used to pass arbitrary
associated interface requests:

``` cpp
mojo::AssociatedRemote<magic::mojom::GoatTeleporter> teleporter;
channel_->GetRemoteAssociatedInterfaces()->GetInterface(
    teleporter.BindNewEndpointAndPassReceiver());

// These messages are all guaranteed to arrive in the same order they were sent.
channel_->Send(new FooMsg_SomeLegacyIPC);
teleporter->TeleportAllGoats();
channel_->Send(new FooMsg_AnotherLegacyIPC);
```

Likewise, `ChildThreadImpl` has an `IPC::Channel` that can be used in the same
way to send such messages back to the browser.

To receive and bind incoming Channel-associated interface requests, the above
objects also implement `IPC::Listener::OnAssociatedInterfaceRequest`.

For supplementation of routed messages, both `RenderFrameHostImpl` and
`RenderFrameImpl` define a `GetRemoteAssociatedInterfaces` method which works
like the one on `IPC::Channel`, and both objects also implement
`IPC::Listener::OnAssociatedInterfaceRequest` for processing incoming associated
interface requests specific to their own frame.

There are some example conversion CLs which use Channel-associated interfaces
[here](https://codereview.chromium.org/2381493003) and
[here](https://codereview.chromium.org/2400313002).

## Modern Security Considerations (v134+)

When converting legacy IPC to Mojo in Chromium v134+, additional security considerations must be taken into account:

### Interface Broker Security

All new Mojo interfaces should be properly registered with the appropriate interface broker:
- Frame-scoped interfaces should use `RenderFrameHostImpl::GetBrowserInterfaceBroker()`
- Process-scoped interfaces should use appropriate process-level brokers
- Ensure proper capability validation and origin checks where needed

### Capability-Based Security

Modern Chromium uses capability-based security patterns:
- Interfaces should only expose the minimum required functionality
- Consider using capability delegation patterns for complex permission scenarios
- Validate all inputs at interface boundaries, not just at the call site

### Memory Safety

When converting IPC structures:
- Prefer using `base::span<>` over raw pointers and lengths
- Use `mojo::StructPtr<>` for nullable complex types
- Ensure proper bounds checking in custom serialization code

## Deciding How to Approach a Conversion

There are a few questions you should ask before embarking upon any IPC message
conversion journey, and there are many potential approaches to consider. The
right one depends on context.

Note that this section assumes the message is traveling between the browser
process and a renderer process. Other cases are rare and developers may wish to
consult
[chromium-mojo@chromium.org](https://groups.google.com/a/chromium.org/forum/#!forum/chromium-mojo)
before proceeding with them. Otherwise, apply the following basic algorithm to
decide how to proceed:

- General note: If the message is a reply to some other message (typically these
  take a "request ID" argument), see the note about message replies at the
  bottom of this section.
- Consider whether or not the message makes sense as part of the IPC surface of
  a new or existing service somewhere in `//services` or `//chrome/services`,
  *etc.* This is less and less likely to be the case as time goes on, as many
  remaining IPC conversions are quite narrowly dealing with specific
  browser/renderer details rather than the browser's supporting subsystems. If
  defining a new service, you may wish to consult some of the other
  [Mojo &amp; Services documentation](/docs/README.md#Mojo-Services) first.
- If the message is an `IPC_MESSAGE_CONTROL` message:
    - If there are likely to be strict ordering requirements between this
      message and other legacy IPC or Channel-associated interface messages,
      consider using a new or existing
      [Channel-associated interface](#Channel-Associated-Interfaces) between
      `RenderProcessHostImpl` and `RenderThreadImpl`.
    - If the message is sent from a renderer to the browser:
        - If an existing interface is bound by `RenderProcessHostImpl` and
          requested through `RenderThread`'s Connector and seems to be a good
          fit for the message, add the equivalent Mojo message to that
          interface.
        - If no such interface exists, consider adding one for this message and
          any related messages.
    - If the message is sent from the browser to a renderer:
        - If an existing interface is bound by `RenderThreadImpl` and requested
          through the browser's interface broker system,
          and the interface seems to be a good fit for the message, add the
          equivalent Mojo message to that interface.
        - If no such interface exists, consider adding one for this message and
          any related messages.
- If the message is an `IPC_MESSAGE_ROUTED` message:
    - Determine what the routing endpoints are. If they are
      `RenderFrameHostImpl` and `RenderFrameImpl`:
        - If there are likely to be strict ordering requirements between this
          message and other legacy IPC or Channel-associated interface messages,
          consider using a new or existing
          [Channel-associated interface](#Channel-Associated-Interfaces) between
          `RenderFrameHostImpl` and `RenderFrameImpl`.
        - If the message is sent from a renderer to the browser:
            - If an existing interface is bound by `RenderFrameHostImpl` and
              acquired via `RenderFrame::GetBrowserInterfaceBroker` and the interface seems
              to be a good fit for this message, add the equivalent Mojo message
              to that interface.
            - If no such interface exists, consider adding one and registering it
              with `RenderFrameHostImpl`'s `BrowserInterfaceBroker`. See the
              [simple example](mojo_and_services.md#Example_Defining-a-New-Frame-Interface)
              in the "Intro to Mojo & Services" document.
        - If the message is sent from the browser to a renderer, consider
          adding a Mojo equivalent to the `content.mojom.Frame` interface
          defined in
          [frame.mojom](https://source.chromium.org/chromium/chromium/src/+/main:content/common/frame.mojom;drc=main).
    - If the routing endpoints are **not** frame objects (for example, they may
      be `RenderView`/`RenderViewHost` objects), this is a special case which
      does not yet have an easy conversion approach readily available. Contact
      [chromium-mojo@chromium.org](https://groups.google.com/a/chromium.org/forum#!forum/chromium-mojo)
      to propose or discuss options.

*** aside
**NOTE**: If you are converting a sync IPC, see the section on
[Synchronous Calls](https://chromium.googlesource.com/chromium/src/+/main/mojo/public/cpp/bindings/README.md#Synchronous-Calls)
in the Mojo documentation.
***

### Dealing With Replies

If the message is a **reply**, meaning it has a "request ID" which correlates it
to a prior message in the opposite direction, consider converting the
**request** message following the algorithm above. Unlike with legacy IPC, Mojo
messages support replies as a first-class concept. So for example if you have:

``` cpp
IPC_CONTROL_MESSAGE2(FooHostMsg_DoTheThing,
                     int /* request_id */,
                     std::string /* name */);
IPC_CONTROL_MESSAGE2(FooMsg_DidTheThing,
                     int /* request_id */,
                     bool /* success */);
```

You should consider defining an interface `Foo` which is bound in
`RenderProcessHostImpl` and acquired from `RenderThreadImpl`, with the following
mojom definition:

``` cpp
interface Foo {
  DoTheThing(string name) => (bool success);
};
```
See [Receiving responses](https://chromium.googlesource.com/chromium/src/+/main/mojo/public/cpp/bindings/README.md#receiving-responses)
for more information.

## Repurposing `IPC::ParamTraits` and `IPC_STRUCT*` Invocations

Occasionally it is useful to do partial IPC conversions, where you want to
convert a message to a Mojo interface method but you don't want to necessarily
convert every structure passed by the message. In this case, you can leverage
Mojo's
[type-mapping](https://chromium.googlesource.com/chromium/src/+/main/mojo/public/cpp/bindings/README.md#Type-Mapping)
system to repurpose existing `IPC::ParamTraits`.

*** aside
**NOTE**: Although in some cases `IPC::ParamTraits<T>` specializations are
defined manually in library code, the `IPC_STRUCT*` macro helpers also define
`IPC::ParamTraits<T>` specializations under the hood. All advice in this section
pertains to both kinds of definitions.
***

If a mojom struct is declared without a struct body and is tagged with
`[Native]`, and a corresponding typemap is provided for the struct, the emitted
C++ bindings will -- as if by magic -- replace the mojom type with the
typemapped C++ type and will internally use the existing `IPC::ParamTraits<T>`
specialization for that type in order to serialize and deserialize the struct.

For example, given an existing IPC struct definition like
[`resource_messages.h`](https://source.chromium.org/chromium/chromium/src/+/main:content/common/resource_messages.h;drc=main) 
which defines an IPC mapping for `content::ResourceRequest`:

``` cpp
IPC_STRUCT_TRAITS_BEGIN(content::ResourceRequest)
  IPC_STRUCT_TRAITS_MEMBER(method)
  IPC_STRUCT_TRAITS_MEMBER(url)
  // ...
IPC_STRUCT_TRAITS_END()
```

and the
[`resource_request.h`](https://source.chromium.org/chromium/chromium/src/+/main:content/common/resource_request.h;drc=main) header
which actually defines the `content::ResourceRequest` type:

``` cpp
namespace content {

struct CONTENT_EXPORT ResourceRequest {
  // ...
};

}  // namespace content
```

we can declare a corresponding "native" mojom struct:

``` cpp
module content.mojom;

[Native]
struct URLRequest;
```

and add a typemap like
[`url_request.typemap`](https://source.chromium.org/chromium/chromium/src/+/main:content/common/url_request.typemap;drc=main)
to define how to map between them:

``` python
mojom = "//content/public/common/url_loader.mojom"
public_headers = [ "//content/common/resource_request.h" ]
traits_headers = [ "//content/common/resource_messages.h" ]
...
type_mappings = [ "content.mojom.URLRequest=content::ResourceRequest" ]
```

Note specifically that public_headers includes the definition of the native C++
type, and traits_headers includes the definition of the legacy IPC traits.

As a result of all this, other mojom files can now reference
`content.mojom.URLRequest` as a type for method parameters and other struct
fields, and the generated C++ bindings will represent those values exclusively
as `content::ResourceRequest` objects.

This same basic approach can be used to leverage existing `IPC_ENUM_TRAITS` for
invocations for `[Native]` mojom enum aliases.

*** aside
**NOTE:** Use of `[Native]` mojom definitions is strictly limited to C++
bindings. If a mojom message depends on such definitions, it cannot be sent or
received by other language bindings. This feature also depends on continued
support for legacy IPC serialization and all uses of it should therefore be
treated as technical debt.
***

## Blink-Specific Advice

### Variants
Let's assume we have a mojom file such as this:

``` cpp
module example.mojom;

interface Foo {
  SendData(string param1, array<int32> param2);
};
```

The following GN snippet will generate two concrete targets: `example` and
`example_blink`:

```
mojom("example") {
  sources = [ "example.mojom" ]
}
```

The target `example` will generate Chromium-style C++ bindings using STL types:

``` cpp
// example.mojom.h
namespace example {
namespace mojom {

class Example {
  virtual void SendArray(const std::string& param1, const std::vector<int32_t>& param2) = 0;
}

} // namespace mojom
} // namespace example
```

The target `example_blink` will generate Blink-style C++ bindings using WTF types:

``` cpp
// example.mojom-blink.h
namespace example {
namespace mojom {
namespace blink {

class Example {
  virtual void SendArray(const WTF::String& param1, const WTF::Vector<int32_t>& param2) = 0;
}

} // namespace blink
} // namespace mojom
} // namespace example
```

Thanks to these separate sets of bindings no work is necessary to convert types
between Blink-style code and Chromium-style code. It is handled automatically
during message serialization and deserialization.

For more information about variants, see
[this section](https://chromium.googlesource.com/chromium/src/+/main/mojo/public/cpp/bindings/README.md#Variants) of the C++ bindings
documentation.

### Binding callbacks

Mojo methods that return a value take an instance of `base::OnceCallback`.
Use `WTF::BindOnce()` and an appropriate wrapper function depending on the type of
object and the callback.

For garbage-collected (Oilpan) classes owning the `mojo::Remote`, it is recommended
to use `WrapWeakPersistent(this)` for connection error handlers since they
are not guaranteed to get called in a finite time period (wrapping the object
with `WrapPersistent` in this case would cause memory leaks).

If the response can be discarded in case the object is not alive by the time
the response is received, use `WrapWeakPersistent(this)` for binding the response callback:

``` cpp
// Modern example with error handling
auto remote = std::make_unique<mojo::Remote<device::mojom::SensorProvider>>();
remote->set_disconnect_handler(WTF::BindOnce(
    &DeviceSensorEntry::HandleSensorError, WrapWeakPersistent(this)));

// Use more specific error handling
remote->GetSensor(device::mojom::SensorType::ACCELEROMETER,
    WTF::BindOnce(&DeviceSensorEntry::OnSensorCreated, 
                  WrapWeakPersistent(this)));
```

Otherwise (for example, if the response callback is used to resolve a Promise),
use `WrapPersistent(this)` to keep the object alive:

``` cpp
// Promise-based example with proper error handling
ScriptPromiseResolver* resolver = MakeGarbageCollected<ScriptPromiseResolver>(script_state);
auto promise = resolver->Promise();

nfc_remote_->CancelAllWatches(
    WTF::BindOnce(&NFC::OnRequestCompleted,
                  WrapPersistent(this),
                  WrapPersistent(resolver)));
                  
return promise;
```
... 
nfc_->CancelAllWatches(WTF::BindOnce(&NFC::OnRequestCompleted,
                                 WrapPersistent(this),
                                 WrapPersistent(resolver)));
```

Non-garbage-collected objects can use `WTF::Unretained(this)` for both response
and error handler callbacks when the `mojo::Remote` is owned by the object bound
to the callback or the object is guaranteed to outlive the Mojo connection for
another reason. Otherwise a weak pointer should be used. However, it is not a
common pattern since using Oilpan is recommended for all Blink code.

### Implementing Mojo interfaces in Blink

Only a `mojo::Receiver` or `mojo::ReceiverSet` should be used when implementing a
Mojo interface in an Oilpan-managed object. The object must then have a pre-finalizer
to close any open pipes when the object is about to be swept as lazy sweeping
means that it may be invalid long before the destructor is called. This requires
setup in both the object header and implementation.

``` cpp
// MyObject.h
class MyObject : public GarbageCollected<MyObject>,
                 public example::mojom::blink::Example,
                 public Supplement<ExecutionContext> {
  USING_PRE_FINALIZER(MyObject, Dispose);
  USING_GARBAGE_COLLECTED_MIXIN(MyObject);

 public:
  static const char kSupplementName[];
  static MyObject& From(ExecutionContext&);

  explicit MyObject(ExecutionContext&);
  void Dispose();

  // Implementation of example::mojom::blink::Example.
  void DoSomething(const WTF::String& data, 
                   DoSomethingCallback callback) override;

  // Supplement implementation
  void Trace(Visitor*) const override;

 private:
  mojo::Receiver<example::mojom::blink::Example> receiver_{this};
  Member<ExecutionContext> execution_context_;
};

// MyObject.cpp
void MyObject::Dispose() {
  receiver_.reset();
}

void MyObject::Trace(Visitor* visitor) const {
  visitor->Trace(execution_context_);
  Supplement<ExecutionContext>::Trace(visitor);
}
```

For more information about Blink's Garbage Collector, see
[Blink GC API Reference](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/platform/heap/BlinkGCAPIReference.md;drc=main).

## Testing Converted Mojo Interfaces

When converting legacy IPC to Mojo, it's important to update tests appropriately:

### Unit Testing Patterns

Use `mojo::test::MockReceiver` and `mojo::Remote` for testing:

``` cpp
// test_helper.h
class MockExampleInterface : public example::mojom::Example {
 public:
  MockExampleInterface() = default;
  ~MockExampleInterface() override = default;

  MOCK_METHOD(void, DoSomething, 
              (const std::string& data, DoSomethingCallback callback), 
              (override));

  mojo::PendingRemote<example::mojom::Example> BindNewPipeAndPassRemote() {
    return receiver_.BindNewPipeAndPassRemote();
  }

 private:
  mojo::Receiver<example::mojom::Example> receiver_{this};
};
```

### Integration Testing

For integration tests involving converted IPC:
- Use `base::test::TaskEnvironment` for proper async handling
- Consider using `mojo::SyncCallRestrictions::ScopedAllowSyncCallForTesting` for test-only synchronous calls
- Ensure proper cleanup of Mojo connections in test teardown

### Browser Tests

When testing frame-scoped interfaces:
- Use `RenderFrameHostTester` for setting up test scenarios
- Consider using `MockBrowserInterfaceBroker` for controlled testing environments

### Typemaps For Content and Blink Types

Using typemapping for messages that go between Blink and content browser code
can sometimes be tricky due to things like dependency cycles or confusion over
the correct place for some definition to live. 

Modern approaches for v134+ include:
- Using `base::span<>` instead of raw arrays where possible
- Leveraging `std::optional<>` for nullable primitive types
- Using `base::flat_map<>` and `base::flat_set<>` for better performance

Feel free to contact
[chromium-mojo@chromium.org](https://groups.google.com/a/chromium.org/forum/#!forum/chromium-mojo)
with specific details if you encounter trouble.

Example patterns for modern typemaps:

``` cpp
// Modern mojom definition
module example.mojom;

struct ModernRequest {
  string url;
  map<string, string> headers;
  array<uint8>? body;  // Optional body data
};

interface ModernAPI {
  ProcessRequest(ModernRequest request) => (bool success, string? error);
};
```

With corresponding typemap using modern C++ types:

``` python
mojom = "//example/public/mojom/modern_api.mojom"
public_headers = [ 
  "//example/public/modern_request.h",
  "//base/containers/flat_map.h"
]
traits_headers = [ "//example/common/modern_request_mojom_traits.h" ]
type_mappings = [ 
  "example.mojom.ModernRequest=example::ModernRequest[move_only]" 
]
```

## Additional Support

If this document was not helpful in some way, please post a message to your
friendly [chromium-mojo@chromium.org](https://groups.google.com/a/chromium.org/forum/#!forum/chromium-mojo)
mailing list.

For Chromium v134+ specific questions:
- Check the [Mojo documentation](https://chromium.googlesource.com/chromium/src/+/main/mojo/README.md) for the latest patterns
- Review recent [Mojo-related CLs](https://chromium-review.googlesource.com/q/hashtag:mojo) for examples
- Consider the [Chromium security guidelines](https://chromium.googlesource.com/chromium/src/+/main/docs/security/README.md) for interface design

## See Also

- [Mojo & Services Overview](mojo_and_services.md)
- [Servicification Guide](servicification.md)
- [Chromium IPC Security](https://source.chromium.org/chromium/chromium/src/+/main:docs/security/mojo.md)
