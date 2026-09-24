-- Migration 005: Cross-table email uniqueness, product/seller/deliveryman controls, and unread messaging system

-- 1. Central platform emails table to enforce cross-table email uniqueness
CREATE TABLE IF NOT EXISTS platform_user_emails (
    email VARCHAR(254) PRIMARY KEY,
    role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'seller', 'deliveryman', 'admin')),
    user_id BIGINT NOT NULL
);

-- Seed platform_user_emails from existing accounts if empty
INSERT INTO platform_user_emails (email, role, user_id)
SELECT LOWER(TRIM(email)), 'customer', customer_id FROM customers
ON CONFLICT (email) DO NOTHING;

INSERT INTO platform_user_emails (email, role, user_id)
SELECT LOWER(TRIM(email)), 'seller', seller_id FROM sellers
ON CONFLICT (email) DO NOTHING;

INSERT INTO platform_user_emails (email, role, user_id)
SELECT LOWER(TRIM(email)), 'deliveryman', deliveryman_id FROM deliverymen
ON CONFLICT (email) DO NOTHING;

INSERT INTO platform_user_emails (email, role, user_id)
SELECT LOWER(TRIM(email)), 'admin', admin_id FROM admins
ON CONFLICT (email) DO NOTHING;

-- 2. Trigger functions to maintain cross-table email uniqueness atomically
CREATE OR REPLACE FUNCTION check_platform_email_uniqueness()
RETURNS TRIGGER AS $$
DECLARE
    entity_role TEXT := TG_ARGV[0];
    id_val BIGINT;
    existing_rec RECORD;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    IF entity_role = 'customer' THEN
        id_val := NEW.customer_id;
    ELSIF entity_role = 'seller' THEN
        id_val := NEW.seller_id;
    ELSIF entity_role = 'deliveryman' THEN
        id_val := NEW.deliveryman_id;
    ELSIF entity_role = 'admin' THEN
        id_val := NEW.admin_id;
    END IF;

    -- Check if email exists for ANY other account in platform_user_emails
    SELECT email, role, user_id INTO existing_rec
    FROM platform_user_emails
    WHERE email = LOWER(TRIM(NEW.email));

    IF FOUND THEN
        -- If it's a different role, or a different user_id in the same role, reject!
        IF existing_rec.role <> entity_role OR existing_rec.user_id <> id_val THEN
            RAISE EXCEPTION 'An account with this email already exists across the platform.'
                USING ERRCODE = '23505';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_platform_user_email()
RETURNS TRIGGER AS $$
DECLARE
    entity_role TEXT := TG_ARGV[0];
    id_val BIGINT;
    old_id_val BIGINT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF entity_role = 'customer' THEN id_val := NEW.customer_id;
        ELSIF entity_role = 'seller' THEN id_val := NEW.seller_id;
        ELSIF entity_role = 'deliveryman' THEN id_val := NEW.deliveryman_id;
        ELSIF entity_role = 'admin' THEN id_val := NEW.admin_id;
        END IF;

        INSERT INTO platform_user_emails (email, role, user_id)
        VALUES (LOWER(TRIM(NEW.email)), entity_role, id_val)
        ON CONFLICT (email) DO UPDATE
            SET role = EXCLUDED.role, user_id = EXCLUDED.user_id;
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        IF entity_role = 'customer' THEN id_val := NEW.customer_id; old_id_val := OLD.customer_id;
        ELSIF entity_role = 'seller' THEN id_val := NEW.seller_id; old_id_val := OLD.seller_id;
        ELSIF entity_role = 'deliveryman' THEN id_val := NEW.deliveryman_id; old_id_val := OLD.deliveryman_id;
        ELSIF entity_role = 'admin' THEN id_val := NEW.admin_id; old_id_val := OLD.admin_id;
        END IF;

        IF LOWER(TRIM(NEW.email)) <> LOWER(TRIM(OLD.email)) THEN
            DELETE FROM platform_user_emails
            WHERE email = LOWER(TRIM(OLD.email)) AND role = entity_role AND user_id = old_id_val;

            INSERT INTO platform_user_emails (email, role, user_id)
            VALUES (LOWER(TRIM(NEW.email)), entity_role, id_val)
            ON CONFLICT (email) DO UPDATE
                SET role = EXCLUDED.role, user_id = EXCLUDED.user_id;
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        IF entity_role = 'customer' THEN old_id_val := OLD.customer_id;
        ELSIF entity_role = 'seller' THEN old_id_val := OLD.seller_id;
        ELSIF entity_role = 'deliveryman' THEN old_id_val := OLD.deliveryman_id;
        ELSIF entity_role = 'admin' THEN old_id_val := OLD.admin_id;
        END IF;

        DELETE FROM platform_user_emails
        WHERE email = LOWER(TRIM(OLD.email)) AND role = entity_role AND user_id = old_id_val;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Customer triggers
