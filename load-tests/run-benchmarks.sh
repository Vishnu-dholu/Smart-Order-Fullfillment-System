# 2.5 hours load test

# #!/bin/bash

# echo "================================================"
# echo "🚀 STARTING FULL SSP PERFORMANCE BENCHMARK SUITE"
# echo "================================================"
# echo "⚠️  WARNING: This suite uses a rigorous 35-minute staged load ramp per service."
# echo "   Total estimated time: ~2 hours 35 minutes."
# echo "================================================"

# USER_ID=${USER_ID:-"96101f4b-b0ce-4178-9a38-b2720b1a097c"}

# echo "👤 Using User ID       : ${USER_ID}"
# echo "================================================"

# echo ""
# echo "🔥 PHASE 1: WRITE-HEAVY WORKLOAD (ORDER CREATION)"
# echo "------------------------------------------------"
# echo "🧪 TEST 1A: Java Spring Boot Order Service (Port 8083)"
# echo "🕒 Start Time: $(date)"
# k6 run -e TARGET_URL=http://localhost:8083/orders -e USER_ID="${USER_ID}" load-tests/order_benchmark.js
# echo "🕒 End Time: $(date)"

# echo ""
# echo "⏳ Pausing for 5 minutes to let the system cool down (drain DB pools, GC)..."
# sleep 300

# echo ""
# echo "------------------------------------------------"
# echo "🧪 TEST 1B: Go Order Twin (Port 9083)"
# echo "🕒 Start Time: $(date)"
# k6 run -e TARGET_URL=http://localhost:9083/orders -e USER_ID="${USER_ID}" load-tests/order_benchmark.js
# echo "🕒 End Time: $(date)"

# echo ""
# echo "⏳ Pausing for 5 minutes to let the system cool down (drain DB pools, GC)..."
# sleep 300

# echo ""
# echo "================================================"
# echo "🧊 PHASE 2: READ-HEAVY WORKLOAD (INVENTORY CACHE)"
# echo "------------------------------------------------"
# echo "🧪 TEST 2A: Java Spring Boot Inventory Service (Port 8082)"
# echo "🕒 Start Time: $(date)"
# k6 run -e TARGET_URL=http://localhost:8082/products load-tests/inventory_benchmark.js
# echo "🕒 End Time: $(date)"

# echo ""
# echo "⏳ Pausing for 5 minutes to let the system cool down (drain DB pools, GC)..."
# sleep 300

# echo ""
# echo "------------------------------------------------"
# echo "🧪 TEST 2B: Go Inventory Twin (Port 9082)"
# echo "🕒 Start Time: $(date)"
# k6 run -e TARGET_URL=http://localhost:9082/products load-tests/inventory_benchmark.js
# echo "🕒 End Time: $(date)"

# echo ""
# echo "================================================"
# echo "✅ ALL BENCHMARKS COMPLETE! Check Grafana for the results."
# echo "================================================"












#!/bin/bash

echo "================================================"
echo "🚀 STARTING FAST-TRACK SSP BENCHMARK SUITE"
echo "================================================"
echo "⏱️  Profile: 5-min tests with 2-min cooldowns."
echo "   Total estimated time: ~26 minutes."
echo "================================================"

USER_ID=${USER_ID:-"96101f4b-b0ce-4178-9a38-b2720b1a097c"}

echo "👤 Using User ID       : ${USER_ID}"
echo "================================================"

echo ""
echo "🔥 PHASE 1: WRITE-HEAVY WORKLOAD (ORDER CREATION)"
echo "------------------------------------------------"
echo "🧪 TEST 1A: Java Spring Boot Order Service (Port 8083)"
echo "🕒 Start Time: $(date)"
k6 run -e TARGET_URL=http://localhost:8083/orders -e USER_ID="${USER_ID}" load-tests/order_benchmark.js
echo "🕒 End Time: $(date)"

echo ""
echo "⏳ Pausing for 2 minutes to drain connections..."
sleep 120

echo ""
echo "------------------------------------------------"
echo "🧪 TEST 1B: Go Order Twin (Port 9083)"
echo "🕒 Start Time: $(date)"
k6 run -e TARGET_URL=http://localhost:9083/orders -e USER_ID="${USER_ID}" load-tests/order_benchmark.js
echo "🕒 End Time: $(date)"

echo ""
echo "⏳ Pausing for 2 minutes to drain connections..."
sleep 120

echo ""
echo "================================================"
echo "🧊 PHASE 2: READ-HEAVY WORKLOAD (INVENTORY CACHE)"
echo "------------------------------------------------"
echo "🧪 TEST 2A: Java Spring Boot Inventory Service (Port 8082)"
echo "🕒 Start Time: $(date)"
k6 run -e TARGET_URL=http://localhost:8082/products load-tests/inventory_benchmark.js
echo "🕒 End Time: $(date)"

echo ""
echo "⏳ Pausing for 2 minutes to drain connections..."
sleep 120

echo ""
echo "------------------------------------------------"
echo "🧪 TEST 2B: Go Inventory Twin (Port 9082)"
echo "🕒 Start Time: $(date)"
k6 run -e TARGET_URL=http://localhost:9082/products load-tests/inventory_benchmark.js
echo "🕒 End Time: $(date)"

echo ""
echo "================================================"
echo "✅ FAST-TRACK BENCHMARKS COMPLETE!"
echo "================================================"
