-- 0002_admins (down) — inverse of 0002_admins.up.sql.
-- Run after 0003–0007 downs (reverse order): equipment/admin_invites/audit_log FKs reference admins.

DROP TABLE IF EXISTS admins;
