#!/bin/bash

# ==============================================================================
# RIGOROUS 2.5 HOUR LOAD TEST (ACTIVE)
# ==============================================================================
echo "================================================"
echo "🚀 STARTING FULL SSP PERFORMANCE BENCHMARK SUITE"
echo "================================================"
echo "⚠️  WARNING: This suite uses a rigorous 35-minute staged load ramp per service."
echo "   Total estimated time: ~2 hours 35 minutes."
echo "================================================"

USER_ID=${USER_ID:-"96101f4b-b0ce-4178-9a38-b2720b1a097c"}
RESULTS_DIR=${K6_OUT_DIR:-"load-tests/results/$(date +%Y%m%d_%H%M%S)"}
mkdir -p "${RESULTS_DIR}"

RANDOM_SEED=${RANDOM_SEED:-$(date +%s)}
echo "🎲 Random seed: ${RANDOM_SEED} (set RANDOM_SEED env to reproduce)"
RANDOM=$RANDOM_SEED

# Determine execution order: 0=Java-first, 1=Go-first
ORDER_FLIP=$((RANDOM % 2))

if [ $ORDER_FLIP -eq 0 ]; then
    FIRST_ORDER_URL="http://localhost:8083/orders"
    FIRST_ORDER_NAME="Java Spring Boot"
    FIRST_ORDER_FILE="order_java_summary.json"
    SECOND_ORDER_URL="http://localhost:9083/orders"
    SECOND_ORDER_NAME="Go Twin"
    SECOND_ORDER_FILE="order_go_summary.json"
    
    FIRST_INV_URL="http://localhost:8082/products"
    FIRST_INV_NAME="Java Spring Boot"
    FIRST_INV_FILE="inventory_java_summary.json"
    SECOND_INV_URL="http://localhost:9082/products"
    SECOND_INV_NAME="Go Twin"
    SECOND_INV_FILE="inventory_go_summary.json"
else
    FIRST_ORDER_URL="http://localhost:9083/orders"
    FIRST_ORDER_NAME="Go Twin"
    FIRST_ORDER_FILE="order_go_summary.json"
    SECOND_ORDER_URL="http://localhost:8083/orders"
    SECOND_ORDER_NAME="Java Spring Boot"
    SECOND_ORDER_FILE="order_java_summary.json"
    
    FIRST_INV_URL="http://localhost:9082/products"
    FIRST_INV_NAME="Go Twin"
    FIRST_INV_FILE="inventory_go_summary.json"
    SECOND_INV_URL="http://localhost:8082/products"
    SECOND_INV_NAME="Java Spring Boot"
    SECOND_INV_FILE="inventory_java_summary.json"
fi

echo "👤 Using User ID       : ${USER_ID}"
echo "📁 Results directory   : ${RESULTS_DIR}"
echo "📋 Execution order     : ${FIRST_ORDER_NAME} → ${SECOND_ORDER_NAME}"
echo "================================================"

# Capture the start time for metric extraction
BENCHMARK_START_TS=$(date +%s)

# ---------------------------------------------------------------------------
# Helper: pre-warm a service so the Gin Prometheus histogram registers itself
# before k6 starts (gin_request_duration_seconds is lazily created on first
# HTTP request — without this, Prometheus sees nothing in the first scrape).
# ---------------------------------------------------------------------------
prewarm_metrics() {
    local url="$1"
    local name="$2"
    echo "   🌡️  Pre-warming metrics for ${name} (initialising Gin histogram)..."
    # Fire 3 requests; ignore auth errors — we only need the metric to register
    for i in 1 2 3; do
        curl -s -o /dev/null -w "" "${url}" || true
    done
    # Give Prometheus one full scrape cycle (5 s) to capture the new series
    sleep 6
    echo "   ✅  Metrics pre-warmed for ${name}"
}

echo ""
echo "🔥 PHASE 1: WRITE-HEAVY WORKLOAD (ORDER CREATION)"
echo "------------------------------------------------"

if [ -f "load-tests/reset-stock.sh" ]; then
    echo "🔄 Resetting database state..."
    bash load-tests/reset-stock.sh
fi

echo "🧪 TEST 1A: ${FIRST_ORDER_NAME} Order Service"
prewarm_metrics "${FIRST_ORDER_URL}" "${FIRST_ORDER_NAME}"
echo "🕒 Start Time: $(date)"
TEST1A_START=$(date +%s)
k6 run --summary-export="${RESULTS_DIR}/${FIRST_ORDER_FILE}" -e TARGET_URL="${FIRST_ORDER_URL}" -e USER_ID="${USER_ID}" load-tests/order_benchmark.js
TEST1A_END=$(date +%s)
echo "🕒 End Time: $(date)"

echo ""
echo "⏳ Pausing for 5 minutes to let the system cool down (drain DB pools, GC)..."
sleep 300

