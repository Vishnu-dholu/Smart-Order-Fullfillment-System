# 04 — Go Services Deep Dive

---

## Folder Structure

### order-twin

```text
services/go/order-twin/
├── cmd/
│   └── main.go                  ← Entry point: Gin setup, Prometheus, routes
├── internal/
│   ├── config/
│   │   └── config.go            ← Env-var based configuration struct
│   ├── database/
│   │   └── db.go                ← GORM + PostgreSQL + connection pool + DBStats Prometheus
│   ├── handlers/
│   │   └── order_handler.go     ← All HTTP handler functions + DTOs + helpers
│   ├── clients/
│   │   ├── httpclient.go        ← Shared http.Transport pool (fair benchmarking)
│   │   ├── inventory_client.go  ← GetProductById()
│   │   ├── warehouse_client.go  ← GetStockByProduct(), UpdateStock()
│   │   ├── delivery_client.go   ← CreateDelivery()
│   │   └── notification_client.go ← SendNotification()
│   ├── models/
│   │   └── order.go             ← Order, OrderItem structs + OrderStatus type
│   └── utils/
│       └── location_utils.go    ← CalculateDistance() Haversine
├── go.mod                       ← Module: github.com/smartfulfillment/order-twin
├── go.sum                       ← Dependency checksums
├── Dockerfile                   ← Multi-stage build
└── .env                         ← DB_URL, PORT etc.
```

### inventory-twin

```text
services/go/inventory-twin/
├── cmd/main.go
├── internal/
│   ├── config/config.go
│   ├── database/db.go           ← GORM + Prometheus DBStats
│   ├── handlers/
│   │   ├── product_handler.go   ← RWMutex cache + CRUD + sync-stock
│   │   └── health_handler.go    ← GET /health
│   └── models/
│       ├── product.go           ← Product, ProductResponse structs
│       └── global_inventory.go  ← GlobalInventory struct
└── go.mod
```

---

## main.go — Application Bootstrap

```go
// order-twin/cmd/main.go
func main() {
    cfg := config.LoadConfig()           // Reads env vars: DB_URL, PORT
    database.Connect(cfg.DBUrl)          // GORM connect + pool setup + Prometheus DBStats

    r := gin.Default()                   // Default: Logger + Recovery middleware

    // Prometheus middleware — registers gin_request_duration_seconds histogram
    p := ginprometheus.NewPrometheus("gin")
    p.Use(r)                             // Adds /metrics endpoint automatically

    // CORS middleware
    corsConfig := cors.DefaultConfig()
    corsConfig.AllowOrigins = []string{"http://localhost:5173"}
    r.Use(cors.New(corsConfig))

    // Route registration
    orders := r.Group("/orders")
    {
        orders.POST("", handlers.CreateOrder)
        orders.GET("", handlers.GetUserOrders)
        orders.GET("/all", handlers.GetAllSystemOrders)
        orders.PUT("/:orderId/status", handlers.UpdateOrderStatus)
    }

    r.Run(":" + cfg.Port)
}
```

**Key Go Concepts:**

- `gin.Default()` — creates router with Logger and Recovery middleware pre-attached
- `r.Group("/orders")` — creates a sub-router sharing the "/orders" prefix
- `ginprometheus.NewPrometheus("gin")` — the "gin" prefix becomes the metric name prefix: `gin_request_duration_seconds`
- **No explicit thread pool** — Gin uses Go's `net/http` which spawns a goroutine per connection automatically

---

## Gin Handler Pattern

### Handler Signature

```go
// All Gin handlers must match: func(c *gin.Context)
func CreateOrder(c *gin.Context) {
    // c.GetHeader()     — extract HTTP headers
    // c.ShouldBindJSON() — decode JSON body into struct
    // c.JSON()          — write JSON response
    // c.Status()        — write status-only response
    // c.Param()         — URL path parameters
    // c.Query()         — URL query parameters
    // c.Abort()         — stop middleware chain
}
```

### Error Handling Pattern

```go
// Go style: explicit error returns, no exceptions
if err := c.ShouldBindJSON(&req); err != nil {
    c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: " + err.Error()})
    return  // MUST return after c.JSON() to stop further processing
}
```

---

## Models (Go structs vs Java entities)

### Order Model

