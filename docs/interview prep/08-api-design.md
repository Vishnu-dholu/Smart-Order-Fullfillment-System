# 08 — API Design

---

## Full API Catalog

### Order Service / Order Twin

**Base URL Java:** `http://localhost:8083`
**Base URL Go:** `http://localhost:9083`

---

#### `POST /orders` — Place Order

**Request:**

```http
POST /orders
Content-Type: application/json
X-User-Id: 96101f4b-b0ce-4178-9a38-b2720b1a097c

{
    "shippingAddress": "123 Benchmark Ave, Load Test City",
    "shippingLatitude": 12.9716,
    "shippingLongitude": 77.5946,
    "items": [
        {
            "productId": "e537f905-b41a-4ac1-bbb0-f0ad4f7d9c79",
            "quantity": 1
        }
    ]
}
```

**Response (201 Created):**

```json
{
    "orderId": "3a9f2c1b-...",
    "userId": "96101f4b-...",
    "status": "CONFIRMED",
    "totalAmount": 999.99,
    "shippingAddress": "123 Benchmark Ave, Load Test City",
    "items": [...],
    "createdAt": "2026-06-23T08:09:45"
}
```

**Error Responses:**

| Status | Condition |
| -------- | ----------- |
| 400 | Missing/invalid X-User-Id header, invalid JSON body |
| 409 (Go) / 500 (Java) | Insufficient stock |
| 400 | Product not found in inventory |
| 500 | DB save failure |

**Java Handler:** `OrderController.java:23-32`
**Go Handler:** `order_handler.go:45-129`
**Business Logic:** Inventory check → Haversine routing → Stock deduction → DB save → Async notification

---

#### `GET /orders` — Get User Order History

**Request:**

```http
GET /orders
X-User-Id: 96101f4b-b0ce-4178-9a38-b2720b1a097c
```

**Response (200 OK):**

```json
[
    {
        "orderId": "...",
        "userId": "...",
        "status": "CONFIRMED",
        "totalAmount": 999.99,
        "shippingAddress": "...",
        "createdAt": "..."
    }
]
```

**Java:** `orderRepository.findByUserIdOrderByCreatedAtDesc(userId)` → Spring Data derived query
**Go:** `database.DB.Where("user_id = ?", userID).Order("created_at desc").Preload("Items").Find(&orders)`

---

#### `GET /orders/all` — Get All Orders (Warehouse Manager)

**Response:** Same as above but all users' orders.

**Java:** `orderRepository.findAll()`
**Go:** `database.DB.Order("created_at desc").Preload("Items").Find(&orders)`

---

#### `PUT /orders/{orderId}/status` — Update Order Status

**Request:**

```http
PUT /orders/3a9f2c1b-.../status
Content-Type: application/json

{
    "status": "SHIPPED"
}
```

**Response:** 200 OK (empty body)

**Side Effects on SHIPPED:**

- Calls `deliveryClient.createDelivery()` to generate shipment + tracking number
- Fires async notification `ORDER_SHIPPED`

---

### Inventory Service / Inventory Twin

**Base URL Java:** `http://localhost:8082`
**Base URL Go:** `http://localhost:9082`

---

#### `GET /products` — Get All Products with Stock

**Response (200 OK):**

```json
[
    {
        "id": "e537f905-...",
        "sku": "IPHONE-15-BLK",
        "name": "iPhone 15 Black",
        "description": "...",
        "price": 999.99,
        "imageUrl": "...",
        "lowStockThreshold": 10,
        "totalStock": 150,
        "reservedStock": 0
    }
]
```

**Java:** Joins `products` with `global_inventory` in application code (N queries)
**Go:** Same pattern, no JOIN — separate DB queries per product

---

#### `GET /products/{id}` — Get Product by ID (BENCHMARKED)

**This is the primary inventory benchmark endpoint.**

**Request:**

```http
GET /products/e537f905-b41a-4ac1-bbb0-f0ad4f7d9c79
```

