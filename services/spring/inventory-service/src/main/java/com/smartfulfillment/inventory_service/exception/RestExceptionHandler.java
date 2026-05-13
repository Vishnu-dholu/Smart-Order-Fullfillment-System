package com.smartfulfillment.inventory_service.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

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
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", "Could not save product (database constraint)."));
    }
}
