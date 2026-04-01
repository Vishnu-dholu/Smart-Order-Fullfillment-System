package com.smartfulfillment.warehousetwin.dto;

import java.util.UUID;

public class Dto {
    
    public record StockUpdateRequest(UUID product_id, int quantity) {}

    public record StockLocationResponse(
            UUID warehouse_id,
            String warehouse_name,
            String location,
            Double latitude,
            Double longitude,
            int quantity
    ) {}

    public record StockResponse(
            UUID warehouseId,
            String warehouseName,
            String location,
            UUID productId,
            int quantity,
            Double latitude,
            Double longitude
    ) {}
}
