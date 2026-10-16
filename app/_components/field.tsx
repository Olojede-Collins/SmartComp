import * as React from 'react';
import { Icon } from './icon';

export interface FieldRenderProps {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  disabled: boolean;
}

export interface FieldProps {
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  disabled?: boolean;
  children: (props: FieldRenderProps) => React.ReactNode;
  className?: string;
}

export function Field({
  label,
  required,
  help,
  error,
  disabled = false,
  children,
  className,
}: FieldProps) {
  const uid = React.useId();
  const id = `${uid}-control`;
  const helpId = `${uid}-help`;
  const errorId = `${uid}-error`;
  const invalid = Boolean(error);

  const describedParts = [
    help ? helpId : null,
    invalid ? errorId : null,
  ].filter(Boolean);
  const describedBy =
    describedParts.length > 0 ? describedParts.join(' ') : undefined;

  return (
    <div
      className={['field flex flex-col gap-2', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <label
          htmlFor={id}
          className={`text-base font-medium ${disabled ? 'text-fg-muted' : 'text-fg-default'}`}
        >
          {label}
        </label>
        {required ? (
          <span className="text-micro tracking-caps text-fg-muted">
            (required)
          </span>
        ) : null}
      </div>

      {children({ id, describedBy, invalid, disabled })}

      {help ? (
        <p id={helpId} className="text-caption text-fg-muted m-0">
          {help}
        </p>
      ) : null}

      {invalid ? (
        <p
          id={errorId}
          role="alert"
          className="m-0 flex items-center gap-2 text-caption text-fg-status-faulty"
        >
          <Icon name="triangle-alert" size={16} className="shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
