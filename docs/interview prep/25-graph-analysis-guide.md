# 25 — Graph Analysis Guide

> For every Grafana dashboard panel: 30-second, 2-minute, and detailed explanations — with interview questions, common mistakes, and code references.

---

## Panel 1 — RSS Memory Footprint

**Metric:** `process_resident_memory_bytes` (Go) | `sum(jvm_memory_used_bytes)` (Java)

### 30-Second Explanation

"Go runs at 30-62MB of memory throughout the entire benchmark. Java requires 350-580MB. Go uses 7-9× less physical RAM because it compiles to a native binary — no JVM, no Metaspace, no 1MB-per-thread stacks."

### 2-Minute Explanation

"The RSS Memory graph shows total physical RAM consumed by each service process over the 35-minute test. Go's line is flat and low — roughly 30-40MB at startup, growing slightly to 50-62MB under peak 200-VU load. This is because a Go binary includes only the compiled application code, the Go runtime scheduler (~4MB), and heap for live objects. Thread stacks are goroutine stacks at 2KB each, not 1MB OS thread stacks.

Java's line shows a sawtooth pattern — gradual growth as the G1GC Eden space fills, then a periodic drop as the garbage collector runs. The baseline is high (~350MB) because Spring Boot loads ~800 beans, ~15,000 classes into Metaspace, and Tomcat allocates a thread pool with 1MB stacks per thread."

### Detailed Technical Explanation

**Go RSS composition:**

- Binary code segment: ~12MB
- Go runtime (scheduler, GC, goroutine stacks): ~8MB
- Heap (live objects): ~8-30MB under load
- `database/sql` connection pool, HTTP transport buffers: ~2MB
- Total: ~30-62MB

**Java RSS composition (via `sum(jvm_memory_used_bytes)`):**

- Note: `jvm_memory_used_bytes` is NOT RSS — it's JVM-managed memory only
- Heap (Eden + Survivor + Old Gen): ~200-400MB
- Metaspace: ~75MB (class metadata for 15,000+ loaded classes)
- Code Cache: ~30MB (JIT compiled native code)
- Not captured: thread stacks, JVM native memory, direct byte buffers

**Sawtooth explanation:**

1. New `Order`, `OrderItem`, `ProductDTO` objects → Eden fills in ~30-60s under 200 VUs
2. Minor GC: live objects copied to Survivor space → heap drops ~30%
3. Old objects accumulate in Old Gen → Old Gen fills
4. G1GC mixed collection: reclaims Old Gen regions → larger heap drop
5. Repeat — each cycle takes ~2-5 minutes under sustained load

### Likely Interview Questions

1. Why does Java use more memory than Go?
2. What is Metaspace and why doesn't Go have it?
3. What causes the sawtooth pattern?
4. Is the sawtooth pattern a memory leak?
5. Why doesn't Go show a sawtooth pattern?
6. What is RSS memory vs heap memory?
7. Why does `sum(jvm_memory_used_bytes)` underestimate Java's true RAM usage?

### Common Mistakes While Explaining

❌ "Java has a memory leak" — The sawtooth is normal GC behavior, NOT a leak. A leak would show the baseline rising over time without dropping.
❌ "Go doesn't use memory" — Go uses 30-62MB; it simply uses far less than Java.
❌ Confusing RSS and heap — RSS includes all process memory; JVM heap is only the GC-managed portion.

### Code Components

- Java: `application.properties:31` — `-XX:MaxRAMPercentage=70.0` controls max heap within container limit
- Go: `database/db.go:29` — `SetMaxOpenConns(50)` controls connection pool memory
- Docker: `docker-compose.ssp.yml` — `memory: 768M` enforces container RSS limit

### Runtime Behavior

Java: G1GC heap management, JVM class loading, Tomcat thread pool stack allocation
Go: TCMalloc-style heap allocator, goroutine stack growth/shrink, Go runtime span management

---

## Panel 2 — CPU Usage Rate

**Metric:** `process_cpu_usage` (Java) | `rate(process_cpu_seconds_total[1m])` (Go)

### 30-Second Explanation

