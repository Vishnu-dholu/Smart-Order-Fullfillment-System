package com.smartfulfillment.auth_service.controller;

import com.smartfulfillment.auth_service.dto.AuthRequest;
import com.smartfulfillment.auth_service.dto.AuthResponse;
import com.smartfulfillment.auth_service.dto.GoogleLoginRequest;
import com.smartfulfillment.auth_service.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> googleLogin(@RequestBody GoogleLoginRequest request){
        return ResponseEntity.ok(authService.loginWithGoogle(request));
    }
}