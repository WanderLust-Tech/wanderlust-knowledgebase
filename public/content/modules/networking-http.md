# Networking (HTTP)

Chromium’s HTTP stack underpins all web communication. In this article we’ll trace an HTTP request from the browser down to the network, cover caching, QUIC, and show you where to hook in or inspect traffic.

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

## 2. The Network Service

Chromium runs its network stack in a separate process by default:

```text
Browser Process  ←───Mojo───→  Network Service Process
Entrypoint: services/network/network_service.cc

IPC Interface: network_service.mojom

Manages global resources (DNS cache, socket pools, proxy config).

3. URLLoader / URLRequest Lifecycle
URLLoaderFactory

Created in the browser, sent over Mojo to Renderers.

Renderer calls CreateLoaderAndStart().

URLLoader

Implements network::mojom::URLLoader.

Wraps a URLRequest (non-Mojo) or directly uses UrlLoader on non-NetworkService builds.

URLRequest (net/url_request/url_request.cc)

Core state machine: redirect handling, auth, retries.

Delegates to HttpStreamFactory for transport.

text
Copy
Edit
Renderer → URLLoader → URLRequest → HttpNetworkTransaction → Socket
4. HTTP Transport
HttpNetworkTransaction (net/http/http_network_transaction.cc)

Serializes headers and body, parses responses.

Honors HttpRequestHeaders, HttpResponseHeaders.

Connection Pool (net/http/http_stream_factory.cc)

Reuses idle connections (keep-alive).

Categorizes by host:port, proxy, SSL.

5. HTTP/2 & QUIC
Chromium supports modern protocols for speed:

HTTP/2 (SPDY)

Multiplexed streams over a single TCP connection.

Implementation under net/spdy/.

QUIC (HTTP/3)

Runs atop UDP.

Implemented in net/quic/.

Handshake, stream abstraction, congestion control.

Enable via GN args:

gn
Copy
Edit
enable_http2=true
enable_quic=true
6. Caching Layer
Disk Cache (net/disk_cache/)

Stores responses keyed by URL, vary headers.

LRU eviction.

Memory Cache

Fast cache of small responses.

Cache API Hooks

HttpCache sits between URLRequest and HttpNetworkTransaction.

text
Copy
Edit
URLRequest → HttpCache → (hit: serve; miss: HttpNetworkTransaction)
7. Proxy & DNS Resolution
Proxy Configuration

Read from system or PAC scripts (proxy_config_service.cc).

DNS

HostResolver API with built-in DNS cache.

Async lookups via dns_client.cc.

8. Prioritization & Throttling
ResourceScheduler (net/http/resource_scheduler.cc)

Assigns priorities (e.g. script > image).

Limits max concurrent requests per host.

9. Security & Certificate Validation
CertVerifier (net/cert/cert_verifier.cc)

Validates TLS certificates, OCSP stapling.

TransportSecurityState

HSTS, HPKP policies.

Sandbox

Socket operations restricted by sandbox policy.

10. Debugging & Instrumentation
Logging

bash
Copy
Edit
out/Default/chrome --enable-logging=stderr --v=1
chrome://net-internals (legacy) or chrome://net-export

Tracing

NET_LOG category in chrome://tracing.

Unit Tests

Under net/http/ and net/tools/quic_client/.

11. Extensions & Hooks
If you want to inject custom behavior:

URLRequestJob

Create a factory via URLRequestFilter::RegisterProtocolHandler.

NetworkDelegate

Intercept headers, auth events in NetworkService.

## 12. Network Performance Optimization

Advanced networking strategies in Chromium:

- **Resource Prioritization**: Critical path optimization and request scheduling
- **Predictive Loading**: Prefetching and prerendering for instant page loads (see [Web Prerendering](../features/web-prerendering.md))
- **Connection Reuse**: HTTP/2 multiplexing and connection pooling
- **Cache Optimization**: Intelligent caching strategies and validation

## 13. Next Steps
Deep dive: Modules → Storage & Cache to see how responses are stored.

Explore Security → Security Model for TLS sandbox details.

Experiment: build with enable_quic=true and capture QUIC frames with Wireshark.