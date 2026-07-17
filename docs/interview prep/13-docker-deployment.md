# 13 — Docker Deployment

> **File:** `docker-compose.ssp.yml` | **Infra:** Docker Bridge Network `ssp-net`

---

## Deployment Architecture Diagram

```mermaid
graph TB
    subgraph Host["Host Machine — Linux"]
        K6["K6 Load Generator\n(host process)"]
        PY["export_metrics_v2.py\n(host process)"]
        
        subgraph NET["Docker Bridge Network: ssp-net"]
            subgraph JAVA["Java Control Group"]
                IJ["ssp-inventory-java\n:8082\ncpus:1.0 mem:768M"]
                OJ["ssp-order-java\n:8083\ncpus:1.0 mem:768M"]
                WJT["ssp-warehouse-java-twin\n:9084\ncpus:1.0 mem:768M"]
            end
            
            subgraph GO["Go Test Group"]
                IGT["ssp-inventory-go-twin\n:9082\ncpus:1.0 mem:768M"]
                OGT["ssp-order-go-twin\n:9083\ncpus:1.0 mem:768M"]
                WG["ssp-warehouse-go\n:8084\ncpus:1.0 mem:768M"]
            end
            
            subgraph OBS["Observability"]
                PROM["ssp-prometheus\n:9090\nRetention: 15d"]
                GF["ssp-grafana\n:3000"]
            end
            
            subgraph DB["Database Layer"]
                PG["ssp-postgres\n:5432\nPostgreSQL 15"]
            end
        end
    end

    K6 -->|"HTTP localhost:8082-8083\n9082-9083"| NET
    PY -->|"HTTP localhost:9090"| PROM
    PROM -->|"scrape /actuator/prometheus every 5s"| JAVA
    PROM -->|"scrape /metrics every 5s"| GO
    GF -->|"PromQL"| PROM
    JAVA --> PG
    GO --> PG
```

---

## Docker Compose File Analysis

**File:** `docker-compose.ssp.yml`

### Network Configuration

```yaml
networks:
  ssp-net:
    driver: bridge
```

**Why bridge network?**

- All containers share the same virtual network and can resolve each other by container name
- Docker's embedded DNS resolves `postgres-db`, `inventory-java`, `warehouse-go`, etc.
- Prevents port conflicts with other Docker projects on the host
- Isolates benchmark traffic — external clients cannot reach services without explicit port mapping

### PostgreSQL Database Container

```yaml
services:
  postgres-db:
    image: postgres:15-alpine
    container_name: ssp-postgres
    environment:
      POSTGRES_USER: deku
      POSTGRES_PASSWORD: password  # ⚠️ hardcoded — dev only
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker-entrypoint-initdb.d:/docker-entrypoint-initdb.d
    networks:
      - ssp-net
```

**Key points:**

- `postgres:15-alpine` — Alpine base keeps image small (~75MB vs 350MB for debian)
- `pgdata` named volume persists DB across container restarts
- `docker-entrypoint-initdb.d/` contains init scripts that create all 6 databases at first boot
- `sslmode=require` used in `application.properties` for Neon cloud DB but not for local Docker

### Java Service Container Pattern

```yaml
inventory-java:
  image: smartfulfillment/inventory-service:latest
  container_name: ssp-inventory-java
  ports:
    - "8082:8082"
  environment:
    - SPRING_DATASOURCE_URL=jdbc:postgresql://postgres-db:5432/inventory_db
    - SPRING_DATASOURCE_USERNAME=deku
    - SPRING_DATASOURCE_PASSWORD=password
    - INVENTORY_SERVICE_URL=http://inventory-java:8082
    - WAREHOUSE_SERVICE_URL=http://warehouse-go:8084
  deploy:
    resources:
      limits:
        cpus: '1.0'      # Hard CPU cap — prevents Go from appearing faster just by using more cores
        memory: 768M     # Hard RAM cap — forces JVM heap tuning
  depends_on:
    - postgres-db
  networks:
    - ssp-net
```

### Go Service Container Pattern

