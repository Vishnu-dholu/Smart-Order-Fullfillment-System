# 15 — Interview Questions

> 150+ project-specific interview questions with detailed answers, categorized by difficulty, with follow-up questions and common mistakes.

---

## CATEGORY: PROJECT OVERVIEW

### Easy

**Q1: What is the Smart Order Fulfillment System?**
**A:** A performance benchmarking research project that compares Java Spring Boot and Go Gin microservices under realistic e-commerce load. It implements a functional order fulfillment system (product catalog, order placement, warehouse routing, notifications) and uses K6, Prometheus, and Grafana to measure throughput, latency, CPU, memory, GC, and database connection pool behavior across both runtimes.

**Q2: How many services does the project have?**
**A:** 8 total: `inventory-service` (Java), `order-service` (Java), `inventory-twin` (Go), `order-twin` (Go), `warehouse-go` (Go), `warehouse-java-twin` (Java), `delivery-service` (Go), `notification-service` (Go). Plus Prometheus, Grafana, and PostgreSQL.

**Q3: What ports do the services run on?**
**A:** inventory-java:8082, order-java:8083, inventory-go-twin:9082, order-go-twin:9083, warehouse-go:8084, warehouse-java-twin:9084, delivery:8085, notification:8086, Prometheus:9090, Grafana:3000.

---

### Medium

**Q4: Why is this project called a "benchmarking project" and not just a microservices project?**
**A:** Every design decision — equalized resource limits, connection pool parity, matched HTTP client pools, randomized execution order, 35-minute staged K6 ramp — exists to enable a fair, reproducible runtime comparison. The functional order fulfillment logic is the vehicle, not the goal. The goal is empirical measurement of JVM vs Go runtime characteristics.

**Q5: What two workload types were benchmarked and why?**
**A:** (1) Write-heavy: POST /orders — tests multi-service coordination, DB transactions, Haversine computation, and async notifications. (2) Read-heavy: GET /products/{id} — tests pure cache efficiency. Separating workloads isolates where each runtime excels.

**Q6: What is the "twin" architecture?**
**A:** Java services (`inventory-service`, `order-service`) have functionally identical Go counterparts (`inventory-twin`, `order-twin`) with the same API contracts, same database schemas, and same business logic. This enables K6 to benchmark the same operations against both runtimes without changing the test script.

---

## CATEGORY: JAVA SPRING BOOT

### Easy

**Q7: What does `@SpringBootApplication` do?**
**A:** Combines three annotations: `@SpringBootConfiguration` (marks as config class), `@EnableAutoConfiguration` (triggers auto-configuration based on classpath), and `@ComponentScan` (scans current package for beans). It is the entry point that bootstraps the entire application.

**Q8: What is `@Transactional`?**
**A:** A Spring AOP annotation that wraps the method in a database transaction. On unchecked `RuntimeException`, Spring rolls back. On success, it commits. Located in `OrderService.java:36` wrapping `placeOrder()`.

**Q9: What is `@Cacheable`?**
**A:** Spring AOP interceptor. Before the annotated method runs, Spring checks the named cache for the key. On cache hit, returns cached value without executing the method. On miss, executes the method and stores the result. Used in `ProductService.java:46`: `@Cacheable(value="products", key="#id")`.

**Q10: What is `@FeignClient`?**
**A:** Annotation that creates a JDK dynamic proxy implementing the annotated interface as an HTTP client. Spring registers this proxy as a bean. When a method is called, the proxy translates it to an HTTP request. Found in `InventoryClient.java`, `WarehouseClient.java`, etc.

**Q11: What does `@EnableFeignClients` do and where is it?**
**A:** On `OrderServiceApplication.java:8` — tells Spring Boot to scan for `@FeignClient` interfaces and create proxy beans for them. Without it, no Feign clients are created regardless of interface annotations.

---

### Medium

**Q12: How does Spring Data JPA generate SQL from method names?**
**A:** Spring's method name parser splits the method name into tokens at camelCase boundaries. `findByUserIdOrderByCreatedAtDesc` → `WHERE user_id = ?` + `ORDER BY created_at DESC`. Located in `OrderRepository.java`.

