package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// HealthCheck
// @Summary      Health check
// @Description  Check the uptime status of the service
// @Tags         health
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Router       /health [get]
func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "UP",
	})
}
