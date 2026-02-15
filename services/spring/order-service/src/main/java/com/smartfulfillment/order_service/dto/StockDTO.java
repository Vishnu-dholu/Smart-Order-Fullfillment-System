package com.smartfulfillment.order_service.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.UUID;

@Data
public class StockDTO {

    @JsonProperty("warehouse_id")
    private UUID warehouseId;

    @JsonProperty("warehouse_name")
    private String warehouseName;

    private String location;

    private int quantity;
}
