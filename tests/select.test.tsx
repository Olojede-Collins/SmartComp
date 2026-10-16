// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select } from '../app/_components/select';
import { CONDITION_ENUM } from '../app/_components/condition-enum';

describe('C-009 CONDITION_ENUM', () => {
  it('holds exactly the four FR-2.1 strings in order', () => {
    expect(CONDITION_ENUM).toEqual([
      'Working',
      'Faulty',
      'Under Maintenance',
      'Decommissioned',
    ]);
  });
});

describe('C-009 Select', () => {
  it('renders a native select inside the relative wrapper', () => {
    const { container } = render(<Select aria-label="Condition" />);
    const wrap = container.querySelector('.select-wrap');
    expect(wrap).toBeTruthy();
    const sel = screen.getByLabelText('Condition');
    expect(sel.tagName).toBe('SELECT');
  });

  it('hides the native arrow and matches the C-008 field box (44px, border-strong)', () => {
    render(<Select aria-label="Condition" />);
    const sel = screen.getByLabelText('Condition');
    expect(sel.className).toContain('appearance-none');
    expect(sel.className).toContain('min-h-11');
    expect(sel.className).toContain('border-border-strong');
    expect(sel.className).toContain('bg-bg-surface');
    expect(sel.className).toContain('pl-4');
    expect(sel.className).toContain('pr-7');
  });

  it('renders all four options in FR-2.1 order', () => {
    render(<Select aria-label="Condition" />);
    const sel = screen.getByLabelText('Condition') as HTMLSelectElement;
    const labels = Array.from(sel.options).map((o) => o.textContent);
    expect(labels).toEqual([
      'Working',
      'Faulty',
      'Under Maintenance',
      'Decommissioned',
    ]);
  });

  it('accepts a defaultValue that matches one of the four', () => {
    render(<Select aria-label="Condition" defaultValue="Faulty" />);
    const sel = screen.getByLabelText('Condition') as HTMLSelectElement;
    expect(sel.value).toBe('Faulty');
  });

  it('positions a decorative chevron that ignores pointer events', () => {
    const { container } = render(<Select aria-label="Condition" />);
    const chev = container.querySelector('.select-wrap > .ico') as SVGElement;
    expect(chev).toBeTruthy();
    expect(chev.getAttribute('aria-hidden')).toBe('true');
    expect(chev.getAttribute('focusable')).toBe('false');
    expect(chev.getAttribute('viewBox')).toBe('0 0 20 20');
    expect(chev.getAttribute('class')).toContain('pointer-events-none');
    expect(chev.getAttribute('class')).toContain('text-fg-muted');
    expect(chev.getAttribute('class')).toContain('absolute');
    expect(chev.getAttribute('class')).toContain('right-4');
    expect(chev.getAttribute('class')).toContain('size-4');
    const path = chev.querySelector('path')!;
    expect(path.getAttribute('d')).toBe('M5 8l5 5 5-5');
  });

  it('invalid swaps the border to the error token via aria-invalid', () => {
    render(<Select aria-label="Condition" aria-invalid="true" />);
    const sel = screen.getByLabelText('Condition');
    expect(sel.getAttribute('aria-invalid')).toBe('true');
    expect(sel.className).toContain('aria-invalid:border-border-error');
  });

  it('disabled uses the solid token pair', () => {
    render(<Select aria-label="Condition" disabled />);
    const sel = screen.getByLabelText('Condition');
    expect(sel.hasAttribute('disabled')).toBe(true);
    expect(sel.className).toContain('disabled:bg-bg-disabled');
    expect(sel.className).toContain('disabled:text-fg-disabled');
    expect(sel.className).toContain('disabled:border-border-disabled');
  });

  it('focus-visible uses the token outline ring', () => {
    render(<Select aria-label="Condition" />);
    const sel = screen.getByLabelText('Condition');
    expect(sel.className).toContain('focus-visible:outline-3');
    expect(sel.className).toContain('focus-visible:outline-offset-2');
    expect(sel.className).toContain('focus-visible:outline-border-focus');
  });
});
