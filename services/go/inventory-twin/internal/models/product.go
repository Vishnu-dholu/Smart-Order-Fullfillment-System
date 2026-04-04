package models

import (
	"time"

	"github.com/google/uuid"
)

// Product maps to the 'products' table
type Product struct {
	ID                uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primary_key;column:product_id" json:"id"`
	SKU               string    `gorm:"type:varchar(50);unique;not null;column:sku" json:"sku"`
	Name              string    `gorm:"type:varchar(100);not null;column:name" json:"name"`
	Description       string    `gorm:"type:text;column:description" json:"description"`
	Price             float64   `gorm:"type:numeric(10,2);not null;column:price" json:"price"`
	ImageURL          string    `gorm:"type:varchar;column:image_url" json:"imageUrl"`
	CreatedAt         time.Time `gorm:"default:CURRENT_TIMESTAMP;column:created_at" json:"createdAt"`
	LowStockThreshold int       `gorm:"default:10;not null;column:low_stock_threshold" json:"lowStockThreshold"`
}

// ProductResponse matches the DTO
type ProductResponse struct {
	ID                uuid.UUID `json:"id"`
	SKU               string    `json:"sku"`
	Name              string    `json:"name"`
	Description       string    `json:"description"`
	Price             float64   `json:"price"`
	ImageURL          string    `json:"imageUrl"`
	LowStockThreshold int       `json:"lowStockThreshold"`
	TotalStock        int       `json:"totalStock"`
	ReservedStock     int       `json:"reservedStock"`
}
