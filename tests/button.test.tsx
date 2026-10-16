// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { Button } from '../app/_components/button';
import { Icon } from '../app/_components/icon';

const tokenSource = fs.readFileSync(
  path.resolve(process.cwd(), 'app', 'tokens.css'),
  'utf8',
);

const buttonSource = fs.readFileSync(
  path.resolve(process.cwd(), 'app', '_components', 'button.tsx'),
  'utf8',
);

const tokenValues: Record<string, string> = {};
for (const match of tokenSource.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
  tokenValues[match[1]] = match[2].trim().replace(/\s+/g, ' ');
}

const tokenHex = (name: string): string => {
  let value: string | undefined = tokenValues[name];
  for (let hop = 0; hop < 5 && value && value.startsWith('var('); hop += 1) {
    const ref: RegExpMatchArray | null = value.match(/^var\((--[\w-]+)\)$/);
    if (!ref) break;
    value = tokenValues[ref[1]];
  }
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`unresolved token ${name}: ${value}`);
  }
  return value;
};

const relativeLuminance = (hex: string): number => {
  const channels = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const linear = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
};

const contrastRatio = (fg: string, bg: string): number => {
  const [hi, lo] = [relativeLuminance(fg), relativeLuminance(bg)].sort(
    (a, b) => b - a,
  );
  return (hi + 0.05) / (lo + 0.05);
};

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
    expect(btn.className).toContain('bg-bg-action');
    expect(btn.className).toContain('text-fg-on-action');
    expect(btn.className).toContain('border-bg-action');
    expect(btn.className).toContain('shadow-card');
    expect(btn.className).toContain('cursor-pointer');
    expect(btn.className).toContain('min-h-12');
    expect(btn.className).toContain('min-w-11');
    expect(btn.className).toContain('px-5');
    expect(btn.className).toContain('py-4');
    expect(btn.className).toContain('rounded-md');
    expect(btn.className).toContain('border');
    expect(btn.className).toContain('font-semibold');
  });

  it('hover lift is transform-only, token-timed and reduced-motion safe', () => {
    render(<Button>Save item</Button>);
    const btn = screen.getByRole('button', { name: 'Save item' });
    expect(btn.className).toContain('transition-transform');
    expect(btn.className).toContain('duration-fast');
    expect(btn.className).not.toContain('duration-[');
    expect(btn.className).toContain('motion-reduce:transition-none');
    expect(btn.className).toContain('motion-reduce:hover:translate-y-0');
    expect(btn.className).toContain('hover:-translate-y-px');
    expect(btn.className).toContain('hover:bg-bg-action-hover');
    expect(btn.className).toContain('hover:border-bg-action-hover');
    expect(btn.className).toContain('hover:shadow-raised');
    expect(btn.className).toContain('active:translate-y-0');
    expect(buttonSource).toContain('motion-reduce:hover:translate-y-0');
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
    expect(btn.className).toContain('disabled:bg-bg-disabled');
    expect(btn.className).toContain('disabled:text-fg-disabled');
    expect(btn.className).toContain('disabled:border-border-disabled');
    expect(btn.className).toContain('shadow-none');
    expect(btn.className).toContain('cursor-not-allowed');
    expect(btn.className).not.toMatch(/opacity/i);
  });

  it('size="sm" is the compact 44px variant', () => {
    render(<Button size="sm">Edit</Button>);
    const btn = screen.getByRole('button', { name: 'Edit' });
    expect(btn.className).toContain('min-h-11');
    expect(btn.className).toContain('min-w-11');
    expect(btn.className).toContain('px-3');
    expect(btn.className).toContain('py-2');
    expect(btn.className).toContain('text-body-small');
    expect(btn.className).not.toMatch(/(^|\s)text-sm(\s|$)/);
    expect(btn.className).toContain('font-semibold');
    expect(buttonSource).toContain('text-body-small');
  });

  it('ghost variant is transparent with strong border, card shadow and no lift', () => {
    render(<Button variant="ghost">Cancel</Button>);
    const btn = screen.getByRole('button', { name: 'Cancel' });
    expect(btn.className).toContain('bg-transparent');
    expect(btn.className).toContain('text-fg-default');
    expect(btn.className).toContain('border-border-strong');
    expect(btn.className).toContain('hover:bg-bg-action-subtle');
    expect(btn.className).toContain('hover:text-fg-link-hover');
    expect(btn.className).toContain('shadow-card');
    expect(btn.className).toContain('hover:shadow-raised');
    expect(btn.className).toContain('active:shadow-card');
    expect(btn.className).toContain('hover:translate-y-0');
    expect(btn.className).not.toContain('hover:-translate-y-px');
    expect(btn.className).not.toMatch(/(^|\s)shadow-none(\s|$)/);
  });

  it('danger variant pairs bg-danger / fg-on-danger with faulty hover', () => {
    render(<Button variant="danger">Delete item</Button>);
    const btn = screen.getByRole('button', { name: 'Delete item' });
    expect(btn.className).toContain('bg-bg-danger');
    expect(btn.className).toContain('text-fg-on-danger');
    expect(btn.className).toContain('border-bg-danger');
    expect(btn.className).toContain('shadow-card');
    expect(btn.className).toContain('hover:bg-accent-faulty-600');
    expect(btn.className).toContain('hover:border-accent-faulty-600');
    expect(btn.className).toContain('hover:-translate-y-px');
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
    render(
      <Button type="submit" aria-label="Delete Monitors">
        Delete
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Delete Monitors' });
    expect(btn.getAttribute('type')).toBe('submit');
  });

  it('embeds an icon (I-05 plus) inside the native button', () => {
    render(
      <Button>
        <Icon name="plus" />
        Add item
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Add item' });
    expect(btn.tagName).toBe('BUTTON');
    const svg = btn.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 20 20');
  });

  it('button contrast pairs match contrast-report.md Record B (live tokens.css)', () => {
    expect(
      contrastRatio(
        tokenHex('--color-fg-on-action'),
        tokenHex('--color-bg-action'),
      ),
    ).toBeCloseTo(5.85, 1);
    expect(
      contrastRatio(
        tokenHex('--color-fg-on-action'),
        tokenHex('--color-bg-action-hover'),
      ),
    ).toBeCloseTo(7.24, 1);
    expect(
      contrastRatio(
        tokenHex('--color-fg-on-danger'),
        tokenHex('--color-bg-danger'),
      ),
    ).toBeCloseTo(5.96, 1);
    expect(
      contrastRatio(
        tokenHex('--color-fg-disabled'),
        tokenHex('--color-bg-disabled'),
      ),
    ).toBeCloseTo(6.5, 1);
    expect(
      contrastRatio(
        tokenHex('--color-border-strong'),
        tokenHex('--color-bg-page'),
      ),
    ).toBeCloseTo(3.54, 1);
  });
});
