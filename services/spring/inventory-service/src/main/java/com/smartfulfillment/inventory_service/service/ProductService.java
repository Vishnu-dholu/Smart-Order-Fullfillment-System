package com.smartfulfillment.inventory_service.service;

import com.smartfulfillment.inventory_service.dto.ProductResponse;
import com.smartfulfillment.inventory_service.entity.GlobalInventory;
import com.smartfulfillment.inventory_service.entity.Product;
import com.smartfulfillment.inventory_service.repository.GlobalInventoryRepository;
import com.smartfulfillment.inventory_service.repository.ProductRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final GlobalInventoryRepository globalInventoryRepository;

    public List<ProductResponse> getAllProductsWithStock(){
        List<Product> products = productRepository.findAll();

        return products.stream().map(product -> {
            // Find matching inventory, default to 0 if not found
            GlobalInventory inventory = globalInventoryRepository.findByProductId(product.getId())
                    .orElse(null);

            return ProductResponse.builder()
                    .id(product.getId())
                    .sku(product.getSku())
                    .name(product.getName())
                    .description(product.getDescription())
                    .price(product.getPrice())
                    .imageUrl(product.getImageUrl())
                    .lowStockThreshold(product.getLowStockThreshold())
                    .totalStock(inventory != null ? inventory.getTotalStock() : 0)
                    .reservedStock(inventory != null ? inventory.getReservedStock() : 0)
                    .build();
        }).collect(Collectors.toList());
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

    public void syncGlobalStock(UUID productId, int newTotalStock){
        GlobalInventory inventory = globalInventoryRepository.findByProductId(productId)
                .orElse(GlobalInventory.builder()
                        .productId(productId)
                        .totalStock(0)
                        .reservedStock(0)
                        .build());

        inventory.setTotalStock(newTotalStock);
        globalInventoryRepository.save(inventory);

        // Note: For debugging purposes, you can add a log here
        System.out.println("Synced Global Stock for " + productId + " -> New Total: " + newTotalStock);
    }

    @Transactional
    public void addGlobalStock(UUID productId, int quantityToAdd){
        // Find the existing inventory record, or create a new one if it's the first receiving this item
        GlobalInventory inventory = globalInventoryRepository.findByProductId(productId)
                .orElse(GlobalInventory.builder()
                        .productId(productId)
                        .totalStock(0)
                        .reservedStock(0)
                        .build()
                );

        // Add the new physical stock to the global total
        inventory.setTotalStock(inventory.getTotalStock() + quantityToAdd);
        globalInventoryRepository.save(inventory);
    }
}
