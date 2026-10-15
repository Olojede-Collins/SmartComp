// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../app/_components/button';

describe('C-005/006/007 Button', () => {
  it('renders a native button with the visible label as accessible name', () => {
    render(<Button>Save item</Button>);
    const btn = screen.getByRole('button', { name: 'Save item' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('primary (default) variant carries the primary class stack', () => {
    render(<Button>Save item</Button>);
    const btn = screen.getByRole('button', { name: 'Save item' });
    expect(btn.className).toContain('bg-action');
    expect(btn.className).toContain('text-fg-on-action');
    expect(btn.className).toContain('min-h-12'); // 48px
    expect(btn.className).toContain('px-5');     // space-5
    expect(btn.className).toContain('py-4');     // space-4
    expect(btn.className).toContain('rounded-md');
    expect(btn.className).toContain('border');
    expect(btn.className).toContain('font-semibold');
  });

  it('hover lift is transform-only and reduced-motion safe', () => {
    render(<Button>Save item</Button>);
    const btn = screen.getByRole('button', { name: 'Save item' });
    expect(btn.className).toContain('transition-transform');
    expect(btn.className).toContain('motion-reduce:transition-none');
    expect(btn.className).toContain('hover:-translate-y-px');
    expect(btn.className).toContain('hover:shadow-raised');
  });

  it('focus-visible uses the token-only ring (no glow)', () => {
    render(<Button>Save item</Button>);
    const btn = screen.getByRole('button', { name: 'Save item' });
    expect(btn.className).toContain('focus-visible:outline-3');
    expect(btn.className).toContain('focus-visible:outline-offset-2');
    expect(btn.className).toContain('focus-visible:outline-border-focus');
  });

  it('disabled uses the solid token pair, never opacity', () => {
    render(<Button disabled>Save item</Button>);
    const btn = screen.getByRole('button', { name: 'Save item' });
    expect(btn.hasAttribute('disabled')).toBe(true);
    expect(btn.className).toContain('bg-disabled');
    expect(btn.className).toContain('text-fg-disabled');
    expect(btn.className).toContain('border-disabled');
    expect(btn.className).toContain('shadow-none');
    expect(btn.className).toContain('cursor-not-allowed');
    expect(btn.className).not.toMatch(/opacity/i);
  });

  it('size="sm" is the compact 44px variant', () => {
    render(<Button size="sm">Edit</Button>);
    const btn = screen.getByRole('button', { name: 'Edit' });
    expect(btn.className).toContain('min-h-11'); // 44px
    expect(btn.className).toContain('px-3');
    expect(btn.className).toContain('py-2');
  });

  it('ghost variant is transparent with strong border and no lift', () => {
    render(<Button variant="ghost">Cancel</Button>);
    const btn = screen.getByRole('button', { name: 'Cancel' });
    expect(btn.className).toContain('bg-transparent');
    expect(btn.className).toContain('text-fg-default');
    expect(btn.className).toContain('border-strong');
    expect(btn.className).toContain('hover:bg-action-subtle');
    // Ghost is zero-lift at rest (no hover translate); base hover is cancelled by hover:translate-y-0.
    expect(btn.className).toContain('translate-y-0');
  });

  it('danger variant pairs bg-danger / fg-on-danger with faulty hover', () => {
    render(<Button variant="danger">Delete item</Button>);
    const btn = screen.getByRole('button', { name: 'Delete item' });
    expect(btn.className).toContain('bg-danger');
    expect(btn.className).toContain('text-fg-on-danger');
    expect(btn.className).toContain('hover:bg-accent-faulty-600');
  });

  it('pendingLabel swaps the label, sets aria-busy and disables', () => {
    render(<Button pendingLabel="Saving.">Save item</Button>);
    const btn = screen.getByRole('button', { name: 'Saving.' });
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.hasAttribute('disabled')).toBe(true);
    expect(screen.queryByText('Save item')).toBeNull();
  });

  it('without pendingLabel, no aria-busy at rest', () => {
    render(<Button>Save item</Button>);
    const btn = screen.getByRole('button', { name: 'Save item' });
    expect(btn.hasAttribute('aria-busy')).toBe(false);
  });

  it('spreads extra props (type, aria-label) onto the native button', () => {
    render(<Button type="submit" aria-label="Delete Monitors">Delete</Button>);
    const btn = screen.getByRole('button', { name: 'Delete Monitors' });
    expect(btn.getAttribute('type')).toBe('submit');
  });
});
