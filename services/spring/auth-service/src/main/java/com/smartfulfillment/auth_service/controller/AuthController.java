package com.smartfulfillment.auth_service.controller;

import com.smartfulfillment.auth_service.dto.AdminCreateUserRequest;
import com.smartfulfillment.auth_service.dto.AuthRequest;
import com.smartfulfillment.auth_service.dto.AuthResponse;
import com.smartfulfillment.auth_service.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Value("${internal.service.token:smartfill-internal-token}")
    private String internalServiceToken;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    /**
     * Admin-only user creation endpoint.
     * Allows creating ADMIN, WAREHOUSE_MANAGER, or CUSTOMER accounts.
     * Protected by the shared internal service token — never expose this without the token.
     *
     * Usage:
     *   POST /api/auth/admin/create-user
     *   Header: X-Internal-Token: <INTERNAL_SERVICE_TOKEN value>
     *   Body: { "username": "...", "email": "...", "password": "...", "role": "ADMIN" }
     */
    @PostMapping("/admin/create-user")
    public ResponseEntity<AuthResponse> adminCreateUser(
            @RequestHeader(value = "X-Internal-Token", required = false) String token,
            @RequestBody AdminCreateUserRequest request
    ) {
        if (token == null || !token.equals(internalServiceToken)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(authService.adminCreateUser(request));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }
    }
}
