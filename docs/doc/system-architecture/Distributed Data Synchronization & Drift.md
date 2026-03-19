**Tags:** #architecture #system-design #data-integrity #idempotency

## 1. The Data Drift Problem

In a "Database-per-Service" polyglot architecture, local state and global state can easily fall out of sync (Data Drift).

- **The Scenario:** Physical inventory is received and logged in the Go `Warehouse Service` (local truth). However, the Java `Inventory Service` (global catalog truth) remains unaware, resulting in a Catalog UI that displays `0` available stock despite physical items sitting on warehouse shelves.


## 2. The Idempotent Sync Solution

Implemented a cross-service synchronization mechanism that relies on **absolute state** rather than delta updates, ensuring maximum data integrity.

```mermaid
graph TD
    A[Warehouse Admin Receives Stock] -->|POST /stock| B(Go Warehouse Service)
    B --> C[(Go PostgreSQL: warehouse_stock)]
    B --> D{Calculate Absolute Truth}
    D -->|COALESCE SUM| E[Total = 345]
    E -->|HTTP PUT JSON| F(Java Inventory Service)
    F --> G[(Java PostgreSQL: global_inventory)]
    G -->|Overwrite Total| H[Catalog UI Shows 345]
```


