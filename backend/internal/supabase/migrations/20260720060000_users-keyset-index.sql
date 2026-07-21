-- Backs keyset (cursor) pagination on GET /users, which orders and seeks by
-- (full_name, nuid).
CREATE INDEX IF NOT EXISTS idx_users_full_name_nuid ON users (full_name, nuid);
