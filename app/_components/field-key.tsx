import * as React from 'react';

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
