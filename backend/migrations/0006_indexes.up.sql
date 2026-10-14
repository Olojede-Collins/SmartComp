-- 0006_indexes — TRD §3.2 explicit indexes.
-- equipment.updated_at DESC: freshness/audit queries (TRD §3.5).
-- audit_log.created_at: append-only log ordered by time (C2).
-- The partial unique index admin_invites_email_pending_key lives in 0004_admin_invites.up.sql
-- (table-inherent constraint, travels with its table in up/down pairs).

CREATE INDEX equipment_updated_at_idx
  ON equipment (updated_at DESC);

CREATE INDEX audit_log_created_at_idx
  ON audit_log (created_at);
