import * as React from 'react';

export interface SkipLinkProps extends Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'className' | 'href'
> {
  href?: string;
  className?: string;
}

export function SkipLink({
  href = '#main',
  className,
  children,
  ...rest
}: SkipLinkProps) {
  return (
    <a
      href={href}
      className={[
        'absolute left-4 -top-16 z-overlay',
        'bg-bg-surface text-fg-default border border-border-strong rounded-md py-3 px-4',
        'focus:top-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children ?? 'Skip to main content'}
    </a>
  );
}
