-- 0003_equipment (down) — inverse of 0003_equipment.up.sql.
-- Drops the equipment_updated_at index (0006) implicitly with the table only if 0006
-- has already been rolled back; run downs in reverse version order (README.md).

DROP TABLE IF EXISTS equipment;
