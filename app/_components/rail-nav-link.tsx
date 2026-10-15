import * as React from 'react';

/**
 * C-003 Rail nav link.
 * body-small muted inactive; active = full-strength colour + 3px bg-rail-active underline
 * (shape cue, not colour-only). 3px transparent bottom border reserved in the default
 * state so activation never reflows. Hover is instant (motion.md §1 — no transition).
 * Focus ring always uses border-focus-on-rail, never the default border-focus.
 * Navigation is never disabled; no icon, no pill background.
 */

export interface RailNavLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'variant'> {
  href: string;
  current?: boolean;
  /** `action` (Sign out, admin rail) — same visual treatment; link or button per TRD. */
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
        'inline-flex items-center min-h-11 px-1 text-sm no-underline',
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
