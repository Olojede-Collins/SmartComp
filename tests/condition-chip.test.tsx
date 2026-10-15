// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConditionChip } from '../app/_components/condition-chip';

describe('C-011 ConditionChip', () => {
  it('Working: chip--working triple + I-01 circle-solid at size 20', () => {
    const { container } = render(<ConditionChip condition="Working" />);
    const chip = container.querySelector('.chip')!;
    expect(chip.className).toContain('chip--working');
    expect(chip.className).toContain('bg-status-working');
    expect(chip.className).toContain('border-status-working');
    expect(chip.className).toContain('text-fg-status-working');
    expect(chip.className).toContain('min-h-6'); // 32px
    expect(chip.className).toContain('rounded-sm');
    expect(screen.getByText('Working')).toBeTruthy();
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 20 20');
    expect(svg.className.baseVal).toContain('size-5'); // 20px shipped
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('circle')!.getAttribute('r')).toBe('4.25');
  });

  it('Faulty: chip--faulty triple + I-02 triangle-alert', () => {
    const { container } = render(<ConditionChip condition="Faulty" />);
    const chip = container.querySelector('.chip')!;
    expect(chip.className).toContain('chip--faulty');
    expect(chip.className).toContain('bg-status-faulty');
    expect(chip.className).toContain('text-fg-status-faulty');
    expect(screen.getByText('Faulty')).toBeTruthy();
    expect(container.querySelector('path')!.getAttribute('d')).toContain(
      'M10 3.6',
    );
  });

  it('Under Maintenance: chip--maintenance + I-03 spanner', () => {
    const { container } = render(
      <ConditionChip condition="Under Maintenance" />,
    );
    const chip = container.querySelector('.chip')!;
    expect(chip.className).toContain('chip--maintenance');
    expect(chip.className).toContain('bg-status-maintenance');
    expect(screen.getByText('Under Maintenance')).toBeTruthy();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('Decommissioned: chip--decommissioned + I-04 minus-circle', () => {
    const { container } = render(<ConditionChip condition="Decommissioned" />);
    const chip = container.querySelector('.chip')!;
    expect(chip.className).toContain('chip--decommissioned');
    expect(chip.className).toContain('bg-status-decommissioned');
    expect(screen.getByText('Decommissioned')).toBeTruthy();
    expect(container.querySelector('circle')).toBeTruthy();
  });

  it('unknown condition renders the neutral defensive chip with the raw word', () => {
    const { container } = render(
      <ConditionChip condition={'Needs repair' as never} />,
    );
    const chip = container.querySelector('.chip')!;
    expect(chip.className).not.toMatch(
      /chip--(working|faulty|maintenance|decommissioned)/,
    );
    expect(chip.className).toContain('bg-surface');
    expect(chip.className).toContain('border-rule');
    expect(chip.className).toContain('text-fg-default');
    expect(screen.getByText('Needs repair')).toBeTruthy();
  });

  it('is never interactive (no button role, no tabindex)', () => {
    const { container } = render(<ConditionChip condition="Working" />);
    const chip = container.querySelector('.chip')!;
    expect(chip.getAttribute('tabindex')).toBeNull();
    expect(chip.getAttribute('role')).toBeNull();
    expect(chip.tagName).toBe('SPAN');
  });

  it('does not apply CSS uppercase (D-020 title case)', () => {
    const { container } = render(<ConditionChip condition="Working" />);
    const chip = container.querySelector('.chip')!;
    expect(chip.className).not.toMatch(/uppercase/i);
  });
});
