# 17 — Cheat Sheet

> One-page quick reference for interview day. Print this and review in the waiting room.

---

## PROJECT IN 3 LINES
>
> Performance benchmarking: Java Spring Boot vs Go Gin.
> 8 microservices, K6 load testing (200 VUs, 35 min), Prometheus + Grafana observability.
> Empirical comparison: throughput, latency, memory, CPU, GC, DB connections, threads/goroutines.

---

## ARCHITECTURE QUICK MAP

```text
JAVA STACK:          inventory-java:8082 | order-java:8083 | warehouse-java-twin:9084
GO STACK:            inventory-go:9082   | order-go:9083   | warehouse-go:8084
SHARED (Go):         delivery:8085 | notification:8086
OBSERVABILITY:       Prometheus:9090 | Grafana:3000
DATABASE:            PostgreSQL:5432 (6 separate DBs)
BENCHMARKING:        K6 (host) → ports above
DATA EXPORT:         export_metrics_v2.py → 37,692 rows → metrics_master.csv
```

---

## KEY NUMBERS — ORDER BENCHMARK (POST /orders, 200 VUs, write-heavy)

| Metric | Java | Go | Winner |
| -------- | ------ | ---- | -------- |
| Throughput (RPS) | **28.89** | 27.67 | Java (+9%) |
| Avg Latency | **2,531ms** | 2,883ms | Java (+12%) |
| P99 Latency | 10,327ms | **5,597ms** | Go (45% lower) |
| Total Requests | **60,689** | 58,153 | Java |
| HTTP Failures | 2 | **0** | Go |
| RSS Memory | ~580MB | **~62MB** | Go (9× less) |
| CPU (sustain) | ~98% | **~82%** | Go (more headroom) |

## KEY NUMBERS — INVENTORY BENCHMARK (GET /products/{id}, 200 VUs, read-heavy)

| Metric | Java | Go | Winner |
| -------- | ------ | ---- | -------- |
| Throughput (RPS) | **108.14** | 108.21 | Tie |
| Avg Latency | 1.46ms | **1.03ms** | Go (29% faster) |
| P99 Latency | 2.73ms | **2.36ms** | Go (14% faster) |
| Total Requests | 227,167 | **227,257** | Tie |
| Failures | **0** | 0 | Tie |

---

## EQUALIZATION CONTROLS (Why the comparison is FAIR)

```text
cpus: '1.0'  for both stacks (Docker resource limit)
memory: 768M for both stacks (Docker resource limit)
DB pool: max 50 connections, min 10 idle — BOTH Java (HikariCP) and Go (database/sql)
HTTP pool: MaxIdleConnsPerHost=50 (Go httpclient.go) matches Feign default
Execution order: RANDOMIZED (ORDER_FLIP=$((RANDOM % 2)) in run-benchmarks.sh)
Stock reset: run before EACH test segment
Cooldown: 5-minute sleep between tests
```

---

## CRITICAL CODE LOCATIONS

```text
@Transactional:              OrderService.java:36
@Cacheable(key="#id"):       ProductService.java:46
@EnableFeignClients:         OrderServiceApplication.java:8
Feign timeout config:        application.properties:22-23
HikariCP pool:               application.properties:11-15
Histogram bucket emission:   application.properties:31  ← CRITICAL
Go DB pool equalization:     database/db.go:29-31
Go HTTP shared transport:    clients/httpclient.go:14-24
Go RWMutex cache:            product_handler.go:17-24
GORM transaction:            order_handler.go:104-118
Async notification (Go):     order_handler.go:289 (goroutine)
Async notification (Java):   OrderService.java:231 (new Thread())
K6 stages definition:        order_benchmark.js:8-37
```

---

## BENCHMARK PIPELINE

```text
K6 (35 min × 4 segments) → Prometheus (scrape 5s) → export_metrics_v2.py
                                                       └→ step=15s range query
                                                       └→ phase mapping (offset_seconds)
                                                       └→ metrics_master.csv (37,692 rows)
                                                       └→ by_metric/21 CSVs
                                                       └→ metrics_metadata.json
```

