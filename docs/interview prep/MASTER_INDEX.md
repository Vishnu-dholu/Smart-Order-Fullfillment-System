# MASTER INDEX — Smart Order Fulfillment Performance Benchmarking

> Complete study guide for technical interviews, MTech viva, and research paper presentations.

---

## Document Map (Study Order)

| # | File | Topic | Priority |
| --- | ------ | -------- | ---------- |
| 00 | [00-project-overview.md](00-project-overview.md) | Project pitch, goals, tech stack | 🔴 CRITICAL |
| 01 | [01-system-architecture.md](01-system-architecture.md) | Service topology, diagrams | 🔴 CRITICAL |
| 02 | [02-request-flow.md](02-request-flow.md) | POST /orders, GET /products traces | 🔴 CRITICAL |
| 03 | [03-java-services-deep-dive.md](03-java-services-deep-dive.md) | Spring Boot code analysis | 🔴 CRITICAL |
| 04 | [04-go-services-deep-dive.md](04-go-services-deep-dive.md) | Go/Gin code analysis | 🔴 CRITICAL |
| 05 | [05-spring-boot-concepts.md](05-spring-boot-concepts.md) | @Cacheable, @Transactional, Feign | 🟠 HIGH |
| 06 | [06-go-concepts.md](06-go-concepts.md) | goroutines, RWMutex, GORM | 🟠 HIGH |
| 07 | [07-database-design.md](07-database-design.md) | ER diagrams, schemas, transactions | 🟠 HIGH |
| 08 | [08-api-design.md](08-api-design.md) | All endpoints, contracts, status codes | 🟡 MEDIUM |
| 09 | [09-microservices-concepts.md](09-microservices-concepts.md) | Patterns, gaps, tradeoffs | 🟡 MEDIUM |
| 10 | [10-security-analysis.md](10-security-analysis.md) | Vulnerabilities and fixes | 🟡 MEDIUM |
| 11 | [11-performance-benchmarking.md](11-performance-benchmarking.md) | Benchmark design and methodology | 🔴 CRITICAL |
| 12 | [12-prometheus-grafana.md](12-prometheus-grafana.md) | All 9 panels, PromQL queries | 🔴 CRITICAL |
| 13 | [13-docker-deployment.md](13-docker-deployment.md) | Dockerfiles, Compose, resource limits | 🟠 HIGH |
| 14 | [14-design-decisions.md](14-design-decisions.md) | Why every tool was chosen | 🟠 HIGH |
| 15 | [15-interview-questions.md](15-interview-questions.md) | 150+ Q&A across all categories | 🔴 CRITICAL |
| 16 | [16-code-walkthrough.md](16-code-walkthrough.md) | Study plans: 5min / 30min / 2hr / 1day | 🔴 CRITICAL |
| 17 | [17-cheat-sheet.md](17-cheat-sheet.md) | One-page last-minute review | 🔴 CRITICAL |
| 18 | [18-project-story.md](18-project-story.md) | 1/3/5/10-minute narratives | 🔴 CRITICAL |
| 19 | [19-benchmark-dataset-analysis.md](19-benchmark-dataset-analysis.md) | CSV schema, data dictionary | 🟠 HIGH |
| 20 | [20-metric-by-metric-analysis.md](20-metric-by-metric-analysis.md) | Every metric deep-dived | 🔴 CRITICAL |
| 21 | [21-performance-findings.md](21-performance-findings.md) | Empirical results tables | 🔴 CRITICAL |
| 22 | [22-results-interpretation.md](22-results-interpretation.md) | JIT vs AOT, GC, concurrency | 🔴 CRITICAL |
| 23 | [23-fairness-and-validity.md](23-fairness-and-validity.md) | Methodology defense | 🔴 CRITICAL |
| 24 | [24-benchmarking-viva-questions.md](24-benchmarking-viva-questions.md) | 150+ viva Q&A | 🔴 CRITICAL |
| 25 | [25-graph-analysis-guide.md](25-graph-analysis-guide.md) | Per-panel 30s/2min/deep explanations | 🔴 CRITICAL |

---

## Key Numbers — Memorize These First

### Order Benchmark (POST /orders — write-heavy, 200 VUs, 35 min)

| Metric | Java | Go | Winner |
| -------- | ------ | ---- | -------- |
| Throughput | **28.89 RPS** | 27.67 RPS | Java +9% |
| Avg Latency | **2,531ms** | 2,883ms | Java +12% |
| P99 Latency | 10,327ms | **5,597ms** | Go −46% |
| Total Requests | **60,689** | 58,153 | Java |
| HTTP Failures | 2 | **0** | Go |
| RSS Memory | ~580MB | **~62MB** | Go 9× less |
| CPU (sustain) | ~98% | **~82%** | Go headroom |

### Inventory Benchmark (GET /products/{id} — read-heavy, 200 VUs, 35 min)

| Metric | Java | Go | Winner |
| -------- | ------ | ---- | -------- |
| Throughput | 108.14 RPS | **108.21 RPS** | Tie |
| Avg Latency | 1.46ms | **1.03ms** | Go −29% |
| P99 Latency | 2.73ms | **2.36ms** | Go −14% |
| Failures | **0** | 0 | Tie |

### Dataset Stats

- **37,692** total data points · **21** metrics · **4** segments · **step=15s**
- Segment order: `go_order` (08:09Z) → `java_order` (08:49Z) → `go_inventory` (09:29Z) → `java_inventory` (10:09Z)

---

## Most Important Interview Topics

### Top 10 Topics by Frequency in Tech Interviews

