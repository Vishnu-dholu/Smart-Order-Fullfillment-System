package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"github.com/smartfulfillment/inventory-service-twin/internal/database"
	"github.com/smartfulfillment/inventory-service-twin/internal/models"
	"gorm.io/gorm"
)

// ProductResponse matches Spring's ProductResponse DTO.
type ProductResponse struct {
	ID               uuid.UUID       `json:"id"`
	SKU              string          `json:"sku"`
	Name             string          `json:"name"`
	Description      string          `json:"description,omitempty"`
	Price            decimal.Decimal `json:"price"`
	ImageURL         string          `json:"imageUrl,omitempty"`
	LowStockThreshold int            `json:"lowStockThreshold"`
	TotalStock       int             `json:"totalStock"`
	ReservedStock    int             `json:"reservedStock"`
}

func GetAllProducts(c *gin.Context) {
	// Spring returns a list of ProductResponse with stock fields defaulting to 0.
	type row struct {
		ID               uuid.UUID       `gorm:"column:product_id"`
		SKU              string          `gorm:"column:sku"`
		Name             string          `gorm:"column:name"`
		Description      *string         `gorm:"column:description"`
		Price            decimal.Decimal `gorm:"column:price"`
		ImageURL         *string         `gorm:"column:image_url"`
		LowStockThreshold int            `gorm:"column:low_stock_threshold"`
		TotalStock       int             `gorm:"column:total_stock"`
		ReservedStock    int             `gorm:"column:reserved_stock"`
	}

	var rows []row
	err := database.DB.Table("products p").
		Select(`
			p.product_id, p.sku, p.name, p.description, p.price, p.image_url, p.low_stock_threshold,
			COALESCE(gi.total_stock, 0) as total_stock,
			COALESCE(gi.reserved_stock, 0) as reserved_stock
		`).
		Joins("LEFT JOIN global_inventory gi ON gi.product_id = p.product_id").
		Scan(&rows).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	resp := make([]ProductResponse, 0, len(rows))
	for _, r := range rows {
		var desc string
		if r.Description != nil {
			desc = *r.Description
		}
		var img string
		if r.ImageURL != nil {
			img = *r.ImageURL
		}
		resp = append(resp, ProductResponse{
			ID:               r.ID,
			SKU:              r.SKU,
			Name:             r.Name,
			Description:      desc,
			Price:            r.Price,
			ImageURL:         img,
			LowStockThreshold: r.LowStockThreshold,
			TotalStock:       r.TotalStock,
			ReservedStock:    r.ReservedStock,
		})
	}

	c.JSON(http.StatusOK, resp)
}

func GetProductByID(c *gin.Context) {
	// Match Spring: return Product entity; if missing, runtime exception => 500.
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Product not found"})
		return
	}

	var product models.Product
	if err := database.DB.First(&product, "product_id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Product not found"})
		return
	}
	c.JSON(http.StatusOK, product)
}

func CreateProduct(c *gin.Context) {
	// Match Spring: save product, then initialize global_inventory (0,0), return created product.
	var product models.Product
	if err := c.ShouldBindJSON(&product); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if product.ID == uuid.Nil {
		product.ID = uuid.New()
	}
	if product.LowStockThreshold == 0 {
		product.LowStockThreshold = 10
	}
	if product.CreatedAt.IsZero() {
		product.CreatedAt = time.Now()
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&product).Error; err != nil {
			return err
		}
		inv := models.GlobalInventory{
			ID:            uuid.New(),
			ProductID:     product.ID,
			TotalStock:    0,
			ReservedStock: 0,
			UpdatedAt:     time.Now(),
		}
		return tx.Create(&inv).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, product)
}

func SyncStockFromWarehouse(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("productId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var payload map[string]int
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	absoluteTotal := payload["quantity"]

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		var inv models.GlobalInventory
		res := tx.First(&inv, "product_id = ?", productID)
		if res.Error == gorm.ErrRecordNotFound {
			inv = models.GlobalInventory{
				ID:            uuid.New(),
				ProductID:     productID,
				TotalStock:    absoluteTotal,
				ReservedStock: 0,
				UpdatedAt:     time.Now(),
			}
			return tx.Create(&inv).Error
		}
		if res.Error != nil {
			return res.Error
		}
		inv.TotalStock = absoluteTotal
		inv.UpdatedAt = time.Now()
		return tx.Save(&inv).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusOK)
}

