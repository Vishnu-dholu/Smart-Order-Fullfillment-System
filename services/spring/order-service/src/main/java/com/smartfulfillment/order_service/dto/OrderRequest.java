package com.smartfulfillment.order_service.dto;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class OrderRequest {
    private String shippingAddress;
    private List<OrderItemRequest> items;

    @Data
    public static class OrderItemRequest {
        private UUID productId;
        private int quantity;
    }
}
