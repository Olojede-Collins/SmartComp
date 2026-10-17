// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stamp } from '../app/_components/stamp';

const SOURCE_NOTE =
  'ENGINEERING FACULTY HOOD COLOUR — ACADEMIC BRIEF TABLE 2.1';
const DRAFT = 'DRAFT — TO BE CHECKED BY THE LEGAL OFFICE BEFORE LAUNCH';

describe('C-023 Stamp', () => {
  it('renders the source-note stamp with the token stack', () => {
    const { container } = render(<Stamp>{SOURCE_NOTE}</Stamp>);
    const stamp = container.firstElementChild as HTMLElement;
    const classes = stamp.className.split(/\s+/);
    expect(stamp.tagName).toBe('SPAN');
    expect(classes).toContain('inline-flex');
    expect(classes).toContain('items-center');
    expect(classes).toContain('gap-2');
    expect(classes).toContain('w-fit');
    expect(classes).toContain('max-w-full');
    expect(classes).toContain('bg-bg-stamp');
    expect(classes).toContain('border');
    expect(classes).toContain('border-border-warn');
    expect(classes).toContain('rounded-sm');
    expect(classes).toContain('px-3');
    expect(classes).toContain('py-2');
    expect(classes).toContain('text-micro');
    expect(classes).toContain('tracking-micro');
    expect(classes).toContain('text-fg-stamp');
    expect(stamp.className).not.toMatch(/uppercase/i);
    expect(screen.getByText(SOURCE_NOTE)).toBeTruthy();
  });

  it('renders the privacy draft mark verbatim', () => {
    render(<Stamp>{DRAFT}</Stamp>);
    expect(screen.getByText(DRAFT)).toBeTruthy();
  });

  it('embeds the decorative I-11 alert-banner icon (aria-hidden, 20px)', () => {
    const { container } = render(<Stamp>{SOURCE_NOTE}</Stamp>);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.getAttribute('viewBox')).toBe('0 0 20 20');
    expect(svg.className.baseVal.split(/\s+/)).toContain('size-5');
  });

  it('is page content, not a notification (no role, no live region)', () => {
    const { container } = render(<Stamp>{SOURCE_NOTE}</Stamp>);
    const stamp = container.firstElementChild as HTMLElement;
    expect(stamp.getAttribute('role')).toBeNull();
    expect(stamp.getAttribute('aria-live')).toBeNull();
    expect(stamp.getAttribute('aria-hidden')).toBeNull();
    expect(stamp.getAttribute('tabindex')).toBeNull();
  });

  it('is never dismissible (no button, no close control)', () => {
    const { container } = render(<Stamp>{SOURCE_NOTE}</Stamp>);
    expect(container.querySelector('button')).toBeNull();
    const stamp = container.firstElementChild as HTMLElement;
    expect(stamp.querySelectorAll('a')).toHaveLength(0);
  });

  it('banner variant fills the row as a block stamp', () => {
    const { container } = render(<Stamp variant="banner">{SOURCE_NOTE}</Stamp>);
    const stamp = container.firstElementChild as HTMLElement;
    const classes = stamp.className.split(/\s+/);
    expect(classes).toContain('flex');
    expect(classes).toContain('w-full');
  });
});
