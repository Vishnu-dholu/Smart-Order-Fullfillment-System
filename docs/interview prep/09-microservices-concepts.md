# 09 — Microservices Concepts

---

## Service Boundary Analysis

Each service in this project owns:

1. **A single responsibility** (bounded context)
2. **Its own database** (data isolation)
3. **Its own deployment unit** (Docker container)
4. **Its own codebase** (independent deployability)

| Service | Bounded Context | Responsibility |
| --------- | ---------------- | ---------------- |
| auth-service | Identity | User registration, login, JWT tokens |
| inventory-service | Catalog | Product info, global stock tracking |
| order-service | Fulfillment | Order lifecycle, business orchestration |
| warehouse-service | Physical Stock | Where stock is, routing, deduction |
| delivery-service | Logistics | Shipment tracking |
| notification-service | Communication | Event logging, email/SMS |

---

## Communication Patterns

### Synchronous (Request-Response)

All inter-service calls in this project are synchronous HTTP:

```text
order-service → inventory-service  (GET product price)
order-service → warehouse-service  (GET stock, POST deduct)
warehouse-service → inventory-service  (PUT sync global stock)
order-service → delivery-service  (POST create shipment)
```

**Java:** OpenFeign — synchronous HTTP within the calling thread
**Go:** `net/http` with shared transport — synchronous HTTP within the calling goroutine

**Drawback:** If the inventory-service is slow, the order-service blocks. This is the **cascading failure** problem. A slow downstream service degrades the caller.

### Asynchronous (Fire-and-Forget)

Only notification is truly async:

```text
order-service → notification-service  (goroutine / new Thread)
```

**Why Only Notifications Are Async:**

- Notification success/failure doesn't affect order placement
- The user doesn't need to wait for the email to be logged
- Even if notification fails, the order is confirmed

**Why Stock Deduction is Synchronous:**

- Stock deduction must succeed before the order is confirmed
- If deduction fails, the order should not be placed
- Fire-and-forget stock deduction would allow orders without confirmed stock

---

## Missing Patterns (Interview Discussion Points)

### 1. Circuit Breaker (NOT Implemented)

**Problem:** If the inventory-service goes down, every order request will wait for the Feign timeout (5s) before failing. Under 200 VUs, this means 200 requests all waiting 5 seconds = 1000 seconds of accumulated wait time.

**Solution:** Circuit Breaker (e.g., Resilience4J for Java, Sony Gobreaker for Go):

```text
CLOSED (normal) → [threshold failures] → OPEN (fail fast)
OPEN → [timeout] → HALF-OPEN (test one request) → CLOSED or OPEN
```

**What It Would Look Like:**

```java
// With Resilience4J:
@CircuitBreaker(name = "inventoryService", fallbackMethod = "getProductFallback")
public ProductDTO getProductFromInventory(UUID productId) {
    return inventoryClient.getProductById(productId);
}

public ProductDTO getProductFallback(UUID productId, Exception e) {
    throw new RuntimeException("Inventory service unavailable");
}
```

**Interview Q:** *Why didn't you implement circuit breaker?*
→ The benchmark focuses on runtime performance comparison under normal load, not fault tolerance testing. Adding circuit breakers would change the failure semantics and make the comparison less clean. The project intentionally limits scope to performance metrics.

### 2. Retry Pattern (NOT Implemented)

No retry logic exists. A transient Feign failure immediately fails the order. Production systems would use exponential backoff with jitter.

### 3. API Gateway (NOT Implemented)

There is no API gateway. Clients directly hit service ports. In production:

- Kong or Spring Cloud Gateway would be the single entry point
- JWT validation would happen at the gateway
- `X-User-Id` would be injected after validation
- Rate limiting would be applied per user

**Current Workaround:** `X-User-Id` header is passed directly — trusted without gateway validation.

### 4. Service Discovery (NOT Implemented)

Services discover each other via hardcoded URLs in environment variables:

```yaml
# docker-compose.ssp.yml
environment:
  - INVENTORY_SERVICE_URL=http://inventory-java:8082
  - WAREHOUSE_SERVICE_URL=http://warehouse-go:8084
```

Docker's built-in DNS resolution handles `inventory-java:8082` by container name. In a Kubernetes environment, this would be a Service DNS name.

**Production Alternative:** Consul, Eureka, or Kubernetes Service discovery.

### 5. Message Queue (NOT Implemented)

All communication is synchronous HTTP. For a production system:

- Order placed → Kafka topic `orders.created`
- Warehouse service consumes → deducts stock → publishes `stock.updated`
- Notification service consumes → sends email

**Why Synchronous Instead:**
→ Synchronous calls are simpler to benchmark. Async message queues introduce unpredictable latency from queue depth and consumer lag, which would make the benchmark results harder to interpret. The project deliberately chooses synchronous communication for clean measurement.

---

## Service Orchestration vs Choreography

This project uses **Orchestration** (central coordinator):

