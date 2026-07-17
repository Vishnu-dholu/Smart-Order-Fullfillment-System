# 23 — Fairness and Validity

> This is the most scrutinized section in research presentations and viva exams.
> Every benchmark must defend its methodology against threats to validity.

---

## Fairness Controls Implemented

### Control 1: Equal CPU Limits

**Implementation:**

```yaml
# docker-compose.ssp.yml
deploy:
  resources:
    limits:
      cpus: '1.0'   # Applied to EVERY service container
```

**What it prevents:** Go using 8 cores while Java is limited — Go would appear faster simply due to horizontal CPU scaling, not runtime efficiency.

**How it works:** Linux cgroup v2 CPU quota. Docker translates `cpus: 1.0` to `cpu_quota = 100000` µs per `cpu_period = 100000` µs. The kernel enforces this via the completely fair scheduler (CFS) bandwidth controller.

**Residual concern:** `GOMAXPROCS` defaults to `runtime.NumCPU()` which reads the host's physical core count (e.g., 8), NOT the Docker cgroup limit. Go may create 8 OS threads, all competing for 1 CPU quota. Fix: `GOMAXPROCS=1` env var.

---

### Control 2: Equal Memory Limits

**Implementation:** `memory: 768M` for all service containers.

**What it prevents:** Java using 2GB heap and never triggering GC while Go runs with 100MB.

**Residual concern:** Java needs `-XX:MaxRAMPercentage=70.0` to respect the container limit. Without this flag, JVM reads host RAM and may attempt a 4GB+ heap, immediately triggering OOM kill.

---

### Control 3: Database Connection Pool Equalization

**Java (HikariCP):**

```properties
spring.datasource.hikari.maximum-pool-size=50
spring.datasource.hikari.minimum-idle=10
```

**Go (database/sql):**

```go
// database/db.go:29-31
sqlDB.SetMaxOpenConns(50)
sqlDB.SetMaxIdleConns(10)
```

**What it prevents:** Go opening 200 simultaneous DB connections (unlimited default) while Java is capped at 10 (Spring Boot default). Without equalization, Go could parallelize DB operations that Java must queue.

---

### Control 4: HTTP Client Connection Pool Equalization

**The Problem (Pre-Fix):**

```go
// WRONG — creates new client per call, no connection reuse
resp, err := http.Post(inventoryURL, "application/json", body)
```

Each call to the inventory or warehouse service created a fresh TCP connection. Under 200 VUs, this meant 200 simultaneous TCP SYN-SYN/ACK-ACK handshakes per second — artificial penalty for Go.

**The Fix:**

```go
// httpclient.go
sharedTransport := &http.Transport{
    MaxIdleConnsPerHost: 50,  // Matches Feign's default pool size
}
var SharedClient = &http.Client{
    Timeout:   5 * time.Second,
    Transport: sharedTransport,
}
```

**Code Location:** `services/go/order-twin/internal/clients/httpclient.go`

**What this equalizes:** OpenFeign reuses TCP connections from its pool by default. Before the fix, Go was paying TCP handshake overhead on every call — an implementation artifact, not a language characteristic.

---

### Control 5: Execution Order Randomization

**Implementation:**

```bash
# run-benchmarks.sh:22-52
ORDER_FLIP=$((RANDOM % 2))
if [ $ORDER_FLIP -eq 0 ]; then
    FIRST_ORDER_URL="http://localhost:8083/orders"   # Java first
    SECOND_ORDER_URL="http://localhost:9083/orders"  # Go second
else
    FIRST_ORDER_URL="http://localhost:9083/orders"   # Go first
    SECOND_ORDER_URL="http://localhost:8083/orders"  # Java second
fi
```

**Actual run:** Go ran first (`go_order` segment starts 08:09:11Z, `java_order` starts 08:49:20Z).

**What it prevents:** Temporal bias — the second service always runs in a different system state (post-GC, different memory pressure, different OS page cache state).

---

### Control 6: Stock Reset Between Tests

**Implementation:** `reset-stock.sh` runs before each benchmark segment.

**What it prevents:** Go's benchmark benefiting from a "fresh" database (no fragmentation, larger stock quantities available) while Java runs against depleted stock (causing more 409 errors).

---

### Control 7: 5-Minute Cooldown Between Segments

**Implementation:** `sleep 300` between benchmark segments.

**What it prevents:** JVM G1GC backlog from the Go order test affecting Java's first minutes. HikariCP connections from Go requests lingering in PostgreSQL, affecting Java's pool behavior.

---

### Control 8: JVM Warmup Phase

**Implementation:** 5-minute K6 warmup at 10 VUs + threshold exclusion via `{phase:measurement}`.

**What it prevents:** Measuring Java during JVM interpreter mode (before JIT optimization). Without warmup, Java's early high-latency interpreter phase would inflate aggregate results.

---

## Threats to Validity

### Threat 1: Single-Run Benchmark (MAJOR)

**Problem:** Each benchmark ran once. No statistical confidence intervals.

**Impact:** Results could be outliers. A single run of 35 minutes captures one GC cycle pattern, one OS scheduler state, one PostgreSQL buffer cache state.

**Mitigation not done:** Running 5+ iterations and reporting `mean ± std deviation` or `median [Q1, Q3]`.

**What this means for conclusions:** Results are **indicative**, not statistically proven. The directional trends (Go lower memory, Go lower P99) are consistent with published benchmarks and runtime theory, lending credibility.

---

