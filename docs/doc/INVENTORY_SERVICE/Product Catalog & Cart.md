## 1. Overview

The Product Catalog is the primary landing page for authenticated customers (`/app/products`). It dynamically fetches available inventory from the Spring Boot Inventory Service, calculates real-time stock availability, and allows users to seamlessly add items to a globally managed Shopping Cart.

## 2. Architecture & Data Flow

- **Backend Source:** Java Spring Boot `inventory-service` (Port 8082).
    
- **Data Contract:** `ProductResponse` DTO (combines `products` table and `global_inventory` table data).
    
- **Frontend State Management:** React Context API (`CartContext`).
    
- **UI Components:** `ProductCatalog` (displays grid), `Navbar` (displays cart badge).
    

---

## 3. The Backend Contract (DTO)

To prevent `NaN` errors on the frontend, the backend must serialize both the product details and the inventory counts into a single JSON object.

**Java DTO (`ProductResponse.java`):**

```java
public class ProductResponse {
    private UUID id;
    private String name;
    private String description;
    private BigDecimal price;
    private int totalStock;
    private int reservedStock;
}
```

**TypeScript Interface (`src/types/index.ts`):**

```java
export interface Product {
    id?: string;
    productId?: string; 
    name: string;
    description: string;
    price: number;
    totalStock: number;    // Maps directly to JSON camelCase
    reservedStock: number; // Maps directly to JSON camelCase
}
```

---

## 4. The `ProductCatalog` Component

**File:** `src/features/inventory/ProductCatalog.tsx`

### Core Responsibilities:

1. **Data Fetching:** Utilizes the custom `useProducts` hook to trigger an Axios GET request to `/products`.
    
2. **State Handling:** Manages `isLoading` (spinner) and `error` (alert box) states gracefully.
    
3. **Stock Calculation:** Derives the actual purchasable stock using business logic:
    
    - `availableStock = totalStock - reservedStock`
        
4. **UI Rendering:** Displays a responsive grid of product cards.
    

### The "Add to Cart" Button Logic:

The button dynamically reacts to the calculated `availableStock`.

- **If `availableStock > 0`:** The button is enabled. Clicking it triggers the `addToCart(product)` function injected via `useCart()`.
    
- **If `availableStock <= 0`:** The button is disabled (`disabled={isOutOfStock}`), the styling turns gray, and the cursor changes to `not-allowed`.
    

---

## 5. Global State: `CartContext`

**File:** `src/store/CartContext.tsx`

### Core Responsibilities:

Acts as the single source of truth for the user's active shopping session. By wrapping the application in `<CartProvider>`, any component (like the Navbar or Checkout screen) can read or modify the cart.

### The `addToCart` Algorithm:

When a product is passed into `addToCart()`, the Context executes the following logic to prevent duplicate entries and manage quantities:

```typescript
const addToCart = (product: Product) => {
    setCart((prevCart) => {
        // 1. Check if the item already exists in the cart array
        const existingItem = prevCart.find(
            item => (item.id || item.productId) === (product.id || product.productId)
        );

        if (existingItem) {
            // 2a. If it exists, map through the array and increment the cartQuantity of that specific item
            return prevCart.map(item =>
                (item.id || item.productId) === (product.id || product.productId)
                    ? { ...item, cartQuantity: item.cartQuantity + 1 }
                    : item
            );
        }
        // 2b. If it is a new item, append it to the end of the array and set initial cartQuantity to 1
        return [...prevCart, { ...product, cartQuantity: 1 }];
    });
};
```

---

## 6. Integration: The Navbar Notification Badge

**File:** `src/components/layout/Navbar.tsx`

The Navbar subscribes to the `CartContext` to display real-time feedback to the user.

- **Derived State:** It calculates the total number of items on the fly: `const cartItemCount = cart.reduce((total, item) => total + item.cartQuantity, 0);`
    
- **Conditional Rendering:** The red notification badge only mounts to the DOM if `cartItemCount > 0`.