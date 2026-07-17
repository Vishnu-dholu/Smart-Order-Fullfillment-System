# 03 — Java Services Deep Dive

---

## Package Structure

### order-service

```text
services/spring/order-service/
├── pom.xml                         ← Spring Boot 4.0.2, Java 21, Cloud 2025.1.0
└── src/main/java/com/smartfulfillment/order_service/
    ├── OrderServiceApplication.java  ← @SpringBootApplication, @EnableFeignClients
    ├── config/
    │   └── WebConfig.java            ← CORS configuration
    ├── controller/
    │   └── OrderController.java      ← @RestController, @RequestMapping("/orders")
    ├── service/
    │   └── OrderService.java         ← @Service, @Transactional, Business Logic
    ├── repository/
    │   └── OrderRepository.java      ← JpaRepository<Order, UUID>
    ├── entity/
    │   ├── Order.java                ← @Entity, @Table("orders")
    │   ├── OrderItem.java            ← @Entity, @Table("order_items"), @ManyToOne
    │   └── OrderStatus.java          ← Enum: CREATED, PENDING_INVENTORY, CONFIRMED...
    ├── dto/
    │   ├── OrderRequest.java         ← @Data, nested OrderItemRequest
    │   ├── OrderResponse.java        ← @Builder, read-only DTO
    │   ├── ProductDTO.java           ← Remote product representation
    │   └── StockDTO.java             ← Remote warehouse stock representation
    ├── client/
    │   ├── InventoryClient.java      ← @FeignClient(url="${inventory.service.url}")
    │   ├── WarehouseClient.java      ← @FeignClient(url="${warehouse.service.url}")
    │   ├── DeliveryClient.java       ← @FeignClient(url="${delivery.service.url}")
    │   └── NotificationClient.java   ← @FeignClient(url="${notification.service.url}")
    ├── exception/
    │   └── InsufficientStockException.java
    └── util/
        └── LocationUtils.java        ← Haversine formula (static utility)
```

### inventory-service

```text
services/spring/inventory-service/
└── src/main/java/com/smartfulfillment/inventory_service/
    ├── InventoryServiceApplication.java
    ├── config/WebConfig.java
    ├── controller/
    │   ├── ProductController.java     ← CRUD + sync-stock endpoint
    │   └── HealthController.java
    ├── service/
    │   └── ProductService.java        ← @Cacheable, @Transactional
    ├── repository/
    │   ├── ProductRepository.java     ← JpaRepository<Product, UUID>
    │   └── GlobalInventoryRepository.java ← findByProductId(UUID)
    ├── entity/
    │   ├── Product.java               ← @Entity, @Table("products")
    │   └── GlobalInventory.java       ← @Entity, @Table("global_inventory")
    └── dto/
        └── ProductResponse.java       ← enriched with stock info
```

---

## Entity Analysis

### Order Entity

**File:** `entity/Order.java`

```java
@Entity
@Table(name = "orders")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)   // DB-generated UUID v4
    private UUID orderId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;                               // Logical FK to auth_db

    @Column(name = "total_amount", nullable = false)
    private BigDecimal totalAmount;                    // DECIMAL(10,2) — exact arithmetic

    @Enumerated(EnumType.STRING)                       // Stored as VARCHAR, not integer
    @Column(nullable = false)
    private OrderStatus status;

    @Column(name = "shipping_address", nullable = false, columnDefinition = "TEXT")
    private String shippingAddress;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
    private List<OrderItem> items;                     // Fetched lazily by default

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @CreationTimestamp                                 // NOTE: should be @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
```

**Interview Points:**

- `GenerationType.UUID` delegates UUID generation to the DB (`gen_random_uuid()`), not the JVM
- `BigDecimal` for monetary values — avoids floating-point precision errors
- `EnumType.STRING` stores "CONFIRMED" not "2" — readable in DB, safe across enum reorderings
- `@CreationTimestamp` on `updatedAt` is technically a **bug** — should be `@UpdateTimestamp`
- `cascade = CascadeType.ALL` means deleting an Order also deletes all OrderItems

