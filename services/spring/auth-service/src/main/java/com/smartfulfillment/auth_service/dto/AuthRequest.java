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
    /** Ignored for public {@code /auth/register}; new users are always {@code CUSTOMER}. Kept for API compatibility. */
    private String role;
}
