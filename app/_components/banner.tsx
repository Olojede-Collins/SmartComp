import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from './icon';
import { Button } from './button';

export type BannerTone = 'caution' | 'error' | 'success';

const TONES: Record<
  BannerTone,
  {
    box: string;
    heading: string;
    icon?: IconName;
    iconClass?: string;
    role?: 'alert' | 'status';
  }
> = {
  caution: {
    box: 'bg-bg-banner-warn border-border-warn',
    heading: 'text-h3 text-fg-stamp',
    icon: 'alert-banner',
    iconClass: 'text-fg-stamp',
    role: 'alert',
  },
  error: {
    box: 'banner--error bg-bg-surface border-border-error',
    heading: 'text-h3 text-fg-status-faulty',
    icon: 'triangle-alert',
    iconClass: 'text-fg-status-faulty',
    role: 'alert',
  },
  success: {
    box: 'banner--success bg-bg-surface border-border-status-working',
    heading: 'text-h3 text-fg-status-working',
    role: 'status',
  },
};

const join = (...parts: (string | undefined | false)[]) =>
  parts.filter(Boolean).join(' ');

export interface BannerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'className' | 'children' | 'slot'
> {
  tone?: BannerTone;
  heading: React.ReactNode;
  children?: React.ReactNode;
  faulty?: React.ReactNode;
  code?: string;
  live?: boolean;
  elapsed?: React.ReactNode;
  dismissible?: boolean;
  dismissLabel?: string;
  onDismiss?: () => void;
  slot?: boolean;
  entering?: boolean;
  className?: string;
}

export function Banner({
  tone = 'caution',
  heading,
  children,
  faulty,
  code,
  live = false,
  elapsed,
  dismissible = false,
  dismissLabel = 'Dismiss',
  onDismiss,
  slot = false,
  entering = false,
  className,
  ...rest
}: BannerProps) {
  const toneSpec = TONES[tone];
  const role = rest.role ?? toneSpec.role;
  const isDismissible = dismissible && tone === 'success';

  const headingEl = <h3 className={toneSpec.heading}>{heading}</h3>;
  const copyEl = children ? (
    <p className="text-body-small text-fg-default">{children}</p>
  ) : null;

  const box = (
    <div
      role={role}
      aria-live={toneSpec.role === 'status' ? 'polite' : undefined}
      className={cn(
        'banner flex items-start gap-3 px-5 py-4 rounded-md border',
        toneSpec.box,
        entering &&
          'transition-opacity transition-transform duration-slow ease-standard motion-reduce:transition-none',
        className,
      )}
      {...rest}
    >
      {toneSpec.icon ? (
        <Icon
          name={toneSpec.icon}
          size={20}
          className={join('shrink-0 mt-0.5', toneSpec.iconClass)}
        />
      ) : null}
      <div className="banner__body flex flex-1 min-w-0 flex-col gap-2">
        {live ? (
          <div
            className="banner__live flex flex-col gap-2"
            role="status"
            aria-live="polite"
          >
            {headingEl}
            {copyEl}
          </div>
        ) : (
          <>
            {headingEl}
            {copyEl}
          </>
        )}
        {faulty ? (
          <p className="faulty text-body-small text-fg-status-faulty">
            {faulty}
          </p>
        ) : null}
        {code ? (
          <p className="banner__code text-data text-fg-muted">{code}</p>
        ) : null}
        {elapsed ? (
          <div
            className="banner__elapsed mt-2 flex flex-col gap-1"
            aria-hidden="true"
          >
            {elapsed}
          </div>
        ) : null}
        {isDismissible ? (
          <div>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              {dismissLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return slot ? (
    <div className="banner-slot max-w-[var(--layout-containerMax)] mx-auto px-[var(--layout-gutter)] pt-4">
      {box}
    </div>
  ) : (
    box
  );
}
