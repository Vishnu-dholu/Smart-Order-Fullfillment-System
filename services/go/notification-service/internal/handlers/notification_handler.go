package handlers

import (
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"os"

	"github.com/Vishnu-dholu/Smart-Order-Fullfillment-System/services/go/notification-service/internal/database"
	"github.com/Vishnu-dholu/Smart-Order-Fullfillment-System/services/go/notification-service/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SendNotificationRequest struct {
	UserID          string `json:"user_id" binding:"required"`
	OrderID         string `json:"order_id"`
	Type            string `json:"type" binding:"required"`
	RecipientEmail  string `json:"recipient_email" binding:"required"`
	TotalAmount     string `json:"total_amount"`
	ShippingAddress string `json:"shipping_address"`
}

func hasValidInternalToken(c *gin.Context) bool {
	expected := os.Getenv("INTERNAL_SERVICE_TOKEN")
	if expected == "" {
		expected = "smartfill-internal-token"
	}
	return c.GetHeader("X-Internal-Token") == expected
}

// Helper function to actually send the email
func sendRealEmail(to string, subject string, body string) {
	from := os.Getenv("SMTP_EMAIL")
	password := os.Getenv("SMTP_PASSWORD")
	smtpHost := "smtp.gmail.com"
	smtpPort := "587"

	// Construct the email message with headers
	message := []byte(fmt.Sprintf("To: %s\r\nSubject: %s\r\n\r\n%s", to, subject, body))

	// Authenticate with Gmail
	auth := smtp.PlainAuth("", from, password, smtpHost)

	// Send it!
	err := smtp.SendMail(smtpHost+":"+smtpPort, auth, from, []string{to}, message)
	if err != nil {
		log.Printf("❌ Failed to send real email to %s: %v", to, err)
		return
	}
	log.Printf("📧 Successfully sent real email to %s", to)
}

// SendNotification
// @Summary      Send a Notification
// @Description  Send a notification email
// @Tags         notifications
// @Accept       json
// @Produce      json
// @Param        notification  body   SendNotificationRequest  true  "Notification Request Data"
// @Success      201  {object}  map[string]interface{}
// @Router       /notifications [post]
func SendNotification(c *gin.Context) {
	if !hasValidInternalToken(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden: invalid internal token"})
		return
	}

	var req SendNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userUUID, _ := uuid.Parse(req.UserID)
	var orderUUIDPtr *uuid.UUID
	if req.OrderID != "" {
		orderUUID, _ := uuid.Parse(req.OrderID)
		orderUUIDPtr = &orderUUID
	}

	// 1. Save to Database
	notification := models.Notification{
		UserID:  userUUID,
		OrderID: orderUUIDPtr,
		Type:    req.Type,
		Status:  "SENT",
	}
	database.DB.Create(&notification)

	// 2. Determine Email Content based on Event Type
	var subject, body string

	// Create a beautifully formatted details block
	orderDetails := fmt.Sprintf(
		"----------------------------------------\n"+
			"🧾 ORDER SUMMARY\n"+
			"----------------------------------------\n"+
			"Order ID: %s\n"+
			"Total Amount: ₹%s\n"+
			"Shipping To:\n%s\n"+
			"----------------------------------------",
		req.OrderID, req.TotalAmount, req.ShippingAddress,
	)

	if req.Type == "ORDER_CONFIRMED" {
		subject = "Order Confirmed! 🎉 - Smart Order"
		body = fmt.Sprintf("Hello!\n\nYour order has been successfully confirmed and is being prepped for fulfillment.\n\n%s\n\nThank you for shopping with Smart Order!", orderDetails)
	} else if req.Type == "ORDER_SHIPPED" {
		subject = "Your Order is on the way! 🚚 - Smart Order"
		body = fmt.Sprintf("Great news!\n\nYour order has been packed and handed over to our delivery partners.\n\n%s\n\nYou will receive a tracking number shortly.", orderDetails)
	} else {
		subject = "Smart Order Update"
		body = fmt.Sprintf("You have a new update regarding your order: %s", req.OrderID)
	}

	// 3. Fire the email asynchronously
	go sendRealEmail(req.RecipientEmail, subject, body)

	c.JSON(http.StatusCreated, gin.H{"message": "Notification dispatched"})
}

// GetUserNotifications
// @Summary      Get Notification History
// @Description  Get notification history for a specific user
// @Tags         notifications
// @Produce      json
// @Param        user_id  path      string  true  "User ID"
// @Success      200  {array}  models.Notification
// @Router       /notifications/{user_id} [get]
func GetUserNotifications(c *gin.Context) {
	userIDParam := c.Param("user_id")
	userUUID, _ := uuid.Parse(userIDParam)

	var notifications []models.Notification
	database.DB.Where("user_id = ?", userUUID).Order("sent_at desc").Find(&notifications)

	c.JSON(http.StatusOK, notifications)
}
