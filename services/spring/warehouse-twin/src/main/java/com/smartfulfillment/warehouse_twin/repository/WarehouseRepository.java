package com.smartfulfillment.warehouse_twin.repository;

import com.smartfulfillment.warehouse_twin.entity.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface WarehouseRepository extends JpaRepository<Warehouse, UUID> {
}