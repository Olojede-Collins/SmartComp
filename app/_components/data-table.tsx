import * as React from 'react';
import { ConditionChip } from './condition-chip';
import { Condition } from './condition-enum';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { LoadingSkeleton } from './loading-skeleton';

export interface DataTableRow {
  id: string;
  name: React.ReactNode;
  record: string;
  quantity: React.ReactNode;
  condition: Condition | string;
  updated: string;
}

export interface DataTableProps {
  rows: DataTableRow[];
  state?: 'default' | 'loading' | 'empty';
  caption?: string;
  pendingRowId?: string;
  emptyAction?: React.ReactNode;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

const MAX_ROWS = 15;

const CELL =
  'px-4 py-4 border-b border-border-rule align-middle font-normal text-left ' +
  'max-md:flex max-md:flex-wrap max-md:gap-2 max-md:items-baseline max-md:justify-between ' +
  'max-md:border-0 max-md:px-4 max-md:py-1 ' +
  'max-md:before:content-[attr(data-label)] max-md:before:text-micro ' +
  'max-md:before:font-medium max-md:before:tracking-caps max-md:before:text-fg-muted';

const HEAD =
  'text-left text-micro font-medium tracking-caps text-fg-muted whitespace-nowrap ' +
  'px-4 py-3 border-b border-border-rule bg-bg-surface-sunken';

const FRAME =
  'apple-card border border-border-rule rounded-md overflow-hidden bg-bg-surface';

export function DataTable({
  rows,
  state = 'default',
  caption,
  pendingRowId,
  emptyAction,
  onEdit,
  onDelete,
  className,
}: DataTableProps) {
  if (state === 'empty' || (state === 'default' && rows.length === 0)) {
    return (
      <EmptyState
        heading="No items yet."
        body="Add the first item to start the register."
        action={emptyAction}
        className={className}
      />
    );
  }

  const visible = rows.slice(0, MAX_ROWS);
  const loading = state === 'loading';

  return (
    <div className={[FRAME, className].filter(Boolean).join(' ')}>
      <table className="w-full border-collapse">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="max-md:sr-only">
          <tr>
            <th scope="col" className={[HEAD, 'col-name'].join(' ')}>
              ITEM
            </th>
            <th scope="col" className={HEAD}>
              RECORD
            </th>
            <th scope="col" className={HEAD}>
              QUANTITY
            </th>
            <th scope="col" className={HEAD}>
              CONDITION
            </th>
            <th
              scope="col"
              className={[HEAD, 'col-updated', 'md:max-lg:hidden'].join(' ')}
            >
              UPDATED
            </th>
            <th scope="col" className={HEAD}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody
          aria-busy={loading ? 'true' : undefined}
          className="[&>tr:last-child>*]:border-b-0"
        >
          {loading ? (
            <LoadingSkeleton variant="table-row" count={4} />
          ) : (
            visible.map((row) => {
              const pending = pendingRowId === row.id;
              return (
                <tr
                  key={row.id}
                  className="hover:bg-bg-row-hover max-md:block max-md:border-b max-md:border-border-rule max-md:py-3 max-md:hover:bg-transparent"
                >
                  <th
                    scope="row"
                    data-label="ITEM"
                    className={[
                      CELL,
                      'col-name text-item-name [overflow-wrap:anywhere]',
                      'max-md:block max-md:min-w-0 max-md:pb-2',
                      'max-md:before:block max-md:before:mb-1',
                    ].join(' ')}
                  >
                    {row.name}
                  </th>
                  <td data-label="RECORD" className={CELL}>
                    <span className="font-mono text-data tabular-nums">
                      {row.record}
                    </span>
                  </td>
                  <td
                    data-label="QUANTITY"
                    className={[CELL, 'col-num tabular-nums'].join(' ')}
                  >
                    <span className="font-mono text-data-strong tabular-nums">
                      {row.quantity}
                    </span>
                  </td>
                  <td data-label="CONDITION" className={CELL}>
                    <ConditionChip condition={row.condition} />
                  </td>
                  <td
                    data-label="UPDATED"
                    className={[CELL, 'col-updated', 'md:max-lg:hidden'].join(
                      ' ',
                    )}
                  >
                    <span className="font-mono text-data tabular-nums">
                      {row.updated}
                    </span>
                  </td>
                  <td
                    className={[CELL, 'col-actions max-md:before:hidden'].join(
                      ' ',
                    )}
                  >
                    <div className="flex justify-end gap-2 max-md:justify-start max-md:mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        aria-label={`Edit ${row.name}`}
                        onClick={() => onEdit?.(row.id)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={pending}
                        aria-label={`Delete ${row.name}`}
                        onClick={() => onDelete?.(row.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
