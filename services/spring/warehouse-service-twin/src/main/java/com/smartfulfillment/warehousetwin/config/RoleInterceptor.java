package com.smartfulfillment.warehousetwin.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Arrays;
import java.util.List;

@Component
public class RoleInterceptor implements HandlerInterceptor {

    private final List<String> allowedRoles = Arrays.asList("WAREHOUSE_MANAGER", "ADMIN");

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String userRole = request.getHeader("X-User-Role");

        if (userRole == null || userRole.isEmpty()) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\": \"Missing X-User-Role header\"}");
            return false;
        }

        if (!allowedRoles.contains(userRole)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED); // 401 in Go, or 403 HTTP status theoretically, but Go returns 401. Wait Go says 403 message but 401 status. Let's use 401.
            response.setContentType("application/json");
            response.getWriter().write("{\"error\": \"403 Forbidden. Warehouse Managers and Admins only.\"}");
            return false;
        }

        return true;
    }
}
