package com.smartfulfillment.inventory_service.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class ProductResponse {
    private UUID id;
    private String sku;
    private String name;
    private String description;
    private BigDecimal price;
    private String imageUrl;
    private int totalStock;
    private int reservedStock;
}
