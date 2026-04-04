package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBUrl               string
	Port                string
	InventoryServiceURL string
	WarehouseServiceURL string
	DeliveryServiceURL  string
	NotificationURL     string
}

func LoadConfig() Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	return Config{
		DBUrl:               getEnv("DB_URL", "postgresql://order_admin:order_admin(123)@ep-round-frost-a10slzy6-pooler.ap-southeast-1.aws.neon.tech/order_db?sslmode=require"),
		Port:                getEnv("PORT", "9083"),
		InventoryServiceURL: getEnv("INVENTORY_SERVICE_URL", "http://localhost:8082"),
		WarehouseServiceURL: getEnv("WAREHOUSE_SERVICE_URL", "http://localhost:8084"),
		DeliveryServiceURL:  getEnv("DELIVERY_SERVICE_URL", "http://localhost:8085"),
		NotificationURL:     getEnv("NOTIFICATION_SERVICE_URL", "http://localhost:8086"),
	}
}

func getEnv(key, defaultVal string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultVal
}
