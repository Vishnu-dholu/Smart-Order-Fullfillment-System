// @title Notification Service API
// @version 1.0
// @description API for managing notifications
// @host localhost:8086
// @BasePath /
package main

import (
	"log"
	"os"

	_ "github.com/Vishnu-dholu/Smart-Order-Fullfillment-System/services/go/notification-service/docs"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/Vishnu-dholu/Smart-Order-Fullfillment-System/services/go/notification-service/internal/database"
	"github.com/Vishnu-dholu/Smart-Order-Fullfillment-System/services/go/notification-service/internal/handlers"
)

func main() {
	// Load the .env file for local development
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found. Relying on system environment variables.")
	}

	// Fetch connection string
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	// Connect to Database
	database.Connect(dbURL)

	r := gin.Default()

	// CORS Configuration
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"*"} // Internal microservice, open CORS is fine for now
	config.AllowMethods = []string{"GET", "POST"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept"}
	r.Use(cors.New(config))

	// Routes
	r.POST("/notifications", handlers.SendNotification)
	r.GET("/notifications/:user_id", handlers.GetUserNotifications)

	// Swagger API docs
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	log.Println("Notification Service running on port 8086")
	r.Run(":8086")
}