### OrderItem Entity

**File:** `entity/OrderItem.java`

```java
@Entity
@Table(name = "order_items")
public class OrderItem {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "order_id")
    @JsonIgnore            // Prevents circular JSON serialization (Order -> Items -> Order)
    private Order order;

    @Column(name = "product_id", nullable = false)
    private UUID productId;  // Logical reference — no DB FK to inventory_db

    @Column(nullable = false)
    private int quantity;

    @Column(name = "price_at_purchase", nullable = false)
    private BigDecimal priceAtPurchase;  // Snapshot of price at order time (price can change later)
}
```

**Interview Points:**

- `@JsonIgnore` on the `order` field prevents the infinite recursion serialization problem
- `priceAtPurchase` captures price at order time — critical for order history accuracy
- No FK constraint to `products` table in inventory_db — cross-database FK impossible in microservices

### Product Entity

**File:** `entity/Product.java`

```java
@Entity
@Table(name = "products")
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "product_id")
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String sku;  // Stock Keeping Unit e.g. "IPHONE-15-BLK"

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "low_stock_threshold", nullable = false)
    private Integer lowStockThreshold = 10;
}
```

---

## Service Layer Analysis

### OrderService

**File:** `service/OrderService.java` — The heart of the Java order pipeline.

```java
@Service
@RequiredArgsConstructor     // Lombok: generates constructor injection
@Slf4j                       // Lombok: injects private static final Logger log
public class OrderService {
    // Constructor-injected (preferred over @Autowired field injection)
    private final OrderRepository orderRepository;
    private final InventoryClient inventoryClient;    // Feign proxy
    private final WarehouseClient warehouseClient;    // Feign proxy
    private final DeliveryClient deliveryClient;      // Feign proxy
    private final NotificationClient notificationClient; // Feign proxy

    @Transactional            // Wraps entire method in a single DB transaction
    public Order placeOrder(OrderRequest request, UUID userId) { ... }
}
```

**Transaction Scope:**
The `@Transactional` annotation means that if ANY step in `placeOrder()` throws an unchecked exception, the DB transaction rolls back. However, note that the inter-service HTTP calls to InventoryClient and WarehouseClient are **NOT rolled back automatically** — Feign calls are not transactional. This is the **distributed transaction problem** — the service relies on compensating logic rather than 2PC.

**The `calculateTotal()` method:**

```java
private BigDecimal calculateTotal(List<OrderItem> items){
    return items.stream()
            .map(item -> item.getPriceAtPurchase().multiply(BigDecimal.valueOf(item.getQuantity())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
}
```

Uses `stream()` → `map()` → `reduce()` — functional Java style. `BigDecimal::add` is a method reference.

### ProductService

**File:** `service/ProductService.java`

Key method — the cache-enabled product lookup:

```java
@Cacheable(value = "products", key = "#id")
public Product getProductById(UUID id){
    return productRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Product not found"));
}
```

`@Cacheable` works via **Spring AOP proxy**. When `getProductById()` is called, Spring intercepts the call, checks the "products" cache with key = `id.toString()`, and returns the cached value if present. On cache miss, the real method executes and the result is stored.

**Default Cache Implementation:** Spring Boot auto-configures a `ConcurrentMapCacheManager` when no other cache is configured. This stores cached values in a `ConcurrentHashMap<Object, Object>` in the JVM heap.

---

## Controller Layer

### OrderController

**File:** `controller/OrderController.java`

```java
@RestController           // = @Controller + @ResponseBody
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orderService;

    @PostMapping
    public ResponseEntity<Order> createOrder(
            @RequestBody OrderRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(orderService.placeOrder(request, userId));
    }

    @GetMapping
    public ResponseEntity<List<OrderResponse>> getOrderHistory(
            @RequestHeader("X-User-Id") UUID userId) { ... }

    @GetMapping("/all")
    public ResponseEntity<List<OrderResponse>> getAllSystemOrders() { ... }

    @PutMapping("/{orderId}/status")
    public ResponseEntity<Void> updateOrderStatus(
            @PathVariable UUID orderId,
            @RequestBody Map<String, String> statusUpdate) {
        OrderStatus newStatus = OrderStatus.valueOf(statusUpdate.get("status").toUpperCase());
        orderService.updateOrderStatus(orderId, newStatus);
        return ResponseEntity.ok().build();
    }
}
```

