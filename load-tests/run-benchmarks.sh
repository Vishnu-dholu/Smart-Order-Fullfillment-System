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

echo ""
echo "🔥 PHASE 1: WRITE-HEAVY WORKLOAD (ORDER CREATION)"
echo "------------------------------------------------"

if [ -f "load-tests/reset-stock.sh" ]; then
    echo "🔄 Resetting database state..."
    bash load-tests/reset-stock.sh
fi

echo "🧪 TEST 1A: ${FIRST_ORDER_NAME} Order Service"
echo "🕒 Start Time: $(date)"
k6 run --summary-export="${RESULTS_DIR}/${FIRST_ORDER_FILE}" -e TARGET_URL="${FIRST_ORDER_URL}" -e USER_ID="${USER_ID}" load-tests/order_benchmark.js
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
echo "🕒 Start Time: $(date)"
k6 run --summary-export="${RESULTS_DIR}/${SECOND_ORDER_FILE}" -e TARGET_URL="${SECOND_ORDER_URL}" -e USER_ID="${USER_ID}" load-tests/order_benchmark.js
echo "🕒 End Time: $(date)"

echo ""
echo "⏳ Pausing for 5 minutes to let the system cool down (drain DB pools, GC)..."
sleep 300

echo ""
echo "================================================"
echo "🧊 PHASE 2: READ-HEAVY WORKLOAD (INVENTORY CACHE)"
echo "------------------------------------------------"
echo "🧪 TEST 2A: ${FIRST_INV_NAME} Inventory Service"
echo "🕒 Start Time: $(date)"
k6 run --summary-export="${RESULTS_DIR}/${FIRST_INV_FILE}" -e TARGET_URL="${FIRST_INV_URL}" load-tests/inventory_benchmark.js
echo "🕒 End Time: $(date)"

echo ""
echo "⏳ Pausing for 5 minutes to let the system cool down (drain DB pools, GC)..."
sleep 300

echo ""
echo "------------------------------------------------"
echo "🧪 TEST 2B: ${SECOND_INV_NAME} Inventory Twin"
echo "🕒 Start Time: $(date)"
k6 run --summary-export="${RESULTS_DIR}/${SECOND_INV_FILE}" -e TARGET_URL="${SECOND_INV_URL}" load-tests/inventory_benchmark.js
echo "🕒 End Time: $(date)"

# Capture the end time and export Prometheus metrics
BENCHMARK_END_TS=$(date +%s)
echo ""
echo "💾 Exporting Prometheus metrics for this run..."
if command -v python3 &>/dev/null; then
    python3 load-tests/export_metrics.py --start "${BENCHMARK_START_TS}" --end "${BENCHMARK_END_TS}" --output "${RESULTS_DIR}/prometheus_metrics.csv"
else
    echo "python3 not found. Skipping Prometheus metrics export."
fi

echo ""
echo "================================================"
echo "✅ ALL BENCHMARKS COMPLETE! Check Grafana for the results."
echo "================================================"
