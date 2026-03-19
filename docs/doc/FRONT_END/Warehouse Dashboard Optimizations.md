
**Tags:** #react #performance #caching #supply-chain

## 1. Dual-Cache Fetching Strategy

Replaced a brute-force `useEffect` dependency with a smart, dual-flag caching system to minimize unnecessary network I/O across microservices.

- **Flags:** `hasFetchedInventory` (Tracks Go/Java catalog requests) and `hasFetchedOrders` (Tracks Java order requests).
    
- **Smart Invalidation:** When an order is shipped via `handleShipOrder()`, _both_ caches are explicitly invalidated (`false`), because shipping alters both the order queue AND the physical stock levels. Receiving stock only invalidates the inventory cache.
    

## 2. Dynamic Reorder Point (ROP) Implementation

Shifted from a hardcoded "Low Stock" alert (e.g., `< 50`) to a dynamic threshold mapped per-SKU.

- **Database:** Added `low_stock_threshold` to the PostgreSQL `products` table.
    
- **UI Calculation:** The React frontend maps over the Go `inventory` array, finds the corresponding product in the Java `products` array, and compares the physical quantity against that specific item's threshold, accurately flagging high-velocity vs. low-velocity items.
    

## 3. 3-Tab Operational Layout

Segmented the dashboard into distinct operational zones:

1. **Live Inventory:** View physical stock and receive incoming shipments.
    
2. **Fulfillment Queue:** Strictly filtered for `CONFIRMED` and `PENDING_INVENTORY` orders. The actionable "To-Do" list for floor workers.
    
3. **Completed Orders:** Filtered exclusively for `SHIPPED` orders, serving as an audit trail for management.

