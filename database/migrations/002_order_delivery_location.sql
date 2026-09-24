-- Delivery coordinates remain nullable for orders created before this feature.
-- The order API requires both values for every newly created order.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS delivery_latitude NUMERIC(9, 6),
    ADD COLUMN IF NOT EXISTS delivery_longitude NUMERIC(9, 6);
