package com.smartfulfillment.warehousetwin.service;

import com.smartfulfillment.warehousetwin.dto.Dto.*;
import com.smartfulfillment.warehousetwin.entity.WarehouseStock;
import com.smartfulfillment.warehousetwin.repository.WarehouseStockRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class WarehouseService {

    @Autowired
    private WarehouseStockRepository warehouseStockRepository;

    // Match Go behavior: hard-coded localhost inventory URL
    private static final String INVENTORY_SERVICE_URL = "http://localhost:8082";

    private final RestTemplate restTemplate = new RestTemplate();

    @Transactional
    public Map<String, Object> updateStock(UUID warehouseId, StockUpdateRequest req) {
        WarehouseStock stock = warehouseStockRepository.findByWarehouseIdAndProductId(warehouseId, req.product_id())
                .orElse(null);

        if (stock == null) {
            stock = new WarehouseStock();
            stock.setWarehouseId(warehouseId);
            stock.setProductId(req.product_id());
            stock.setQuantity(req.quantity());
            stock.setUpdatedAt(LocalDateTime.now());
            warehouseStockRepository.save(stock);
        } else {
            int newQuantity = stock.getQuantity() + req.quantity();
            if (newQuantity < 0) {
                throw new IllegalArgumentException("Invalid Data: Negative Stock");
            }
            stock.setQuantity(newQuantity);
            stock.setUpdatedAt(LocalDateTime.now());
            warehouseStockRepository.save(stock);
        }

        // Global stock
        Integer globalStockRaw = warehouseStockRepository.getTotalGlobalStockByProductId(req.product_id());
        int totalGlobalStock = globalStockRaw == null ? 0 : globalStockRaw;

        // Sync with Inventory Service
        String inventoryUrl = INVENTORY_SERVICE_URL + "/products/" + req.product_id() + "/sync-stock";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, Integer> syncPayload = Collections.singletonMap("quantity", totalGlobalStock);
            HttpEntity<Map<String, Integer>> entity = new HttpEntity<>(syncPayload, headers);
            
            restTemplate.exchange(inventoryUrl, HttpMethod.PUT, entity, String.class);
            System.out.println("✅ Synced with Inventory Service. New Global Stock: " + totalGlobalStock);
        } catch (Exception e) {
            System.err.println("Warning: Failed to connect to Inventory Service: " + e.getMessage());
        }

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Stock updated successfully");
        response.put("current_quantity", stock.getQuantity());
        response.put("global_quantity", totalGlobalStock);
        return response;
    }

    public List<StockLocationResponse> getStockByProduct(UUID productId) {
        List<Object[]> results = warehouseStockRepository.findStockLocationByProductIdNative(productId);
        return results.stream().map(row -> new StockLocationResponse(
                UUID.fromString((String) row[0]),
                (String) row[1],
                (String) row[2],
                (Double) row[3],
                (Double) row[4],
                ((Number) row[5]).intValue()
        )).collect(Collectors.toList());
    }

    public List<StockResponse> getAllStock() {
        List<Object[]> results = warehouseStockRepository.findAllGlobalStockNative();
        return results.stream().map(row -> new StockResponse(
                UUID.fromString((String) row[0]),
                (String) row[1],
                (String) row[2],
                UUID.fromString((String) row[3]),
                ((Number) row[4]).intValue(),
                (Double) row[5],
                (Double) row[6]
        )).collect(Collectors.toList());
    }
}
