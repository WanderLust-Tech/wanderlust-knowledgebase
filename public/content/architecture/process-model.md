# Process Model

Chromium is built on a multi-process architecture designed to improve stability, security, and performance by isolating different browser components into separate OS processes. In this article, we’ll explore each process type, how they communicate, and the sandboxing model that keeps them in check.

![](../../img/architecture/multiprocess-architecture.png)

---

## 1. Why Multi-Process?

- **Isolation**  
  Crashes in one renderer don’t take down the whole browser.  
- **Security**  
  Sandboxing limits the damage compromised or malicious code can do.  
- **Performance**  
  Parallelism across CPU cores; background tabs can be deprioritized.

---

## 2. Browser Process

The **Browser Process** manages most of Chrome's day-to-day operations, including UI, navigation, and launching child processes. It is the main process responsible for coordinating all other processes.

- **Responsibilities**  
  - UI (address bar, tabs, menus)  
  - Navigation coordination  
  - Disk I/O (cache, cookies, history)  
  - Launching and monitoring child processes  

- **Key Components**  
  - `BrowserMain` (entry point)  
  - `Profile` (user data, settings)  
  - `TabManager` and `TabStripModel`

The browser process communicates with renderer processes via **IPC (Inter-Process Communication)** channels, ensuring isolation and stability.

---

## 3. Renderer Processes

The **Renderer Processes** are responsible for rendering web pages, executing JavaScript, and managing the DOM. Each renderer process is isolated to a single site-instance, ensuring security and stability.

- **Role**  
  Hosts Blink (HTML/CSS layout & paint) and V8 (JavaScript) engines.  

- **Isolation**  
  - One renderer per site-instance (site-per-process by default).  
  - Sandboxed so file system and system calls are restricted.  

- **Threads**  
  - **Main thread**: layout, painting, scripting.  
  - **Worker threads**: web workers, compositor, IO.  

- **Crash Recovery**  
  If a renderer crashes, only its tab shows a “Sad Tab” error; others continue.

The following diagram illustrates the multi-process architecture:

![](../../img/architecture/chromium-process-model.png)

---

## 4. GPU Process

The **GPU Process** offloads compositing and GPU-accelerated drawing to a separate process, ensuring smooth rendering and preventing GPU driver crashes from affecting the browser.

- **Responsibilities**  
  - Managing GL contexts and command buffers.  
  - Providing sandboxed access to graphics APIs.  

---

## 5. Utility & Service Processes

Chromium factors out specialized functionality into additional processes:

| Process Type        | Examples                                    | Why                                |
| ------------------- | ------------------------------------------- | ---------------------------------- |
| **Network Service** | DNS resolution, HTTP/QUIC stack            | Runs as a separate service for better security and easier updates |
| **Audio Service**   | Audio decoding and playback                 | Prevents audio bugs from halting the renderer |
| **PPAPI Plugin Host** | Flash, PDF, etc.                           | Legacy plugin support in a sandbox  |
| **Utility**         | Codecs, encryption helpers, DevTools port   | Miscellaneous helpers outside of renderers |

---

## 6. Inter-Process Communication (IPC)

Chromium uses **Mojo RPC**, a message-passing framework built on top of message pipes, for communication between processes.

- **Patterns**  
  - **Request/Response**: e.g., “Load this URL.”  
  - **Publish/Subscribe**: e.g., GPU context lost events.  

- **Channels**  
  Each child process has a dedicated channel to the browser process.

---

## 7. Process Lifecycle

1. **Launch**  
   - `BrowserMain` forks a new process via `base::LaunchProcess`.  
2. **Initialization**  
   - Child runs its own `main` (e.g., `RenderProcessMain`).  
   - Sets up Mojo, initializes sandbox.  
3. **Work**  
   - Receives tasks via IPC.  
   - Does rendering, network, or utility work.  
4. **Shutdown**  
   - Clean teardown on browser exit or crash.  
   - Crash dumps reported via `breakpad`.

---

## 8. Sandboxing & Security

Chromium employs platform-specific sandboxes to restrict process access and enhance security:

- **Platform-specific sandboxes**  
  - **Windows**: Job objects + seccomp-like restrictions.  
  - **Linux**: setuid sandbox or seccomp-bpf.  
  - **macOS**: seatbelt profiles.  

- **Privilege Separation**  
  Renderer processes cannot open arbitrary files or sockets.  

- **Exploit Mitigations**  
  Address space layout randomization, control-flow integrity, etc.

---

## 9. Diagrams

The following diagram illustrates the conceptual application layering in Chromium's multi-process architecture:

![](../../img/architecture/multiprocess-architecture-detailed.png)

![](../../img/architecture/multiprocess-architecture-simplified.png)

---

## 10. Next Steps

- Read **Architecture → Render Pipeline** for frame construction.  
- See **Modules → Networking (HTTP)** for details on the network service.  
- Dive into **Security → Security Model** to learn more about sandbox internals.  

---

*End of Process Model deep-dive.*