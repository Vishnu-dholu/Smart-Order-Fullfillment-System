# 05 — Spring Boot Concepts

---

## Every Spring Feature Used in This Project

### 1. Dependency Injection (DI) / Inversion of Control (IoC)

**What:** Spring manages object creation and wiring. You declare dependencies; Spring provides them.

**Where:** Every `@Service`, `@RestController` class via `@RequiredArgsConstructor`

```java
// OrderService.java
@Service
@RequiredArgsConstructor  // Lombok generates constructor for all final fields
public class OrderService {
    private final OrderRepository orderRepository;    // Spring injects
    private final InventoryClient inventoryClient;    // Spring injects (Feign proxy)
    private final WarehouseClient warehouseClient;    // Spring injects (Feign proxy)
}
```

**Why:** Constructor injection (vs field injection) enables:

- **Immutability:** `final` fields can't be reassigned
- **Testability:** Can pass mocks in unit tests without reflection
- **Explicit dependencies:** All deps visible in constructor

**Alternatives:** `@Autowired` field injection (not used here — considered bad practice), `@Autowired` setter injection.

**Interview Q:** *Why is constructor injection preferred over field injection?*
→ Field injection uses reflection, hides dependencies, prevents immutability, and makes unit testing harder. Constructor injection makes dependencies explicit and enforces them at compile time.

---

### 2. Spring MVC (Servlet-based Web Layer)

**What:** Tomcat-based thread-per-request HTTP request handling.

**Where:** `OrderController.java`, `ProductController.java`

**Request Lifecycle:**

```text
HTTP Request
→ Tomcat thread pool (max 200 threads by default)
→ DispatcherServlet
→ HandlerMapping → finds @RequestMapping
→ HandlerAdapter → invokes @RestController method
→ MessageConverter (Jackson) → serialize response to JSON
→ HTTP Response
```

**Key Annotations:**

```java
@RestController              // @Controller + @ResponseBody
@RequestMapping("/orders")   // Class-level URL prefix
@PostMapping                 // HTTP POST → method
@GetMapping("/{id}")         // HTTP GET with path variable
@PutMapping("/{id}/status")  // HTTP PUT
@PathVariable UUID orderId   // Extract from URL
@RequestBody OrderRequest    // Deserialize JSON body → Java object
@RequestHeader("X-User-Id")  // Extract HTTP header
@ResponseStatus(CREATED)     // Set response status code
```

**Concurrency Model:** Tomcat maintains a thread pool (default max 200 threads). Each HTTP request gets its own thread. At 200 VUs, all 200 Tomcat threads are occupied simultaneously — this is the point where Java's thread-per-request model becomes a limiting factor.

**Interview Q:** *What happens when all 200 Tomcat threads are busy?*
→ Incoming requests queue in the Tomcat acceptor queue. If the queue fills up, new connections get TCP-level rejection or timeout.

---

### 3. Spring Data JPA + Hibernate

**What:** ORM abstraction over JDBC. Maps Java objects to DB tables.

**Where:** `OrderRepository`, `ProductRepository`, `GlobalInventoryRepository`

**Repository Hierarchy:**

```text
Repository (marker)
  └── CrudRepository (CRUD)
        └── PagingAndSortingRepository (pagination)
              └── JpaRepository (+ JPA-specific operations)
                    └── OrderRepository (our interface)
```

**Method Name Query Derivation:**

```java
// OrderRepository.java
List<Order> findByUserIdOrderByCreatedAtDesc(UUID userId);
// Generated SQL:
// SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC
```

Tokens parsed:

- `findBy` → WHERE clause
- `UserId` → `user_id` column
- `OrderBy` → ORDER BY clause
- `CreatedAt` → `created_at` column
- `Desc` → DESC

**Hibernate N+1 Problem in This Project:**

```java
// getAllOrders() in OrderService:
public List<OrderResponse> getAllOrders() {
    return orderRepository.findAll().stream()   // Query 1: SELECT * FROM orders
        .map(order -> OrderResponse.builder()
            // IMPLICIT: Hibernate auto-fetches order.getItems()
            // = N additional SELECT * FROM order_items WHERE order_id = ?
            .build())
        .toList();
}
```

`@OneToMany` is lazy by default. Accessing `order.getItems()` in the stream triggers a separate query per order. Fix: `findAll()` with `@EntityGraph` or JPQL `JOIN FETCH`.

---

### 4. Spring Cloud OpenFeign

**What:** Declarative HTTP client. Define the interface, Spring generates the implementation.

