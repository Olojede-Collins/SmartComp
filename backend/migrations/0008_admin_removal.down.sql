-- 0008_admin_removal (down) — inverse of 0008_admin_removal.up.sql.

ALTER TABLE admins DROP COLUMN IF EXISTS removed_at;
