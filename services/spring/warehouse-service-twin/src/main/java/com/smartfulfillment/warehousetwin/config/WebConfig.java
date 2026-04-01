package com.smartfulfillment.warehousetwin.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Autowired
    private RoleInterceptor roleInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Apply only to GET /stock matching the Go implementation which maps r.GET("/stock", RequireRole...)
        // We will exclude POST /warehouses/{id}/stock and GET /stock/{id}
        registry.addInterceptor(roleInterceptor)
                .addPathPatterns("/stock")
                .excludePathPatterns("/stock/*");
    }
}
