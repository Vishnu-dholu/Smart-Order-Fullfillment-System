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
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	dbUrl := os.Getenv("DB_URL")
	if dbUrl == "" {
		dbUrl = "postgresql://warehouse_admin:warehouse_admin%28123%29@ep-round-frost-a10slzy6-pooler.ap-southeast-1.aws.neon.tech/warehouse_db?sslmode=require&channel_binding=require"
		log.Println("DB_URL not set in env, using default fallback")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8084"
	}

	return Config{
		DBUrl: dbUrl,
		Port:  port,
	}
}
