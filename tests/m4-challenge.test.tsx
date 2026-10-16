// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConditionChip } from '../app/_components/condition-chip';
import { RailNavLink } from '../app/_components/rail-nav-link';
import { SkipLink } from '../app/_components/skip-link';

function chipClasses(condition: unknown) {
  const { container } = render(
    <ConditionChip condition={condition as never} />,
  );
  const chip = container.querySelector('.chip')!;
  return { chip, container };
}

describe('M4-CHALLENGE ConditionChip (C-011)', () => {
  const PROTOTYPE_KEYS = [
    'toString',
    'constructor',
    'valueOf',
    'hasOwnProperty',
    '__proto__',
  ];

  it('C1: prototype-key condition renders neutral chip with raw word', () => {
    for (const key of PROTOTYPE_KEYS) {
      const { chip } = chipClasses(key);
      expect(chip.className, `key=${key}`).toContain('bg-bg-surface');
      expect(chip.className, `key=${key}`).toContain('border-border-rule');
      expect(chip.className, `key=${key}`).toContain('text-fg-default');
    }
  });

  it('C1b: prototype-key condition renders NO icon (neutral chip has none)', () => {
    for (const key of PROTOTYPE_KEYS) {
      const { container } = chipClasses(key);
      expect(container.querySelector('svg'), `key=${key}`).toBeNull();
    }
  });

  it('C2: case-variant strings fall to neutral (no colour guess)', () => {
    for (const s of ['working', 'WORKING', 'WoRkInG', 'faulty', 'FAULTY']) {
      const { chip } = chipClasses(s);
      expect(chip.className, `s=${s}`).toContain('bg-bg-surface');
      expect(chip.className, `s=${s}`).not.toMatch(
        /bg-bg-status-(working|faulty|maintenance|decommissioned)/,
      );
    }
  });

  it('C3: empty string falls to neutral, no crash', () => {
    const { chip } = chipClasses('');
    expect(chip.className).toContain('bg-bg-surface');
    expect(chip.textContent).toBe('');
  });

  it('C4: whitespace-only string falls to neutral, whitespace preserved as raw word', () => {
    const { chip } = chipClasses('   ');
    expect(chip.className).toContain('bg-bg-surface');
    expect(chip.textContent).toBe('   ');
  });

  it('C5: unicode/emoji string falls to neutral and preserves the raw word', () => {
    const { chip } = chipClasses('\uD83D\uDD27 Needs repair \u2705');
    expect(chip.className).toContain('bg-bg-surface');
    expect(chip.textContent).toBe('\uD83D\uDD27 Needs repair \u2705');
  });

  it('C6: null/undefined do not crash and fall to neutral', () => {
    for (const v of [null, undefined]) {
      const { chip } = chipClasses(v);
      expect(chip.className, `v=${String(v)}`).toContain('bg-bg-surface');
    }
  });

  it('C7: markup-bearing string is inert text, never injected as elements', () => {
    const payload = '<img src=x onerror="window.__x=1">';
    const { container, chip } = chipClasses(payload);
    expect(container.querySelector('img')).toBeNull();
    expect(chip.textContent).toBe(payload);
  });

  it('C8: icon + word + colour redundancy holds for all four enum values', () => {
    const cases: Array<[string, string, string]> = [
      ['Working', 'bg-bg-status-working', 'text-fg-status-working'],
      ['Faulty', 'bg-bg-status-faulty', 'text-fg-status-faulty'],
      [
        'Under Maintenance',
        'bg-bg-status-maintenance',
        'text-fg-status-maintenance',
      ],
      [
        'Decommissioned',
        'bg-bg-status-decommissioned',
        'text-fg-status-decommissioned',
      ],
    ];
    for (const [word, bg, fg] of cases) {
      const { container, chip } = chipClasses(word);
      expect(container.querySelector('svg'), `icon ${word}`).toBeTruthy();
      expect(chip.textContent, `word ${word}`).toBe(word);
      expect(chip.className, `bg ${word}`).toContain(bg);
      expect(chip.className, `fg ${word}`).toContain(fg);
    }
  });
});

