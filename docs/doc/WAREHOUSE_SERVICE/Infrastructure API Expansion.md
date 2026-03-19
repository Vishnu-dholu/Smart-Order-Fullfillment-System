**Tags:** #go #gin #gorm #rest-api 
**Project:** Smart Order Fulfillment (SSP / SPE)

## 1. REST API Expansion

To support the dynamic dropdown menus in the React `WarehouseDashboard`, the service required a new endpoint to list available facilities.

- **Endpoint Implemented:** `GET /warehouses`
    
- **Handler Logic:** Utilizes the GORM `Find(&warehouses)` method to retrieve all records from the `warehouses` table. This provides the frontend with the `warehouse_id` (UUID) and `name` necessary to construct the payload for receiving stock.
    

## 2. Cross-Origin Resource Sharing (CORS) Security

Strict CORS policies were established in `main.go` to facilitate secure communication between the Vite dev server (`localhost:5173`) and the Gin backend (`localhost:8084`).

- **Configuration:** Implemented via `github.com/gin-contrib/cors`.
    
- **Required Headers:** Explicitly whitelisted custom headers critical to the microservice architecture: `X-User-Id` and `X-User-Role`.
    
- **Credentials:** `AllowCredentials` set to `true` to accept requests containing authorization data.
    

## 3. Request Interception & Role Validation

The system relies on custom Gin middleware to enforce business logic boundaries.

- **`RequireRole` Middleware:** Prior to executing handlers like `GetAllStock` or `UpdateStock`, this middleware extracts the `X-User-Role` header attached by the Axios frontend.
    
- **Access Matrix:** If the header is absent or does not match `ADMIN` or `WAREHOUSE_MANAGER`, the context is aborted with a `401 Unauthorized` HTTP status, effectively shielding the database from unauthorized manipulation.