**Where:** `InventoryClient.java`, `WarehouseClient.java`, `DeliveryClient.java`, `NotificationClient.java`

```java
@FeignClient(name = "inventory-service", url = "${inventory.service.url:http://localhost:8082}")
public interface InventoryClient {
    @GetMapping("/products/{id}")
    ProductDTO getProductById(@PathVariable("id") UUID id);
}
```

**How Feign Works Internally:**

1. `@EnableFeignClients` triggers a classpath scan for `@FeignClient` interfaces
2. Spring creates a JDK **dynamic proxy** (`java.lang.reflect.Proxy`) implementing `InventoryClient`
3. The proxy bean is registered in the Spring IoC container
4. When `inventoryClient.getProductById(uuid)` is called, the proxy's `invoke()` method fires
5. Feign builds: `GET http://inventory-service:8082/products/{uuid}` with the UUID substituted
6. Feign uses an underlying HTTP client (Apache HttpClient or OkHttp or Java 11 HttpClient)
7. Response body is deserialized by Jackson to `ProductDTO`
8. `FeignException.NotFound` (404) is thrown if the service returns HTTP 404

**Error Handling:**

```java
// OrderService.java:148-158
private ProductDTO fetchProductFromInventory(UUID productId){
    try {
        return inventoryClient.getProductById(productId);
    } catch (FeignException.NotFound e){
        throw new RuntimeException("Product not found: " + productId);
    }
}
```

**URL Resolution in Docker:**

- Local: `http://localhost:8082` (default fallback)
- Docker: `http://inventory-java:8082` (via env var `INVENTORY_SERVICE_URL`)

---

### 5. Micrometer + Actuator (Prometheus Integration)

**What:** Micrometer is a metrics facade. Actuator exposes management endpoints.

**Where:** `pom.xml` dependencies: `spring-boot-starter-actuator` + `micrometer-registry-prometheus`

**How It Works:**

1. `micrometer-registry-prometheus` auto-configures a `PrometheusMeterRegistry`
2. Spring Boot auto-instruments everything:
   - HTTP request durations → `http_server_requests_seconds` histogram
   - JVM memory → `jvm_memory_used_bytes`
   - JVM GC → `jvm_gc_pause_seconds`
   - HikariCP pool → `hikaricp_connections_*`
   - JVM threads → `jvm_threads_live_threads`
3. `/actuator/prometheus` endpoint exposes all metrics in Prometheus text format
4. Prometheus scrapes this endpoint every 5 seconds

**Key Metrics Auto-Exported:**

| Metric | Type | What it Measures |
| -------- | ------ | ----------------- |
| `http_server_requests_seconds` | Histogram | HTTP latency (all endpoints) |
| `jvm_memory_used_bytes{area="heap"}` | Gauge | JVM heap usage |
| `jvm_memory_used_bytes{area="nonheap"}` | Gauge | Metaspace + code cache |
| `jvm_gc_pause_seconds_sum` | Counter | Total time spent in GC pauses |
| `hikaricp_connections_active` | Gauge | DB connections in use |
| `hikaricp_connections_pending` | Gauge | Goroutines waiting for connection |
| `jvm_threads_live_threads` | Gauge | Live JVM threads count |
| `process_cpu_usage` | Gauge | CPU usage rate (0.0-1.0) |

**PromQL Used for Java:**

```promql
# P99 Latency
histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket[1m])) by (le, instance))

# Throughput (requests per second)
sum(rate(http_server_requests_seconds_count[1m])) by (instance)

# CPU Usage
process_cpu_usage

# Error Rate (5xx)
sum(rate(http_server_requests_seconds_count{status=~"5.*"}[1m])) by (instance)
```

---

### 6. Spring Cache Abstraction

**What:** Transparent caching via AOP. Any method annotated with `@Cacheable` is intercepted.

**Where:** `ProductService.java:46`

```java
@Cacheable(value = "products", key = "#id")
public Product getProductById(UUID id){
    return productRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Product not found"));
}
```

**Cache Providers (from least to most capable):**

1. `ConcurrentMapCacheManager` — default, in-memory, no eviction, no TTL
2. Caffeine Cache — in-memory, configurable TTL, LRU eviction
3. Redis — distributed, cross-pod cache
4. Hazelcast — distributed, in-memory grid

**What This Project Uses:** Default `ConcurrentMapCacheManager` — a `ConcurrentHashMap` in JVM heap. **No TTL, no eviction** — cache grows without bound until JVM restart.

