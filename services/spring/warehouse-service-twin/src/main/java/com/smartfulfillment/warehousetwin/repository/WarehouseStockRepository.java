package com.smartfulfillment.warehousetwin.repository;

import com.smartfulfillment.warehousetwin.entity.WarehouseStock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WarehouseStockRepository extends JpaRepository<WarehouseStock, UUID> {

    Optional<WarehouseStock> findByWarehouseIdAndProductId(UUID warehouseId, UUID productId);

    @Query("SELECT SUM(ws.quantity) FROM WarehouseStock ws WHERE ws.productId = :productId")
    Integer getTotalGlobalStockByProductId(@Param("productId") UUID productId);

    @Query(value = "SELECT CAST(w.warehouse_id AS varchar) as warehouse_id, w.name as warehouse_name, w.location as location, w.latitude as latitude, w.longitude as longitude, ws.quantity as quantity " +
            "FROM warehouses w JOIN warehouse_stock ws ON w.warehouse_id = ws.warehouse_id " +
            "WHERE ws.product_id = :productId AND ws.quantity > 0", nativeQuery = true)
    List<Object[]> findStockLocationByProductIdNative(@Param("productId") UUID productId);

    @Query(value = "SELECT CAST(ws.warehouse_id AS varchar) as warehouseId, w.name as warehouseName, w.location as location, CAST(ws.product_id AS varchar) as productId, ws.quantity as quantity, w.latitude as latitude, w.longitude as longitude " +
            "FROM warehouse_stock ws LEFT JOIN warehouses w ON w.warehouse_id = ws.warehouse_id", nativeQuery = true)
    List<Object[]> findAllGlobalStockNative();
}
