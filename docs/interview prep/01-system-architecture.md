# 01 — System Architecture

---

## Full System Architecture Diagram

```mermaid
graph TB
    subgraph BenchmarkClients["🔥 Benchmark Clients (K6)"]
        K6_ORDER["k6 order_benchmark.js<br/>POST /orders — 200 VUs"]
        K6_INV["k6 inventory_benchmark.js<br/>GET /products/{id} — 200 VUs"]
    end

    subgraph SSPNet["Docker Network: ssp-net"]
        subgraph ControlGroup["☕ Control Group — Java Spring Boot"]
            INV_JAVA["inventory-java<br/>:8082<br/>Spring Boot + Hibernate<br/>+ Spring Cache"]
            ORDER_JAVA["order-java<br/>:8083<br/>Spring Boot + Feign<br/>+ Micrometer"]
        end

        subgraph TestGroup["🐹 Test Group — Go Gin Twins"]
            INV_GO["inventory-go-twin<br/>:9082<br/>Gin + GORM<br/>+ RWMutex Cache"]
            ORDER_GO["order-go-twin<br/>:9083<br/>Gin + GORM<br/>+ net/http pool"]
        end

        subgraph SharedServices["⚙️ Shared Go Services"]
            WH_GO["warehouse-go<br/>:8084<br/>Gin + GORM<br/>Haversine Routing"]
            WH_JAVA_TWIN["warehouse-java-twin<br/>:9084<br/>Spring Boot<br/>Haversine Routing"]
            DELIVERY["delivery-service<br/>:8085<br/>Gin + GORM"]
            NOTIFY["notification-service<br/>:8086<br/>Gin + GORM"]
        end

        subgraph ObsStack["📊 Observability Stack"]
            PROM["Prometheus<br/>:9090<br/>scrape_interval: 5s"]
            GRAFANA["Grafana<br/>:3000<br/>9-Panel Dashboard"]
        end

        subgraph DBLayer["🗄️ PostgreSQL Databases"]
            DB_INV["inventory_db<br/>(products, global_inventory)"]
            DB_ORD["order_db<br/>(orders, order_items)"]
            DB_WH["warehouse_db<br/>(warehouses, warehouse_stock)"]
            DB_DEL["delivery_db<br/>(shipments)"]
            DB_NOT["notification_db<br/>(notifications)"]
        end
    end

    subgraph ExportPipeline["💾 Data Export Pipeline"]
        PY["export_metrics_v2.py<br/>Python 3"]
        CSV["metrics_master.csv<br/>by_metric/*.csv<br/>37,692 data points"]
    end

    K6_ORDER -->|"POST :8083 or :9083"| ORDER_JAVA
    K6_ORDER -->|"POST :9083"| ORDER_GO
    K6_INV -->|"GET :8082/{id}"| INV_JAVA
    K6_INV -->|"GET :9082/{id}"| INV_GO

    ORDER_JAVA -->|"Feign GET /products/{id}"| INV_JAVA
    ORDER_JAVA -->|"Feign GET /stock/{id}"| WH_GO
    ORDER_JAVA -->|"Feign POST /warehouses/{id}/stock"| WH_GO
    ORDER_JAVA -->|"async Thread"| NOTIFY

    ORDER_GO -->|"http.Client GET /products/{id}"| INV_GO
    ORDER_GO -->|"http.Client GET /stock/{id}"| WH_JAVA_TWIN
    ORDER_GO -->|"http.Client POST /warehouses/{id}/stock"| WH_JAVA_TWIN
    ORDER_GO -->|"goroutine"| NOTIFY

    WH_GO -->|"sync PUT /products/{id}/sync-stock"| INV_JAVA
    WH_JAVA_TWIN -->|"sync PUT /products/{id}/sync-stock"| INV_GO

    INV_JAVA --- DB_INV
    ORDER_JAVA --- DB_ORD
    INV_GO --- DB_INV
    ORDER_GO --- DB_ORD
    WH_GO --- DB_WH
    WH_JAVA_TWIN --- DB_WH
    DELIVERY --- DB_DEL
    NOTIFY --- DB_NOT

    PROM -->|"scrape /actuator/prometheus"| INV_JAVA
    PROM -->|"scrape /actuator/prometheus"| ORDER_JAVA
    PROM -->|"scrape /actuator/prometheus"| WH_JAVA_TWIN
    PROM -->|"scrape /metrics"| INV_GO
    PROM -->|"scrape /metrics"| ORDER_GO
    PROM -->|"scrape /metrics"| WH_GO

    GRAFANA -->|"PromQL queries"| PROM
    PY -->|"Prometheus range API"| PROM
    PY --> CSV
```

