import * as React from 'react';
import { Icon } from './icon';

/**
 * C-010 Field (label + control + help + error).
 * One pattern for every form row. useId() so SSR/client match; children-as-function
 * receives { id, describedBy, invalid } so the control wires aria-describedby/aria-invalid.
 * Required marker is the word "(required)" in micro — not an asterisk, not CSS uppercase.
 */

export interface FieldRenderProps {
  id: string;
  /** Space-joined help+error ids (empty string when neither exists). */
  describedBy: string | undefined;
  invalid: boolean;
}

export interface FieldProps {
  label: string;
  /** Show the micro "(required)" marker. */
  required?: boolean;
  /** Help sentence under the control. */
  help?: string;
  /** Error message. When set, the error row renders with I-02 and role="alert", and invalid=true. */
  error?: string;
  children: (props: FieldRenderProps) => React.ReactNode;
  className?: string;
}

export function Field({
  label,
  required,
  help,
  error,
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
        <label htmlFor={id} className="text-base font-medium text-fg-default">
          {label}
        </label>
        {required ? (
          <span className="text-xs font-semibold tracking-caps text-fg-muted">
            (required)
          </span>
        ) : null}
      </div>

      {children({ id, describedBy, invalid })}

      {help ? (
        <p id={helpId} className="text-sm text-fg-muted m-0">
          {help}
        </p>
      ) : null}

      {invalid ? (
        <p
          id={errorId}
          role="alert"
          className="m-0 flex items-center gap-2 text-sm text-fg-status-faulty"
        >
          <Icon name="triangle-alert" size={16} className="shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
