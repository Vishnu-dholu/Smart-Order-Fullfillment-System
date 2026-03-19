**Tags:** #react #typescript #ux #memory-management

## 1. Mitigating React Memory Leaks

Implemented auto-dismissing notification banners for successful inventory/order operations.

- **The Risk:** Standard `setTimeout` functions in UI handlers can trigger memory leaks if the user navigates away from the component before the timer resolves (React attempts to update state on an unmounted component).
    
- **The Fix:** Bound the timer to a `useEffect` hook monitoring the `successMsg` state, and strictly implemented the `return () => clearTimeout(timer)` cleanup function to safely destroy the timer on component unmount.
    

## 2. Polyglot Data Serialization Mismatches

Resolved silent UI rendering failures caused by naming convention mismatches between backend languages and frontend interfaces.

- **The Issue:** Go's standard JSON marshaler serializes structs into `camelCase` (e.g., `productId`), while the initial React TypeScript interfaces expected standard SQL `snake_case` (`product_id`). This resulted in `undefined` cross-referencing.
    
- **The Fix:** Strictly unified the TypeScript `StockItem` interface to mirror the exact JSON payload emitted by the Go server, restoring dynamic ROP (Reorder Point) calculations and UI rendering.
    

## 3. Dual-State UI Rendering

Upgraded the Warehouse Dashboard to display both isolated and aggregated data simultaneously.

- **Logic:** The component fetches physical locations from Go and global metadata from Java. By mapping the `productId` from the Go response to the `.find()` method against the Java response array, the UI dynamically renders a side-by-side comparison of "Local Facility Stock" versus "Global Company Stock".

