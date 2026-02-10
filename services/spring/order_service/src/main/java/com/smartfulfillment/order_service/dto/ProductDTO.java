package com.smartfulfillment.order_service.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class ProductDTO {
    private UUID id;
    private String name;
    private BigDecimal price;
    private boolean active;
}
