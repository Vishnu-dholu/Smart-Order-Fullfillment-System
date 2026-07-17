# 19 — Benchmark Dataset Analysis

> Deep analysis of the actual exported dataset: `metrics_master.csv`, `by_metric/*.csv`, `metrics_metadata.json`

---

## Dataset Overview

| Property | Value |
| ---------- | ------- |
| **Total data points** | 37,692 rows |
| **Export script** | `load-tests/export_metrics_v2.py` |
| **Export timestamp** | 2026-06-23T10:44:41Z |
| **Prometheus URL** | `http://localhost:9090` |
| **Step (query resolution)** | 15 seconds |
| **Total metrics** | 21 unique metric keys |
| **Test segments** | 4 (go_order, java_order, go_inventory, java_inventory) |
| **Load phases** | 6 (warmup, ramp_1, ramp_2, ramp_3, sustain, cooldown) |
| **Master CSV** | `metrics_master.csv` |
| **Per-metric CSVs** | `by_metric/21 files` |
| **Metadata** | `metrics_metadata.json` |

---

## Test Segments

The 4 benchmark segments ran sequentially on **2026-06-23**:

| Segment Label | Service Type | Benchmark Type | Start UTC | End UTC | Duration |
| --------------- | ------------- | ---------------- | ----------- | --------- | ---------- |
| `go_order` | go | order | 08:09:11Z | 08:44:14Z | 35.0 min |
| `java_order` | java | order | 08:49:20Z | 09:24:21Z | 35.0 min |
| `go_inventory` | go | inventory | 09:29:29Z | 10:04:30Z | 35.0 min |
| `java_inventory` | java | inventory | 10:09:39Z | 10:44:40Z | 35.0 min |

**Key observation:** `go_order` ran BEFORE `java_order` (Go first). Execution order was randomized by `run-benchmarks.sh` using `ORDER_FLIP=$((RANDOM % 2))`. On this run, Go was selected first.

**5-minute gaps** between segments (e.g., go_order ends 08:44, java_order starts 08:49) represent the mandatory cooldown period for DB pool drain, GC to settle, and system thermal normalization.

---

## Load Phase Data Point Distribution

| Phase | Offset Range (seconds) | K6 VUs | Data Points |
| ------- | ---------------------- | -------- | ------------- |
| `warmup` | 0 – 300 | 0→10 | 5,305 |
| `ramp_1` | 300 – 600 | 10→50 | 5,340 |
| `ramp_2` | 600 – 900 | 50→100 | 5,340 |
| `ramp_3` | 900 – 1,200 | 100→200 | 5,359 |
| `sustain` | 1,200 – 1,800 | 200 | 10,720 |
| `cooldown` | 1,800 – 2,100 | 200→0 | 5,360 |
| `post_test` | > 2,100 | 0 | 268 |

The `sustain` phase has 2× data points because it runs for 10 minutes (vs 5 minutes for each ramp). This is the primary analysis window.

---

## Master CSV Schema — Column Data Dictionary

**File:** `metrics_master.csv`

| Column | Type | Description | Example Value |
| -------- | ------ | ------------- | --------------- |
| `grafana_panel_id` | int | Panel number in the 9-panel Grafana dashboard (1-9) | `3` |
| `grafana_ref_id` | string | Prometheus datasource ref (A, B, C...) within the panel | `"A"` |
| `grafana_panel_title` | string | Human-readable panel name | `"P99 HTTP Latency Panel (Java vs Go)"` |
| `segment_label` | string | Test segment identifier | `"java_order"` |
| `service_type` | string | Runtime (`java` or `go`) | `"java"` |
| `benchmark_type` | string | Workload type (`order` or `inventory`) | `"order"` |
| `instance` | string | Prometheus target (host:port) | `"order-java:8083"` |
| `job` | string | Prometheus scrape job name | `"spring-boot-services"` |
| `service_label` | string | Simplified service label for charts | `"order-java:8083"` |
| `timestamp_local` | datetime | IST local time (UTC+5:30) | `"2026-06-23 14:19:20"` |
| `timestamp_utc` | ISO 8601 | UTC timestamp | `"2026-06-23T08:49:20Z"` |
| `timestamp_unix` | int | Unix epoch seconds | `1782200960` |
| `load_phase` | string | K6 stage at this timestamp | `"warmup"` |
| `offset_seconds` | float | Seconds since test segment start | `0.0` |
| `metric_name` | string | Internal metric key | `"p99_latency_spring_seconds"` |
| `value` | float | Metric measurement | `0.044124076449999994` |
| `prom_labels_json` | JSON string | Raw Prometheus labels dict | `"{}"` |

---

