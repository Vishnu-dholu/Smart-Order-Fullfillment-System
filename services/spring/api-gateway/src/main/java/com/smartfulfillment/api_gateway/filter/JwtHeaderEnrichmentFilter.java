package com.smartfulfillment.api_gateway.filter;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import java.util.UUID;

@Component
@Slf4j
public class JwtHeaderEnrichmentFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        if (path.startsWith("/api/auth/")) {
            return chain.filter(exchange);
        }

        return exchange.getPrincipal()
                .cast(JwtAuthenticationToken.class)
                .flatMap(jwtAuthToken -> {
                    String userId = claimAsString(jwtAuthToken, "userId");
                    String userRole = claimAsString(jwtAuthToken, "role");
                    String userEmail = jwtAuthToken.getToken().getSubject();
                    String method = exchange.getRequest().getMethod().name();

                    MDC.put("trace_id", UUID.randomUUID().toString().substring(0, 8));
                    MDC.put("user_role", userRole);
                    MDC.put("user_id", userId);
                    log.info("Forwarding request: {} {} as role={}", method, path, userRole);

                    ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                            .headers(headers -> {
                                headers.remove("X-User-Id");
                                headers.remove("X-User-Role");
                                headers.remove("X-User-Email");
                                if (userId != null) {
                                    headers.set("X-User-Id", userId);
                                }
                                if (userRole != null) {
                                    headers.set("X-User-Role", userRole);
                                }
                                if (userEmail != null) {
                                    headers.set("X-User-Email", userEmail);
                                }
                            })
                            .build();

                    return chain.filter(exchange.mutate().request(mutatedRequest).build());
                })
                .switchIfEmpty(chain.filter(exchange))
                .onErrorResume(ClassCastException.class, ex -> chain.filter(exchange));
    }

    @Override
    public int getOrder() {
        return -1;
    }

    private String claimAsString(JwtAuthenticationToken jwtAuthToken, String claimName) {
        Object value = jwtAuthToken.getToken().getClaims().get(claimName);
        return value == null ? null : String.valueOf(value);
    }
}
