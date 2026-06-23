#!/bin/bash
# Reset product stock levels to initial state for fair benchmarking
echo "🔄 Resetting product stock levels..."

# Default DB_URL for local testing or CI if not set
DB_URL=${DATABASE_URL:-"postgresql://warehouse_admin:warehouse_admin(123)@postgres:5432/warehouse_db"}

# But actually, Neon postgres might be used. We will rely on DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️ DATABASE_URL not set, skipping DB reset."
    exit 0
fi

psql "${DATABASE_URL}" <<EOF
-- Reset all product stock to initial benchmark levels
UPDATE warehouse_stock SET quantity = 10000 WHERE product_id IN (
    'e537f905-b41a-4ac1-bbb0-f0ad4f7d9c79',
    'a733e7b3-76f2-47af-81b0-33d2c35ffb10',
    'e2abc8a3-29d9-4f58-9c5a-ca1ffc38a6a0',
    '7bd55cb2-0574-46de-8ce1-a950f471d9a6',
    'c529aca1-c634-4627-abfa-44a2de730499',
    '27131e33-b13f-4d64-b2e1-e6e94d7ba339',
    'c193ad20-b449-4698-8ac0-3ee7365e805c',
    '7c4cba32-ca97-4c8d-b74f-c2f433d2180a',
    '3588af42-6f2c-4807-9167-8fa78861cac2',
    'd2a2f90f-0af3-4e56-98bb-e7279bfc8a72'
);

-- Clean up orders from previous run to avoid table bloat
DELETE FROM order_items WHERE order_id IN (
    SELECT id FROM orders WHERE created_at > NOW() - INTERVAL '4 hours'
);
DELETE FROM orders WHERE created_at > NOW() - INTERVAL '4 hours';

VACUUM ANALYZE warehouse_stock;
VACUUM ANALYZE orders;
VACUUM ANALYZE order_items;
EOF

echo "✅ Stock reset complete"
