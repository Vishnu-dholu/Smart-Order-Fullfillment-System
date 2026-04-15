package com.smartfulfillment.inventory_service.controller;

import com.smartfulfillment.inventory_service.dto.ProductResponse;
import com.smartfulfillment.inventory_service.entity.Product;
import com.smartfulfillment.inventory_service.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;
    @Value("${internal.service.token}")
    private String internalServiceToken;

    @GetMapping
    public ResponseEntity<List<ProductResponse>> getAllProducts() {
        return ResponseEntity.ok(productService.getAllProductsWithStock());
    }

    @GetMapping("/{id}")
    public Product getAllProductById(@PathVariable UUID id){
        return productService.getProductById(id);
    }

    @PostMapping
    public ResponseEntity<Product> createProduct(
            @RequestHeader(value = "X-User-Role", required = false) String userRole,
            @RequestBody Product product
    ){
        if (!"ADMIN".equalsIgnoreCase(userRole)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(productService.createProduct(product));
    }

    @PutMapping("/{productId}/sync-stock")
    public ResponseEntity<Void> syncStockFromWarehouse(
            @PathVariable UUID productId,
            @RequestHeader(value = "X-Internal-Token", required = false) String requestInternalToken,
            @RequestBody Map<String, Integer> payload
    ) {
        if (!isValidInternalToken(requestInternalToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        // 1. Extract the absolute total calculated by Go
        int absoluteTotal = payload.getOrDefault("quantity", 0);

        // 2. Overwrite the Java database with Go's absolute truth
        productService.syncGlobalStock(productId, absoluteTotal);

        return ResponseEntity.ok().build();
    }

    private boolean isValidInternalToken(String requestInternalToken) {
        return requestInternalToken != null && requestInternalToken.equals(internalServiceToken);
    }
}