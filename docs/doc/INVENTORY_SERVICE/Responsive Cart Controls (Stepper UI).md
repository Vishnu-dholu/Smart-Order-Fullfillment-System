### The Concept

To reduce friction and improve user experience, the standard "Add" button transforms into an inline quantity stepper (`-` | `qty` | `+`) the moment a product is added to the cart. This allows users to adjust their desired quantities without leaving the product catalog.

### ⚙️ State Management Update (`CartContext.tsx`)

The Context API was expanded to handle decrementing and removal logic via the `removeFromCart` function.

**The Decrement/Remove Algorithm:**

1. Locate the item in the `cart` array using its `productId`.
    
2. **Condition A (Remove):** If the current `cartQuantity` is `1`, the user clicking `-` means they want zero. The item is entirely filtered out of the array.
    
3. **Condition B (Decrement):** If the `cartQuantity > 1`, the array is mapped over, and that specific item's quantity is decreased by 1.
    

### 🖥️ UI Implementation (`ProductCatalog.tsx`)

The rendering logic evaluates the current state of the cart to determine which UI to display for each product card.

**Conditional Rendering Logic:**

```typescript
{cartQuantity > 0 ? (
    // Render Stepper Control
) : (
    // Render Default "Add" Button
)}
```

**Edge Case Handling (Inventory Constraints):** The stepper control is strictly bound by the `availableStock` calculated from the Spring Boot DTO.

- The `+` (increment) button is dynamically disabled if `cartQuantity >= availableStock`.
    
- A `title` attribute is added to provide a native tooltip ("Max stock reached") when the user hovers over a disabled `+` button, ensuring the UI communicates _why_ the action is restricted.
    

	---