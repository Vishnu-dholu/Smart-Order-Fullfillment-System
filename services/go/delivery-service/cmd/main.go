// @title Delivery Service API
// @version 1.0
// @description API for managing deliveries
// @host localhost:8085
// @BasePath /
package main

import (
	"log"
	"math/rand"

	_ "github.com/Vishnu-dholu/Smart-Order-Fullfillment-System/services/go/delivery-service/docs"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/Vishnu-dholu/Smart-Order-Fullfillment-System/services/go/delivery-service/internal/database"
	"github.com/Vishnu-dholu/Smart-Order-Fullfillment-System/services/go/delivery-service/internal/handlers"
)

func main() {
	// Seed random number generator for tracking numbers
	rand.Seed(time.Now().UnixNano())

	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found. Relying on system environment variables.")
	}

	// Fetch connection string from environment variable (Now it will find it!)
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	// Connect to Database
	database.Connect(dbURL)

	r := gin.Default()

	// CORS Configuration
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"http://localhost:5173"}
	config.AllowMethods = []string{"GET", "POST", "PUT"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "X-User-Id", "X-User-Role"}
	config.AllowCredentials = true
	r.Use(cors.New(config))

	// Routes
	r.POST("/deliveries", handlers.CreateDelivery)
	r.GET("/deliveries/order/:orderId", handlers.GetDeliveryByOrderID)
	r.PUT("/deliveries/:trackingNumber/status", handlers.UpdateDeliveryStatus)

	// Swagger API docs
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	log.Println("Delivery Service running on port 8085")
	r.Run(":8085")
}
