#!/usr/bin/env python3
"""
Smart Order Fulfillment — Comprehensive Prometheus Metrics Exporter
=====================================================================
Exports all 9 Grafana/Prometheus metrics into:
  1. A SEPARATE CSV file per metric (for easy per-metric analysis)
  2. A MASTER comprehensive CSV with all metrics + rich metadata columns
  3. A metadata JSON summarising the export session

Each data point is annotated with:
  - The LOAD PHASE it was collected during  (warmup / ramp_1 / ramp_2 / ramp_3 / sustain / cooldown / cooldown_inter)
  - The service type                        (java / go)
  - The benchmark type                      (order / inventory)
  - Human-readable wall-clock timestamps
  - Unix timestamps for precise analysis

Load phase boundaries are derived from the k6 staged ramp schedule:
    Warmup   : 0  → 5m
    Ramp 1   : 5  → 10m
    Ramp 2   : 10 → 15m
    Ramp 3   : 15 → 20m
    Sustain  : 20 → 30m
    Cooldown : 30 → 35m

Usage:
    python3 export_metrics_v2.py \\
        --out-dir  load-tests/results/20260623_120000 \\
        --url      http://localhost:9090 \\
        --step     15s \\
        --phases   java_order:1719100000:1719102100,go_order:1719102600:1719104700,...
"""

import csv
import json
import os
import sys
import urllib.request
import urllib.parse
import argparse
from datetime import datetime, timezone
from typing import Optional