---

## Service Dependency Diagram

```mermaid
graph LR
    subgraph WritePath["Write Path — POST /orders"]
        OJ[order-java / order-go-twin]
        IJ[inventory-java / inventory-go-twin]
        WG[warehouse-go / warehouse-java-twin]
        NS[notification-service]
        DS[delivery-service]

        OJ -->|"\1. GET product price"| IJ
        OJ -->|"\2. GET stock locations"| WG
        OJ -->|"\3. POST deduct stock"| WG
        WG -->|"\4. PUT sync global stock"| IJ
        OJ -.->|"\5. async notification"| NS
        OJ -.->|"\6. on SHIPPED only"| DS
    end
```

---

## Deployment Diagram (docker-compose.ssp.yml)

```mermaid
graph TB
    subgraph HostMachine["Host Machine (Linux)"]
        subgraph DockerBridge["Docker Bridge Network: ssp-net"]
            subgraph JavaGroup["Java Control Group"]
                IJ["ssp-inventory-java<br/>Image: inventory-service<br/>Port: 8082:8082<br/>CPU: 1.0 | RAM: 768M"]
                OJ["ssp-order-java<br/>Image: order-service<br/>Port: 8083:8083<br/>CPU: 1.0 | RAM: 768M"]
                WJT["ssp-warehouse-java-twin<br/>Image: warehouse-twin<br/>Port: 9084:9084<br/>CPU: 1.0 | RAM: 768M"]
            end
            subgraph GoGroup["Go Test Group"]
                IGT["ssp-inventory-go-twin<br/>Image: inventory-twin<br/>Port: 9082:9082<br/>CPU: 1.0 | RAM: 768M"]
                OGT["ssp-order-go-twin<br/>Image: order-twin<br/>Port: 9083:9083<br/>CPU: 1.0 | RAM: 768M"]
                WG["ssp-warehouse-go<br/>Image: warehouse-service<br/>Port: 8084:8084<br/>CPU: 1.0 | RAM: 768M"]
            end
            subgraph Observability["Observability"]
                PROM["ssp-prometheus<br/>prom/prometheus:latest<br/>Port: 9090:9090<br/>Retention: 15d"]
                GRAFANA["ssp-grafana<br/>grafana/grafana:latest<br/>Port: 3000:3000"]
            end
        end
        K6["K6 (host process)<br/>load-tests/*.js"]
        PY["Python exporter<br/>export_metrics_v2.py"]
    end

    K6 -->|"localhost:8082-8083, 9082-9083"| DockerBridge
    PY -->|"localhost:9090"| PROM
```

---

## Service Catalog

### inventory-java (Spring Boot)

| Property | Value |
| ---------- | ------- |
| **Port** | 8082 |
| **Runtime** | Java 21 / Spring Boot 4.0.2 |
| **Framework** | Spring MVC (Tomcat) |
| **Database** | inventory_db (PostgreSQL) |
| **ORM** | Spring Data JPA / Hibernate |
| **Metrics** | `/actuator/prometheus` (Micrometer) |
| **Caching** | Spring `@Cacheable` (in-memory, ConcurrentHashMap) |
| **APIs** | `GET /products`, `GET /products/{id}`, `POST /products`, `PUT /products/{id}/sync-stock` |
| **Key Feature** | `@Cacheable(value="products", key="#id")` on `getProductById()` |

### order-java (Spring Boot)

| Property | Value |
| ---------- | ------- |
| **Port** | 8083 |
| **Runtime** | Java 21 / Spring Boot 4.0.2 |
| **Framework** | Spring MVC (Tomcat) |
| **Database** | order_db (PostgreSQL), HikariCP |
| **ORM** | Spring Data JPA / Hibernate |
| **HTTP Client** | OpenFeign (declarative interfaces) |
| **Metrics** | `/actuator/prometheus` (Micrometer) |
| **APIs** | `POST /orders`, `GET /orders`, `GET /orders/all`, `PUT /orders/{id}/status` |
| **Key Feature** | Haversine warehouse routing, async notification via `new Thread()` |

### inventory-go-twin (Go Gin)

