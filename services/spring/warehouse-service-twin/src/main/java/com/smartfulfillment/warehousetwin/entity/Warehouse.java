package com.smartfulfillment.warehousetwin.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.UUID;
import java.util.List;

@Entity
@Table(name = "warehouses")
@Data
@NoArgsConstructor
public class Warehouse {

    @Id
    @Column(name = "warehouse_id", updatable = false, nullable = false)
    @JsonProperty("warehouse_id")
    private UUID warehouseId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "location", nullable = false)
    private String location;

    @Column(name = "latitude", nullable = false)
    private Double latitude;

    @Column(name = "longitude", nullable = false)
    private Double longitude;

    @Column(name = "capacity", nullable = false)
    private Integer capacity;

    @OneToMany(mappedBy = "warehouse")
    @JsonIgnore
    private List<WarehouseStock> stocks;

    @PrePersist
    void ensureId() {
        if (warehouseId == null) {
            warehouseId = UUID.randomUUID();
        }
    }
}