echo ""
echo "------------------------------------------------"
if [ -f "load-tests/reset-stock.sh" ]; then
    echo "🔄 Resetting database state..."
    bash load-tests/reset-stock.sh
fi

echo "🧪 TEST 1B: ${SECOND_ORDER_NAME} Order Twin"
prewarm_metrics "${SECOND_ORDER_URL}" "${SECOND_ORDER_NAME}"
echo "🕒 Start Time: $(date)"
TEST1B_START=$(date +%s)
k6 run --summary-export="${RESULTS_DIR}/${SECOND_ORDER_FILE}" -e TARGET_URL="${SECOND_ORDER_URL}" -e USER_ID="${USER_ID}" load-tests/order_benchmark.js
TEST1B_END=$(date +%s)
echo "🕒 End Time: $(date)"

echo ""
echo "⏳ Pausing for 5 minutes to let the system cool down (drain DB pools, GC)..."
sleep 300

echo ""
echo "================================================"
echo "🧊 PHASE 2: READ-HEAVY WORKLOAD (INVENTORY CACHE)"
echo "------------------------------------------------"
echo "🧪 TEST 2A: ${FIRST_INV_NAME} Inventory Service"
prewarm_metrics "${FIRST_INV_URL}" "${FIRST_INV_NAME}"
echo "🕒 Start Time: $(date)"
TEST2A_START=$(date +%s)
k6 run --summary-export="${RESULTS_DIR}/${FIRST_INV_FILE}" -e TARGET_URL="${FIRST_INV_URL}" load-tests/inventory_benchmark.js
TEST2A_END=$(date +%s)
echo "🕒 End Time: $(date)"

echo ""
echo "⏳ Pausing for 5 minutes to let the system cool down (drain DB pools, GC)..."
sleep 300

echo ""
echo "------------------------------------------------"
echo "🧪 TEST 2B: ${SECOND_INV_NAME} Inventory Twin"
prewarm_metrics "${SECOND_INV_URL}" "${SECOND_INV_NAME}"
echo "🕒 Start Time: $(date)"
TEST2B_START=$(date +%s)
k6 run --summary-export="${RESULTS_DIR}/${SECOND_INV_FILE}" -e TARGET_URL="${SECOND_INV_URL}" load-tests/inventory_benchmark.js
TEST2B_END=$(date +%s)

# ---------------------------------------------------------------------------
# Derive service-type labels based on execution order
# ---------------------------------------------------------------------------
if [ $ORDER_FLIP -eq 0 ]; then
    # Java first
    LABEL_1A="java_order"  ; SVC_1A="java" ; BENCH_1A="order"
    LABEL_1B="go_order"    ; SVC_1B="go"   ; BENCH_1B="order"
    LABEL_2A="java_inventory" ; SVC_2A="java" ; BENCH_2A="inventory"
    LABEL_2B="go_inventory"   ; SVC_2B="go"   ; BENCH_2B="inventory"
else
    # Go first
    LABEL_1A="go_order"    ; SVC_1A="go"   ; BENCH_1A="order"
    LABEL_1B="java_order"  ; SVC_1B="java" ; BENCH_1B="order"
    LABEL_2A="go_inventory"   ; SVC_2A="go"   ; BENCH_2A="inventory"
    LABEL_2B="java_inventory" ; SVC_2B="java" ; BENCH_2B="inventory"
fi

# Build the comma-separated segment descriptors:
#   label:service_type:benchmark_type:start_unix:end_unix
SEGMENTS="${LABEL_1A}:${SVC_1A}:${BENCH_1A}:${TEST1A_START}:${TEST1A_END},${LABEL_1B}:${SVC_1B}:${BENCH_1B}:${TEST1B_START}:${TEST1B_END},${LABEL_2A}:${SVC_2A}:${BENCH_2A}:${TEST2A_START}:${TEST2A_END},${LABEL_2B}:${SVC_2B}:${BENCH_2B}:${TEST2B_START}:${TEST2B_END}"

# Capture the end time and export Prometheus metrics
BENCHMARK_END_TS=$(date +%s)
echo ""
echo "💾 Exporting Prometheus metrics for this run..."
if command -v python3 &>/dev/null; then
    # --- New comprehensive exporter (per-metric files + phase annotations) ---
    python3 load-tests/export_metrics_v2.py \
        --out-dir   "${RESULTS_DIR}" \
        --url       "http://localhost:9090" \
        --step      "15s" \
        --segments  "${SEGMENTS}"

    # --- Legacy single-file exporter (kept for backwards compatibility) ---
    python3 load-tests/export_metrics.py \
        --start "${BENCHMARK_START_TS}" \
        --end   "${BENCHMARK_END_TS}" \
        --output "${RESULTS_DIR}/prometheus_metrics_legacy.csv"
else
    echo "python3 not found. Skipping Prometheus metrics export."
fi

echo ""
echo "================================================"
echo "✅ ALL BENCHMARKS COMPLETE! Check Grafana for the results."
echo "================================================"
