package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// Product maps to Spring's Product entity and `products` table.
type Product struct {
	ID               uuid.UUID       `gorm:"type:uuid;primaryKey;column:product_id" json:"id"`
	SKU              string          `gorm:"not null;unique;size:50" json:"sku"`
	Name             string          `gorm:"not null;size:100" json:"name"`
	Description      string          `gorm:"type:text" json:"description,omitempty"`
	Price            decimal.Decimal `gorm:"not null;type:numeric(10,2)" json:"price"`
	ImageURL         string          `gorm:"column:image_url" json:"imageUrl,omitempty"`
	CreatedAt        time.Time       `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	LowStockThreshold int            `gorm:"column:low_stock_threshold;not null;default:10" json:"lowStockThreshold"`
}

func (Product) TableName() string {
	return "products"
}