## LOAD PHASES

```text
warmup:   0-5min,   0-300s,   10 VUs
ramp_1:   5-10min,  300-600s, 50 VUs
ramp_2:   10-15min, 600-900s, 100 VUs
ramp_3:   15-20min, 900-1200s,200 VUs
sustain:  20-30min, 1200-1800s,200 VUs  ← KEY MEASUREMENT WINDOW
cooldown: 30-35min, 1800-2100s, 0 VUs
```

---

## 9 GRAFANA PANELS + PROMQL

```text
Panel 1: RSS Memory     → process_resident_memory_bytes (Go) | sum(jvm_memory_used_bytes) (Java)
Panel 2: CPU Usage      → process_cpu_usage (Java) | rate(process_cpu_seconds_total[1m]) (Go)
Panel 3: P99 Latency    → histogram_quantile(0.99, sum(rate(..._bucket[1m])) by (le,instance))
Panel 4: Throughput     → sum(rate(..._count[1m])) by (instance)
Panel 5: Heap Memory    → jvm_memory_used_bytes{area="heap"} | go_memstats_heap_alloc_bytes
Panel 6: GC Pauses      → rate(jvm_gc_pause_seconds_sum[1m]) | rate(go_gc_duration_seconds_sum[1m])
Panel 7: DB Connections → hikaricp_connections_active | go_sql_in_use_connections
Panel 8: Concurrency    → jvm_threads_live_threads | go_goroutines
Panel 9: Error Rate     → rate(...{status=~"5.*"}) Java | rate(...{code=~"5.*"}) Go  ← note label difference!
```

---

## WHY RESULTS DIFFER — ROOT CAUSES

```text
Go lower RSS memory:     No JVM class loading, no metaspace, no 1MB thread stacks
Java higher throughput:  JIT optimization after warmup; Feign keep-alive TCP reuse
Go lower P99:            Goroutine scheduling avoids OS thread context switching;
                         Go GC sub-ms pauses vs G1GC STW compaction pauses
Java higher avg latency: 5-min JIT warmup spike averaged into total; G1GC pauses
Go lower inventory latency: RWMutex map lookup < Spring AOP @Cacheable proxy call
```

---

## SPRING BOOT ANNOTATIONS (project-specific)

```text
@SpringBootApplication  → OrderServiceApplication.java (entry point)
@EnableFeignClients     → OrderServiceApplication.java (enables Feign proxy scanning)
@FeignClient            → client/*.java (4 Feign clients)
@Transactional          → OrderService.java:36 (order placement transaction)
@Cacheable              → ProductService.java:46 (product cache)
@RestController         → OrderController.java, ProductController.java
@RequiredArgsConstructor→ Service classes (constructor DI via Lombok)
@Slf4j                  → Service classes (Lombok logging)
@Entity                 → Order.java, OrderItem.java, Product.java
@OneToMany(cascade=ALL) → Order.java → OrderItem
@Enumerated(STRING)     → Order.java status field
```

---

## COMMON INTERVIEW TRAPS + CORRECTIONS

```text
TRAP: "Go is always faster than Java"
CORRECT: Go lower memory and P99 tail latency; Java matches throughput after JIT warmup

TRAP: "@Transactional makes everything atomic"
CORRECT: Feign HTTP calls are outside DB transaction; stock deduction cannot be rolled back

TRAP: "The cache prevents all DB queries"
CORRECT: Only GET /products/{id} is cached; POST /orders always hits DB

TRAP: "200 VUs = 200 requests per second"
CORRECT: 200 concurrent users × sleep(1) + processing_time; actual RPS depends on processing time

TRAP: "Prometheus scrape_interval = step in Python query"
CORRECT: scrape_interval=5s (Prometheus polls) | step=15s (Python query resolution)

TRAP: "Go uses goroutines, so it never blocks"
CORRECT: Goroutines block on I/O (DB queries, HTTP calls) just like threads; the difference is cost and scheduler behavior
```
