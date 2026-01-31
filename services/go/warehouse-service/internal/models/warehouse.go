package models

import (
	"github.com/google/uuid"
	"time"
)

// Maps to 'warehouses' table
type Warehouse struct {
	WarehouseID uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primary_key" json:"warehouse_id"`
	Name        string    `gorm:"not null" json:"name"`
	Location    string    `gorm:"not null" json:"location"`
	Capacity    int       `gorm:"not null" json:"capacity"`
	// Relationship: One Warehouse has many Stock entries
	Stocks []WarehouseStock `gorm:"foreignkey:WarehouseID" json:"stocks,omitempty"`
}

func (Warehouse) TableName() string {
	return "warehouses"
}

// Maps to 'warehouse_stock' table
type WarehouseStock struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primary_key" json:"id"`
	WarehouseID uuid.UUID `gorm:"type:uuid;not null" json:"warehouse_id"`
	ProductID   uuid.UUID `gorm:"type:uuid;not null" json:"product_id"` // Reference to Inventory Service
	Quantity    int       `gorm:"not null" json:"quantity"`
	UpdatedAt   time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (WarehouseStock) TableName() string {
	return "warehouse_stock"
}
