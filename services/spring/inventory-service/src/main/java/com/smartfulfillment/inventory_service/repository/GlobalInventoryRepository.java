package com.smartfulfillment.inventory_service.repository;

import com.smartfulfillment.inventory_service.entity.GlobalInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface GlobalInventoryRepository extends JpaRepository<GlobalInventory, UUID> {
}