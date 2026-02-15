package com.smartfulfillment.auth_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AuthRequest {
    private String username;
    private String email;
    private String password;
    // We accept role as String to avoid JSON parsing errors,
    // but we will validate it against our Enum in the service.
    private String role;
}
