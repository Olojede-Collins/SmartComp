import * as React from 'react';
import { Icon } from './icon';

export interface StampProps {
  children: React.ReactNode;
  variant?: 'inline' | 'banner';
  className?: string;
}

export function Stamp({ children, variant = 'inline', className }: StampProps) {
  const isBanner = variant === 'banner';
  return (
    <span
      className={[
        'inline-flex items-center gap-2 max-w-full bg-bg-stamp border border-border-warn',
        'rounded-sm px-3 py-2 text-micro tracking-micro text-fg-stamp',
        isBanner ? 'flex w-full' : 'w-fit',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon name="alert-banner" size={20} className="shrink-0" />
      <span>{children}</span>
    </span>
  );
}
