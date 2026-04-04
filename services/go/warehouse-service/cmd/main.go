package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/smartfulfillment/warehouse-service/internal/config"
	"github.com/smartfulfillment/warehouse-service/internal/database"
	"github.com/smartfulfillment/warehouse-service/internal/handlers"
	// "github.com/smartfulfillment/warehouse-service/internal/models"
)

func main() {
	// Load Configuration
	cfg := config.LoadConfig()

	// Connect to Database
	database.Connect(cfg.DBUrl)

	// Auto-Migrate is commented out to prevent the SQLSTATE 42501 permission error
	// since your tables are already built in Neon.
	// database.DB.AutoMigrate(&models.Warehouse{}, &models.WarehouseStock{})

	// Initialize Router
	r := gin.Default()

	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// --- CORS MIDDLEWARE ---
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = []string{"http://localhost:5173"}
	corsConfig.AllowMethods = []string{"GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization", "X-User-Id", "X-User-Role"}
	corsConfig.AllowCredentials = true
	r.Use(cors.New(corsConfig))

	// Define Routes
	r.GET("/health", handlers.HealthCheck)

	// Warehouse Routes
	r.POST("/warehouses", handlers.CreateWarehouse)

	r.GET("/warehouses", handlers.GetAllWarehouses)

	// Stock management
	// POST /warehouses/:id/stock -> Add/Remove stock
	r.POST("/warehouses/:warehouse_id/stock", handlers.UpdateStock)

	// GET /stock/:product_id -> Find which warehouses have this item
	r.GET("/stock/:product_id", handlers.GetStockByProduct)

	// GET /stock -> Fetch all global inventory (Secure Route)
	r.GET("/stock", handlers.RequireRole("WAREHOUSE_MANAGER", "ADMIN"), handlers.GetAllStock)

	// Start Server (Cleaned up the duplicate run command)
	log.Printf("Starting Warehouse Service on port %s...", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal("Failed to start server: ", err)
	}
}
