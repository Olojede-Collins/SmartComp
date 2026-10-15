// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from '../app/_components/field';
import { Input } from '../app/_components/input';

describe('C-010 Field', () => {
  it('renders the label, bound for/id to the control', () => {
    render(
      <Field label="Item name">
        {({ id }) => <Input id={id} aria-label="Item name" />}
      </Field>,
    );
    const label = screen.getByText('Item name');
    const input = screen.getByLabelText('Item name');
    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
  });

  it('stacks label / control / help / error with gap-2', () => {
    const { container } = render(
      <Field label="Item name" help="As it appears on the asset tag.">
        {({ id }) => <Input id={id} aria-label="Item name" />}
      </Field>,
    );
    const field = container.querySelector('.field')!;
    expect(field.className).toContain('flex');
    expect(field.className).toContain('flex-col');
    expect(field.className).toContain('gap-2');
  });

  it('shows the (required) marker in micro when required', () => {
    render(
      <Field label="Item name" required>
        {({ id }) => <Input id={id} aria-label="Item name" />}
      </Field>,
    );
    const marker = screen.getByText('(required)');
    expect(marker.tagName).toBe('SPAN');
    expect(marker.className).toContain('text-xs'); // micro
    expect(marker.className).toContain('tracking-caps');
    expect(marker.className).toContain('text-fg-muted');
    // No CSS uppercase on the marker itself â€” the word is authored in source.
    expect(marker.className).not.toMatch(/uppercase/i);
  });

  it('does not show the marker for optional fields', () => {
    render(
      <Field label="Description">
        {({ id }) => <Input id={id} aria-label="Description" />}
      </Field>,
    );
    expect(screen.queryByText('(required)')).toBeNull();
  });

  it('renders help text and links it via describedBy', () => {
    render(
      <Field label="Item name" help="As it appears on the asset tag.">
        {({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} aria-label="Item name" />
        )}
      </Field>,
    );
    const help = screen.getByText('As it appears on the asset tag.');
    expect(help.tagName).toBe('P');
    const input = screen.getByLabelText('Item name');
    expect(input.getAttribute('aria-describedby')).toContain(help.id);
  });

  it('renders the error row with I-02, role=alert, and wires describedBy + aria-invalid', () => {
    render(
      <Field label="Condition" error="That condition is not on the list. 409 condition-enum-invalid.">
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-label="Condition"
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
          />
        )}
      </Field>,
    );
    const err = screen.getByRole('alert');
    expect(err.tagName).toBe('P');
    expect(err.className).toContain('text-fg-status-faulty');
    expect(err.textContent).toContain('409 condition-enum-invalid');
    const ico = err.querySelector('svg')!;
    expect(ico.getAttribute('viewBox')).toBe('0 0 20 20');
    expect(ico.className.baseVal).toContain('size-4'); // 16px
    const input = screen.getByLabelText('Condition');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain(err.id);
  });

  it('joins help and error in describedBy when both exist (error takes priority)', () => {
    render(
      <Field label="Condition" help="Pick one of the four recorded states." error="Not on the list.">
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-label="Condition"
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
          />
        )}
      </Field>,
    );
    const input = screen.getByLabelText('Condition');
    const described = input.getAttribute('aria-describedby')!;
    const help = screen.getByText('Pick one of the four recorded states.');
    const err = screen.getByRole('alert');
    expect(described).toContain(help.id);
    expect(described).toContain(err.id);
  });

  it('passes invalid=false when no error is present', () => {
    const spy = vi.fn();
    render(
      <Field label="Item name">
        {({ invalid }) => {
          spy(invalid);
          return <Input id="x" aria-label="Item name" aria-invalid={invalid || undefined} />;
        }}
      </Field>,
    );
    expect(spy).toHaveBeenCalledWith(false);
  });
});
