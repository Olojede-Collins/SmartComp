import * as React from 'react';

export interface RailNavLinkProps extends Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'className' | 'variant'
> {
  href: string;
  current?: boolean;
  variant?: 'link' | 'action';
  className?: string;
}

export function RailNavLink({
  href,
  current = false,
  variant = 'link', // eslint-disable-line @typescript-eslint/no-unused-vars
  className,
  children,
  ...rest
}: RailNavLinkProps) {
  return (
    <a
      href={href}
      aria-current={current ? 'page' : undefined}
      className={[
        'inline-flex items-center min-h-11 px-1 text-body-small no-underline',
        'text-fg-on-rail-muted hover:text-fg-on-rail',
        'border-b-3 border-transparent',
        'aria-[current=page]:text-fg-on-rail aria-[current=page]:border-bg-rail-active',
        'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus-on-rail',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </a>
  );
}
