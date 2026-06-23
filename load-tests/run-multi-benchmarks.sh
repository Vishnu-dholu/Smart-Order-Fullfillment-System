#!/bin/bash
# ==============================================================================
# MULTI-RUN BENCHMARK SUITE WITH STATISTICAL ANALYSIS
# ==============================================================================
NUM_RUNS=${NUM_RUNS:-3}
RESULTS_DIR="load-tests/results/multi_$(date +%Y%m%d_%H%M%S)"
mkdir -p "${RESULTS_DIR}"

echo "📊 Running ${NUM_RUNS} benchmark iterations"
echo "📁 Results directory: ${RESULTS_DIR}"

for i in $(seq 1 $NUM_RUNS); do
    echo ""
    echo "=============================================="
    echo "🔄 ITERATION ${i} of ${NUM_RUNS}"
    echo "=============================================="
    
    RUN_DIR="${RESULTS_DIR}/run_${i}"
    mkdir -p "${RUN_DIR}"
    
    # Randomize order per run
    export RANDOM_SEED=$(date +%s%N)
    
    # Run with JSON output collection
    export K6_OUT_DIR="${RUN_DIR}"
    bash load-tests/run-benchmarks.sh 2>&1 | tee "${RUN_DIR}/console.log"
    
    if [ "$i" -lt "$NUM_RUNS" ]; then
        echo "⏳ Inter-run cooldown (5 minutes)..."
        sleep 300
    fi
done

echo ""
echo "📊 Computing statistics..."
if command -v python3 &>/dev/null; then
    python3 load-tests/analyze_results.py "${RESULTS_DIR}"
else
    echo "python3 not found. Skipping analysis."
fi
