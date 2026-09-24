-- Migration 007: Fix deliveryman approval_status check constraints and add message indexes

ALTER TABLE deliverymen DROP CONSTRAINT IF EXISTS deliverymen_approval_status_check;
ALTER TABLE deliverymen DROP CONSTRAINT IF EXISTS chk_deliverymen_approval_status;
ALTER TABLE deliverymen ADD CONSTRAINT chk_deliverymen_approval_status
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_delivery_messages_order_roles
    ON delivery_messages (order_id, sender_role, recipient_role);

CREATE INDEX IF NOT EXISTS idx_delivery_messages_direct_appeal
    ON delivery_messages (recipient_role, recipient_id, created_at DESC)
    WHERE order_id IS NULL;