```yaml
order-go-twin:
  image: smartfulfillment/order-twin:latest
  container_name: ssp-order-go-twin
  ports:
    - "9083:9083"
  environment:
    - DB_URL=postgres://deku:password@postgres-db:5432/order_db?sslmode=disable
    - PORT=9083
    - INVENTORY_SERVICE_URL=http://inventory-go-twin:9082
    - WAREHOUSE_SERVICE_URL=http://warehouse-java-twin:9084
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 768M
  depends_on:
    - postgres-db
  networks:
    - ssp-net
```

**Cross-stack routing design:**

- `order-java` → calls `warehouse-go` (not warehouse-java-twin) for stock
- `order-go-twin` → calls `warehouse-java-twin` (not warehouse-go)
- This ensures neither stack benefits from same-language affinity in service calls

### Prometheus Container

```yaml
prometheus:
  image: prom/prometheus:latest
  container_name: ssp-prometheus
  ports:
    - "9090:9090"
  volumes:
    - ./observability/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus_data:/prometheus
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.retention.time=15d'
    - '--storage.tsdb.path=/prometheus'
  networks:
    - ssp-net
```

- `15d` retention — keeps 15 days of metrics; sufficient for multiple benchmark runs
- Config is volume-mounted (not baked into image) — allows changing scrape targets without rebuild
- Prometheus scrapes by container name: `inventory-java:8082`, `order-go-twin:9083`, etc.

### Grafana Container

```yaml
grafana:
  image: grafana/grafana:latest
  container_name: ssp-grafana
  ports:
    - "3000:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin  # ⚠️ hardcoded — dev only
  volumes:
    - ./observability/grafana/provisioning:/etc/grafana/provisioning
    - grafana_data:/var/lib/grafana
  networks:
    - ssp-net
```

- `provisioning/` folder contains datasource YAML (pointing to Prometheus) and dashboard JSON (9-panel benchmark dashboard) — zero-click setup
- Grafana persists dashboards in `grafana_data` volume

---

## Dockerfile Deep Dives

### Java Order Service — Multi-Stage Build

```dockerfile
# Stage 1: Maven build
FROM maven:3.9-eclipse-temurin-21-alpine AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B    # Cache deps in separate layer
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Minimal JRE runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/order-service-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8083
ENTRYPOINT ["java", \
  "-XX:MaxRAMPercentage=70.0", \   # Use max 70% of container RAM for heap
  "-XX:+UseG1GC", \                # Explicitly select G1GC
  "-jar", "app.jar"]
```

**`-XX:MaxRAMPercentage=70.0`:**
Without this flag, the JVM reads host RAM (e.g., 16GB) for its heap sizing heuristic, not the container limit (768MB). With `MaxRAMPercentage=70.0`, heap max = 768MB × 0.70 = ~537MB, leaving ~231MB for Metaspace, stack, and native memory.

### Go Order Twin — Multi-Stage Build

```dockerfile
# Stage 1: Build binary
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download                          # Cache module downloads
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \                       # Strip debug symbols — smaller binary
    -o order-twin ./cmd/main.go

# Stage 2: Minimal scratch runtime
FROM alpine:latest
RUN apk --no-cache add ca-certificates      # Needed for HTTPS calls
WORKDIR /root/
COPY --from=builder /app/order-twin .
EXPOSE 9083
CMD ["./order-twin"]
```

**`CGO_ENABLED=0`:** Disables CGo — produces a fully static binary. No dynamic library dependencies. Can run in a `scratch` or `alpine` container without glibc.

**`-ldflags="-s -w"`:** Strips debug symbols and DWARF info — reduces binary size by ~30%.

---

## Resource Limits — Fairness Design

| Parameter | Java | Go | Why Equal? |
| ----------- | ------ | ---- | ----------- |
| CPU limit | `cpus: '1.0'` | `cpus: '1.0'` | Equal CPU prevents Go from exploiting more cores |
| Memory limit | `memory: 768M` | `memory: 768M` | Forces comparable GC pressure |
| DB pool size | 50 connections | 50 connections | Eliminates connection pool advantage |
| HTTP client pool | ~50 (Feign default) | `MaxIdleConnsPerHost: 50` | Eliminates TCP reuse advantage |

**Interview Q: Why 768MB?**
→ Enough for JVM startup (~300MB baseline for Spring Boot) plus heap headroom for load testing, without exhausting the host machine when running 6 microservices simultaneously.

