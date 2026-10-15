import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition-transform duration-[var(--motion-duration-fast)] ease-standard hover:-translate-y-px shadow-card hover:shadow-raised motion-reduce:transition-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0',
  {
    variants: {
      variant: {
        default:
          'bg-bg-action text-fg-on-action border-action hover:bg-action-hover',
        ghost:
          'bg-transparent text-fg-default border-strong hover:bg-action-subtle hover:text-fg-link-hover translate-y-0 shadow-none hover:shadow-raised',
        danger:
          'bg-bg-danger text-fg-on-danger border-danger hover:bg-accent-faulty-600',
      },
      size: {
        default: 'min-h-12 px-5 py-4 text-base',
        sm: 'min-h-11 px-3 py-2 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  pendingLabel?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      pendingLabel,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const isPending = Boolean(pendingLabel);
    const isDisabled = Boolean(disabled) || isPending;
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isPending || undefined}
        className={cn(
          buttonVariants({ variant, size, className }),
          isDisabled &&
            'bg-bg-disabled text-fg-disabled border-disabled shadow-none',
        )}
        {...props}
      >
        {isPending ? pendingLabel : children}
      </button>
    );
  },
);
Button.displayName = 'Button';
