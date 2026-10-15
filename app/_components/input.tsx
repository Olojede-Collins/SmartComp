import * as React from 'react';

/**
 * C-008 Text input + Textarea.
 * 44px min-height, solid disabled pair (never opacity), read-only = disabled look but focusable.
 * Invalid = aria-invalid + border-error token swap. Placeholder token only — never a label substitute.
 */

const FIELD_BASE =
  'w-full min-h-11 px-4 py-3 rounded-md border border-strong bg-surface text-fg-default font-sans text-base ' +
  'placeholder:text-fg-placeholder-text ' +
  'aria-invalid:border-border-error ' +
  'disabled:bg-disabled disabled:text-fg-disabled disabled:border-disabled disabled:cursor-not-allowed ' +
  'read-only:bg-disabled read-only:text-fg-disabled read-only:border-disabled ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'> {
  /** `number` adds inputmode=numeric and the 10em max-width cap (quantity). */
  variant?: 'text' | 'number' | 'password';
  className?: string;
}

export function Input({ variant = 'text', className, type, ...rest }: InputProps) {
  const classes = [FIELD_BASE, variant === 'number' && 'max-w-40', className]
    .filter(Boolean)
    .join(' ');
  const resolvedType =
    type ?? (variant === 'number' ? 'text' : variant === 'password' ? 'password' : 'text');

  return (
    <input
      type={resolvedType}
      inputMode={variant === 'number' ? 'numeric' : undefined}
      className={classes}
      {...rest}
    />
  );
}

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  className?: string;
}

export function Textarea({ className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={[FIELD_BASE, 'min-h-32 resize-y', className].filter(Boolean).join(' ')}
      {...rest}
    />
  );
}