**Limitation:** In a multi-instance deployment, each JVM has its own cache copy. Cache invalidation across instances requires a distributed cache (Redis).

---

### 7. Transaction Management

**What:** Spring manages DB transactions declaratively.

**Where:** `OrderService.java:36`, `ProductService.java:52`

```java
@Transactional
public Order placeOrder(OrderRequest request, UUID userId){
    // Spring proxy wraps this in:
    // BEGIN TRANSACTION
    // ... execute method ...
    // COMMIT (on success)
    // ROLLBACK (on RuntimeException)
}
```

**Transaction Propagation:** Default is `REQUIRED` — if a transaction already exists, join it; otherwise start new.

**Rollback Rules:** By default:

- `RuntimeException` (unchecked) → ROLLBACK
- `Exception` (checked) → **NO ROLLBACK** (would need `@Transactional(rollbackFor = Exception.class)`)

**This Project's Limitation:** If `orderRepository.save()` fails and rolls back, the stock deduction already sent via Feign to the warehouse service **is NOT rolled back**. The warehouse has less stock but no order exists. This is a **saga pattern** failure — the project doesn't implement compensating transactions.

---

### 8. Bean Lifecycle

Spring Boot bean creation order for order-service:

1. `DataSource` (HikariCP pool) — auto-configured from `spring.datasource.*`
2. `EntityManagerFactory` — JPA setup with Hibernate
3. `TransactionManager` — manages `@Transactional` boundaries
4. `JpaRepositories` — Spring Data proxy implementations
5. `FeignClients` — dynamic proxies for `InventoryClient`, `WarehouseClient`, etc.
6. `OrderService` — injected with all above via constructor
7. `OrderController` — injected with `OrderService`
8. `DispatcherServlet` — ready to receive requests
9. Embedded Tomcat starts, HTTP port binds

---

### 9. Lombok

**What:** Annotation processor that generates boilerplate Java code at compile time.

**Where:** Every entity, DTO, service class

| Annotation | Generated Code |
| ----------- | --------------- |
| `@Getter` | `getX()` for every field |
| `@Setter` | `setX()` for every field |
| `@NoArgsConstructor` | `ClassName(){}` |
| `@AllArgsConstructor` | `ClassName(field1, field2, ...)` |
| `@Builder` | `ClassName.builder().field1(v).build()` |
| `@RequiredArgsConstructor` | Constructor with all `final` fields |
| `@Data` | `@Getter` + `@Setter` + `@ToString` + `@EqualsAndHashCode` |
| `@Slf4j` | `private static final Logger log = LoggerFactory.getLogger(...)` |

**Compile Time Magic:** Lombok's annotation processor runs during `javac`. The generated code appears in the `.class` file but not in the source `.java` file. IntelliJ needs the Lombok plugin to understand it.

---

### 10. @EnableFeignClients and Auto-Configuration

**What:** Enables Spring Boot to scan classpath for `@FeignClient` interfaces.

**Where:** `OrderServiceApplication.java:8`

```java
@SpringBootApplication
@EnableFeignClients  // Without this, no Feign proxy beans are created
public class OrderServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderServiceApplication.class, args);
    }
}
```

**`@SpringBootApplication` = 3 annotations combined:**

1. `@SpringBootConfiguration` — marks as configuration class
2. `@EnableAutoConfiguration` — triggers auto-configuration based on classpath
3. `@ComponentScan` — scans current package and sub-packages for `@Component`, `@Service`, etc.

---

## Spring Concepts Comparison Table

| Spring Concept | Used in Project | Alternative | Project's Choice Rationale |
| --------------- | ---------------- | ------------- | --------------------------- |
| Web Layer | Spring MVC (blocking) | Spring WebFlux (reactive) | Simpler, mirrors traditional Java style for benchmarking comparison |
| ORM | Spring Data JPA / Hibernate | JDBC Template, jOOQ, MyBatis | JPA provides the most automated ORM for maximum parity with GORM |
| HTTP Client | OpenFeign | RestTemplate, WebClient | Declarative interfaces are cleaner and match the project's style |
| Metrics | Micrometer | Dropwizard Metrics | Micrometer is Spring Boot's native metrics facade |
| Caching | Spring Cache (default) | Caffeine, Redis | Simple in-memory cache sufficient for benchmark comparison with Go's RWMutex cache |
| Transaction | `@Transactional` | Programmatic `TransactionTemplate` | Declarative annotation style is cleaner |

```text
