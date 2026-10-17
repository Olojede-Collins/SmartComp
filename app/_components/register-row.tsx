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
}

const ROW_BASE =
  'block bg-bg-surface border border-border-rule rounded-md p-4 ' +
  'no-underline text-fg-default hover:border-border-strong hover:-translate-y-1 ' +
  'active:scale-[0.99] active:translate-y-0 ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-border-focus';

function Thumb({ image }: { image?: RegisterRowImage }) {
  if (image?.failed) {
    return (
      <div className="row__thumb overflow-hidden rounded-sm border border-border-rule">
        <ImagePlaceholder state="failed" size="thumb" />
      </div>
    );
  }
  if (image?.src) {
    return (
      <div className="row__thumb overflow-hidden rounded-sm border border-border-rule">
        <ImagePlaceholder src={image.src} alt={image.alt} size="thumb" />
      </div>
    );
  }
  return (
    <div className="row__thumb overflow-hidden rounded-sm border border-border-rule">
      <ImagePlaceholder size="thumb" />
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
}: RegisterRowProps) {
  if (loading) {
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
