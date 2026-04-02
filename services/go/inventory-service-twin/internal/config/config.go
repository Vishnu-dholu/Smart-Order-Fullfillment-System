package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DBUrl       string
	Port        string
	AutoMigrate bool
}

func LoadConfig() Config {
	// Try to load .env file for local development, but don't fail if it doesn't exist
	_ = godotenv.Load()

	dbUrl := os.Getenv("DB_URL")
	if dbUrl == "" {
		// Allow the more common DATABASE_URL too
		dbUrl = os.Getenv("DATABASE_URL")
	}
	if dbUrl == "" {
		log.Fatal("DB_URL (or DATABASE_URL) is not set in environment")
	}

	port := os.Getenv("PORT")
	if port == "" {
		// Keep twin side-by-side friendly by default
		port = "9082"
	}

	autoMigrate := strings.EqualFold(os.Getenv("AUTO_MIGRATE"), "true")

	return Config{
		DBUrl:       dbUrl,
		Port:        port,
		AutoMigrate: autoMigrate,
	}
}

