import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const inputVariants = cva(
  'w-full min-h-11 px-4 py-3 rounded-md border border-border-strong bg-bg-surface text-fg-default font-sans text-base placeholder:text-fg-placeholder-text aria-invalid:border-border-error disabled:bg-bg-disabled disabled:text-fg-disabled disabled:border-border-disabled disabled:cursor-not-allowed read-only:bg-bg-disabled read-only:text-fg-disabled read-only:border-border-disabled focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
  {
    variants: {
      variant: {
        text: '',
        number: 'max-w-40',
        password: '',
      },
    },
    defaultVariants: {
      variant: 'text',
    },
  },
);

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'>,
    VariantProps<typeof inputVariants> {
  className?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, type, ...props }, ref) => {
    const resolvedType =
      type ??
      (variant === 'number'
        ? 'text'
        : variant === 'password'
          ? 'password'
          : 'text');
    return (
      <input
        ref={ref}
        type={resolvedType}
        inputMode={variant === 'number' ? 'numeric' : undefined}
        className={cn(inputVariants({ variant, className }))}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export interface TextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'className'
> {
  className?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full min-h-11 px-4 py-3 rounded-md border border-border-strong bg-bg-surface text-fg-default font-sans text-base placeholder:text-fg-placeholder-text aria-invalid:border-border-error disabled:bg-bg-disabled disabled:text-fg-disabled disabled:border-border-disabled disabled:cursor-not-allowed read-only:bg-bg-disabled read-only:text-fg-disabled read-only:border-border-disabled focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus min-h-32 resize-y',
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';
