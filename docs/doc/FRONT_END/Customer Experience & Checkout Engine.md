**Tags:** #react #context-api #geolocation #rbac 

## 1. Global Cart State (`CartContext.tsx`)

Implemented a robust global state using React's Context API to manage the user's shopping session without prop-drilling.

- **Item Aggregation:** The `addToCart` function checks for `existingItem` using the `productId`. If it exists, it increments the `cartQuantity` rather than duplicating the object array.
    
- **Dynamic Totals:** Utilizes `reduce()` to instantly calculate the `cartTotal` and the `cartItemCount` (used in the Navbar badge).
    

## 2. Geolocation & Smart Routing UI (`CheckoutScreen.tsx`)

The checkout form is designed to feed precise coordinates to the backend's Haversine routing engine.

- **HTML5 Geolocation API:** Implemented a one-click "Auto-Detect" button that hooks into `navigator.geolocation.getCurrentPosition`.
    
- **Payload Structuring:** Parses the string-based input fields into strict `parseFloat` and `parseInt` values to perfectly match the Java `OrderRequest` DTO.
    
- **UX Trick:** Utilized the HTML5 `form="checkout-form"` attribute on the "Place Order" button, allowing the submit button to live in a completely different grid column than the actual `<form>` tag.
    

## 3. UI Role-Based Access Control (`Navbar.tsx`)

Enforced visual RBAC to prevent UI pollution across different user personas.

- **Conditional Rendering:** The Shopping Cart icon and badge are strictly wrapped in a `user.role === 'CUSTOMER'` conditional. This prevents Admins or Warehouse Managers from accidentally triggering checkout flows meant for consumers.