**Q13: What is the N+1 query problem and does this project have it?**
**A:** N+1: fetching N parent entities then making N separate child queries. In `getAllOrders()`, `orderRepository.findAll()` loads all orders (1 query), then `order.getItems()` triggers a separate `SELECT` per order (N queries). Fix: `@EntityGraph` or `JOIN FETCH` in JPQL.

**Q14: Why use `BigDecimal` for price instead of `double`?**
**A:** Floating-point arithmetic is imprecise: `0.1 + 0.2 = 0.30000000000000004` in double. For monetary values, `BigDecimal` provides exact decimal arithmetic. Used in `Order.java` (`totalAmount`) and `OrderItem.java` (`priceAtPurchase`).

**Q15: Explain the `@OneToMany(cascade = CascadeType.ALL)` in `Order.java`.**
**A:** `@OneToMany` maps the one-to-many relationship between Order and OrderItems. `CascadeType.ALL` propagates all JPA operations (PERSIST, MERGE, REMOVE, REFRESH, DETACH) from Order to its Items. When `orderRepository.save(order)` is called, all `OrderItems` in `order.items` are also persisted automatically.

**Q16: What is the difference between `@JsonIgnore` and not annotating?**
**A:** `@JsonIgnore` tells Jackson to exclude that field from serialization/deserialization. In `OrderItem.java`, `@JsonIgnore` is on the `order` field. Without it, Jackson would serialize `Order → Items → Order → Items` infinitely, causing a `StackOverflowError`.

---

### Hard

**Q17: If `placeOrder()` is `@Transactional`, what happens if Feign call to warehouse succeeds but DB save fails?**
**A:** The `@Transactional` rolls back the database operations (no order saved). But the Feign HTTP call to warehouse is outside the transaction — the stock deduction already happened and CANNOT be rolled back by Spring. This is a distributed transaction inconsistency bug. The warehouse has less stock but no corresponding order exists. Fix: implement a Saga pattern with compensating transactions.

**Q18: How does `@Cacheable` handle concurrent cache misses (thundering herd)?**
**A:** Spring's default `ConcurrentMapCacheManager` uses a `ConcurrentHashMap`. On a cache miss, multiple threads can concurrently execute the method (e.g., DB query). All threads will write to the cache. The last write wins, but all DB queries execute. Fix: use Caffeine cache with `expireAfterWrite` and `maximumSize`, or add a `@CachePut` with proper locking.

**Q19: What is the difference between `GenerationType.UUID`, `IDENTITY`, `SEQUENCE`, and `AUTO`?**
**A:** `UUID` (Spring Boot 3+): delegates to `gen_random_uuid()` in PostgreSQL. `IDENTITY`: uses DB auto-increment column. `SEQUENCE`: uses PostgreSQL sequences (batched). `AUTO`: Spring picks based on dialect. The project uses `GenerationType.UUID` — DB-generated UUIDs avoid collisions in distributed inserts.

**Q20: Why does `management.metrics.distribution.percentiles-histogram.http.server.requests=true` matter so much?**
**A:** Without this, Micrometer emits only pre-computed quantile summaries. These are NOT aggregatable via `sum()` because pre-computed percentiles from different instances can't be mathematically combined. `histogram_quantile()` in Prometheus requires raw bucket data (`_bucket` metrics). This setting enables bucket emission, making PromQL P99 computation possible.

---

### Expert

**Q21: How does Spring's AOP proxy work for `@Transactional` and `@Cacheable`?**
**A:** Spring creates a CGLIB subclass proxy of the bean at startup. When a method annotated with `@Transactional` or `@Cacheable` is called from OUTSIDE the bean, the proxy intercepts the call and runs the advice (begin transaction, check cache, etc.). When called from WITHIN the same bean (self-invocation), the proxy is bypassed — `@Transactional` and `@Cacheable` don't work for self-calls. This is a well-known Spring gotcha.

**Q22: How does HikariCP prevent connection starvation under 200 VUs?**
**A:** HikariCP maintains a pool of reusable connections. When Tomcat's thread requests a connection and all 50 are in use, the thread blocks in `getConnection()` for up to `connectionTimeout` (30s default). If it exceeds timeout, `SQLTimeoutException` is thrown. This is what caused the 2 HTTP failures in the Java order benchmark — Tomcat threads waited > 30s for a HikariCP connection under peak load.

