# 10 — Security Analysis

---

## Security Strengths

### 1. UUID-Based Identifiers

All primary keys use UUID v4 — prevents enumeration attacks (can't guess next order ID).

### 2. Password Hashing (Auth Service)

The `users` table stores `password_hash` — plaintext passwords are never stored.

```sql
password_hash VARCHAR(255) NOT NULL
```

### 3. Database-Level CHECK Constraints

Role validation at DB level:

```sql
role VARCHAR(20) NOT NULL CHECK (role IN ('CUSTOMER', 'ADMIN', 'WAREHOUSE_MANAGER'))
```

### 4. BigDecimal for Monetary Values

Prevents floating-point price manipulation attacks.

### 5. Parameterized Queries

GORM and Spring Data JPA use parameterized queries exclusively — prevents SQL injection:

```go
// GORM — parameterized
database.DB.Where("user_id = ?", userID).Find(&orders)
// Generated: SELECT * FROM orders WHERE user_id = $1

// Spring Data JPA — parameterized
orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
// Generated: SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
```

---

## Security Weaknesses

### 1. No JWT Validation in Backend Services

**Current Implementation:**

```java
@RequestHeader("X-User-Id") UUID userId  // Trusts this header blindly
```

**Attack Vector:** Any client can set any `X-User-Id` and place orders as any user:

```bash
curl -X POST http://localhost:8083/orders \
  -H "X-User-Id: 00000000-0000-0000-0000-000000000001" \
  # Impersonates user with this UUID
```

**Intended Architecture:** An API Gateway validates JWT before forwarding to services. The project acknowledges this in code comments but doesn't implement it.

**Fix:** Spring Security + JWT filter, or API Gateway (Kong, AWS API Gateway, Nginx).

---

### 2. Hardcoded Credentials in Docker Environment

**Current:**

```yaml
# docker-compose.ssp.yml
environment:
  - GF_SECURITY_ADMIN_PASSWORD=admin  # Grafana admin password
```

**Fix:** Use Docker secrets, HashiCorp Vault, or Kubernetes Secrets.

---

### 3. CORS Configuration

**Java (WebConfig.java):**
Not fully visible in provided code, but CORS is configured.

**Go (main.go:24-28):**

```go
corsConfig := cors.DefaultConfig()
corsConfig.AllowOrigins = []string{"http://localhost:5173"}  // Frontend URL
corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
corsConfig.AllowHeaders = []string{"*"}  // Any header allowed — too permissive
corsConfig.AllowCredentials = true
r.Use(cors.New(corsConfig))
```

**Issue:** `AllowHeaders: []string{"*"}` allows any header — should be restricted to known headers.

---

### 4. No Rate Limiting

No rate limiting is implemented at the service level. The benchmark intentionally floods the service with 200 VUs — in production, without rate limiting, this would be an open invitation for DoS attacks.

**Fix:** Redis-based rate limiting middleware, or API Gateway rate limiting.

---

### 5. Environment Variables for Secrets (Partial)

**Used correctly:**

```go
// warehouse_handler.go:117-120
inventoryServiceURL := os.Getenv("INVENTORY_SERVICE_URL")
if inventoryServiceURL == "" {
    inventoryServiceURL = "http://localhost:8082"
}
```

**Exposed in docker-compose:**

```yaml
environment:
  - INVENTORY_SERVICE_URL=http://inventory-java:8082
  # Service URLs visible in docker-compose — not secrets, but should be noted
```

**Database credentials** in `.env` files — not committed to Git (`.gitignore` includes `.env`):

```text
# .gitignore includes .env
# .example.env shows structure without actual credentials
```

---

### 6. No Input Validation on OrderRequest

```java
// OrderRequest.java — no @NotNull, @Valid, @Min
public class OrderRequest {
    private String shippingAddress;    // Can be null, empty, 10MB string
    private Double shippingLatitude;   // Can be null → falls back to 0.0
    private Double shippingLongitude;  // Can be null → falls back to 0.0
    private List<OrderItemRequest> items;  // Can be null → NullPointerException
}
```

**Potential Issues:**

- `items = null` → `for(OrderRequest.OrderItemRequest req : itemRequests)` throws NPE
- `shippingAddress = ""` → Empty string saved to DB (not meaningful)
- `quantity = -1` → Would send `{quantity: 1}` to warehouse (positive deduction for negative order)

---

### 7. Sensitive Data in Logs

```java
// OrderService.java:38
log.info("Processing order for User: {}", userId);
// User IDs in logs — PII concern

// OrderService.java:202
log.info("SMART ROUTING: Assigning Product {} to '{}' (...). Distance: {} km.",
        item.getProductId(), closestWarehouse.getWarehouseName(), ...);
// Logs product access patterns — potential business intelligence leak
```

---

### 8. Warehouse Role Check Is Header-Based

```go
// warehouse_handler.go:181-208
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userRole := c.GetHeader("X-User-Role")  // Trusts this header blindly
        if !isAllowed {
            c.JSON(http.StatusUnauthorized, gin.H{"error": "403 Forbidden..."})
        }
    }
}
```

Like `X-User-Id`, the `X-User-Role` header is trusted without verification. Any client can set `X-User-Role: ADMIN`.

---

## SQL Injection Analysis

**Risk:** LOW (parameterized queries used throughout)

**Java GORM-equivalent (Spring Data JPA):**

```java
// SAFE — Spring Data JPA parameterized
repository.findByUserIdOrderByCreatedAtDesc(userId)
// → SELECT ... WHERE user_id = ?  (prepared statement)

// SAFE — Feign URL parameter
@GetMapping("/products/{id}")
ProductDTO getProductById(@PathVariable("id") UUID id)
// UUID type enforces format before HTTP call
```

**Go GORM:**

```go
// SAFE — parameterized
database.DB.Where("user_id = ?", userID).Find(&orders)

// SAFE — parameterized JOIN
database.DB.Table("warehouses").
    Where("warehouse_stock.product_id = ? AND warehouse_stock.quantity > 0", productIDParam)
```

**UUID Type Safety:** Using `UUID` type in Java and `uuid.UUID` in Go prevents SQL injection in path parameters — the UUID parser rejects malformed input before it reaches the query.

---

## Security Improvement Roadmap

| Priority | Issue | Fix |
| ---------- | ------- | ----- |
| HIGH | No JWT validation | Spring Security JWT filter or API Gateway |
| HIGH | Hardcoded Grafana password | Docker secrets or Vault |
| MEDIUM | Overly permissive CORS `AllowHeaders: *` | Restrict to specific headers |
| MEDIUM | No input validation on OrderRequest | Add `@Valid`, `@NotNull`, `@Min` |
| MEDIUM | No rate limiting | Redis rate limiter or API Gateway |
| LOW | Sensitive data in logs | Log masking, structured logging with PII filters |
| LOW | Header-based role check | Integrate with JWT claims |

---

## Security Interview Questions

1. **How would you secure the inter-service communication?**
   → mTLS (mutual TLS) between services. Service mesh like Istio can enforce this automatically.

2. **Why is `X-User-Id` header potentially dangerous without a gateway?**
   → Any client can forge any `X-User-Id` and impersonate any user. Without a gateway validating JWT and injecting this header, the system trusts unauthenticated identity claims.

3. **Is the project vulnerable to SQL injection?**
   → No. All queries use parameterized statements via GORM and Spring Data JPA. UUID type safety adds another layer of input validation.

4. **How would you store DB credentials securely in production?**
   → HashiCorp Vault, Kubernetes Secrets, AWS Secrets Manager, or environment variables injected at runtime (not in source code or docker-compose).

5. **What is the principle of least privilege and does this project follow it?**

```text
