# 24 — Benchmarking Viva Questions

> 150+ benchmarking questions with detailed answers for MTech viva, research presentations, and performance engineering interviews.

---

## SECTION A: K6 & Load Generation

**Q1: Why K6 and not JMeter?**
K6 is written in Go — lightweight on the load-generator machine. JMeter is Java-based, consuming significant RAM per thread. K6 scripts are JavaScript — readable and version-controlled. K6 natively supports threshold enforcement (`p(99)<500`) enabling automated pass/fail. JMeter requires XML config and a GUI for comparable threshold rules.

**Q2: What is a Virtual User (VU) in K6?**
An independent JavaScript execution loop simulating one client. Each VU runs the `default` function in a loop, fires HTTP requests, checks responses, and sleeps. 200 VUs ≠ 200 simultaneous requests — actual concurrency depends on response time and `sleep()` duration.

**Q3: Why `sleep(1)` between iterations?**
Simulates realistic user pacing — real users don't fire requests as fast as possible. `sleep(1)` means each VU targets ~1 request/second. Without it, VUs flood the backend at line-rate, measuring saturation rather than sustained concurrent-user load.

**Q4: Why 200 VUs maximum?**
Exceeds the DB pool size (50) — forces pool contention to manifest. Represents a realistic peak concurrent-user load for a medium e-commerce platform. Large enough to trigger GC pressure and thread saturation in both runtimes.

**Q5: Why 35 minutes per benchmark?**

- 5-min warmup: JIT compilation warm-up
- 15-min ramp: gradual load increase
- 10-min sustain: steady-state observation window — enough for 2-3 G1GC major collection cycles
- 5-min cooldown: connection drain and final GC observation

**Q6: What is `executor: 'ramping-vus'`?**
A K6 scenario executor that linearly interpolates VU count between stages. `{ duration: '5m', target: 100 }` ramps from previous VU count to 100 over 5 minutes, adding ~0.33 VUs/second.

**Q7: How does phase tagging in K6 work?**
Scenarios carry `tags: { phase: 'warmup' }` or `{ phase: 'measurement' }`. K6 attaches these tags to every metric emitted during that scenario. Thresholds can target tagged subsets: `'http_req_duration{phase:measurement}': ['p(99)<500']`. This evaluates SLA only post-warmup.

**Q8: What does `--summary-export` produce?**
A JSON file containing aggregate statistics for the entire test run: `p(50)`, `p(90)`, `p(95)`, `p(99)`, `avg`, `min`, `max`, `count`, `rate` for every metric. Used for programmatic pass/fail analysis. Located: `results/order_java_summary.json`.

**Q9: Why deterministic product selection (`__ITER % PRODUCTS.length`)?**
Random selection causes probabilistic stock clustering — multiple VUs hit the same product, depleting its stock early. Round-robin via `__ITER` distributes requests evenly across products, extending the valid benchmark window and reducing 409 conflicts.

**Q10: What is `__ITER` in K6?**
A per-VU iteration counter. Starts at 0, increments on each `default` function call within that VU. `PRODUCTS[__ITER % 3]` cycles through 3 products deterministically per VU.

**Q11: What is `__VU` in K6?**
The VU's integer identifier (1 to maxVUs). Useful for partitioning data: `USER_IDS[__VU % USER_IDS.length]` assigns each VU a fixed user ID.

**Q12: What is `startTime: '5m'` in the measurement scenario?**
Delays the measurement scenario's start by 5 minutes, allowing the warmup scenario to complete first. Without this offset, both scenarios would run simultaneously.

**Q13: How does K6 compute P99?**
K6 maintains an HDR histogram (High Dynamic Range) of all `http_req_duration` values per VU. At test end, it computes percentiles from the merged histogram. This is computed client-side by K6, independently of Prometheus.

