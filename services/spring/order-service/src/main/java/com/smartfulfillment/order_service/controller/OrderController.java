package com.smartfulfillment.order_service.controller;

import com.smartfulfillment.order_service.dto.OrderRequest;
import com.smartfulfillment.order_service.entity.Order;
import com.smartfulfillment.order_service.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
}
