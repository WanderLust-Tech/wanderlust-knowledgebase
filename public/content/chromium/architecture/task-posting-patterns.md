# Task Posting Patterns and Best Practices

[TOC]

## Overview

This document provides practical examples and patterns for task posting in Chrome, complementing the [Threading and Tasks in Chrome](threading_and_tasks.md) overview and [Threading Model Implementation Analysis](threading-implementation.md). It focuses on real-world usage patterns, common scenarios, and best practices for task management.

## Core Task Posting Concepts

### Task Creation and Basic Patterns

Tasks in Chrome are created using `base::BindOnce()` or `base::BindRepeating()` and represent units of work to be executed asynchronously:

```cpp
void TaskA() {}
void TaskB(int v) {}

// Create tasks
auto task_a = base::BindOnce(&TaskA);
auto task_b = base::BindOnce(&TaskB, 42);
```

### Task Execution Categories

Tasks can be executed in different ways depending on requirements:

#### Parallel Execution
- No ordering guarantees
- May execute simultaneously on multiple threads
- Best for independent operations

#### Sequenced Execution  
- Execute in posting order
- One at a time but may use different threads
- Preferred for most use cases

#### Single-Threaded Execution
- Execute in posting order on same physical thread
- Required only when thread-affine resources are involved

#### COM Single-Threaded (Windows)
- Single-threaded execution with COM apartment initialization
- Required for Windows COM operations

## Posting Parallel Tasks

### Direct Thread Pool Posting

For tasks that can run independently on any thread:

```cpp
// Basic parallel task posting
base::ThreadPool::PostTask(FROM_HERE, base::BindOnce(&Task));

// With explicit traits
base::ThreadPool::PostTask(
    FROM_HERE, 
    {base::TaskPriority::BEST_EFFORT, base::MayBlock()},
    base::BindOnce(&Task));
```

### Using TaskRunner for Parallel Tasks

When you need to hold a reference to the task runner:

```cpp
class WorkerClass {
public:
    void DoWork() {
        task_runner_->PostTask(FROM_HERE, base::BindOnce(&WorkerClass::ProcessData, this));
    }

private:
    scoped_refptr<base::TaskRunner> task_runner_ =
        base::ThreadPool::CreateTaskRunner({base::TaskPriority::USER_VISIBLE});
    
    void ProcessData() {
        // Expensive computation here
    }
};
```

## Posting Sequenced Tasks

### Creating New Sequences

Sequenced execution ensures tasks run in order, making them ideal for state management:

```cpp
scoped_refptr<base::SequencedTaskRunner> sequenced_task_runner =
    base::ThreadPool::CreateSequencedTaskRunner({base::TaskPriority::USER_VISIBLE});

// TaskB will run after TaskA completes
sequenced_task_runner->PostTask(FROM_HERE, base::BindOnce(&TaskA));
sequenced_task_runner->PostTask(FROM_HERE, base::BindOnce(&TaskB));
```

### Posting to Current Sequence

The preferred way to post to the current sequence:

```cpp
// Post to current sequence's default task queue
base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
    FROM_HERE, base::BindOnce(&Task));
```

For threads with multiple task queues, you can specify priority:

```cpp
// Post with specific priority (UI and IO threads support this)
base::ThreadPool::PostTask(
    FROM_HERE,
    {base::CurrentThread(), base::TaskPriority::BEST_EFFORT},
    base::BindOnce(&Task));
```

### Continuation Tasks

To post a task that runs after the current task completes:

```cpp
// This task will run after the current task and any previously posted tasks
base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
    FROM_HERE, base::BindOnce(&Task));
```

## Using Sequences Instead of Locks

Chrome strongly prefers sequence-based thread safety over traditional locking:

### Sequence-Safe Class Pattern

