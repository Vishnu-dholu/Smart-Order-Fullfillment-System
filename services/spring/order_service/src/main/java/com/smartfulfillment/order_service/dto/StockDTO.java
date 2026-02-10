package com.smartfulfillment.order_service.dto;

import lombok.Data;

import java.util.UUID;

@Data
public class StockDTO {
    private UUID warehouseId;
    private String warehouseName;
    private String location;
    private int quantity;
}
