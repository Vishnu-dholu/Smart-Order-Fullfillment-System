package models

import (
	"time"

	"github.com/google/uuid"
)

// GlobalInventory maps to Spring's GlobalInventory entity and `global_inventory` table.
type GlobalInventory struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;column:id" json:"id"`
	ProductID    uuid.UUID `gorm:"type:uuid;not null;unique;column:product_id" json:"productId"`
	TotalStock   int       `gorm:"not null;column:total_stock" json:"totalStock"`
	ReservedStock int      `gorm:"not null;column:reserved_stock" json:"reservedStock"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (GlobalInventory) TableName() string {
	return "global_inventory"
}

