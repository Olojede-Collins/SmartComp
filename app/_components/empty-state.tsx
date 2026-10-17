import * as React from 'react';
import { Icon } from './icon';

export interface EmptyStateProps {
  heading: React.ReactNode;
  body: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  heading,
  body,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={['pt-7 pb-8 px-0 max-w-[var(--layout-measure)]', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="mb-4 text-fg-muted">
        <Icon name="empty-register" size={20} />
      </div>
      <h2 className="mb-3 text-h2">{heading}</h2>
      <p className="mb-6 text-body text-fg-muted">{body}</p>
      {action}
    </div>
  );
}
