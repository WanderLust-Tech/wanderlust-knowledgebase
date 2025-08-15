# State Pattern

The State pattern allows an object to alter its behavior when its internal state changes. Chromium leverages state machines for protocol parsing, navigation state, and UI stateful components.

---

## 1. Purpose & Usage

- **Encapsulate state-specific behavior**: separate logic into state classes.
- **Examples**: download state machine, navigation request states, audio focus states.

---

## 2. Key Implementations

- **`DownloadItemImpl::DownloadState`**
  - Enum-backed state (IN_PROGRESS, COMPLETE, CANCELLED).
  - Methods branch on state to decide UI icon, allowed actions.

- **`NavigationRequest`**
  - State machine states: WILL_START_REQUEST, WILL_REDIRECT_REQUEST, WILL_PROCESS_RESPONSE.

- **`CrxInstaller`**
  - Phases: PENDING, DOWNLOADING, INSTALLING, COMPLETE.

---

## 3. Sample State Machine (Download)

```text
[NotStarted] --Start--> [InProgress] --Finish--> [Complete]
               \--Cancel--> [Cancelled]
```

```cpp
switch (DownloadState state) {
  case IN_PROGRESS:
    UpdateProgressBar();
    break;
  case COMPLETE:
    ShowOpenButton();
    break;
}
```

## 4. Best Practices

- Use clear enum names and document transitions.

- Centralize transitions to avoid invalid state combos.

- Consider base::State helper classes for complex machines.

## 5. Links & References

- content/browser/download/download_item_impl.{h,cc}

- content/browser/loader/navigation_request.cc

- extensions/browser/crx_installer.cc