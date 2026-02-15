package com.smartfulfillment.inventory_service.service;

import com.smartfulfillment.inventory_service.entity.GlobalInventory;
import com.smartfulfillment.inventory_service.entity.Product;
import com.smartfulfillment.inventory_service.repository.GlobalInventoryRepository;
import com.smartfulfillment.inventory_service.repository.ProductRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final GlobalInventoryRepository globalInventoryRepository;

    public List<Product> getAllProducts(){
        return productRepository.findAll();
    }

    public Product getProductById(UUID id){
        return productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Product not found"));
    }

    @Transactional
    public Product createProduct(Product product){
        // Save the Product
        Product savedProduct = productRepository.save(product);

        // Initialize Global Inventory (Stock = 0)
        GlobalInventory inventory = GlobalInventory.builder()
                .productId(savedProduct.getId())
                .totalStock(0)
                .reservedStock(0)
                .build();

        globalInventoryRepository.save(inventory);

        return savedProduct;
    }
}
