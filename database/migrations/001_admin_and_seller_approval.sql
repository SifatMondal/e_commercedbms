-- Safe migration for an existing development database.
ALTER TABLE sellers
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing sellers predate the approval process, so preserve their access.
UPDATE sellers SET approval_status = 'approved' WHERE approval_status IS NULL OR approval_status = 'pending';

ALTER TABLE sellers DROP CONSTRAINT IF EXISTS chk_sellers_approval_status;
ALTER TABLE sellers
    ADD CONSTRAINT chk_sellers_approval_status
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

CREATE TABLE IF NOT EXISTS admins (
    admin_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
