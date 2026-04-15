package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/Vishnu-dholu/Smart-Order-Fullfillment-System/services/go/delivery-service/internal/database"
	"github.com/Vishnu-dholu/Smart-Order-Fullfillment-System/services/go/delivery-service/internal/models"
	"github.com/gin-gonic/gin"
)

func hasValidInternalToken(c *gin.Context) bool {
	expected := os.Getenv("INTERNAL_SERVICE_TOKEN")
	if expected == "" {
		expected = "smartfill-internal-token"
	}
	return c.GetHeader("X-Internal-Token") == expected
}

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

// CreateDelivery
// @Summary      Create a new delivery record
// @Description  Called when Warehouse clicks "Ship Order"
// @Tags         delivery
// @Accept       json
// @Produce      json
// @Param        delivery  body   CreateDeliveryRequest  true  "Delivery Request Data"
// @Success      201  {object}  models.Shipment
// @Router       /deliveries [post]
func CreateDelivery(c *gin.Context) {
	if !hasValidInternalToken(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: invalid internal token"})
		return
	}

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

// GetDeliveryByOrderID
// @Summary      Get delivery status
// @Description  Get delivery status by Order ID (For the Customer UI)
// @Tags         delivery
// @Produce      json
// @Param        orderId  path      string  true  "Order ID"
// @Success      200  {object}  models.Shipment
// @Router       /deliveries/order/{orderId} [get]
func GetDeliveryByOrderID(c *gin.Context) {
	orderID := c.Param("orderId")
	var delivery models.Shipment

	if err := database.DB.Where("order_id = ?", orderID).First(&delivery).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Delivery not found for this order"})
		return
	}

	c.JSON(http.StatusOK, delivery)
}

// UpdateDeliveryStatus
// @Summary      Update delivery status
// @Description  Update delivery status (For the Delivery Driver / System)
// @Tags         delivery
// @Accept       json
// @Produce      json
// @Param        trackingNumber  path      string               true  "Tracking Number"
// @Param        status          body      UpdateStatusRequest  true  "Status Update Data"
// @Success      200  {object}  models.Shipment
// @Router       /deliveries/{trackingNumber}/status [put]
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
