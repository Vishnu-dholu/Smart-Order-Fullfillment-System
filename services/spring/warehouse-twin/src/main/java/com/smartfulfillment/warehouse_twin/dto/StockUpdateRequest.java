package com.smartfulfillment.warehouse_twin.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.UUID;

@Data
public class StockUpdateRequest {
    @JsonProperty("product_id")
    private UUID productId;
    private Integer quantity;
}
