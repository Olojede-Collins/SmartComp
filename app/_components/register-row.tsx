import * as React from 'react';
import { ConditionChip } from './condition-chip';
import { Condition } from './condition-enum';
import { DataStrip, DataStripPair } from './data-strip';
import { ImagePlaceholder } from './image-placeholder';
import { LoadingSkeleton } from './loading-skeleton';

export interface RegisterRowImage {
  src?: string;
  alt?: string;
  failed?: boolean;
}

export interface RegisterRowProps {
  href: string;
  name: React.ReactNode;
  condition?: Condition | string;
  image?: RegisterRowImage;
  facts?: DataStripPair[];
  loading?: boolean;
  className?: string;
  variant?: 'row' | 'card';
}

const ROW_BASE =
  'apple-card block bg-bg-surface border border-border-rule rounded-md p-4 ' +
  'no-underline text-fg-default hover:border-border-strong hover:-translate-y-1.5 ' +
  'active:scale-[0.98] active:translate-y-0 ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus';

function Thumb({
  image,
  size = 'thumb',
}: {
  image?: RegisterRowImage;
  size?: 'thumb' | 'full';
}) {
  if (image?.failed) {
    return (
      <div className="row__thumb overflow-hidden rounded-sm border border-border-rule">
        <ImagePlaceholder state="failed" size={size} />
      </div>
    );
  }
  if (image?.src) {
    return (
      <div className="row__thumb overflow-hidden rounded-sm border border-border-rule">
        <ImagePlaceholder src={image.src} alt={image.alt} size={size} />
      </div>
    );
  }
  return (
    <div className="row__thumb overflow-hidden rounded-sm border border-border-rule">
      <ImagePlaceholder size={size} />
    </div>
  );
}

export function RegisterRow({
  href,
  name,
  condition,
  image,
  facts = [],
  loading = false,
  className,
  variant = 'row',
}: RegisterRowProps) {
  if (loading) {
    if (variant === 'card') {
      return (
        <li>
          <div
            className={[ROW_BASE, 'h-full flex flex-col', className]
              .filter(Boolean)
              .join(' ')}
          >
            <LoadingSkeleton variant="image" size="thumb" />
            <div className="mt-4 flex flex-col gap-2 flex-1">
              <LoadingSkeleton variant="data-strip" count={1} />
            </div>
          </div>
        </li>
      );
    }
    return (
      <li>
        <div className={[ROW_BASE, className].filter(Boolean).join(' ')}>
          <div className="flex gap-4 items-start">
            <LoadingSkeleton variant="image" size="thumb" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <LoadingSkeleton variant="data-strip" count={1} />
            </div>
          </div>
        </div>
      </li>
    );
  }

  if (variant === 'card') {
    return (
      <li>
        <a
          href={href}
          className={[
            ROW_BASE,
            'h-full flex flex-col justify-between group',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div>
            <div className="overflow-hidden rounded-sm mb-3.5">
              <Thumb image={image} size="full" />
            </div>
            <div className="flex flex-wrap gap-2 items-baseline justify-between mb-2">
              <h3 className="m-0 text-item-name font-sans font-semibold tracking-tight [overflow-wrap:anywhere] break-words">
                {name}
              </h3>
              {condition !== undefined ? (
                <ConditionChip condition={condition} />
              ) : null}
            </div>
          </div>
          {facts.length > 0 ? (
            <div className="row__facts pt-2 border-t border-border-hairline mt-auto">
              <DataStrip pairs={facts} variant="embedded" />
            </div>
          ) : null}
        </a>
      </li>
    );
  }

  return (
    <li>
      <a
        href={href}
        className={[ROW_BASE, className].filter(Boolean).join(' ')}
      >
        <div className="flex gap-4 items-start">
          <Thumb image={image} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap gap-3 items-baseline justify-between">
              <h3 className="m-0 text-item-name [overflow-wrap:anywhere] break-words">
                {name}
              </h3>
              {condition !== undefined ? (
                <ConditionChip condition={condition} />
              ) : null}
            </div>
            {facts.length > 0 ? (
              <div className="row__facts">
                <DataStrip pairs={facts} variant="embedded" />
              </div>
            ) : null}
          </div>
        </div>
      </a>
    </li>
  );
}

export interface RegisterRowsProps {
  children: React.ReactNode;
  className?: string;
}

export function RegisterRows({ children, className }: RegisterRowsProps) {
  return (
    <ul
      className={['rows flex flex-col gap-3 list-none m-0 p-0', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </ul>
  );
}
