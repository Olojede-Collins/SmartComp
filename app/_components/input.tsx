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
    const isPassword = type === 'password' || variant === 'password';
    const [showPassword, setShowPassword] = React.useState(false);

    const resolvedType = isPassword
      ? showPassword
        ? 'text'
        : 'password'
      : (type ?? (variant === 'number' ? 'text' : 'text'));

    const inputNode = (
      <input
        ref={ref}
        type={resolvedType}
        inputMode={variant === 'number' ? 'numeric' : undefined}
        className={cn(
          inputVariants({ variant, className }),
          isPassword && 'pr-11',
        )}
        {...props}
      />
    );

    if (isPassword) {
      return (
        <div className="relative w-full">
          {inputNode}
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-fg-muted hover:text-fg-default focus-visible:outline-2 focus-visible:outline-border-focus rounded cursor-pointer min-h-8 min-w-8 flex items-center justify-center transition-colors"
            aria-label={showPassword ? 'Hide value' : 'Show value'}
            tabIndex={-1}
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <line x1="2" x2="22" y1="2" y2="22" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      );
    }

    return inputNode;
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
