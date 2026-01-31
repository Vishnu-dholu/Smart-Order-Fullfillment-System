package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/smartfulfillment/warehouse-service/internal/config"
	"github.com/smartfulfillment/warehouse-service/internal/database"
	"github.com/smartfulfillment/warehouse-service/internal/handlers"
	"github.com/smartfulfillment/warehouse-service/internal/models"
)

func main() {
	// Load Configuration
	cfg := config.LoadConfig()

	// Connect to Database
	database.Connect(cfg.DBUrl)

	// Auto-Migrate: This ensures Go structs match your Neon DB tables
	// It won't delete data, just add missing columns/tables if needed.
	database.DB.AutoMigrate(&models.Warehouse{}, &models.WarehouseStock{})

	// Initialize Router
	r := gin.Default()

	// Define Routes
	r.GET("/health", handlers.HealthCheck)

	// Warehouse Routes
	r.POST("/warehouses", handlers.CreateWarehouse)

	// Stock management
	// POST /warehouses/:id/stock -> Add/Remove stock
	r.POST("/warehouses/:warehouse_id/stock", handlers.UpdateStock)

	// GET /stock/:product_id -> Find which warehouses have this item
	r.GET("/stock/:product_id", handlers.GetStockByProduct)

	log.Printf("Starting Warehouse Service on port %s ...", cfg.Port)
	r.Run(":" + cfg.Port)

	// Start Server
	log.Printf("Starting Warehouse Service on port %s...", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal("Failed to start server: ", err)
	}
}
