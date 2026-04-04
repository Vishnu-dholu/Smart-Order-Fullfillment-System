package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBUrl string
	Port  string
}

func LoadConfig() Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	return Config{
		// Default to Neon DB if env var is missing
		DBUrl: getEnv("DB_URL", "postgresql://inventory_admin:inventory_admin(123)@ep-round-frost-a10slzy6-pooler.ap-southeast-1.aws.neon.tech/inventory_db?sslmode=require"),
		// The Twin runs on 9082 (Java runs on 8082)
		Port: getEnv("PORT", "9082"),
	}
}

func getEnv(key, defaultVal string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultVal
}
