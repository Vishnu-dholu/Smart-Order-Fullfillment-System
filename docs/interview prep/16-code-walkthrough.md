# 16 — Code Walkthrough & Study Plan

---

## File Importance Ranking

### Tier 1 — Must Know (Core Logic)

| File | Why Critical |
| ------ | ------------- |
| `services/spring/order-service/.../OrderService.java` | The entire order placement flow — Feign calls, Haversine, async thread, `@Transactional` |
| `services/go/order-twin/internal/handlers/order_handler.go` | Go parity of order placement — goroutines, GORM transactions, pooled HTTP client |
| `services/spring/inventory-service/.../ProductService.java` | `@Cacheable` — the cache comparison anchor |
| `services/go/inventory-twin/internal/handlers/product_handler.go` | `sync.RWMutex` cache — the Go cache comparison anchor |
| `load-tests/order_benchmark.js` | K6 staged ramp, VU configuration, thresholds, phase tagging |
| `load-tests/run-benchmarks.sh` | Orchestration, stock reset, cooldown, randomized execution order |
| `observability/prometheus/prometheus.yml` | Scrape targets, scrape interval, job names |
| `services/spring/order-service/src/main/resources/application.properties` | HikariCP pool, Feign timeouts, histogram percentiles config |
| `services/go/order-twin/internal/database/db.go` | Go DB pool equalization + Prometheus DBStats registration |
| `services/go/order-twin/internal/clients/httpclient.go` | Shared transport pool — the fairness fix |

### Tier 2 — Should Know (Architecture)

| File | Why Important |
| ------ | -------------- |
| `docker-compose.ssp.yml` | Service topology, resource limits, network config |
| `services/go/order-twin/cmd/main.go` | Gin setup, Prometheus middleware, route registration |
| `services/spring/order-service/.../OrderController.java` | `@RequestHeader`, `@Transactional` boundary entry point |
| `services/spring/order-service/.../client/*.java` | All 4 Feign client interfaces |
| `services/go/order-twin/internal/models/order.go` | GORM struct tags, UUID primary key, Go vs Java type comparison |
| `services/go/warehouse-service/.../warehouse_handler.go` | Haversine sorting in Go, cross-service sync, GORM JOIN |
| `load-tests/export_metrics_v2.py` | Dataset collection pipeline, phase mapping algorithm |
| `schema.sql` | Full database schema — ER diagram source of truth |

### Tier 3 — Good to Know (Supporting)

| File | Why Useful |
| ------ | ----------- |
| `services/spring/order-service/.../entity/Order.java` | JPA annotations, `@Enumerated`, `@OneToMany` cascade |
| `services/spring/order-service/.../util/LocationUtils.java` | Haversine formula in Java |
| `services/go/order-twin/internal/utils/location_utils.go` | Haversine formula in Go |
| `services/go/order-twin/internal/config/config.go` | Config loading pattern |
| `load-tests/inventory_benchmark.js` | Inventory read benchmark |
| `observability/grafana/provisioning/` | Dashboard JSON — understand 9 panels |
| `Jenkinsfile` | CI/CD pipeline stages |

---

## Study Plans by Time Available

---

### ⏱️ 5-Minute Last-Minute Review

**Read only these — commit to memory:**

```text
1. Pitch answer (30 seconds):
   "I built a performance benchmarking system comparing Java Spring Boot and Go Gin
   microservices under identical resource limits using K6, Prometheus, and Grafana.
   Key finding: Go used 7-9x less memory; Java matched throughput after JIT warmup."

2. Key numbers:
   - Order Java: 28.89 RPS, avg 2.56s, P99 10.2s
   - Order Go:   27.67 RPS, avg 2.88s, P99 5.6s
   - Inventory Java: 108 RPS, avg 1.46ms
   - Inventory Go:   108 RPS, avg 1.03ms
   - Go RSS: ~45MB | Java RSS: ~350MB

3. Three equalization controls:
   cpus:1.0 | memory:768M | DB pool: max 50 for both

4. Two caching strategies:
   Java → @Cacheable → Spring AOP → ConcurrentHashMap
   Go   → sync.RWMutex → map[string]Product
```

---

### ⏱️ 30-Minute Rapid Revision

**Step-by-step:**

```text
0:00-0:05 — Read 00-project-overview.md (30-second and 2-minute pitches)
0:05-0:10 — Read application.properties (understand all 32 lines)
0:10-0:15 — Read OrderService.java lines 36-230 (placeOrder, allocate, async)
0:15-0:18 — Read order_handler.go lines 45-130 (CreateOrder in Go)
0:18-0:22 — Read order_benchmark.js (stages array, thresholds, sleep(1))
0:22-0:26 — Read httpclient.go + db.go (pool equalization)
0:26-0:30 — Read 21-performance-findings.md (key numbers table)
```

---

### ⏱️ 2-Hour Focused Session

**Hour 1 — Code Understanding:**

