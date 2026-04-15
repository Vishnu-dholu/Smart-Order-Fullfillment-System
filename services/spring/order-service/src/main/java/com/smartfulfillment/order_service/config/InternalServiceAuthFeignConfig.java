package com.smartfulfillment.order_service.config;

import feign.RequestInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class InternalServiceAuthFeignConfig {

    @Value("${internal.service.token}")
    private String internalServiceToken;

    @Bean
    public RequestInterceptor internalServiceAuthRequestInterceptor() {
        return template -> template.header("X-Internal-Token", internalServiceToken);
    }
}
