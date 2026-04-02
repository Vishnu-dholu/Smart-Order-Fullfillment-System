package handlers

import "github.com/gin-gonic/gin"

func Ping(c *gin.Context) {
	// Match Spring inventory-service response exactly
	c.String(200, "Java OK")
}