# ---------------------------------------------------------------------------
# Metric definitions — one entry per Grafana panel refId
#
# Structure: metric_key → (panel_id, ref_id, grafana_title, promql)
#
# Panels with two refIds (Java vs Go) are split into separate entries so
# neither side can be silently dropped by Prometheus `or` semantics.
# ---------------------------------------------------------------------------
METRICS = {
    # Panel 1 — RSS Memory Footprint
    # Go client  → process_resident_memory_bytes (standard Go prometheus client metric)
    # Spring Boot → process_resident_memory_bytes is NOT emitted by Micrometer.
    #               Best equivalent: sum(jvm_memory_used_bytes) = heap + non-heap
    #               (metaspace, code cache, etc.) — total JVM committed memory.
    "rss_memory_go_bytes": (
        1, "A",
        "RSS Memory Footprint",
        "process_resident_memory_bytes"
    ),
    "jvm_total_memory_used_bytes": (
        1, "B",
        "RSS Memory Footprint",
        "sum(jvm_memory_used_bytes) by (instance)"
    ),

    # Panel 2 — CPU Usage Rate  (Spring → refA, Go → refB)
    "cpu_usage_spring": (
        2, "A",
        "CPU Usage Rate",
        "process_cpu_usage"
    ),
    "cpu_usage_go": (
        2, "B",
        "CPU Usage Rate",
        "rate(process_cpu_seconds_total[1m])"
    ),

    # Panel 3 — P99 HTTP Latency  (Spring → refA, Go → refB)
    "p99_latency_spring_seconds": (
        3, "A",
        "P99 HTTP Latency Panel (Java vs Go)",
        "histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket[1m])) by (le, instance))"
    ),
    "p99_latency_go_seconds": (
        3, "B",
        "P99 HTTP Latency Panel (Java vs Go)",
        "histogram_quantile(0.99, sum(rate(gin_request_duration_seconds_bucket[1m])) by (le, instance))"
    ),

    # Panel 4 — HTTP Throughput  (Spring → refA, Go → refB)
    "throughput_spring_rps": (
        4, "A",
        "HTTP Throughput",
        "sum(rate(http_server_requests_seconds_count[1m])) by (instance)"
    ),
    "throughput_go_rps": (
        4, "B",
        "HTTP Throughput",
        "sum(rate(gin_request_duration_seconds_count[1m])) by (instance)"
    ),

    # Panel 5 — Resource Footprint / Memory Churn  (Spring JVM → refA, Go → refB)
    "heap_memory_jvm_bytes": (
        5, "A",
        "The Resource Footprint (Memory Churn)",
        "jvm_memory_used_bytes{area=\"heap\"}"
    ),
    "heap_memory_go_bytes": (
        5, "B",
        "The Resource Footprint (Memory Churn)",
        "go_memstats_heap_alloc_bytes"
    ),

    # Panel 6 — GC Pauses  (JVM → refA, Go pause rate → refB, Go cycle freq → refC)
    "gc_pause_rate_jvm_seconds": (
        6, "A",
        "Garbage Collection Pauses (Java vs Go)",
        "rate(jvm_gc_pause_seconds_sum[1m])"
    ),
    "gc_pause_rate_go_seconds": (
        6, "B",
        "Garbage Collection Pauses (Java vs Go)",
        "rate(go_gc_duration_seconds_sum[1m])"
    ),
    "gc_cycles_go_per_second": (
        6, "C",
        "Garbage Collection Pauses (Java vs Go)",
        "rate(go_gc_duration_seconds_count[1m])"
    ),

    # Panel 7 — DB Connection Pool
    # Java: HikariCP → refA (active), refB (pending)
    # Go:   sql.DB   → refC (in_use ≈ active), refD (open total), refE (idle)
    "db_connections_active": (
        7, "A",
        "DB Connection Pool (HikariCP vs Go sql.DB)",
        "hikaricp_connections_active"
    ),
    "db_connections_pending": (
        7, "B",
        "DB Connection Pool (HikariCP vs Go sql.DB)",
        "hikaricp_connections_pending"
    ),
    "go_sql_in_use_connections": (
        7, "C",
        "DB Connection Pool (HikariCP vs Go sql.DB)",
        "go_sql_in_use_connections"     # connections currently executing a query  (≈ hikaricp_connections_active)
    ),
    "go_sql_open_connections": (
        7, "D",
        "DB Connection Pool (HikariCP vs Go sql.DB)",
        "go_sql_open_connections"   # total open (in-use + idle)
    ),
    "go_sql_idle_connections": (
        7, "E",
        "DB Connection Pool (HikariCP vs Go sql.DB)",
        "go_sql_idle_connections"       # idle connections sitting in the pool
    ),


    # Panel 8 — Concurrency Model  (JVM threads → refA, goroutines → refB)
    "jvm_threads_live": (
        8, "A",
        "The Concurrency Model (Threads vs. Goroutines)",
        "jvm_threads_live_threads"
    ),
    "go_goroutines": (
        8, "B",
        "The Concurrency Model (Threads vs. Goroutines)",
        "go_goroutines"
    ),

    # Panel 9 — HTTP Error Rate  (Spring 5xx → refA, Go 5xx → refB)
    "error_rate_spring_rps": (
        9, "A",
        "HTTP Error Rate",
        "sum(rate(http_server_requests_seconds_count{status=~\"5.*\"}[1m])) by (instance)"
    ),
    "error_rate_go_rps": (
        9, "B",
        "HTTP Error Rate",
        "sum(rate(gin_request_duration_seconds_count{code=~\"5.*\"}[1m])) by (instance)"  # Gin uses label code, not status
    ),
}

# ---------------------------------------------------------------------------
# k6 stage durations (seconds) — matches order_benchmark.js / inventory_benchmark.js
# ---------------------------------------------------------------------------
K6_STAGES = [
    ("warmup",   0,   5 * 60),
    ("ramp_1",   5 * 60,  10 * 60),
    ("ramp_2",  10 * 60,  15 * 60),
    ("ramp_3",  15 * 60,  20 * 60),
    ("sustain", 20 * 60,  30 * 60),
    ("cooldown",30 * 60,  35 * 60),
]

# Phase label displayed in CSV for between-test cool-down periods
INTER_COOLDOWN_LABEL = "inter_test_cooldown"
PRE_TEST_LABEL       = "pre_test"
POST_TEST_LABEL      = "post_test"


# ---------------------------------------------------------------------------
# Helper: resolve which load phase a unix timestamp belongs to
# ---------------------------------------------------------------------------
def resolve_phase(unix_ts: float, test_start: float) -> str:
    """Return the human-readable phase name for a given timestamp."""
    if test_start is None:
        return "unknown"
    offset = unix_ts - test_start
    if offset < 0:
        return PRE_TEST_LABEL
    for phase_name, phase_start, phase_end in K6_STAGES:
        if phase_start <= offset < phase_end:
            return phase_name
    return POST_TEST_LABEL