### Threat 2: Shared PostgreSQL Instance (MEDIUM)

**Problem:** Both stacks connect to the SAME PostgreSQL instance (different databases, but same server). PostgreSQL's shared buffer cache, WAL writer, and background autovacuum are shared resources.

**Impact:** During Java's benchmark, Go's idle connections may hold connections in the pool, consuming PostgreSQL's `max_connections`. Java's heavy write load may trigger PostgreSQL checkpoint I/O that impacts Go's subsequent read test.

**Mitigation:** Separate databases per service (`order_db`, `inventory_db`, etc.) reduce but don't eliminate inter-service interference.

---

### Threat 3: Local Docker Environment (MEDIUM)

**Problem:** All containers run on the same physical host, sharing the same CPU L1/L2/L3 caches, memory bandwidth, and NVMe I/O. Production Kubernetes would isolate services on separate nodes.

**Impact:** Docker's bridge network adds iptables NAT overhead to every inter-service HTTP call (inventory, warehouse). This equally affects both stacks, but production bare-metal or SR-IOV networking would be faster.

---

### Threat 4: GOMAXPROCS Not Set (MEDIUM)

**Problem:** Go containers don't set `GOMAXPROCS=1`. With Docker `cpus: 1.0` but host having 8 cores, Go may create 8 OS threads, all competing for 1 CPU quota.

**Impact:** Slight performance degradation for Go due to OS scheduler overhead from 8 competing threads sharing 1 CPU. If anything, this biases AGAINST Go — making Go appear slightly slower than it truly is on 1 physical core.

---

### Threat 5: K6 Sleep(1) as Throughput Ceiling (LOW for order, MEDIUM for inventory)

**Problem:** `sleep(1)` in K6 limits each VU to ~1 request/second. For inventory reads (avg 1ms), this dramatically under-utilizes service capacity.

**Impact:** Both services are paced by K6, not by their actual capacity. The ~108 RPS ceiling for inventory reflects 200 VUs / (1s + 0.001s) ≈ 199 RPS capped by single-thread K6 scheduling. True capacity could be 10,000+ RPS for a Go cache-only endpoint.

**Mitigation:** Use `executor: 'constant-arrival-rate'` with `rate: 500` for the inventory test to measure actual capacity.

---

### Threat 6: Application Properties Credentials (SECURITY, NOT VALIDITY)

**Problem:** `application.properties` contains Neon cloud database credentials in plaintext. This is a security risk but doesn't affect benchmark validity.

---

## What Conclusions ARE Justified

✅ "Under these specific conditions (1 CPU, 768MB RAM, 200 VUs, PostgreSQL, 35-min sustained load), Go Gin demonstrated 7-9× lower memory footprint than Java Spring Boot."

✅ "Go exhibited 45% lower P99 tail latency in write-heavy order creation workload."

✅ "After JVM JIT warmup, Java Spring Boot matched Go Gin on read-heavy inventory throughput."

✅ "Go produced zero HTTP errors while Java produced 8 errors under peak DB connection pool pressure."

✅ "Go's goroutine-based concurrency model results in 10-50× fewer concurrent execution units compared to Tomcat's thread-per-request model."

---

## What Conclusions Are NOT Justified

❌ "Go is faster than Java in all microservice scenarios." (Only tested 2 specific workloads)

❌ "Go should replace Java for all backend services." (Single environment, single benchmark design)

❌ "Java Spring Boot is inefficient." (JVM's throughput equals Go after warmup; memory tradeoff is deliberate)

❌ "The results are statistically significant." (Single run — no p-value, no confidence interval)

❌ "These results apply to high-RPS production systems." (K6 sleep(1) limits throughput; real production may have different bottlenecks)

---

## Reproducibility Assessment

| Aspect | Reproducibility |
| -------- | ---------------- |
| Source code | ✅ Full source committed to Git |
| Docker Compose | ✅ Exact image versions and configs |
| K6 scripts | ✅ Exact scripts committed |
| Database seed data | ✅ `init.sql` and seed scripts committed |
| Prometheus config | ✅ `prometheus.yml` committed |
| Python exporter | ✅ `export_metrics_v2.py` committed |
| Execution order | ⚠️ Randomized — different result on each run |
| OS/kernel state | ❌ Not specified (page cache state, swap usage) |
| Host hardware | ❌ Not specified (affects actual CPU MHz) |

---

## Interview Questions on Validity

1. **How would you make this benchmark more statistically rigorous?**
   → Run each benchmark 5+ times. Report mean ± 95% CI. Use a statistical test (Mann-Whitney U or t-test) to determine if differences are statistically significant. Current single-run design cannot claim statistical significance.

2. **What is a confounding variable in your benchmark?**
   → The shared PostgreSQL instance is a confounding variable — both stacks use it, and PostgreSQL's internal state (buffer cache warming, WAL checkpoint timing) can affect throughput in ways unrelated to the runtime being tested.

3. **Is the execution order randomization sufficient?**
   → It prevents systematic bias (always running Java first) but doesn't eliminate it for a single run. True elimination requires multiple runs with both orderings and averaging results.

4. **How does GOMAXPROCS affect Go's benchmark results?**
   → Without `GOMAXPROCS=1`, Go may create excess OS threads on multi-core hosts even with `cpus: 1.0` Docker limits. This slightly penalizes Go (more thread contention for 1 CPU), meaning Go's actual performance on a dedicated single core could be even better than measured.

5. **Why is a shared database a threat to validity?**

```text
