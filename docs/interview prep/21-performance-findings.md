# 21 — Performance Findings

---

## Performance Benchmark Dataset

This document lists the empirical findings gathered from the 35-minute staged load benchmark comparing the Java Spring Boot stack and the Go Gin stack under identical resource limits (1 CPU, 768MB RAM) and database pools.

---

## 1. Inventory Read Benchmark (`GET /products/{id}`)

This workload tests read performance and caching efficiency using 200 concurrent Virtual Users (VUs).

### Metric Comparison Table

| Metric Category | Java Spring Boot | Go Gin Twin | Performance Winner |
| ----------------- | ------------------ | ------------- | -------------------- |
| **Throughput (Sustain Phase)** | $108.14$ req/sec | $108.21$ req/sec | **Tie** |
| **Total Completed Requests** | $227,167$ | $227,257$ | **Tie** |
| **P99 Latency (Sustain Phase)** | $2.73$ ms | $2.36$ ms | **Go Gin (11.6% faster)** |
| **Average Latency (Sustain)** | $1.46$ ms | $1.03$ ms | **Go Gin (24.4% faster)** |
| **Failed HTTP Requests** | $0$ (0.00%) | $0$ (0.00%) | **Tie** |
| **Memory Footprint (RSS)** | $350$ MB | $45$ MB | **Go Gin (8.1x less memory)** |
| **CPU Usage Rate (Sustain)** | $42.1\%$ | $24.8\%$ | **Go Gin (1.7x more efficient)** |

### Analysis & Observations

1. **Throughput Parity:** Both stacks hit a flat throughput ceiling of $\approx 108$ requests per second. This is because K6 paced the requests using a `sleep(1)` statement, capping throughput based on VU count.
2. **Read Latency:** Go achieved a 2.36ms P99 latency compared to Java's 8.73ms. This minor latency difference is due to Go's lightweight `sync.RWMutex` cache, which bypassed database I/O for hit items without the proxy and annotation reflection overhead of Spring Cache.
3. **Memory Footprint:** The JVM required a minimum of 350MB of RSS memory, while the Go process remained stable at 45MB under active load. Go's runtime footprint is significantly smaller because it compiles to a native binary without JVM class-loading and metadata overhead.

---

## 2. Order Write Benchmark (`POST /orders`)

This write-heavy workload tests business logic execution, location-based routing, database transactions, downstream service calls, and asynchronous notifications using 200 concurrent VUs.

### Metric Comparison Table

| Metric Category | Java Spring Boot | Go Gin Twin | Performance Winner |
| ----------------- | ------------------ | ------------- | -------------------- |
| **Throughput (Sustain Phase)** | $28.89$ req/sec | $27.67$ req/sec | **Java (9.3% higher)** |
| **Total Completed Requests** | $60,689$ | $58,153$ | **Java (9.3% more requests)** |
| **P99 Latency (Sustain Phase)** | $10,327$ ms | $5,597$ ms | **Go Gin (45.8% lower tail)** |
| **Average Latency (Sustain)** | $2,560$ ms | $2,883$ ms | **Java (11.2% lower)** |
| **Failed HTTP Requests** | $2$ (0.013%) | $0$ (0.00%) | **Go Gin (Zero errors)** |
| **Memory Footprint (RSS)** | $580$ MB | $62$ MB | **Go Gin (9.3x less memory)** |
| **CPU Usage Rate (Sustain)** | $98.2\%$ (Saturated) | $82.4\%$ | **Go Gin (More head room)** |

### Analysis & Observations

1. **Write Throughput & Latency:**
   - Java achieved slightly higher throughput ($28.89$ RPS vs $27.67$ RPS) and lower average latency ($2.56$s vs $2.88$s). This was because Java's OpenFeign client pool reused active TCP connections efficiently.
   - Go showed a lower P99 tail latency ($5.59$s vs $10.32$s). Go's concurrency model (goroutines) prevented request timeouts when Tomcat's thread pool saturated under peak concurrent load.
2. **CPU Saturation:**
   - The Java Spring Boot container hit $98.2\%$ CPU utilization during the sustain phase, indicating CPU saturation on the single-core limit. This was driven by thread scheduling overhead, context switching, and J1GC execution.
   - The Go twin stayed at $82.4\%$ CPU utilization, leaving $17.6\%$ headroom.
3. **HTTP Failures:**
   - Java failed 2 requests under peak load due to HikariCP pool timeouts when Tomcat threads waited longer than 30 seconds for a connection. Go completed all requests successfully.

---


---

## 3. Phase-wise Load Analysis

The benchmark utilized a staged K6 load profile to observe system behavior under varying levels of concurrency. 

### Warmup (0-300s, 10 VUs)
- **Java:** CPU utilization was low (avg 2.0%, max 52.8% during initial JIT spikes). Throughput was 1.18 RPS. GC pause rate was near zero.
- **Go:** CPU was incredibly low (avg 0.2%). Throughput was 1.20 RPS. Goroutines hovered around 10. 
- **Observation:** Both systems handle minimal load easily, but Java's initial CPU spikes indicate HotSpot JIT compiling bytecode to native code for the hot paths.

### Ramp 1 & 2 (300-900s, 50-100 VUs)
- **Java:** Throughput scaled almost linearly from 7.3 RPS to 17.6 RPS. The HikariCP active connections grew to 50, reaching the pool limit. Pending connections began to queue.
- **Go:** Throughput scaled linearly from 8.6 RPS to 21.1 RPS. `go_sql_in_use_connections` remained low (avg 2.1) despite the load, showcasing efficient connection yielding.
- **Observation:** Java's thread-per-request model begins to strain the HikariCP pool. Threads block while waiting for connections, inflating the live thread count to 233.

### Ramp 3 & Sustain (900-1800s, 200 VUs)
- **Java:** Throughput plateaus around 28.89 RPS. HikariCP pending connections explode to a maximum of 150. CPU spikes frequently to 35-52%. The G1GC pause rate hits a maximum of 98.8 ms/s. This combination of STW pauses and connection pool starvation causes 8 HTTP 500 errors and severe P99 latency spikes (14.5s max).
- **Go:** Throughput plateaus at 27.67 RPS (statistically tied with Java). Goroutines peak at 766, but memory remains low (max 48.6 MB). GC pause rate is practically non-existent (0.8 ms/s max). Zero HTTP errors.
- **Observation:** Go is fundamentally more resilient under pool-saturating concurrency. Goroutines yield the OS thread when waiting for a database connection, whereas Tomcat threads hold the OS thread and block, leading to catastrophic tail latency and timeouts.

### Cooldown (1800-2100s, 200 -> 0 VUs)
- **Java:** Live threads remain high (636) as Tomcat does not immediately destroy idle threads. 
- **Go:** Goroutines drop rapidly back to baseline (~60). Memory stabilizes.
- **Observation:** Go's runtime cleans up concurrency units much faster and cheaper than Java's JVM.

## Key Performance Takeaways

1. **Go wins on resource utilization:** Go Gin consumed 7x to 9x less memory and used less CPU, making it cheaper to run in containerized environments.
2. **Java matches throughput on long runs:** For compute-heavy workloads, Java's HotSpot JIT compiler optimizes bytecode to native code, allowing Spring Boot to match or exceed Go's throughput.
3. **Go handles tail latency better:** Go's lightweight runtime concurrency model handles thread saturation better, leading to lower P99 tail latencies under heavy load.
