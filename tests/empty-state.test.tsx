// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Link from 'next/link';
import { EmptyState } from '../app/_components/empty-state';

describe('C-018 EmptyState', () => {
  it('admin empty: heading, body, I-12 and the primary CTA', () => {
    const { container } = render(
      <EmptyState
        heading="No items yet."
        body="Add the first item to start the register."
        action={<Link href="/admin/items/new">Add item</Link>}
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    const classes = root.className.split(/\s+/);
    expect(classes).toContain('pt-7');
    expect(classes).toContain('pb-8');
    expect(classes).toContain('max-w-[var(--layout-measure)]');
    expect(
      screen.getByRole('heading', { level: 2, name: 'No items yet.' }),
    ).toBeTruthy();
    expect(
      screen.getByText('Add the first item to start the register.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add item' })).toBeTruthy();
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('viewBox')).toBe('0 0 20 20');
  });

  it('public empty: copy only, no admin CTA', () => {
    const { container } = render(
      <EmptyState
        heading="Nothing on the record yet."
        body="The register has no entries. Everything the lab team records will appear here."
      />,
    );
    expect(screen.getByText('Nothing on the record yet.')).toBeTruthy();
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  it('body copy is a muted paragraph', () => {
    render(<EmptyState heading="H" body="B" />);
    const p = screen.getByText('B');
    expect(p.tagName).toBe('P');
    expect(p.className).toContain('text-fg-muted');
  });

  it('icon is decorative and sits above the heading (mb-4 fg-muted)', () => {
    const { container } = render(<EmptyState heading="H" body="B" />);
    const iconWrap = container.querySelector('svg')!
      .parentElement as HTMLElement;
    expect(iconWrap.className).toContain('mb-4');
    expect(iconWrap.className).toContain('text-fg-muted');
  });

  it('never offers search/filter/no-results affordances', () => {
    const { container } = render(<EmptyState heading="H" body="B" />);
    expect(container.innerHTML).not.toMatch(/no[- ]?results|search|filter/i);
  });

  it('applies no uppercase transform', () => {
    const { container } = render(<EmptyState heading="H" body="B" />);
    expect(container.innerHTML).not.toMatch(/uppercase/i);
  });
});