**Response (200 OK):**

```json
{
    "product_id": "e537f905-...",
    "sku": "IPHONE-15-BLK",
    "name": "iPhone 15 Black",
    "price": 999.99,
    "low_stock_threshold": 10
}
```

**Java Path:** `@Cacheable(value="products", key="#id")` → Spring Cache → DB (on miss)
**Go Path:** `inventoryCache.RLock()` → map lookup → DB (on miss) → `inventoryCache.Lock()` → cache update

---

#### `POST /products` — Create Product

**Request:**

```json
{
    "sku": "PRODUCT-001",
    "name": "Test Product",
    "price": 99.99,
    "low_stock_threshold": 10
}
```

**Java:** `@Transactional` — saves product + initializes `global_inventory{totalStock:0}`
**Go:** `database.DB.Transaction()` — same atomicity

---

#### `PUT /products/{productId}/sync-stock` — Sync Global Stock from Warehouse

**Called by:** warehouse-go / warehouse-java-twin after every stock update

**Request:**

```json
{
    "quantity": 95
}
```

**Response:** 200 OK

**Purpose:** Keeps `global_inventory.total_stock` in sync with actual warehouse quantities.

---

### Warehouse Service

**Port:** 8084 (Go) / 9084 (Java twin)

---

#### `GET /stock/{productId}` — Get Stock by Product (All Warehouses)

**Called by:** order-service and order-twin during order placement

**Response:**

```json
[
    {
        "warehouse_id": "abc123...",
        "warehouse_name": "East Coast FC",
        "location": "New York, USA",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "quantity": 150
    },
    {
        "warehouse_id": "def456...",
        "warehouse_name": "West Coast FC",
        "location": "Los Angeles, USA",
        "latitude": 34.0522,
        "longitude": -118.2437,
        "quantity": 75
    }
]
```

**SQL Used:**

```sql
SELECT w.warehouse_id, w.name, w.location, w.latitude, w.longitude, ws.quantity
FROM warehouses w
JOIN warehouse_stock ws ON ws.warehouse_id = w.warehouse_id
WHERE ws.product_id = ? AND ws.quantity > 0;
```

---

#### `POST /warehouses/{warehouseId}/stock` — Update Stock

**Called by:** order-service after selecting the nearest warehouse

**Request:**

```json
{
    "product_id": "e537f905-...",
    "quantity": -1
}
```

*(Negative quantity = deduction)*

**Response:**

```json
{
    "message": "Stock updated successfully",
    "current_quantity": 149,
    "global_quantity": 224
}
```

**Atomicity:** GORM transaction ensures stock can't go negative.

---

### Delivery Service

**Port:** 8085

#### `POST /deliveries` — Create Delivery

Called when order transitions to SHIPPED.

**Request:**

```json
{
    "order_id": "...",
    "origin_warehouse": "..."
}
```

---

### Notification Service

**Port:** 8086

#### `POST /notifications` — Send Notification

**Called by:** order services (asynchronously)

**Request:**

```json
{
    "user_id": "...",
    "order_id": "...",
    "type": "ORDER_CONFIRMED",
    "recipient_email": "bitbuster08@gmail.com",
    "total_amount": "999.99",
    "shipping_address": "..."
}
```

---

## REST Principles Analysis

| Principle | Applied? | Where |
| ----------- | --------- | ------- |
| Uniform interface | ✅ | Consistent `/orders`, `/products`, `/warehouses` structure |
| Stateless | ✅ | X-User-Id header carries identity (no server-side session) |
| Resource-based URLs | ✅ | Nouns: `/orders`, `/products/{id}`, not `/getOrder` |
| HTTP verbs | ✅ | GET, POST, PUT used correctly |
| HTTP status codes | ✅ | 201 for creation, 200 for read/update, 404 for not found |
| Layered system | ✅ | Services communicate via HTTP, not direct DB calls |
| HATEOAS | ❌ | No hypermedia links in responses (common in microservices) |
| Content negotiation | ⚠️ | JSON only, no XML fallback |

