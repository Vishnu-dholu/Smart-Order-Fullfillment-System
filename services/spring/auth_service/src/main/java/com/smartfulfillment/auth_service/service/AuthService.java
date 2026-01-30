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
        // 1. Validation
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }

        // 2. Map DTO to Entity
        // Default to CUSTOMER if no role is provided
        String roleStr = (request.getRole() == null) ? Role.CUSTOMER.name() : request.getRole();

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(roleStr)
                .build();

        // 3. Save to DB
        userRepository.save(user);

        // 4. Generate Token immediately (Auto-Login)
        String token = jwtService.generateToken(
                user.getEmail(),
                user.getUsername(),
                user.getRole(),
                user.getUserId()
        );

        return new AuthResponse(token);
    }

    public AuthResponse login(AuthRequest request) {
        // 1. Authenticate (Checks password against DB hash)
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );

        // 2. Fetch User Details (If authentication worked)
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        // 3. Generate Token
        String token = jwtService.generateToken(
                user.getEmail(),
                user.getUsername(),
                user.getRole(),
                user.getUserId()
        );

        return new AuthResponse(token);
    }
}