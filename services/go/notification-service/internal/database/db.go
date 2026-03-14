package database

import (
	"log"

	"github.com/Vishnu-dholu/Smart-Order-Fullfillment-System/services/go/notification-service/internal/models"
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

	log.Println("Connected to Neon notification_db successfully")

	// Auto-migrate the notifications table
	err = DB.AutoMigrate(&models.Notification{})
	if err != nil {
		log.Println("Warning: AutoMigrate failed: ", err)
	}
}
