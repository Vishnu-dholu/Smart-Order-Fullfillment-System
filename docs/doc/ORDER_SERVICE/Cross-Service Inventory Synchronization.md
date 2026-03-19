**Tags:** #microservices #springboot #golang #data-consistency #ssp-lab

## The Architecture Problem

In a decentralized microservices setup, the **Inventory Service (Java)** holds the public product catalog, while the **Warehouse Service (Go)** tracks physical boxes on shelves. When new stock arrives at a physical warehouse, the central catalog must be updated immediately to prevent overselling or showing items as "Out of Stock" when they are actually available.

## 🛠️ Implementation Details

We implemented a **Synchronous Event-Driven Pattern**. The Go service acts as the "Producer" of the event, and the Java service acts as the "Consumer."

### 1. The Receiver: Java Inventory Service (Spring Boot)

The Inventory Service exposes an internal API endpoint designed specifically to listen for stock updates from the Warehouse Service.

- **Repository Layer:** Added `findByProductId(UUID)` to `GlobalInventoryRepository` to locate the correct product ledger.
    
- **Service Layer:** Created a `@Transactional` method `syncGlobalStock(UUID, int)` that overwrites the `total_stock` value with the new grand total.
    
- **Controller Layer:** Exposed a `PUT /products/{id}/sync-stock?totalStock={sum}` endpoint.
    

### 2. The Trigger: Go Warehouse Service (Gin/GORM)

The Warehouse Service is responsible for calculating the global state and pushing it to Java.

- **Atomic Local Update:** Stock is added to `warehouse_stock` using a strict GORM `database.DB.Transaction`.
    
- **Global Calculation:** Go executes an aggregate SQL query to calculate the new global total across all physical warehouses: `SELECT COALESCE(SUM(quantity), 0) FROM warehouse_stock WHERE product_id = ?`
    
- **Network Call:** Go constructs an `http.NewRequest(http.MethodPut, ...)` to send the calculated sum directly to the Java service.
    

## 🐛 Key Learnings & Bug Fixes

During implementation, we encountered a **Silent Failure** where Go reported a successful sync, but Java did not update the database.

- **The Cause:** Go was accidentally sending an `http.MethodGet` request. Java returned a `405 Method Not Allowed`, but Go only checked if the network connection succeeded (`errClient == nil`), ignoring the actual HTTP status code.
    
- **The Fix:** Changed the request to `http.MethodPut` and implemented strict status code validation: `if resp.StatusCode == http.StatusOK`. This ensures Go only logs a success if Java explicitly accepts the data.
