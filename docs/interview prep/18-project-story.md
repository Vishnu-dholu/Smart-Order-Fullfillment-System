# 18 — Project Story

> Polished narratives for interviews, viva, and research presentations.

---

## 1-Minute Pitch

> "I built a **performance benchmarking research project** disguised as a Smart Order Fulfillment System. The real goal was to empirically compare **Java Spring Boot** and **Go Gin** microservices under realistic e-commerce load.
>
> I built the same order and inventory services twice — once in Spring Boot, once in Go — with identical API contracts and database schemas. I then equalized every infrastructure parameter: 1 CPU, 768MB RAM per container, 50 DB connections maximum for both. I ran K6 load tests at up to 200 concurrent users for 35 minutes, collecting 9 system metrics via Prometheus every 5 seconds.
>
> The key findings: Go consumed **7-9× less memory** across workloads. For write-heavy order creation, Java matched Go's throughput after JIT warmup — but Go had **45% lower P99 tail latency**. For read-heavy catalog lookups, both achieved the same throughput but Go was **29% faster on average latency**."

---

## 3-Minute Story

> "Let me walk you through the story of this project.
>
> **The Problem:**
> When choosing between Java and Go for a new microservice, engineers typically rely on benchmarks — but most public benchmarks test trivial 'hello world' endpoints. They don't capture the real complexity of production systems: downstream HTTP calls, database transactions, location-based routing algorithms, asynchronous notifications.
>
> I wanted to answer: *In a realistic microservice with real business logic, do Go's architectural advantages — goroutine concurrency, AOT compilation, lower memory footprint — translate to measurably better performance?*
>
> **The Architecture:**
> I built an order fulfillment system with 6 business microservices. The interesting part: each critical service was implemented TWICE — once in Java Spring Boot and once in Go Gin — with identical API contracts. I called these the 'twins.' The Java `order-service` and Go `order-twin` implement the same endpoint: POST /orders. Inside, they both validate product prices, run the Haversine great-circle distance formula to find the nearest warehouse, deduct stock atomically, save to PostgreSQL, and fire an async notification.
>
> **The Fairness Problem:**
> Early tests showed Go was faster — but was that because of the runtime, or because Go was getting more DB connections? I equalized everything: Docker resource limits (1 CPU, 768MB for both), database connection pools (50 max for HikariCP and `database/sql`), HTTP client pools (Go's transport configured with `MaxIdleConnsPerHost=50` to match Feign's default).
>
> **The Benchmark:**
> K6 ran 35-minute staged load tests: from 10 VUs at warmup to 200 VUs at peak, then 10 minutes of sustained load. I included a 5-minute JVM warmup so Java's JIT compiler could optimize before I started measuring. Prometheus scraped metrics every 5 seconds. A Python script exported 37,692 time-series data points annotated with load phases into CSV files.
>
> **The Findings:**
> For read-heavy inventory lookups: both hit ~108 requests per second (throughput parity), but Go's in-memory cache using `sync.RWMutex` was 29% faster on average latency than Spring's `@Cacheable`. For write-heavy order creation: Java matched Go on throughput after JIT warmup, but Go's P99 tail latency was 45% lower — because Go's goroutine scheduler avoids OS thread context-switching overhead during G1GC stop-the-world pauses. And across both workloads, Go used 7-9× less memory — critical for container-dense deployments."

---

## 5-Minute Technical Story

