package clients

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/smartfulfillment/order-twin/internal/config"
)

// SendNotification mimics the POST /notifications Feign call
func SendNotification(requestPayload map[string]string) (map[string]interface{}, error) {
	cfg := config.LoadConfig()
	url := fmt.Sprintf("%s/notifications", cfg.NotificationURL)

	jsonData, err := json.Marshal(requestPayload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := SharedClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("notification service returned status: %d", resp.StatusCode)
	}

	var response map[string]interface{}
	// Only decode if there is a body, otherwise return empty map
	if resp.ContentLength != 0 {
		_ = json.NewDecoder(resp.Body).Decode(&response)
	}

	return response, nil
}
