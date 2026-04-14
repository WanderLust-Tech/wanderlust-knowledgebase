# Networking (HTTP)

Chromium's HTTP stack underpins all web communication. In this article we'll trace an HTTP request from the browser down to the network, cover caching, QUIC, and provide a detailed walkthrough of the complete URL request lifecycle.

---

## 1. Overview

- **Components**  
  - **Network Service** (`services/network/`)  
  - **URLLoader / URLRequest** abstractions  
  - **HTTP Cache** (`net/http/http_cache_*.cc`)  
  - **QUIC & HTTP/2** via `net/quic/` and `net/spdy/`  
- **Goals**  
  - Performance: multiplexing, caching, prioritization  
  - Security: TLS validation, safe headers  
  - Flexibility: pluggable protocols, proxy support

---

## 2. Life of a URLRequest: Complete Lifecycle

Understanding how a URL request flows through Chromium's network stack is crucial for debugging network issues and optimizing performance. This section provides a comprehensive walkthrough of a typical HTTP request from initiation to completion.

### 2.1 Key Architecture Components

Before diving into the request flow, it's important to understand the major components:

**Core Network Objects:**
- **URLRequestContext**: Top-level network stack object with non-owning pointers to everything needed for requests
- **URLRequest**: Main interface for consumers, tracks a single request across redirects until completion
- **HttpNetworkSession**: Owns HttpStreamFactory, socket pools, and HTTP/2/QUIC session pools
- **NetworkService**: Singleton that creates all other network service objects and manages NetworkContexts

**Process Architecture:**
- **Browser Process**: Handles process management, navigation, creates top-level NetworkContext objects
- **Network Service Process**: Runs network stack in separate process (or thread) for security and stability
- **Child Processes**: Renderer, GPU, plugin processes that make network requests via Mojo IPC

**NetworkContext Types:**
- **System NetworkContext**: For non-user requests, no persistent storage, managed by SystemNetworkContextManager
- **Profile NetworkContexts**: Per-user storage with cookies and HTTP cache, owned by StoragePartition
- **App NetworkContexts**: Separate contexts for each installed app (platform-dependent)

### 2.2 Request Initiation (Consumer Process)

**Summary**: A consumer assembles request parameters and passes them to URLLoaderFactory via Mojo IPC.

**Detailed Flow:**

1. **Consumer Preparation**: 
   - Consumer (e.g., `content::ResourceDispatcher` for Blink, `content::NavigationURLLoaderImpl` for frame navigations, or `network::SimpleURLLoader`)
   - Assembles parameters in `network::ResourceRequest` object
   - Creates `network::mojom::URLLoaderClient` Mojo channel for bidirectional communication

2. **URLLoaderFactory Interaction**:
   - Consumer obtains `network::mojom::URLLoaderFactory` (provided by browser process)
   - Calls factory to create and start `network::mojom::URLLoader`
   - Factory can set security-related options before vending to child processes

3. **Mojo IPC Transport**:
   - Request data sent over IPC pipe to network service process
   - Browser process creates top-level NetworkContext objects with appropriate security settings
   - Child processes can directly communicate with network service via Mojo

### 2.3 Network Service Request Setup

**Summary**: URLLoaderFactory creates URLLoader which uses NetworkContext's URLRequestContext to create URLRequest.

**Detailed Flow:**

1. **Request Reconstitution**:
   - `network::URLLoaderFactory` receives reconstituted ResourceRequest from Mojo pipe
   - Performs security checks to ensure request can be serviced
   - All NetworkContexts and network stack components live on single thread

2. **URLLoader Creation**:
   - Factory creates `network::URLLoader` with request and associated NetworkContext
   - URLLoader calls into URLRequestContext to create URLRequest
   - URLRequestContext provides pointers to all needed network stack objects (cache, cookie store, host resolver)

3. **Request Scheduling**:
   - URLLoader calls into ResourceScheduler
   - ResourceScheduler may delay starting based on priority and current activity
   - Eventually schedules request for execution

### 2.4 Request Processing and Cache Check

**Summary**: URLRequest creates protocol-specific job, checks cache, and requests HttpStream if needed.

**Detailed Flow:**

1. **Job Creation**:
   - URLRequest calls URLRequestJobFactory to create URLRequestJob
   - For HTTP/HTTPS requests, creates URLRequestHttpJob
   - URLRequestHttpJob attaches cookies to request if needed

