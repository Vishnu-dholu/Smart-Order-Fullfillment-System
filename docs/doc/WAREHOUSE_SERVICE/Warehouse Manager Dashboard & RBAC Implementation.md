## 1. Overview

The Warehouse Manager Dashboard (`/warehouse/inventory`) is a secure, role-restricted interface designed for local operations staff. It provides a real-time, aggregated view of global inventory distribution, including physical coordinates and stock health metrics, by consuming data from the Go-based `warehouse-service`.

## 2. Security & Role-Based Access Control (RBAC)

To ensure strict security, authorization is enforced at both the client (React) and server (Go) levels.

### Frontend Security (React)

1. **Token Decoding:** Upon login, `AuthContext` decodes the Spring Boot-generated JWT using `jwt-decode` to extract the user's role.
    
2. **Persistence:** The `userRole` is explicitly saved to `localStorage` alongside the token and user ID.
    
3. **Interceptor Injection:** The `axiosConfig.ts` interceptor automatically attaches the `X-User-Role` header to every outgoing request to the `warehouseApi`.
    
4. **Route Protection:** The React Router uses a `<ProtectedRoute>` wrapper to block non-managers from even mounting the dashboard component.
    

### Backend Security (Go / Gin)

1. **Custom Middleware:** A `RequireRole` middleware function intercepts incoming HTTP requests.
    
2. **Validation:** It reads the `X-User-Role` header. If the header is missing, or if the value is not `WAREHOUSE_MANAGER` or `ADMIN`, the middleware instantly aborts the request and returns a `401 Unauthorized` or `403 Forbidden` status.
    

## 3. Cross-Origin Resource Sharing (CORS) Configuration

Because the React frontend (`localhost:5173`) and Go backend (`localhost:8084`) operate on different ports, strict CORS policies were configured in the Go `main.go` file using `github.com/gin-contrib/cors`.

**Key Configurations:**

- `AllowOrigins`: Strictly limited to the React app URL.
    
- `AllowHeaders`: Explicitly whitelisted custom headers (`X-User-Id`, `X-User-Role`, `Authorization`).
    
- `AllowCredentials: true`: Crucial for allowing Axios to send the authorized request payload (`withCredentials: true`).
    

## 4. Backend Data Aggregation (Go / GORM)

The backend must combine data from two separate PostgreSQL tables (`warehouses` and `warehouse_stock`) to provide a complete picture for the frontend.

- **The DTO:** A `StockResponse` struct was created with explicit `gorm` tags to map database columns directly to the JSON structure expected by React (e.g., mapping the `BIGINT` quantity to `int64`).
    
- **The Query:** The `GetAllStock` handler utilizes GORM to execute a `LEFT JOIN`:
```sql
SELECT warehouse_stock.warehouse_id, warehouses.name as warehouse_name, 
       warehouses.location, warehouse_stock.product_id, 
       warehouse_stock.quantity, warehouses.latitude, warehouses.longitude
FROM warehouse_stock
LEFT JOIN warehouses ON warehouses.warehouse_id = warehouse_stock.warehouse_id
```

## 5. Frontend UI Implementation

The UI is divided into two primary sections:

1. **KPI Summary Cards:** Calculates totals directly from the fetched array:
    
    - _Total Global Stock:_ Sum of all quantities.
        
    - _Low Stock Alerts:_ Count of items where `0 < quantity < 10`.
        
    - _Out of Stock:_ Count of items where `quantity === 0`.
        
2. **Data Table:** Iterates through the inventory array, displaying warehouse names, geographical coordinates, product IDs, and dynamic status badges based on stock levels.