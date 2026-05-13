package com.smartfulfillment.auth_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AdminCreateUserRequest {
    private String username;
    private String email;
    private String password;
    /** Allowed values: CUSTOMER, WAREHOUSE_MANAGER, ADMIN */
    private String role;
}
