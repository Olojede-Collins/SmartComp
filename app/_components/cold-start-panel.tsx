'use client';

import * as React from 'react';
import { Banner } from './banner';
import { FieldKey } from './field-key';

export type ColdStartState = 'waiting' | 'ready' | 'error';

const WAITING_HEADING = 'Building the register.';
const WAITING_BODY =
  'The admin area is starting up for the first time. This usually takes about a minute. The record will appear here when it is ready.';

const ERROR_HEADING = 'The register took too long to start.';
const ERROR_BODY =
  'The first run did not finish. Try again in a moment, and tell the lab team if it keeps happening.';
const ERROR_CODE = 'cold-start-timeout';

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export interface ColdStartPanelProps {
  state?: ColdStartState;
  className?: string;
}

export function ColdStartPanel({
  state = 'waiting',
  className,
}: ColdStartPanelProps) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (state !== 'waiting') return undefined;
    const tick = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(tick);
  }, [state]);

  if (state === 'ready') return null;

  if (state === 'error') {
    return (
      <Banner
        tone="error"
        heading={ERROR_HEADING}
        code={ERROR_CODE}
        className={className}
      >
        {ERROR_BODY}
      </Banner>
    );
  }

  return (
    <Banner
      live
      heading={WAITING_HEADING}
      className={className}
      elapsed={
        <>
          <FieldKey>ELAPSED</FieldKey>
          <span className="text-data-strong tabular-nums">
            {formatElapsed(elapsed)}
          </span>
        </>
      }
    >
      {WAITING_BODY}
    </Banner>
  );
}
