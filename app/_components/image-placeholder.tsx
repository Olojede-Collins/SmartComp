'use client';

import * as React from 'react';
import { Icon } from './icon';
import { Button } from './button';

export type ImagePlaceholderState = 'empty' | 'loading' | 'failed';
export type ImagePlaceholderSize = 'full' | 'thumb';

export interface ImagePlaceholderProps {
  state?: ImagePlaceholderState;
  size?: ImagePlaceholderSize;
  src?: string;
  alt?: string;
  showRetry?: boolean;
  onRetry?: () => void;
  className?: string;
}

export function ImagePlaceholder({
  state = 'empty',
  size = 'full',
  src,
  alt = '',
  showRetry = false,
  onRetry,
  className,
}: ImagePlaceholderProps) {
  const [failed, setFailed] = React.useState(false);
  const effective = state === 'failed' || failed ? 'failed' : state;

  const geometry =
    size === 'thumb'
      ? 'w-[96px] h-[72px] p-2 gap-1'
      : 'aspect-[4/3] w-full p-4 gap-2';
  const ground = [
    'flex flex-col items-center justify-center rounded-sm text-center',
    'text-fg-placeholder-text',
    geometry,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (effective === 'loading') {
    return (
      <div
        aria-hidden="true"
        className={['bg-bg-skeleton border border-border-rule', ground].join(
          ' ',
        )}
      />
    );
  }

  if (effective === 'failed') {
    return (
      <div
        className={[
          'bg-bg-surface-sunken border border-border-rule',
          ground,
        ].join(' ')}
      >
        <Icon name="image-off" size={20} />
        <span className="text-caption">The image failed to load.</span>
        {showRetry ? (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    );
  }

  if (src) {
    return (
      <div
        className={[
          'overflow-hidden rounded-sm border border-border-rule',
          size === 'thumb' ? 'w-[96px] h-[72px]' : 'aspect-[4/3] w-full',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={['bg-bg-placeholder border border-border-rule', ground].join(
        ' ',
      )}
    >
      <span className="text-micro">PHOTO</span>
    </div>
  );
}