```text
0:00-0:15  OrderService.java — trace every line of placeOrder()
0:15-0:25  order_handler.go — compare Go vs Java implementation
0:25-0:35  ProductService.java (@Cacheable) + product_handler.go (RWMutex)
0:35-0:45  order_benchmark.js — understand every K6 option
0:45-0:55  application.properties — every property and why it matters
0:55-1:00  docker-compose.ssp.yml — resource limits, network, volumes
```

**Hour 2 — Defense Preparation:**

```text
1:00-1:15  Read 21-performance-findings.md — know ALL numbers
1:15-1:30  Read 22-results-interpretation.md — explain WHY
1:30-1:45  Read 23-fairness-and-validity.md — defend methodology
1:45-2:00  Read 15-interview-questions.md — practice answers
```

---

### ⏱️ 1-Day Comprehensive Study

**Morning (3 hours) — Architecture + Code:**

```text
0:00-0:30  Read 00 + 01 (overview + architecture diagrams)
0:30-1:00  Read 02 (request flow sequence diagrams)
1:00-1:30  Read 03 (Java deep dive) — read actual source files in parallel
1:30-2:00  Read 04 (Go deep dive) — read actual source files in parallel
2:00-2:30  Read 05 (Spring concepts) — map to actual code
2:30-3:00  Read 06 (Go concepts) — map to actual code
```

**Midday (2 hours) — Database + API + Design:**

```text
3:00-3:30  Read 07 (database design) + open schema.sql
3:30-4:00  Read 08 (API design) + test endpoints with curl
4:00-4:30  Read 09 (microservices) + 14 (design decisions)
4:30-5:00  Read 10 (security) — know vulnerabilities + fixes
```

**Afternoon (2 hours) — Benchmarking Deep Dive:**

```text
5:00-5:30  Read 11 (benchmarking) + run order_benchmark.js mentally
5:30-6:00  Read 12 (Prometheus/Grafana) + understand all 9 panels
6:00-6:30  Read 13 (Docker) + understand resource limits
6:30-7:00  Read 19 (dataset analysis) + open metrics_metadata.json
```

**Evening (1.5 hours) — Results + Interview Prep:**

```text
7:00-7:20  Read 20 (metric-by-metric analysis)
7:20-7:40  Read 21 (performance findings) — memorize key numbers
7:40-8:00  Read 22 (results interpretation) — understand root causes
8:00-8:20  Read 23 (fairness) — prepare for methodology challenges
8:20-8:30  Read 17 (cheat sheet) — final consolidation
```

---

## What to Memorize

### Must-Have Numbers

```text
Order Benchmark (200 VUs, 35-min, write-heavy):
  Java: 28.89 RPS | avg 2,531ms | P99 10,327ms | 60,689 requests | 2 failures
  Go:   27.67 RPS | avg 2,883ms | P99 5,597ms  | 58,153 requests | 0 failures

Inventory Benchmark (200 VUs, 35-min, read-heavy):
  Java: 108.14 RPS | avg 1.46ms | P99 2.73ms | 227,167 requests
  Go:   108.21 RPS | avg 1.03ms | P99 2.36ms | 227,257 requests

Memory:
  Go RSS: ~30-40MB (inventory-twin startup)
  Java total used: ~350MB+ under load

K6 Stages: warmup(5m,10VU), ramp1(5m,50VU), ramp2(5m,100VU), ramp3(5m,200VU), sustain(10m,200VU), cooldown(5m,0VU)

Dataset: 37,692 data points | 21 metrics | 4 segments | step=15s
```

### Must-Have Code Locations

```text
@Transactional:           OrderService.java:36
@Cacheable:               ProductService.java:46
@EnableFeignClients:      OrderServiceApplication.java:8
InventoryClient:          client/InventoryClient.java
HikariCP pool size:       application.properties:11
Histogram config:         application.properties:31
Go pool equalization:     database/db.go:29-31
Shared HTTP transport:    clients/httpclient.go:14-24
RWMutex cache:            product_handler.go:17-24
GORM transaction:         order_handler.go:104-118
K6 stages:                order_benchmark.js:8-37
```

---

## Common Interview Mistakes to Avoid

❌ "This is a CRUD microservices project"
✅ Say: "This is a performance benchmarking research project"

❌ "I chose Go because it's faster"
✅ Say: "The empirical data shows Go used 7-9× less memory and had lower P99 tail latency, but Java matched throughput after JIT warmup"

❌ "The results prove Go is better"
✅ Say: "Under these specific constraints, Go demonstrated advantages in memory efficiency and tail latency; Java demonstrated competitive throughput after warmup"

❌ Not knowing why the metric is collected
✅ Know what every panel measures, which PromQL query it uses, and what code/runtime produces it

❌ Confusing `scrape_interval` with `step`
✅ `scrape_interval=5s`: how often Prometheus polls. `step=15s`: resolution of the Python range query.

❌ "I used @Transactional so everything is atomic"
✅ Know the distributed transaction limitation — Feign calls outside the DB transaction cannot be rolled back
