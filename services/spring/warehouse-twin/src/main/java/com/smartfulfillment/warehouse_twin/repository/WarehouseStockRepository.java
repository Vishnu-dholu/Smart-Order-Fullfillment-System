package com.smartfulfillment.warehouse_twin.repository;

import com.smartfulfillment.warehouse_twin.entity.WarehouseStock;
import com.smartfulfillment.warehouse_twin.dto.StockResponse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.UUID;
import java.util.List;

public interface WarehouseStockRepository extends JpaRepository<WarehouseStock, UUID> {

    Optional<WarehouseStock> findByWarehouseIdAndProductId(UUID warehouseId, UUID productId);

    @Query("SELECT COALESCE(SUM(ws.quantity), 0) FROM WarehouseStock ws WHERE ws.productId = :productId")
    Integer getTotalGlobalStockByProductId(@Param("productId") UUID productId);

    // Matches the custom JOIN in Go's GetStockByProduct
    @Query("SELECT new com.smartfulfillment.warehouse_twin.dto.StockResponse(w.warehouseId, w.name, w.location, ws.productId, CAST(ws.quantity AS long), w.latitude, w.longitude) " +
            "FROM Warehouse w JOIN WarehouseStock ws ON w.warehouseId = ws.warehouseId " +
            "WHERE ws.productId = :productId AND ws.quantity > 0")
    List<StockResponse> findStockByProductId(@Param("productId") UUID productId);

    // Matches the custom JOIN in Go's GetAllStock
    @Query("SELECT new com.smartfulfillment.warehouse_twin.dto.StockResponse(w.warehouseId, w.name, w.location, ws.productId, CAST(ws.quantity AS long), w.latitude, w.longitude) " +
            "FROM WarehouseStock ws LEFT JOIN Warehouse w ON ws.warehouseId = w.warehouseId")
    List<StockResponse> findAllGlobalStock();
}