package com.smartfulfillment.warehousetwin.controller;

import com.smartfulfillment.warehousetwin.dto.Dto.*;
import com.smartfulfillment.warehousetwin.service.WarehouseService;
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
            Map<String, Object> response = warehouseService.updateStock(warehouseId, req);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(java.util.Collections.singletonMap("error", "Failed to update stock: " + e.getMessage()));
        }
    }

    @GetMapping("/stock/{product_id}")
    public ResponseEntity<?> getStockByProduct(@PathVariable("product_id") String productId) {
        try {
            List<StockLocationResponse> results = warehouseService.getStockByProduct(productId);
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