```go
// internal/models/order.go
type OrderStatus string

const (
    Created          OrderStatus = "CREATED"
    PendingInventory OrderStatus = "PENDING_INVENTORY"
    Confirmed        OrderStatus = "CONFIRMED"
    Shipped          OrderStatus = "SHIPPED"
    Delivered        OrderStatus = "DELIVERED"
    Cancelled        OrderStatus = "CANCELLED"
)

type Order struct {
    OrderID         uuid.UUID   `gorm:"type:uuid;default:gen_random_uuid();primary_key" json:"orderId"`
    UserID          uuid.UUID   `gorm:"type:uuid;not null;column:user_id" json:"userId"`
    TotalAmount     float64     `gorm:"type:numeric;not null;column:total_amount" json:"totalAmount"`
    Status          OrderStatus `gorm:"type:varchar;not null" json:"status"`
    ShippingAddress string      `gorm:"type:text;not null;column:shipping_address" json:"shippingAddress"`
    Items           []OrderItem `gorm:"foreignkey:OrderID" json:"items"`
    CreatedAt       time.Time   `gorm:"default:CURRENT_TIMESTAMP;column:created_at" json:"createdAt"`
    UpdatedAt       time.Time   `gorm:"default:CURRENT_TIMESTAMP;column:updated_at" json:"updatedAt"`
}
```

**Java vs Go Comparison:**

| Aspect | Java | Go |
| -------- | ------ | ----- |
| ORM annotations | JPA annotations (`@Entity`, `@Table`) | GORM struct tags (`gorm:"..."`) |
| JSON annotations | Jackson (`@JsonIgnore`) | encoding/json tags (`json:"-"`) |
| Type safety | `BigDecimal` for money | `float64` for money (risk: float imprecision) |
| Status type | Java enum with `@Enumerated` | `type OrderStatus string` + const block |
| UUID generation | `GenerationType.UUID` | `gorm:"default:gen_random_uuid()"` |

---

## The RWMutex Cache — Key Go Concept

**File:** `inventory-twin/internal/handlers/product_handler.go`

```go
// Cache setup
type ProductCache struct {
    sync.RWMutex                    // Embedded — ProductCache inherits RLock/RUnlock/Lock/Unlock
    items map[string]models.Product
}

var inventoryCache = &ProductCache{
    items: make(map[string]models.Product),  // Global singleton cache
}
```

**Why `sync.RWMutex` instead of `sync.Mutex`?**

- `sync.Mutex`: Only ONE goroutine can hold it at a time (for reads OR writes)
- `sync.RWMutex`: **Multiple goroutines can read simultaneously** (shared read lock), but writes are exclusive

```go
// GET /products/{id} — Read path
func GetProductById(c *gin.Context) {
    productIDParam := c.Param("id")

    // Multiple concurrent goroutines can execute this simultaneously
    inventoryCache.RLock()
    cachedProduct, found := inventoryCache.items[productIDParam]
    inventoryCache.RUnlock()

    if found {
        c.JSON(http.StatusOK, cachedProduct)  // CACHE HIT: return from RAM, no DB
        return
    }

    // CACHE MISS: Only one path hits DB
    productUUID, _ := uuid.Parse(productIDParam)
    var product models.Product
    database.DB.First(&product, "product_id = ?", productUUID)

    // WRITE LOCK: Exclusive — blocks all readers while updating
    inventoryCache.Lock()
    inventoryCache.items[productIDParam] = product
    inventoryCache.Unlock()

    c.JSON(http.StatusOK, product)
}
```

**Interview Point:** Under the inventory benchmark with 200 VUs hitting the same 10 products, after the first 10 requests per product, all subsequent requests return from the in-memory cache with NO database roundtrip. This explains why the Go inventory twin achieved ~1ms average latency vs Java's ~1.5ms — the Go cache response is a pure memory lookup while Java's `@Cacheable` still has Spring AOP proxy overhead.

---

## GORM Transactions in Go

### Explicit GORM Transaction

```go
// order_handler.go:104-118
err = database.DB.Transaction(func(tx *gorm.DB) error {
    if err := tx.Create(&order).Error; err != nil {
        return err  // Returning error triggers automatic ROLLBACK
    }
    for i := range orderItems {
        orderItems[i].OrderID = order.OrderID  // Set FK after parent Insert
    }
    if err := tx.Create(&orderItems).Error; err != nil {
        return err  // Rollback if items fail
    }
    order.Items = orderItems  // Populate for JSON response
    return nil  // nil return = COMMIT
})
```

**Java vs Go Transaction Comparison:**

