'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ImagePlaceholder } from './image-placeholder';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './dialog';
import { Button } from './button';
import { Icon } from './icon';

export interface GalleryImage {
  src?: string;
  alt?: string;
}

export interface ImageGalleryProps {
  images?: (string | GalleryImage)[];
  title?: string;
  initialIndex?: number;
  className?: string;
  state?: 'default' | 'image-failed';
}

export function ImageGallery({
  images = [],
  title = 'Photograph viewer',
  initialIndex = 0,
  className,
  state = 'default',
}: ImageGalleryProps) {
  const normalizedImages: GalleryImage[] = images.map((item) =>
    typeof item === 'string' ? { src: item, alt: title } : item,
  );

  const [activeIndex, setActiveIndex] = React.useState<number>(initialIndex);
  const [viewerOpen, setViewerOpen] = React.useState<boolean>(false);

  const total = normalizedImages.length;
  const current =
    total > 0
      ? (normalizedImages[activeIndex] ?? normalizedImages[0])
      : undefined;

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  };

  return (
    <div className={cn('gallery flex flex-col', className)}>
      <div className="gallery__hero w-full">
        {state === 'image-failed' || !current?.src ? (
          <div className="w-full text-left rounded-sm">
            <ImagePlaceholder
              src={undefined}
              alt={current?.alt ?? title}
              size="full"
              state={state === 'image-failed' ? 'failed' : 'empty'}
              showRetry={state === 'image-failed'}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            aria-label="Open full photograph viewer"
            className="w-full text-left cursor-pointer rounded-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          >
            <ImagePlaceholder
              src={current?.src}
              alt={current?.alt ?? title}
              size="full"
            />
          </button>
        )}
      </div>

      {total > 1 || (total === 1 && current?.src) ? (
        <ul className="gallery__thumbs flex flex-wrap gap-2 mt-3 list-none p-0 m-0">
          {normalizedImages.map((img, idx) => {
            const isActive = idx === activeIndex;
            return (
              <li key={img.src ?? idx}>
                <button
                  type="button"
                  aria-current={isActive ? 'true' : 'false'}
                  aria-label={`View photograph ${idx + 1} of ${total}`}
                  onClick={() => setActiveIndex(idx)}
                  className={cn(
                    'gallery__thumb w-[96px] h-[72px] rounded-sm p-0 overflow-hidden cursor-pointer block',
                    isActive
                      ? 'border-[3px] border-border-focus'
                      : 'border border-border-rule',
                  )}
                >
                  <ImagePlaceholder src={img.src} alt="" size="thumb" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-[720px] p-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="w-full aspect-[4/3] rounded-sm overflow-hidden border border-border-rule bg-bg-surface-sunken flex items-center justify-center">
            <ImagePlaceholder
              src={state === 'image-failed' ? undefined : current?.src}
              alt={current?.alt ?? title}
              size="full"
              state={state === 'image-failed' ? 'failed' : 'empty'}
              showRetry={state === 'image-failed'}
            />
          </div>

          {total > 1 ? (
            <div className="gallery__nav flex items-center justify-between gap-2 mt-3">
              <button
                type="button"
                aria-label="Previous image"
                disabled={total <= 1}
                onClick={handlePrev}
                className="icon-btn w-11 h-11 inline-flex items-center justify-center rounded-sm text-fg-default hover:bg-bg-action-subtle hover:text-fg-link-hover disabled:text-fg-disabled disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              >
                <Icon name="chevron-left" size={20} />
              </button>
              <span className="font-mono text-data text-fg-muted">
                {activeIndex + 1} / {total}
              </span>
              <button
                type="button"
                aria-label="Next image"
                disabled={total <= 1}
                onClick={handleNext}
                className="icon-btn w-11 h-11 inline-flex items-center justify-center rounded-sm text-fg-default hover:bg-bg-action-subtle hover:text-fg-link-hover disabled:text-fg-disabled disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              >
                <Icon name="chevron-right" size={20} />
              </button>
            </div>
          ) : null}

          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setViewerOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
