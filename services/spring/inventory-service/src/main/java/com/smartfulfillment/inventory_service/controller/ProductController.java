package com.smartfulfillment.inventory_service.controller;

import com.smartfulfillment.inventory_service.dto.ProductResponse;
import com.smartfulfillment.inventory_service.entity.Product;
import com.smartfulfillment.inventory_service.service.ProductService;
import lombok.RequiredArgsConstructor;
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

    @GetMapping
    public ResponseEntity<List<ProductResponse>> getAllProducts() {
        return ResponseEntity.ok(productService.getAllProductsWithStock());
    }

    @GetMapping("/{id}")
    public Product getAllProductById(@PathVariable UUID id){
        return productService.getProductById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Product createProduct(@RequestBody Product product){
        return productService.createProduct(product);
    }

    @PutMapping("/{productId}/sync-stock")
    public ResponseEntity<Void> syncStockFromWarehouse(
            @PathVariable UUID productId,
            @RequestBody Map<String, Integer> payload
    ) {
        // 1. Extract the absolute total calculated by Go
        int absoluteTotal = payload.getOrDefault("quantity", 0);

        // 2. Overwrite the Java database with Go's absolute truth
        productService.syncGlobalStock(productId, absoluteTotal);

        return ResponseEntity.ok().build();
    }
}