# ---------------------------------------------------------------------------
# Helper: query Prometheus range API
# ---------------------------------------------------------------------------
def query_prometheus(query: str, start_ts: int, end_ts: int,
                     step: str, prom_url: str) -> list:
    params = urllib.parse.urlencode({
        "query": query,
        "start": start_ts,
        "end":   end_ts,
        "step":  step,
    })
    url = f"{prom_url}/api/v1/query_range?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SOF-Exporter/2.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            if body.get("status") == "success":
                return body["data"]["result"]
            print(f"  ⚠  Prometheus error for '{query[:60]}...': {body.get('error')}", file=sys.stderr)
            return []
    except Exception as exc:
        print(f"  ✗  Request failed ({exc})", file=sys.stderr)
        return []


# ---------------------------------------------------------------------------
# Helper: parse phase segment from CLI string
#   Format: "<label>:<service_type>:<benchmark_type>:<start_unix>:<end_unix>"
#   Example: "java_order:java:order:1719100000:1719102100"
# ---------------------------------------------------------------------------
def parse_segment(seg_str: str) -> dict:
    """Parse a phase-segment descriptor string into a dict."""
    parts = seg_str.strip().split(":")
    if len(parts) != 5:
        print(f"  ⚠  Invalid segment '{seg_str}' — expected label:service:benchmark:start:end", file=sys.stderr)
        return None
    label, service_type, benchmark_type, start_str, end_str = parts
    try:
        start_ts = int(float(start_str))
        end_ts   = int(float(end_str))
    except ValueError:
        print(f"  ⚠  Non-numeric timestamps in segment '{seg_str}'", file=sys.stderr)
        return None
    return {
        "label":          label,
        "service_type":   service_type,      # java | go
        "benchmark_type": benchmark_type,    # order | inventory
        "start_ts":       start_ts,
        "end_ts":         end_ts,
    }


# ---------------------------------------------------------------------------
# Core export logic
# ---------------------------------------------------------------------------
def export_segment(segment: dict, step: str, prom_url: str) -> list:
    """
    Query all 9 metrics for one test segment.
    Returns a flat list of row-dicts ready for CSV writing.
    """
    rows = []
    label         = segment["label"]
    service_type  = segment["service_type"]
    bench_type    = segment["benchmark_type"]
    start_ts      = segment["start_ts"]
    end_ts        = segment["end_ts"]
    test_start    = start_ts  # k6 scenario begins right at segment start

    for metric_name, metric_def in METRICS.items():
        panel_id, ref_id, panel_title, promql = metric_def
        print(f"    🔍  [{label}] Panel {panel_id}{ref_id}: {metric_name} …")
        results = query_prometheus(promql, start_ts, end_ts, step, prom_url)

        if not results:
            print(f"         ℹ  No data returned (service may not expose this metric)")
            continue

        for series in results:
            meta        = series.get("metric", {})
            instance    = meta.get("instance",    "unknown")
            job         = meta.get("job",          "unknown")
            application = meta.get("application",  "unknown")

            # Build a readable service label
            service_label = instance
            if application != "unknown":
                service_label += f" ({application})"
            if "id" in meta:   # e.g. JVM heap memory pool name
                service_label += f" [{meta['id']}]"

            for unix_ts, value_str in series.get("values", []):
                value = float(value_str) if value_str not in ("NaN", "+Inf", "-Inf") else None
                phase    = resolve_phase(float(unix_ts), test_start)
                dt_local = datetime.fromtimestamp(unix_ts).strftime("%Y-%m-%d %H:%M:%S")
                dt_utc   = datetime.fromtimestamp(unix_ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

                rows.append({
                    # Grafana panel provenance
                    "grafana_panel_id":    panel_id,
                    "grafana_ref_id":      ref_id,
                    "grafana_panel_title": panel_title,
                    # Identification
                    "segment_label":       label,
                    "service_type":        service_type,
                    "benchmark_type":      bench_type,
                    "instance":            instance,
                    "job":                 job,
                    "service_label":       service_label,
                    # Temporal
                    "timestamp_local":     dt_local,
                    "timestamp_utc":       dt_utc,
                    "timestamp_unix":      unix_ts,
                    "load_phase":          phase,
                    "offset_seconds":      round(float(unix_ts) - test_start, 1),
                    # Data
                    "metric_name":         metric_name,
                    "value":               value if value is not None else "",
                    # All remaining Prometheus labels as JSON
                    "prom_labels_json":    json.dumps({k: v for k, v in meta.items()
                                                        if k not in ("instance", "job", "application")}),
                })

    return rows


# ---------------------------------------------------------------------------
# Write CSVs
# ---------------------------------------------------------------------------
MASTER_FIELDNAMES = [
    "grafana_panel_id", "grafana_ref_id", "grafana_panel_title",
    "segment_label", "service_type", "benchmark_type",
    "instance", "job", "service_label",
    "timestamp_local", "timestamp_utc", "timestamp_unix",
    "load_phase", "offset_seconds",
    "metric_name", "value",
    "prom_labels_json",
]

PER_METRIC_FIELDNAMES = [
    "grafana_panel_id", "grafana_ref_id", "grafana_panel_title",
    "segment_label", "service_type", "benchmark_type",
    "instance", "service_label",
    "timestamp_local", "timestamp_utc", "timestamp_unix",
    "load_phase", "offset_seconds",
    "value",
    "prom_labels_json",
]


def write_master_csv(all_rows: list, out_path: str) -> None:
    all_rows.sort(key=lambda r: (r["metric_name"], r["segment_label"],
                                  r["timestamp_unix"], r["service_label"]))
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=MASTER_FIELDNAMES, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)
    print(f"  📁  Master CSV  → {out_path}  ({len(all_rows)} rows)")