"Under peak 200-VU order load, Java consumes ~98% of its 1-CPU allocation — near saturation. Go runs at ~82%, leaving 18% headroom. Java burns more CPU due to thread context switching overhead and G1GC concurrent threads competing for the single CPU."

### 2-Minute Explanation

"The CPU graph shows fraction of available CPU consumed per second. Both services are constrained to `cpus: '1.0'` via Docker cgroup. During warmup (0-300s), CPU is low for both. During ramp phases, it rises. During sustain (200 VUs), Java hits ~98% while Go plateaus at ~82%.

Java's higher CPU comes from three sources: (1) JIT compilation during ramp phases — the JVM profiling and compiling hot methods adds transient CPU spikes. (2) G1GC concurrent marking threads — these compete for the same single CPU as application threads. (3) OS thread context switching — Tomcat's ~200 threads context-switch on I/O blocks, requiring kernel scheduler intervention for every switch."

### Detailed Technical Explanation

**Why Java hits CPU saturation:**

- Tomcat 200-thread pool: OS kernel scheduler manages context switches between threads blocking on Feign HTTP calls and DB queries
- Each context switch: ~1-10µs of kernel CPU overhead per switch × hundreds of switches/second = significant overhead
- G1GC concurrent threads: G1GC's `ConcurrentMark` and `Refinement` threads compete for CPU
- JIT recompilation: during ramp_1/ramp_2, JIT compiles critical paths — CPU spikes visible in graph

**Why Go is more CPU-efficient:**

- Goroutine scheduler runs in user space — no kernel syscall for goroutine switches
- Go runtime GOMAXPROCS=1 (effective with cpus:1.0): single OS thread executes goroutines cooperatively
- GC concurrent threads: Go's GC runs concurrently with low overhead (~5% CPU)

### Likely Interview Questions

1. What does CPU saturation at 98% mean for a production service?
2. Why does Java's CPU usage spike during ramp phases?
3. What is thread context switching and why does it consume CPU?
4. How does Go's goroutine scheduler reduce CPU overhead vs Tomcat threads?
5. What would happen to latency if Java CPU hit 100% for sustained periods?

### Common Mistakes

❌ "Java is using more CPU because it's doing more work" — Both stacks process the same requests. The overhead is from GC and thread scheduling, not business logic.
❌ Confusing `process_cpu_usage` (fraction 0-1) with `rate(process_cpu_seconds_total[1m])` — they measure the same thing but with different scales.

### Code Components

- `application.properties` → Feign timeouts (5s connect, 5s read) control how long threads block
- `docker-compose.ssp.yml` → `cpus: '1.0'` — the constraint being measured
- `database/db.go` → `SetConnMaxLifetime(30*time.Minute)` — affects DB connection churn

---

## Panel 3 — P99 HTTP Latency

**Metric:** `histogram_quantile(0.99, sum(rate(..._bucket[1m])) by (le, instance))`

### 30-Second Explanation

"For order creation, Java's P99 latency is 10.2 seconds — the worst 1% of requests take over 10 seconds. Go's P99 is 5.8 seconds. For inventory reads, both are under 3ms. The order P99 difference is caused by Java's G1GC stop-the-world pauses and Tomcat thread pool saturation under peak load."

### 2-Minute Explanation

"P99 latency shows the 99th percentile response time — 99% of requests are faster than this value. The inventory graph is nearly flat for both stacks at 2-3ms, reflecting cache hit efficiency. The order graph diverges significantly during the sustain phase.

Java's order P99 climbs to 10.2s because: when G1GC triggers a stop-the-world compaction (100-500ms), all in-flight Tomcat threads freeze. Requests that were mid-processing stall. At 200 VUs with 50 DB connections, some requests are also queued in the HikariCP pool waiting for a connection — these can stall for 2-5 seconds. The 1% worst requests are the ones that hit both a GC pause AND a pool wait."

### Detailed Technical Explanation

**How `histogram_quantile` works:**

