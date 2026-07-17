# 14 — Design Decisions

---

## Every Major Architectural Decision — Why, Alternatives, Tradeoffs

---

## Decision 1: Java Spring Boot as the Control Group

**Decision:** Use Java 21 + Spring Boot 4.0.2 as the baseline/control runtime.

**Why Chosen:**

- Spring Boot is the dominant enterprise Java framework — results are representative of real production Java workloads
- Micrometer provides excellent automatic instrumentation (JVM GC, HikariCP, HTTP metrics) with zero custom code
- OpenFeign enables clean declarative HTTP client code that is easy to read and benchmark
- Java 21 LTS is the current production standard; results are directly applicable to real systems

**Alternatives Considered:**

| Alternative | Why Not Chosen |
| ------------- | --------------- |
| Quarkus | Not as mainstream; fewer interviews will test Quarkus knowledge |
| Micronaut | AOT-compiled — closer to Go behavior, reduces JVM warmup difference |
| Spring WebFlux (Reactive) | Apples-to-oranges comparison — reactive non-blocking model is different from Go's goroutines |
| Helidon | Not widely known in industry |

**Tradeoffs:**

- ✅ Highly representative of production Java
- ✅ Rich automatic instrumentation
- ❌ JVM warmup phase complicates early benchmark data
- ❌ Higher memory baseline (~300MB minimum) inflates RSS difference vs Go

**Interview Q:** *Why Spring Boot specifically and not Quarkus or Micronaut?*
→ Spring Boot's Tomcat thread-per-request model represents mainstream Java architecture. Quarkus AOT would artificially close the performance gap. The research goal was to compare representative architectures, not optimal ones.

---

## Decision 2: Go Gin as the Test Group

**Decision:** Use Go 1.22+ + Gin framework as the comparison runtime.

**Why Chosen:**

- Gin is Go's most popular HTTP framework (used by 80%+ of Go web projects)
- Gin compiles to a native binary — no VM overhead — creating a meaningful architectural contrast with JVM
- Goroutine-per-connection model vs Tomcat's thread-per-request model is the core academic comparison
- `go-gin-prometheus` middleware provides equivalent observability to Micrometer

**Alternatives Considered:**

| Alternative | Why Not Chosen |
| ------------- | --------------- |
| Go `net/http` stdlib | No framework overhead, but too bare-bones for fair feature comparison |
| Echo | Similar to Gin but less dominant market share |
| Fiber | FastHTTP-based, uses different runtime path than standard `net/http` |
| gRPC | Protocol mismatch — Spring Boot serves REST, gRPC comparison would be unfair |

**Tradeoffs:**

- ✅ Representative of production Go services
- ✅ Native binary — clean AOT vs JIT comparison
- ❌ Gin's middleware is less feature-rich than Spring's ecosystem
- ❌ Go lacks Spring's auto-instrumentation — required manual `prometheus/client_golang` setup

---

## Decision 3: PostgreSQL as the Database

**Decision:** Single PostgreSQL 15 instance with 6 separate databases (one per service).

**Why Chosen:**

- Both Spring Boot (via JDBC/HikariCP) and Go (via `database/sql`/GORM) have excellent PostgreSQL drivers
- Using the **same database engine** for both stacks eliminates database-as-variable — any performance difference is due to runtime, not DB driver
- PostgreSQL supports `gen_random_uuid()` for server-side UUID generation (used by both stacks)
- `DECIMAL(10,2)` type for accurate monetary arithmetic

**Alternatives Considered:**

| Alternative | Why Not Chosen |
| ------------- | --------------- |
| MySQL | PostgreSQL has better UUID support, JSONB, and is more common in microservices |
| MongoDB | Document DB — different query patterns; would favor different workloads |
| Separate DB per runtime | Would make it impossible to share schemas; Go and Java needed to be interchangeable |
| H2 (in-memory) | In-memory DB has no I/O latency — hides connection pool and query differences |

**Tradeoffs:**

- ✅ Both stacks share identical schemas and query execution plans
- ✅ Real I/O latency from actual disk writes
- ❌ Single shared PostgreSQL is a potential contention point; under extreme load, DB becomes bottleneck rather than runtime
- ❌ `application.properties` contains real Neon cloud credentials — security risk

**Code Location:** `services/spring/order-service/src/main/resources/application.properties:5-8`

