# Testing With Mojo (Chromium v134+)

This document outlines best practices and techniques for testing code which
internally uses a Mojo service in Chromium v134 and later. It assumes familiarity with the
[Mojo and Services](mojo_and_services.md) document.

**Note for v134+**: This document includes modern testing patterns, improved error handling,
and updated best practices that reflect current Chromium development standards.

## Example Code & Context

Suppose we have this Mojo interface:

```mojom
module example.mojom;

interface IncrementerService {
  Increment(int32 value) => (int32 new_value);
}
```

and this C++ class that uses it:

```c++
class Incrementer {
 public:
  explicit Incrementer();
  ~Incrementer();

  // Disallow copy and assign.
  Incrementer(const Incrementer&) = delete;
  Incrementer& operator=(const Incrementer&) = delete;

  void SetServiceForTesting(
      mojo::PendingRemote<example::mojom::IncrementerService> service);

  // The underlying service is async, so this method is too.
  void Increment(int32_t value, base::OnceCallback<void(int32_t)> callback);

 private:
  mojo::Remote<example::mojom::IncrementerService> service_;
};

void Incrementer::SetServiceForTesting(
    mojo::PendingRemote<example::mojom::IncrementerService> service) {
  service_.Bind(std::move(service));
}

void Incrementer::Increment(int32_t value, 
                           base::OnceCallback<void(int32_t)> callback) {
  if (!service_) {
    service_ = LaunchIncrementerService();
  }
  service_->Increment(value, std::move(callback));
}
```

and we wish to swap a test fake in for the underlying IncrementerService, so we
can unit-test Incrementer. Specifically, we're trying to write this test:

```c++
// Test that Incrementer correctly handles when the IncrementerService fails to
// increment the value.
TEST(IncrementerTest, DetectsFailureToIncrement) {
  base::test::TaskEnvironment task_environment;
  
  Incrementer incrementer;
  FakeIncrementerService service;
  // ... somehow use `service` as a test fake for `incrementer` ...

  base::test::TestFuture<int32_t> future;
  incrementer.Increment(0, future.GetCallback());

  // Get the result and verify behavior
  EXPECT_EQ(0, future.Get());
}
```

## The Fake Service Itself

This part is fairly straightforward. Mojo generates a class called
`example::mojom::IncrementerService`, which is normally subclassed by
IncrementerServiceImpl (or whatever) in production; we can subclass it
ourselves:

```c++
class FakeIncrementerService : public example::mojom::IncrementerService {
 public:
  FakeIncrementerService() = default;
  ~FakeIncrementerService() override = default;

  // example::mojom::IncrementerService implementation:
  void Increment(int32_t value, IncrementCallback callback) override {
    // Does not actually increment, for test purposes!
    std::move(callback).Run(value);
  }

  // Test helper methods
  void SetShouldFail(bool should_fail) { should_fail_ = should_fail; }
  int32_t GetLastValue() const { return last_value_; }

 private:
  bool should_fail_ = false;
  int32_t last_value_ = 0;
};
```

## Async Services

We can plug the FakeIncrementerService into our test using:

```c++
TEST(IncrementerTest, BasicFunctionality) {
  base::test::TaskEnvironment task_environment;
  
  FakeIncrementerService fake_service;
  mojo::Receiver<example::mojom::IncrementerService> receiver{&fake_service};
  
  Incrementer incrementer;
  incrementer.SetServiceForTesting(receiver.BindNewPipeAndPassRemote());
  
  base::test::TestFuture<int32_t> future;
  incrementer.Increment(5, future.GetCallback());
  
  EXPECT_EQ(5, future.Get());  // Fake service doesn't increment
}
```

we can invoke it and wait for the response using `base::test::TestFuture`:

```c++
  base::test::TestFuture<int32_t> test_future;
  incrementer.Increment(0, test_future.GetCallback());
  int32_t result = test_future.Get();
  EXPECT_EQ(0, result);
```

**Modern Testing Pattern (v134+)**: `base::test::TestFuture` is the preferred way to handle
asynchronous callbacks in tests, replacing older patterns like `base::RunLoop`.

... and all is well. However, we might reasonably want a more flexible
FakeIncrementerService, which allows for plugging different responses in as the
test progresses. In that case, we will actually need to wait twice: once for the
request to arrive at the FakeIncrementerService, and once for the response to be
delivered back to the Incrementer.

## Waiting For Requests

To do that, we can instead structure our fake service like this:

