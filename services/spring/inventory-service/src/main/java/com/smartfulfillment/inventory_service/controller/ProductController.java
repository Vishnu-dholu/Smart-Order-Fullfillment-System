package com.smartfulfillment.inventory_service.controller;

import com.smartfulfillment.inventory_service.dto.ProductResponse;
import com.smartfulfillment.inventory_service.entity.Product;
import com.smartfulfillment.inventory_service.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
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

    @PutMapping("/{id}/sync-stock")
    public ResponseEntity<Void> syncStock(@PathVariable UUID id, @RequestParam int totalStock){
        productService.syncGlobalStock(id, totalStock);
        return ResponseEntity.ok().build();
    }
}
