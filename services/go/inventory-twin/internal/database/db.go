package database

import (
	"log"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
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

	// Expose sql.DB connection pool stats to Prometheus.
	if err := prometheus.Register(collectors.NewDBStatsCollector(sqlDB, "inventory_db")); err != nil {
		log.Printf("Warning: could not register DBStats collector: %v", err)
	}

	log.Println("Connected to Inventory database successfully with tuned connection pool")
}
