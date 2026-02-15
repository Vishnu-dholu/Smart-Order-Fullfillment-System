package com.smartfulfillment.auth_service.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.smartfulfillment.auth_service.dto.AuthRequest;
import com.smartfulfillment.auth_service.dto.AuthResponse;
import com.smartfulfillment.auth_service.dto.GoogleLoginRequest;
import com.smartfulfillment.auth_service.entity.Role;
import com.smartfulfillment.auth_service.entity.User;
import com.smartfulfillment.auth_service.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    @Value("${google.client.id}")
    private String googleClientId;

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

    public AuthResponse loginWithGoogle(GoogleLoginRequest request){
        try{
            // 1. Verify the Token with Google
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(new NetHttpTransport(), new GsonFactory())
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(request.getIdToken());

            if(idToken == null){
                throw new RuntimeException("Invalid Google ID Token");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();

            // 2. Get User Info
            String email = payload.getEmail();
            String name = (String) payload.get("name");

//            if(name == null){
//                name = email.split("@")[0];
//            }

//            String finalName = name;

            // 3. Check if user exists, if not, register them
            User user = userRepository.findByEmail(email).orElseGet(() -> {
                return userRepository.save(User.builder()
                        .username(name.replace(" ", "_").toLowerCase() + "_" + UUID.randomUUID().toString().substring(0, 4))
                        .email(email)
                        .role(Role.CUSTOMER.name())
                        .passwordHash(passwordEncoder.encode("GOOGLE_AUTH_USER"))
                        .build());
            });

            // 4. Generate OUR JWT Token
            String jwtToken = jwtService.generateToken(
                    user.getEmail(),
                    user.getUsername(),
                    user.getRole(),
                    user.getUserId()
            );

            return new AuthResponse(jwtToken);

        } catch (GeneralSecurityException | IOException e){
            throw new RuntimeException("Failed to verify Google Token", e);
        }
    }
}