**Q14: What is the difference between K6's P99 and Prometheus `histogram_quantile(0.99,...)`?**
K6 P99: computed from all requests across the entire test, using HDR histogram — exact. Prometheus P99: computed from bucket-count approximation using linear interpolation within the highest occupied bucket — approximate. Both should be close but may differ by 5-15% depending on bucket boundaries.

**Q15: What is the K6 threshold `rate<0.01` for error rate?**
Asserts that the fraction of failed HTTP requests (non-2xx status) is below 1% during the measurement phase. If exceeded, K6 exits with a non-zero status code — useful for CI pipeline failure detection.

---

## SECTION B: Prometheus Fundamentals

**Q16: What is Prometheus?**
An open-source time-series monitoring database. Uses a pull model — Prometheus scrapes target HTTP endpoints periodically. Stores metrics as `(metric_name, labels, timestamp, value)` tuples. Provides PromQL for querying.

**Q17: What is a scrape?**
Prometheus sends an HTTP GET to a target's `/metrics` or `/actuator/prometheus` endpoint every `scrape_interval` seconds. The response is Prometheus text format — a series of `metric_name{label="value"} numeric_value` lines.

**Q18: Why `scrape_interval: 5s`?**
Fine-grained enough to capture GC pause events (which can be 50-500ms for G1GC). Coarser than 5s would miss short-duration spikes in the ramp phases. Finer than 5s increases Prometheus storage and CPU overhead without meaningful benefit for 35-minute tests.

**Q19: What is the difference between a gauge and a counter in Prometheus?**

- **Gauge**: can go up or down. Examples: `go_goroutines`, `process_resident_memory_bytes`, `hikaricp_connections_active`. Use directly.
- **Counter**: monotonically increasing. Examples: `http_server_requests_seconds_count`, `process_cpu_seconds_total`. Must use `rate()` or `increase()` to extract meaningful per-second values.

**Q20: What is a Prometheus histogram?**
A metric that tracks value distributions using pre-defined buckets. `http_server_requests_seconds_bucket{le="0.1"}` counts requests completing in < 100ms. The key suffix is `_bucket`. Enables `histogram_quantile()` for percentile computation.

**Q21: What does `histogram_quantile(0.99, ...)` compute?**
Estimates the 99th percentile from bucket counts. Assumes uniform distribution within the highest occupied bucket. Returns the value `v` such that 99% of observations fall below `v`.

**Q22: Why does `histogram_quantile` need `by (le)`?**
`le` = "less than or equal to" — the bucket boundary label. Without preserving `le` in the aggregation, the bucket structure collapses and percentile computation fails, returning `NaN`.

**Q23: What is cardinality?**
The total number of unique label value combinations across all time series. `{method, status, uri, instance}` creates one series per unique combination. High-cardinality labels (e.g., `user_id`) create millions of series — exhausting Prometheus memory. The project uses only bounded-cardinality labels (method, status code, instance name).

**Q24: What is PromQL `rate()` vs `irate()`?**

- `rate(metric[1m])`: average per-second rate over the 1-minute window. Smoothed — good for dashboards.
- `irate(metric[5m])`: instantaneous rate using the last 2 data points within the window. Sensitive to spikes — good for alerting.

**Q25: What is the Prometheus data model?**
Every data point = `metric_name{label_k=label_v,...} float64_value unix_timestamp_ms`. Prometheus stores these as time series — sequences of (timestamp, value) pairs per unique metric+label combination.

**Q26: What is `evaluation_interval: 5s` in prometheus.yml?**
How often Prometheus evaluates alerting rules (configured in `rule_files:`). In this project, no alerting rules are defined — this setting is present but inactive. Setting it equal to `scrape_interval` ensures rules can evaluate fresh data.

**Q27: What is Prometheus retention and why `15d`?**
`--storage.tsdb.retention.time=15d` keeps 15 days of metric data. The benchmark runs ~2.5 hours total. 15 days provides ample buffer for multiple re-runs and retroactive analysis without bloating disk.

