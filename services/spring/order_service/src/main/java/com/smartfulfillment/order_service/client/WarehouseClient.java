package com.smartfulfillment.order_service.client;

import com.smartfulfillment.order_service.dto.StockDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@FeignClient(name = "warehouse-service", url = "${warehouse.service.url:http://localhost:8084}")
public class WarehouseClient {
    @GetMapping("/stock/{productId")
    List<StockDTO> getStockByProduct(@PathVariable("productId")UUID productId);

    @PostMapping("/warehouse/{warehouseId}/stock")
    void updateStock(@PathVariable("warehouseId") UUID warehouseId, @RequestBody Map<String, Object> payload);
}
