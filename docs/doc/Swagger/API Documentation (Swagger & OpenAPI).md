**Tags:** #swagger #openapi #documentation #springboot #microservices **Date:** [[2026-03-19]]

---

## 📖 Swagger & OpenAPI Implementation

The Smart Order Fulfillment System uses **SpringDoc OpenAPI** to automatically generate API documentation and an interactive **Swagger UI** for testing endpoints directly from the browser. 

Currently, Swagger is implemented for all microservices in the system:
- **Auth Service** (Spring Boot) - Port 8081
- **Order Service** (Spring Boot) - Port 8083
- **Warehouse Service** (Go/Gin) - Port 8084
- **Delivery Service** (Go/Gin) - Port 8085
- **Notification Service** (Go/Gin) - Port 8086

---

## 1. Dependency Integration

### Spring Boot Services
Both Spring Boot services utilize the `springdoc-openapi-starter-webmvc-ui` dependency.
```xml
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.3.0</version>
</dependency>
```

### Go Services
Go services use `swaggo/swag` for generating OpenAPI specs and `swaggo/gin-swagger` for serving the UI.
```go
import (
    _ "github.com/<module>/docs" 
    swaggerFiles "github.com/swaggo/files"
    ginSwagger "github.com/swaggo/gin-swagger"
)
```

---

## 2. Java Service Implementations (Auth & Order)

### Auth Service (Port 8081)
- **OpenAPI Config**: Includes `bearerAuth` security scheme for JWT testing.
- **Security Config**: Explicitly permits `/v3/api-docs/**` and `/swagger-ui/**`.

### Order Service (Port 8083)
- **OpenAPI Config**: Basic info config for documenting order orchestration endpoints.

---

## 3. Go Service Implementations (Warehouse, Delivery, Notification)

All Go services share a similar implementation pattern:
1. **Declarative Annotations**: Handlers are decorated with `@Summary`, `@Description`, `@Tags`, and `@Router`.
2. **Spec Generation**: `swag init` generates the `docs/` folder containing `swagger.json`.
3. **UI Routing**: Gin routes are added to serve the UI at `/swagger/*any`.

### Warehouse Service (Port 8084)
- Includes `@securityDefinitions.apikey BearerAuth` to support `X-User-Role` header testing for secured routes like `/stock`.

---

## 🛠️ Testing via Swagger UI

| Service | Swagger UI URL |
|---------|----------------|
| **Auth** | http://localhost:8081/swagger-ui/index.html |
| **Order** | http://localhost:8083/swagger-ui/index.html |
| **Warehouse** | http://localhost:8084/swagger/index.html |
| **Delivery** | http://localhost:8085/swagger/index.html |
| **Notification** | http://localhost:8086/swagger/index.html |

### Authenticated Testing
- **Auth Service**: Use the **Authorize** button and paste your JWT.
- **Warehouse Service**: Use the **Authorize** button to provide the `X-User-Role` (e.g., `ADMIN`) for restricted endpoints.
