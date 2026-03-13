package com.smartfulfillment.order_service.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;

@FeignClient(name = "delivery-service", url = "${delivery.service.url:http://localhost:8085}")
public interface DeliveryClient {

    @PostMapping("/deliveries")
    Map<String, Object> createDelivery(@RequestBody Map<String, String> request);
}