---

## Validation Analysis

### Java — No Bean Validation Used

Despite `spring-boot-starter-validation` in pom.xml, the `OrderRequest` has **no `@Valid` or `@NotNull` annotations**:

```java
// OrderRequest.java — Missing validation
@Data
public class OrderRequest {
    private String shippingAddress;           // Could be null
    private Double shippingLatitude;          // Could be null
    private Double shippingLongitude;         // Could be null
    private List<OrderItemRequest> items;     // Could be null or empty
}
```

The null safety is handled in `OrderService.java:184-185`:

```java
double userLat = request.getShippingLatitude() != null ? request.getShippingLatitude() : 0.0;
double userLng = request.getShippingLongitude() != null ? request.getShippingLongitude() : 0.0;
```

**Interview Point:** This is a weakness. Adding `@Valid` on the controller and `@NotNull`, `@NotEmpty` on request fields would provide better validation at the API boundary.

### Go — `ShouldBindJSON`

```go
if err := c.ShouldBindJSON(&req); err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: " + err.Error()})
    return
}
```

`ShouldBindJSON` validates JSON structure but not business rules (e.g., non-empty items list). Go Gin supports `binding:"required"` tags for field-level validation.

---

## API Error Handling Comparison

| Scenario | Java Response | Go Response |
| ---------- | -------------- | ------------- |
| Invalid User-Id header | N/A (no explicit check) | `401 {"error": "Missing or invalid X-User-Id header"}` |
| Invalid JSON | `400 Bad Request` | `400 {"error": "Invalid request payload: ..."}` |
| Product not found | `500` (RuntimeException from Feign) | `400 {"error": "Product not found: uuid"}` |
| Insufficient stock | `500` (RuntimeException bubbled) | `409 {"error": "Insufficient stock for Product ID: uuid"}` |
| DB failure | `500` | `500 {"error": "Failed to save order"}` |

**Interview Point:** Go returns more semantically correct HTTP status codes (409 Conflict for stock issues vs Java's 500). This is because Go's explicit error handling forces you to set the appropriate code at each failure point, while Java's uncaught `RuntimeException` defaults to 500.

---

## API Security Analysis

**X-User-Id Header Trust:**

```java
// OrderController.java:26
@RequestHeader("X-User-Id") UUID userId
```

This header is accepted without authentication. In a production system:

1. The API Gateway validates the JWT
2. The Gateway extracts the `user_id` from the JWT claim
3. The Gateway injects `X-User-Id` as a trusted header
4. Backend services trust this header implicitly

In this project, any client can set any `X-User-Id`. This is explicitly noted in the code comment:

```java
// NOTE: In a real Gateway, the Gateway extracts JWT and passes "X-User-Id" header
// For local testing, we will pass this header manually or extract from token.
```

**K6 Benchmark Configuration:**

```javascript
// order_benchmark.js:61
const USER_ID = __ENV.USER_ID || '96101f4b-b0ce-4178-9a38-b2720b1a097c';
// All benchmark requests use the same hardcoded user ID
```

---

## API Design Interview Questions

1. **Why use `X-User-Id` header instead of JWT token parsing in each service?**
   → In a gateway pattern, the gateway is the single point of trust. Services are internal and receive pre-validated identity headers. This avoids JWT validation overhead in every service and centralizes auth logic.

2. **Why return `Order` entity directly from POST /orders instead of a DTO?**
   → Shortcut for simplicity. In production, you'd return a dedicated `OrderResponse` DTO to control which fields are exposed (avoid leaking internal state), enable versioning, and prevent over-fetching.

3. **Why use `UUID` in path variables instead of sequential integers?**
   → UUIDs don't expose business information (order count, user count). Sequential IDs allow attackers to enumerate resources (order ID 1000 → try 999, 998...).

4. **What HTTP status code should insufficient stock return?**

```mermaid