**Q28: Why does `error_rate_go_rps` have 0 data points in the CSV?**
Go returned no HTTP 5xx errors. Prometheus emits data points for counter metrics only when the counter has been incremented at least once. A never-incremented error counter has no time series — Prometheus range query returns empty.

---

## SECTION C: Metrics & Instrumentation

**Q29: What is Micrometer?**
A metrics facade for Java applications — similar to SLF4J but for metrics. Provides a vendor-neutral API that maps to registry implementations (Prometheus, Datadog, InfluxDB, etc.). Spring Boot auto-configures Micrometer with `spring-boot-starter-actuator` + `micrometer-registry-prometheus`.

**Q30: What does `management.endpoints.web.exposure.include=prometheus` do?**
Enables the `/actuator/prometheus` HTTP endpoint. Without this, the Prometheus scrape target would return 404 — no metrics collected. Located: `application.properties:25`.

**Q31: Why is `percentiles-histogram.http.server.requests=true` critical?**
Without it, Micrometer emits only pre-computed quantile summaries (not aggregatable). With it, Micrometer emits raw `_bucket` metrics enabling PromQL `histogram_quantile()`. Located: `application.properties:31`. Missing this = `NaN` for all Java P99 queries.

**Q32: What does `management.metrics.tags.application=${spring.application.name}` add?**
Appends `application="order-service"` label to every metric. Enables filtering by service name in multi-service Grafana panels without relying solely on the `instance` label.

**Q33: What is `go-gin-prometheus`?**
A Gin middleware package (`github.com/penglongli/gin-metrics`) that automatically registers `gin_request_duration_seconds` histogram with labels `{code, handler, method}`. Exposes `/metrics` endpoint. Registered in `cmd/main.go`.

