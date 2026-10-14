-- 0003_equipment — TRD §3.2 equipment table (full D3 field set; C5/C2/I14).
-- No room column — OR-3 resolved 2026-10-13 (single Smart Class collection).
-- updated_at: NOT NULL, no default — set by the backend on every mutation (TRD §3.2, §3.5).
-- updated_by: FK → admins(id), set on every mutation; on-delete action not specified in TRD
--   → Postgres default (NO ACTION) applies — see MIGRATION_NOTES.md.

CREATE TABLE equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  core_functionality text,
  other_functionality text,
  condition condition_enum NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  image_keys text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL,
  updated_by uuid REFERENCES admins (id)
);