def write_per_metric_csvs(all_rows: list, out_dir: str) -> dict:
    # Group by metric_name
    by_metric: dict[str, list] = {}
    for row in all_rows:
        by_metric.setdefault(row["metric_name"], []).append(row)

    written: dict[str, str] = {}
    metrics_dir = os.path.join(out_dir, "by_metric")
    os.makedirs(metrics_dir, exist_ok=True)

    for metric_name, rows in by_metric.items():
        rows.sort(key=lambda r: (r["segment_label"], r["timestamp_unix"], r["service_label"]))
        out_path = os.path.join(metrics_dir, f"{metric_name}.csv")
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=PER_METRIC_FIELDNAMES, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)
        written[metric_name] = out_path
        print(f"  📄  {metric_name}.csv  → {out_path}  ({len(rows)} rows)")

    return written


def write_metadata_json(segments: list, all_rows: list,
                        args, written_files: dict, out_path: str) -> None:
    # Phase breakdown stats
    phase_counts: dict[str, int] = {}
    for row in all_rows:
        phase_counts[row["load_phase"]] = phase_counts.get(row["load_phase"], 0) + 1

    # Per-metric row counts
    metric_counts: dict[str, int] = {}
    for row in all_rows:
        metric_counts[row["metric_name"]] = metric_counts.get(row["metric_name"], 0) + 1

    metadata = {
        "export_timestamp_utc": datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "prometheus_url":       args.url,
        "step":                 args.step,
        "total_data_points":    len(all_rows),
        "metrics_exported": [
            {"key": k, "panel_id": v[0], "ref_id": v[1], "panel_title": v[2]}
            for k, v in METRICS.items()
        ],
        "segments": [
            {
                "label":          s["label"],
                "service_type":   s["service_type"],
                "benchmark_type": s["benchmark_type"],
                "start_utc":      datetime.fromtimestamp(s["start_ts"], tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "end_utc":        datetime.fromtimestamp(s["end_ts"],   tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "duration_minutes": round((s["end_ts"] - s["start_ts"]) / 60, 1),
            }
            for s in segments
        ],
        "load_phases_defined": [
            {"phase": name, "start_offset_s": s, "end_offset_s": e}
            for name, s, e in K6_STAGES
        ],
        "phase_data_point_counts": phase_counts,
        "per_metric_data_point_counts": metric_counts,
        "output_files": {
            "master_csv":       written_files.get("master"),
            "per_metric_csvs":  {k: v for k, v in written_files.items() if k != "master"},
        },
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"  📋  Metadata JSON → {out_path}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Export Prometheus metrics into per-metric CSVs + master CSV with load-phase annotations."
    )
    parser.add_argument(
        "--out-dir", default=".",
        help="Output directory (will be created if absent). Default: current dir"
    )
    parser.add_argument(
        "--url", default="http://localhost:9090",
        help="Prometheus base URL. Default: http://localhost:9090"
    )
    parser.add_argument(
        "--step", default="15s",
        help="Query resolution step (e.g. 5s, 15s, 1m). Default: 15s"
    )
    parser.add_argument(
        "--segments", required=True,
        help=(
            "Comma-separated list of test segments. Each segment:\n"
            "  label:service_type:benchmark_type:start_unix:end_unix\n"
            "Example:\n"
            "  java_order:java:order:1719100000:1719102100,"
            "go_order:go:order:1719102600:1719104700"
        )
    )
    parser.add_argument(
        "--run-id", default=None,
        help="Optional run identifier appended to filenames (e.g. run_1)"
    )

    args = parser.parse_args()

    # Parse segments
    segments = []
    for seg_str in args.segments.split(","):
        seg = parse_segment(seg_str)
        if seg:
            segments.append(seg)

    if not segments:
        print("✗ No valid segments provided. Exiting.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.out_dir, exist_ok=True)

    print()
    print("=" * 65)
    print("  SOF Comprehensive Metrics Exporter v2.0")
    print("=" * 65)
    print(f"  Prometheus : {args.url}")
    print(f"  Step       : {args.step}")
    print(f"  Segments   : {len(segments)}")
    print(f"  Metrics    : {len(METRICS)}")
    print(f"  Output     : {args.out_dir}")
    print("=" * 65)
    print()

    all_rows = []
    for seg in segments:
        duration_m = round((seg["end_ts"] - seg["start_ts"]) / 60, 1)
        start_str  = datetime.fromtimestamp(seg["start_ts"]).strftime("%Y-%m-%d %H:%M:%S")
        end_str    = datetime.fromtimestamp(seg["end_ts"]).strftime("%Y-%m-%d %H:%M:%S")
        print(f"📦 Segment: [{seg['label']}]  {start_str} → {end_str}  ({duration_m} min)")
        rows = export_segment(seg, args.step, args.url)
        all_rows.extend(rows)
        print(f"   ✓ {len(rows)} data points collected\n")

    if not all_rows:
        print("⚠  No data collected across any segment. Is Prometheus running?", file=sys.stderr)
        sys.exit(1)

    print("-" * 65)
    print(f"  Total data points : {len(all_rows)}")
    print("-" * 65)
    print()

    # Build output file suffix
    suffix = f"_{args.run_id}" if args.run_id else ""

    # Write outputs
    print("💾 Writing output files …")
    master_path   = os.path.join(args.out_dir, f"metrics_master{suffix}.csv")
    metadata_path = os.path.join(args.out_dir, f"metrics_metadata{suffix}.json")

    write_master_csv(all_rows, master_path)
    per_metric_paths = write_per_metric_csvs(all_rows, args.out_dir)
    write_metadata_json(
        segments, all_rows, args,
        {"master": master_path, **per_metric_paths},
        metadata_path
    )

    print()
    print("=" * 65)
    print(f"  ✅  Export complete! {len(all_rows)} data points written.")
    print(f"  📂  Output directory: {args.out_dir}/")
    print(f"      ├── metrics_master{suffix}.csv       (all metrics)")
    print(f"      ├── metrics_metadata{suffix}.json    (summary)")
    print(f"      └── by_metric/   ({len(METRICS)} files, one per panel refId)")
    for m in METRICS:
        pid, rid, _, _ = METRICS[m]
        print(f"          ├── {m}.csv   [Panel {pid}{rid}]")
    print("=" * 65)
    print()


if __name__ == "__main__":
    main()
