package com.smartfulfillment.warehouse_twin.controller;

import com.smartfulfillment.warehouse_twin.dto.StockResponse;
import com.smartfulfillment.warehouse_twin.dto.StockUpdateRequest;
import com.smartfulfillment.warehouse_twin.entity.WarehouseStock;
import com.smartfulfillment.warehouse_twin.service.WarehouseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class StockController {

    @Autowired
    private WarehouseService warehouseService;

    @PostMapping("/warehouses/{warehouse_id}/stock")
    public ResponseEntity<?> updateStock(@PathVariable("warehouse_id") UUID warehouseId,
                                         @RequestBody StockUpdateRequest req) {
        try {
            // Call the service which now properly returns the WarehouseStock entity
            WarehouseStock stock = warehouseService.updateStock(warehouseId, req);

            // Calculate global stock to return in the JSON response
            Integer totalStock = warehouseService.getAllStock().stream()
                    .filter(s -> s.getProductId().equals(req.getProductId()))
                    .mapToInt(s -> s.getQuantity().intValue())
                    .sum();

            Map<String, Object> response = Map.of(
                    "message", "Stock updated successfully",
                    "current_quantity", stock.getQuantity(),
                    "global_quantity", totalStock
            );
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(java.util.Collections.singletonMap("error", "Failed to update stock: " + e.getMessage()));
        }
    }

    @GetMapping("/stock/{product_id}")
    public ResponseEntity<?> getStockByProduct(@PathVariable("product_id") UUID productId) {
        try {
            // Updated to pass UUID and expect StockResponse
            List<StockResponse> results = warehouseService.getStockByProduct(productId);
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(java.util.Collections.singletonMap("error", e.getMessage()));
        }
    }

    @GetMapping("/stock")
    public ResponseEntity<?> getAllStock() {
        try {
            List<StockResponse> results = warehouseService.getAllStock();
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(java.util.Collections.singletonMap("error", "Failed to fetch global stock"));
        }
    }
}