**Tags:** #spring-boot #dto #rest-api #jpa #ssp-lab **Date:** [[2026-03-11]]

#### The Objective

To resolve the `405 Method Not Allowed` error by creating a read-only (`@GetMapping`) endpoint that fetches a specific user's order history from the PostgreSQL database, maps the Entities to Data Transfer Objects (DTOs), and returns them to the React frontend.

#### ⚙️ Implementation Steps

1. **Create the DTO:** Define `OrderResponse.java` to match the exact shape expected by the frontend TypeScript interface.
    
2. **Update the Repository:** Ensure `OrderRepository` can query by `userId` and sort by date.
    
3. **Complete the Service Logic:** Map the `Order` entity to the `OrderResponse` DTO using the Java Stream API.
    
4. **Expose the Endpoint:** Add the `@GetMapping` to `OrderController`.
    

---

### 💻 The Code Updates

#### 1. Create `OrderResponse.java` (DTO)

Create this file in your `dto` package. Using `@Builder` makes mapping from the entity very clean.

```java
// src/main/java/com/smartfulfillment/order_service/dto/OrderResponse.java
package com.smartfulfillment.order_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderResponse {
    private String orderId;
    private String userId;
    private String status;
    private BigDecimal totalAmount;
    private String shippingAddress;
    private String createdAt;
}
```

#### 2. Verify `OrderRepository.java`

Make sure your repository has this method to fetch the orders and sort the newest ones to the top.

```java
// src/main/java/com/smartfulfillment/order_service/repository/OrderRepository.java
package com.smartfulfillment.order_service.repository;

import com.smartfulfillment.order_service.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {
    List<Order> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
```

#### 3. Complete `OrderService.java`

Replace your incomplete `public List<OrderResponse>` line with this full method. _(Note: I also noticed a tiny typo in your logging logic `String.formate` which I corrected to `String.format` below to prevent a compilation error!)_

```java
// ... inside OrderService.java ...

    public List<OrderResponse> getUserOrders(UUID userId) {
        List<Order> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId);

        return orders.stream().map(order -> OrderResponse.builder()
                .orderId(order.getId().toString())
                .userId(order.getUserId().toString())
                .status(order.getStatus().name())
                .totalAmount(order.getTotalAmount())
                .shippingAddress(order.getShippingAddress())
                .createdAt(order.getCreatedAt().toString()) 
                .build()
        ).toList();
    }

    // --- HELPER METHODS ---
```

_(Self-Correction Tip: In `attemptToAllocateItem`, change `String.formate(\"%.2f\", distanceKm)` to `String.format("%.2f", distanceKm)` so your code compiles!)_

#### 4. Update `OrderController.java`

Add the `@GetMapping` below your existing `@PostMapping`.

```java
// ... inside OrderController.java ...
import com.smartfulfillment.order_service.dto.OrderResponse;
import java.util.List;

    @PostMapping
    public ResponseEntity<Order> createOrder(
            @RequestBody OrderRequest request,
            @RequestHeader("X-User-Id") UUID userId
            ){
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(orderService.placeOrder(request, userId));
    }

    // --- ADD THIS NEW ENDPOINT ---
    @GetMapping
    public ResponseEntity<List<OrderResponse>> getOrderHistory(
            @RequestHeader("X-User-Id") UUID userId
    ) {
        List<OrderResponse> orders = orderService.getUserOrders(userId);
        return ResponseEntity.ok(orders);
    }
```

