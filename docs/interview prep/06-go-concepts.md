# 06 — Go Concepts

---

## Every Go Concept Used in This Project

### 1. Goroutines

**What:** Lightweight concurrent execution units managed by the Go runtime scheduler. Not OS threads.

**Where:** `order_handler.go:289` (async notification), implicitly in every HTTP request handled by Gin

**In Project:**

```go
// order_handler.go:287-311
func sendNotificationAsync(order *models.Order, notifType, recipientEmail string) {
    go func() {  // "go" keyword spawns goroutine
        payload := map[string]string{...}
        _, err := clients.SendNotification(payload)
        if err != nil {
            log.Printf("Failed...: %v", err)
        }
    }()  // Immediately invoked anonymous function
}
```

**Properties:**

| Property | Goroutine | OS Thread |
| ---------- | ----------- | ----------- |
| Initial stack | ~2 KB (grows dynamically to max ~1 GB) | 1-8 MB (fixed) |
| Creation cost | ~200ns | ~10µs |
| Scheduling | User-space Go runtime | Kernel |
| Context switch | ~100ns | ~1µs |
| Max concurrent | Millions | Thousands |

**GOMAXPROCS:** With Docker's 1 CPU limit, Go defaults GOMAXPROCS=1, meaning goroutines are multiplexed on 1 OS thread. Concurrency without parallelism — goroutines still interleave I/O efficiently.

**Interview Q:** *Why are goroutines faster than threads?*
→ Goroutines use **cooperative scheduling at safe points** (function calls, channel ops, syscalls). They don't involve the kernel for scheduling. Stack starts small and grows on demand. Thread switching requires saving/restoring CPU registers + kernel involvement.

---

### 2. Goroutine Scheduler (GMP Model)

**What:** Go's runtime scheduler uses the GMP model to manage goroutines.