describe('M4-CHALLENGE RailNavLink (C-003)', () => {
  it('R1: aria-current present only when active', () => {
    const { rerender } = render(<RailNavLink href="/">Home</RailNavLink>);
    expect(screen.getByRole('link').getAttribute('aria-current')).toBeNull();
    rerender(
      <RailNavLink href="/" current>
        Home
      </RailNavLink>,
    );
    expect(screen.getByRole('link').getAttribute('aria-current')).toBe('page');
  });

  it('R2: focus ring uses border-focus-on-rail, never bare border-focus', () => {
    render(<RailNavLink href="/x">X</RailNavLink>);
    const c = screen.getByRole('link').className;
    expect(c).toContain('focus-visible:outline-border-focus-on-rail');
    expect(c).not.toMatch(/outline-border-focus(?!-on-rail)/);
  });

  it('R3: hover is instant - no transition/animation/delay utility', () => {
    render(<RailNavLink href="/x">X</RailNavLink>);
    const c = screen.getByRole('link').className;
    expect(c).not.toMatch(/(^|\s)(transition|duration-|ease-|delay-|animate-)/);
  });

  it('R4: no press transform on :active', () => {
    render(<RailNavLink href="/x">X</RailNavLink>);
    const c = screen.getByRole('link').className;
    expect(c).not.toMatch(/(^|\s)active:/);
    expect(c).not.toMatch(/transform|scale-|translate-|opacity-/);
  });

  it('R5: variant action is identical treatment to link', () => {
    const { rerender } = render(<RailNavLink href="/a">A</RailNavLink>);
    const link = screen.getByRole('link').className;
    rerender(
      <RailNavLink href="/a" variant="action">
        A
      </RailNavLink>,
    );
    expect(screen.getByRole('link').className).toBe(link);
  });

  it('R6: variant does not leak onto the anchor as an attribute', () => {
    render(
      <RailNavLink href="/a" variant="action">
        A
      </RailNavLink>,
    );
    expect(screen.getByRole('link').getAttribute('variant')).toBeNull();
  });
});

describe('M4-CHALLENGE SkipLink', () => {
  it('S1: href defaults to #main, override respected', () => {
    const { rerender } = render(<SkipLink />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('#main');
    rerender(<SkipLink href="#content">Skip to main content</SkipLink>);
    expect(screen.getByRole('link').getAttribute('href')).toBe('#content');
  });

  it('S2: offscreen at rest and revealed by :focus (not :focus-visible)', () => {
    render(<SkipLink />);
    const c = screen.getByRole('link').className;
    expect(c).toContain('-top-16');
    expect(c).toContain('focus:top-4');
    expect(c).not.toContain('focus-visible:top-4');
    expect(c.split(/\s+/).includes('top-4')).toBe(false);
  });

  it('S3: copy is verbatim', () => {
    render(<SkipLink />);
    expect(screen.getByRole('link').textContent).toBe('Skip to main content');
  });
});

describe('M4-CHALLENGE test-quality vacuity', () => {
  it('Q1: SkipLink `toContain("border")` is satisfiable without the bare border utility', () => {
    const wrong =
      'border-border-strong focus-visible:outline-border-focus-on-rail';
    expect(wrong).toContain('border');
    expect(wrong.split(/\s+/).includes('border')).toBe(false);
  });

  it('Q2: chip status token toContain() is satisfiable by a longer wrong token', () => {
    const wrong = 'bg-bg-status-working-EXTRA';
    expect(wrong).toContain('bg-bg-status-working');
  });

  it('Q3: numeric-suffix utilities let a wrong magnitude green the existing chip assertions', () => {
    const { container } = render(<ConditionChip condition="Working" />);
    const real = container.querySelector('.chip')!.className;
    const wrong = real
      .replace('min-h-6', 'min-h-64')
      .replace('gap-2', 'gap-24')
      .replace('px-3', 'px-32');
    expect(wrong).not.toBe(real);
    expect(wrong).toContain('min-h-6');
    expect(wrong).toContain('gap-2');
    expect(wrong).toContain('px-3');
  });

  it('Q4: numeric-suffix utilities let a wrong magnitude green the existing rail/skip assertions', () => {
    const realRail = 'inline-flex items-center min-h-11 px-1';
    const wrongRail = realRail
      .replace('min-h-11', 'min-h-110')
      .replace('px-1', 'px-10');
    expect(wrongRail).toContain('min-h-11');
    expect(wrongRail).toContain('px-1');
    const skip = 'rounded-md py-3 px-4';
    const wrongSkip = skip.replace('py-3', 'py-30').replace('px-4', 'px-40');
    expect(wrongSkip).toContain('py-3');
    expect(wrongSkip).toContain('px-4');
  });
});
