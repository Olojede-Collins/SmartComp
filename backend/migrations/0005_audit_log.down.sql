-- 0005_audit_log (down) — inverse of 0005_audit_log.up.sql.
-- Run after 0007 (RLS) and 0006 (indexes) downs — reverse version order (README.md).

DROP TABLE IF EXISTS audit_log;
