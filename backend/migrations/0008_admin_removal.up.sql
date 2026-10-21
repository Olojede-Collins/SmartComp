-- 0008_admin_removal — soft removal of admins (PRD FR-8.2).
-- Rows are retained so audit_log.actor_admin_id, equipment.updated_by and
-- admin_invites.invited_by keep valid, attributable references.
-- removed_at NULL = active admin; non-NULL = removed (future sessions revoked).

ALTER TABLE admins ADD COLUMN removed_at timestamptz;