```cpp
class SequenceSafeClass {
public:
    SequenceSafeClass() {
        // Allow creation on any sequence
        DETACH_FROM_SEQUENCE(sequence_checker_);
    }

    void AddValue(int v) {
        // Verify all access is on same sequence
        DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
        values_.push_back(v);
    }

    void ProcessValues() {
        DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
        // Process values safely - no locks needed
        for (int value : values_) {
            // Process each value
        }
    }

private:
    SEQUENCE_CHECKER(sequence_checker_);
    std::vector<int> values_;  // Protected by sequence, not locks
};

// Usage example
SequenceSafeClass processor;
scoped_refptr<base::SequencedTaskRunner> task_runner = 
    base::ThreadPool::CreateSequencedTaskRunner({});

// All operations on same sequence
task_runner->PostTask(FROM_HERE,
    base::BindOnce(&SequenceSafeClass::AddValue, base::Unretained(&processor), 42));
task_runner->PostTask(FROM_HERE,
    base::BindOnce(&SequenceSafeClass::AddValue, base::Unretained(&processor), 27));
task_runner->PostTask(FROM_HERE,
    base::BindOnce(&SequenceSafeClass::ProcessValues, base::Unretained(&processor)));
```

## Single-Threaded Task Posting

### Browser UI and IO Threads

Posting to the main thread or IO thread in the browser process:

```cpp
// Post to UI thread
content::GetUIThreadTaskRunner({})->PostTask(FROM_HERE, base::BindOnce(&UpdateUI));

// Post to IO thread  
content::GetIOThreadTaskRunner({})->PostTask(FROM_HERE, base::BindOnce(&HandleNetwork));
```

**Important**: These threads are heavily loaded. Prefer thread pool for non-essential tasks.

### Custom Single-Threaded Task Runners

When multiple tasks need the same physical thread (rare):

```cpp
scoped_refptr<base::SingleThreadTaskRunner> single_thread_task_runner =
    base::ThreadPool::CreateSingleThreadTaskRunner({});

// Both tasks run on same physical thread in order
single_thread_task_runner->PostTask(FROM_HERE, base::BindOnce(&TaskA));
single_thread_task_runner->PostTask(FROM_HERE, base::BindOnce(&TaskB));
```

### COM Single-Threaded Tasks (Windows)

For COM operations on Windows:

```cpp
void COMTask() {
    // Make COM STA calls safely
    // ...
    
    // Post another COM task to same apartment
    base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(&AnotherCOMTask));
}

auto com_sta_task_runner = base::ThreadPool::CreateCOMSTATaskRunner({});
com_sta_task_runner->PostTask(FROM_HERE, base::BindOnce(&COMTask));
```

## Task Traits and Annotations

### Using TaskTraits Effectively

TaskTraits provide the thread pool with scheduling hints:

```cpp
// Default task - no blocking, inherits priority, shutdown flexible
base::ThreadPool::PostTask(FROM_HERE, base::BindOnce(&SimpleTask));

// High priority task
base::ThreadPool::PostTask(
    FROM_HERE, 
    {base::TaskPriority::USER_BLOCKING},
    base::BindOnce(&UrgentTask));

// Low priority task that may block (file I/O)
base::ThreadPool::PostTask(
    FROM_HERE,
    {base::TaskPriority::BEST_EFFORT, base::MayBlock()},
    base::BindOnce(&FileOperation));

// Task that blocks shutdown
base::ThreadPool::PostTask(
    FROM_HERE,
    {base::TaskShutdownBehavior::BLOCK_SHUTDOWN},
    base::BindOnce(&CriticalCleanup));
```

### Common TaskTraits Patterns

```cpp
// Background processing
{base::TaskPriority::BEST_EFFORT, base::MayBlock()}

// User-visible operations  
{base::TaskPriority::USER_VISIBLE}

// Critical path operations
{base::TaskPriority::USER_BLOCKING}

// Current thread operations
{base::CurrentThread()}

// Shutdown-critical operations
{base::TaskShutdownBehavior::BLOCK_SHUTDOWN}
```

## Keeping Browser Responsive

### PostTaskAndReply Pattern

Avoid blocking the main thread by offloading work:

