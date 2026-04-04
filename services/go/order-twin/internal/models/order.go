package models

import (
	"time"

	"github.com/google/uuid"
)

type OrderStatus string

const (
	Created          OrderStatus = "CREATED"
	PendingInventory OrderStatus = "PENDING_INVENTORY"
	Confirmed        OrderStatus = "CONFIRMED"
	Shipped          OrderStatus = "SHIPPED"
	Delivered        OrderStatus = "DELIVERED"
	Cancelled        OrderStatus = "CANCELLED"
)

type Order struct {
	OrderID         uuid.UUID   `gorm:"type:uuid;default:gen_random_uuid();primary_key" json:"orderId"`
	UserID          uuid.UUID   `gorm:"type:uuid;not null;column:user_id" json:"userId"`
	TotalAmount     float64     `gorm:"type:numeric;not null;column:total_amount" json:"totalAmount"`
	Status          OrderStatus `gorm:"type:varchar;not null" json:"status"`
	ShippingAddress string      `gorm:"type:text;not null;column:shipping_address" json:"shippingAddress"`
	Items           []OrderItem `gorm:"foreignkey:OrderID" json:"items"`
	CreatedAt       time.Time   `gorm:"default:CURRENT_TIMESTAMP;column:created_at" json:"createdAt"`
	UpdatedAt       time.Time   `gorm:"default:CURRENT_TIMESTAMP;column:updated_at" json:"updatedAt"`
}

type OrderItem struct {
	ID              uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primary_key" json:"id"`
	OrderID         uuid.UUID `gorm:"type:uuid;not null;column:order_id" json:"-"`
	ProductID       uuid.UUID `gorm:"type:uuid;not null;column:product_id" json:"productId"`
	Quantity        int       `gorm:"not null" json:"quantity"`
	PriceAtPurchase float64   `gorm:"type:numeric;not null;column:price_at_purchase" json:"priceAtPurchase"`
}
