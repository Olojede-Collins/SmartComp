// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LoadingSkeleton } from '../app/_components/loading-skeleton';

describe('C-019 LoadingSkeleton', () => {
  it('card variant: busy container, 96x72 thumb + title/line bars, no motion', () => {
    const { container } = render(<LoadingSkeleton variant="card" count={2} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('[class*="w-[96px]"]')).toBeTruthy();
    expect(
      container.querySelectorAll('.bg-bg-skeleton').length,
    ).toBeGreaterThanOrEqual(6);
    expect(container.innerHTML).not.toMatch(
      /animate-|pulse|shimmer|transition/,
    );
  });

  it('table-row variant: emits table rows of cell bars', () => {
    const { container } = render(
      <table>
        <tbody>
          <LoadingSkeleton variant="table-row" count={2} />
        </tbody>
      </table>,
    );
    expect(container.querySelectorAll('tr')).toHaveLength(2);
    expect(
      container.querySelectorAll('td .bg-bg-skeleton').length,
    ).toBeGreaterThanOrEqual(6);
    expect(container.innerHTML).not.toMatch(/animate-|pulse|shimmer/);
  });

  it('data-strip variant: one key bar + one value bar per pair', () => {
    const { container } = render(
      <LoadingSkeleton variant="data-strip" count={3} />,
    );
    expect(container.querySelectorAll('.bg-bg-skeleton')).toHaveLength(6);
  });

  it('image variant: 4:3 skeleton ground', () => {
    const { container } = render(<LoadingSkeleton variant="image" count={1} />);
    const ground = container.querySelector('[class*="aspect-[4/3]"]')!;
    expect(ground.className).toContain('bg-bg-skeleton');
  });

  it('image variant thumb: 96x72 skeleton ground', () => {
    const { container } = render(
      <LoadingSkeleton variant="image" size="thumb" count={1} />,
    );
    const ground = container.querySelector(
      '[class*="w-[96px]"]',
    ) as HTMLElement;
    expect(ground.className).toContain('h-[72px]');
    expect(ground.className).toContain('bg-bg-skeleton');
  });

  it('is never contrast-bearing text and never a spinner', () => {
    const { container } = render(<LoadingSkeleton variant="card" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toBe('');
  });
});
