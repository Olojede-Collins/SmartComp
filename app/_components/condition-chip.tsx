import * as React from 'react';
import { Icon, IconName } from './icon';
import { Condition } from './condition-enum';

/**
 * C-011 Condition chip.
 * Icon + word + colour, three redundant cues (WCAG 1.4.1). Never interactive.
 * Status icon ships at 20px (supersedes iconography.md's 16px — C-011 §8).
 * Unknown condition: neutral defensive chip with the raw word — never crash, never guess a colour.
 */

const CHIP_VARIANTS: Record<
  Condition,
  { className: string; icon: IconName }
> = {
  Working: {
    className: 'chip--working bg-status-working border-status-working text-fg-status-working',
    icon: 'circle-solid',
  },
  Faulty: {
    className: 'chip--faulty bg-status-faulty border-status-faulty text-fg-status-faulty',
    icon: 'triangle-alert',
  },
  'Under Maintenance': {
    className: 'chip--maintenance bg-status-maintenance border-status-maintenance text-fg-status-maintenance',
    icon: 'spanner',
  },
  Decommissioned: {
    className: 'chip--decommissioned bg-status-decommissioned border-status-decommissioned text-fg-status-decommissioned',
    icon: 'minus-circle',
  },
};

const BASE =
  'chip inline-flex items-center gap-2 min-h-6 px-3 py-2 rounded-sm border ' +
  'text-xs font-semibold tracking-micro whitespace-nowrap';

const NEUTRAL = 'bg-surface border-rule text-fg-default';

export interface ConditionChipProps {
  condition: Condition | string;
  className?: string;
}

export function ConditionChip({ condition, className }: ConditionChipProps) {
  const variant = CHIP_VARIANTS[condition as Condition];
  const classes = [BASE, variant ? variant.className : NEUTRAL, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      {variant ? <Icon name={variant.icon} size={20} /> : null}
      <span>{condition}</span>
    </span>
  );
}
