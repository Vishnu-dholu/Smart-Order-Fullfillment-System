package com.smartfulfillment.warehousetwin.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/health")
    public Map<String, Object> healthCheck() {
        // Match Go service response exactly: {"status":"UP"}
        return Map.of("status", "UP");
    }
}
