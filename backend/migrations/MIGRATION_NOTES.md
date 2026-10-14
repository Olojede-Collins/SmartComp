# MIGRATION_NOTES.md — ST-03 Data Layer

Working document for `backend/migrations/`. Tracks open items, verbatim
decisions taken from TRD §3.2/§3.3, and post-apply verification probes.

**TBD count (blocking): 0.** TRD §3.2 and §3.3 fully determine the schema and
RLS policies; nothing in the migration set required an invented value.

---

## 1. Non-blocking observations

| # | Observation | Resolution / status |
| - | ----------- | ------------------- |
| O-1 | FK `on delete` actions are not specified anywhere in TRD §3.2. | Implemented verbatim as bare `REFERENCES` — Postgres default (`NO ACTION`). Admin cannot be deleted while rows still reference them (blocked by FK). Flag to Israel if `SET NULL` or `CASCADE` is wanted; no code depends on a specific action today. |
| O-2 | `audit_log.action` and `audit_log.target` are `text` with no NOT NULL. | Read verbatim from TRD §3.2; left nullable. Backend (ST-06) always supplies both on insert; the column constraint is deliberately loose. |
| O-3 | `equipment.updated_at` is `NOT NULL` with **no** `DEFAULT now()`. | Correct per TRD §3.2 — the Render backend sets `updated_at` on every mutation (TRD §3.5). First INSERT must supply it explicitly; a missing value fails the NOT NULL constraint rather than silently defaulting. |
| O-4 | Invite expiry (OR-7) has no `expires_at` column. | Frozen schema (TRD §3.2) has no expiry field; acceptance-time check is out of ST-03 scope. If OR-7 is resolved with a column, it becomes a new migration `0008_*`. |
| O-5 | Supabase default table privileges (`GRANT ALL … TO anon, authenticated, service_role`) are assumed present on a stock Supabase project. | `0007_rls.up.sql` only *revokes*; it does not `GRANT` to authenticated/service_role (those retain stock defaults). Probe queries below verify the assumption after Israel applies the migration. |
| O-6 | `audit_log` TRUNCATE is revoked from `service_role` in addition to the TRD-mandated `UPDATE`/`DELETE`. | TRUNCATE bypasses RLS; the append-only guarantee (TRD §3.1, "kept for project lifetime") would otherwise be voidable by any role holding the table privilege. Documented extension; reverse it in `0007_rls.down.sql` via `GRANT ALL`. |

---

## 2. Post-apply probes (Israel, after applying 0007)

Run in the Supabase SQL editor. All must return the stated result.

```sql
-- P1: RLS enabled on all 4 tables (expect 4 rows, relrowsecurity = true)
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('equipment', 'admins', 'admin_invites', 'audit_log')
  AND relkind = 'r';

-- P2: exactly 7 policies exist (expect count = 7)
SELECT count(*) FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('equipment', 'admins', 'admin_invites', 'audit_log');

-- P3: anon cannot INSERT/UPDATE/DELETE equipment (expect 0 privileges)
SELECT privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_name = 'equipment'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

-- P4: anon cannot touch admins/admin_invites/audit_log (expect 0 rows)
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_name IN ('admins', 'admin_invites', 'audit_log');

-- P5: audit_log UPDATE/DELETE/TRUNCATE revoked from everyone (expect 0 rows)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'audit_log'
  AND privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE');
```

---

## 3. Apply checklist

- [x] `0001_condition_enum.up.sql`
- [x] `0002_admins.up.sql`
- [x] `0003_equipment.up.sql`
- [x] `0004_admin_invites.up.sql`
- [x] `0005_audit_log.up.sql`
- [x] `0006_indexes.up.sql`
- [x] `0007_rls.up.sql`
- [x] Probes P1–P5 run and green

Applied 2026-10-14 via `supabase db push` (CLI 2.120.0, project ref uahhetoxdcuikbxleqvw); probes P1–P5 green the same day. Evidence: `.agent/teamwork/S-01/agents/worker_w3/probes_live_results.json` (gitignored session artifact).
