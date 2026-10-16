import * as React from 'react';
import { Icon, IconName } from './icon';
import { Condition } from './condition-enum';

const CHIP_VARIANTS: Record<Condition, { className: string; icon: IconName }> =
  {
    Working: {
      className:
        'chip--working bg-bg-status-working border-border-status-working text-fg-status-working',
      icon: 'circle-solid',
    },
    Faulty: {
      className:
        'chip--faulty bg-bg-status-faulty border-border-status-faulty text-fg-status-faulty',
      icon: 'triangle-alert',
    },
    'Under Maintenance': {
      className:
        'chip--maintenance bg-bg-status-maintenance border-border-status-maintenance text-fg-status-maintenance',
      icon: 'spanner',
    },
    Decommissioned: {
      className:
        'chip--decommissioned bg-bg-status-decommissioned border-border-status-decommissioned text-fg-status-decommissioned',
      icon: 'minus-circle',
    },
  };

const BASE =
  'chip inline-flex items-center gap-2 min-h-6 px-3 py-2 rounded-sm border ' +
  'text-micro font-semibold tracking-micro whitespace-nowrap';

const NEUTRAL = 'bg-bg-surface border-border-rule text-fg-default';

export interface ConditionChipProps {
  condition: Condition | string;
  className?: string;
}

export function ConditionChip({ condition, className }: ConditionChipProps) {
  const variant = Object.hasOwn(CHIP_VARIANTS, condition)
    ? CHIP_VARIANTS[condition as Condition]
    : undefined;
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