## Per-Metric CSV Schema

**Files:** `by_metric/*.csv`

These files contain the same rows as master CSV, but pre-filtered for one metric. Columns differ slightly (no `job` column, no `metric_name` column — implied by filename).

**Example row from `p99_latency_spring_seconds.csv`:**

```text
grafana_panel_id: 3
grafana_ref_id: A
grafana_panel_title: P99 HTTP Latency Panel (Java vs Go)
segment_label: go_inventory       ← Segment name (go_inventory, not java!)
service_type: go                   ← This column refers to which segment was running
benchmark_type: inventory
instance: order-java:8083          ← JAVA instance data, recorded during Go inventory test
service_label: order-java:8083
timestamp_local: 2026-06-23 14:59:29
timestamp_utc: 2026-06-23T09:29:29Z
timestamp_unix: 1782206969
load_phase: warmup
offset_seconds: 0.0
value: 0.005578423989999999         ← P99 latency in SECONDS (5.58ms at warmup idle)
prom_labels_json: {}
```

> **Important:** The `segment_label` and `service_type` columns refer to WHICH benchmark test was running when this data was collected — NOT necessarily which service the metric belongs to. Prometheus scrapes ALL services continuously. During `go_inventory` segment, Java services are still running idle and their metrics are still scraped.

---

## Per-Metric Data Point Counts

| Metric Key | CSV File | Data Points | Panel | Ref |
| ----------- | --------- | ------------- | ------- | ----- |
| `rss_memory_go_bytes` | `rss_memory_go_bytes.csv` | 1,692 | 1 | A |
| `jvm_total_memory_used_bytes` | `jvm_total_memory_used_bytes.csv` | 1,692 | 1 | B |
| `cpu_usage_spring` | `cpu_usage_spring.csv` | 1,692 | 2 | A |
| `cpu_usage_go` | `cpu_usage_go.csv` | 1,692 | 2 | B |
| `p99_latency_spring_seconds` | `p99_latency_spring_seconds.csv` | 1,692 | 3 | A |
| `p99_latency_go_seconds` | `p99_latency_go_seconds.csv` | 1,544 | 3 | B |
| `throughput_spring_rps` | `throughput_spring_rps.csv` | 1,692 | 4 | A |
| `throughput_go_rps` | `throughput_go_rps.csv` | 1,544 | 4 | B |
| `heap_memory_jvm_bytes` | `heap_memory_jvm_bytes.csv` | 5,076 | 5 | A |
| `heap_memory_go_bytes` | `heap_memory_go_bytes.csv` | 1,692 | 5 | B |
| `gc_pause_rate_jvm_seconds` | `gc_pause_rate_jvm_seconds.csv` | 2,094 | 6 | A |
| `gc_pause_rate_go_seconds` | `gc_pause_rate_go_seconds.csv` | 1,692 | 6 | B |
| `gc_cycles_go_per_second` | `gc_cycles_go_per_second.csv` | 1,692 | 6 | C |
| `db_connections_active` | `db_connections_active.csv` | 1,692 | 7 | A |
| `db_connections_pending` | `db_connections_pending.csv` | 1,692 | 7 | B |
| `go_sql_in_use_connections` | `go_sql_in_use_connections.csv` | 1,692 | 7 | C |
| `go_sql_open_connections` | `go_sql_open_connections.csv` | 1,692 | 7 | D |
| `go_sql_idle_connections` | `go_sql_idle_connections.csv` | 1,692 | 7 | E |
| `jvm_threads_live` | `jvm_threads_live.csv` | 1,692 | 8 | A |
| `go_goroutines` | `go_goroutines.csv` | 1,692 | 8 | B |
| `error_rate_spring_rps` | `error_rate_spring_rps.csv` | 362 | 9 | A |
| `error_rate_go_rps` | *(no file)* | 0 | 9 | B |

**Why `heap_memory_jvm_bytes` has 5,076 points (3× others)?**
JVM heap is exported per region: `jvm_memory_used_bytes{area="heap", id="G1 Eden Space"}`, `{id="G1 Old Gen"}`, `{id="G1 Survivor Space"}`. Three series × 1,692 = 5,076.

**Why `p99_latency_go_seconds` has only 1,544 points (vs 1,692 for Spring)?**
Prometheus emits histogram data only when requests are observed. During idle periods (between test segments), Go services have no traffic and the histogram vector is empty — Prometheus returns no data. Spring's pre-computed quantile metrics persist during idle.

**Why `error_rate_spring_rps` has only 362 points?**
Errors only occurred during peak load phases. Prometheus emits a data point only when the counter is nonzero. 362 ÷ 21 metrics per instance ÷ ~3 instances = ~6 error-producing time windows.

