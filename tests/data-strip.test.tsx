// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataStrip } from '../app/_components/data-strip';

const pairs = [
  { key: 'RECORD', value: 'SC-001' },
  { key: 'QUANTITY', value: '1', strong: true },
  { key: 'UPDATED', value: '2026-10-09' },
];

describe('C-013 DataStrip', () => {
  it('renders a definition list of key-over-value pairs with the band rules', () => {
    const { container } = render(<DataStrip pairs={pairs} />);
    const dl = container.querySelector('dl')!;
    expect(dl).toBeTruthy();
    const classes = dl.className.split(/\s+/);
    expect(classes).toContain('border-y');
    expect(classes).toContain('border-border-rule');
    expect(classes).toContain('py-4');
    expect(classes).toContain('flex');
    expect(classes).toContain('flex-wrap');
    expect(classes).toContain('gap-5');
    expect(container.querySelectorAll('dt')).toHaveLength(3);
    expect(container.querySelectorAll('dd')).toHaveLength(3);
    expect(screen.getByText('RECORD').tagName).toBe('SPAN');
    expect(screen.getByText('SC-001')).toBeTruthy();
  });

  it('keys are muted micro catalogue captions; values are mono tabular data', () => {
    render(<DataStrip pairs={pairs} />);
    const key = screen.getByText('RECORD');
    expect(key.className).toContain('text-fg-muted');
    const value = screen.getByText('SC-001');
    expect(value.className).toContain('text-data');
    expect(value.className).toContain('font-mono');
    expect(value.className).toContain('tabular-nums');
  });

  it('emphasises only the strong pair with data-strong', () => {
    render(<DataStrip pairs={pairs} />);
    expect(screen.getByText('1').className).toContain('text-data-strong');
    expect(screen.getByText('SC-001').className).not.toContain(
      'text-data-strong',
    );
  });

  it('renders a chip value through C-011 for the CONDITION pair', () => {
    const { container } = render(
      <DataStrip pairs={[{ key: 'CONDITION', chip: 'Working' }]} />,
    );
    expect(container.querySelector('.chip')).toBeTruthy();
    expect(screen.getByText('Working')).toBeTruthy();
  });

  it('embedded variant drops the band rules and the dl (safe inside a row link)', () => {
    const { container } = render(
      <DataStrip pairs={pairs} variant="embedded" />,
    );
    expect(container.querySelector('dl')).toBeNull();
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toContain('border-y');
    expect(container.querySelectorAll('dt')).toHaveLength(0);
    expect(screen.getByText('RECORD')).toBeTruthy();
    expect(screen.getByText('SC-001')).toBeTruthy();
  });

  it('loading renders skeleton bars keyed to each pair (no values, no shimmer)', () => {
    const { container } = render(<DataStrip pairs={pairs} loading />);
    expect(screen.queryByText('SC-001')).toBeNull();
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-busy')).toBe('true');
    const bars = container.querySelectorAll('.bg-bg-skeleton');
    expect(bars.length).toBeGreaterThanOrEqual(6);
    expect(container.innerHTML).not.toMatch(
      /animate-|pulse|shimmer|transition/,
    );
  });

  it('error replaces only the failed value, keys stay', () => {
    render(
      <DataStrip
        pairs={[{ key: 'UPDATED', value: '2026-10-09', error: 'Unavailable' }]}
      />,
    );
    expect(screen.getByText('UPDATED')).toBeTruthy();
    const err = screen.getByText('Unavailable');
    expect(err.className).toContain('text-fg-status-faulty');
    expect(err.className).toContain('text-caption');
    expect(screen.queryByText('2026-10-09')).toBeNull();
  });

  it('never applies CSS uppercase', () => {
    const { container } = render(<DataStrip pairs={pairs} />);
    expect(container.innerHTML).not.toMatch(/uppercase/i);
  });
});
