// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RailNavLink } from '../app/_components/rail-nav-link';

describe('C-003 RailNavLink', () => {
  it('renders an anchor with body-small muted text and reserved 3px underline space', () => {
    const { container } = render(
      <RailNavLink href="/items">Items</RailNavLink>,
    );
    const link = screen.getByRole('link', { name: 'Items' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/items');
    expect(link.className).toContain('text-body-small');
    expect(link.className).toContain('text-fg-on-rail-muted');
    expect(link.className).toContain('border-b-3');
    expect(link.className).toContain('border-transparent');
    expect(link.className).toContain('min-h-11');
    expect(link.className).toContain('px-1');
    expect(link.className).toContain('no-underline');
    expect(link.className).not.toMatch(/rounded/);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('active page gets aria-current + full-strength colour + bg-rail-active underline', () => {
    render(
      <RailNavLink href="/" current>
        Home
      </RailNavLink>,
    );
    const link = screen.getByRole('link', { name: 'Home' });
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.className).toContain('text-fg-on-rail');
    expect(link.className).toContain(
      'aria-[current=page]:border-bg-rail-active',
    );
    expect(link.className).toContain('aria-[current=page]:text-fg-on-rail');
  });

  it('inactive has no aria-current and keeps the transparent border', () => {
    render(<RailNavLink href="/privacy">Privacy</RailNavLink>);
    const link = screen.getByRole('link', { name: 'Privacy' });
    expect(link.getAttribute('aria-current')).toBeNull();
  });

  it('hover is instant â€” no transition class', () => {
    render(<RailNavLink href="/x">X</RailNavLink>);
    const link = screen.getByRole('link', { name: 'X' });
    expect(link.className).not.toMatch(/transition/);
  });

  it('focus-visible uses border-focus-on-rail (never the default focus token)', () => {
    render(<RailNavLink href="/y">Y</RailNavLink>);
    const link = screen.getByRole('link', { name: 'Y' });
    expect(link.className).toContain(
      'focus-visible:outline-border-focus-on-rail',
    );
    expect(link.className).toContain('focus-visible:outline-3');
    expect(link.className).not.toMatch(
      /focus-visible:outline-border-focus(?!\-on\-rail)/,
    );
    expect(link.className).toContain('focus-visible:outline-offset-2');
  });

  it('action variant is identical visual treatment (same classes)', () => {
    const { rerender } = render(
      <RailNavLink href="/admin">Admins</RailNavLink>,
    );
    const link = screen.getByRole('link', { name: 'Admins' });
    const base = link.className;
    rerender(
      <RailNavLink href="/admin" variant="action">
        Sign out
      </RailNavLink>,
    );
    const link2 = screen.getByRole('link', { name: 'Sign out' });
    expect(link2.className).toBe(base);
  });
});
