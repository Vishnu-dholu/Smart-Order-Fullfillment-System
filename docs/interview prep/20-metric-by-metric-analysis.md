# 20 — Metric-by-Metric Analysis

> Every collected metric: definition, units, expected behavior, observed behavior, root cause, and interview questions.

---

## Metric 1: `rss_memory_go_bytes` / `jvm_total_memory_used_bytes`

**Panel:** 1 — RSS Memory Footprint
**PromQL (Go):** `process_resident_memory_bytes`
**PromQL (Java):** `sum by (instance) (jvm_memory_used_bytes)`

### Definition

- **RSS** (Resident Set Size): Physical RAM currently occupied by the process in the OS page cache. Includes heap, stack, shared libraries, mapped files, native buffers.
- **JVM total memory used**: Sum of all JVM memory regions (heap Eden + Survivor + Old Gen + Metaspace + Code Cache + compressed class space). This is NOT the same as RSS — RSS includes JVM internal native allocations.

### Units

Bytes. Divide by 1,048,576 for MB.

### Expected Behavior

| Stack | Expected Pattern |
| ------- | ----------------- |
| Java | Sawtooth: gradual heap growth → GC collection → drop. Base ~300MB, peak ~580MB |
| Go | Flat, stable. Grows slightly under load. Base ~30MB, peak ~62MB |

### Observed Behavior

- Go `inventory-go-twin:9082` at warmup start: **30,679,040 bytes (~29.3MB)**
- Go `order-go-twin:9083` at warmup start: **32,202,752 bytes (~30.7MB)**
- Go `warehouse-go:8084` at warmup start: **36,978,688 bytes (~35.3MB)**
- Java under peak order load: **~350-580MB total memory used**

### Root Cause — Go Low Memory

1. Native binary: no JVM class-loading, no Metaspace, no JIT compiled code cache
2. No 1MB thread stack per OS thread — goroutine stacks start at 2KB
3. No reflection metadata overhead
4. Go binary for order-twin: ~12MB on disk → ~30MB in RAM (code + runtime + goroutine stacks)

### Root Cause — Java High Memory

1. JVM startup: loads ~15,000+ classes → Metaspace ~75MB
2. Spring Boot auto-configuration: loads ~800 beans → additional class metadata
3. Tomcat thread pool (200 threads default) × 1MB stack = ~200MB for thread stacks alone
4. G1GC heap regions: pre-allocates memory in regions even when unused
5. `-XX:MaxRAMPercentage=70.0` allows up to 537MB heap in 768MB container

### Interview Questions

1. **Why doesn't Java report `process_resident_memory_bytes` like Go?**
   → Micrometer does not expose this metric. JVM manages its own virtual address space. `process_resident_memory_bytes` is a Go Prometheus client metric that reads from `/proc/{pid}/status VmRSS`.

2. **Is Java's high memory usage a bug?**
   → No. It's deliberate: JVM pre-allocates memory for JIT compiled code and heap regions to achieve high throughput after warmup. The memory tradeoff is a fundamental JVM design choice.

---

## Metric 2: `cpu_usage_spring` / `cpu_usage_go`

**Panel:** 2 — CPU Usage Rate
**PromQL (Java):** `process_cpu_usage`
**PromQL (Go):** `rate(process_cpu_seconds_total[1m])`

### Definition

- **Java `process_cpu_usage`**: Gauge from Micrometer. Range 0.0-1.0 representing fraction of available CPU.
- **Go `rate(...[1m])`**: Per-second rate of CPU seconds consumed. With 1 CPU available, value 0.82 = 82% CPU utilization.

### Expected Behavior Under 200 VUs

| Phase | Java Expected | Go Expected |
| ------- | -------------- | ------------- |
| warmup | 10-20% | 5-15% |
| ramp_1 | 30-50% | 20-40% |
| sustain | 85-100% | 70-90% |

### Observed Behavior

- Java CPU during sustain: **~98.2%** (near saturation)
- Go CPU during sustain: **~82.4%** (17.6% headroom)

### Root Cause — Java CPU Near Saturation

1. **G1GC CPU consumption**: GC threads run concurrently with application threads, competing for the single CPU
2. **Thread context switching**: Tomcat threads frequently context-switch (OS kernel scheduler) when blocking on Feign calls and DB queries
3. **JIT recompilation**: First few hundred requests trigger JIT profiling and compilation — high CPU spikes during ramp phases
4. **Reflection overhead**: Spring's proxy-based AOP (for `@Cacheable`, `@Transactional`) adds reflective method invocation overhead per request

