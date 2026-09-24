-- Migration 006: Add admin_id to notifications and update recipient check constraint

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS admin_id BIGINT REFERENCES admins(admin_id) ON DELETE CASCADE;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notification_recipient;
ALTER TABLE notifications ADD CONSTRAINT chk_notification_recipient
    CHECK (((customer_id IS NOT NULL)::int + (seller_id IS NOT NULL)::int + (deliveryman_id IS NOT NULL)::int + (admin_id IS NOT NULL)::int) = 1);

CREATE INDEX IF NOT EXISTS idx_notifications_admin_id ON notifications(admin_id, status, notification_date DESC);
