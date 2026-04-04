package clients

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/smartfulfillment/order-twin/internal/config"
)

// CreateDelivery mimics the POST /deliveries Feign callction, and we can actually see it working in the logs you just pasted!
func CreateDelivery(requestPayload map[string]string) (map[string]interface{}, error) {
	cfg := config.LoadConfig()
	url := fmt.Sprintf("%s/deliveries", cfg.DeliveryServiceURL)

	jsonData, err := json.Marshal(requestPayload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("delivery service returned status: %d", resp.StatusCode)
	}

	var response map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, err
	}

	return response, nil
}
