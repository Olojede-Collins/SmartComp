-- 0001_condition_enum (down) — inverse of 0001_condition_enum.up.sql.
-- Down migrations run in reverse version order (0007 → 0001) — see README.md.
-- Dependent tables (equipment) must already be dropped by their own down migrations.

DROP TYPE IF EXISTS condition_enum;
