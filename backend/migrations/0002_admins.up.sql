-- 0002_admins — TRD §3.2 admins table.
-- id: PK, FK → auth.users(id); name: text; email: NOT NULL, UNIQUE; created_at: NOT NULL, default now().
-- Flat equality: no role column (adminship = Supabase Auth app_metadata.role, TRD §3.2).
-- FK on-delete action is not specified in TRD → Postgres default (NO ACTION) applies — see MIGRATION_NOTES.md.

CREATE TABLE admins (
  id uuid PRIMARY KEY REFERENCES auth.users (id),
  name text,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
