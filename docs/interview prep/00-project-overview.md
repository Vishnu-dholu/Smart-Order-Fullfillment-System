# 00 — Project Overview

> **Interview-Defense Knowledge Base** | Smart Order Fulfillment System (SOF)

---

## Problem Statement

Modern e-commerce platforms must simultaneously serve millions of users while maintaining sub-second response times. The architectural choice of backend runtime—specifically **Java Spring Boot** vs **Go Gin**—has enormous implications for throughput, latency, memory consumption, and resource cost at scale.

The problem this project solves is not merely "build an order management system." The real problem is:

> **Can we empirically measure, with production-grade tooling, whether Go Gin microservices outperform Java Spring Boot microservices in the context of a realistic, write-heavy and read-heavy order fulfillment workload?**

This distinction is critical. The system was designed as a **benchmarking vehicle** first, and as a functional order system second. Every design decision—from the identical API contracts to the equalized connection pools—exists to enable a **fair, reproducible, peer-reviewable performance comparison**.

---

## Project Goal

| Goal | Description |
| ------ | ------------- |
| **Primary** | Comparative performance benchmarking of Java Spring Boot vs Go Gin under realistic load |
| **Secondary** | Build a functional Smart Order Fulfillment system that demonstrates real-world microservice complexity |
| **Research** | Generate publishable IEEE-quality data about runtime tradeoffs in microservice architectures |
| **Academic** | Support MTech research thesis / viva defense with empirical evidence |

The project answers questions like:

- Which runtime uses less memory under load?
- Which runtime has lower P99 latency?
- Which runtime handles more requests per second?
- How does Java's JVM GC behavior compare to Go's garbage collector under sustained load?
- Is Go's concurrency model (goroutines) more efficient than Java's thread-per-request model at 200 concurrent users?

---

## High-Level Architecture

The system implements a **polyglot microservice architecture** with two parallel stacks:

### Control Group (Java Spring Boot)

- **inventory-service** (port 8082) — Product catalog and global stock management
- **order-service** (port 8083) — Order placement, routing, and lifecycle

### Test Group (Go Gin Twins)

- **inventory-twin** (port 9082) — Functionally identical Go implementation of inventory-service
- **order-twin** (port 9083) — Functionally identical Go implementation of order-service

### Shared Go Services (Both Groups Use)

- **warehouse-service** (port 8084) — Physical stock location management (Haversine routing)
- **delivery-service** (port 8085) — Shipment tracking
- **notification-service** (port 8086) — Notification logging

### Observability Stack

- **Prometheus** (port 9090) — Metrics scraping every 5 seconds
- **Grafana** (port 3000) — 9-panel real-time dashboard

### Benchmarking Stack

- **K6** — Load generation (up to 200 VUs, 35-minute staged ramp)
- **Python exporter** — Extracts metrics from Prometheus into CSV datasets

---

## Technology Stack

| Layer | Java Stack | Go Stack |
| ------- | ----------- | --------- |
| **Runtime** | JVM 21 (Spring Boot 4.0.2) | Go 1.22+ |
| **Framework** | Spring MVC (Servlet/Tomcat) | Gin Gonic |
| **ORM** | Hibernate / Spring Data JPA | GORM |
| **HTTP Client** | OpenFeign (declarative) | `net/http` (pooled) |
| **Metrics** | Micrometer + Actuator | `go-gin-prometheus` + `prometheus/client_golang` |
| **Database** | PostgreSQL (HikariCP pool) | PostgreSQL (`database/sql` pool) |
| **Caching** | Spring Cache (`@Cacheable`) | Custom `sync.RWMutex` map |
| **Async** | `new Thread()` | `go func()` goroutine |

| Layer | Technology |
| ------- | ----------- |
| **Database** | PostgreSQL (6 separate databases) |
| **Monitoring** | Prometheus + Grafana |
| **Load Testing** | k6 (Grafana Labs) |
| **Dataset Export** | Python 3 (`urllib`, `csv`, `json`) |
| **Deployment** | Docker + Docker Compose |
| **CI/CD** | Jenkins (Jenkinsfile present) |
| **Container Registry** | Docker Hub |

---

## Key Features

1. **Smart Warehouse Routing** — Haversine formula selects nearest warehouse with sufficient stock
2. **Polyglot Architecture** — Java and Go services coexist on the same Docker network
3. **Equalized Benchmarking** — DB pools, resource limits, and HTTP clients matched across runtimes
4. **35-Minute Staged Load Ramp** — 6 phases: warmup → ramp1 → ramp2 → ramp3 → sustain → cooldown
5. **9-Metric Observability** — RSS memory, CPU, P99 latency, throughput, heap, GC, DB pool, threads/goroutines, error rate
6. **Phase-Annotated Dataset** — Every data point tagged with load phase, service type, and benchmark type
7. **Randomized Execution Order** — Prevents ordering bias (Java-first or Go-first randomly decided per run)
8. **Two Workload Types** — Write-heavy (POST /orders) and read-heavy (GET /products/{id}) measured separately
9. **Inventory Cache Comparison** — Spring `@Cacheable` vs Go `sync.RWMutex` in-memory cache
10. **Connection Pool Parity** — HikariCP (Java) and `database/sql` (Go) both capped at 50 max connections

---

## Explain This Project

### 30 Seconds