```c++
class FakeIncrementerService : public example::mojom::IncrementerService {
 public:
  FakeIncrementerService() = default;
  ~FakeIncrementerService() override = default;

  // example::mojom::IncrementerService implementation:
  void Increment(int32_t value, IncrementCallback callback) override {
    CHECK(!HasPendingRequest()) << "Multiple requests not supported";
    last_value_ = value;
    last_callback_ = std::move(callback);
    
    // Notify that a request has arrived
    if (request_waiter_.IsReady()) {
      request_waiter_.SetValue();
    }
  }

  bool HasPendingRequest() const {
    return !last_callback_.is_null();
  }

  void WaitForRequest() {
    if (HasPendingRequest()) {
      return;
    }
    request_waiter_.Clear();
    ASSERT_TRUE(request_waiter_.Wait()) << "Timeout waiting for request";
  }

  void RespondWithValue(int32_t response_value) {
    CHECK(HasPendingRequest()) << "No pending request to respond to";
    std::move(last_callback_).Run(response_value);
  }

  int32_t last_value() const { return last_value_; }

 private:
  int32_t last_value_ = 0;
  IncrementCallback last_callback_;
  base::test::TestFuture<void> request_waiter_;
};
```

That having been done, our test can now observe the state of the code under test
(in this case the Incrementer service) while the mojo request is pending, like
so:

```c++
TEST(IncrementerTest, HandlesPendingRequests) {
  base::test::TaskEnvironment task_environment;
  
  FakeIncrementerService service;
  mojo::Receiver<example::mojom::IncrementerService> receiver{&service};

  Incrementer incrementer;
  incrementer.SetServiceForTesting(receiver.BindNewPipeAndPassRemote());
  
  // Start the async operation
  base::test::TestFuture<int32_t> response_future;
  incrementer.Increment(42, response_future.GetCallback());

  // Wait for the request to arrive and verify the parameter
  service.WaitForRequest();
  EXPECT_EQ(42, service.last_value());
  
  // Respond with a modified value
  service.RespondWithValue(service.last_value() + 10);

  // Verify the final result
  EXPECT_EQ(52, response_future.Get());
}
```

This pattern is particularly useful for testing error conditions, timeouts, or
complex multi-step interactions.

## Modern Testing Patterns (v134+)

### Using MockReceiver for Simplified Testing

For simpler test scenarios, consider using `mojo::test::MockReceiver`:

```c++
#include "mojo/public/cpp/bindings/receiver.h"
#include "testing/gmock/include/gmock/gmock.h"

class MockIncrementerService : public example::mojom::IncrementerService {
 public:
  MockIncrementerService() = default;
  ~MockIncrementerService() override = default;

  MOCK_METHOD(void, Increment, 
              (int32_t value, IncrementCallback callback), 
              (override));
};

TEST(IncrementerTest, UsesService) {
  base::test::TaskEnvironment task_environment;
  
  MockIncrementerService mock_service;
  mojo::Receiver<example::mojom::IncrementerService> receiver{&mock_service};
  
  Incrementer incrementer;
  incrementer.SetServiceForTesting(receiver.BindNewPipeAndPassRemote());

  // Set expectations
  EXPECT_CALL(mock_service, Increment(42, testing::_))
      .WillOnce([](int32_t value, auto callback) {
        std::move(callback).Run(value + 1);
      });

  base::test::TestFuture<int32_t> future;
  incrementer.Increment(42, future.GetCallback());
  EXPECT_EQ(43, future.Get());
}
```

### Testing Connection Errors

Modern Chromium code should handle connection errors gracefully:

```c++
TEST(IncrementerTest, HandlesConnectionError) {
  base::test::TaskEnvironment task_environment;
  
  FakeIncrementerService service;
  mojo::Receiver<example::mojom::IncrementerService> receiver{&service};
  
  Incrementer incrementer;
  incrementer.SetServiceForTesting(receiver.BindNewPipeAndPassRemote());
  
  // Simulate connection error
  receiver.reset();
  task_environment.RunUntilIdle();
  
  // Test should handle this gracefully
  base::test::TestFuture<int32_t> future;
  incrementer.Increment(42, future.GetCallback());
  
  // Verify appropriate error handling behavior
  // (implementation depends on your error handling strategy)
}
```

## Intercepting Messages to Bound Receivers

In some cases, particularly in browser tests, we may want to take an existing,
bound `mojo::Receiver` and intercept certain messages to it. This allows us to:
 - modify message parameters before the message is handled by the original
   implementation,
 - modify returned values by intercepting callbacks,
 - introduce failures, or
 - completely re-implement the message handling logic

To accomplish this, Mojo autogenerates an InterceptorForTesting class for each
interface that can be subclassed to perform the interception. Continuing with
the example above, we can include `incrementer_service.mojom-test-utils.h` and
then use the following to intercept and replace the number to be incremented:

