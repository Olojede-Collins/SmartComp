import * as React from 'react';
import { FieldKey } from './field-key';
import { ConditionChip } from './condition-chip';
import { Condition } from './condition-enum';

export interface DataStripPair {
  key: string;
  value?: React.ReactNode;
  chip?: Condition | string;
  strong?: boolean;
  error?: string;
}

export interface DataStripProps {
  pairs: DataStripPair[];
  variant?: 'definition-list' | 'embedded';
  loading?: boolean;
  className?: string;
}

function PairValue({ pair }: { pair: DataStripPair }) {
  if (pair.error) {
    return (
      <span className="text-caption text-fg-status-faulty">{pair.error}</span>
    );
  }
  if (pair.chip !== undefined) {
    return <ConditionChip condition={pair.chip} />;
  }
  return (
    <span
      className={[
        'font-mono tabular-nums',
        pair.strong ? 'text-data-strong' : 'text-data',
      ].join(' ')}
    >
      {pair.value}
    </span>
  );
}

function SkeletonPair() {
  return (
    <>
      <span
        aria-hidden="true"
        className="block h-3 w-16 rounded-sm bg-bg-skeleton"
      />
      <span
        aria-hidden="true"
        className="block h-3 w-20 rounded-sm bg-bg-skeleton"
      />
    </>
  );
}

export function DataStrip({
  pairs,
  variant = 'definition-list',
  loading = false,
  className,
}: DataStripProps) {
  const embedded = variant === 'embedded';
  const band = embedded
    ? 'flex flex-wrap items-center gap-5'
    : 'flex flex-wrap gap-5 border-y border-border-rule py-4';
  const rootClass = ['strip', band, className].filter(Boolean).join(' ');

  const pairList = pairs.map((pair, index) => (
    <div key={index} className="flex min-w-0 flex-col gap-2">
      {loading ? (
        <SkeletonPair />
      ) : embedded ? (
        <>
          <FieldKey>{pair.key}</FieldKey>
          <PairValue pair={pair} />
        </>
      ) : (
        <>
          <dt className="m-0">
            <FieldKey>{pair.key}</FieldKey>
          </dt>
          <dd className="m-0">
            <PairValue pair={pair} />
          </dd>
        </>
      )}
    </div>
  ));

  if (loading || embedded) {
    return (
      <div className={rootClass} aria-busy={loading || undefined}>
        {pairList}
      </div>
    );
  }

  return <dl className={rootClass}>{pairList}</dl>;
}
