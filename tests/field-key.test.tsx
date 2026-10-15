// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FieldKey } from '../app/_components/field-key';

describe('C-024 FieldKey', () => {
  it('renders a block span with the catalogue caption register', () => {
    render(<FieldKey>RECORD</FieldKey>);
    const key = screen.getByText('RECORD');
    expect(key.tagName).toBe('SPAN');
    expect(key.className).toContain('block');
    expect(key.className).toContain('text-xs');   // micro (11px base with tracking)
    expect(key.className).toContain('font-medium');
    expect(key.className).toContain('tracking-caps'); // 0.14em
    expect(key.className).toContain('text-fg-muted');
  });

  it('never applies CSS uppercase (D-020 â€” uppercase lives in the source string)', () => {
    render(<FieldKey>RECORD</FieldKey>);
    const key = screen.getByText('RECORD');
    expect(key.className).not.toMatch(/uppercase/i);
  });

  it('carries no icon', () => {
    const { container } = render(<FieldKey>QUANTITY</FieldKey>);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('is not interactive', () => {
    render(<FieldKey>UPDATED</FieldKey>);
    const key = screen.getByText('UPDATED');
    expect(key.getAttribute('tabindex')).toBeNull();
    expect(key.getAttribute('role')).toBeNull();
  });
});