```c++
class IncrementerServiceInterceptor
    : public example::mojom::IncrementerServiceInterceptorForTesting {
 public:
  // We'll assume RealIncrementerService implements the Mojo interface, owns
  // the bound mojo::Receiver, and makes it available via a testing
  // method we added named `receiver_for_testing()`.
  IncrementerServiceInterceptor(RealIncrementerService* service,
                                int32_t value_to_inject)
      : service_(service),
        value_to_inject_(value_to_inject),
        swapped_impl_(service->receiver_for_testing(), this) {}

  ~IncrementerServiceInterceptor() override = default;

  // Disallow copy and assign.
  IncrementerServiceInterceptor(const IncrementerServiceInterceptor&) = delete;
  IncrementerServiceInterceptor& operator=(const IncrementerServiceInterceptor&) = delete;

  example::mojom::IncrementerService* GetForwardingInterface() override {
    return service_;
  }

  void Increment(int32_t value, IncrementCallback callback) override {
    // Inject our test value instead of the original
    GetForwardingInterface()->Increment(value_to_inject_, std::move(callback));
  }

 private:
  raw_ptr<RealIncrementerService> service_;
  int32_t value_to_inject_;
  mojo::test::ScopedSwapImplForTesting<
      mojo::Receiver<example::mojom::IncrementerService>>
      swapped_impl_;
};
```

## Ensuring Message Delivery

Both `mojo::Remote` and `mojo::Receiver` objects have a `FlushForTesting()`
method that can be used to ensure that queued messages and replies have been
sent to the other end of the message pipe, respectively. `mojo::Remote` objects
also have an asynchronous version of this method called `FlushAsyncForTesting()`
that accepts a `base::OnceCallback` that will be called upon completion. These
methods can be particularly helpful in tests where the `mojo::Remote` and
`mojo::Receiver` might be in separate processes.

### Modern Flush Patterns (v134+)

```c++
TEST(IncrementerTest, FlushExample) {
  base::test::TaskEnvironment task_environment;
  
  FakeIncrementerService service;
  mojo::Receiver<example::mojom::IncrementerService> receiver{&service};
  
  Incrementer incrementer;
  auto remote = receiver.BindNewPipeAndPassRemote();
  incrementer.SetServiceForTesting(std::move(remote));
  
  // Send a message
  base::test::TestFuture<int32_t> future;
  incrementer.Increment(42, future.GetCallback());
  
  // Ensure all messages are flushed
  receiver.FlushForTesting();
  
  EXPECT_TRUE(service.HasPendingRequest());
  service.RespondWithValue(43);
  EXPECT_EQ(43, future.Get());
}
```

## Best Practices for Mojo Testing (v134+)

### 1. Use TaskEnvironment
Always include `base::test::TaskEnvironment` in your test fixtures:

```c++
class IncrementerTestBase : public testing::Test {
 protected:
  base::test::TaskEnvironment task_environment_;
};
```

### 2. Prefer TestFuture over RunLoop
Use `base::test::TestFuture` for waiting on callbacks instead of `base::RunLoop`:

```c++
// Preferred (v134+)
base::test::TestFuture<int32_t> future;
service->DoSomething(future.GetCallback());
int32_t result = future.Get();

// Avoid
base::RunLoop run_loop;
int32_t result;
service->DoSomething(base::BindLambdaForTesting([&](int32_t value) {
  result = value;
  run_loop.Quit();
}));
run_loop.Run();
```

### 3. Test Error Conditions
Always test what happens when Mojo connections fail:

```c++
TEST(IncrementerTest, HandlesDisconnection) {
  base::test::TaskEnvironment task_environment;
  
  mojo::Remote<example::mojom::IncrementerService> remote;
  auto receiver = remote.BindNewPipeAndPassReceiver();
  // Don't bind the receiver - connection will fail
  
  Incrementer incrementer;
  incrementer.SetServiceForTesting(std::move(remote));
  
  base::test::TestFuture<int32_t> future;
  incrementer.Increment(42, future.GetCallback());
  
  // Test should handle connection error gracefully
  // (exact behavior depends on implementation)
}
```

### 4. Use Proper Cleanup
Ensure proper cleanup in test destructors:

```c++
class MyTestFixture : public testing::Test {
 protected:
  void TearDown() override {
    // Reset remotes and receivers explicitly if needed
    receiver_.reset();
    remote_.reset();
    task_environment_.RunUntilIdle();
  }
  
 private:
  base::test::TaskEnvironment task_environment_;
  mojo::Remote<example::mojom::IncrementerService> remote_;
  mojo::Receiver<example::mojom::IncrementerService> receiver_{&fake_service_};
  FakeIncrementerService fake_service_;
};
```

[Mojo and Services]: mojo_and_services.md
