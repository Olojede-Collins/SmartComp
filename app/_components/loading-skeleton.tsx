import * as React from 'react';

export type LoadingSkeletonVariant =
  'card' | 'table-row' | 'data-strip' | 'image';

export interface LoadingSkeletonProps {
  variant?: LoadingSkeletonVariant;
  size?: 'full' | 'thumb';
  count?: number;
  className?: string;
  srOnly?: boolean;
}

function Bar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={['block rounded-sm bg-bg-skeleton', className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

export function LoadingSkeleton({
  variant = 'card',
  size = 'full',
  count = 1,
  className,
  srOnly,
}: LoadingSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);
  const showSrOnly = srOnly ?? (variant !== 'card' || count > 1);

  if (variant === 'table-row') {
    return (
      <>
        {items.map((i) => (
          <tr key={i} aria-busy="true">
            <td className="px-4 py-4">
              <span className="sr-only">Loading…</span>
              <Bar className="h-[18px] w-3/5" />
            </td>
            <td className="px-4 py-4">
              <Bar className="h-3 w-[70%]" />
            </td>
            <td className="px-4 py-4">
              <Bar className="h-3 w-[70%]" />
            </td>
            <td className="px-4 py-4">
              <Bar className="h-3 w-[70%]" />
            </td>
            <td className="px-4 py-4">
              <Bar className="h-3 w-[70%]" />
            </td>
            <td className="px-4 py-4" />
          </tr>
        ))}
      </>
    );
  }

  if (variant === 'data-strip') {
    return (
      <div
        aria-busy="true"
        className={['flex flex-wrap gap-5', className]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="sr-only">Loading…</span>
        {items.map((i) => (
          <div key={i} className="flex min-w-0 flex-col gap-2">
            <Bar className="h-3 w-16" />
            <Bar className="h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'image') {
    const geometry =
      size === 'thumb' ? 'w-[96px] h-[72px]' : 'aspect-[4/3] w-full';
    return (
      <div
        aria-hidden="true"
        className={['bg-bg-skeleton rounded-sm', geometry, className]
          .filter(Boolean)
          .join(' ')}
      />
    );
  }

  return (
    <div
      aria-busy="true"
      className={['flex flex-col gap-3', className].filter(Boolean).join(' ')}
    >
      {showSrOnly ? <span className="sr-only">Loading…</span> : null}
      {items.map((i) => (
        <div
          key={i}
          className="flex items-start gap-4 rounded-md border border-border-rule bg-bg-surface p-4"
        >
          <Bar className="h-[72px] w-[96px] flex-none" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Bar className="h-[18px] w-2/5" />
            <Bar className="h-3 w-[30%]" />
          </div>
        </div>
      ))}
    </div>
  );
}
