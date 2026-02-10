package com.smartfulfillment.inventory_service.controller;

import com.smartfulfillment.inventory_service.entity.Product;
import com.smartfulfillment.inventory_service.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    // GET /products?page=0&size=10
    @GetMapping
    public Page<Product> getProducts(Pageable pageable){
        return productService.getAllProducts(pageable);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Product createProduct(@RequestBody Product product){
        return productService.createProduct(product);
    }

    @PostMapping("/seed")
    @ResponseStatus(HttpStatus.CREATED)
    public void seedProducts(@RequestBody List<Product> products){
        productService.seedData(products);
    }
}
