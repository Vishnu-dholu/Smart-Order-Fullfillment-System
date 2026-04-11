package handlers

import (
	"log"
	"net/http"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/smartfulfillment/inventory-twin/internal/database"
	"github.com/smartfulfillment/inventory-twin/internal/models"
	"gorm.io/gorm"
)

// --- CACHE SETUP ---
// A thread-safe map to store our products in RAM
type ProductCache struct {
	sync.RWMutex
	items map[string]models.Product
}

var inventoryCache = &ProductCache{
	items: make(map[string]models.Product),
}

// -------------------

// GetAllProductsWithStock matches GET /products
func GetAllProductsWithStock(c *gin.Context) {
	var products []models.Product
	if err := database.DB.Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch products"})
		return
	}

	var responses []models.ProductResponse

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

	// --- 1. CACHE CHECK (READ LOCK) ---
	inventoryCache.RLock() // Lock for reading
	cachedProduct, found := inventoryCache.items[productIDParam]
	inventoryCache.RUnlock()

	if found {
		// CACHE HIT: Return instantly from RAM
		c.JSON(http.StatusOK, cachedProduct)
		return
	}

	// --- 2. CACHE MISS: HIT THE DATABASE ---
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

	// --- 3. UPDATE CACHE (WRITE LOCK) ---
	inventoryCache.Lock() // Lock entirely for writing
	inventoryCache.items[productIDParam] = product
	inventoryCache.Unlock()

	c.JSON(http.StatusOK, product)
}

// CreateProduct matches POST /products
func CreateProduct(c *gin.Context) {
	var product models.Product
	if err := c.ShouldBindJSON(&product); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&product).Error; err != nil {
			return err
		}

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

	absoluteTotal := 0
	if val, ok := payload["quantity"]; ok {
		absoluteTotal = val
	}

	var inventory models.GlobalInventory
	err = database.DB.Where("product_id = ?", productUUID).First(&inventory).Error

	if err != nil {
		if err != gorm.ErrRecordNotFound {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sync stock"})
			return
		}
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
		inventory.TotalStock = absoluteTotal
		if saveErr := database.DB.Save(&inventory).Error; saveErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to sync stock"})
			return
		}
	}

	log.Printf("Synced Global Stock for %s -> New Total: %d", productUUID, absoluteTotal)

	c.Status(http.StatusOK)
}