---

## Docker Networking Deep Dive

### Service Discovery Flow

```text
order-java container needs to call inventory-java:

1. order-java executes: GET http://inventory-java:8082/products/uuid
2. OS inside container sends DNS query to 127.0.0.11:53
3. Docker's embedded DNS server resolves "inventory-java" → container IP (e.g., 172.20.0.5)
4. HTTP request sent to 172.20.0.5:8082
5. inventory-java container receives request
```

### Port Mapping

```text
External (Host)     Internal (Docker)    Container
localhost:8082  →  172.20.0.5:8082  →  ssp-inventory-java
localhost:8083  →  172.20.0.6:8083  →  ssp-order-java
localhost:9082  →  172.20.0.7:9082  →  ssp-inventory-go-twin
localhost:9083  →  172.20.0.8:9083  →  ssp-order-go-twin
localhost:9090  →  172.20.0.9:9090  →  ssp-prometheus
localhost:3000  →  172.20.0.10:3000 →  ssp-grafana
```

K6 runs on the **host**, so it sends requests to `localhost:8083` and `localhost:9083`. These are mapped by Docker iptables NAT rules to the container's internal IP.

---

## Deployment Flow

```bash
# 1. Pull/Build images
docker build -t smartfulfillment/order-service:latest services/spring/order-service/
docker build -t smartfulfillment/order-twin:latest services/go/order-twin/

# 2. Start complete stack
docker compose -f docker-compose.ssp.yml up -d

# 3. Verify all services are healthy
docker compose -f docker-compose.ssp.yml ps

# 4. Run benchmarks (K6 on host, targeting container ports)
cd load-tests && ./run-benchmarks.sh

# 5. Access Grafana dashboard
# Open http://localhost:3000 → Login admin/admin

# 6. Export metrics
python3 export_metrics_v2.py --output results/

# 7. Teardown
docker compose -f docker-compose.ssp.yml down -v  # -v removes volumes (fresh next run)
```

---

## Interview Questions — Docker Deployment

**Easy:**

1. **What is the difference between `docker run` and `docker compose up`?**
   → `docker run` starts a single container. `docker compose up` orchestrates multi-container setups defined in a YAML file, managing networks, volumes, and dependencies.

2. **What does `depends_on` do in Docker Compose?**
   → Ensures the specified container starts before the dependent one. Note: it waits for the container to start, NOT for the service inside to be ready. Production use requires health checks.

3. **What is a Docker volume?**
   → Persistent storage managed by Docker, outside the container filesystem. Data in volumes survives container restarts and rebuilds.

**Medium:**
4. **Why use multi-stage builds for both Java and Go?**
   → Stage 1 contains full build toolchain (Maven + JDK 350MB, or Go SDK 300MB). Stage 2 is minimal runtime only. Final image size: Java ~200MB JRE image vs ~700MB if build tools were included. Go binary in Alpine: ~20MB.

1. **How does `-XX:MaxRAMPercentage=70.0` prevent OOM kills?**
   → Without it, JVM reads `/proc/meminfo` (host RAM, e.g., 16GB) and sets heap to 25% = 4GB. Container limit is 768MB. When heap exceeds 768MB, the Linux OOM killer terminates the container. With the flag, heap = 537MB — safely within limits.

2. **What is `CGO_ENABLED=0` and why is it used?**
   → Disables CGo (Go's C interop), producing a statically linked binary with no runtime dependencies on C libraries. This allows the binary to run in minimal Alpine containers without glibc.

**Hard:**
7. **If two containers share the same Docker bridge network, can they see each other's internal ports without mapping?**
   → Yes. Containers on the same bridge network can communicate on any port using container names as hostnames. Port mapping (`-p 8082:8082`) is only needed for access FROM the host machine.

1. **What happens when a container hits its memory limit?**
   → The Linux kernel's cgroup memory controller triggers the OOM killer, which kills the container process (PID 1). Docker marks the container as exited. With `restart: unless-stopped`, it would restart. This is why correct JVM heap sizing is critical.

2. **How does GOMAXPROCS interact with `cpus: 1.0`?**

```mermaid
