/**
 * Shared condition enum — PRD FR-2.1 / D-020.
 * Single source for the Select options (C-009), the Chip map (C-011) and the export column.
 * Order and spelling are binding — never re-case, abbreviate, translate or sort.
 */
export const CONDITION_ENUM = [
  'Working',
  'Faulty',
  'Under Maintenance',
  'Decommissioned',
] as const;

export type Condition = (typeof CONDITION_ENUM)[number];
