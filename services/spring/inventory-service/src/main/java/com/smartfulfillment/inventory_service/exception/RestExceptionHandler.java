package com.smartfulfillment.inventory_service.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class RestExceptionHandler {

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrity(DataIntegrityViolationException ex) {
        String root = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage();
        String lower = root != null ? root.toLowerCase() : "";

        if (lower.contains("duplicate") || lower.contains("unique")) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", "SKU already exists. Choose a different SKU."));
        }

        if (lower.contains("too long") || lower.contains("character varying") || lower.contains("varchar")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message",
                            "A value is too long for a database column. Use a normal HTTPS image link, or ensure image_url is TEXT (ALTER COLUMN)."));
        }

        if (lower.contains("not null") || lower.contains("null value")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message",
                            "A required field is missing or null. Check that all fields (price, sku, name) are provided.",
                            "details", root != null ? root : "null constraint violation"));
        }

        Map<String, String> body = new LinkedHashMap<>();
        body.put("message", "Could not save product (database constraint).");
        if (root != null && !root.isBlank()) {
            int max = 400;
            body.put("details", root.length() > max ? root.substring(0, max) + "…" : root);
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
