**Tags:** #react #forms #geolocation #axios #ssp-lab 
**Date:** 2026-03-11

## 1. Overview

The checkout process is a distributed transaction. It originates in the React frontend, where user data and geographical coordinates are captured, and is orchestrated by the Spring Boot `order-service`. The Order Service acts as the central coordinator, communicating synchronously with the `inventory-service` (for pricing/validation) and the `warehouse-service` (for stock allocation and smart routing).

## 2. Frontend: The Checkout Screen (`CheckoutScreen.tsx`)

### Core Responsibilities

- **State Aggregation:** Reads the user's selected items and quantities from the global `CartContext`.
    
- **Geolocation:** Utilizes the HTML5 `navigator.geolocation` API to capture the user's exact `latitude` and `longitude` to feed the backend routing engine.
    
- **Payload Construction:** Transforms the client-side cart state into the strict `OrderRequest` DTO expected by the backend.
    

### The Request Payload

The React app sends a `POST` request to `/orders` with the following structure:

```json
{
  "shippingAddress": "123 Main St",
  "shippingLatitude": 12.9716,
  "shippingLongitude": 77.5946,
  "items": [
    { "productId": "uuid-string", "quantity": 1 }
  ]
}
```

---

## 3. Backend: Order Orchestration (`OrderService.java`)

The `placeOrder` method uses the `@Transactional` annotation to ensure that if any step fails (e.g., a network failure or insufficient stock), the database rolls back, preventing incomplete orders.

### Step-by-Step Execution:

1. **Initialization:** A new `Order` entity is created in memory with a status of `PENDING_INVENTORY`.
    
2. **Price Verification (Security):** * The Order Service **does not** trust the frontend pricing.
    
    - It loops through the requested items and makes a Feign Client call to the `inventory-service` (`getProductById`).
        
    - It secures the actual `priceAtPurchase` directly from the source of truth and calculates the `totalAmount`.
        
3. **Smart Stock Allocation (The Routing Engine):**
    
    - The service passes the items and the user's coordinates to the allocation module.
        
    - It contacts the `warehouse-service` to find all locations carrying the required product.
        
4. **Finalization:** If all stock is successfully allocated, the order status is updated to `CONFIRMED` and saved to the PostgreSQL database.
    

---

## 4. The Smart Routing Engine (Haversine Formula)

The most complex mathematical operation in this flow occurs during warehouse selection.

### The Selection Algorithm (`attemptToAllocateItem`)

For every item in the cart, the system executes the following logic:

1. **Fetch Nodes:** Retrieve a list of all `StockDTO` records (warehouses) holding the specific `productId`.
    
2. **Filter:** Immediately discard any warehouse where `quantity < requestedQuantity`.
    
3. **Sort & Select (Geospatial Routing):**
    
    - Stream the remaining eligible warehouses.
        
    - Apply the `LocationUtils.calculateDistance` (Haversine formula) comparing the warehouse coordinates against the `shippingLatitude` and `shippingLongitude` provided by the React frontend.
        
    - Select the warehouse with the absolute minimum distance.
        
4. **Deduct:** Issue a `PUT` request via Feign to the winning warehouse to deduct the stock.
    

> **Crucial Failure Point:** If the `warehouse-service` is offline (causing a `FeignException`), or if the filtered stream returns null (no warehouse has enough stock), the method throws a `RuntimeException`. Because the parent method is `@Transactional`, this exception instantly aborts the entire checkout process and returns a `500 Internal Server Error` to the frontend.