> "I built a Smart Order Fulfillment System as a performance benchmarking research project. I implemented the same order and inventory microservices in both Java Spring Boot and Go Gin with identical API contracts, then ran 35-minute staged load tests using K6 while collecting 9 system metrics through Prometheus and Grafana. The goal was to empirically compare their throughput, latency, memory, and GC behavior under realistic e-commerce load."

---

### 2 Minutes

> "The project is a comparative benchmarking study disguised as an e-commerce backend. The business domain is a Smart Order Fulfillment System—when a customer places an order, the system validates product prices from an inventory service, then uses the Haversine formula to find the geographically nearest warehouse with sufficient stock, deducts that stock atomically, saves the order to PostgreSQL, and asynchronously sends a notification.
>
> The critical design is that I built this system twice—once in Java Spring Boot and once in Go Gin—with functionally identical API contracts, identical database schemas, and equalized infrastructure: same Docker resource limits (1 CPU, 768MB RAM), same DB connection pool sizes (50 max), and matched HTTP client pooling.
>
> I then ran a rigorous 35-minute K6 benchmark across two workload types: write-heavy order creation and read-heavy inventory lookups. Prometheus scraped metrics every 5 seconds, and a Python script exported 37,692 time-series data points annotated with load phases into CSV files for analysis.
>
> The key findings were: Go achieved near-zero latency for inventory reads due to its in-memory cache, while Java showed higher but more consistent latency using Spring's `@Cacheable`. For order creation—the complex write workload—both services showed similar latency profiles around 2.5-3 seconds, dominated by downstream service calls rather than runtime overhead."

---

### 5 Minutes

> "Let me walk you through the architecture first. The system has three layers: the application layer, the observability stack, and the benchmarking pipeline.
>
> **Application Layer:** I have six microservices. The inventory service manages a product catalog with SKUs, prices, and a global stock table. The order service is the most complex—it implements a full order placement workflow involving 4 downstream service calls in a single transaction. When a POST /orders request arrives, the service: (1) validates each product by calling the inventory service via Feign/HTTP client, (2) queries the warehouse service for stock locations, (3) runs the Haversine great-circle distance formula to find the nearest warehouse with sufficient stock, (4) deducts stock atomically, (5) saves the order in PostgreSQL with GORM/JPA, and (6) fires a notification asynchronously via a goroutine or Java Thread.
>
> **The Twin Design:** For benchmarking, I created Go 'twins' of the Java inventory and order services. These are not ports or translations—they are independent implementations written natively in Go with idiomatic code. The Java side uses Spring annotations like @Transactional, @Cacheable, and Feign declarative clients. The Go side uses GORM transactions, a custom RWMutex cache, and a shared http.Transport connection pool. The API contracts are identical so K6 can hit either service with the same request.
>
> **Equalization Strategy:** To ensure fair comparison, I matched: Docker resource limits (1 CPU, 768MB RAM per service), database connection pools (max 50 connections, HikariCP settings mirrored in Go's database/sql), and HTTP client pooling (MaxIdleConnsPerHost=50 to match Feign's behavior).
>
> **Benchmarking Pipeline:** K6 runs a 35-minute staged ramp: 5 minutes warmup at 10 VUs, then ramp to 50, 100, 200 VUs at 5 minutes each, sustain at 200 VUs for 10 minutes, then cool down. After each test, the system waits 5 minutes for GC and pool drain. A Python script queries Prometheus's range API and exports all 9 metrics with phase annotations into CSVs.
>
> **Key Findings:** For read-heavy inventory workloads, Go served 108 RPS with avg latency of 1ms. Java served 108 RPS with avg latency of 1.46ms. For write-heavy order workloads, Java and Go were within 13% of each other in throughput, both dominated by downstream I/O latency of 2.5-3 seconds. Memory showed the most dramatic difference: Java exhibited sawtooth GC patterns from JVM heap expansion, while Go maintained flat, low RSS memory with Go's concurrent tri-color GC running in microseconds."

---

### 10 Minutes

> *(Use the 5-minute version as foundation, then add:)*
>
> **On the database design:**
> "I chose a fully separated database-per-service pattern. There are 6 PostgreSQL databases: auth_db, order_db, inventory_db, warehouse_db, delivery_db, notification_db. Services never JOIN across databases—they use logical UUID references and synchronous HTTP calls for cross-service data. This is the microservices data isolation pattern. The tradeoff is eventual consistency: when warehouse stock is deducted, the inventory service's global_inventory table is updated via a synchronous HTTP PUT from the warehouse service. This cross-service sync is a deliberate design point I can defend in detail.
>
> **On the benchmarking methodology:**
> "I deliberately chose P99 latency as my primary SLA threshold rather than average latency. The reason is that P99 reveals tail latency—the worst 1% of requests. In production systems, these tail latencies directly correlate with user-facing timeouts and retries. Average latency can hide pathological GC pauses or thread contention events. I also annotated every data point with its load phase so I can compare Java vs Go specifically during the sustain phase, eliminating warmup and ramp artifacts from the analysis.
>
> **On what I would do differently:**
> "If I were extending this research, I would add: (1) a circuit breaker pattern to measure fault isolation differences, (2) horizontal scaling tests to compare how each runtime scales across multiple replicas, (3) profiling during GC events to understand which JVM collector performs best at these load levels, and (4) a more rigorous statistical analysis with confidence intervals across multiple benchmark runs. The current dataset is from a single run session, which limits statistical significance."
