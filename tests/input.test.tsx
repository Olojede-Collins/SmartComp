// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input, Textarea } from '../app/_components/input';

describe('C-008 Input', () => {
  it('renders a native input with the default anatomy stack', () => {
    render(<Input aria-label="Item name" />);
    const input = screen.getByLabelText('Item name');
    expect(input.tagName).toBe('INPUT');
    expect(input.className).toContain('w-full');
    expect(input.className).toContain('min-h-11');
    expect(input.className).toContain('px-4');
    expect(input.className).toContain('py-3');
    expect(input.className).toContain('bg-bg-surface');
    expect(input.className).toContain('text-fg-default');
    expect(input.className).toContain('border');
    expect(input.className).toContain('border-border-strong');
    expect(input.className).toContain('rounded-md');
  });

  it('focus-visible uses the token outline ring', () => {
    render(<Input aria-label="Item name" />);
    const input = screen.getByLabelText('Item name');
    expect(input.className).toContain('focus-visible:outline-3');
    expect(input.className).toContain('focus-visible:outline-offset-2');
    expect(input.className).toContain('focus-visible:outline-border-focus');
  });

  it('placeholder uses the placeholder-text token', () => {
    render(<Input aria-label="Item name" placeholder="e.g. HDMI splitter" />);
    const input = screen.getByLabelText('Item name');
    expect(input.className).toContain('placeholder:text-fg-placeholder-text');
  });

  it('invalid sets aria-invalid and swaps the border to the error token', () => {
    render(<Input aria-label="Item name" aria-invalid="true" />);
    const input = screen.getByLabelText('Item name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.className).toContain('aria-invalid:border-border-error');
  });

  it('disabled uses the solid token pair, never opacity', () => {
    render(<Input aria-label="Item name" disabled />);
    const input = screen.getByLabelText('Item name');
    expect(input.hasAttribute('disabled')).toBe(true);
    expect(input.className).toContain('disabled:bg-bg-disabled');
    expect(input.className).toContain('disabled:text-fg-disabled');
    expect(input.className).toContain('disabled:border-border-disabled');
    expect(input.className).not.toMatch(/opacity/i);
  });

  it('readOnly stays focusable (no disabled attribute) with the disabled look', () => {
    render(<Input aria-label="Record" readOnly defaultValue="SC-001" />);
    const input = screen.getByLabelText('Record');
    expect(input.hasAttribute('readonly')).toBe(true);
    expect(input.hasAttribute('disabled')).toBe(false);
    expect(input.className).toContain('read-only:bg-bg-disabled');
    expect(input.className).toContain('read-only:text-fg-disabled');
    expect(input.className).toContain('read-only:border-border-disabled');
  });

  it('number variant adds inputmode=numeric and the 10em cap', () => {
    render(<Input aria-label="Quantity" variant="number" />);
    const input = screen.getByLabelText('Quantity');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.className).toContain('max-w-40');
  });

  it('spreads type, name, autoComplete and controlled props', () => {
    render(
      <Input
        aria-label="Email"
        type="email"
        name="email"
        autoComplete="email"
        defaultValue="a@b.c"
      />,
    );
    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('type')).toBe('email');
    expect(input.getAttribute('name')).toBe('email');
    expect(input.getAttribute('autocomplete')).toBe('email');
    expect((input as HTMLInputElement).value).toBe('a@b.c');
  });

  it('password variant keeps type=password and does not echo the value', () => {
    render(
      <Input aria-label="Password" variant="password" defaultValue="s3cret" />,
    );
    const input = screen.getByLabelText('Password') as HTMLInputElement;
    expect(input.getAttribute('type')).toBe('password');
    expect(input.value).toBe('s3cret');
    expect(screen.queryByText('s3cret')).toBeNull();
  });
});

describe('C-008 Textarea', () => {
  it('renders a native textarea with the 8em min-height and vertical resize', () => {
    render(<Textarea aria-label="Description" />);
    const ta = screen.getByLabelText('Description');
    expect(ta.tagName).toBe('TEXTAREA');
    expect(ta.className).toContain('min-h-32');
    expect(ta.className).toContain('resize-y');
    expect(ta.className).toContain('w-full');
    expect(ta.className).toContain('px-4');
    expect(ta.className).toContain('py-3');
  });

  it('invalid sets aria-invalid and swaps the border to the error token', () => {
    render(<Textarea aria-label="Description" aria-invalid="true" />);
    const ta = screen.getByLabelText('Description');
    expect(ta.getAttribute('aria-invalid')).toBe('true');
    expect(ta.className).toContain('aria-invalid:border-border-error');
  });

  it('disabled uses the solid token pair', () => {
    render(<Textarea aria-label="Description" disabled />);
    const ta = screen.getByLabelText('Description');
    expect(ta.hasAttribute('disabled')).toBe(true);
    expect(ta.className).toContain('disabled:bg-bg-disabled');
    expect(ta.className).toContain('disabled:text-fg-disabled');
    expect(ta.className).toContain('disabled:border-border-disabled');
  });
});
