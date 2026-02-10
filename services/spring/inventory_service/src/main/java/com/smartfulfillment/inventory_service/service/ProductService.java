package com.smartfulfillment.inventory_service.service;

import com.smartfulfillment.inventory_service.entity.Product;
import com.smartfulfillment.inventory_service.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;

    // Get All Products (Paginated)
    public Page<Product> getAllProducts(Pageable pageable){
        return productRepository.findAll(pageable);
    }

    // Add New Product
    public Product createProduct(Product product){
        return productRepository.save(product);
    }

    // Populate Dummy Data
    public void seedData(List<Product> products){
        productRepository.saveAll(products);
    }
}
