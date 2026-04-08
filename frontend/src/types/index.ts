// --- AUTHENTICATION ---
export interface AuthResponse {
  token: string;
  userId: string;
}

// --- INVENTORY SERVICE (Java - Port 8082) ---
export interface Product {
  id: string;
  productId?: string;
  sku?: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  totalStock: number;
  reservedStock: number;
  lowStockThreshold?: number;
}

// --- WAREHOUSE SERVICE (Go - Port 8084) ---
export interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  productId: string;
  quantity: number;
  latitude: number;
  longitude: number;
  location?: string;
}

// --- ORDER SERVICE (Go - Port 8083) ---
export interface OrderItemRequest {
  productId: string;
  quantity: number;
}

export interface OrderRequest {
  shippingAddress: string;
  shippingLatitude: number;
  shippingLongitude: number;
  items: OrderItemRequest[];
}

export interface OrderItemResponse {
  orderId: string;
  userId: string;
  status: string;
  totalAmount: string;
  shippingAddress: string;
  createdAt: string;
}
