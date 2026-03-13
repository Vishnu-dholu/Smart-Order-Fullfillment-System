package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"github.com/Vishnu-dholu/Smart-Order-Fullfillment-System/services/go/delivery-service/internal/database"
	"github.com/Vishnu-dholu/Smart-Order-Fullfillment-System/services/go/delivery-service/internal/models"
	"github.com/gin-gonic/gin"
)

// Request payload for creating a delivery
type CreateDeliveryRequest struct {
	OrderID         string `json:"order_id" binding:"required"`
	OriginWarehouse string `json:"origin_warehouse" binding:"required"`
}

// Request payload for updating tracking
type UpdateStatusRequest struct {
	Status          string `json:"status" binding:"required"`
	CurrentLocation string `json:"current_location" binding:"required"`
}

// 1. Create a new delivery record (Called when Warehouse clicks "Ship Order")
func CreateDelivery(c *gin.Context) {
	var req CreateDeliveryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate a fake tracking number like "TRK-987654321"
	trackingNum := fmt.Sprintf("TRK-%d", 100000000+rand.Intn(900000000))

	delivery := models.Shipment{
		OrderID:           req.OrderID,
		TrackingNumber:    trackingNum,
		Status:            "DISPATCHED",
		CurrentLocation:   req.OriginWarehouse,
		EstimatedDelivery: time.Now().AddDate(0, 0, 3), // +3 Days estimated
	}

	if err := database.DB.Create(&delivery).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create delivery record"})
		return
	}

	c.JSON(http.StatusCreated, delivery)
}

// 2. Get delivery status by Order ID (For the Customer UI)
func GetDeliveryByOrderID(c *gin.Context) {
	orderID := c.Param("orderId")
	var delivery models.Shipment

	if err := database.DB.Where("order_id = ?", orderID).First(&delivery).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Delivery not found for this order"})
		return
	}

	c.JSON(http.StatusOK, delivery)
}

// 3. Update delivery status (For the Delivery Driver / System)
func UpdateDeliveryStatus(c *gin.Context) {
	trackingNumber := c.Param("trackingNumber")
	var req UpdateStatusRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var delivery models.Shipment
	if err := database.DB.Where("tracking_number = ?", trackingNumber).First(&delivery).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tracking number not found"})
		return
	}

	delivery.Status = req.Status
	delivery.CurrentLocation = req.CurrentLocation
	database.DB.Save(&delivery)

	c.JSON(http.StatusOK, delivery)
}
