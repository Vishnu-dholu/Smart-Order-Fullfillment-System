package com.smartfulfillment.order_service.service;

import com.smartfulfillment.order_service.client.DeliveryClient;
import com.smartfulfillment.order_service.client.InventoryClient;
import com.smartfulfillment.order_service.client.NotificationClient;
import com.smartfulfillment.order_service.client.WarehouseClient;
import com.smartfulfillment.order_service.dto.OrderRequest;
import com.smartfulfillment.order_service.dto.OrderResponse;
import com.smartfulfillment.order_service.dto.ProductDTO;
import com.smartfulfillment.order_service.dto.StockDTO;
import com.smartfulfillment.order_service.entity.Order;
import com.smartfulfillment.order_service.entity.OrderItem;
import com.smartfulfillment.order_service.entity.OrderStatus;
import com.smartfulfillment.order_service.repository.OrderRepository;
import com.smartfulfillment.order_service.util.LocationUtils;
import feign.FeignException;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final OrderRepository orderRepository;
    private final InventoryClient inventoryClient;
    private final WarehouseClient warehouseClient;
    private final DeliveryClient deliveryClient;
    private final NotificationClient notificationClient;

    @Transactional
    public Order placeOrder(OrderRequest request, UUID userId){
        log.info("Processing order for User: {}", userId);

        Order order = initializeOrder(request, userId);
        List<OrderItem> items = createOrderItems(request.getItems(), order);
        order.setItems(items);
        order.setTotalAmount(calculateTotal(items));

        // SAGA STATE: Keep a ledger of successfully deducted stock so we know what to refund if things fail.
        Map<UUID, OrderItem> allocationLedger = new HashMap<>();

        try {
            // 1. Allocate Stock (Warehouse Service)
            allocateStock(items, request, allocationLedger);

            // 2. Finalize & Save Local DB
            order.setStatus(OrderStatus.CONFIRMED);
            Order savedOrder = orderRepository.save(order);

            // 3. Trigger Notification
            sendNotificationAsync(savedOrder, "ORDER_CONFIRMED", "bitbuster08@gmail.com");

            return savedOrder;

        } catch (Exception e) {
            log.error("Order process failed! Initiating Saga Compensation (Stock Refund)...", e);

            // COMPENSATING TRANSACTION: Iterate through the ledger and refund the stock
            for (Map.Entry<UUID, OrderItem> entry : allocationLedger.entrySet()) {
                UUID warehouseId = entry.getKey();
                OrderItem item = entry.getValue();
                try {
                    // Send a POSITIVE quantity to the Go service to refund it
                    warehouseClient.updateStock(
                            warehouseId,
                            Map.of(
                                    "product_id", item.getProductId(),
                                    "quantity", item.getQuantity()
                            )
                    );
                    log.info("SAGA RECOVERY: Refunded {} units of Product {} to Warehouse {}",
                            item.getQuantity(), item.getProductId(), warehouseId);
                } catch (Exception refundEx) {
                    log.error("CRITICAL SAGA FAILURE: Could not refund Product {} to Warehouse {}. Manual intervention required!",
                            item.getProductId(), warehouseId, refundEx);
                }
            }
            throw new RuntimeException("Failed to place order. All deducted stock was refunded.", e);
        }
    }

    public List<OrderResponse> getUserOrders(UUID userId) {
        List<Order> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return orders.stream().map(this::mapToOrderResponse).toList();
    }

    public List<OrderResponse> getAllOrders() {
        return orderRepository.findAll().stream().map(this::mapToOrderResponse).toList();
    }

    @Transactional
    public void updateOrderStatus(UUID orderId, OrderStatus newStatus) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));

        if(newStatus == OrderStatus.SHIPPED && order.getStatus() != OrderStatus.SHIPPED){
            log.info("Order {} is being shipped. Notifying Delivery Service...", orderId);

            Map<String, String> deliveryPayload = Map.of(
                    "order_id", orderId.toString(),
                    "origin_warehouse", UUID.randomUUID().toString()
            );

            try{
                deliveryClient.createDelivery(deliveryPayload);
                log.info("Successfully generated tracking ticker for Order: {}", orderId);
            } catch (Exception e){
                log.error("Failed to communicate with Delivery Service for Order: {}", orderId, e);
            }

            sendNotificationAsync(order, "ORDER_SHIPPED", "bitbuster08@gmail.com");
        }

        order.setStatus(newStatus);
        orderRepository.save(order);
    }

    // --- HELPER METHODS ---

    private OrderResponse mapToOrderResponse(Order order) {
        return OrderResponse.builder()
                .orderId(order.getOrderId().toString())
                .userId(order.getUserId().toString())
                .status(order.getStatus().name())
                .totalAmount(order.getTotalAmount())
                .shippingAddress(order.getShippingAddress())
                .createdAt(order.getCreatedAt().toString())
                .build();
    }

    private Order initializeOrder(OrderRequest request, UUID userId){
        return Order.builder()
                .userId(userId)
                .status(OrderStatus.PENDING_INVENTORY)
                .shippingAddress(request.getShippingAddress())
                .build();
    }

    private List<OrderItem> createOrderItems(List<OrderRequest.OrderItemRequest> itemRequests, Order order){
        List<OrderItem> items = new ArrayList<>();
        for(OrderRequest.OrderItemRequest req : itemRequests){
            ProductDTO product = fetchProductFromInventory(req.getProductId());
            items.add(OrderItem.builder()
                    .order(order)
                    .productId(req.getProductId())
                    .quantity(req.getQuantity())
                    .priceAtPurchase(product.getPrice())
                    .build()
            );
        }
        return items;
    }

    private ProductDTO fetchProductFromInventory(UUID productId){
        try {
            ProductDTO product = inventoryClient.getProductById(productId);
            if (product == null){
                throw new RuntimeException("Product not found: " + productId);
            }
            return product;
        } catch (FeignException.NotFound e){
            throw new RuntimeException("Product not found: " + productId);
        }
    }

    private BigDecimal calculateTotal(List<OrderItem> items){
        return items.stream()
                .map(item -> item.getPriceAtPurchase().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    // Pass the ledger down so we can track exactly which warehouse gave up the stock
    private void allocateStock(List<OrderItem> items, OrderRequest request, Map<UUID, OrderItem> allocationLedger){
        for (OrderItem item : items){
            UUID allocatedWarehouseId = attemptToAllocateItem(item, request);
            if(allocatedWarehouseId == null){
                throw new RuntimeException("Insufficient stock for Product ID: " + item.getProductId());
            }
            // Record the successful deduction!
            allocationLedger.put(allocatedWarehouseId, item);
        }
    }

    private UUID attemptToAllocateItem(OrderItem item, OrderRequest request){
        List<StockDTO> warehouses = warehouseClient.getStockByProduct(item.getProductId());

        StockDTO closestWarehouse = warehouses.stream()
                .filter(wh -> wh.getQuantity() >= item.getQuantity())
                .min(Comparator.comparingDouble(wh -> {
                    double userLat = request.getShippingLatitude() != null ? request.getShippingLatitude() : 0.0;
                    double userLng = request.getShippingLongitude() != null ? request.getShippingLongitude() : 0.0;
                    return LocationUtils.calculateDistance(userLat, userLng, wh.getLatitude(), wh.getLongitude());
                }))
                .orElse(null);

        if(closestWarehouse != null){
            double distanceKm = LocationUtils.calculateDistance(
                    request.getShippingLatitude() != null ? request.getShippingLatitude() : 0.0,
                    request.getShippingLongitude() != null ? request.getShippingLongitude() : 0.0,
                    closestWarehouse.getLatitude(), closestWarehouse.getLongitude()
            );

            log.info("SMART ROUTING: Assigning Product {} to '{}' ({}). Distance: {} km.",
                    item.getProductId(), closestWarehouse.getWarehouseName(), closestWarehouse.getLocation(), String.format("%.2f", distanceKm));

            boolean success = deductStockFromWareHouse(closestWarehouse, item);
            if (success) {
                return closestWarehouse.getWarehouseId();
            }
        }
        return null;
    }

    private boolean deductStockFromWareHouse(StockDTO warehouse, OrderItem item){
        try {
            warehouseClient.updateStock(
                    warehouse.getWarehouseId(),
                    Map.of(
                            "product_id", item.getProductId(),
                            "quantity", -item.getQuantity() // NEGATIVE to deduct
                    )
            );
            log.info("Allocated {} items of Product {} from Warehouse {}",
                    item.getQuantity(), item.getProductId(), warehouse.getWarehouseName());
            return true;
        } catch (Exception e){
            log.error("Failed to deduct stock from warehouse {}. Trying next...", warehouse.getWarehouseId());
            return false;
        }
    }

    private void sendNotificationAsync(Order order, String type, String recipientEmail){
        new Thread(() -> {
            try {
                Map<String, String> payload = Map.of(
                        "user_id", order.getUserId().toString(),
                        "order_id", order.getOrderId() != null ? order.getOrderId().toString() : "",
                        "type", type,
                        "recipient_email", recipientEmail,
                        "total_amount", order.getTotalAmount() != null ? order.getTotalAmount().toString() : "0.00",
                        "shipping_address", order.getShippingAddress() != null ? order.getShippingAddress() : "N/A"
                );

                notificationClient.sendNotification(payload);
                log.info("Successfully dispatched {} notification for Order: {}", type, order.getOrderId());
            } catch (Exception e) {
                log.error("Failed to communicate with Notification Service for Order: {}", order.getOrderId(), e);
            }
        }).start();
    }
}