```text
http_server_requests_seconds_bucket{le="1.0"} = 63,200   (63,200 requests < 1s)
http_server_requests_seconds_bucket{le="5.0"} = 64,350   (64,350 requests < 5s)
http_server_requests_seconds_bucket{le="10.0"} = 64,545  (64,545 requests < 10s)
http_server_requests_seconds_bucket{le="+Inf"} = 60,689  (all requests)

P99 = value v where 0.99 × 60,689 = 63,905 requests fall below v
     → Between le="5.0" (63,905 > 63,200) and le="10.0" (63,905 < 64,350)
     → Linear interpolation: ~10.2s
```

**Root cause chain for Java high P99:**

1. 200 VUs place orders concurrently
2. 50 Tomcat threads acquire DB connections; 150 queue in HikariCP
3. G1GC triggers 200ms STW pause → 50 active threads freeze mid-processing
4. Queued threads resume only after STW ends + connection available
5. Total wait: STW_pause + pool_wait = 200ms + up to 30s timeout
6. P99 captures these combined-worst requests

### Likely Interview Questions

1. Why is P99 order latency in SECONDS but inventory in MILLISECONDS?
2. Why does Go have lower P99 than Java despite slightly lower throughput?
3. How is `histogram_quantile` different from an exact percentile?
4. Why does P99 spike periodically rather than staying elevated?
5. What does it mean if P99 > P95 × 3?

### Common Mistakes

❌ "Low P99 means all requests are fast" — P99 only says 99% are faster; P99.9 (not measured) could be much higher.
❌ Not knowing the PromQL formula — be ready to write `histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket[1m])) by (le, instance))` from memory.
❌ Confusing K6's P99 with Prometheus's — K6 uses HDR histogram (exact); Prometheus uses bucket interpolation (approximate).

---

## Panel 4 — HTTP Throughput

**Metric:** `sum(rate(..._count[1m])) by (instance)`

### 30-Second Explanation

"Both Java and Go achieve approximately 108 RPS for inventory reads — a throughput tie. For order creation, Java processes 28.89 RPS vs Go's 27.67 RPS — Java is ~9% higher after JIT warmup. The inventory tie is because K6's sleep(1) pacing caps both services below their true maximum capacity."

### 2-Minute Explanation

"Throughput measures completed requests per second. During ramp phases, it increases with VU count. During sustain, it plateaus.

For inventory reads: the ~108 RPS plateau is a K6 artifact. With 200 VUs, each doing `sleep(1)` + ~1ms processing, the theoretical max is 200/(1+0.001) ≈ 200 RPS. But K6's JavaScript VM overhead limits actual VU iteration speed. Both runtimes are bounded by K6, not by service capacity. The tie is expected.

For order creation: Java reaches 28.89 RPS vs Go's 27.67 RPS. Java's JIT-optimized code paths (after warmup) process the multi-step order logic efficiently. Feign's persistent TCP connections reduce per-call overhead vs Go's HTTP client (even with shared transport). Go's slightly lower throughput reflects goroutine scheduling overhead during extremely high concurrent DB and HTTP operations."

### Likely Interview Questions

1. Why is inventory throughput the same for both stacks?
2. Why does Java have higher order throughput despite its higher latency?
3. What would change if `sleep(1)` was removed from K6?
4. How is RPS calculated from Prometheus counters?
5. What is Little's Law and how does it relate throughput to concurrency?

### Common Mistakes

❌ "Higher throughput means the service is faster" — throughput and latency trade off. Java has higher order throughput but also higher average latency (more in-flight requests simultaneously).
❌ Treating inventory throughput tie as meaningful — it's a K6 pacing artifact, not a capacity measurement.

---

## Panel 5 — Heap Memory / Memory Churn

**Metric:** `jvm_memory_used_bytes{area="heap"}` | `go_memstats_heap_alloc_bytes`

### 30-Second Explanation

"Java's heap graph shows a sawtooth — growing as new objects are allocated, then dropping when GC collects garbage. Go's heap is small and mostly flat because Go's GC runs more frequently with shorter cycles. The 5,076 Java data points (vs 1,692 for Go) are because JVM heap has 3 separate regions."

### 2-Minute Explanation

