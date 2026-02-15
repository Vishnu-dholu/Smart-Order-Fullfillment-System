package com.smartfulfillment.order_service.client;

import com.smartfulfillment.order_service.dto.ProductDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

@FeignClient(name = "inventory-service", url = "${inventory.service.url:http://localhost:8082}")
public interface InventoryClient {

    @GetMapping("/products/{id}")
    ProductDTO getProductById(@PathVariable("id")UUID id);
}
