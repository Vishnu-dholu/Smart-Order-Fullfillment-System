// @title Warehouse Service API
// @version 1.0
// @description API for managing warehouses and global stock.
// @securityDefinitions.apikey BearerAuth
// @in header
// @name X-User-Role
// @host localhost:8084
// @BasePath /
package main

import (
	"os"
	"strings"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	_ "github.com/smartfulfillment/warehouse-service/docs"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/smartfulfillment/warehouse-service/internal/config"
	"github.com/smartfulfillment/warehouse-service/internal/database"
	"github.com/smartfulfillment/warehouse-service/internal/handlers"
)

func main() {
	// Init once at startup:
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.With().Str("service", "warehouse-service").Logger()

	// Load Configuration
	cfg := config.LoadConfig()

	// Connect to Database
	database.Connect(cfg.DBUrl)

	// Auto-Migrate is commented out to prevent the SQLSTATE 42501 permission error
	// since your tables are already built in Neon.
	// database.DB.AutoMigrate(&models.Warehouse{}, &models.WarehouseStock{})

	// Initialize Router
	r := gin.Default()

	// --- CORS MIDDLEWARE ---
	corsConfig := cors.DefaultConfig()
	corsOrigin := os.Getenv("CORS_ALLOWED_ORIGINS")
	if corsOrigin == "" {
		corsOrigin = "http://localhost:5173"
	}
	// Support comma-separated list of allowed origins
	var allowedOrigins []string
	for _, o := range strings.Split(corsOrigin, ",") {
		if trimmed := strings.TrimSpace(o); trimmed != "" {
			allowedOrigins = append(allowedOrigins, trimmed)
		}
	}
	corsConfig.AllowOrigins = allowedOrigins
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

	// NEW: GET /stock -> Fetch all global inventory (Secure Route)
	r.GET("/stock", handlers.RequireRole("WAREHOUSE_MANAGER", "ADMIN"), handlers.GetAllStock)

	// Swagger API docs
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Start Server
	log.Info().Msgf("Starting Warehouse Service on port %s...", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal().Err(err).Msg("Failed to start server")
	}
}