"This panel focuses on heap-managed memory — separate from total RSS. Java's heap has three G1GC regions: Eden (new objects), Survivor (recently GC'd survivors), and Old Gen (long-lived objects). Each is tracked separately — hence 3× the data points.

The sawtooth reflects GC cycles: Eden fills → minor GC promotes survivors → Old Gen accumulates → major collection drops heap. The frequency and amplitude of sawteeth indicates GC pressure. More frequent, deeper sawteeth = higher allocation rate = higher GC overhead = more CPU time stolen from request processing.

Go's `heap_alloc_bytes` tracks live heap objects only. It fluctuates less dramatically because Go's GC runs continuously in small increments rather than batch collections."

### Likely Interview Questions

1. What are G1GC heap regions (Eden, Survivor, Old Gen)?
2. Why does Java have 5,076 heap data points vs 1,692 for Go?
3. What causes heap usage to spike and drop?
4. What is the difference between heap allocated bytes and live bytes?
5. How does heap pressure affect P99 latency?

---

## Panel 6 — Garbage Collection Pauses

**Metric:** `rate(jvm_gc_pause_seconds_sum[1m])` | `rate(go_gc_duration_seconds_sum[1m])` | `rate(go_gc_duration_seconds_count[1m])`

### 30-Second Explanation

"Java shows periodic GC pause spikes — brief moments where the JVM stops all application threads for heap compaction. Go's GC runs continuously and concurrently — the pause rate is nearly flat and close to zero. This GC behavior difference directly causes Java's higher P99 latency."

### 2-Minute Explanation

"The GC pause rate metric shows seconds of GC pause activity per second. A value of 0.1 means 10% of real time is spent in GC pauses. Java spikes to 0.05-0.15 during active GC cycles. Go remains below 0.001 throughout.

Three Go metrics are shown: `gc_pause_rate_go_seconds` (total GC time rate), `gc_cycles_go_per_second` (how often GC runs — typically 2-5 cycles/second under load), and `gc_pause_rate_jvm_seconds` for Java.

The critical insight: Java's STW compaction pauses are what cause P99 spikes. During a 200ms G1GC compaction pause, all 60,689 outstanding Tomcat threads are frozen. Any request that was mid-Feign-call or mid-DB-query stalls for 200ms. Under 200 VUs, these 200ms pauses hit many concurrent requests simultaneously."

### Likely Interview Questions

1. What is a stop-the-world GC pause?
2. Why does Java have longer GC pauses than Go?
3. How does a GC pause translate to HTTP latency?
4. What is the difference between minor GC and major GC?
5. How would using ZGC (Java) change this graph?

### Common Mistakes

❌ "Go has no garbage collection" — Go absolutely has GC; it just runs concurrently with much shorter STW phases.
❌ Confusing GC pause rate (fraction of time) with GC cycle rate (frequency) — these are different metrics.

---

## Panel 7 — DB Connection Pool

**Metric:** `hikaricp_connections_active/pending` | `go_sql_in_use/open/idle_connections`

### 30-Second Explanation

"During peak load, HikariCP's active connections max out at 50. The `connections_pending` counter briefly shows non-zero values — threads waiting for a connection. This is what caused Java's 8 HTTP 500 errors. Go's `go_sql_in_use_connections` stays below the 50 limit without triggering timeouts."

### 2-Minute Explanation

"This panel shows how each runtime uses its database connection pool. Both are configured to max 50 connections, min 10 idle.

Under 200-VU order load with ~2.5s average response time and multi-step DB operations, effective DB demand exceeds 50 connections. HikariCP queues threads when pool is exhausted — `connections_pending > 0`. If a thread waits longer than `connectionTimeout=30s`, it throws `SQLTimeoutException` → HTTP 500.

Go's pool shows similar in-use counts (40-48 connections at peak) but doesn't trigger timeouts. Go goroutines yield their OS thread while waiting for a DB connection — they don't block the thread. Tomcat threads hold their OS thread while waiting — reducing effective parallelism and increasing the probability of timeout cascades."

### Likely Interview Questions

