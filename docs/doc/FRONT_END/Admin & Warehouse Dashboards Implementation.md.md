
**Tags:** #react #rbac #state-management #axios #ux 
**Project:** Smart Order Fulfillment (SSP / SPE)

## 1. Role-Based Access Control (RBAC) & Routing

The application utilizes a strict Role-Based Access Control mechanism enforced at the routing level.

- **Token Decoding:** The `jwt-decode` library parses the JWT issued by the Spring Boot Auth Service.
    
- **Synchronous State Initialization:** To prevent a race condition where a manual page reload causes an unwarranted redirect to `/login`, the `AuthContext` initializes the user state _synchronously_ inside the `useState` callback. If this was done inside a `useEffect`, the `<ProtectedRoute>` would evaluate the initial `null` state before the effect fires, causing a false-positive rejection.
    
- **Axios Interceptors:** The `axiosConfig.ts` file intercepts every outgoing request. It dynamically injects `Authorization` (Bearer token), `X-User-Id`, and critically, `X-User-Role` headers. This ensures the Go and Java backends can enforce authorization without parsing the JWT on every microservice.
    

## 2. Admin Dashboard (`AdminDashboard.tsx`)

The Admin Control Panel manages the global catalog and physical infrastructure setup.

- **Tabbed Navigation State Persistence:** Implemented `sessionStorage` to maintain the user's active tab (`add-product`, `catalog`, `add-warehouse`) across manual page reloads.
```typescript
const [activeTab, setActiveTab] = useState(() => {
return sessionStorage.getItem('adminActiveTab') || 'add-product';
});
```

-  **Optimized Data Fetching (Caching Strategy):** To prevent excessive API calls to the Java backend, the `fetchProducts` function is gated by a `hasFetchedCatalog` boolean flag. React only executes the network request if the catalog tab is active _and_ the data hasn't been fetched yet in the current session.
    
- **Cache Invalidation:** When the Admin successfully creates a new product via `POST /products`, the `hasFetchedCatalog` state is explicitly set to `false`. This forces a fresh fetch when the app automatically switches back to the catalog tab, ensuring UI consistency with the database.
    

## 3. Warehouse Operations Dashboard (`WarehouseDashboard.tsx`)

Designed for local facility managers to oversee physical inventory and receive incoming shipments.

- **Data Aggregation:** The dashboard aggregates data from two backend services:
    
    - `GET /stock` (Go): Fetches the distribution of physical inventory.
        
    - `GET /products` (Java): Populates the product selection dropdown.
        
    - `GET /warehouses` (Go): Populates the facility selection dropdown.
        
- **Receive Stock Modal:** A slide-in form allowing workers to log incoming inventory. It constructs a payload targeting the `POST /warehouses/:id/stock` Go endpoint, which subsequently triggers an inter-service HTTP call to update the Java global inventory.
    
- **KPI Metrics (Current Lab Implementation):**
    
    - _Total Physical Units:_ Calculated via `reduce()` over the inventory array. Useful for spatial capacity planning.
        
    - _Stockouts:_ Calculated by filtering `quantity === 0`. Acts as an urgent audit trigger.
        
    - _Low Stock Alerts:_ Currently hardcoded to `quantity < 50`. _Architectural Note for Future Revision:_ This must be replaced with a dynamic Reorder Point (ROP) algorithm based on lead time and daily demand variables stored per SKU in the Java database.