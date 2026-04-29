package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	ginprometheus "github.com/zsais/go-gin-prometheus"
	"github.com/smartfulfillment/inventory-twin/internal/config"
	"github.com/smartfulfillment/inventory-twin/internal/database"
	"github.com/smartfulfillment/inventory-twin/internal/handlers"
)

func main() {
	cfg := config.LoadConfig()
	database.Connect(cfg.DBUrl)

	r := gin.Default()

	// P2-A: HTTP Latency Histogram Middleware
	p := ginprometheus.NewPrometheus("gin")
	p.Use(r)

	// CORS Setup
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = []string{"http://localhost:5173"}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"*"}
	corsConfig.AllowCredentials = true
	r.Use(cors.New(corsConfig))

	// Routes
	r.GET("/ping", handlers.Ping)

	products := r.Group("/products")
	{
		products.GET("", handlers.GetAllProductsWithStock)
		products.GET("/:id", handlers.GetProductById)
		products.POST("", handlers.CreateProduct)
		products.PUT("/:productId/sync-stock", handlers.SyncStockFromWarehouse)
	}

	log.Printf("Starting Inventory Twin on port %s...", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