```properties
spring.datasource.url=jdbc:postgresql://ep-round-frost-a10slzy6-pooler.ap-southeast-1.aws.neon.tech/order_db?sslmode=require
```

---

## Decision 4: OpenFeign for Java HTTP Client

**Decision:** Use Spring Cloud OpenFeign for inter-service HTTP calls in Java.

**Why Chosen:**

- Declarative interface-based approach is clean and testable
- Integrates with Spring's configuration system (URL from properties)
- Compatible with Micrometer — HTTP client metrics are auto-collected
- Widely used in enterprise Java microservices

**Code Location:** `client/InventoryClient.java`

```java
@FeignClient(name = "inventory-service", url = "${inventory.service.url:http://localhost:8082}")
public interface InventoryClient {
    @GetMapping("/products/{id}")
    ProductDTO getProductById(@PathVariable("id") UUID id);
}
```

**Alternatives:**

| Alternative | Tradeoff |
| ------------- | --------- |
| `RestTemplate` | Deprecated in Spring 6; non-fluent API |
| `WebClient` | Reactive, non-blocking — different concurrency model |
| `HttpClient` (Java 11+) | Standard library but verbose |
| `OkHttp` | Popular but requires manual Spring integration |

---

## Decision 5: GORM for Go ORM

**Decision:** Use GORM as the ORM for Go services.

**Why Chosen:**