**G:** Goroutine — the unit of execution
**M:** Machine — OS thread (GOMAXPROCS M's run simultaneously)
**P:** Processor — logical scheduler that owns a run queue of G's

```text
GOMAXPROCS=1 (1 CPU limit):
┌──────────────────────────────────────┐
│  OS Thread (M)                       │
│    ┌──────────────────────────────┐  │
│    │ Processor (P) with run queue │  │
│    │  G1 → G2 → G3 → G4 → ...    │  │
│    └──────────────────────────────┘  │
└──────────────────────────────────────┘
```

When G1 blocks on I/O (DB query, HTTP call), P switches to G2. G1 resumes when I/O completes. This is why Go is efficient even with 1 CPU — it uses I/O wait time productively.

---

### 3. Channels (Not Used, But Important for Context)

**What:** Go's preferred method for goroutine communication. "Don't communicate by sharing memory; share memory by communicating."

**Why Not Used Here:** The project uses fire-and-forget goroutines for notifications. No return value needed. If the project needed results from goroutines (e.g., parallel warehouse queries), channels would be the idiomatic solution.

**Interview Q:** *Why didn't you use channels for the notification goroutine?*
→ Channels would require reading from the channel to get the result. Since notifications are fire-and-forget (we don't need the HTTP response to confirm order placement), a simple goroutine with error logging is sufficient. Using a channel would block the handler waiting for the notification response, defeating the purpose.

---

### 4. `sync.RWMutex`

**What:** Read-write mutex allowing concurrent reads, exclusive writes.

**Where:** `inventory-twin/internal/handlers/product_handler.go:17-24`

```go
type ProductCache struct {
    sync.RWMutex                    // Embedding — promotes RLock/RUnlock/Lock/Unlock methods
    items map[string]models.Product
}
```

**Key Methods:**

| Method      | Behavior                                                       | When to Use             |
| ----------- | -------------------------------------------------------------- | ----------------------- |
| `RLock()`   | Shared read lock — multiple goroutines can hold simultaneously | Before reading from map |
| `RUnlock()` | Release read lock                                              | After reading           |
| `Lock()`    | Exclusive write lock — blocks all readers AND writers          | Before writing to map   |
| `Unlock()`  | Release write lock                                             | After writing           |

**Why `sync.RWMutex` vs `sync.Mutex`:**

- `sync.Mutex` for a read-heavy cache would serialize ALL operations, including reads
- Under 200 VUs hitting cached products, 199 goroutines would block while 1 reads
- `sync.RWMutex` lets all 200 goroutines read simultaneously — no blocking for reads

**Race Condition Without Mutex:**

```go
// WRONG — race condition:
if product, ok := cache[id]; ok {  // Goroutine A reads
    return product
}
cache[id] = product  // Goroutine B writes simultaneously → DATA RACE
// map is NOT goroutine-safe in Go
```

Go maps are not safe for concurrent access. Even concurrent reads are unsafe because the map's internal structure might be resizing.

---

### 5. `context.Context`

**What:** Carries deadlines, cancellations, and request-scoped values across goroutines.

**Where:** Implicitly in Gin (`c.Request.Context()`), explicitly in HTTP client calls

**In Project — Gin Context vs Go Context:**

```go
// gin.Context is Gin's request context (NOT context.Context)
func CreateOrder(c *gin.Context) {
    // c is *gin.Context — Gin's request context
    // c.Request.Context() returns the standard context.Context
}

// HTTP clients use context for timeout propagation:
req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
// If ctx is cancelled (client disconnects), request is abandoned
```

**What Context Provides:**

1. **Deadline/Timeout:** `context.WithTimeout(parent, 5*time.Second)` — automatically cancels after 5s
2. **Cancellation:** `context.WithCancel()` — manual cancellation propagated to all derived contexts
3. **Values:** `context.WithValue()` — request-scoped key-value storage

**Interview Q:** *Why don't you propagate context through the notification goroutine?*
→ The notification goroutine should NOT use the request context because when the HTTP handler returns, the request context is cancelled. Using a background context `context.Background()` lets the goroutine complete even after the response is sent.

---

### 6. Interfaces (Implicit Satisfaction)

**What:** Go interfaces are satisfied implicitly — no `implements` keyword.

**Where:** Gin's `HandlerFunc`, GORM's database interface

```go
// Gin uses HandlerFunc type
type HandlerFunc func(*gin.Context)

// Our handlers automatically satisfy this:
func CreateOrder(c *gin.Context) { ... }
// No declaration needed. Go sees func(*gin.Context) and knows it matches.
```

**GORM Transaction Interface:**

```go
// GORM's Transaction accepts a function
func (db *DB) Transaction(fc func(tx *DB) error, ...) error
// Our transaction callback satisfies this:
database.DB.Transaction(func(tx *gorm.DB) error {
    return tx.Create(&order).Error
})
```

**Java vs Go Interface Philosophy:**

- Java: **Nominal typing** — must explicitly declare `implements Runnable`
- Go: **Structural typing** — any type with matching methods satisfies the interface

---

### 7. Struct Embedding

**What:** Go's mechanism for code reuse (not inheritance).

**Where:** `ProductCache` embeds `sync.RWMutex`

```go
type ProductCache struct {
    sync.RWMutex  // Embedded — all RWMutex methods promoted to ProductCache
    items map[string]models.Product
}

// Because of embedding, we can call:
inventoryCache.RLock()    // Instead of inventoryCache.RWMutex.RLock()
inventoryCache.RUnlock()
inventoryCache.Lock()
inventoryCache.Unlock()
```

**Why Not Inheritance:** Go has no inheritance. Embedding provides code reuse but NOT IS-A relationship. `ProductCache` is not a `RWMutex` — it HAS a `RWMutex`.

---

### 8. Error Handling

**What:** Go returns errors as values, not exceptions.

**Where:** Every handler, every client call

```go
// Go idiom: (result, error) return pattern
product, err := clients.GetProductById(itemReq.ProductID)
if err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Product not found: %s", itemReq.ProductID)})
    return  // Always return after error handling in Gin handlers
}

// Multiple assignment
err = database.DB.Transaction(func(tx *gorm.DB) error {
    if err := tx.Create(&order).Error; err != nil {
        return err  // This triggers ROLLBACK
    }
    return nil  // This triggers COMMIT
})
if err != nil {
    c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save order"})
    return
}
```

**Interview Q:** *What is the difference between Go's error handling and Java's exception handling?*
→ Java: `try/catch/finally` with exception objects thrown across the call stack. Checked exceptions (IOException) must be declared or caught. Go: error is a value returned alongside the result. Every caller must explicitly check it. Go's approach makes error paths visible and forces developers to think about failures at each call site. Java exceptions allow cleaner "happy path" code but can lead to uncaught exceptions silently propagating.

---

### 9. `net/http` and HTTP Transport Pooling

**What:** Go's standard library HTTP client.

**Where:** `clients/httpclient.go` — shared pooled transport

```go
// http.Transport = connection pool manager
var sharedTransport = &http.Transport{
    MaxIdleConns:        100,
    MaxIdleConnsPerHost: 50,    // Per-host connection pool size
    IdleConnTimeout:     30 * time.Second,
    DisableKeepAlives:   false, // Keep-alive = reuse TCP connections
}

var SharedClient = &http.Client{
    Timeout:   5 * time.Second,
    Transport: sharedTransport,
}
```

**Why a Shared Transport:**

- Default `&http.Client{}` uses `http.DefaultTransport` which has `MaxIdleConnsPerHost: 2`
- Under 200 concurrent VUs, Go would create hundreds of TCP connections
- A shared transport with `MaxIdleConnsPerHost: 50` mirrors Java's Feign behavior

**HTTP Keep-Alive:** When `DisableKeepAlives: false`, TCP connections are kept in the pool after a request. The next request to the same host reuses the existing connection, avoiding 3-way TCP handshake (~1ms latency savings per request).

---

### 10. GORM

**What:** Go's popular ORM. Wraps `database/sql`.

**Where:** `database/db.go`, all handler files

**Key GORM Operations:**

```go
// Find all
database.DB.Find(&products)
// SELECT * FROM products

// Find by condition
database.DB.Where("user_id = ?", userID).Order("created_at desc").Find(&orders)
// SELECT * FROM orders WHERE user_id = ? ORDER BY created_at desc

// Find first with condition
database.DB.First(&product, "product_id = ?", productUUID)
// SELECT * FROM products WHERE product_id = ? LIMIT 1

// Create
database.DB.Create(&order)
// INSERT INTO orders (...) VALUES (...)

// Save (UPDATE if PK set)
database.DB.Save(&order)
// UPDATE orders SET ... WHERE order_id = ?

// Transaction
database.DB.Transaction(func(tx *gorm.DB) error {
    tx.Create(&order)
    tx.Create(&orderItems)
    return nil // or error
})

// Raw SQL JOIN (warehouse handler)
database.DB.Table("warehouses").
    Select("warehouses.warehouse_id, ...").
    Joins("JOIN warehouse_stock ON ...").
    Where("warehouse_stock.product_id = ? AND quantity > 0", productID).
    Scan(&results)
```

**`Preload` vs `Join`:**

```go
// Preload: N+1 queries (1 for orders, N for items)
database.DB.Where("user_id = ?", userID).Preload("Items").Find(&orders)

// Join: Single query (not used in this project, but could be)
database.DB.Joins("Items").Where("user_id = ?", userID).Find(&orders)
```

**`gorm.ErrRecordNotFound`:**

```go
err := database.DB.First(&product, uuid).Error
if err == gorm.ErrRecordNotFound {
    c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
    return
}
```

---

### 11. Go Modules (`go.mod`)

**File:** `order-twin/go.mod`

```text
module github.com/smartfulfillment/order-twin
go 1.22.x

require (
    github.com/gin-contrib/cors v1.x.x
    github.com/gin-gonic/gin v1.x.x
    github.com/google/uuid v1.x.x
    github.com/prometheus/client_golang v1.x.x
    github.com/zsais/go-gin-prometheus v0.x.x
    gorm.io/driver/postgres v1.x.x
    gorm.io/gorm v1.x.x
)
```

**Key Dependencies:**

| Package | Purpose |
| --------- | --------- |
| `github.com/gin-gonic/gin` | HTTP framework |
| `github.com/gin-contrib/cors` | CORS middleware |
| `github.com/google/uuid` | UUID generation and parsing |
| `github.com/zsais/go-gin-prometheus` | Gin Prometheus middleware |
| `github.com/prometheus/client_golang` | Prometheus Go client + DBStats collector |
| `gorm.io/gorm` | ORM |
| `gorm.io/driver/postgres` | PostgreSQL driver for GORM |

---

### 12. JSON Struct Tags

**What:** Go uses struct field tags for JSON encoding/decoding.

```go
type Order struct {
    OrderID         uuid.UUID   `gorm:"..." json:"orderId"`    // Renamed in JSON
    Status          OrderStatus `gorm:"..." json:"status"`
    ShippingAddress string      `gorm:"..." json:"shippingAddress"`
    Items           []OrderItem `gorm:"..." json:"items"`
}

type OrderItem struct {
    OrderID uuid.UUID `gorm:"..." json:"-"`  // Excluded from JSON output
}
```

**Java vs Go:**

- Java: `@JsonProperty("orderId")` on field, `@JsonIgnore` to exclude
- Go: `json:"orderId"` struct tag, `json:"-"` to exclude

---

## Go Concepts Quick Reference

| Concept | Where in Project | Interview Relevance |
| --------- | ----------------- | --------------------- |
| Goroutines | `sendNotificationAsync()` | Lightweight async vs Java threads |
| `sync.RWMutex` | `ProductCache` | Thread-safe caching pattern |
| `go func(){}()` | Notification async | Fire-and-forget pattern |
| `net/http` Transport | `httpclient.go` | Connection pooling fairness |
| GORM Transaction | `CreateOrder()` | Explicit vs declarative transactions |
| Struct tags | All models | JSON + GORM mapping |
| Implicit interfaces | Gin HandlerFunc | Go's structural typing |
| Struct embedding | `ProductCache{sync.RWMutex}` | Code reuse pattern |
| Error as value | Every handler | Go error handling philosophy |

```mermaid
