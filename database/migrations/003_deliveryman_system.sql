CREATE TABLE IF NOT EXISTS deliverymen (
    deliveryman_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE, phone VARCHAR(30) NOT NULL, password TEXT NOT NULL,
    delivery_location TEXT, delivery_latitude NUMERIC(9, 6), delivery_longitude NUMERIC(9, 6),
    approval_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    availability_status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (availability_status IN ('available', 'busy', 'offline')),
    last_assigned_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deliveryman_id BIGINT REFERENCES deliverymen(deliveryman_id), ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(30), ADD COLUMN IF NOT EXISTS estimated_delivery_time TIMESTAMPTZ;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_delivery_status;
ALTER TABLE orders ADD CONSTRAINT chk_orders_delivery_status CHECK (delivery_status IS NULL OR delivery_status IN ('assigned', 'picked_up', 'out_for_delivery', 'delivered'));
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deliveryman_id BIGINT REFERENCES deliverymen(deliveryman_id);
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notification_recipient;
ALTER TABLE notifications ADD CONSTRAINT chk_notification_recipient CHECK (((customer_id IS NOT NULL)::int + (seller_id IS NOT NULL)::int + (deliveryman_id IS NOT NULL)::int) = 1);
CREATE TABLE IF NOT EXISTS delivery_messages (
    message_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('customer', 'deliveryman')), sender_id BIGINT NOT NULL,
    message TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 2000), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_delivery_messages_order_id ON delivery_messages(order_id, message_id);
