-- 0001_condition_enum — TRD §3.2: enum condition_enum (D1; PRD FR-2.1).
-- Values verbatim: 'Working' | 'Faulty' | 'Under Maintenance' | 'Decommissioned'.
-- Applied to the Supabase cloud dev project by the developer (TRD §3.4) — see README.md.

CREATE TYPE condition_enum AS ENUM (
  'Working',
  'Faulty',
  'Under Maintenance',
  'Decommissioned'
);
