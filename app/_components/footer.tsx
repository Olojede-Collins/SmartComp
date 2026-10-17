import * as React from 'react';
import Image from 'next/image';

export type FooterVariant = 'public' | 'admin';

interface FooterLink {
  label: string;
  href: string;
}

const PUBLIC_LINKS: FooterLink[] = [
  { label: 'The Collection', href: '/room' },
  { label: 'Privacy', href: '/privacy' },
];

const ADMIN_LINKS: FooterLink[] = [
  { label: 'The Collection', href: '/room' },
  { label: 'The Inventory', href: '/admin' },
];

const LINK_CLASS = [
  'inline-flex items-center min-h-11 px-2 text-caption',
  'text-fg-link hover:text-fg-link-hover hover:underline',
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
].join(' ');

export interface FooterProps {
  variant?: FooterVariant;
  className?: string;
}

export function Footer({ variant = 'public', className }: FooterProps) {
  const links = variant === 'admin' ? ADMIN_LINKS : PUBLIC_LINKS;

  return (
    <footer
      className={[
        'border-t border-border-rule bg-bg-page text-fg-muted',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="mx-auto flex max-w-[var(--layout-containerMax)] flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/abu/logo-522x70.png"
            alt="Ahmadu Bello University"
            width={522}
            height={70}
            className="h-[23px] w-auto"
          />
        </div>
        <p className="text-caption text-fg-muted">
          Recorded by the ABU Smart Class lab team.
        </p>
        <div className="flex flex-wrap items-center gap-5">
          {links.map((link) => (
            <a key={link.href} href={link.href} className={LINK_CLASS}>
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
