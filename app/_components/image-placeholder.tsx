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

function resolveKeyToUrl(key?: string): string | undefined {
  if (!key) return undefined;
  if (
    key.startsWith('http://') ||
    key.startsWith('https://') ||
    key.startsWith('/')
  ) {
    return key;
  }
  const r2Url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (r2Url && r2Url.trim()) {
    return `${r2Url.replace(/\/+$/, '')}/${key}`;
  }
  return `/images/${key}`;
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
  const [prevSrc, setPrevSrc] = React.useState(src);
  const [currentSrc, setCurrentSrc] = React.useState(() =>
    resolveKeyToUrl(src),
  );
  const [failed, setFailed] = React.useState(false);

  if (prevSrc !== src) {
    setPrevSrc(src);
    setCurrentSrc(resolveKeyToUrl(src));
    setFailed(false);
  }

  const handleError = () => {
    if (
      currentSrc &&
      currentSrc.startsWith('http') &&
      !currentSrc.includes('/images/')
    ) {
      const parts = currentSrc.split('/');
      const filename = parts[parts.length - 1];
      if (filename) {
        setCurrentSrc(`/images/${filename}`);
        return;
      }
    }
    setFailed(true);
  };

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

  if (currentSrc) {
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
          src={currentSrc}
          alt={alt}
          onError={handleError}
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
