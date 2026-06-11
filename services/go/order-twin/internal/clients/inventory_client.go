package clients

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/google/uuid"
	"github.com/smartfulfillment/order-twin/internal/config"
)

type ProductDTO struct {
	ID    uuid.UUID `json:"id"`
	Name  string    `json:"name"`
	Price float64   `json:"price"`
}

func GetProductById(productID uuid.UUID) (*ProductDTO, error) {
	cfg := config.LoadConfig()
	url := fmt.Sprintf("%s/products/%s", cfg.InventoryServiceURL, productID)

	// Use the package-level sharedClient — no new TCP handshake per call.
	resp, err := sharedClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("product not found")
	}

	var product ProductDTO
	if err := json.NewDecoder(resp.Body).Decode(&product); err != nil {
		return nil, err
	}

	return &product, nil
}
