// @title Inventory Service Twin API
// @version 1.0
// @description Go twin matching Spring inventory-service.
// @host localhost:8082
// @BasePath /
package main

import (
	"log"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/smartfulfillment/inventory-service-twin/internal/config"
	"github.com/smartfulfillment/inventory-service-twin/internal/database"
	"github.com/smartfulfillment/inventory-service-twin/internal/handlers"
	"github.com/smartfulfillment/inventory-service-twin/internal/models"
)

func main() {
	cfg := config.LoadConfig()

	database.Connect(cfg.DBUrl)

	if cfg.AutoMigrate {
		if err := database.DB.AutoMigrate(&models.Product{}, &models.GlobalInventory{}); err != nil {
			log.Fatalf("AutoMigrate failed: %v", err)
		}
	}

	r := gin.Default()

	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = []string{"http://localhost:5173"}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"authorization"}
	corsConfig.AllowCredentials = true
	corsConfig.MaxAge = 1800 * time.Second
	r.Use(cors.New(corsConfig))

	r.GET("/products", handlers.GetAllProducts)
	r.GET("/products/:id", handlers.GetProductByID)
	r.POST("/products", handlers.CreateProduct)
	r.PUT("/products/:productId/sync-stock", handlers.SyncStockFromWarehouse)

	log.Printf("Starting Inventory Service Twin on port %s...", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal("Failed to start server: ", err)
	}
}