> **Opening:**
> "This project is fundamentally a performance benchmarking study, not a CRUD application. The e-commerce order fulfillment system is the vehicle — the empirical runtime comparison is the goal."
>
> **Section 1 — Architecture (1 minute):**
> "The architecture has three layers. The application layer has 8 microservices split into a control group — Java Spring Boot — and a test group — Go Gin twins. The critical design is the 'cross-stack warehouse routing': the Java order service calls the Go warehouse service, and vice versa. This prevents same-language affinity from skewing results.
>
> The observability layer is Prometheus scraping both stacks' metrics endpoints every 5 seconds. Java exposes `/actuator/prometheus` via Micrometer. Go exposes `/metrics` via `go-gin-prometheus`. Grafana visualizes 9 metric panels in real-time.
>
> The benchmarking layer is K6 running outside Docker, targeting both stacks' ports. A Python script queries Prometheus's range API after tests to export structured CSVs."
>
> **Section 2 — The Order Placement Flow (1 minute):**
> "Both the Java `order-service` and Go `order-twin` implement the same business logic. When POST /orders arrives: (1) validate each item by calling inventory service for current price via Feign or Go HTTP client; (2) query the warehouse service for all locations with sufficient stock; (3) apply the Haversine great-circle formula to find the geographically nearest warehouse; (4) deduct stock atomically in a database transaction; (5) save the order with JPA or GORM; (6) fire an async notification via Java `new Thread()` or Go goroutine."
>
> **Section 3 — Equalization (45 seconds):**
> "Fair comparison required equalizing three resource classes. (1) Compute: Docker `cpus: 1.0, memory: 768M` for all containers. (2) Database pools: HikariCP max 50 configured in `application.properties`. Go's `database/sql` configured to match with `SetMaxOpenConns(50)`. (3) HTTP clients: I discovered Go was creating one HTTP client per request — no connection reuse — artificially penalizing Go. I added a shared `http.Transport` with `MaxIdleConnsPerHost: 50` matching Feign's default."
>
> **Section 4 — Results (1 minute):**
> "For write-heavy order creation at 200 VUs: Java processed 60,689 requests at 28.89 RPS; Go processed 58,153 at 27.67 RPS. Java had 9% higher throughput — JIT compilation optimizes the hot path after warmup. But Go's P99 latency was 5.8 seconds versus Java's 10.2 seconds — 45% lower. Why? G1GC's stop-the-world compaction pauses cause millisecond-to-second latency spikes that show up in tail percentiles. Go's concurrent garbage collector keeps STW pauses under 1 millisecond.
>
> For read-heavy inventory lookups: throughput was identical (~108 RPS), but Go achieved 26% lower average latency. The reason: Go's `sync.RWMutex` cache has virtually no overhead — a direct map lookup under a read lock. Spring's `@Cacheable` adds AOP proxy interception, SpEL key evaluation, and Jackson deserialization overhead.
>
> Memory was the most dramatic difference: Go services ran at 30-62MB RSS versus Java's 350-580MB — 7-9× lower."
>
> **Section 5 — Lessons (30 seconds):**
> "The most important lesson was the 'thundering herd' problem with HTTP client pools. Without the shared transport, Go appeared 20% slower than it actually was due to TCP handshake overhead. This taught me that fair benchmarking requires equalizing invisible infrastructure parameters, not just the application code. A second lesson: average latency can hide GC pause effects that only appear at P99."

---

## 10-Minute Deep Technical Dive

> *(Use 5-minute story as foundation, then add each section below:)*
>
> **On the database design:**
> "I chose database-per-service isolation — 6 separate PostgreSQL databases: `auth_db`, `order_db`, `inventory_db`, `warehouse_db`, `delivery_db`, `notification_db`. Services never JOIN across databases — they use HTTP calls for cross-service data. This created an interesting design challenge: the `global_inventory` table in `inventory_db` needs to stay synchronized with the sum of all `warehouse_stock` rows in `warehouse_db`. I solved this with an eventual consistency pattern — the warehouse service calls `PUT /products/{id}/sync-stock` to update the global inventory aggregation after every stock change."
>
> **On the instrumentation challenge:**
> "Getting comparable metrics from both stacks required careful configuration. For Java, Micrometer auto-instruments everything — but by default, it only emits pre-computed quantile summaries, not histogram buckets. Pre-computed summaries cannot be aggregated across service instances using `sum()`. I needed `histogram_quantile(0.99, ...)` in Prometheus, which requires raw bucket data. Adding `management.metrics.distribution.percentiles-histogram.http.server.requests=true` to `application.properties` enabled bucket emission and unlocked correct P99 computation.
>
> For Go, I discovered that `go-gin-prometheus` uses the label `code` for HTTP status, while Spring Actuator uses `status`. My first error rate PromQL queried `{status=~"5.*"}` against Go metrics — returning empty results. The fix: separate PromQL queries for each stack using their respective label names."
>
> **On the K6 design choices:**
> "The benchmark uses deterministic product selection: `productId = PRODUCTS[__ITER % PRODUCTS.length]`. Random selection would cause probabilistic clustering — multiple VUs hitting the same product simultaneously, causing stock contention and 409 errors. Round-robin distributes load evenly. I also randomized the execution order between Java and Go using `ORDER_FLIP=$((RANDOM % 2))` to prevent temporal bias — the second test always runs in a slightly different system state (warmer caches, post-GC state)."
>
> **On what I would do differently:**
> "Three improvements. First, run each benchmark 5+ times and report confidence intervals — the current dataset is a single run, which limits statistical significance. Second, use `GOMAXPROCS=1` explicitly in the Go container — without it, Go creates OS threads based on host CPU count despite the container CPU limit. Third, implement a Saga pattern for the order placement distributed transaction — the current design has a real data consistency bug where stock deduction cannot be rolled back if the order DB save fails."
