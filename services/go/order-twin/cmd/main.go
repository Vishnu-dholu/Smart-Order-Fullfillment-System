package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/smartfulfillment/order-twin/internal/config"
	"github.com/smartfulfillment/order-twin/internal/database"
	"github.com/smartfulfillment/order-twin/internal/handlers"
)

func main() {
	cfg := config.LoadConfig()
	database.Connect(cfg.DBUrl)

	r := gin.Default()

	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = []string{"http://localhost:5173"}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"*"}
	corsConfig.AllowCredentials = true
	r.Use(cors.New(corsConfig))

	orders := r.Group("/orders")
	{
		orders.POST("", handlers.CreateOrder) // To be implemented in handlers
		orders.GET("", handlers.GetUserOrders)
		orders.GET("/all", handlers.GetAllSystemOrders)
		orders.PUT("/:orderId/status", handlers.UpdateOrderStatus)
	}

	log.Printf("Starting Order Twin on port %s...", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
