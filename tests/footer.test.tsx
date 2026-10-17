// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '../app/_components/footer';

const SOURCE_NOTE =
  'ENGINEERING FACULTY HOOD COLOUR — ACADEMIC BRIEF TABLE 2.1';
const PROVENANCE = 'Recorded by the ABU Smart Class lab team.';

const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/);

describe('C-004 Footer', () => {
  it('is a contentinfo landmark on the page ground with a top rule', () => {
    const { container } = render(<Footer variant="public" />);
    const footer = container.querySelector('footer')!;
    const cls = classes(footer);
    expect(footer.tagName).toBe('FOOTER');
    expect(cls).toContain('border-t');
    expect(cls).toContain('border-border-rule');
    expect(cls).toContain('bg-bg-page');
  });

  it('carries the provenance sentence verbatim as caption fg-muted', () => {
    render(<Footer variant="public" />);
    const prov = screen.getByText(PROVENANCE);
    expect(prov.tagName).toBe('P');
    expect(classes(prov)).toContain('text-caption');
    expect(classes(prov)).toContain('text-fg-muted');
    expect(prov.className).not.toMatch(/uppercase/i);
  });

  it('public footer: crest + The collection + Privacy (FR-10.1)', () => {
    const { container } = render(<Footer variant="public" />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('Ahmadu Bello University');
    expect(classes(img)).toContain('h-[23px]');
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'The Collection',
      'Privacy',
    ]);
    expect(links[0].getAttribute('href')).toBe('/room');
    expect(links[1].getAttribute('href')).toBe('/privacy');
  });

  it('admin footer: no Privacy link, The inventory instead (as shipped)', () => {
    render(<Footer variant="admin" />);
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'The Collection',
      'The Inventory',
    ]);
    expect(links[1].getAttribute('href')).toBe('/admin');
    expect(screen.queryByRole('link', { name: 'Privacy' })).toBeNull();
  });

  it('links are fg-link, hover underline, 44px tall and standard focus ring', () => {
    render(<Footer variant="public" />);
    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      const cls = classes(link);
      expect(cls).toContain('text-fg-link');
      expect(cls).toContain('hover:text-fg-link-hover');
      expect(cls).toContain('min-h-11');
      expect(cls).toContain('focus-visible:outline-3');
      expect(cls).toContain('focus-visible:outline-border-focus');
      expect(cls).not.toContain('focus-visible:outline-border-focus-on-rail');
    });
  });

  it('omits the academic hood note from public footer', () => {
    render(<Footer variant="public" />);
    expect(screen.queryByText(SOURCE_NOTE)).toBeNull();
  });
});
