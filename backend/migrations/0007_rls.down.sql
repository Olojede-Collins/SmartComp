-- 0007_rls (down) — inverse of 0007_rls.up.sql.
-- Drops the 7 policies, disables RLS on all 4 tables, and restores Supabase default
-- table privileges (GRANT ALL to anon, authenticated, service_role; PUBLIC is left
-- with its Postgres default — no explicit GRANT/REVERSE to PUBLIC, matching stock
-- Supabase projects). Run FIRST in a full rollback (reverse version order).
-- Tables themselves are dropped by 0002–0005 downs afterwards.

DROP POLICY IF EXISTS audit_log_admin_insert ON audit_log;
DROP POLICY IF EXISTS audit_log_admin_select ON audit_log;
DROP POLICY IF EXISTS admin_invites_admin_select ON admin_invites;
DROP POLICY IF EXISTS admins_admin_delete ON admins;
DROP POLICY IF EXISTS admins_admin_select ON admins;
DROP POLICY IF EXISTS equipment_admin_all ON equipment;
DROP POLICY IF EXISTS equipment_anon_select ON equipment;

ALTER TABLE equipment DISABLE ROW LEVEL SECURITY;
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

GRANT ALL ON equipment TO anon, authenticated, service_role;
GRANT ALL ON admins TO anon, authenticated, service_role;
GRANT ALL ON admin_invites TO anon, authenticated, service_role;
GRANT ALL ON audit_log TO anon, authenticated, service_role;
