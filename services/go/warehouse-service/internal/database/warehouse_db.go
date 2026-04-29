package database

import (
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Connect(connectionString string) {
	var err error

	// Open connection to Postgres (Neon)
	DB, err = gorm.Open(postgres.Open(connectionString), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database: ", err)
	}

	// Extract the underlying sql.DB to tune the connection pool
	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatal("Failed to extract sql.DB: ", err)
	}

	// Match Java's tuned HikariCP constraints (P1-A)
	sqlDB.SetMaxOpenConns(50)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	log.Println("Connected to Neon warehouse_db successfully with tuned connection pool")
}