```cpp
// WRONG: Blocks main thread
void OnUserAction() {
    auto result = ExpensiveComputation();  // Blocks UI!
    UpdateUI(result);
}

// CORRECT: Asynchronous execution
void OnUserAction() {
    base::ThreadPool::PostTaskAndReplyWithResult(
        FROM_HERE, 
        {base::MayBlock()},
        base::BindOnce(&ExpensiveComputation),
        base::BindOnce(&UpdateUI));
}
```

### Background/Foreground Pattern

```cpp
// Fetch data in background, update UI on return
base::ThreadPool::PostTaskAndReplyWithResult(
    FROM_HERE,
    {base::TaskPriority::USER_VISIBLE, base::MayBlock()},
    base::BindOnce(&LoadDataFromDisk, filename),
    base::BindOnce(&DisplayData));
```

## Delayed and Recurring Tasks

### One-Time Delayed Tasks

```cpp
// Execute once after delay
base::ThreadPool::PostDelayedTask(
    FROM_HERE, 
    {base::TaskPriority::BEST_EFFORT}, 
    base::BindOnce(&ScheduledTask),
    base::Seconds(5));
```

### Recurring Tasks

Use `base::RepeatingTimer` for periodic execution:

```cpp
class PeriodicProcessor {
public:
    void StartProcessing() {
        timer_.Start(FROM_HERE, 
                    base::Seconds(1),
                    this, 
                    &PeriodicProcessor::DoPeriodicWork);
    }
    
    void StopProcessing() {
        timer_.Stop();
    }

private:
    void DoPeriodicWork() {
        // Called every second on same sequence that started timer
    }
    
    base::RepeatingTimer timer_;
};
```

## Task Cancellation Patterns

### Using WeakPtr for Cancellation

Safe cancellation when objects are destroyed:

```cpp
class DataProcessor {
public:
    void StartAsyncOperation() {
        base::ThreadPool::PostTaskAndReplyWithResult(
            FROM_HERE,
            base::BindOnce(&ComputeResult),
            base::BindOnce(&DataProcessor::OnResultReady,
                          weak_ptr_factory_.GetWeakPtr()));
    }

private:
    void OnResultReady(int result) {
        // This won't run if DataProcessor is destroyed
        ProcessResult(result);
    }
    
    base::WeakPtrFactory<DataProcessor> weak_ptr_factory_{this};
};
```

### CancelableTaskTracker

For cross-sequence cancellation:

```cpp
class TaskManager {
public:
    void ScheduleWork() {
        cancelable_tracker_.PostTask(
            task_runner_.get(),
            FROM_HERE,
            base::BindOnce(&DoWork));
    }
    
    void CancelAllWork() {
        cancelable_tracker_.TryCancelAll();
    }

private:
    scoped_refptr<base::SequencedTaskRunner> task_runner_ = 
        base::ThreadPool::CreateSequencedTaskRunner({});
    base::CancelableTaskTracker cancelable_tracker_;
};
```

## Testing Task-Based Code

### TaskEnvironment Setup

```cpp
class MyTest : public testing::Test {
protected:
    base::test::TaskEnvironment task_environment_;
};

TEST_F(MyTest, TestAsyncOperation) {
    // Post some tasks
    base::ThreadPool::PostTask(FROM_HERE, base::BindOnce(&TaskA));
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(&TaskB));
    
    // Run until all tasks complete
    task_environment_.RunUntilIdle();
    
    // Verify results
    EXPECT_TRUE(work_completed_);
}
```

### Controlling Task Execution in Tests

```cpp
TEST_F(MyTest, TestControlledExecution) {
    base::RunLoop run_loop;
    
    // Post tasks with known completion point
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(&TaskA));
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, run_loop.QuitClosure());
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(&TaskB));
    
    // Run until QuitClosure() is called
    run_loop.Run();
    
    // Only TaskA and QuitClosure have run, TaskB is still queued
}
```

## ThreadPool Initialization

For new processes that need thread pool support:

```cpp
// Early in main() function
base::ThreadPool::CreateAndStartWithDefaultParams("MyProcess");

// Or for more control
base::ThreadPool::Create("MyProcess");
base::ThreadPool::GetInstance()->Start(custom_params);

// Later in shutdown
base::ThreadPool::GetInstance()->Shutdown();
```

