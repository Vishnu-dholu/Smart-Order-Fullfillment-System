import sys
import json
import os
import glob
import statistics

def load_metrics(directory):
    runs = glob.glob(os.path.join(directory, 'run_*'))
    results = {
        'order_java': [],
        'order_go': [],
        'inventory_java': [],
        'inventory_go': []
    }
    
    for run in runs:
        for key in results.keys():
            filepath = os.path.join(run, f"{key}_summary.json")
            if os.path.exists(filepath):
                try:
                    with open(filepath, 'r') as f:
                        data = json.load(f)
                        metrics = data.get('metrics', {})
                        
                        # Extract metrics for measurement phase if tagged, else global
                        # Assuming we just use global req_duration for simplicity here
                        dur = metrics.get('http_req_duration', {})
                        reqs = metrics.get('http_reqs', {})
                        
                        results[key].append({
                            'avg_latency': dur.get('avg', 0),
                            'p99_latency': dur.get('p(99)', 0),
                            'throughput': reqs.get('rate', 0)
                        })
                except Exception as e:
                    print(f"Error reading {filepath}: {e}")
    return results

def print_stats(name, data_list):
    if not data_list:
        print(f"{name}: No data found")
        return
        
    avg_latencies = [d['avg_latency'] for d in data_list]
    p99_latencies = [d['p99_latency'] for d in data_list]
    throughputs = [d['throughput'] for d in data_list]
    
    def calc_stats(values):
        mean = statistics.mean(values)
        std = statistics.stdev(values) if len(values) > 1 else 0
        return mean, std
        
    avg_l_mean, avg_l_std = calc_stats(avg_latencies)
    p99_l_mean, p99_l_std = calc_stats(p99_latencies)
    t_mean, t_std = calc_stats(throughputs)
    
    print(f"--- {name} ---")
    print(f"Throughput: {t_mean:.2f} req/s (std: {t_std:.2f})")
    print(f"Avg Latency: {avg_l_mean:.2f} ms (std: {avg_l_std:.2f})")
    print(f"P99 Latency: {p99_l_mean:.2f} ms (std: {p99_l_std:.2f})")

def main():
    if len(sys.argv) < 2:
        print("Usage: python analyze_results.py <results_dir>")
        sys.exit(1)
        
    directory = sys.argv[1]
    print(f"Analyzing results in {directory}")
    
    results = load_metrics(directory)
    for key, data_list in results.items():
        print_stats(key, data_list)

if __name__ == "__main__":
    main()
