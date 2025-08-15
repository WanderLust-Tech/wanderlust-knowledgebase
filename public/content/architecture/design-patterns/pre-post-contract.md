# Pre/Post and Contract Programming in Chromium

Pre/Post is not a typical design pattern but rather a concept rooted in **contract programming**. It emphasizes defining **preconditions** and **postconditions** for functions or methods, ensuring that software components adhere to a formal contract. This approach improves code reliability, maintainability, and clarity.

---

## What is Contract Programming?

Contract programming is a method of designing software by defining formal, precise, and verifiable interfaces for software components. It introduces:
- **Preconditions**: Conditions that must hold true before a function is executed.
- **Postconditions**: Conditions that must hold true after a function is executed.
- **Invariants**: Conditions that must always hold true for an object, except during the execution of a public method.

At its core, contract programming relies on **assertions**—Boolean statements that must always evaluate to `true`. If an assertion fails, it indicates a program error.

---

## Pre/Post in Chromium

Although C++11 does not natively support contract programming syntax, Chromium's codebase demonstrates the **Pre/Post** concept through its design. This approach is evident in Chromium's startup sequence and other critical components.

### Example: Chromium Startup Sequence

The following diagram illustrates the **Pre/Post** design in Chromium's startup process:

![](../../img/architecture/chromium-startup-sequence.jpeg)

1. **Preconditions**:
   - Before starting the main message loop, the environment is prepared using `PreMainMessageLoopStart`.
2. **Postconditions**:
   - After the main message loop starts, cleanup and additional setup are performed using `PostMainMessageLoopStart`.

This ensures that each stage of the startup process is clearly defined and adheres to its contract.

---

## Benefits of Pre/Post Design

1. **Improved Readability**:
   - The code is easier to understand because each stage has clearly defined responsibilities.
2. **Enhanced Maintainability**:
   - Changes to one stage do not affect others, as long as the contract is upheld.
3. **Error Prevention**:
   - By enforcing preconditions and postconditions, potential errors are caught early in the development process.

---

## Pre/Post in Practice

### Example: Browser Main Loop

In Chromium's `BrowserMainLoop`, the **Pre/Post** design is applied at multiple levels:

1. **Preconditions**:
   - `PreMainMessageLoopStart` prepares the environment for the main message loop.
   - Platform-specific components (e.g., `ChromeBrowserMainParts`) are initialized.

2. **Postconditions**:
   - `PostMainMessageLoopStart` performs cleanup and final setup after the main message loop starts.

The following diagrams illustrate the layered **Pre/Post** design in Chromium:

![](../../img/architecture/chromium-pre-post-layers-1.jpeg)
![](../../img/architecture/chromium-pre-post-layers-2.png)
![](../../img/architecture/chromium-pre-post-layers-3.jpeg)

---

## Why Use Pre/Post?

In programming languages that do not natively support **Design by Contract**, implementing **Pre/Post** at the code level provides many of the same benefits:
- **Clarity**: Developers know exactly what conditions must be met at each stage.
- **Consistency**: The contract ensures that components interact predictably.
- **Debugging**: Assertions help identify issues during development.

---

## Conclusion

The **Pre/Post** design in Chromium demonstrates how contract programming principles can be applied in real-world software development. By defining clear preconditions and postconditions, Chromium's codebase achieves greater stability, security, and maintainability.