1. **Project pitch** — know the 30-second, 2-minute, and 5-minute versions cold
2. **Why the performance difference exists** — JIT vs AOT, G1GC vs concurrent GC, threads vs goroutines
3. **Equalization strategy** — CPU limits, memory limits, DB pool, HTTP pool
4. **`@Transactional` + distributed transaction bug** — stock deducted but order save fails
5. **`@Cacheable` vs `sync.RWMutex` cache** — AOP proxy overhead vs direct map lookup
6. **Why P99 matters and not average** — GC pauses appear only in tail, not average
7. **Prometheus histogram_quantile** — know the PromQL formula, why `le` label must be preserved
8. **K6 phase tagging** — how warmup is excluded from thresholds
9. **HikariCP connection timeout** — root cause of Java's 8 HTTP errors
10. **Dataset structure** — segments, phases, offset_seconds, PromQL per metric

---

## 1-Day Interview Preparation Roadmap

### Morning (3 hours)

| Time | Activity | Files |
| ------ | ---------- | ------- |
| 0:00-0:30 | Project pitch + architecture | 00, 01 |
| 0:30-1:00 | Request flow sequence diagrams | 02 |
| 1:00-1:45 | Java code analysis | 03, 05 |
| 1:45-2:30 | Go code analysis | 04, 06 |
| 2:30-3:00 | Database + API design | 07, 08 |

### Midday (2 hours)

| Time | Activity | Files |
| ------ | ---------- | ------- |
| 3:00-3:30 | Microservices + Security | 09, 10 |
| 3:30-4:15 | Benchmarking methodology | 11, 13 |
| 4:15-5:00 | Prometheus/Grafana + Docker | 12, 14 |

### Afternoon (2.5 hours)

| Time | Activity | Files |
| ------ | ---------- | ------- |
| 5:00-5:30 | Design decisions defense | 14, 23 |
| 5:30-6:15 | Dataset + metric analysis | 19, 20 |
| 6:15-7:00 | Performance findings + interpretation | 21, 22 |
| 7:00-7:30 | Graph analysis guide | 25 |

### Evening (1.5 hours)

| Time | Activity | Files |
|------|----------|-------|
| 7:30-8:30 | Interview Q&A practice | 15, 24 |
| 8:30-9:00 | Cheat sheet + story rehearsal | 17, 18, 16 |

---

## 3-Hour Revision Roadmap

| Time | Activity | Files |
| ------ | ---------- | ------- |
| 0:00-0:20 | Project pitch + architecture | 00, 01 |
| 0:20-0:40 | Order placement flow (Java + Go) | 02 |
| 0:40-1:00 | Critical code locations | 03, 04 |
| 1:00-1:20 | Benchmark methodology + fairness | 11, 23 |
| 1:20-1:40 | Performance findings (memorize numbers) | 21, 22 |
| 1:40-2:00 | Metric-by-metric + graph explanations | 20, 25 |
| 2:00-2:30 | Viva questions drill | 24 |
| 2:30-3:00 | Project story rehearsal + cheat sheet | 17, 18 |

---

## 30-Minute Last-Minute Revision Roadmap

```text
0:00-0:05  Read 17-cheat-sheet.md — ALL sections
0:05-0:10  Rehearse 30-second and 2-minute pitches from 18-project-story.md
0:10-0:15  Review key numbers table above (memorize by row)
0:15-0:20  Read equalization controls from 23-fairness-and-validity.md
0:20-0:25  Review Panel 3 (P99) and Panel 1 (Memory) from 25-graph-analysis-guide.md
0:25-0:30  Read "Common Mistakes" sections in 16-code-walkthrough.md
```

---

## Critical Code Locations Reference

| What | File | Line |
| ------ | ------ | ------ |
| `@Transactional` wrapping placeOrder | `OrderService.java` | 36 |
| `@Cacheable(value="products")` | `ProductService.java` | 46 |
| `@EnableFeignClients` | `OrderServiceApplication.java` | 8 |
| Feign connect/read timeout (5s each) | `application.properties` | 22-23 |
| HikariCP max pool size = 50 | `application.properties` | 11 |
| **Histogram bucket emission (CRITICAL)** | `application.properties` | 31 |
| Go DB pool equalization | `database/db.go` | 29-31 |
| Go shared HTTP transport | `clients/httpclient.go` | 14-24 |
| Go RWMutex product cache | `product_handler.go` | 17-24 |
| GORM explicit transaction | `order_handler.go` | 104-118 |
| Async notification (goroutine) | `order_handler.go` | 289 |
| Async notification (Java thread) | `OrderService.java` | 231 |
| K6 stage definitions | `order_benchmark.js` | 8-37 |
| Randomized execution order | `run-benchmarks.sh` | 22-52 |
| Resource limits in Docker | `docker-compose.ssp.yml` | per-service |

---

## One-Line Defenses for Hard Questions

| Challenge | Answer |
| ----------- | -------- |
| "Go is always faster than Java" | "Not here — Java matched throughput after JIT warmup; Go's advantage is tail latency and memory" |
| "Your benchmark is biased" | "We equalized CPU, RAM, DB pool, HTTP pool, and randomized execution order to minimize bias" |
| "Results aren't statistically significant" | "Correct — single run, indicative trends. Production study would require 5+ runs with CIs" |
| "Why use @Transactional if Feign calls aren't in the transaction?" | "Acknowledged limitation — true atomic safety requires a Saga pattern with compensating transactions" |
| "Java failing 2 requests means it's unreliable" | "0.013% error rate — well within the 1% K6 threshold and production SLA standards" |

```mermaid
