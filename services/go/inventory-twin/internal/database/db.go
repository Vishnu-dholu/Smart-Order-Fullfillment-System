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
	DB, err = gorm.Open(postgres.Open(connectionString), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database: ", err)
	}

	// P1-A: Equalize Database Connection Pool Sizes
	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatal("Failed to extract sql.DB: ", err)
	}

	// Match Java's tuned HikariCP constraints
	sqlDB.SetMaxOpenConns(50)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	log.Println("Connected to Inventory database successfully with tuned connection pool")
}
