CREATE DATABASE auth_db;
CREATE DATABASE order_db;
CREATE DATABASE inventory_db;
CREATE DATABASE warehouse_db;
CREATE DATABASE delivery_db;
CREATE DATABASE notification_db;



CREATE USER order_admin WITH PASSWORD 'order_admin(123)';
GRANT ALL PRIVILEGES ON DATABASE order_db TO order_admin;


CREATE USER inventory_admin WITH PASSWORD 'inventory_admin(123)';
GRANT ALL PRIVILEGES ON DATABASE inventory_db TO inventory_admin;

-------------------------------------------------------------------------------------

-- 1. auth_db (Managed by Authentication Service - Spring Boot)
-- This database handles user identity. Other services will store the user_id but never join with this table directly.

-- Connect to: auth_db
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('CUSTOMER', 'ADMIN', 'WAREHOUSE_MANAGER')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 2. inventory_db (Managed by Inventory Service - Spring Boot)
-- This is the "Source of Truth" for product details and global availability.

-- Connect to: inventory_db
CREATE TABLE products (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(50) UNIQUE NOT NULL, -- Stock Keeping Unit (e.g., "IPHONE-15-BLK")
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE global_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID UNIQUE NOT NULL, -- Logical Link to products table
    total_stock INT NOT NULL DEFAULT 0,
    reserved_stock INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Design Secret: The reserved_stock column is critical for your "Inventory reservation" requirement.

-- Formula: Available to Sell = total_stock - reserved_stock.

-- When a user clicks "Checkout", you increase reserved_stock. You only decrease total_stock when payment is confirmed.



-- 3. order_db (Managed by Order Service - Spring Boot)
-- This database manages the lifecycle of the customer's request.

-- Connect to: order_db
CREATE TABLE orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- Logical Reference to auth_db.users
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('CREATED', 'PENDING_INVENTORY', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
    shipping_address TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id UUID NOT NULL, -- Logical Reference to inventory_db.products
    quantity INT NOT NULL,
    price_at_purchase DECIMAL(10, 2) NOT NULL -- Store price here! Product price might change later.
);


-- 4. warehouse_db (Managed by Warehouse Service - Go)
-- This database maps products to physical locations. While inventory_db knows how many you have, this DB knows where they are.

-- Connect to: warehouse_db
CREATE TABLE warehouses (
    warehouse_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL, -- e.g., "East Coast Fulfillment Center"
    location VARCHAR(255) NOT NULL,
    capacity INT NOT NULL
);

CREATE TABLE warehouse_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES warehouses(warehouse_id),
    product_id UUID NOT NULL, -- Logical Reference to inventory_db.products
    quantity INT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 5. delivery_db (Managed by Delivery Service - Go)
-- This tracks the physical movement of the package.

-- Connect to: delivery_db
CREATE TABLE shipments (
    shipment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID UNIQUE NOT NULL, -- Logical Reference to order_db.orders
    warehouse_id UUID NOT NULL, -- Logical Reference to warehouse_db.warehouses
    tracking_number VARCHAR(50) UNIQUE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PREPARING', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED')),
    estimated_delivery TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- 6. notification_db (Managed by Notification Service - Go)
-- A simple log of what emails/SMS were sent.

-- Connect to: notification_db
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    order_id UUID,
    type VARCHAR(50) NOT NULL, -- e.g., "ORDER_CONFIRMATION", "SHIPPING_UPDATE"
    status VARCHAR(20) NOT NULL CHECK (status IN ('SENT', 'FAILED')),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