**Interview Points:**

- `@RequestHeader("X-User-Id")` — simulates API Gateway JWT extraction. In production, the gateway validates the JWT and passes a pre-validated user ID. Direct header injection bypasses auth for testing.
- `ResponseEntity.status(HttpStatus.CREATED).body(...)` — explicit 201 status, not just 200
- `OrderStatus.valueOf(...)` — will throw `IllegalArgumentException` on unknown status strings (no validation)

---

## Repository Layer

### OrderRepository

```java
public interface OrderRepository extends JpaRepository<Order, UUID> {
    List<Order> findByUserIdOrderByCreatedAtDesc(UUID userId);
    // Spring Data JPA generates SQL: SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC
}
```

Spring Data JPA generates the implementation at startup using **method name parsing**. No SQL needed — the query is derived from the method name.

---

## Feign Clients

### InventoryClient

```java
@FeignClient(name = "inventory-service", url = "${inventory.service.url:http://localhost:8082}")
public interface InventoryClient {
    @GetMapping("/products/{id}")
    ProductDTO getProductById(@PathVariable("id") UUID id);
}
```

**How Feign Works:**

1. Spring creates a JDK **dynamic proxy** implementing `InventoryClient`
2. When `getProductById(uuid)` is called, the proxy intercepts
3. Feign builds an HTTP request: `GET {url}/products/{uuid}`
4. The response JSON is deserialized to `ProductDTO` via Jackson
5. If the response is 4xx/5xx, a `FeignException` is thrown

**Configuration:** `url` uses Spring Environment property `${inventory.service.url}` with fallback to `http://localhost:8082`. In Docker Compose, this is set to `http://inventory-java:8082` via environment variable `INVENTORY_SERVICE_URL`.

---

## Spring Boot Annotations Reference

| Annotation | File Used In | Purpose |
| ----------- | ------------- | --------- |
| `@SpringBootApplication` | `OrderServiceApplication.java` | Auto-configuration, component scan, property support |
| `@EnableFeignClients` | `OrderServiceApplication.java` | Activates Feign proxy generation |
| `@RestController` | `OrderController.java` | @Controller + @ResponseBody |
| `@RequestMapping("/orders")` | `OrderController.java` | Base URL prefix for all endpoints |
| `@Service` | `OrderService.java` | Marks as Spring-managed service bean |
| `@Transactional` | `OrderService.java` | Wraps method in JPA transaction |
| `@RequiredArgsConstructor` | Multiple | Generates final-field constructor (Lombok) |
| `@Slf4j` | `OrderService.java` | Injects `log` field (Lombok + SLF4J) |
| `@Entity` | Entity classes | JPA managed entity, maps to DB table |
| `@Table(name=...)` | Entity classes | Specifies table name |
| `@Id` | Entity classes | Primary key |
| `@GeneratedValue(strategy=UUID)` | Entity classes | Auto-generate UUID primary key |
| `@OneToMany(cascade=ALL)` | `Order.java` | Parent-child relationship with cascade |
| `@ManyToOne` | `OrderItem.java` | Child references parent Order |
| `@JoinColumn` | `OrderItem.java` | Foreign key column name |
| `@Enumerated(EnumType.STRING)` | `Order.java` | Store enum as string in DB |
| `@CreationTimestamp` | Entity classes | Auto-set on INSERT |
| `@Cacheable` | `ProductService.java` | Spring Cache AOP interception |
| `@FeignClient` | Client interfaces | Declarative HTTP client proxy |
| `@JsonIgnore` | `OrderItem.java` | Exclude from Jackson serialization |
| `@Data` | DTOs | Generates getters, setters, equals, hashCode (Lombok) |
| `@Builder` | Entity classes | Builder pattern (Lombok) |

