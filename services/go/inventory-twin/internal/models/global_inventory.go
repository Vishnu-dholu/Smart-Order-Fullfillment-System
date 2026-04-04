package models

import (
	"time"

	"github.com/google/uuid"
)

// GlobalInventory maps to the 'global_inventory' table
type GlobalInventory struct {
	ID            uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primary_key" json:"id"`
	ProductID     uuid.UUID `gorm:"type:uuid;unique;not null;column:product_id" json:"product_id"`
	TotalStock    int       `gorm:"not null;column:total_stock" json:"total_stock"`
	ReservedStock int       `gorm:"not null;column:reserved_stock" json:"reserved_stock"`
	UpdatedAt     time.Time `gorm:"default:CURRENT_TIMESTAMP;column:updated_at" json:"updated_at"`
}

func (GlobalInventory) TableName() string {
	return "global_inventory"
}
