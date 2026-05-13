package com.smartfulfillment.auth_service.service;

import com.smartfulfillment.auth_service.dto.AuthRequest;
import com.smartfulfillment.auth_service.dto.AuthResponse;
import com.smartfulfillment.auth_service.entity.Role;
import com.smartfulfillment.auth_service.entity.User;
import com.smartfulfillment.auth_service.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthResponse register(AuthRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }

        // Self-service registration must not trust client-supplied role (would allow ADMIN/WAREHOUSE_MANAGER escalation).
        String roleStr = Role.CUSTOMER.name();

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(roleStr)
                .build();

        userRepository.save(user);

        String token = jwtService.generateToken(
                user.getEmail(),
                user.getUsername(),
                user.getRole(),
                user.getUserId()
        );

        return new AuthResponse(token);
    }

    public AuthResponse login(AuthRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        String token = jwtService.generateToken(
                user.getEmail(),
                user.getUsername(),
                user.getRole(),
                user.getUserId()
        );

        return new AuthResponse(token);
    }
}
