import * as React from 'react';
import { CONDITION_ENUM } from './condition-enum';

/**
 * C-009 Select (condition) — the only select in the product.
 * Native <select> + appearance-none + positioned 16px down-chevron (shipped s005 pattern).
 * Options are the four FR-2.1 enum strings, verbatim, in order (D-020).
 */

const SELECT_BASE =
  'w-full min-h-11 pl-4 pr-7 py-3 rounded-md border border-strong bg-surface text-fg-default ' +
  'font-sans text-base appearance-none ' +
  'aria-invalid:border-border-error ' +
  'disabled:bg-disabled disabled:text-fg-disabled disabled:border-disabled disabled:cursor-not-allowed ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus';

const CHEV_BASE =
  'ico pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 size-4 text-fg-muted';

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  className?: string;
}

export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <div className="select-wrap relative flex">
      <select className={[SELECT_BASE, className].filter(Boolean).join(' ')} {...rest}>
        {children ?? CONDITION_ENUM.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <svg
        className={CHEV_BASE}
        viewBox="0 0 20 20"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M5 8l5 5 5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
