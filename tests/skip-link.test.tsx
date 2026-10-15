// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkipLink } from '../app/_components/skip-link';

describe('SkipLink', () => {
  it('renders the frozen copy and #main target', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('#main');
    expect(link.textContent).toBe('Skip to main content');
  });

  it('is absolutely positioned offscreen until focused', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link.className).toContain('absolute');
    expect(link.className).toContain('left-4');
    expect(link.className).toContain('-top-16'); // calc(space-4 * -4) = -64px
    expect(link.className).toContain('focus:top-4');
    expect(link.className).toContain('z-overlay');
  });

  it('carries the surface card treatment (bg-surface, border-strong, rounded-md, space-3/4 pad)', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: 'Skip to main content' });
    expect(link.className).toContain('bg-surface');
    expect(link.className).toContain('text-fg-default');
    expect(link.className).toContain('border');
    expect(link.className).toContain('border-border-strong');
    expect(link.className).toContain('rounded-md');
    expect(link.className).toContain('py-3');
    expect(link.className).toContain('px-4');
  });
});
