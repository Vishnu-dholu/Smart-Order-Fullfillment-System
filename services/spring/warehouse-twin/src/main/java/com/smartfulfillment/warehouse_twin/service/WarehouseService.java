package com.smartfulfillment.warehouse_twin.service;

import com.smartfulfillment.warehouse_twin.dto.StockResponse;
import com.smartfulfillment.warehouse_twin.dto.StockUpdateRequest;
import com.smartfulfillment.warehouse_twin.entity.Warehouse;
import com.smartfulfillment.warehouse_twin.entity.WarehouseStock;
import com.smartfulfillment.warehouse_twin.repository.WarehouseRepository;
import com.smartfulfillment.warehouse_twin.repository.WarehouseStockRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class WarehouseService {

    private final WarehouseRepository warehouseRepository;
    private final WarehouseStockRepository warehouseStockRepository;
    private final RestTemplate restTemplate;

    // FIX 1: Explicitly match the Docker Compose Environment Variable
    @Value("${INVENTORY_SERVICE_URL:http://localhost:8082}")
    private String inventoryServiceUrl;

    public Warehouse createWarehouse(Warehouse warehouse) {
        return warehouseRepository.save(warehouse);
    }

    public List<Warehouse> getAllWarehouses() {
        return warehouseRepository.findAll();
    }

    @Transactional
    public WarehouseStock updateStock(UUID warehouseId, StockUpdateRequest request) {
        WarehouseStock stock = warehouseStockRepository
                .findByWarehouseIdAndProductId(warehouseId, request.getProductId())
                .orElseGet(() -> {
                    WarehouseStock newStock = new WarehouseStock();
                    newStock.setWarehouseId(warehouseId);
                    newStock.setProductId(request.getProductId());
                    newStock.setQuantity(0);
                    return newStock;
                });

        int newQuantity = stock.getQuantity() + request.getQuantity();
        if (newQuantity < 0) {
            throw new IllegalArgumentException("Cannot result in negative stock");
        }

        stock.setQuantity(newQuantity);

        // FIX 2: Use saveAndFlush!
        // This forces Hibernate to write the UPDATE to the database immediately.
        // Without this, the SUM query below will calculate using the OLD stock values.
        WarehouseStock savedStock = warehouseStockRepository.saveAndFlush(stock);

        // Calculate Global Stock (Now perfectly accurate)
        int totalGlobalStock = warehouseStockRepository.getTotalGlobalStockByProductId(request.getProductId());

        // Sync with Inventory Service
        syncWithInventoryService(request.getProductId(), totalGlobalStock);

        return savedStock;
    }

    private void syncWithInventoryService(UUID productId, int totalGlobalStock) {
        try {
            // Trim trailing slash to match Go's strings.TrimRight
            String baseUrl = inventoryServiceUrl.endsWith("/") ?
                    inventoryServiceUrl.substring(0, inventoryServiceUrl.length() - 1) :
                    inventoryServiceUrl;

            String url = String.format("%s/products/%s/sync-stock", baseUrl, productId);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Integer> payload = Map.of("quantity", totalGlobalStock);
            HttpEntity<Map<String, Integer>> requestEntity = new HttpEntity<>(payload, headers);

            restTemplate.exchange(url, HttpMethod.PUT, requestEntity, String.class);
            log.info("✅ Synced with Inventory Service. New Global Stock: {}", totalGlobalStock);
        } catch (Exception e) {
            log.warn("Warning: Failed to connect to Inventory Service: {}", e.getMessage());
        }
    }

    public List<StockResponse> getStockByProduct(UUID productId) {
        return warehouseStockRepository.findStockByProductId(productId);
    }

    public List<StockResponse> getAllStock() {
        return warehouseStockRepository.findAllGlobalStock();
    }
}