- Java: `@Transactional` annotation on method → Spring AOP proxy manages begin/commit/rollback
- Go: `database.DB.Transaction(func(tx) error {...})` → GORM manages begin/commit/rollback
- Both: Rollback on error, commit on success
- Go advantage: The transaction scope is **explicit and visible** in code. Java's `@Transactional` requires knowing that an AOP proxy is managing it invisibly.

---

## Goroutines vs Threads — The Core Concurrency Difference

### Java Notification Thread

```java
// OrderService.java:231
new Thread(() -> {
    try {
        notificationClient.sendNotification(payload);
    } catch (Exception e) {
        log.error("Failed...", e);
    }
}).start();
// Cost: ~1MB stack, kernel-scheduled OS thread
```

### Go Notification Goroutine

```go
// order_handler.go:289
go func() {
    _, err := clients.SendNotification(payload)
    if err != nil {
        log.Printf("Failed...", err)
    }
}()
// Cost: ~2KB stack, user-space scheduled by Go runtime
```

**Memory Comparison at 200 Concurrent Orders:**

- Java notification threads: 200 × 1MB = **200MB** just for notification threads
- Go notification goroutines: 200 × 2KB = **~400KB** — essentially free

**Scheduling Comparison:**

- Java thread: OS context switch required (~microseconds), kernel call for every thread operation
- Go goroutine: Multiplexed onto GOMAXPROCS OS threads, context switch in Go runtime (~nanoseconds)

---

## Shared HTTP Client Pool (Fair Benchmarking)

**File:** `order-twin/internal/clients/httpclient.go`

```go
// Shared pooled transport — replaces creating new http.Client per request
var sharedTransport = &http.Transport{
    MaxIdleConns:        100,
    MaxIdleConnsPerHost: 50,        // Mirror Java Feign's pool ceiling
    IdleConnTimeout:     30 * time.Second,  // Match HikariCP's idle-timeout
    DisableKeepAlives:   false,     // Keep TCP connections alive for reuse
    ForceAttemptHTTP2:   false,     // HTTP/1.1 to match Java's OpenFeign
    DialContext: (&net.Dialer{
        Timeout:   5 * time.Second,
        KeepAlive: 30 * time.Second,
    }).DialContext,
}

var SharedClient = &http.Client{
    Timeout:   5 * time.Second,
    Transport: sharedTransport,
}
```

**Why This Matters for Fair Benchmarking:**
Before this was added, the Go services were creating `&http.Client{}` per request, causing:

1. A new TCP connection for every inter-service call (3-way handshake overhead)
2. DNS lookup on every call
3. Artificially inflated latency for Go compared to Java's persistent Feign connections

After adding the shared transport, both runtimes use persistent connection pools with equivalent parameters.

---

## Go Database Connection Pool (Prometheus Integration)

**File:** `order-twin/internal/database/db.go`

```go
func Connect(connectionString string) {
    DB, err = gorm.Open(postgres.Open(connectionString), &gorm.Config{})

    // Extract underlying sql.DB from GORM
    sqlDB, _ := DB.DB()

    // Mirror Java's HikariCP settings
    sqlDB.SetMaxOpenConns(50)           // hikaricp: spring.datasource.hikari.maximum-pool-size=50
    sqlDB.SetMaxIdleConns(10)           // hikaricp: spring.datasource.hikari.minimum-idle=10
    sqlDB.SetConnMaxLifetime(30 * time.Minute)

    // Register pool stats with Prometheus
    prometheus.Register(collectors.NewDBStatsCollector(sqlDB, "order_db"))
    // Exposes: go_sql_open_connections, go_sql_in_use_connections,
    //          go_sql_idle_connections, go_sql_wait_count_total
}
```

**Prometheus Metrics Exposed:**

| Go Metric | Java Equivalent | Meaning |
| ----------- | ---------------- | --------- |
| `go_sql_in_use_connections` | `hikaricp_connections_active` | Connections executing a query |
| `go_sql_open_connections` | `hikaricp_connections` (total) | Total open connections |
| `go_sql_idle_connections` | `hikaricp_connections_idle` | Sitting idle in pool |
| `go_sql_wait_count_total` | `hikaricp_connections_pending` trend | Times a goroutine waited for a connection |

---

## Go Gin Prometheus Integration

**File:** `cmd/main.go`

```go
p := ginprometheus.NewPrometheus("gin")
p.Use(r)
```

This adds the `go-gin-prometheus` middleware which automatically:

