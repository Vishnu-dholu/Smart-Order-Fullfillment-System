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

	// Extract the underlying sql.DB to tune the connection pool
	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatal("Failed to extract sql.DB: ", err)
	}

	// Match Java's tuned HikariCP constraints (P1-A)
	sqlDB.SetMaxOpenConns(50)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	// Expose sql.DB connection pool stats to Prometheus.
	// Metrics: go_sql_open_connections, go_sql_in_use (≈ hikaricp_connections_active),
	//          go_sql_idle, go_sql_wait_count_total (≈ hikaricp_connections_pending trend)
	if err := prometheus.Register(collectors.NewDBStatsCollector(sqlDB, "order_db")); err != nil {
		log.Printf("Warning: could not register DBStats collector: %v", err)
	}

	log.Println("Connected to Order database successfully with tuned connection pool")
}
