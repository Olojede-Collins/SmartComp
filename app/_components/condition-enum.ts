export const CONDITION_ENUM = [
  'Working',
  'Faulty',
  'Under Maintenance',
  'Decommissioned',
] as const;

export type Condition = (typeof CONDITION_ENUM)[number];