| Property | Value |
| ---------- | ------- |
| **Port** | 9082 |
| **Runtime** | Go 1.22+ |
| **Framework** | Gin Gonic |
| **Database** | inventory_db (PostgreSQL, same DB as Java!) |
| **ORM** | GORM |
| **Metrics** | `/metrics` (go-gin-prometheus + prometheus/client_golang) |
| **Caching** | `sync.RWMutex` over `map[string]models.Product` |
| **APIs** | Identical to inventory-java |
| **Key Feature** | Thread-safe read-through cache with RLock/RUnlock for reads, Lock/Unlock for writes |

### order-go-twin (Go Gin)

| Property | Value |
| ---------- | ------- |
| **Port** | 9083 |
| **Runtime** | Go 1.22+ |
| **Framework** | Gin Gonic |
| **Database** | order_db (PostgreSQL, same DB as Java!) |
| **ORM** | GORM |
| **HTTP Client** | `net/http` shared transport pool (MaxIdleConnsPerHost=50) |
| **Metrics** | `/metrics` (go-gin-prometheus + prometheus/client_golang) |
| **APIs** | Identical to order-java |
| **Key Feature** | Goroutine-based async notifications, GORM explicit transactions |

### warehouse-go (Go Gin) — Shared Service

| Property | Value |
| ---------- | ------- |
| **Port** | 8084 |
| **Runtime** | Go 1.22+ |
| **Database** | warehouse_db (warehouses, warehouse_stock) |
| **Key Feature** | Haversine distance JOIN, cross-service sync to inventory |
| **Used By** | order-java (Control Group) |

### warehouse-java-twin (Spring Boot) — Shared Service

| Property | Value |
| ---------- | ------- |
| **Port** | 9084 |
| **Runtime** | Java 21 / Spring Boot |
| **Key Feature** | Same Haversine routing, syncs to inventory-go-twin |
| **Used By** | order-go-twin (Test Group) |

### delivery-service (Go Gin) — Shared

| Property | Value |
|----------|-------|
| **Port** | 8085 |
| **Key Feature** | Creates shipment record + tracking number on `SHIPPED` status transition |

### notification-service (Go Gin) — Shared

| Property | Value |
|----------|-------|
| **Port** | 8086 |
| **Key Feature** | Logs notification events (ORDER_CONFIRMED, ORDER_SHIPPED) to notification_db |

---

## Network Communication Diagram

```mermaid
sequenceDiagram
    participant K6
    participant OrderSvc as order-java / order-go-twin
    participant InvSvc as inventory-java / inventory-go-twin
    participant WhSvc as warehouse-go / warehouse-java-twin
    participant NotifSvc as notification-service

    K6->>+OrderSvc: POST /orders {items, address, lat, lng}
    OrderSvc->>+InvSvc: GET /products/{id} [per item]
    InvSvc-->>-OrderSvc: {price, name, sku}
    OrderSvc->>+WhSvc: GET /stock/{productId}
    WhSvc-->>-OrderSvc: [{warehouse_id, name, lat, lng, quantity}]
    Note over OrderSvc: Haversine sort → nearest warehouse
    OrderSvc->>+WhSvc: POST /warehouses/{id}/stock {product_id, quantity: -N}
    WhSvc->>InvSvc: PUT /products/{id}/sync-stock (sync cross-service)
    WhSvc-->>-OrderSvc: {current_quantity, global_quantity}
    OrderSvc->>OrderSvc: Save Order + Items (DB transaction)
    OrderSvc-->>K6: 201 Created {orderId, status: CONFIRMED}
    OrderSvc--)NotifSvc: goroutine/Thread: POST /notifications
```

---

## Resource Equalization Summary

| Parameter | Java (HikariCP) | Go (database/sql) | Source |
| ----------- | ---------------- | ------------------- | -------- |
| Max DB connections | 50 (default HikariCP) | `SetMaxOpenConns(50)` | `db.go:29` |
| Idle DB connections | 10 (HikariCP default) | `SetMaxIdleConns(10)` | `db.go:30` |
| Connection lifetime | 30 min (HikariCP) | `SetConnMaxLifetime(30*time.Minute)` | `db.go:31` |
| Max HTTP idle conns/host | Feign default ~50 | `MaxIdleConnsPerHost: 50` | `httpclient.go:16` |
| HTTP idle timeout | 30s (default) | `IdleConnTimeout: 30*time.Second` | `httpclient.go:17` |
| Docker CPU limit | 1.0 | 1.0 | `docker-compose.ssp.yml:23-24` |
| Docker memory limit | 768M | 768M | `docker-compose.ssp.yml:25` |


