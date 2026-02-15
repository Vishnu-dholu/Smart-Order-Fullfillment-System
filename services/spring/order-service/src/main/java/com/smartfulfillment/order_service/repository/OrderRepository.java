package com.smartfulfillment.order_service.repository;

import com.smartfulfillment.order_service.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {
}
