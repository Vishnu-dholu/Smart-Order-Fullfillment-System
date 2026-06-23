#!/usr/bin/env python3
import csv
import json
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
import argparse
import sys

# Define the metrics we want to query, mapping user-friendly names to PromQL expressions
METRIC_QUERIES = {
    "rss_memory_bytes": "process_resident_memory_bytes",
    "cpu_usage_ratio": "(process_cpu_usage or rate(process_cpu_seconds_total[1m]))",
    "p99_latency_seconds": "(histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket[1m])) by (le, instance)) or histogram_quantile(0.99, sum(rate(gin_request_duration_seconds_bucket[1m])) by (le, instance)))",
    "throughput_rps": "(sum(rate(http_server_requests_seconds_count[1m])) by (instance) or sum(rate(gin_request_duration_seconds_count[1m])) by (instance))",
    "heap_memory_bytes": "(jvm_memory_used_bytes{area=\"heap\"} or go_memstats_heap_alloc_bytes)",
    "gc_pause_rate": "rate(jvm_gc_pause_seconds_sum[1m])",
    "db_connections_active": "hikaricp_connections_active",
    "db_connections_pending": "hikaricp_connections_pending",
    "concurrency_threads_or_goroutines": "(jvm_threads_live_threads or go_goroutines)",
    "error_rate_rps": "(sum(rate(http_server_requests_seconds_count{status=~\"5.*\"}[1m])) by (instance) or sum(rate(gin_request_duration_seconds_count{status=~\"5.*\"}[1m])) by (instance))"
}

def query_prometheus_range(query, start_time, end_time, step="15s", prometheus_url="http://localhost:9090"):
    """Queries Prometheus query_range endpoint and returns the result."""
    params = {
        "query": query,
        "start": start_time,
        "end": end_time,
        "step": step
    }
    encoded_params = urllib.parse.urlencode(params)
    url = f"{prometheus_url}/api/v1/query_range?{encoded_params}"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data.get("status") == "success":
                return data["data"]["result"]
            else:
                print(f"Error from Prometheus for query '{query}': {data.get('error')}", file=sys.stderr)
                return []
    except Exception as e:
        print(f"Failed to query Prometheus at {prometheus_url}: {e}", file=sys.stderr)
        return []

def main():
    parser = argparse.ArgumentParser(description="Export Prometheus metrics for Smart Order fulfillment system load test to CSV.")
    parser.add_argument("--start", help="Start time in ISO format (YYYY-MM-DDTHH:MM:SS) or Unix timestamp. Defaults to 1 hour ago.")
    parser.add_argument("--end", help="End time in ISO format (YYYY-MM-DDTHH:MM:SS) or Unix timestamp. Defaults to now.")
    parser.add_argument("--duration", help="Duration to export (e.g. 15m, 1h, 2.5h) up to now. Overrides --start.")
    parser.add_argument("--step", default="15s", help="Step interval for data resolution (e.g. 5s, 15s, 1m). Default: 15s")
    parser.add_argument("--output", default="load_test_metrics.csv", help="Output CSV file path. Default: load_test_metrics.csv")
    parser.add_argument("--url", default="http://localhost:9090", help="Prometheus base URL. Default: http://localhost:9090")
    
    args = parser.parse_args()
    
    # Calculate timestamps
    now = datetime.utcnow()
    
    if args.end:
        try:
            end_dt = datetime.fromisoformat(args.end)
        except ValueError:
            end_dt = datetime.utcfromtimestamp(float(args.end))
    else:
        end_dt = now
        
    if args.duration:
        unit = args.duration[-1]
        val = float(args.duration[:-1])
        if unit == 's':
            delta = timedelta(seconds=val)
        elif unit == 'm':
            delta = timedelta(minutes=val)
        elif unit == 'h':
            delta = timedelta(hours=val)
        else:
            print("Invalid duration format. Use e.g. 30m or 2h", file=sys.stderr)
            sys.exit(1)
        start_dt = end_dt - delta
    elif args.start:
        try:
            start_dt = datetime.fromisoformat(args.start)
        except ValueError:
            start_dt = datetime.utcfromtimestamp(float(args.start))
    else:
        # Default to 1 hour
        start_dt = end_dt - timedelta(hours=1)
        
    start_ts = int(start_dt.timestamp())
    end_ts = int(end_dt.timestamp())
    
    print(f"📊 Exporting metrics from {start_dt.isoformat()} to {end_dt.isoformat()} (step={args.step})")
    print(f"🔗 Prometheus URL: {args.url}")
    
    all_rows = []
    
    # Run the queries
    for metric_name, query in METRIC_QUERIES.items():
        print(f"🔍 Fetching {metric_name}...")
        results = query_prometheus_range(query, start_ts, end_ts, args.step, args.url)
        
        for series in results:
            metric_info = series.get("metric", {})
            instance = metric_info.get("instance", "unknown")
            job = metric_info.get("job", "unknown")
            application = metric_info.get("application", "unknown")
            
            # Additional labels depending on the metric
            extra_label = ""
            if "id" in metric_info:
                extra_label = f" ({metric_info['id']})" # e.g. Heap memory pool name
            
            service_label = f"{instance}"
            if application != "unknown":
                service_label += f" ({application})"
            if extra_label:
                service_label += extra_label
                
            for timestamp, value_str in series.get("values", []):
                val = float(value_str) if value_str != "NaN" else 0.0
                dt_str = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
                
                all_rows.append({
                    "Timestamp": dt_str,
                    "TimestampUnix": timestamp,
                    "Service/Instance": service_label,
                    "Metric": metric_name,
                    "Value": val
                })
                
    if not all_rows:
        print("⚠️ No metric values returned. Is the Docker stack running and collecting metrics?")
        sys.exit(1)
        
    # Write to CSV
    # We sort rows by Timestamp, then Metric, then Service
    all_rows.sort(key=lambda r: (r["TimestampUnix"], r["Metric"], r["Service/Instance"]))
    
    try:
        with open(args.output, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["Timestamp", "TimestampUnix", "Service/Instance", "Metric", "Value"])
            writer.writeheader()
            writer.writerows(all_rows)
        print(f"💾 Metrics successfully exported to: {args.output}")
        print(f"💡 Total data points: {len(all_rows)}")
    except Exception as e:
        print(f"Failed to write CSV file: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
