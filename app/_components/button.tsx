import * as React from 'react';

/**
 * C-005 Primary / C-006 Ghost / C-007 Danger button.
 * Native <button> (hand-rolled; shadcn/Radix arrives M3 — visuals identical to shipped .btn).
 * Disabled = solid token pair, never opacity. Pending = label word swap + aria-busy, no spinner.
 * Focus = token-only outline ring (D-035 fallback — no --shadow-focus in tokens).
 */

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md border font-semibold ' +
  'transition-transform duration-[var(--motion-duration-fast)] ease-standard ' +
  'hover:-translate-y-px hover:shadow-raised motion-reduce:transition-none ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus ' +
  'disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0';

const VARIANTS = {
  default: 'bg-action text-fg-on-action border-action hover:bg-action-hover',
  ghost: 'bg-transparent text-fg-default border-strong translate-y-0 shadow-none hover:bg-action-subtle hover:text-fg-link-hover hover:shadow-raised hover:translate-y-0',
  danger: 'bg-danger text-fg-on-danger border-danger hover:bg-accent-faulty-600',
} as const;

const SIZES = {
  default: 'min-h-12 px-5 py-4 text-base', // 48px, space-4/5, body
  sm: 'min-h-11 px-3 py-2 text-sm',        // 44px, space-2/3, body-small
} as const;

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** When set and the control is busy, the label is replaced by this word (e.g. "Saving.") and aria-busy=true. */
  pendingLabel?: string;
  className?: string;
}

export function Button({
  variant = 'default',
  size = 'default',
  pendingLabel,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const isPending = Boolean(pendingLabel);
  const isDisabled = Boolean(disabled) || isPending;
  const classes = [
    BASE,
    VARIANTS[variant],
    SIZES[size],
    // Solid disabled pair (always present on disabled controls — never opacity; critic O-2).
    isDisabled && 'bg-disabled text-fg-disabled border-disabled shadow-none',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isPending || undefined}
      className={classes}
      {...rest}
    >
      {isPending ? pendingLabel : children}
    </button>
  );
}
