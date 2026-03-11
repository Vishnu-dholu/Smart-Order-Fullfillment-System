// --- AUTHENTICATION ---
export interface AuthResponse {
  token: string;
  userId: string;
}

// --- INVENTORY SERVICE (Java - Port 8082) ---
export interface Product {
  id: string;
  productId?: string;
  name: string;
  description: string;
  price: number;
  totalStock: number;
  reservedStock: number;
}

// --- WAREHOUSE SERVICE (Go - Port 8084) ---
export interface StockResult {
  warehouse_id: string;
  warehouse_name: string;
  location: string;
  latitude: number;
  longitude: number;
  quantity: number;
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