2. **Cache Interaction**:
   - URLRequestHttpJob calls HttpCache to create HttpCache::Transaction
   - If no matching cache entry exists, creates HttpNetworkTransaction
   - HttpCache::Transaction transparently wraps HttpNetworkTransaction

3. **Stream Request**:
   - HttpNetworkTransaction calls HttpStreamFactory to request HttpStream
   - This begins the process of establishing network connection

### 2.5 HttpStream Creation and Socket Management

**Summary**: HttpStreamFactory creates connection job, manages socket pools, and establishes network connection.

**Detailed Flow:**

1. **Stream Factory Setup**:
   - HttpStreamFactory creates HttpStreamFactory::Job
   - Job creates ClientSocketHandle to hold socket once connected
   - Passes handle to ClientSocketPoolManager

2. **Socket Pool Management**:
   - ClientSocketPoolManager assembles TransportSocketParams for connection
   - Creates group name ("host:port") for socket reuse identification
   - Directs request to appropriate pool (TransportClientSocketPool for direct HTTP)

3. **Connection Establishment**:
   - If no idle connection available and socket slots available:
     - ClientSocketPoolBaseHelper creates new TransportConnectJob
     - TransportConnectJob performs DNS lookup via HostResolverImpl if needed
     - Establishes TCP connection and creates StreamSocket

4. **Stream Creation**:
   - Connected socket ownership passed to ClientSocketHandle
   - HttpStreamFactory::Job creates HttpBasicStream with ClientSocketHandle ownership
   - HttpBasicStream returned to HttpNetworkTransaction

### 2.6 Request Transmission and Response Handling

**Summary**: Request headers sent, response received and parsed, headers propagated up the stack.

**Detailed Flow:**

1. **Request Transmission**:
   - HttpNetworkTransaction passes request headers to HttpBasicStream
   - HttpBasicStream uses HttpStreamParser to format headers and body
   - Request sent to server over established connection

2. **Response Reception**:
   - HttpStreamParser waits for response and parses HTTP/1.x headers
   - Response headers passed up through HttpNetworkTransaction and HttpCache::Transaction
   - URLRequestHttpJob saves cookies if needed

3. **Header Propagation**:
   - Headers passed to URLRequest, then to network::URLLoader
   - URLLoader sends headers over Mojo pipe to network::mojom::URLLoaderClient
   - Consumer receives response headers notification

### 2.7 Response Body Transfer

**Summary**: Response body streamed through Mojo data pipe with automatic back-pressure handling.

**Detailed Flow:**

1. **Data Pipe Setup**:
   - network::URLLoader creates raw Mojo data pipe
   - Passes read end to network::mojom::URLLoaderClient
   - Retains write end for data transfer

2. **Streaming Process**:
   - URLLoader requests shared memory buffer from Mojo data pipe
   - Passes 64KB body read request down through URLRequest to HttpStreamParser
   - Data read from network (possibly less than 64KB)

3. **Buffer Management**:
   - Byte count propagates back to URLLoader
   - URLLoader notifies Mojo pipe of write completion
   - Requests next buffer from pipe for continued reading
   - Pipe applies back-pressure to limit unconsumed data in shared memory

4. **Transfer Completion**:
   - Process repeats until response body completely read
   - Automatic flow control prevents memory exhaustion

### 2.8 Request Cleanup and Socket Reuse

**Summary**: Request completion triggers cleanup, socket reuse evaluation, and resource deallocation.

**Detailed Flow:**

1. **Completion Notification**:
   - URLRequest notifies network::URLLoader of completion
   - URLLoader forwards completion message to network::mojom::URLLoaderClient
   - URLLoaderFactory destroys URLLoader

2. **Socket Management**:
   - HttpNetworkTransaction evaluates socket reusability during teardown
   - If socket not reusable, HttpBasicStream closes connection
   - ClientSocketHandle returns socket to pool (for reuse or slot management)

3. **Resource Cleanup**:
   - URLRequest destroyed, closing all associated Mojo pipes
   - Memory and connection resources properly released
   - Socket pool updated with availability information

### 2.9 Error Handling and Edge Cases

**Request Failures:**
- Network errors propagate up through the entire stack
- HttpNetworkTransaction handles connection failures and retries
- URLRequest manages redirect chains and authentication challenges
- Proper cleanup ensures no resource leaks during error conditions

**Redirects:**
- URLRequest tracks single request across all redirects
- Each redirect may trigger new cache checks and socket connections
- Response headers indicate redirect location for continued processing

