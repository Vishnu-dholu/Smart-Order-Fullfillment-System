package com.smartfulfillment.warehousetwin.service;

import com.smartfulfillment.warehousetwin.dto.Dto.*;
import com.smartfulfillment.warehousetwin.entity.WarehouseStock;
import com.smartfulfillment.warehousetwin.repository.WarehouseStockRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class WarehouseService {

    @Autowired
    private WarehouseStockRepository warehouseStockRepository;

    private final RestTemplate restTemplate;

    public WarehouseService() {
        // Match Go behavior: 5s timeout for inventory sync
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(5_000);
        this.restTemplate = new RestTemplate(factory);
    }

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
                // Go returns gorm.ErrInvalidData => "invalid data" (500 from handler)
                throw new RuntimeException("invalid data");
            }
            stock.setQuantity(newQuantity);
            stock.setUpdatedAt(LocalDateTime.now());
            warehouseStockRepository.save(stock);
        }

        // Global stock
        Integer globalStockRaw = warehouseStockRepository.getTotalGlobalStockByProductId(req.product_id());
        int totalGlobalStock = globalStockRaw == null ? 0 : globalStockRaw;

        // Sync with Inventory Service
        String baseUrl = System.getenv("INVENTORY_SERVICE_URL");
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = "http://localhost:8082";
        }
        baseUrl = baseUrl.replaceAll("/+$", "");
        String inventoryUrl = baseUrl + "/products/" + req.product_id() + "/sync-stock";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, Integer> syncPayload = Collections.singletonMap("quantity", totalGlobalStock);
            HttpEntity<Map<String, Integer>> entity = new HttpEntity<>(syncPayload, headers);

            HttpStatusCode status = restTemplate.exchange(inventoryUrl, HttpMethod.PUT, entity, String.class).getStatusCode();
            if (status.value() == 200) {
                System.out.println("✅ Synced with Inventory Service. New Global Stock: " + totalGlobalStock);
            } else {
                System.err.println("⚠️ Warning: Java responded with status code: " + status.value());
            }
        } catch (RestClientException e) {
            System.err.println("Warning: Failed to connect to Inventory Service: " + e.getMessage());
        }

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Stock updated successfully");
        response.put("current_quantity", stock.getQuantity());
        response.put("global_quantity", totalGlobalStock);
        return response;
    }

    public List<StockLocationResponse> getStockByProduct(String productId) {
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
