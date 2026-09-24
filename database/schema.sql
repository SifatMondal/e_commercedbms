-- PostgreSQL schema for the E-Commerce DBMS ER diagram


-- =========================================================
-- 1. CUSTOMER
-- =========================================================

CREATE TABLE customers (
    customer_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    phone VARCHAR(30) NOT NULL
);


-- =========================================================
-- 2. SELLER
-- =========================================================

CREATE TABLE sellers (
    seller_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    phone VARCHAR(30) NOT NULL,
    password TEXT NOT NULL,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended')),
    suspended_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Central platform emails registry to guarantee cross-table email uniqueness
CREATE TABLE platform_user_emails (
    email VARCHAR(254) PRIMARY KEY,
    role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'seller', 'deliveryman', 'admin')),
    user_id BIGINT NOT NULL
);

-- Admin accounts are deliberately separate from public customer/seller accounts.
CREATE TABLE admins (
    admin_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE deliverymen (
    deliveryman_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE, phone VARCHAR(30) NOT NULL, password TEXT NOT NULL,
    delivery_location TEXT, delivery_latitude NUMERIC(9, 6), delivery_longitude NUMERIC(9, 6),
    approval_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended')),
    suspended_until TIMESTAMPTZ,
    availability_status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (availability_status IN ('available', 'busy', 'offline')),
    last_assigned_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 3. CATEGORY
-- =========================================================

CREATE TABLE categories (
    category_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_name VARCHAR(150) NOT NULL UNIQUE
);


-- =========================================================
-- 4. PRODUCT
-- Seller LISTS Product
-- Product belongs to Category
-- =========================================================

CREATE TABLE products (
    product_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL CHECK (stock >= 0),
    image TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),

    seller_id BIGINT NOT NULL,
    category_id BIGINT NOT NULL,

    CONSTRAINT fk_products_seller
        FOREIGN KEY (seller_id)
        REFERENCES sellers (seller_id),

    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id)
        REFERENCES categories (category_id)
);


-- =========================================================
-- 5. CART
-- Customer OWNS Cart
-- One customer has one cart
-- =========================================================

CREATE TABLE carts (
    cart_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_date DATE NOT NULL,

    customer_id BIGINT NOT NULL UNIQUE,

    CONSTRAINT fk_carts_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers (customer_id)
);


-- =========================================================
-- 6. ORDER
-- Customer PLACES Order
-- =========================================================

CREATE TABLE orders (
    order_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_date DATE NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL
        CHECK (total_amount >= 0),
    payment_method VARCHAR(100) NOT NULL,
    shipping_address TEXT NOT NULL,
    delivery_latitude NUMERIC(9, 6),
    delivery_longitude NUMERIC(9, 6),
    deliveryman_id BIGINT REFERENCES deliverymen(deliveryman_id),
    delivery_status VARCHAR(30) CHECK (delivery_status IS NULL OR delivery_status IN ('assigned', 'picked_up', 'out_for_delivery', 'delivered')),
    estimated_delivery_time TIMESTAMPTZ,
    status VARCHAR(100) NOT NULL,

    customer_id BIGINT NOT NULL,

    CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers (customer_id)
);


-- =========================================================
-- 7. ORDER_ITEM
-- Order HAS OrderItem
-- OrderItem REPRESENTS Product
-- =========================================================

CREATE TABLE order_items (
    order_item_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price NUMERIC(12, 2) NOT NULL
        CHECK (price >= 0),

    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,

    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id)
        REFERENCES orders (order_id),

    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id)
        REFERENCES products (product_id)
);


-- =========================================================
-- 8. CART_ITEM
-- Cart HAS CartItem
-- CartItem IS IN Product
-- =========================================================

CREATE TABLE cart_items (
    cart_item_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    quantity INTEGER NOT NULL CHECK (quantity > 0),

    cart_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,

    CONSTRAINT fk_cart_items_cart
        FOREIGN KEY (cart_id)
        REFERENCES carts (cart_id),

    CONSTRAINT fk_cart_items_product
        FOREIGN KEY (product_id)
        REFERENCES products (product_id)
);


-- =========================================================
-- 9. REVIEW
-- Customer WRITES Review
-- Product has/reviews Review
-- =========================================================

CREATE TABLE reviews (
    review_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rating INTEGER NOT NULL
        CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,

    customer_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,

    CONSTRAINT fk_reviews_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers (customer_id),

    CONSTRAINT fk_reviews_product
        FOREIGN KEY (product_id)
        REFERENCES products (product_id)
);


-- =========================================================
-- 10. NOTIFICATION
--
-- Customer RECEIVES Notification
-- Seller RECEIVES Notification
--
-- Each notification belongs to exactly ONE recipient:
-- either a customer OR a seller.
-- =========================================================

CREATE TABLE notifications (
    notification_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message TEXT NOT NULL,
    notification_date DATE NOT NULL,
    status VARCHAR(100) NOT NULL,

    customer_id BIGINT,
    seller_id BIGINT,
    deliveryman_id BIGINT,
    admin_id BIGINT,

    CONSTRAINT fk_notifications_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers (customer_id),

    CONSTRAINT fk_notifications_seller
        FOREIGN KEY (seller_id)
        REFERENCES sellers (seller_id),

    CONSTRAINT fk_notifications_deliveryman
        FOREIGN KEY (deliveryman_id)
        REFERENCES deliverymen (deliveryman_id),

    CONSTRAINT fk_notifications_admin
        FOREIGN KEY (admin_id)
        REFERENCES admins (admin_id),

    CONSTRAINT chk_notification_recipient
        CHECK (
            ((customer_id IS NOT NULL)::int + (seller_id IS NOT NULL)::int + (deliveryman_id IS NOT NULL)::int + (admin_id IS NOT NULL)::int) = 1
        )
);

CREATE TABLE delivery_messages (
    message_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT REFERENCES orders (order_id) ON DELETE CASCADE,
    sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('customer', 'deliveryman', 'seller', 'admin')),
    sender_id BIGINT NOT NULL,
    recipient_role VARCHAR(20) CHECK (recipient_role IS NULL OR recipient_role IN ('customer', 'deliveryman', 'seller', 'admin')),
    recipient_id BIGINT,
    message TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 2000),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_delivery_messages_unread ON delivery_messages (recipient_role, recipient_id, is_read);

CREATE TABLE delivery_requests (
    delivery_request_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    seller_id BIGINT NOT NULL REFERENCES sellers(seller_id),
    deliveryman_id BIGINT NOT NULL REFERENCES deliverymen(deliveryman_id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_delivery_requests_pending_order ON delivery_requests(order_id) WHERE status = 'pending';
