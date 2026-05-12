package com.smartfulfillment.api_gateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import reactor.core.publisher.Mono;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.List;

@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .cors(Customizer.withDefaults())
                .authorizeExchange(exchanges -> exchanges
                        .pathMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .pathMatchers("/api/auth/**").permitAll()
                        .pathMatchers("/actuator/health", "/actuator/info").permitAll()
                        .pathMatchers(HttpMethod.POST, "/api/products/**").hasRole("ADMIN")
                        .pathMatchers(HttpMethod.GET, "/api/orders/all").hasAnyRole("ADMIN", "WAREHOUSE_MANAGER")
                        .pathMatchers(HttpMethod.PUT, "/api/orders/*/status").hasAnyRole("ADMIN", "WAREHOUSE_MANAGER")
                        .pathMatchers(HttpMethod.GET, "/api/warehouse/stock/**").hasAnyRole("ADMIN", "WAREHOUSE_MANAGER")
                        .pathMatchers(HttpMethod.POST, "/api/warehouse/**").hasAnyRole("ADMIN", "WAREHOUSE_MANAGER")
                        .anyExchange().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwtSpec ->
                        jwtSpec.jwtAuthenticationConverter(this::jwtAuthenticationConverter)
                ))
                .build();
    }

    @Bean
    public ReactiveJwtDecoder reactiveJwtDecoder() {
        byte[] keyBytes = decodeSecret(jwtSecret);
        SecretKeySpec secretKey = new SecretKeySpec(keyBytes, "HmacSHA256");
        return NimbusReactiveJwtDecoder.withSecretKey(secretKey).build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration corsConfiguration = new CorsConfiguration();
        corsConfiguration.setAllowedOrigins(List.of("http://localhost:5173", "http://localhost", "http://localhost:8080", "http://localhost:8888"));
        corsConfiguration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        corsConfiguration.setAllowedHeaders(List.of("*"));
        corsConfiguration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfiguration);
        return source;
    }

    private byte[] decodeSecret(String secret) {
        if (!StringUtils.hasText(secret)) {
            throw new IllegalStateException("jwt.secret must be configured");
        }

        try {
            return Base64.getDecoder().decode(secret);
        } catch (IllegalArgumentException ignored) {
            return secret.getBytes(StandardCharsets.UTF_8);
        }
    }

    private Mono<JwtAuthenticationToken> jwtAuthenticationConverter(Jwt jwt) {
        return Mono.just(new JwtAuthenticationToken(jwt, extractAuthorities(jwt)));
    }

    private Collection<GrantedAuthority> extractAuthorities(Jwt jwt) {
        List<GrantedAuthority> authorities = new ArrayList<>();
        Object roleClaim = jwt.getClaims().get("role");
        if (roleClaim == null) {
            return authorities;
        }

        if (roleClaim instanceof String role) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()));
            return authorities;
        }

        if (roleClaim instanceof Collection<?> roles) {
            for (Object item : roles) {
                if (item != null) {
                    authorities.add(new SimpleGrantedAuthority("ROLE_" + item.toString().toUpperCase()));
                }
            }
        }

        return authorities;
    }
}
