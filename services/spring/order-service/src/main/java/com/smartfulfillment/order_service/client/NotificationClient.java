package com.smartfulfillment.order_service.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;

@FeignClient(name = "notification-service", url = "${notification.service.url:http://localhost:8086}")
public interface NotificationClient {

    @PostMapping("/notifications")
    Map<String, Object> sendNotification(@RequestBody Map<String, String> request);
}
