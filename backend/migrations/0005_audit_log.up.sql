-- 0005_audit_log — TRD §3.2 audit_log table (admin-invite grants per task contract; C2).
-- Append-only, kept for project lifetime (TRD §3.1); UPDATE/DELETE privileges revoked in 0007_rls.
-- actor_admin_id: FK → admins(id) — on-delete action not specified in TRD → Postgres default (NO ACTION).

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_admin_id uuid REFERENCES admins (id),
  action text,
  target text,
  created_at timestamptz NOT NULL DEFAULT now()
);
