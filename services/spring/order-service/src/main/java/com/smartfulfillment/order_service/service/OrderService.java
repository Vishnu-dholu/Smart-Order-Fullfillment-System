package com.smartfulfillment.order_service.service;

import com.smartfulfillment.order_service.client.InventoryClient;
import com.smartfulfillment.order_service.client.WarehouseClient;
import com.smartfulfillment.order_service.dto.OrderRequest;
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

    @Transactional
    public Order placeOrder(OrderRequest request, UUID userId){
        log.info("Processing order for User: {}", userId);

        // Initialize empty order
        Order order = initializeOrder(request, userId);

        // Validate Items & Calculate Price (Inventory Service)
        List<OrderItem> items = createOrderItems(request.getItems(), order);
        order.setItems(items);
        order.setTotalAmount(calculateTotal(items));

        // Allocate Stock (Warehouse Service)
        allocateStock(items, request);

        // Finalize & Save
        order.setStatus(OrderStatus.CONFIRMED);
        return orderRepository.save(order);
    }

    // --- HELPER METHODS ---

    // Create the basic Order object
    private Order initializeOrder(OrderRequest request, UUID userId){
        return Order.builder()
                .userId(userId)
                .status(OrderStatus.PENDING_INVENTORY)
                .shippingAddress(request.getShippingAddress())
                .build();
    }

    // Talk to Inventory Service & Build Items
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

    // Talk to Warehouse Service (the complexity was mostly here!)
    private void allocateStock(List<OrderItem> items, OrderRequest request){
        for (OrderItem item : items){
            boolean success = attemptToAllocateItem(item, request);
            if(!success){
                throw new RuntimeException("Insufficient stock for Product ID: " + item.getProductId());
            }
        }
    }

    private boolean attemptToAllocateItem(OrderItem item, OrderRequest request){
        List<StockDTO> warehouses = warehouseClient.getStockByProduct(item.getProductId());

        // Stream, filter by quantity, and sort by geographic distance
        StockDTO closestWarehouse = warehouses.stream()
                .filter(wh -> wh.getQuantity() >= item.getQuantity())
                .min(Comparator.comparingDouble(wh -> {
                    // Fallback to 0 if coordinates are missing to prevent NullPointerException
                    double userLat = request.getShippingLatitude() != null ? request.getShippingLatitude() : 0.0;
                    double userLng = request.getShippingLongitude() != null ? request.getShippingLongitude() : 0.0;

                    return LocationUtils.calculateDistance(
                            userLat, userLng,
                            wh.getLatitude(), wh.getLongitude()
                    );
                }))
                .orElse(null);

        if(closestWarehouse != null){
            // Calculate final distance for logging
            double distanceKm = LocationUtils.calculateDistance(
                    request.getShippingLatitude() != null ? request.getShippingLatitude() : 0.0,
                    request.getShippingLongitude() != null ? request.getShippingLongitude() : 0.0,
                    closestWarehouse.getLatitude(), closestWarehouse.getLongitude()
            );

            log.info("SMART ROUTING: Assigning Product {} to '{}' ({}). Distance: String.formate(\"%.2f\", distanceKm) km.",
                    item.getProductId(), closestWarehouse.getWarehouseName(), closestWarehouse.getLocation());

            return deductStockFromWareHouse(closestWarehouse, item);
        }

        return false;   // No suitable warehouse found
    }

    private boolean deductStockFromWareHouse(StockDTO warehouse, OrderItem item){
        try {
            warehouseClient.updateStock(
                    warehouse.getWarehouseId(),
                    Map.of(
                            "product_id", item.getProductId(),
                            "quantity", -item.getQuantity()
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
}