### Root Cause — Go Lower CPU

1. **User-space goroutine scheduling**: Go's scheduler doesn't require OS kernel calls for goroutine switches (reduces syscall overhead)
2. **Concurrent GC**: Go's GC is mostly concurrent with negligible STW — lower GC-related CPU spikes
3. **No reflection**: Go uses direct function calls, no proxy overhead

### Interview Questions

1. **What does Java CPU saturation at 98% indicate?**
   → The service is compute-bound. Under higher VU counts, requests would queue in Tomcat's acceptor queue, increasing latency dramatically. It also means GC pauses become more disruptive — GC threads competing with application threads for CPU time.

2. **Why is `process_cpu_usage` in Java a direct gauge while Go uses `rate()`?**
   → Micrometer's `ProcessorMetrics` reads `/proc/stat` and computes the ratio internally. Go's `process_cpu_seconds_total` is a counter (cumulative CPU seconds). `rate()` converts it to CPU fraction per second.

---

## Metric 3: `p99_latency_spring_seconds` / `p99_latency_go_seconds`

**Panel:** 3 — P99 HTTP Latency
**PromQL (Java):** `histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket[1m])) by (le, instance))`
**PromQL (Go):** `histogram_quantile(0.99, sum(rate(gin_request_duration_seconds_bucket[1m])) by (le, instance))`

### Definition

The P99 latency: 99% of requests complete within this duration. Equivalent to K6's built-in `p(99)` threshold.

### Units

Seconds. Multiply by 1000 for milliseconds.

### Expected Behavior Pattern

```text
                Java P99 (order)
   10s ─────────────────────── ─────────────────────── ──── ─ ─
                                    /\/\/\   (GC spikes)
    5s                                              ────────────  Go P99 (order)
    2ms ─────────────────────────────────────────────────────────  Inventory P99
         warmup  ramp1  ramp2  ramp3  ─── sustain ───  cooldown
```

### Observed Values

| Benchmark | Service | Phase | P99 Latency |
| ----------- | --------- | ------- | ------------- |
| order | Java | warmup | ~44ms (early JIT overhead) |
| order | Java | sustain | **10,327ms** (10.2 seconds) |
| order | Go | sustain | **5,597ms** (5.8 seconds) |
| inventory | Java | sustain | **2.73ms** |
| inventory | Go | sustain | **2.36ms** |

### Root Cause — Java High P99 (Order)

1. **G1GC Stop-The-World pauses**: Major GC compaction pauses application threads for 50-500ms. These directly translate to latency spikes in P99
2. **Tomcat thread pool saturation**: When all 200 Tomcat threads are blocked on Feign/DB, requests queue in the acceptor queue — timeout requests show up in P99
3. **CPU saturation**: At 98% CPU, GC threads and application threads compete — GC takes longer, amplifying STW pauses

### Root Cause — Go Lower P99 (Order)

