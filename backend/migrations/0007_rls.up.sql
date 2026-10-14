-- 0007_rls — TRD §3.3 row-level security (C2; SECURITY.md §3).
-- Admin claim expression (verbatim, TRD §3.3): (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
-- Service role: no policies; Supabase service_role has BYPASSRLS — see MIGRATION_NOTES.md.
-- Revokes are cumulative: anon loses every privilege except equipment SELECT (TRD §3.3, "never
-- grant anon beyond SELECT"); audit_log loses UPDATE/DELETE/TRUNCATE from all roles (append-only,
-- TRD §3.1/§3.2) — TRUNCATE bypasses RLS so it is revoked in addition to the TRD-mandated
-- UPDATE/DELETE (documented extension in MIGRATION_NOTES.md).

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY equipment_anon_select
  ON equipment
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY equipment_admin_all
  ON equipment
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY admins_admin_select
  ON admins
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY admins_admin_delete
  ON admins
  FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY admin_invites_admin_select
  ON admin_invites
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY audit_log_admin_select
  ON audit_log
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY audit_log_admin_insert
  ON audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON equipment FROM anon;
REVOKE ALL ON admins FROM anon;
REVOKE ALL ON admin_invites FROM anon;
REVOKE ALL ON audit_log FROM anon;

REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM PUBLIC, anon, authenticated, service_role;
