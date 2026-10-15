// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Icon } from '../app/_components/icon';

describe('C-027 Icon', () => {
  it('renders an svg with the 20x20 viewBox by default', () => {
    const { container } = render(<Icon name="circle-solid" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute('viewBox')).toBe('0 0 20 20');
  });

  it('is decorative by default (aria-hidden + focusable=false)', () => {
    const { container } = render(<Icon name="triangle-alert" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
  });

  it('applies size-5 (20px) by default and size-4 (16px) when size=16', () => {
    const big = render(<Icon name="circle-solid" />);
    expect(big.container.querySelector('svg')!.className.baseVal).toContain('size-5');
    big.unmount();
    const small = render(<Icon name="circle-solid" size={16} />);
    expect(small.container.querySelector('svg')!.className.baseVal).toContain('size-4');
  });

  it('renders the circle-solid path with fill=currentColor (I-01 is the only filled mark)', () => {
    const { container } = render(<Icon name="circle-solid" />);
    const circle = container.querySelector('circle')!;
    expect(circle.getAttribute('fill')).toBe('currentColor');
    expect(circle.getAttribute('cx')).toBe('10');
    expect(circle.getAttribute('cy')).toBe('10');
    expect(circle.getAttribute('r')).toBe('4.25');
  });

  it('uses stroke=currentColor stroke-width=1.75 round caps/joins for stroked marks', () => {
    const { container } = render(<Icon name="chevron-right" />);
    const path = container.querySelector('path')!;
    expect(path.getAttribute('stroke')).toBe('currentColor');
    expect(path.getAttribute('stroke-width')).toBe('1.75');
    expect(path.getAttribute('stroke-linecap')).toBe('round');
    expect(path.getAttribute('stroke-linejoin')).toBe('round');
    expect(path.getAttribute('d')).toBe('M7.8 4.4 13.4 10l-5.6 5.6');
  });

  it('exposes all twelve names in the typed map', () => {
    const names = [
      'circle-solid', 'triangle-alert', 'spanner', 'minus-circle',
      'plus', 'chevron-left', 'chevron-right', 'image-off',
      'download', 'trash', 'alert-banner', 'empty-register',
    ] as const;
    for (const name of names) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector('svg'), name).toBeTruthy();
      unmount();
    }
  });

  it('passes through extra props (e.g. data-testid for later composition)', () => {
    render(<Icon name="trash" data-testid="icon-trash" />);
    expect(screen.getByTestId('icon-trash')).toBeTruthy();
  });
});