---

## CATEGORY: GO

### Easy

**Q23: What is a goroutine?**
**A:** A lightweight user-space concurrent execution unit managed by Go's runtime scheduler. Initial stack ~2KB (grows dynamically). Created with `go func(){}()`. Used in `order_handler.go:289` for async notifications.

**Q24: What does `sync.RWMutex` do?**
**A:** A mutual exclusion lock that allows multiple concurrent readers or one exclusive writer. `RLock()/RUnlock()` for reads (concurrent OK). `Lock()/Unlock()` for writes (exclusive). Used in `inventory-twin/product_handler.go` for the product cache: multiple goroutines read cached products concurrently.

**Q25: What is Go's implicit interface?**
**A:** In Go, a type satisfies an interface if it has all the required methods — no explicit `implements` declaration needed. Example: `func CreateOrder(c *gin.Context)` satisfies `gin.HandlerFunc` (which is `func(*gin.Context)`) without any explicit declaration.

---

### Medium

**Q26: Why use `sync.RWMutex` instead of `sync.Mutex` for the product cache?**
**A:** Under 200 VUs, 200 goroutines simultaneously read the same cached products. With `sync.Mutex`, reads would be serialized — only 1 goroutine reads at a time. With `sync.RWMutex`, all 200 goroutines can hold `RLock()` simultaneously. Writes (cache updates on miss) still exclusive. Result: 200× better concurrency for reads.

**Q27: What is the difference between Go's goroutine and a Java thread at 200 VUs?**
**A:** Java: 200 OS threads (Tomcat) + ~50 background threads = ~250 threads total. Each thread: 1MB stack, kernel-scheduled. Go: ~20-40 goroutines for active requests (Gin creates per-connection goroutines that complete fast) + ~10 background goroutines. Each goroutine: ~2KB stack, user-scheduled by Go runtime. At 200 VUs, Java uses ~250MB just for thread stacks; Go uses ~100KB.

**Q28: Why was a shared `http.Transport` pool added to the Go clients?**
**A:** Without it, each HTTP call to warehouse/inventory services created a new `http.Client{}` which used the default `DefaultTransport` with `MaxIdleConnsPerHost: 2`. Under 200 concurrent order placements, Go would open 200 simultaneous TCP connections per target host. Feign (Java) reuses pooled connections. The fix: `httpclient.go` creates a shared transport with `MaxIdleConnsPerHost: 50` matching Feign's behavior. **Code:** `services/go/order-twin/internal/clients/httpclient.go`.

**Q29: How does Go's garbage collector differ from JVM G1GC?**
**A:** Go: concurrent tri-color mark-and-sweep. Runs alongside application goroutines. STW pauses < 1ms (for write-barrier synchronization). Higher GC frequency. JVM G1GC: divides heap into regions, does generational collection. Has longer STW pauses (10ms-100ms) during compaction but lower overall GC CPU overhead. In benchmarks: Go showed more frequent but shorter GC cycles; Java showed less frequent but longer GC pauses that cause P99 latency spikes.

---

### Hard

**Q30: What is `GOMAXPROCS` and how does Docker's `cpus: 1.0` affect it?**
**A:** `GOMAXPROCS` controls how many OS threads Go creates for goroutine execution. Default: `runtime.NumCPU()` — reads host CPU count. Docker's `cpus: 1.0` limits CPU via cgroup quota but doesn't change what `runtime.NumCPU()` returns (still returns host count). Result: Go may create 8 OS threads on an 8-core host but only gets 1 CPU's worth of time. Fix: `GOMAXPROCS=1` env var ensures Go doesn't create excess OS threads.

**Q31: What happens if two goroutines simultaneously call `GetProductById` for the same uncached product?**
**A:** Both pass `RLock()` check (not in cache), both query the DB simultaneously (two identical DB queries), both try to `Lock()` and write to cache. The second write is a no-op (same value). No data corruption occurs because map access is protected. This is the same thundering herd problem as Java's `@Cacheable`, but the duplicate DB queries are harmless and short-lived.