---

## Dependencies (pom.xml Analysis)

| Dependency | Purpose | Interview Relevance |
| ----------- | --------- | --------------------- |
| `spring-boot-starter-data-jpa` | JPA + Hibernate + HikariCP | ORM, connection pooling |
| `spring-boot-starter-webmvc` | Spring MVC (Tomcat) | Thread-per-request model |
| `spring-boot-starter-validation` | Bean validation (JSR-380) | @Valid, @NotNull etc. |
| `spring-cloud-starter-openfeign` | Declarative HTTP client | Feign proxies |
| `micrometer-registry-prometheus` | Prometheus metric export | Benchmarking observability |
| `spring-boot-starter-actuator` | `/actuator/prometheus` endpoint | Metrics scraping |
| `springdoc-openapi-starter-webmvc-ui` | Swagger UI at `/swagger-ui.html` | API documentation |
| `postgresql` | PostgreSQL JDBC driver | DB connectivity |
| `lombok` | Code generation | Reduces boilerplate |

**Java Version:** 21 (LTS) — supports virtual threads (Project Loom), records, sealed classes. However, virtual threads are **not used** in this project — standard platform threads via Tomcat's default executor.

---

## Interview Questions — Java Services

**Easy:**

1. What does `@Transactional` do? → Wraps method in a DB transaction. Rolls back on unchecked exception.
2. What is `@Cacheable`? → Spring AOP interceptor that checks cache before calling method.
3. What is Feign? → Declarative HTTP client that generates proxies from interfaces.
4. What does `@RestController` do? → Combines `@Controller` + `@ResponseBody`.
5. What is `JpaRepository`? → Spring Data interface providing CRUD + query methods.

**Medium:**
6. Why use `BigDecimal` instead of `double` for price? → Floating point precision errors (0.1 + 0.2 != 0.3).
7. How does Spring Data JPA generate SQL from method names? → Method name parser converts camelCase tokens to SQL clauses.
8. What is `CascadeType.ALL` and why is it dangerous? → Propagates all operations (delete, merge) to child entities. Danger: deleting a parent deletes all children.
9. Why is `@JsonIgnore` needed on `OrderItem.order`? → Without it, Jackson serializes Order → Items → Order → Items infinitely.
10. What does `@GeneratedValue(strategy = GenerationType.UUID)` do? → Asks the DB to call `gen_random_uuid()` to generate the primary key.

**Hard:**
11. If `placeOrder()` is `@Transactional` and the Feign call to WarehouseClient succeeds but the `orderRepository.save()` fails — what happens? → The DB transaction rolls back (order not saved), but the stock deduction in the warehouse already happened. This is a **distributed transaction inconsistency** — the stock is permanently deducted but no order exists.
12. How does Spring's `@Cacheable` default cache handle concurrent requests? → Uses `ConcurrentHashMap`. But: **two concurrent requests** for the same uncached key will **both execute** the DB call before either stores in cache (the "thundering herd" problem on cache miss).
13. Why is `@EnableFeignClients` on the main class necessary? → Without it, Spring doesn't scan for `@FeignClient` interfaces to create proxies.
14. What is the difference between `@Transactional(readOnly=true)` and regular `@Transactional`? → readOnly hints to Hibernate to skip dirty checking, which improves performance for read operations.

**Expert:**
15. How does HikariCP determine that the order-service needs a new DB connection? → Each Tomcat thread that calls a `@Transactional` method requests a connection from HikariCP's pool. If all 50 connections are in use, the thread blocks until `connectionTimeout` (30s default). This is captured by `hikaricp_connections_pending` in Prometheus.
16. What is the N+1 query problem and does this project have it? → N+1: fetching N orders then making N separate queries for items. `OrderRepository.findAll()` in `getAllOrders()` triggers lazy loading of items for EACH order — classic N+1. Fix: use `@EntityGraph` or JPQL with `JOIN FETCH`.
