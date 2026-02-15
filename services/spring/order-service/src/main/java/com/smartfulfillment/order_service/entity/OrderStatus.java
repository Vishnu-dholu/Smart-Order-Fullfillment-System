package com.smartfulfillment.order_service.entity;

public enum OrderStatus {
    CREATED,
    PENDING_INVENTORY,
    CONFIRMED,
    SHIPPED,
    DELIVERED,
    CANCELLED
}