**Q32: Explain the explicit GORM transaction in `CreateOrder()`. When does it commit/rollback?**
**A:** `database.DB.Transaction(func(tx *gorm.DB) error {...})` — GORM begins a transaction, passes a `*gorm.DB` scoped to that transaction. If the function returns `nil`, GORM commits. If it returns an error, GORM rolls back. In `order_handler.go:104-118`: creates Order then OrderItems in one transaction. If `tx.Create(&orderItems)` fails, both the Order and Items are rolled back atomically.

---

## CATEGORY: BENCHMARKING

### Easy

**Q33: Why was K6 chosen for load testing?**
**A:** K6 is written in Go (lightweight on host), uses JavaScript for scripting (flexible payload generation), supports staged VU ramps (`ramping-vus` executor), has native threshold support (`p(99)<500`), produces machine-readable JSON summaries, and allows phase tagging for measurement isolation.

**Q34: What is a Virtual User (VU) in K6?**
**A:** An independent JavaScript execution loop simulating a single client. Each VU runs the `default` function repeatedly, executes HTTP requests, checks responses, and sleeps between iterations. 200 VUs = 200 concurrent client simulations.

**Q35: Why is P99 used instead of average latency?**
**A:** Average hides tail latency outliers. In production, the 1% of requests that trigger GC pauses, thread contention, or connection pool saturation are exactly the requests users notice as timeouts. P99 = the worst 1% of requests — directly correlates with user-visible SLA violations.

**Q36: What does `scrape_interval: 5s` mean?**
**A:** Prometheus polls each target's `/metrics` or `/actuator/prometheus` endpoint every 5 seconds, reads all metric values, and stores them as time-series data points. A lower interval means higher resolution data but more storage.

---

### Medium

**Q37: Why is there a 5-minute warmup phase in K6?**
**A:** JVM warmup: JVM starts in interpreter mode. HotSpot JIT compiles hot methods after ~10,000 invocations. At 10 VUs × 60 req/min, this takes ~17 minutes. At higher rates, warmup completes sooner. The 5-minute warmup at 10 VUs allows the JIT to start optimizing before peak load. Without warmup, Java's early benchmark data is polluted by interpreter overhead, artificially penalizing Java.

**Q38: How does phase tagging in K6 work for thresholds?**
**A:** Scenarios have `tags: { phase: 'warmup' }` and `tags: { phase: 'measurement' }`. K6 tags every metric emitted during that scenario with these labels. Thresholds can target tagged metrics: `'http_req_duration{phase:measurement}': ['p(99)<500']`. This evaluates SLA compliance only during the measurement phase, excluding warmup.

**Q39: What is `histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket[1m])) by (le, instance))`?**
**A:** Breaking down: `http_server_requests_seconds_bucket` — histogram bucket counters from Micrometer. `rate(...[1m])` — per-second rate over 1-minute window. `sum(...) by (le, instance)` — aggregate across all endpoints per service instance (must keep `le` for quantile computation). `histogram_quantile(0.99, ...)` — computes the 99th percentile from the bucket distribution.

**Q40: Why is `step=15s` used in the Python exporter, not `5s`?**
**A:** `step` is the resolution of the range query. Using `5s` would match the scrape interval exactly, producing 3× more data points (~112,000 vs 37,692). `15s` provides sufficient granularity (one point every 15 seconds over 35 minutes = ~140 points per metric per segment) while keeping the dataset manageable. 37,692 points cover all 21 metrics × 4 segments × ~3 instances each.

---

### Hard

**Q41: What is cardinality in Prometheus and why does it matter?**
**A:** Cardinality = number of unique label value combinations. `http_server_requests_seconds_bucket{le="0.05", method="POST", status="201", uri="/orders", instance="order-java:8083"}` — each unique combination of all label values = one time series. High-cardinality labels (e.g., adding `user_id` as a label) would create millions of time series, exhausting Prometheus memory. The project uses low-cardinality labels only.

**Q42: What is the `error_rate_go_rps` metric and why does it have only 0 data points for Go?**
**A:** The `error_rate_go_rps` PromQL queries `gin_request_duration_seconds_count{code=~"5.*"}`. During the benchmark, Go returned 0 HTTP errors — the metric exists but has value 0.0 throughout. `error_rate_spring_rps` has 362 data points because Prometheus emits a data point only when the count is nonzero (or was nonzero recently).

