package com.smartfulfillment.warehouse_twin.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StockResponse {
    @JsonProperty("warehouse_id")
    private UUID warehouseId;

    @JsonProperty("warehouse_name")
    private String warehouseName;

    private String location;

    @JsonProperty("product_id")
    private UUID productId;

    private Long quantity;
    private Double latitude;
    private Double longitude;
}