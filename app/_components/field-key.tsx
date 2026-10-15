import * as React from 'react';

/**
 * C-024 Field key.
 * The catalogue-caption register: micro, tracking-caps (0.14em), font-medium override,
 * fg-muted, block. Uppercase lives in the source string — never CSS-transformed (D-020).
 * Not an eyebrow/section kicker (Direction B bans those).
 */

export interface FieldKeyProps extends Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  'className'
> {
  className?: string;
}

export function FieldKey({ className, children, ...rest }: FieldKeyProps) {
  return (
    <span
      className={[
        'block text-xs font-medium tracking-caps text-fg-muted',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </span>
  );
}