DROP TRIGGER IF EXISTS trg_check_customer_email_uniqueness ON customers;
CREATE TRIGGER trg_check_customer_email_uniqueness
BEFORE INSERT OR UPDATE OF email ON customers
FOR EACH ROW EXECUTE FUNCTION check_platform_email_uniqueness('customer');

DROP TRIGGER IF EXISTS trg_sync_customer_email ON customers;
CREATE TRIGGER trg_sync_customer_email
AFTER INSERT OR UPDATE OF email OR DELETE ON customers
FOR EACH ROW EXECUTE FUNCTION sync_platform_user_email('customer');

-- Seller triggers
DROP TRIGGER IF EXISTS trg_check_seller_email_uniqueness ON sellers;
CREATE TRIGGER trg_check_seller_email_uniqueness
BEFORE INSERT OR UPDATE OF email ON sellers
FOR EACH ROW EXECUTE FUNCTION check_platform_email_uniqueness('seller');

DROP TRIGGER IF EXISTS trg_sync_seller_email ON sellers;
CREATE TRIGGER trg_sync_seller_email
AFTER INSERT OR UPDATE OF email OR DELETE ON sellers
FOR EACH ROW EXECUTE FUNCTION sync_platform_user_email('seller');

-- Deliveryman triggers
DROP TRIGGER IF EXISTS trg_check_deliveryman_email_uniqueness ON deliverymen;
CREATE TRIGGER trg_check_deliveryman_email_uniqueness
BEFORE INSERT OR UPDATE OF email ON deliverymen
FOR EACH ROW EXECUTE FUNCTION check_platform_email_uniqueness('deliveryman');

DROP TRIGGER IF EXISTS trg_sync_deliveryman_email ON deliverymen;
CREATE TRIGGER trg_sync_deliveryman_email
AFTER INSERT OR UPDATE OF email OR DELETE ON deliverymen
FOR EACH ROW EXECUTE FUNCTION sync_platform_user_email('deliveryman');

-- Admin triggers
DROP TRIGGER IF EXISTS trg_check_admin_email_uniqueness ON admins;
CREATE TRIGGER trg_check_admin_email_uniqueness
BEFORE INSERT OR UPDATE OF email ON admins
FOR EACH ROW EXECUTE FUNCTION check_platform_email_uniqueness('admin');

DROP TRIGGER IF EXISTS trg_sync_admin_email ON admins;
CREATE TRIGGER trg_sync_admin_email
AFTER INSERT OR UPDATE OF email OR DELETE ON admins
FOR EACH ROW EXECUTE FUNCTION sync_platform_user_email('admin');


-- 3. Product status column for pause / unpause administration
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_status;
ALTER TABLE products
    ADD CONSTRAINT chk_products_status CHECK (status IN ('active', 'paused'));


-- 4. Seller approval_status update and suspended_until column
ALTER TABLE sellers DROP CONSTRAINT IF EXISTS chk_sellers_approval_status;
ALTER TABLE sellers
    ADD CONSTRAINT chk_sellers_approval_status
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));

ALTER TABLE sellers
    ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;


-- 5. Deliveryman approval_status update and suspended_until column
ALTER TABLE deliverymen DROP CONSTRAINT IF EXISTS chk_deliverymen_approval_status;
ALTER TABLE deliverymen
    ADD CONSTRAINT chk_deliverymen_approval_status
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));

ALTER TABLE deliverymen
    ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;


-- 6. Delivery messages enhancements for read tracking and multi-role messaging
ALTER TABLE delivery_messages
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS recipient_role VARCHAR(20),
    ADD COLUMN IF NOT EXISTS recipient_id BIGINT;

ALTER TABLE delivery_messages
    ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE delivery_messages DROP CONSTRAINT IF EXISTS delivery_messages_sender_role_check;
ALTER TABLE delivery_messages
    ADD CONSTRAINT delivery_messages_sender_role_check
    CHECK (sender_role IN ('customer', 'deliveryman', 'seller', 'admin'));

ALTER TABLE delivery_messages DROP CONSTRAINT IF EXISTS delivery_messages_recipient_role_check;
ALTER TABLE delivery_messages
    ADD CONSTRAINT delivery_messages_recipient_role_check
    CHECK (recipient_role IS NULL OR recipient_role IN ('customer', 'deliveryman', 'seller', 'admin'));

CREATE INDEX IF NOT EXISTS idx_delivery_messages_unread
    ON delivery_messages (recipient_role, recipient_id, is_read);
