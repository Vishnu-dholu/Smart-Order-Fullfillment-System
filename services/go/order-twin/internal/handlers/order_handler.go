package handlers

import (
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/smartfulfillment/order-twin/internal/clients"
	"github.com/smartfulfillment/order-twin/internal/database"
	"github.com/smartfulfillment/order-twin/internal/models"
	"github.com/smartfulfillment/order-twin/internal/utils"
	"gorm.io/gorm"
)

// --- DTOs ---

type OrderItemRequest struct {
	ProductID uuid.UUID `json:"productId"`
	Quantity  int       `json:"quantity"`
}

type OrderRequest struct {
	ShippingAddress   string             `json:"shippingAddress"`
	ShippingLatitude  float64            `json:"shippingLatitude"`
	ShippingLongitude float64            `json:"shippingLongitude"`
	Items             []OrderItemRequest `json:"items"`
}

type OrderResponse struct {
	OrderID         string  `json:"orderId"`
	UserID          string  `json:"userId"`
	Status          string  `json:"status"`
	TotalAmount     float64 `json:"totalAmount"`
	ShippingAddress string  `json:"shippingAddress"`
	CreatedAt       string  `json:"createdAt"`
}

// --- Handlers ---

// CreateOrder mimics OrderService.placeOrder
func CreateOrder(c *gin.Context) {
	// 1. Extract User ID from Header
	userIDStr := c.GetHeader("X-User-Id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing or invalid X-User-Id header"})
		return
	}

	// 2. Parse Request Body
	var req OrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	log.Printf("Processing order for User: %s", userID)

	// 3. Initialize Order
	order := models.Order{
		UserID:          userID,
		Status:          models.PendingInventory,
		ShippingAddress: req.ShippingAddress,
	}

	var orderItems []models.OrderItem
	var totalAmount float64

	// 4. Validate Items & Calculate Price (Inventory Service)
	for _, itemReq := range req.Items {
		product, err := clients.GetProductById(itemReq.ProductID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Product not found: %s", itemReq.ProductID)})
			return
		}

		orderItem := models.OrderItem{
			ProductID:       itemReq.ProductID,
			Quantity:        itemReq.Quantity,
			PriceAtPurchase: product.Price,
		}
		orderItems = append(orderItems, orderItem)
		totalAmount += product.Price * float64(itemReq.Quantity)
	}

	order.TotalAmount = totalAmount

	// 5. Allocate Stock (Warehouse Service) - The complex routing part
	for _, item := range orderItems {
		if !attemptToAllocateItem(item, req.ShippingLatitude, req.ShippingLongitude) {
			c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Insufficient stock for Product ID: %s", item.ProductID)})
			return
		}
	}

	// 6. Finalize & Save
	order.Status = models.Confirmed

	// Use a transaction to save the order and items together
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&order).Error; err != nil {
			return err
		}
		// Link items to the newly created order ID and save them
		for i := range orderItems {
			orderItems[i].OrderID = order.OrderID
		}
		if err := tx.Create(&orderItems).Error; err != nil {
			return err
		}
		// Populate the Items slice in the order struct for the JSON response
		order.Items = orderItems
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save order"})
		return
	}

	// 7. Send Notification Asynchronously
	sendNotificationAsync(&order, "ORDER_CONFIRMED", "bitbuster08@gmail.com")

	c.JSON(http.StatusCreated, order)
}

func GetUserOrders(c *gin.Context) {
	userIDStr := c.GetHeader("X-User-Id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing or invalid X-User-Id header"})
		return
	}

	var orders []models.Order
	if err := database.DB.Where("user_id = ?", userID).Order("created_at desc").Preload("Items").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
		return
	}
	responses := make([]OrderResponse, 0, len(orders))
	for _, order := range orders {
		responses = append(responses, OrderResponse{
			OrderID:         order.OrderID.String(),
			UserID:          order.UserID.String(),
			Status:          string(order.Status),
			TotalAmount:     order.TotalAmount,
			ShippingAddress: order.ShippingAddress,
			CreatedAt:       order.CreatedAt.String(),
		})
	}
	c.JSON(http.StatusOK, responses)
}

func GetAllSystemOrders(c *gin.Context) {
	var orders []models.Order
	if err := database.DB.Order("created_at desc").Preload("Items").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch orders"})
		return
	}
	responses := make([]OrderResponse, 0, len(orders))
	for _, order := range orders {
		responses = append(responses, OrderResponse{
			OrderID:         order.OrderID.String(),
			UserID:          order.UserID.String(),
			Status:          string(order.Status),
			TotalAmount:     order.TotalAmount,
			ShippingAddress: order.ShippingAddress,
			CreatedAt:       order.CreatedAt.String(),
		})
	}
	c.JSON(http.StatusOK, responses)
}