**Q34: What is `collectors.NewDBStatsCollector`?**
A `prometheus/client_golang` collector that reads `sql.DBStats` (Go's `database/sql` pool statistics) and exposes them as Prometheus metrics: `go_sql_open_connections`, `go_sql_in_use_connections`, `go_sql_idle_connections`, `go_sql_wait_count_total`. Registered in `database/db.go`.

**Q35: What is the label difference between Spring and Go HTTP metrics?**
Spring: `http_server_requests_seconds_count{status="201", ...}` — uses label `status`.
Go: `gin_request_duration_seconds_count{code="201", ...}` — uses label `code`.
Error rate PromQL must use `{status=~"5.*"}` for Java and `{code=~"5.*"}` for Go.

**Q36: What is `process_resident_memory_bytes`?**
A Go Prometheus client metric that reads `/proc/{pid}/status` → `VmRSS` field. Reports physical RAM currently used by the process. This metric is NOT emitted by Micrometer for Java. Java uses `sum(jvm_memory_used_bytes)` as the nearest equivalent.

**Q37: What is RSS memory vs heap memory?**

- RSS: total physical RAM used by the process, including JVM/Go runtime, native libraries, thread stacks, mapped files.
- Heap: memory managed by the GC for application objects only. A subset of RSS.
- Java RSS = Heap + Metaspace + Code Cache + Thread Stacks + JVM native
- Go RSS = Heap + Goroutine Stacks + Runtime internals

**Q38: What is `go_memstats_heap_alloc_bytes`?**
Go runtime metric. Bytes allocated on the heap that are still in use (not yet GC'd). Fluctuates with GC cycles. NOT the same as total heap size — it's the live set.

**Q39: What is `jvm_gc_pause_seconds_sum`?**
Cumulative seconds spent in GC pauses since JVM start. `rate(jvm_gc_pause_seconds_sum[1m])` gives the fraction of time spent in GC per second. A value of 0.05 = 5% of CPU time consumed by GC pauses.

**Q40: What does `hikaricp_connections_pending` reveal?**
The number of threads currently waiting for a DB connection from the pool. Any value > 0 indicates pool saturation — active requests are blocking on DB connection acquisition. This is the early warning sign before connection timeout errors occur.

---

## SECTION D: Performance Concepts

**Q41: What is the difference between latency and throughput?**

- **Latency**: time to complete one request (milliseconds). Measures responsiveness.
- **Throughput**: requests completed per unit time (RPS). Measures capacity.
They are inversely related under load: increasing throughput (adding more concurrent users) typically increases latency due to resource contention.

**Q42: What is the difference between P95 and P99?**
P95 = 95th percentile: worst 5% of requests excluded. P99 = 99th percentile: worst 1% excluded. For 10,000 requests: P95 excludes 500; P99 excludes 100. P99 is more sensitive to GC pause spikes — a 200ms GC pause affecting 0.5% of requests appears in P99 but not P95.

**Q43: Why is average latency misleading under GC-heavy workloads?**
Average dilutes rare but severe events. If 99.9% of requests take 50ms but 0.1% take 5000ms (GC pause), average = `(0.999×50 + 0.001×5000) = 55ms` — concealing the 5-second outliers. P99 would show 5000ms.

**Q44: What is a GC stop-the-world (STW) pause?**
A period where the JVM halts ALL application threads to perform garbage collection tasks that cannot run concurrently with mutator threads (e.g., heap compaction). During STW: no requests are processed, Tomcat threads are frozen, in-flight requests stall for the pause duration.

**Q45: What is G1GC's sawtooth memory pattern?**

1. New objects allocated in Eden → Eden fills up
2. Minor GC: live objects moved to Survivor
3. Surviving objects promoted to Old Gen → Old Gen grows
4. Old Gen fills → G1GC mixed collection: reclaims Old Gen regions
5. Heap usage drops → cycle repeats
Visible as periodic spikes and drops in `jvm_memory_used_bytes{area="heap"}`.

**Q46: Why does Go's GC produce sub-millisecond STW pauses?**
Go's tri-color concurrent mark algorithm marks live objects while application goroutines run, using write barriers to track mutations. Only brief STW phases are needed: initial root scan (~0.1ms) and final mark check (~0.1ms). No heap compaction — avoids the compaction STW that G1GC requires.

**Q47: What is a write barrier in GC?**
Code inserted by the compiler at every pointer write. During concurrent GC, if application code modifies a pointer while GC is marking, the write barrier notifies the GC to re-scan the modified object. Prevents "marking miss" errors where a live object is incorrectly collected.

**Q48: What is the CPU cost of Go's concurrent GC vs Java's G1GC?**
Go's GC runs concurrently, consuming CPU alongside application goroutines. Under 200 VU load, Go GC uses ~5-10% of the 1 CPU budget. G1GC uses 1-2 dedicated GC threads for concurrent work, plus STW phases that briefly 100% steal CPU from all application threads.

**Q49: What is HikariCP connection timeout and how does it cause HTTP 500 errors?**
`connection-timeout=30000ms`: maximum time a thread waits for a pool connection. If all 50 connections are active and a 51st thread waits >30s, `SQLTimeoutException` is thrown. Spring's default exception handler returns HTTP 500. This caused Java's 8 HTTP failures in the order benchmark.

**Q50: Why does Go avoid connection timeout failures despite similar pool settings?**
When a goroutine blocks waiting for a DB connection, Go's scheduler yields the OS thread to another runnable goroutine. OS threads remain productive. In Java, the blocked Tomcat thread holds the OS thread, reducing effective parallelism and increasing the probability of cascading wait chains.

---

## SECTION E: Statistical & Methodology Questions

**Q51: What is statistical significance and why don't the results claim it?**
Statistical significance requires multiple runs, null hypothesis testing (e.g., t-test or Mann-Whitney U), and a p-value < 0.05. This benchmark has a single run per configuration — no confidence intervals, no p-values. Results are indicative trends, not statistically proven facts.

**Q52: What is a confidence interval?**
A range `[lower, upper]` around a measured value such that the true value falls within it with a stated probability (e.g., 95% CI). For P99 latency: after 5 runs, if values are `{5.2, 5.8, 5.5, 6.1, 5.4}`, the 95% CI is approximately `5.4 ± 0.5s`.

**Q53: What is temporal bias in benchmarking and how was it addressed?**
Temporal bias: the second benchmark always runs in a different system state (warmer OS page cache, different GC state, different PostgreSQL buffer pool). Addressed by randomizing execution order: `ORDER_FLIP=$((RANDOM % 2))` in `run-benchmarks.sh`.

**Q54: What is a confounding variable?**
A variable that influences the outcome but is not the variable being tested. In this benchmark: shared PostgreSQL instance — both stacks share the same DB server. PostgreSQL's `shared_buffers` cache state differs between segments, potentially favoring the runtime that runs second.

**Q55: What is the difference between internal and external validity?**

- **Internal validity**: do the results accurately reflect what happened in THIS experiment? Controlled by equalization, randomization, and isolation.
- **External validity**: do results generalize to real production systems? Limited here by: single host, Docker networking overhead, no real user behavior patterns, K6's sleep(1) pacing.

**Q56: Why is `step=15s` appropriate for 35-minute tests?**
35 min = 2100s. At step=15s: 2100/15 = 140 data points per metric per segment. Sufficient resolution to observe GC cycles (which repeat every 1-3 minutes under load) and load phase transitions. Step=5s would give 420 points — 3× more data without 3× more analytical insight.

**Q57: What is a time-series and why is it important for benchmarking?**
A sequence of (timestamp, value) pairs at regular intervals. Critical for benchmarking because it shows how metrics EVOLVE during the test — warmup behavior, steady-state, GC cycle patterns, connection pool buildup. A single aggregate (average) hides this temporal structure.

**Q58: What is the purpose of the 5-minute cooldown between segments?**

- HikariCP pool: connections linger for up to `idle-timeout` (600s); cooldown partially drains them
- PostgreSQL: active transactions committed, WAL checkpoints triggered
- JVM GC: G1GC runs a full collection during low load, resetting heap to baseline
- OS: kernel page cache partially evicted under memory pressure from new segment

**Q59: What is the risk of comparing average latency across two runtimes?**
JVM warmup spikes inflate Java's average across the full test. If warmup phase latency is 200ms and sustain is 50ms, Java's overall average is pulled up by warmup. Go (AOT compiled, no warmup spike) averages ~50ms throughout. The phase-tagged threshold (`{phase:measurement}`) correctly isolates this.

**Q60: What does it mean that both stacks achieve ~108 RPS in inventory reads?**
Both runtimes are bounded by K6's VU pacing, not service capacity. With 200 VUs and `sleep(1)` plus ~1ms response time: throughput ≈ 200 / (1 + 0.001) ≈ 199.8 — but K6 JavaScript overhead limits actual VU iteration rate to ~108 RPS. True capacity could be 10-100× higher for a cache-only read.

---

## SECTION F: Research Defense Questions

**Q61: What is the null hypothesis of this benchmark?**
H₀: "There is no statistically significant difference in throughput, latency, or resource utilization between Java Spring Boot and Go Gin under identical workloads and resource constraints." The benchmark provides evidence against H₀ for memory and P99 latency dimensions.

**Q62: What would you do differently to make this a publishable study?**

1. 5+ repeated runs per configuration — compute mean ± std dev
2. Apply Mann-Whitney U test for latency distributions (non-normal)
3. Run on dedicated bare-metal hosts, not shared Docker
4. Separate PostgreSQL instances per stack to eliminate DB interference
5. Use `constant-arrival-rate` executor for capacity-focused tests
6. Control `GOMAXPROCS=1` in Go containers
7. Measure energy consumption (Joules) per request as a sustainability metric

**Q63: Why are the benchmark conclusions framed as "under these specific conditions"?**
To limit the scope of claims. Results are specific to: 1 CPU, 768MB RAM, 200 VUs, PostgreSQL 15, Spring Boot 4.0.2, Go 1.22, Gin framework, Docker bridge networking, single-host deployment. Different conditions (Kubernetes, bare-metal, different load patterns) may produce different results.

**Q64: Is this an A/B test or a controlled experiment?**
A controlled experiment. A/B testing typically refers to randomized user assignment for product features. This is a controlled performance experiment: one variable (runtime: Java vs Go) is changed while all others (workload, infrastructure, configuration) are held constant.

**Q65: What workload types were NOT tested?**

1. High read-write mix (realistic e-commerce: ~80% reads, 20% writes)
2. Spike load tests (sudden 0→1000 VU)
3. Long-running stability tests (24+ hours — identifies memory leaks)
4. Connection failure resilience tests
5. Large payload tests (order with 50+ items)
6. Concurrent multi-endpoint tests (orders + inventory simultaneously)

---

## SECTION G: Tool Comparison Questions

**Q66: Prometheus vs InfluxDB for this benchmark?**
Prometheus: pull model, PromQL is powerful for derived metrics, native histogram support for percentiles, better ecosystem integration with Micrometer. InfluxDB: push model (lower latency data ingestion), SQL-like query language, better for high-cardinality data. Prometheus chosen for richer Java/Go ecosystem support.

**Q67: Grafana vs Kibana for visualization?**
Grafana: primary integration with Prometheus, excellent time-series visualization, native PromQL panel editor, threshold annotations. Kibana: designed for Elasticsearch/log analysis, weaker native Prometheus support. Grafana is the natural companion to Prometheus.

**Q68: K6 vs Gatling for this benchmark?**
Gatling: Scala DSL, better HTML reports with detailed request waterfall, strong enterprise support. K6: lighter weight on load-generator host, JavaScript scripting, threshold enforcement in CI, native Prometheus push support. K6 chosen for developer-friendly scripting and CI integration.

**Q69: Why not use Spring WebFlux (reactive) for Java?**
WebFlux uses Netty (non-blocking I/O) instead of Tomcat (blocking). This would make the comparison React/event-loop vs goroutines — different architectural patterns than the thread-per-request model being studied. The project specifically studies the mainstream Tomcat thread model vs Go goroutines.

**Q70: What is the advantage of Prometheus's pull model over push?**
Pull: Prometheus controls scrape frequency — simpler, no configuration on the service side beyond exposing `/metrics`. Push: services send data to a push gateway — better for short-lived processes. Pull is preferred for long-running microservices and avoids firewall complexity (Prometheus only needs outbound access to targets).


### Q8: Explain the phase-by-phase difference in throughput between Java and Go.
**Answer:** 
During the **Warmup phase**, Go processes requests instantly because it is AOT compiled, whereas Java experiences CPU spikes as the HotSpot JIT compiles bytecode.
During **Ramp 1 & 2**, both scale throughput linearly.
During **Ramp 3 & Sustain (200 VUs)**, Java's throughput plateaus at 28.89 RPS because the HikariCP pool (50 connections) saturates. Pending connections spike to 150, causing threads to block and triggering major GC pauses (98.8 ms/s). Go ties the throughput at 27.67 RPS but avoids errors and tail latency degradation because goroutines yield while waiting for DB connections rather than blocking OS threads.

### Q9: Why analyze the Cooldown phase?
**Answer:** The Cooldown phase reveals how runtimes shed resources after load. Go rapidly shrinks its active goroutines from 766 back to ~60, dropping memory footprint quickly. Java keeps its Tomcat threads alive longer (636 threads) and maintains a higher memory floor because the JVM does not aggressively reclaim idle thread stack memory or shrink the heap immediately.
