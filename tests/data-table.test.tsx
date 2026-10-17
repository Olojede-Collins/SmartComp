// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DataTable, DataTableRow } from '../app/_components/data-table';

const rows: DataTableRow[] = [
  {
    id: 'SC-001',
    name: 'HDMI splitter and converter ',
    record: 'SC-001',
    quantity: '1',
    condition: 'Working',
    updated: '2026-10-09',
  },
  {
    id: 'SC-002',
    name: 'Monitors',
    record: 'SC-002',
    quantity: '50',
    condition: 'Faulty',
    updated: '2026-10-09',
  },
];

describe('C-022 DataTable', () => {
  it('renders real table semantics with the framed surface', () => {
    const { container } = render(<DataTable rows={rows} />);
    const frame = container.firstElementChild as HTMLElement;
    const classes = frame.className.split(/\s+/);
    expect(classes).toContain('border');
    expect(classes).toContain('border-border-rule');
    expect(classes).toContain('rounded-md');
    expect(classes).toContain('overflow-hidden');
    expect(classes).toContain('bg-bg-surface');
    expect(classes).not.toContain('shadow-card');
    expect(container.querySelector('table')).toBeTruthy();
    const colHeaders = container.querySelectorAll('thead th[scope="col"]');
    expect(colHeaders).toHaveLength(6);
    expect(colHeaders[0].textContent).toBe('ITEM');
    expect(container.querySelectorAll('tbody th[scope="row"]')).toHaveLength(2);
  });

  it('header cells use the sunken micro band', () => {
    const { container } = render(<DataTable rows={rows} />);
    const th = container.querySelector('thead th') as HTMLElement;
    const classes = th.className.split(/\s+/);
    expect(classes).toContain('text-micro');
    expect(classes).toContain('text-fg-muted');
    expect(classes).toContain('bg-bg-surface-sunken');
    expect(classes).toContain('px-4');
    expect(classes).toContain('py-3');
    expect(classes).toContain('border-b');
    expect(classes).toContain('border-border-rule');
    expect(th.className).not.toMatch(/uppercase/i);
  });

  it('body cells carry padding + row rule and hover tint', () => {
    const { container } = render(<DataTable rows={rows} />);
    const bodyRow = container.querySelector('tbody tr') as HTMLElement;
    expect(bodyRow.className).toContain('hover:bg-bg-row-hover');
    const td = container.querySelector('tbody td') as HTMLElement;
    const classes = td.className.split(/\s+/);
    expect(classes).toContain('px-4');
    expect(classes).toContain('py-4');
    expect(classes).toContain('border-b');
    expect(classes).toContain('border-border-rule');
  });

  it('names the item verbatim in a serif row header with the cascade columns', () => {
    const { container } = render(<DataTable rows={rows} />);
    const first = container.querySelectorAll('tbody tr')[0];
    expect(
      within(first as HTMLElement).getByText(/HDMI splitter and converter/),
    ).toBeTruthy();
    const nameCell = first.querySelector('th[scope="row"]') as HTMLElement;
    expect(nameCell.className).toContain('text-item-name');
    expect(
      within(first as HTMLElement).getByText('SC-001').className,
    ).toContain('text-data');
    expect(within(first as HTMLElement).getByText('1').className).toContain(
      'text-data-strong',
    );
    expect(first.querySelector('.chip')).toBeTruthy();
  });

  it('qty column uses tabular-nums', () => {
    const { container } = render(<DataTable rows={rows} />);
    const numCell = container.querySelector('td.col-num') as HTMLElement;
    expect(numCell).toBeTruthy();
    expect(numCell.className).toContain('tabular-nums');
  });

  it('row actions are Edit (ghost) + Delete (danger) with per-row accessible names', () => {
    render(<DataTable rows={rows} />);
    const edit = screen.getByRole('button', { name: 'Edit Monitors' });
    const del = screen.getByRole('button', { name: 'Delete Monitors' });
    expect(edit.className).toContain('bg-transparent');
    expect(edit.className).toContain('border-border-strong');
    expect(edit.className).toContain('text-fg-default');
    expect(edit.className).toContain('text-body-small');
    expect(del.className).toContain('bg-bg-danger');
    expect(del.className).toContain('text-fg-on-danger');
    expect(del.className).toContain('text-body-small');
  });

  it('row actions invoke their handlers with the row id', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<DataTable rows={rows} onEdit={onEdit} onDelete={onDelete} />);
    screen.getByRole('button', { name: 'Edit Monitors' }).click();
    screen.getByRole('button', { name: 'Delete Monitors' }).click();
    expect(onEdit).toHaveBeenCalledWith('SC-002');
    expect(onDelete).toHaveBeenCalledWith('SC-002');
  });

  it('every data cell carries a data-label for the stacked layout', () => {
    const { container } = render(<DataTable rows={rows} />);
    const first = container.querySelectorAll('tbody tr')[0];
    const labelled = first.querySelectorAll('td[data-label]');
    expect(labelled).toHaveLength(4);
    expect(
      first.querySelector('td.col-actions')!.hasAttribute('data-label'),
    ).toBe(false);
  });

  it('focus-visible on row actions uses the global outline triple', () => {
    render(<DataTable rows={rows} />);
    const edit = screen.getByRole('button', { name: 'Edit Monitors' });
    expect(edit.className).toContain('focus-visible:outline-3');
    expect(edit.className).toContain('focus-visible:outline-offset-2');
    expect(edit.className).toContain('focus-visible:outline-border-focus');
  });

  it('empty state replaces the frame with C-018', () => {
    const { container } = render(<DataTable rows={[]} />);
    expect(container.querySelector('table')).toBeNull();
    expect(screen.getByText('No items yet.')).toBeTruthy();
    expect(
      screen.getByText('Add the first item to start the register.'),
    ).toBeTruthy();
  });

  it('loading renders skeleton rows inside the frame with no motion', () => {
    const { container } = render(<DataTable rows={[]} state="loading" />);
    expect(container.querySelector('table')).toBeTruthy();
    expect(
      container.querySelectorAll('.bg-bg-skeleton').length,
    ).toBeGreaterThan(0);
    expect(container.querySelector('tbody')!.getAttribute('aria-busy')).toBe(
      'true',
    );
    expect(container.innerHTML).not.toMatch(/animate-|pulse|shimmer/);
  });

  it('pendingRowId disables only that row’s actions (solid disabled pair)', () => {
    render(<DataTable rows={rows} pendingRowId="SC-002" />);
    const edit = screen.getByRole('button', {
      name: 'Edit Monitors',
    }) as HTMLButtonElement;
    const deleteBtn = screen.getByRole('button', {
      name: 'Delete Monitors',
    }) as HTMLButtonElement;
    expect(edit.disabled).toBe(true);
    expect(deleteBtn.disabled).toBe(true);
    const other = screen.getByRole('button', {
      name: /Edit HDMI splitter and converter/,
    }) as HTMLButtonElement;
    expect(other.disabled).toBe(false);
  });

  it('caps the body at 15 rows (I1) with no pager surface', () => {
    const many: DataTableRow[] = Array.from({ length: 20 }, (_, i) => ({
      id: `SC-${i}`,
      name: `Item ${i}`,
      record: `SC-${i}`,
      quantity: '1',
      condition: 'Working',
      updated: '2026-10-09',
    }));
    const { container } = render(<DataTable rows={many} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(15);
    expect(container.querySelector('nav')).toBeNull();
    expect(container.innerHTML).not.toMatch(/pagination|page \d/i);
  });

  it('ships no search / filter / sort / column-picker UI', () => {
    const { container } = render(<DataTable rows={rows} />);
    expect(
      container.querySelectorAll('input, select, [role="searchbox"]'),
    ).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/sort|filter|search/i);
  });

  it('offers an sr-only caption when provided; omits it otherwise', () => {
    const { container, rerender } = render(
      <DataTable rows={rows} caption="The inventory." />,
    );
    const caption = container.querySelector('caption')!;
    expect(caption.textContent).toBe('The inventory.');
    rerender(<DataTable rows={rows} />);
    expect(container.querySelector('caption')).toBeNull();
  });
});
