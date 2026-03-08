package handlers

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/smartfulfillment/warehouse-service/internal/database"
	"github.com/smartfulfillment/warehouse-service/internal/models"
	"gorm.io/gorm"
)

// 1. Create a New Warehouse
func CreateWarehouse(c *gin.Context) {
	var warehouse models.Warehouse
	if err := c.ShouldBindJSON(&warehouse); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create in DB
	result := database.DB.Create(&warehouse)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	c.JSON(http.StatusCreated, warehouse)
}

// DTO for adding stock
type StockUpdateRequest struct {
	ProductID uuid.UUID `json:"product_id" binding:"required"`
	Quantity  int       `json:"quantity" binding:"required"` // Can be positive (add) or negative (deduct)
}

// 2. Add/Update Stock (Inbound Logic)
func UpdateStock(c *gin.Context) {
	warehouseIDParam := c.Param("warehouse_id")
	warehouseUUID, err := uuid.Parse(warehouseIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Warehouse UUID"})
		return
	}

	var req StockUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var stock models.WarehouseStock

	// Transaction to enure atomic updates
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		// Check if stock entry exists for this product in this warehouse
		result := tx.Where("warehouse_id = ? AND product_id = ?", warehouseUUID, req.ProductID).First(&stock)

		if result.Error == gorm.ErrRecordNotFound {
			// Create new stock entry
			stock = models.WarehouseStock{
				WarehouseID: warehouseUUID,
				ProductID:   req.ProductID,
				Quantity:    req.Quantity,
				UpdatedAt:   time.Now(),
			}
			return tx.Create(&stock).Error
		} else if result.Error != nil {
			return result.Error
		}

		// Update existing stock
		newQuantity := req.Quantity + stock.Quantity
		if newQuantity < 0 {
			// Prevent negative stock
			return gorm.ErrInvalidData
		}

		stock.Quantity = newQuantity
		stock.UpdatedAt = time.Now()
		return tx.Save(&stock).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update stock: " + err.Error()})
		return
	}

	var totalGlobalStock int

	// Query to sum up all stock across ALL warehouses for this specific product
	database.DB.Table("warehouse_stock").
		Where("product_id = ?", req.ProductID).
		Select("COALESCE(SUM(quantity), 0)").
		Scan(&totalGlobalStock)

	// Make HTTP PUT request to Java Inventory Service
	inventoryURL := fmt.Sprintf("http://localhost:8082/products/%s/sync-stock?totalStock=%d", req.ProductID, totalGlobalStock)

	reqHttp, errHttp := http.NewRequest(http.MethodPut, inventoryURL, nil)
	if errHttp == nil {
		client := &http.Client{Timeout: 5 * time.Second}
		resp, errClient := client.Do(reqHttp)
		if errClient != nil {
			log.Printf("Warning: Failed to connect to Inventory Service: %v", errClient)
		} else {
			if resp.StatusCode == http.StatusOK {
				log.Printf("✅ Synced with Inventory Service. New Global Stock: %d", totalGlobalStock)
			} else {
				log.Printf("⚠️ Warning: Java responded with status code: %d", resp.StatusCode)
			}
			resp.Body.Close()
		}
	} else {
		log.Printf("Warning: Failed to create HTTP request: %v", errHttp)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Stock updated successfully", "current_quantity": stock.Quantity, "global_quantity": totalGlobalStock})
}

// 3. Smart Fulfillment: Find Warehouses with Stock
// This is used by the Order Service to decide where to route the order.
func GetStockByProduct(c *gin.Context) {
	productIDParam := c.Param("product_id")

	// Join warehouses and stocks to return location info + quantity
	type StockResult struct {
		WarehouseID uuid.UUID `json:"warehouse_id"`
		Name        string    `json:"warehouse_name"`
		Location    string    `json:"location"`
		Latitude    float64   `json:"latitude"`
		Longitude   float64   `json:"longitude"`
		Quantity    int       `json:"quantity"`
	}

	var results []StockResult

	// SQL: SELECT w.id, w.name. w.location, s.quantity FROM warehouses w JOIN stocks s ...
	err := database.DB.Table("warehouses").
		Select("warehouses.warehouse_id, warehouses.name, warehouses.location, warehouses.latitude, warehouses.longitude, warehouse_stock.quantity").
		Joins("JOIN warehouse_stock ON warehouse_stock.warehouse_id = warehouses.warehouse_id").
		Where("warehouse_stock.product_id = ? AND warehouse_stock.quantity > 0", productIDParam).
		Scan(&results).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}
