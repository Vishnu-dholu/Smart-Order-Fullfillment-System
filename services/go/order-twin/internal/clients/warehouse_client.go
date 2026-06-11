package clients

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/google/uuid"
	"github.com/smartfulfillment/order-twin/internal/config"
)

// StockDTO matches the Java StockDTO exactly
type StockDTO struct {
	WarehouseID   uuid.UUID `json:"warehouse_id"`
	WarehouseName string    `json:"warehouse_name"`
	Location      string    `json:"location"`
	Quantity      int       `json:"quantity"`
	Latitude      float64   `json:"latitude"`
	Longitude     float64   `json:"longitude"`
}

// GetStockByProduct mimics GET /stock/{productId}
func GetStockByProduct(productID uuid.UUID) ([]StockDTO, error) {
	cfg := config.LoadConfig()
	url := fmt.Sprintf("%s/stock/%s", cfg.WarehouseServiceURL, productID.String())

	// Use the package-level sharedClient
	resp, err := sharedClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("warehouse service returned status: %d", resp.StatusCode)
	}

	var stocks []StockDTO
	if err := json.NewDecoder(resp.Body).Decode(&stocks); err != nil {
		return nil, err
	}

	return stocks, nil
}

// UpdateStock mimics POST /warehouses/{warehouseId}/stock
func UpdateStock(warehouseID uuid.UUID, payload map[string]interface{}) error {
	cfg := config.LoadConfig()
	url := fmt.Sprintf("%s/warehouses/%s/stock", cfg.WarehouseServiceURL, warehouseID.String())

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	// Use the package-level sharedClient
	resp, err := sharedClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("warehouse service failed to update stock, status: %d", resp.StatusCode)
	}

	return nil
}
