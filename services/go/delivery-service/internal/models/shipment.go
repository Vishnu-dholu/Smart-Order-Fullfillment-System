package models

import (
	"time"

	"github.com/google/uuid"
)

type Shipment struct {
	ID                uuid.UUID `gorm:"type:uuid;default:uuid_generate_v4();primaryKey" json:"id"`
	OrderID           string    `gorm:"type:varchar(36);not null;index" json:"order_id"`
	TrackingNumber    string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"tracking_number"`
	Status            string    `gorm:"type:varchar(50);not null;default:'DISPATCHED'" json:"status"`
	CurrentLocation   string    `gorm:"type:varchar(255)" json:"current_location"`
	EstimatedDelivery time.Time `json:"estimated_delivery"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

func (Shipment) TableName() string {
	return "shipments"
}
