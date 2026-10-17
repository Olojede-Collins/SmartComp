import * as React from 'react';
import Image from 'next/image';
import { RailNavLink } from './rail-nav-link';

export type HeaderRailVariant = 'public' | 'admin';

interface RailLink {
  label: string;
  href: string;
}

const PUBLIC_LINKS: RailLink[] = [
  { label: 'Home', href: '/' },
  { label: 'The collection', href: '/room' },
];

const ADMIN_LINKS: RailLink[] = [
  { label: 'Items', href: '/admin' },
  { label: 'Admins', href: '/admin/admins' },
];

const RAIL_LINK_CLASS = [
  'inline-flex items-center min-h-11 px-1 text-body-small no-underline bg-transparent',
  'text-fg-on-rail-muted hover:text-fg-on-rail active:scale-[0.98]',
  'border-b-3 border-transparent',
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus-on-rail',
].join(' ');

export interface HeaderRailProps {
  variant?: HeaderRailVariant;
  current?: string;
  children?: React.ReactNode;
  className?: string;
}

export function HeaderRail({
  variant = 'public',
  current,
  children,
  className,
}: HeaderRailProps) {
  const isAdmin = variant === 'admin';
  const links = isAdmin ? ADMIN_LINKS : PUBLIC_LINKS;

  return (
    <>
      <header
        className={[
          'sticky top-0 z-rail h-[var(--layout-railHeight)] aasm-chrome',
          'bg-bg-rail backdrop-blur-md backdrop-saturate-180 border-b border-black/[0.08] text-fg-on-rail',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="mx-auto flex h-full max-w-[var(--layout-containerMax)] items-center gap-5 px-5">
          <a
            href={isAdmin ? '/admin' : '/'}
            className="inline-flex items-center gap-3 min-h-11 whitespace-nowrap px-1 text-fg-on-rail no-underline active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus-on-rail"
          >
            <Image
              src="/assets/abu/logo-522x70.png"
              alt="Ahmadu Bello University"
              width={261}
              height={35}
              className="flex-none h-[18px] w-auto md:h-[22px]"
            />
            <span className="hidden text-body-small font-semibold tracking-tight md:inline text-neutral-900">
              ABU Smart Class
            </span>
          </a>
          <nav
            aria-label="Primary"
            className="ml-auto flex h-full items-center gap-3 md:gap-5"
          >
            {links.map((link) => (
              <RailNavLink
                key={link.href}
                href={link.href}
                current={current === link.href}
              >
                {link.label}
              </RailNavLink>
            ))}
            {isAdmin ? (
              <button type="button" className={RAIL_LINK_CLASS}>
                Sign out
              </button>
            ) : null}
          </nav>
        </div>
      </header>
      {isAdmin ? (
        <div className="banner-slot max-w-[var(--layout-containerMax)] mx-auto px-[var(--layout-gutter)] pt-4">
          {children}
        </div>
      ) : (
        children
      )}
    </>
  );
}