**Authentication:**
- URLRequest::Delegate and NetworkDelegate interfaces handle auth challenges
- Multiple round trips possible for authentication negotiation
- Credentials managed securely through appropriate delegates

---

## 3. The Network Service

Chromium runs its network stack in a separate process by default:

```text
Browser Process  ←───Mojo───→  Network Service Process
```

**Key Components:**
- **Entrypoint**: `services/network/network_service.cc`
- **IPC Interface**: `network_service.mojom`
- **Responsibilities**: Manages global resources (DNS cache, socket pools, proxy config)

## 4. URLLoader / URLRequest Lifecycle

**URLLoaderFactory**
- Created in the browser, sent over Mojo to Renderers
- Renderer calls `CreateLoaderAndStart()`

**URLLoader**
- Implements `network::mojom::URLLoader`
- Wraps a URLRequest (non-Mojo) or directly uses UrlLoader on non-NetworkService builds

**URLRequest** (`net/url_request/url_request.cc`)
- Core state machine: redirect handling, auth, retries
- Delegates to HttpStreamFactory for transport

```text
Renderer → URLLoader → URLRequest → HttpNetworkTransaction → Socket
```

## 5. HTTP Transport

**HttpNetworkTransaction** (`net/http/http_network_transaction.cc`)
- Serializes headers and body, parses responses
- Honors HttpRequestHeaders, HttpResponseHeaders

**Connection Pool** (`net/http/http_stream_factory.cc`)
- Reuses idle connections (keep-alive)
- Categorizes by host:port, proxy, SSL

## 6. HTTP/2 & QUIC
Chromium supports modern protocols for speed:

HTTP/2 (SPDY)

Multiplexed streams over a single TCP connection.

**Implementation under** `net/spdy/`

**QUIC (HTTP/3):**
- Runs atop UDP
- Implemented in `net/quic/`
- Handshake, stream abstraction, congestion control

**Enable via GN args:**
```gn
enable_http2=true
enable_quic=true
```

## 7. Caching Layer

**Disk Cache** (`net/disk_cache/`)
- Stores responses keyed by URL, vary headers
- LRU eviction

**Memory Cache:**
- Fast cache of small responses

**Cache API Hooks:**
- HttpCache sits between URLRequest and HttpNetworkTransaction

```text
URLRequest → HttpCache → (hit: serve; miss: HttpNetworkTransaction)
```

## 8. Proxy & DNS Resolution

**Proxy Configuration:**
- Read from system or PAC scripts (`proxy_config_service.cc`)

**DNS:**
- HostResolver API with built-in DNS cache
- Async lookups via `dns_client.cc`

## 9. Prioritization & Throttling

**ResourceScheduler** (`net/http/resource_scheduler.cc`)
- Assigns priorities (e.g. script > image)
- Limits max concurrent requests per host

## 10. Security & Certificate Validation

**CertVerifier** (`net/cert/cert_verifier.cc`)
- Validates TLS certificates, OCSP stapling

**TransportSecurityState:**
- HSTS, HPKP policies

**Sandbox:**
- Socket operations restricted by sandbox policy

## 11. Debugging & Instrumentation

**Logging:**
```bash
out/Default/chrome --enable-logging=stderr --v=1
```
- chrome://net-internals (legacy) or chrome://net-export

**Tracing:**
- NET_LOG category in chrome://tracing

**Unit Tests:**
- Under `net/http/` and `net/tools/quic_client/`

## 12. Extensions & Hooks

If you want to inject custom behavior:

**URLRequestJob:**
- Create a factory via URLRequestFilter::RegisterProtocolHandler

**NetworkDelegate:**
- Intercept headers, auth events in NetworkService

## 13. Network Performance Optimization

Advanced networking strategies in Chromium:

- **Resource Prioritization**: Critical path optimization and request scheduling
- **Predictive Loading**: Prefetching and prerendering for instant page loads (see [Web Prerendering](../features/web-prerendering.md))
- **Connection Reuse**: HTTP/2 multiplexing and connection pooling
- **Cache Optimization**: Intelligent caching strategies and validation

## 14. Next Steps

- **Deep dive**: [Storage & Cache](storage-cache.md) to see how responses are stored
- **Explore**: [Security Model](../security/security-model.md) for TLS sandbox details  
- **Experiment**: build with `enable_quic=true` and capture QUIC frames with Wireshark