1. What does `hikaricp_connections_pending > 0` indicate?
2. Why did Java fail 2 requests while Go failed 0?
3. What is the difference between a pool connection and a DB connection?
4. What happens when a thread waits > connectionTimeout for a pool slot?
5. Why is max 50 connections a reasonable choice for PostgreSQL?

---

## Panel 8 — Concurrency Model (Threads vs Goroutines)

**Metric:** `jvm_threads_live_threads` | `go_goroutines`

### 30-Second Explanation

"Java maintains ~200-250 live OS threads throughout the test — Tomcat's thread pool plus JVM internals. Go maintains only 20-50 goroutines. This 5-10× difference in execution units explains the memory difference: 200 threads × 1MB stack = 200MB just for stacks. 50 goroutines × 2KB = 100KB."

### 2-Minute Explanation

"Thread count reflects the concurrency architecture of each runtime. Java's line starts around 30 threads (Spring Boot startup) and climbs to 200+ as Tomcat's thread pool fills under load. It stays elevated throughout sustain because Tomcat pre-creates threads to serve requests.

Go's goroutine count is much lower and more volatile. Gin creates a goroutine per connection, but goroutines are created and destroyed rapidly — they're cheap. At 28 RPS with 2.9s response time, average in-flight requests = 81. But goroutines for completed requests are immediately garbage collected. The baseline of ~10 goroutines includes: Gin's internal acceptor goroutines, background goroutines for Prometheus scraping, DB connection keepalives, and the Go GC coordinator."

### Likely Interview Questions

1. Why does Java need 200+ threads while Go needs only 20-50 goroutines?
2. What is the memory cost difference between a thread and a goroutine?
3. What is the Go GMP scheduler model?
4. Does Go always have fewer goroutines than Java has threads?
5. What is a goroutine leak and how would it appear in this graph?

### Common Mistakes

❌ "More goroutines = more parallelism" — GOMAXPROCS limits OS-level parallelism. Goroutine count measures concurrency units, not parallel execution.
❌ "Java's high thread count is a problem" — Tomcat's 200-thread pool is intentional design for thread-per-request model. It becomes a problem only when threads starve for CPU.

---

## Panel 9 — HTTP Error Rate

**Metric:** `rate({status=~"5.*"}[1m])` (Java) | `rate({code=~"5.*"}[1m])` (Go)

### 30-Second Explanation

"Go produced zero HTTP errors throughout the entire benchmark. Java produced 8 HTTP 500 errors during peak load — caused by HikariCP connection pool timeout. The critical label difference: Spring uses `status`, Gin uses `code`. Using the wrong label in PromQL returns empty results, making it appear Go has no data."

### 2-Minute Explanation

"The error rate panel monitors 5xx HTTP responses per second. A non-zero value indicates service-level failures, not client errors (4xx).

For Java: 8 errors across 60,689 requests = 0.013% error rate — well within the K6 threshold of `rate<0.01` (1%). These errors occurred during the `sustain` phase when the system was under maximum 200-VU concurrent load. Root cause: `HikariCP` pool exhausted, Tomcat thread waited >30s for a connection → `SQLTimeoutException` → Spring returned HTTP 500.

For Go: 0 errors across 58,153 requests. Go goroutines handled pool pressure more gracefully — goroutines yielding OS threads when blocking prevented the wait-chain cascade that caused Java's timeouts.

The label mismatch (`status` vs `code`) is a real operational gotcha. If both stacks used the same PromQL query, Go's error panel would show 'No Data' — falsely suggesting Go metrics are missing, not that Go had no errors."

### Likely Interview Questions

1. What caused Java's 8 HTTP 500 errors?
2. Why is `{code=~"5.*"}` used for Go but `{status=~"5.*"}` for Java?
3. What is the difference between 4xx and 5xx errors?
4. How would you set up an alert for error rate > 0.1%?
5. What K6 threshold enforces error rate limits?

### Common Mistakes

❌ Using `{status=~"5.*"}` in Go's PromQL — returns empty results since Gin uses `code` label.
❌ "Java is unreliable" — 8 errors in 60,689 requests = 0.013% error rate. Well within production SLA.
❌ Treating missing Go error data as "Go never has errors" — verify by checking the metric's label names in `/metrics`.
