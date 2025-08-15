# Storage & Cache

Efficient storage and caching are critical to Chromium’s performance and user experience. This article covers both the low-level HTTP cache and higher-level web storage APIs, how they interact, and where to look in the source for each.

---

## 1. Overview

- **Scope**  
  - **HTTP Cache**: response caching for network requests  
  - **In-Memory Cache**: fast lookup for small resources  
  - **Web Storage**: LocalStorage, SessionStorage, IndexedDB, Cache API  
  - **Quota & Storage Partitions**: per-origin isolation and limits  
- **Goals**  
  - **Performance**: avoid unnecessary network trips, disk I/O  
  - **Correctness**: respect cache validation (ETags, freshness)  
  - **Security**: isolate origin data, enforce quotas  

---

## 2. HTTP Cache (`net/disk_cache/` & `net/http/http_cache_*`)

### 2.1 Architecture

```text
Renderer        Browser        Network Service
   │               │                  │
   └─URLLoader───▶│                  │
           │      └──▶HttpCache───▶HttpNetworkTransaction──▶Socket
HttpCache sits in between URLRequest and HttpNetworkTransaction.

Disk Cache (LRU) implemented in net/disk_cache/simple/simple_entry_impl.cc.

Memory Cache keeps small objects in RAM (SimpleBackend, MemBackendImpl).

2.2 Key Files
net/http/http_cache.cc / .h

net/disk_cache/simple/simple_backend_impl.cc

net/disk_cache/backend_factory.h

2.3 Eviction & Validation
LRU eviction when size limit (default ~300 MB) is reached.

Cache-Control headers drive freshness; revalidate with ETag/Last-Modified.

Conditional Requests: 304 responses update stored entry metadata.

3. Quota & Storage Partitions
3.1 Storage Partitioning
Each BrowserContext (Profile) has one or more StoragePartitions.

Partitions isolate data by origin and by mode (e.g. default, incognito).

Defined in content/browser/storage_partition_impl.cc.

3.2 Quota Management
QuotaManager (content/browser/quota/quota_manager_impl.cc)

Tracks usage per origin.

Enforces soft/hard limits (default ~6 GB per origin on desktop).

QuotaClient interfaces for each storage type (IndexedDB, FileSystem, Cache API).

4. Web Storage APIs
4.1 LocalStorage & SessionStorage
LocalStorage stored in SQLite under Local Storage/ directory.

SessionStorage tied to single top-level browsing context.

Code lives in content/browser/dom_storage/ and content/renderer/dom_storage/.

4.2 IndexedDB
High-level object store, transactional.

Backed by LevelDB in third_party/blink/renderer/modules/indexeddb/.

Quota interactions via IndexedDBQuotaClient.

4.3 Cache API (Service Workers)
Programmatic cache of Request/Response pairs.

Implemented in service_worker/ under cache_storage/.

Uses the same DiskCache backend under the hood.

5. Interaction with Network Stack
Cache-Control Overrides

HTTP fetch in Service Workers can bypass the HTTP cache.

Stale-while-revalidate

Customizable via headers and Cache API strategies.

6. Debugging & Instrumentation
chrome://cache (legacy) or chrome://net-export for HTTP cache traces.

chrome://quota-internals shows per-origin usage and limits.

chrome://indexeddb-internals inspects IndexedDB databases.

Logging flags:

bash
Copy
Edit
out/Default/chrome --enable-logging=stderr --v=1 --log-net-log=netlog.json
7. Testing & Tools
Unit tests in net/disk_cache/ and content/browser/quota/.

net/tools/quic_client/ can test cache behavior over HTTP/3.

Use storage_browsertest (in content/test/) to automate web storage scenarios.

8. Best Practices & Extensions
Cache only what you can revalidate: avoid caching sensitive data.

Clean up on unload for SessionStorage in embedded contexts.

Custom URLRequestJob to layer additional caching logic:

cpp
Copy
Edit
URLRequestFilter::GetInstance()->AddUrlInterceptor(
    "https://example.com/", std::make_unique<MyCacheInterceptor>());
9. Next Steps
Dive into Security → Security Model to see how origin isolation is enforced.

Explore Modules → Networking (HTTP) to understand how HTTP caching hooks in.

Read Debugging → Debugging Tools for end-to-end cache debugging patterns.