func UpdateOrderStatus(c *gin.Context) {
	orderIDParam := c.Param("orderId")
	orderUUID, err := uuid.Parse(orderIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Order ID"})
		return
	}

	var payload struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var order models.Order
	if err := database.DB.Preload("Items").First(&order, "order_id = ?", orderUUID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	newStatus, ok := parseOrderStatus(payload.Status)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order status"})
		return
	}

	// Transition to Shipped logic (Calls Delivery + Notification via goroutine)
	if newStatus == models.Shipped && order.Status != models.Shipped {
		log.Printf("Order %s is being shipped. Notifying Delivery Service...", orderUUID)

		deliveryPayload := map[string]string{
			"order_id":         orderUUID.String(),
			"origin_warehouse": uuid.New().String(), // Simulating origin warehouse
		}

		_, deliveryErr := clients.CreateDelivery(deliveryPayload)
		if deliveryErr != nil {
			log.Printf("Failed to communicate with Delivery Service for Order %s: %v", orderUUID, deliveryErr)
		} else {
			log.Printf("Successfully generated tracking ticker for Order: %s", orderUUID)
		}

		sendNotificationAsync(&order, "ORDER_SHIPPED", "bitbuster08@gmail.com")
	}

	order.Status = newStatus
	if err := database.DB.Save(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update order status"})
		return
	}

	c.Status(http.StatusOK)
}

// --- Helper Methods ---

func attemptToAllocateItem(item models.OrderItem, userLat, userLng float64) bool {
	warehouses, err := clients.GetStockByProduct(item.ProductID)
	if err != nil || len(warehouses) == 0 {
		return false
	}

	// Filter warehouses that have enough quantity
	var validWarehouses []clients.StockDTO
	for _, w := range warehouses {
		if w.Quantity >= item.Quantity {
			validWarehouses = append(validWarehouses, w)
		}
	}

	if len(validWarehouses) == 0 {
		return false
	}

	// Sort by geographic distance using Haversine
	sort.Slice(validWarehouses, func(i, j int) bool {
		distI := utils.CalculateDistance(userLat, userLng, validWarehouses[i].Latitude, validWarehouses[i].Longitude)
		distJ := utils.CalculateDistance(userLat, userLng, validWarehouses[j].Latitude, validWarehouses[j].Longitude)
		return distI < distJ
	})

	closestWarehouse := validWarehouses[0]

	// Logging distance for parity with Java
	distanceKm := utils.CalculateDistance(userLat, userLng, closestWarehouse.Latitude, closestWarehouse.Longitude)
	log.Printf("SMART ROUTING: Assigning Product %s to '%s' (%s). Distance: %.2f km.",
		item.ProductID, closestWarehouse.WarehouseName, closestWarehouse.Location, distanceKm)

	return deductStockFromWarehouse(closestWarehouse, item)
}

func deductStockFromWarehouse(warehouse clients.StockDTO, item models.OrderItem) bool {
	payload := map[string]interface{}{
		"product_id": item.ProductID.String(),
		"quantity":   -item.Quantity, // Negative value to deduct
	}

	err := clients.UpdateStock(warehouse.WarehouseID, payload)
	if err != nil {
		log.Printf("Failed to deduct stock from warehouse %s. Trying next... Error: %v", warehouse.WarehouseID, err)
		return false
	}

	log.Printf("Allocated %d items of Product %s from Warehouse %s", item.Quantity, item.ProductID, warehouse.WarehouseName)
	return true
}

func sendNotificationAsync(order *models.Order, notifType, recipientEmail string) {
	// Goroutine handles async behavior similar to Java's new Thread()
	go func() {
		orderID := ""
		if order.OrderID != uuid.Nil {
			orderID = order.OrderID.String()
		}

		payload := map[string]string{
			"user_id":          order.UserID.String(),
			"order_id":         orderID,
			"type":             notifType,
			"recipient_email":  recipientEmail,
			"total_amount":     fmt.Sprintf("%.2f", order.TotalAmount),
			"shipping_address": order.ShippingAddress,
		}

		_, err := clients.SendNotification(payload)
		if err != nil {
			log.Printf("Failed to communicate with Notification Service for Order: %s, Error: %v", orderID, err)
		} else {
			log.Printf("Successfully dispatched %s notification for Order: %s", notifType, orderID)
		}
	}()
}

func parseOrderStatus(raw string) (models.OrderStatus, bool) {
	switch models.OrderStatus(strings.ToUpper(raw)) {
	case models.Created:
		return models.Created, true
	case models.PendingInventory:
		return models.PendingInventory, true
	case models.Confirmed:
		return models.Confirmed, true
	case models.Shipped:
		return models.Shipped, true
	case models.Delivered:
		return models.Delivered, true
	case models.Cancelled:
		return models.Cancelled, true
	default:
		return "", false
	}
}
