package models

import (
	"time"

	"github.com/google/uuid"
)

// Maps exactly to your "notifications" table
type Notification struct {
	NotificationID uuid.UUID  `gorm:"column:notification_id;type:uuid;default:gen_random_uuid();primaryKey" json:"notification_id"`
	UserID         uuid.UUID  `gorm:"column:user_id;type:uuid;not null" json:"user_id"`
	OrderID        *uuid.UUID `gorm:"column:order_id;type:uuid" json:"order_id"` // Pointer allows it to be NULL
	Type           string     `gorm:"column:type;type:varchar(50);not null" json:"type"`
	Status         string     `gorm:"column:status;type:varchar(20);not null;default:'SENT'" json:"status"`
	SentAt         time.Time  `gorm:"column:sent_at;autoCreateTime" json:"sent_at"`
}

// Forces GORM to use your exact table name instead of guessing
func (Notification) TableName() string {
	return "notifications"
}
