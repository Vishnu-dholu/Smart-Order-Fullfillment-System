#!/bin/bash

echo "================================================"
echo "🚀 STARTING SSP PERFORMANCE BENCHMARK (RANDOMIZED)"
echo "================================================"

USER_ID=${USER_ID:-"96101f4b-b0ce-4178-9a38-b2720b1a097c"}

echo "📦 Using Multiple Products (Randomized Array)"
echo "👤 Using User ID       : ${USER_ID}"
echo "------------------------------------------------"

echo "🧪 TEST 1: Java Spring Boot Order Service (Port 8083)"
k6 run -e TARGET_URL=http://localhost:8083/orders -e USER_ID="${USER_ID}" load-tests/order_benchmark.js

echo ""
echo "⏳ Pausing for 15 seconds to let the system cool down..."
sleep 15

echo ""
echo "------------------------------------------------"
echo "🧪 TEST 2: Go Order Twin (Port 9083)"
k6 run -e TARGET_URL=http://localhost:9083/orders -e USER_ID="${USER_ID}" load-tests/order_benchmark.js

echo ""
echo "✅ BENCHMARKS COMPLETE!"