**Q43: Explain why the Python exporter uses `timestamp_unix` for phase mapping instead of `timestamp_utc`.**
**A:** Phase mapping requires arithmetic: `offset_seconds = timestamp_unix - test_start_unix`. Integer subtraction of Unix timestamps is exact. ISO 8601 string subtraction requires datetime parsing. Using Unix timestamps avoids timezone ambiguity and parsing errors. The `timestamp_local` column is provided for human readability only.

---

### Expert

**Q44: What are the threats to validity of this benchmark? What conclusions cannot be drawn?**
**A:** Threats include: (1) Single-run benchmark — no statistical confidence intervals, no p-values. (2) Local Docker environment — not representative of production Kubernetes with network policy. (3) Shared PostgreSQL — DB can become bottleneck, obscuring runtime differences. (4) `cpus: 1.0` throttling via cgroup differs from physical single-core. Cannot conclude: "Go is always faster than Java." Can conclude: "Under these specific conditions (1 CPU, 768MB, 200 VUs, PostgreSQL), Go exhibited lower RSS memory and lower P99 tail latency in the order write workload."

**Q45: Why might average latency favor Java while P99 latency favors Go in the order benchmark?**
**A:** Java's higher throughput (28.89 vs 27.67 RPS) means more requests completed in less time, pulling down average latency. But G1GC STW pauses affect the worst 1% of requests — spiking P99 to 10.2s vs Go's 5.6s. Average latency averages over 60,689 requests — the 200 GC-pause victims are diluted. P99 highlights them explicitly.

---

## CATEGORY: ARCHITECTURE

### Medium

**Q46: Why use database-per-service when it creates cross-service sync complexity?**
**A:** Microservice data isolation: services can scale, deploy, and fail independently. If one DB is slow, only that service degrades. Cross-service sync is the cost — warehouse syncs global_inventory via HTTP PUT after stock changes. This eventual consistency is acceptable for inventory aggregation; the warehouse DB is authoritative for stock deduction.

**Q47: What is the "saga pattern" and does this project implement it?**
**A:** Saga = sequence of local transactions coordinated by events/messages, with compensating transactions for rollback. This project does NOT implement it. `placeOrder()` deducts stock (warehouse DB) and saves order (order DB) synchronously without compensation. If the order save fails, stock remains deducted — inconsistent state.

**Q48: Why are notifications sent asynchronously while stock deduction is synchronous?**
**A:** Stock deduction is business-critical — if it fails, the order must not be confirmed. Notification is a side effect — if it fails, the order is still valid. Fire-and-forget for notification prevents notification latency from adding to the order placement response time.

---

### Hard

**Q49: How does the cross-stack warehouse routing affect benchmark fairness?**
**A:** `order-java` calls `warehouse-go`. `order-go-twin` calls `warehouse-java-twin`. This means both stacks have identical downstream service behavior (same Haversine logic, same DB queries, same response payload). Without this cross-routing, if Java called Java-warehouse, same-framework HTTP client optimizations could favor Java. Cross-routing neutralizes this variable.

**Q50: Why does Go's `sync.RWMutex` cache outperform Spring's `@Cacheable` for reads even though both are in-memory?**
**A:** Spring's `@Cacheable` uses CGLIB proxy interception overhead: (1) proxy method call, (2) SpEL key evaluation (`#id.toString()`), (3) `ConcurrentHashMap.get()`, (4) deserialize cached value. Go's `RLock() → map[id] → RUnlock()` is 3 operations with no reflection. Additionally, Go's struct tags avoid Jackson's reflection-based deserialization for cached values.

---

## CATEGORY: DATABASE

### Easy

**Q51: What is a UUID primary key and why use it?**
**A:** UUID = Universally Unique IDentifier, 128-bit value. Globally unique without central coordination. Services can generate IDs independently (no sequence contention). Format: `e537f905-b41a-4ac1-bbb0-f0ad4f7d9c79`. Downside: larger storage than int (16 bytes vs 4 bytes) and random UUIDs cause B-tree index fragmentation.

**Q52: What does `ON DELETE CASCADE` do in `order_items`?**
**A:** When a row in `orders` is deleted, PostgreSQL automatically deletes all related `order_items` rows. Prevents orphaned items without explicit cleanup logic. Configured in `schema.sql`: `order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE`.