---

## PromQL Queries Used for Each Metric

| Metric Key | PromQL Query |
| ----------- | ------------- |
| `rss_memory_go_bytes` | `process_resident_memory_bytes` |
| `jvm_total_memory_used_bytes` | `sum by (instance) (jvm_memory_used_bytes)` |
| `cpu_usage_spring` | `process_cpu_usage` |
| `cpu_usage_go` | `rate(process_cpu_seconds_total[1m])` |
| `p99_latency_spring_seconds` | `histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket[1m])) by (le, instance))` |
| `p99_latency_go_seconds` | `histogram_quantile(0.99, sum(rate(gin_request_duration_seconds_bucket[1m])) by (le, instance))` |
| `throughput_spring_rps` | `sum(rate(http_server_requests_seconds_count[1m])) by (instance)` |
| `throughput_go_rps` | `sum(rate(gin_request_duration_seconds_count[1m])) by (instance)` |
| `heap_memory_jvm_bytes` | `jvm_memory_used_bytes{area="heap"}` |
| `heap_memory_go_bytes` | `go_memstats_heap_alloc_bytes` |
| `gc_pause_rate_jvm_seconds` | `rate(jvm_gc_pause_seconds_sum[1m])` |
| `gc_pause_rate_go_seconds` | `rate(go_gc_duration_seconds_sum[1m])` |
| `gc_cycles_go_per_second` | `rate(go_gc_duration_seconds_count[1m])` |
| `db_connections_active` | `hikaricp_connections_active` |
| `db_connections_pending` | `hikaricp_connections_pending` |
| `go_sql_in_use_connections` | `go_sql_in_use_connections` |
| `go_sql_open_connections` | `go_sql_open_connections` |
| `go_sql_idle_connections` | `go_sql_idle_connections` |
| `jvm_threads_live` | `jvm_threads_live_threads` |
| `go_goroutines` | `go_goroutines` |
| `error_rate_spring_rps` | `sum(rate(http_server_requests_seconds_count{status=~"5.*"}[1m])) by (instance)` |

---

## Phase Mapping Algorithm Explained

```python
# export_metrics_v2.py

K6_STAGES = [
    ("warmup",   0,    300),
    ("ramp_1",   300,  600),
    ("ramp_2",   600,  900),
    ("ramp_3",   900,  1200),
    ("sustain",  1200, 1800),
    ("cooldown", 1800, 2100),
]

def resolve_phase(unix_ts: int, segment_start_unix: int) -> tuple[str, float]:
    offset = unix_ts - segment_start_unix   # Seconds since this test segment started
    for phase, start, end in K6_STAGES:
        if start <= offset < end:
            return phase, float(offset)
    return "post_test", float(offset)
```

**Example calculation:**

- `segment_start_unix` for `go_order`: `2026-06-23T08:09:11Z` = 1782200951
- A data point at `1782201851` (900 seconds later) → `offset = 900` → maps to `ramp_3`

---

## Interpreting Multi-Instance Data

Each metric row has an `instance` label (e.g., `inventory-go-twin:9082`, `order-go-twin:9083`).

**Important:** During the `go_order` benchmark, K6 only hits `order-go-twin:9083`. But Prometheus scrapes ALL instances:

- `inventory-go-twin:9082` — idle (not being benchmarked)
- `order-go-twin:9083` — under 200 VU load
- `warehouse-go:8084` — under load (called by order-twin)

When analyzing results, **filter by the specific instance being benchmarked**:

```python
# Filter to only the instance under test
df[(df['segment_label'] == 'go_order') & 
   (df['instance'] == 'order-go-twin:9083')]
```

---

## Dataset Interview Questions

1. **What is the step parameter and why is it 15s?**
   → Step = query resolution. 15s = 3× the 5s scrape interval. Provides ~140 data points per 35-min test without excessive volume. 37,692 total rows across all metrics.

2. **Why does `heap_memory_jvm_bytes` have 5,076 rows instead of 1,692?**
   → JVM heap is split into multiple regions (G1 Eden, G1 Old Gen, G1 Survivor Space). Each region is a separate Prometheus time series. 3 regions × 1,692 = 5,076.

3. **What does `offset_seconds: 0.0` represent?**
   → The first data point of that segment — exactly at the test start time. The K6 warmup begins here with 10 VUs ramping from 0.

4. **Why is `segment_label = "go_inventory"` but `instance = "inventory-java:8082"`?**
   → Prometheus scrapes all services continuously. During the Go inventory benchmark, Java services are idle but still scraped. This idle-state Java data is in the `go_inventory` segment rows, useful for baseline comparison.