```text
order-service = Orchestrator
  → calls inventory-service
  → calls warehouse-service
  → calls notification-service
  → calls delivery-service
```

**Pros of Orchestration:**

- Single place to understand the order flow
- Easier debugging (trace one service)
- Centralized error handling

**Cons of Orchestration:**

- order-service is a single point of failure
- Tight coupling to all downstream services
- Doesn't scale as well as choreography

**Alternative — Choreography (Event-Driven):**

```text
order-service → publishes "order.created"
inventory-service consumes → publishes "stock.reserved"
warehouse-service consumes → publishes "stock.deducted"
notification-service consumes → publishes "notification.sent"
```

**Pros of Choreography:** Loose coupling, easier to add new consumers, better fault isolation.
**Cons:** Harder to understand full flow, debugging requires distributed tracing.

---

## Scalability Analysis

### Horizontal Scaling Potential

| Service | Stateful? | Can Scale Horizontally? | Issue |
| --------- | ----------- | ------------------------ | ------- |
| order-service | No (stateless HTTP) | ✅ Yes | DB connection pool per instance |
| inventory-service | No | ✅ Yes | Cache inconsistency across instances |
| warehouse-service | No | ✅ Yes | Stock deduction races possible |
| notification-service | No | ✅ Yes | Duplicate notifications possible |
| delivery-service | No | ✅ Yes | Duplicate shipments possible |
| PostgreSQL | Yes (DB state) | ⚠️ Read replicas only | Write bottleneck |

### Cache Inconsistency Problem

If 3 instances of inventory-service run behind a load balancer:

- Instance 1: Cache has Product A at price $999
- Admin updates Product A price to $899 in DB
- Instance 2 and 3: Cache still has $999
- Orders placed via Instances 2/3 use stale price

**Fix:** Distributed cache (Redis) + cache invalidation on product update.

---

## Fault Isolation Analysis

### Current Fault Isolation

- If notification-service is down → Orders still placed successfully (async, fire-and-forget)
- If delivery-service is down → Order status update to SHIPPED will fail, but error is caught

### Gaps

- If inventory-service is down → **All order placements fail** (synchronous dependency)
- If warehouse-service is down → **All order placements fail** (synchronous dependency)
- If PostgreSQL order_db is down → **All order operations fail**

### Circuit Breaker Would Help

```text
Without CB: inventory-service down → 200 VUs all timeout after 5s each
With CB: inventory-service down → CB opens after 5 failures → subsequent requests fail instantly
```

---

## Data Consistency Patterns

### Saga Pattern (Compensating Transactions)

The project doesn't implement sagas, but the order placement flow is essentially a distributed transaction:

```text
Step 1: Validate product exists (inventory)
Step 2: Query warehouse stock
Step 3: Deduct warehouse stock  ← Can't easily roll back without compensation
Step 4: Save order to DB        ← @Transactional — rollback if fails
Step 5: Sync global stock (inventory)
```

**Failure Scenario:** If Step 4 fails (DB save), Step 3 already deducted stock. No compensation transaction runs. **This is a data inconsistency bug** — stock is deducted but no order record exists.

**Production Fix:** Implement a saga with compensation:

- If order save fails → call `PUT /warehouses/{id}/stock {quantity: +N}` (add stock back)

---

## Inter-Service Communication Details

### Feign Client Configuration

```java
// InventoryClient.java
@FeignClient(name = "inventory-service", url = "${inventory.service.url:http://localhost:8082}")
// Default timeout: connectTimeout=10s, readTimeout=60s (configurable via feign.client.config)
```

### Go HTTP Client Configuration

```go
// httpclient.go
var SharedClient = &http.Client{
    Timeout: 5 * time.Second,  // Total request timeout
    Transport: sharedTransport,
}
```

**Timeout Discrepancy:** Java Feign has a much longer default timeout (60s read) vs Go's 5s. This could affect behavior under extreme load — Go fails faster on slow responses.

---

## Microservices Concepts Interview Questions

1. **What is the difference between orchestration and choreography?**
   → Orchestration: central coordinator calls each service sequentially. Choreography: services react to events. This project uses orchestration.

2. **What is the database-per-service pattern and why is it important?**
   → Each service owns its database schema and data. Prevents tight coupling, allows independent scaling, enables polyglot persistence.

3. **What is a bounded context?**
   → A logical boundary within which a particular domain model is consistent. "Product" means different things to inventory (has price, SKU) vs order (snapshot of price at purchase time).

4. **What is the difference between eventual consistency and strong consistency?**
   → Strong: all reads see the latest write immediately. Eventual: reads might see stale data but will eventually converge. `global_inventory.total_stock` is eventually consistent — updated asynchronously when warehouse stock changes.

5. **Why is the notification service fire-and-forget safe but stock deduction is not?**
   → Stock deduction affects the correctness of the order (can't oversell). Notification failure doesn't affect order validity — it's a side effect that can fail without corrupting the order.
