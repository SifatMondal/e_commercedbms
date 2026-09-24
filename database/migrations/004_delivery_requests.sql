CREATE TABLE IF NOT EXISTS delivery_requests (
    delivery_request_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    seller_id BIGINT NOT NULL REFERENCES sellers(seller_id),
    deliveryman_id BIGINT NOT NULL REFERENCES deliverymen(deliveryman_id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_deliveryman_pending
    ON delivery_requests(deliveryman_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_order_id ON delivery_requests(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_requests_pending_order
    ON delivery_requests(order_id) WHERE status = 'pending';
