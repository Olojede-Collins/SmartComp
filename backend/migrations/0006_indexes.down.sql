-- 0006_indexes (down) — inverse of 0006_indexes.up.sql.
-- DROP INDEX IF EXISTS is not valid inside a transaction block on some older Postgres
-- versions when combined with DROP INDEX CONCURRENTLY; plain DROP INDEX IF EXISTS is used
-- here (migrations run outside CONCURRENTLY mode). Run before 0003/0005 downs
-- (reverse version order: 0007 → 0006 → 0005 → 0004 → 0003 → 0002 → 0001).

DROP INDEX IF EXISTS audit_log_created_at_idx;
DROP INDEX IF EXISTS equipment_updated_at_idx;
