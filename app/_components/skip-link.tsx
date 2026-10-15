import * as React from 'react';

/**
 * Skip link (frozen `.skip` pattern from every P4 preview).
 * Offscreen at top:-64px (calc(space-4 * -4)); :focus — not :focus-visible — snaps it to
 * top-4 so keyboard tab reveals it. Surface card with border-strong and radius-md.
 * First focusable element in the DOM; targets #main (the page main landmark id).
 */

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
        'bg-surface text-fg-default border border-border-strong rounded-md py-3 px-4',
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
