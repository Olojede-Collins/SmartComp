import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition-transform duration-fast ease-standard hover:-translate-y-px active:translate-y-0 shadow-card hover:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus min-w-11 cursor-pointer disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0',
  {
    variants: {
      variant: {
        default:
          'bg-bg-action text-fg-on-action border-bg-action hover:bg-bg-action-hover hover:border-bg-action-hover',
        ghost:
          'bg-transparent text-fg-default border-border-strong hover:bg-bg-action-subtle hover:text-fg-link-hover hover:translate-y-0 hover:shadow-raised active:shadow-card',
        danger:
          'bg-bg-danger text-fg-on-danger border-bg-danger hover:bg-accent-faulty-600 hover:border-accent-faulty-600',
      },
      size: {
        default: 'min-h-12 px-5 py-4 text-base',
        sm: 'min-h-11 px-3 py-2 text-body-small',
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
            'disabled:bg-bg-disabled disabled:text-fg-disabled disabled:border-border-disabled',
        )}
        {...props}
      >
        {isPending ? pendingLabel : children}
      </button>
    );
  },
);
Button.displayName = 'Button';
