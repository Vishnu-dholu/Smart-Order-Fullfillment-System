package com.smartfulfillment.order_service.controller;

import com.smartfulfillment.order_service.dto.OrderRequest;
import com.smartfulfillment.order_service.dto.OrderResponse;
import com.smartfulfillment.order_service.entity.Order;
import com.smartfulfillment.order_service.entity.OrderStatus;
import com.smartfulfillment.order_service.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService orderService;

    @PostMapping
    public ResponseEntity<Order> createOrder(
            @RequestBody OrderRequest request,
            @RequestHeader("X-User-Id")UUID userId
            // NOTE: In a real Gateway, the Gateway extracts JWT and passes "X-User-Id" header
            // For local testing, we will pass this header manually or extract from token.
            ){
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(orderService.placeOrder(request, userId));
    }

    @GetMapping
    public ResponseEntity<List<OrderResponse>> getOrderHistory(
            @RequestHeader("X-User-Id") UUID userId
    ){
        List<OrderResponse> orders = orderService.getUserOrders(userId);
        return ResponseEntity.ok(orders);
    }

    // Endpoint for Warehouse Managers to see all orders across the system
    @GetMapping("/all")
    public ResponseEntity<List<OrderResponse>> getAllSystemOrders() {
        return ResponseEntity.ok(orderService.getAllOrders());
    }

    // Endpoint for Warehouse Managers to mark an order as SHIPPED
    @PutMapping("/{orderId}/status")
    public ResponseEntity<Void> updateOrderStatus(
            @PathVariable UUID orderId,
            @RequestBody Map<String, String> statusUpdate
    ) {
        OrderStatus newStatus = OrderStatus.valueOf(statusUpdate.get("status").toUpperCase());
        orderService.updateOrderStatus(orderId, newStatus);
        return ResponseEntity.ok().build();
    }
}