**Q53: What is `DECIMAL(10,2)` and why use it for prices?**
**A:** Exact numeric type with 10 total digits and 2 decimal places. Stores values up to 99,999,999.99 exactly. `FLOAT` or `DOUBLE` would introduce binary floating-point imprecision (e.g., $9.99 stored as $9.990000000000001).

---

### Hard

**Q54: What is a "logical foreign key" vs a database foreign key?**
**A:** `order_items.product_id` references `products.product_id` in a different database (`inventory_db`). PostgreSQL cannot enforce a FK across databases. The application code enforces this "logical FK" by validating product existence via HTTP call to inventory-service. No `REFERENCES` constraint exists in the schema.

**Q55: Why is `global_inventory` a denormalized read model?**
**A:** `global_inventory.total_stock` = `SUM(warehouse_stock.quantity)` across all warehouses. Querying this SUM on every inventory read would require a cross-database query (impossible) or an expensive aggregation. Instead, the warehouse service maintains this aggregate synchronously on every stock change. It's a CQRS-style read model: writes update both warehouse_stock and global_inventory; reads query global_inventory directly.

---

## CATEGORY: SECURITY

**Q56: What is the `X-User-Id` header and why is it a security concern?**
**A:** Used in `OrderController.java:26-27` and `order_handler.go:47-52`. The header carries the user's UUID, extracted from a supposed JWT by an API gateway. In this project, the header is accepted from any client without validation — any caller can impersonate any user by setting an arbitrary `X-User-Id`.

**Q57: Is the project vulnerable to SQL injection?**
**A:** No. All queries use parameterized statements: Spring Data JPA generates prepared statements, GORM uses `?` placeholders. UUID type parsing provides input validation before the DB call — malformed UUIDs are rejected at the handler level, never reaching the DB.

**Q58: What security improvement would you prioritize first?**
**A:** JWT validation middleware. Add Spring Security with a `JwtAuthFilter` that validates the token signature, extracts claims, and populates `SecurityContextHolder`. For Go, add a Gin middleware that validates the JWT and sets the user ID in Gin's context. This prevents unauthorized order placement.

---

## CATEGORY: CONCURRENCY

**Q59: What is a thread pool and how does Tomcat use it?**
**A:** A fixed collection of pre-created threads waiting for work. Tomcat default: 200 max threads. Each HTTP connection gets one thread. Thread handles entire request lifecycle: reading request body, executing controller/service, writing response. If 201 requests arrive simultaneously, the 201st waits in the acceptor queue.

**Q60: What is Go's GMP scheduler model?**
**A:** G = Goroutine (unit of concurrent work), M = Machine (OS thread), P = Processor (logical scheduler, owns run queue). P holds a queue of runnable Gs. M executes P's goroutines. When a G blocks on I/O, P switches to another G. With `GOMAXPROCS=1`, there is 1 P and 1 M — goroutines multiplex on a single OS thread cooperatively.

---

## QUICK-FIRE QUESTIONS (Common in Screening)

| Question | One-Line Answer |
| ---------- | ---------------- |
| What is REST? | Architectural style using HTTP verbs + resource URLs |
| What is a microservice? | Small, independently deployable service owning one bounded context |
| What is Docker? | Container platform packaging code + dependencies together |
| What is Prometheus? | Pull-based time-series monitoring database |
| What is Grafana? | Visualization layer on top of data sources like Prometheus |
| What is K6? | JavaScript-based load testing tool |
| What is a goroutine? | Lightweight user-space Go thread (~2KB stack) |
| What is `@Cacheable`? | Spring AOP annotation for transparent method result caching |
| What is Feign? | Declarative HTTP client proxy from Spring Cloud |
| What is HikariCP? | High-performance JDBC connection pool bundled with Spring Boot |
| What is Micrometer? | Metrics facade for Spring Boot → Prometheus |
| What is GORM? | Go ORM wrapping `database/sql` |
| What is P99? | 99th percentile latency — worst 1% of requests |
| What is a UUID? | Globally unique 128-bit identifier |
| What is a histogram in Prometheus? | Metric type tracking value distributions in buckets |