1. Registers a `gin_request_duration_seconds` histogram with labels: `code`, `method`, `handler`
2. Adds a `/metrics` endpoint (Prometheus pull format)
3. Records every HTTP request's duration after completion

**PromQL Used in export_metrics_v2.py:**

```promql
# P99 Latency (Go)
histogram_quantile(0.99, sum(rate(gin_request_duration_seconds_bucket[1m])) by (le, instance))

# Throughput (Go)
sum(rate(gin_request_duration_seconds_count[1m])) by (instance)

# Error Rate (Go) — uses label 'code' not 'status' like Spring
sum(rate(gin_request_duration_seconds_count{code=~"5.*"}[1m])) by (instance)
```

---

## Go Interface Pattern (Implicit)

Go doesn't have explicit interface declarations like Java. Interfaces are satisfied implicitly.

```go
// In Go, there's no explicit "implements" keyword
// A type satisfies an interface if it has all the required methods

type gin.HandlerFunc = func(*gin.Context)
// All handlers just need to match this signature
// No interface declaration needed anywhere
```

**Java vs Go Interface:**

```java
// Java: explicit declaration
public interface InventoryClient {
    ProductDTO getProductById(UUID id);
}
```

```go
// Go: no explicit interface needed for Gin handlers
// Implicit satisfaction through matching signatures
```

---

## Interview Questions — Go Services

**Easy:**

1. What is a goroutine? → A lightweight, user-space concurrent function managed by Go runtime. ~2KB stack, multiplexed onto OS threads.
2. What is `sync.RWMutex`? → Read-write mutex: allows concurrent reads, exclusive writes.
3. What does `go func(){}()` do? → Spawns a new goroutine running the anonymous function asynchronously.
4. What is GORM? → Go ORM library that wraps `database/sql`. Similar to Hibernate.
5. What is `gin.Context`? → The central struct in Gin — holds request, response, parameters, and context cancellation.

**Medium:**
6. Why use `RWMutex` instead of `Mutex` for the product cache? → Multiple goroutines can read concurrently (shared RLock). Mutex would block all readers when any goroutine is reading.
7. What is the difference between `Lock()` and `RLock()`? → `Lock()` = exclusive write lock (blocks all readers and writers). `RLock()` = shared read lock (allows concurrent reads, blocks writers).
8. Why is `MaxIdleConnsPerHost: 50` set in the HTTP transport? → To prevent TCP connection exhaustion. Without it, Go creates a new TCP connection per request, adding 3-way handshake latency.
9. How does GORM's `Transaction()` work? → Starts a DB transaction, passes a `*gorm.DB` scoped to that transaction, commits on nil return, rolls back on error return.
10. What does `c.Abort()` do in Gin? → Stops the middleware chain. Subsequent handlers won't be called. Used in authorization middleware.

**Hard:**
11. Go has no try-catch. How does error handling work? → Multiple return values: `func() (result, error)`. Every caller must check the error. `panic/recover` exists for exceptional cases only.
12. What is `context.Context` in Go and why is it important? → Carries cancellation signals, deadlines, and request-scoped values across goroutines. If a client disconnects, context is cancelled, and all downstream operations can stop.
13. What happens if two goroutines simultaneously call `GetProductById` for the same uncached product? → Both pass the RLock check (not in cache), both query the DB, both acquire Lock() sequentially, both write to cache. The second write is a no-op (same value). This is the same thundering herd problem as Java's @Cacheable.
14. What does `gorm:"default:gen_random_uuid();primary_key"` do? → Instructs GORM that the PK should be DB-generated (calls PostgreSQL's `gen_random_uuid()`). GORM retrieves the generated ID after INSERT.

**Expert:**
15. How does the Go garbage collector differ from JVM G1GC? → Go uses a **concurrent tri-color mark-and-sweep GC**. It runs concurrently with application goroutines (not stop-the-world in most phases). JVM G1GC has shorter pause times (~5ms target) but higher total GC overhead. Go's GC pauses are typically sub-millisecond but GC frequency is higher. In the benchmark, Go showed more frequent but shorter GC cycles vs Java's less frequent but longer GC events.
16. What is `GOMAXPROCS` and how does it affect the order-twin's performance? → GOMAXPROCS controls how many OS threads the Go scheduler uses simultaneously. Default = number of CPU cores. With `deploy.resources.limits.cpus: 1.0` in Docker, GOMAXPROCS=1, meaning the Go scheduler uses only 1 OS thread. All goroutines multiplex onto that single thread. This limits true parallelism but is fair because Java also has 1 CPU.