1. **Sub-millisecond GC STW**: Go's concurrent mark-and-sweep keeps STW < 1ms — no GC-induced request pauses
2. **Goroutine non-blocking scheduler**: When a goroutine blocks on DB/HTTP, the Go scheduler immediately gives the OS thread to another goroutine — no context switch overhead
3. **No request queuing**: Gin creates a goroutine per connection (unlike Tomcat's bounded thread pool). At 200 VUs, 200 goroutines run concurrently without queuing

### Interview Questions

1. **Why is inventory P99 in milliseconds but order P99 is in seconds?**
   → Inventory: GET /products/{id} → cache hit → single DB query → fast. Order: POST /orders → 3 Feign calls (inventory, warehouse × 2) + Haversine computation + DB write → multi-second total.

2. **Why use P99 and not P95?**
   → P95 excludes the worst 5% of requests. At 200 VUs with ~30 RPS over 10 minutes = 18,000 requests. P95 excludes 900 requests; P99 excludes only 180. P99 captures GC pause victims more precisely because G1GC pauses affect ~0.1-1% of requests.

---

## Metric 4: `throughput_spring_rps` / `throughput_go_rps`

**Panel:** 4 — HTTP Throughput
**PromQL:** `sum(rate(..._count[1m])) by (instance)`

### Definition

HTTP requests successfully processed per second by a given service instance.

### Units

Requests per second (RPS).

### Observed Values

| Benchmark | Java RPS | Go RPS | Winner |
| ----------- | --------- | -------- | -------- |
| order (sustain) | **28.89** | 27.67 | Java +9% |
| inventory (sustain) | **108.14** | 108.21 | Tie |

### Root Cause — Java Higher Order Throughput

After JIT warmup, Java's HotSpot compiles the hot `placeOrder()` path to optimized native code. Feign's connection reuse (persistent keep-alive TCP connections to warehouse-go) reduces TCP handshake overhead per request. Higher throughput despite higher latency = more concurrent in-flight requests (limited by 200 VU ceiling).

### Root Cause — Inventory Throughput Tie

Both hit K6's effective ceiling: 200 VUs × 1/(1 + avg_response_time) RPS. With avg response ~1-1.5ms, theoretical max = 200 × 1000/1.5 ≈ 133 RPS but K6's `sleep(1)` paces it: 200 / (1 + 0.0015) ≈ 200 RPS per VU-second. **Actually:** the ~108 RPS ceiling is due to K6's sleep(1) + processing_time limiting each VU to ~1 request per 1.85 seconds: 200 / 1.85 ≈ 108 RPS. Both runtimes are bounded by K6 pacing, not by service capacity — explaining the tie.

### Interview Questions

1. **If Go has lower latency, why doesn't it have higher throughput?**
   → At 200 VUs with `sleep(1)`, each VU does ~1 request every (1s + response_time). Throughput = VUs / (1 + response_time). Since response times are similar (1ms for inventory), the sleep(1) dominates — both approach ~108 RPS ceiling regardless of runtime.

2. **What would happen if sleep(1) was removed?**
   → VUs would fire requests as fast as responses come back. Throughput would be limited by the service's actual processing capacity — likely 2-10× higher for both, but also causing resource exhaustion and meaningful latency differences.

---

## Metric 5: `heap_memory_jvm_bytes` / `heap_memory_go_bytes`

**Panel:** 5 — Resource Footprint / Memory Churn
**PromQL (Java):** `jvm_memory_used_bytes{area="heap"}`
**PromQL (Go):** `go_memstats_heap_alloc_bytes`

### Definition

- **JVM heap**: Memory in the heap region used by live Java objects. Excludes Metaspace, native memory.
- **Go heap alloc**: Bytes of heap objects allocated and NOT yet garbage collected.

### The Sawtooth Pattern (Java)

```text
Heap
  ↑                /\        /\        /\
  │               /  \      /  \      /  \
  │──────────────/    \────/    \────/    \────
  │  (Eden fills)    (GC)      (GC)      (GC)
  └────────────────────────────────────────→ time
```

1. New objects → Eden space
2. Eden fills → Minor GC: live objects promoted to Survivor
3. Survivor fills → Major GC: promotes to Old Gen; compacts Old Gen
4. Old Gen full → Full GC: major stop-the-world pause

### Interview Questions

1. **Why are there 5,076 JVM heap data points vs 1,692 for Go?**
   → Prometheus emits separate time series for each JVM heap region: G1 Eden Space, G1 Old Gen, G1 Survivor Space. 3 regions × 1,692 = 5,076.

2. **Is a sawtooth heap graph a problem?**
   → Not inherently — it's normal GC behavior. It becomes a problem when: (a) the saw teeth increase in amplitude (heap growing unchecked = potential leak), (b) the valleys don't return to baseline (fragmentation), or (c) the GC frequency increases under load (thrashing).

---

## Metric 6: `gc_pause_rate_jvm_seconds` / `gc_pause_rate_go_seconds` / `gc_cycles_go_per_second`

**Panel:** 6 — Garbage Collection Pauses
**PromQL:** `rate(jvm_gc_pause_seconds_sum[1m])`, `rate(go_gc_duration_seconds_sum[1m])`, `rate(go_gc_duration_seconds_count[1m])`

### Definition

- **JVM GC pause rate**: Seconds of GC pause activity per second of real time. A value of 0.1 = 10% of time spent in GC.
- **Go GC pause rate**: Same semantics. Because Go's GC is mostly concurrent, this value is usually very low.
- **Go GC cycles per second**: How frequently GC runs. Go runs GC very often but briefly.

### Key Behavioral Difference

| GC Type | Frequency | Pause Duration | STW Duration |
| --------- | ----------- | ---------------- | ------------- |
| Java G1GC | Low-Medium | Medium-High (10-500ms) | 10-200ms STW |
| Go Concurrent | High | Very Low (sub-ms total) | < 1ms STW |

### Root Cause for P99 Difference

JVM G1GC's STW compaction phase suspends ALL application threads. During a 200ms STW pause:

- 200 Tomcat threads are frozen
- All 200 in-flight requests stop processing
- Response times increase by the STW duration
- These show up as P99 spikes

Go's GC runs mostly concurrent with application goroutines. The brief STW phase (~0.1-0.5ms) is too short to cause visible latency spikes at the HTTP level.

### Interview Questions

1. **What is a stop-the-world pause?**
   → A period where the JVM halts ALL application threads to perform GC tasks that cannot run concurrently (e.g., heap compaction). During STW, no requests are processed.

2. **How does Go's GC avoid stop-the-world?**
   → Tri-color concurrent mark: marks live objects while application runs (write barriers track new references). Only needs brief STW for initial root scanning and final mark check. ZGC (Java) uses a similar approach.

---

## Metric 7: DB Connection Pool Metrics

**Panel:** 7 — DB Connection Pool
**Metrics:** `db_connections_active`, `db_connections_pending`, `go_sql_in_use_connections`, `go_sql_open_connections`, `go_sql_idle_connections`

### Definitions

| Metric | Meaning |
| -------- | --------- |
| `hikaricp_connections_active` | HikariCP connections executing a DB operation |
| `hikaricp_connections_pending` | Threads waiting for a connection (CRITICAL INDICATOR) |
| `go_sql_in_use_connections` | `database/sql` connections currently used |
| `go_sql_open_connections` | Total open connections (in-use + idle) |
| `go_sql_idle_connections` | Connections available for reuse |

### Connection Pool Saturation

When `hikaricp_connections_pending > 0`, the pool is saturated. Threads waiting longer than `connectionTimeout` (30s) throw `SQLTimeoutException` — causing HTTP 500 errors. This is the root cause of Java's 8 HTTP failures in the order benchmark.

### Interview Questions

1. **What is the danger of `hikaricp_connections_pending > 0`?**
   → Threads are blocked waiting for DB connections. Each blocked Tomcat thread cannot serve new requests, reducing effective throughput. If pending > 0 consistently, pool size is too small.

2. **Why does Go not experience connection pool exhaustion as severely?**
   → Goroutines are cheaper than threads. When a goroutine waits for a DB connection, it yields its OS thread to another runnable goroutine. Tomcat's blocked thread holds the OS thread and cannot serve other requests.

---

## Metric 8: `jvm_threads_live` / `go_goroutines`

**Panel:** 8 — Concurrency Model
**PromQL:** `jvm_threads_live_threads`, `go_goroutines`

### Expected Values Under 200 VUs

| Stack | Expected Count |
| ------- | --------------- |
| Java | 200-250 threads (Tomcat 200 + JVM internals) |
| Go | 20-50 goroutines (Gin per-connection + runtime internals) |

### Why This Difference Matters

Memory cost: Java 250 threads × 1MB stack = ~250MB just for thread stacks. Go 40 goroutines × 2KB = 80KB. This directly contributes to the RSS memory difference.

CPU cost: 250 OS threads competing for 1 CPU = heavy kernel scheduler load. 40 goroutines on ~4 OS threads = efficient user-space scheduling.

### Interview Questions

1. **Why does Go have far fewer goroutines than VUs?**
   → Goroutines are created when a request arrives and destroyed on completion. At 28 RPS with ~2.9s response time, average in-flight requests = 28 × 2.9 = ~81. But goroutines also handle HTTP keep-alive management, and Gin's router multiplexes — actual goroutine count depends on concurrent connections, not VU count.

---

## Metric 9: `error_rate_spring_rps` / `error_rate_go_rps`

**Panel:** 9 — HTTP Error Rate
**PromQL (Java):** `sum(rate(http_server_requests_seconds_count{status=~"5.*"}[1m])) by (instance)`
**PromQL (Go):** `sum(rate(gin_request_duration_seconds_count{code=~"5.*"}[1m])) by (instance)` ← note `code` not `status`

### Observed

- Java: 8 HTTP 500 errors during peak sustain phase
- Go: 0 HTTP errors

### Root Cause (Java Errors)

HikariCP connection timeout under peak load. When all 50 DB connections are in use and an additional Tomcat thread waits > 30s for a connection, `HikariCP` throws `SQLTimeoutException`. Spring's exception handler returns HTTP 500.

### Label Mismatch Issue

`gin_request_duration_seconds` uses label `code` for HTTP status. `http_server_requests_seconds` uses `status`. This is why they need separate PromQL queries. A common mistake: using `{status=~"5.*"}` against Go metrics → returns empty results, making it appear Go has no error data at all.
