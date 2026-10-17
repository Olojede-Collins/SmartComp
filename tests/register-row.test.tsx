// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RegisterRow, RegisterRows } from '../app/_components/register-row';

const facts = [
  { key: 'RECORD', value: 'SC-001' },
  { key: 'QUANTITY', value: '1', strong: true },
  { key: 'UPDATED', value: '2026-10-09' },
];

function renderRow(ui: React.ReactNode) {
  return render(<RegisterRows>{ui}</RegisterRows>);
}

describe('C-012 RegisterRow', () => {
  it('is one link per row in ul > li > a with the row surface stack', () => {
    const { container } = renderRow(
      <RegisterRow
        href="/item/SC-001"
        name="HDMI splitter and converter "
        condition="Working"
        facts={facts}
      />,
    );
    expect(container.querySelector('ul.rows')).toBeTruthy();
    expect(container.querySelectorAll('ul > li > a')).toHaveLength(1);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/item/SC-001');
    const classes = link.className.split(/\s+/);
    expect(classes).toContain('block');
    expect(classes).toContain('bg-bg-surface');
    expect(classes).toContain('border');
    expect(classes).toContain('border-border-rule');
    expect(classes).toContain('rounded-md');
    expect(classes).toContain('p-4');
    expect(classes).not.toContain('shadow-card');
    expect(classes).toContain('no-underline');
    expect(classes).toContain('text-fg-default');
    expect(classes).toContain('hover:border-border-strong');
    expect(classes).not.toContain('hover:shadow-raised');
  });

  it('the list keeps the ruled geometry (gap-3, no marker)', () => {
    const { container } = renderRow(
      <RegisterRow href="/x" name="N" condition="Working" facts={facts} />,
    );
    const ul = container.querySelector('ul')!;
    const classes = ul.className.split(/\s+/);
    expect(classes).toContain('list-none');
    expect(classes).toContain('gap-3');
    expect(classes).toContain('p-0');
  });

  it('names the item with a serif h3 item-name and has no nested interactives', () => {
    const { container } = renderRow(
      <RegisterRow
        href="/x"
        name="Students screen and camera "
        condition="Working"
        facts={facts}
      />,
    );
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.tagName).toBe('H3');
    expect(heading.className).toContain('text-item-name');
    expect(heading.textContent).toBe('Students screen and camera ');
    const link = container.querySelector('a')!;
    expect(link.querySelectorAll('a')).toHaveLength(0);
    expect(link.querySelectorAll('button')).toHaveLength(0);
    expect(link.querySelectorAll('input')).toHaveLength(0);
  });

  it('renders the condition chip and embedded fact pairs (no dl inside the link)', () => {
    const { container } = renderRow(
      <RegisterRow
        href="/x"
        name="Monitors"
        condition="Faulty"
        facts={facts}
      />,
    );
    expect(container.querySelector('.chip')).toBeTruthy();
    expect(screen.getByText('Faulty')).toBeTruthy();
    expect(container.querySelector('dl')).toBeNull();
    expect(screen.getByText('RECORD')).toBeTruthy();
    expect(screen.getByText('SC-001')).toBeTruthy();
    expect(screen.getByText('1').className).toContain('text-data-strong');
  });

  it('focus-visible wraps the whole row with the global outline triple', () => {
    renderRow(
      <RegisterRow href="/x" name="N" condition="Working" facts={facts} />,
    );
    const link = screen.getByRole('link');
    expect(link.className).toContain('focus-visible:outline-3');
    expect(link.className).toContain('focus-visible:outline-offset-2');
    expect(link.className).toContain('focus-visible:outline-border-focus');
  });

  it('image-missing thumb shows the PHOTO placeholder', () => {
    renderRow(
      <RegisterRow href="/x" name="N" condition="Working" facts={facts} />,
    );
    expect(screen.getByText('PHOTO')).toBeTruthy();
  });

  it('image-failed thumb shows I-08 only — no retry button inside the row link', () => {
    const { container } = renderRow(
      <RegisterRow
        href="/x"
        name="N"
        condition="Working"
        image={{ failed: true }}
        facts={facts}
      />,
    );
    const link = container.querySelector('a')!;
    expect(link.querySelector('button')).toBeNull();
    expect(screen.getByText('The image failed to load.')).toBeTruthy();
  });

  it('with-image thumb renders the real image', () => {
    const { container } = renderRow(
      <RegisterRow
        href="/x"
        name="N"
        condition="Working"
        image={{ src: '/monitors.jpg', alt: 'Monitors' }}
        facts={facts}
      />,
    );
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/monitors.jpg');
    expect(img.getAttribute('alt')).toBe('Monitors');
  });

  it('loading swaps the row body for the skeleton geometry, keeping the list gap', () => {
    const { container } = renderRow(
      <RegisterRow href="/x" name="N" condition="Working" loading />,
    );
    expect(container.querySelector('.bg-bg-skeleton')).toBeTruthy();
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('ul.rows')).toBeTruthy();
  });

  it('hover carries no shadow transition (motion allowlist: transform/opacity only)', () => {
    const { container } = renderRow(
      <RegisterRow href="/x" name="N" condition="Working" facts={facts} />,
    );
    expect(container.querySelector('a')!.className).not.toMatch(/transition/);
  });
});