## Task Runner Ownership Best Practices

### Avoid Task Runner Dependency Injection

**Preferred Pattern:**
```cpp
class DataLoader {
public:
    void LoadData() {
        // Create task runner when needed
        base::ThreadPool::PostTaskAndReplyWithResult(
            FROM_HERE,
            {base::MayBlock()},
            base::BindOnce(&LoadFromDisk),
            base::BindOnce(&DataLoader::OnDataLoaded,
                          weak_ptr_factory_.GetWeakPtr()));
    }

private:
    void OnDataLoaded(Data data) { /* ... */ }
    base::WeakPtrFactory<DataLoader> weak_ptr_factory_{this};
};
```

**For Testing (when needed):**
```cpp
class DataLoader {
public:
    void SetTaskRunnerForTesting(
        scoped_refptr<base::SequencedTaskRunner> task_runner) {
        task_runner_for_testing_ = std::move(task_runner);
    }

private:
    scoped_refptr<base::SequencedTaskRunner> GetTaskRunner() {
        return task_runner_for_testing_ 
            ? task_runner_for_testing_
            : base::ThreadPool::CreateSequencedTaskRunner({base::MayBlock()});
    }
    
    scoped_refptr<base::SequencedTaskRunner> task_runner_for_testing_;
};
```

## Migration from Legacy APIs

### ThreadTaskRunnerHandle → CurrentThread

```cpp
// OLD (being removed)
base::ThreadTaskRunnerHandle::Get()->PostTask(
    FROM_HERE, base::BindOnce(&Task));

// NEW
base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
    FROM_HERE, base::BindOnce(&Task));
```

### SequencedTaskRunnerHandle → GetCurrentDefault

```cpp
// OLD (being removed)  
base::SequencedTaskRunnerHandle::Get()->PostTask(
    FROM_HERE, base::BindOnce(&Task));

// NEW
base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
    FROM_HERE, base::BindOnce(&Task));
```

## Common Patterns and Anti-Patterns

### ✅ Good Patterns

**Sequence-based thread safety:**
```cpp
class SafeProcessor {
    SEQUENCE_CHECKER(sequence_checker_);
    void Process() { DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_); }
};
```

**Proper weak pointer usage:**
```cpp
base::BindOnce(&MyClass::Method, weak_ptr_factory_.GetWeakPtr())
```

**Task traits for scheduling hints:**
```cpp
{base::TaskPriority::USER_VISIBLE, base::MayBlock()}
```

### ❌ Anti-Patterns

**Unnecessary dependency injection:**
```cpp
// Avoid passing TaskRunners through many layers
MyClass(scoped_refptr<base::TaskRunner> runner);  // Usually wrong
```

**Blocking main thread:**
```cpp
// Never block UI thread
auto result = ExpensiveComputation();  // Wrong!
```

**Overusing SingleThreadTaskRunner:**
```cpp
// Prefer SequencedTaskRunner unless truly need same physical thread
auto runner = base::CreateSingleThreadTaskRunner({});  // Usually wrong
```

## Conclusion

Effective task posting in Chrome requires understanding the right pattern for each use case:

- **Parallel tasks** for independent operations
- **Sequenced tasks** for ordered operations (preferred over locking)
- **Single-threaded tasks** only when absolutely required
- **Proper task traits** to help the scheduler
- **WeakPtr for cancellation** instead of complex lifetime management
- **PostTaskAndReply** to keep the UI responsive

These patterns enable Chrome's responsive, scalable architecture while maintaining clear ownership and avoiding the pitfalls of traditional lock-based threading.

## Related Topics

- [Threading and Tasks in Chrome](threading_and_tasks.md) - Main threading overview
- [Threading Model Implementation Analysis](threading-implementation.md) - Low-level implementation details
- [Callback and Bind Documentation](callback.md) - Task creation mechanisms
- [Smart Pointer Implementation](../development/smart-pointer-implementation.md) - Memory management patterns that work with threading

---

*Master these task posting patterns to write efficient, maintainable, and responsive Chrome code.*