- Most popular Go ORM (comparable to Hibernate's ecosystem dominance)
- Provides explicit transaction support (`database.DB.Transaction(func(tx) error {...})`)
- Connection pool tuning via `DB.DB()` → `sql.DB` extraction

**Code Location:** `services/go/order-twin/internal/database/db.go:17-31`

```go
DB, err = gorm.Open(postgres.Open(connectionString), &gorm.Config{})
sqlDB, _ := DB.DB()
sqlDB.SetMaxOpenConns(50)
sqlDB.SetMaxIdleConns(10)
```

**Tradeoffs vs Hibernate:**

- GORM explicit transactions vs Spring's `@Transactional` AOP
- GORM requires manual `Preload()` for associations (Hibernate does lazy loading automatically)
- GORM is less mature — some edge cases with complex relationships

---

## Decision 6: HikariCP vs `database/sql` Connection Pools

**Decision:** Use HikariCP (Java) and Go's `database/sql` pool with equalized settings.

**Why Equal Settings Matter:**

```text
Java  (HikariCP):  maximum-pool-size=50, minimum-idle=10
Go (database/sql): SetMaxOpenConns(50),  SetMaxIdleConns(10)
```

**Without equalization:** Go could open 200 DB connections at peak (default), while Java is limited to 50. Go would appear faster because it can saturate the DB simultaneously from many connections.

**Code Locations:**

- Java: `application.properties:11-14`
- Go: `database/db.go:29-31`

---

## Decision 7: Prometheus + Grafana for Observability

**Decision:** Use Prometheus (time-series TSDB) + Grafana (visualization) as the monitoring stack.

**Why Chosen:**

- Industry standard for cloud-native monitoring
- Both Java (Micrometer) and Go (`prometheus/client_golang`) have first-class Prometheus support
- Prometheus's PromQL allows computing percentiles (`histogram_quantile(0.99, ...)`)
- Grafana's provisioning system enables zero-click dashboard setup

**Alternatives:**

| Stack | Why Not Chosen |
| ------- | --------------- |
| ELK Stack | Log-based monitoring, not metrics-based; no histogram quantile support |
| Datadog | SaaS, paid; requires agent; not self-hosted |
| InfluxDB + Telegraf | Less community tooling for Java/Go out-of-box |
| StatsD + Graphite | Pull vs push model difference; less rich querying |

**Critical Config:** `application.properties:31`

```properties
management.metrics.distribution.percentiles-histogram.http.server.requests=true
```

Without this, Spring Boot's Micrometer does NOT emit `_bucket` metrics for histograms. The P99 PromQL (`histogram_quantile(0.99, ...)`) would return `NaN` without it.

---

## Decision 8: K6 for Load Generation

**Decision:** Use K6 (Grafana Labs) as the load testing tool.

**Why Chosen:**

- JavaScript scripting enables dynamic payload generation (rotating product IDs, user IDs)
- Native threshold support (`p(99)<500`) integrates with CI pipelines
- Phase tagging (`tags: { phase: 'warmup' }`) allows excluding warmup from thresholds
- K6 is written in Go — runs efficiently on the same machine without significant overhead
- `--summary-export` produces machine-readable JSON for programmatic analysis

**Alternatives:**

| Tool | Why Not Chosen |
| ------ | --------------- |
| JMeter | XML config is verbose; heavyweight; Java overhead on load generator |
| Gatling | Scala DSL; steeper learning curve |
| Locust | Python overhead on the load generator can skew results |
| wrk | No staged ramp support; minimal scripting |
| Artillery | Node.js-based; less control over VU lifecycle |

---

## Decision 9: Shared Go Services for Both Stacks

**Decision:** `warehouse-go` serves `order-java`. `warehouse-java-twin` serves `order-go-twin`.

**Why This Cross-Stack Design:**

- Prevents same-language optimization advantage (e.g., if Go order called Go warehouse, HTTP serialization could be faster due to shared conventions)
- Both stacks experience the same downstream service complexity
- Ensures Haversine computation and stock deduction are identical across both stacks

**Interview Q:** *Why would same-language service calls be an advantage?*
→ HTTP serialization/deserialization between same-framework services can be slightly faster (e.g., optimized JSON codecs, persistent keep-alive connection reuse within the same service mesh). Cross-language calls ensure this is not a variable.

---

## Decision 10: 5-Second Prometheus Scrape Interval

**Decision:** `scrape_interval: 5s` — scrape every 5 seconds.

**Why 5 seconds:**

- Fine-grained enough to detect GC pauses (which can be 100ms-500ms for G1GC)
- Low enough to see latency spikes during VU ramp phases
- The Python exporter uses `step=15s` (3× scrape interval) — maintains data fidelity without excessive data points

**Config location:** `observability/prometheus/prometheus.yml:2`

```yaml
global:
  scrape_interval: 5s
  evaluation_interval: 5s
```

---

## Decision 11: Percentile-Histogram Bucket Emission (Spring Boot)

**Decision:** `management.metrics.distribution.percentiles-histogram.http.server.requests=true`

**Why this is a critical config decision:**

- Micrometer by default only emits summary quantiles (pre-computed P50, P95, P99) — these are NOT aggregatable across instances
- With `percentiles-histogram=true`, Micrometer emits raw bucket counts: `http_server_requests_seconds_bucket{le="0.005"}`, `{le="0.01"}`, etc.
- These buckets CAN be aggregated with `sum(rate(...)) by (le)` then `histogram_quantile(0.99, ...)`
- Without this: Prometheus returns `NaN` for `histogram_quantile()` on Spring metrics

**Code Location:** `application.properties:28-31`

```properties
# Enable histogram buckets for HTTP server requests so histogram_quantile()
# in Prometheus/Grafana can compute accurate P99 latency for Java
management.metrics.distribution.percentiles-histogram.http.server.requests=true
```

---

## Decision 12: `management.metrics.tags.application` — Service Label

**Decision:** Add `application` tag to all Spring metrics.

**Code Location:** `application.properties:26`

```properties
management.metrics.tags.application=${spring.application.name}
```

This adds `application="order-service"` label to every metric, allowing Grafana to filter by service name in multi-service dashboards. Without it, metrics from different services would be indistinguishable beyond the `instance` label.

---

## Design Decision Summary Table

| Decision | Choice | Key Rationale | Main Risk |
| ---------- | -------- | -------------- | ---------- |
| Java framework | Spring Boot 4 | Most representative enterprise Java | JVM warmup complicates early data |
| Go framework | Gin | Most popular Go web framework | Less auto-instrumentation |
| Database | PostgreSQL (shared schema) | Same DB for both eliminates DB variable | Shared DB can become bottleneck |
| Java HTTP client | OpenFeign | Declarative, Spring-integrated | Opaque connection pool |
| Go HTTP client | `net/http` pooled transport | Matches Feign pool size exactly | Manual config required |
| Monitoring | Prometheus + Grafana | Industry standard, PromQL quantiles | Cardinality management |
| Load tool | K6 | Lightweight, scriptable, threshold support | Single-node load limit |
| ORM | Hibernate (Java) / GORM (Go) | Both are most-used ORMs per ecosystem | Different transaction semantics |
| Pool sizes | 50 max for both | Equalizes DB contention | Both may starve DB at 200 VUs |

```text
