package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/smartfulfillment/inventory-twin/internal/database"
	"github.com/smartfulfillment/inventory-twin/internal/models"
	"gorm.io/gorm"
)

// GetAllProductsWithStock matches GET /products
func GetAllProductsWithStock(c *gin.Context) {
	var products []models.Product
	if err := database.DB.Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch products"})
		return
	}

	var responses []models.ProductResponse

	// In Go, it's often faster to fetch all inventory at once, but to perfectly match
	// the Java logic for benchmarking, we will fetch them iteratively (N+1 query pattern).
	for _, product := range products {
		var inventory models.GlobalInventory
		err := database.DB.Where("product_id = ?", product.ID).First(&inventory).Error

		totalStock := 0
		reservedStock := 0
		if err == nil {
			totalStock = inventory.TotalStock
			reservedStock = inventory.ReservedStock
		} else if err != gorm.ErrRecordNotFound {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch inventory"})
			return
		}

		responses = append(responses, models.ProductResponse{
			ID:                product.ID,
			SKU:               product.SKU,
			Name:              product.Name,
			Description:       product.Description,
			Price:             product.Price,
			ImageURL:          product.ImageURL,
			LowStockThreshold: product.LowStockThreshold,
			TotalStock:        totalStock,
			ReservedStock:     reservedStock,
		})
	}

	c.JSON(http.StatusOK, responses)
}

// GetProductById matches GET /products/{id}
func GetProductById(c *gin.Context) {
	productIDParam := c.Param("id")
	productUUID, err := uuid.Parse(productIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Product ID"})
		return
	}

	var product models.Product
	if err := database.DB.First(&product, "product_id = ?", productUUID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch product"})
		return
	}
	c.JSON(http.StatusOK, product)
}

// CreateProduct matches POST /products
func CreateProduct(c *gin.Context) {
	var product models.Product
	if err := c.ShouldBindJSON(&product); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Transaction to ensure both product and inventory are created atomically
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		// Save the Product
		if err := tx.Create(&product).Error; err != nil {
			return err
		}

		// Initialize Global Inventory (Stock = 0)
		inventory := models.GlobalInventory{
			ProductID:     product.ID,
			TotalStock:    0,
			ReservedStock: 0,
		}

		return tx.Create(&inventory).Error
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create product"})
		return
	}

	c.JSON(http.StatusCreated, product)
}

// SyncStockFromWarehouse matches PUT /products/{productId}/sync-stock
func SyncStockFromWarehouse(c *gin.Context) {
	productIDParam := c.Param("productId")
	productUUID, err := uuid.Parse(productIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Product ID"})
		return
	}

	var payload map[string]int
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Extract the absolute total calculated by Go
	absoluteTotal := 0
	if val, ok := payload["quantity"]; ok {
		absoluteTotal = val
	}

	// Overwrite the database with Go's absolute truth
	var inventory models.GlobalInventory
	err = database.DB.Where("product_id = ?", productUUID).First(&inventory).Error

	if err != nil {
		if err != gorm.ErrRecordNotFound {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sync stock"})
			return
		}
		// Create if not exists
		inventory = models.GlobalInventory{
			ProductID:     productUUID,
			TotalStock:    absoluteTotal,
			ReservedStock: 0,
		}
		if createErr := database.DB.Create(&inventory).Error; createErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sync stock"})
			return
		}
	} else {
		// Update existing
		inventory.TotalStock = absoluteTotal
		if saveErr := database.DB.Save(&inventory).Error; saveErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sync stock"})
			return
		}
	}

	log.Printf("Synced Global Stock for %s -> New Total: %d", productUUID, absoluteTotal)

	c.Status(http.StatusOK)
}
