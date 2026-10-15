import * as React from 'react';
import { cn } from '../../lib/utils';
import { CONDITION_ENUM } from './condition-enum';

const selectVariants =
  'w-full min-h-11 pl-4 pr-7 py-3 rounded-md border border-strong bg-surface text-fg-default font-sans text-base appearance-none aria-invalid:border-border-error disabled:bg-disabled disabled:text-fg-disabled disabled:border-disabled disabled:cursor-not-allowed focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus';

const chevVariants =
  'ico pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 size-4 text-fg-muted';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="select-wrap relative flex">
        <select ref={ref} className={cn(selectVariants, className)} {...props}>
          {children ??
            CONDITION_ENUM.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
        </select>
        <svg
          className={chevVariants}
          viewBox="0 0 20 20"
          aria-hidden="true"
          focusable="false"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </div>
    );
  },
);
Select.displayName = 'Select';
