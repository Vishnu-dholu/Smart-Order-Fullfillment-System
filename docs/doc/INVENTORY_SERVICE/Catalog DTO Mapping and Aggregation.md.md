**Tags:** #spring-boot #java #dto #jpa 
**Project:** Smart Order Fulfillment (SSP / SPE)

## 1. Entity to DTO Mapping Rectification

A critical bug was identified where the React frontend received `null` values for `sku` and `imageUrl` fields in the catalog table, despite the data existing in PostgreSQL.

- **Root Cause:** The `ProductService` utilized Lombok's `@Builder` pattern to construct the `ProductResponse` Data Transfer Object (DTO). Fields present in the database entity but omitted in the builder chain automatically default to `null` during JSON serialization.
    
- **Resolution:** Explicitly mapped the `sku` and `imageUrl` entity getters into the builder pattern inside the `getAllProductsWithStock()` stream operation.
    

## 2. Global Inventory Aggregation

The `GET /products` endpoint is tasked with providing the Admin Dashboard a comprehensive view of the catalog.

- **The Join Operation:** Instead of a complex SQL join, the service level queries the `ProductRepository` and iterates through the results, executing a secondary lookup against the `GlobalInventoryRepository` using the `productId`.
    
- **Fallback Logic:** If a product was created but has never received physical stock (meaning no row exists in `global_inventory`), the mapping logic safely defaults `totalStock` and `reservedStock` to `0` using a ternary operator (`inventory != null ? inventory.getTotalStock() : 0`), preventing Null Pointer Exceptions during JSON generation.