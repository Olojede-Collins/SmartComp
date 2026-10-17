// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeaderRail } from '../app/_components/header-rail';

const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/);

describe('C-001 / C-002 HeaderRail', () => {
  it('public rail: sticky banner landmark on the rail ground at token height', () => {
    const { container } = render(<HeaderRail variant="public" current="/" />);
    const header = container.querySelector('header')!;
    const cls = classes(header);
    expect(header.tagName).toBe('HEADER');
    expect(cls).toContain('sticky');
    expect(cls).toContain('top-0');
    expect(cls).toContain('z-rail');
    expect(cls).toContain('h-[var(--layout-railHeight)]');
    expect(cls).toContain('bg-bg-rail');
    expect(cls).toContain('text-fg-on-rail');
  });

  it('public nav carries exactly Home and The collection with the Primary label', () => {
    render(<HeaderRail variant="public" />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const links = nav.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toBe('Home');
    expect(links[0].getAttribute('href')).toBe('/');
    expect(links[1].textContent).toBe('The collection');
    expect(links[1].getAttribute('href')).toBe('/room');
    expect(nav.querySelector('button')).toBeNull();
  });

  it('marks the current public page with aria-current=page (C-003 delegation)', () => {
    render(<HeaderRail variant="public" current="/room" />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const links = nav.querySelectorAll('a');
    expect(links[1].getAttribute('aria-current')).toBe('page');
    expect(links[0].getAttribute('aria-current')).toBeNull();
  });

  it('admin rail reuses the identical rail treatment (same ground/height/focus)', () => {
    const { container } = render(
      <HeaderRail variant="admin" current="/admin" />,
    );
    const header = container.querySelector('header')!;
    const cls = classes(header);
    expect(cls).toContain('bg-bg-rail');
    expect(cls).toContain('h-[var(--layout-railHeight)]');
    expect(cls).toContain('sticky');
    expect(cls).toContain('z-rail');
  });

  it('admin nav carries Items, Admins and a real Sign out control', () => {
    render(<HeaderRail variant="admin" />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const links = nav.querySelectorAll('a');
    expect([...links].map((l) => l.textContent)).toEqual(['Items', 'Admins']);
    expect(links[0].getAttribute('href')).toBe('/admin');
    expect(links[1].getAttribute('href')).toBe('/admin/admins');
    const signOut = screen.getByRole('button', { name: 'Sign out' });
    expect(signOut.getAttribute('type')).toBe('button');
    expect(classes(signOut)).toContain('min-h-11');
    expect(classes(signOut)).toContain('text-fg-on-rail-muted');
  });

  it('every rail child focus ring uses border-focus-on-rail, never border-focus', () => {
    const { container } = render(<HeaderRail variant="admin" />);
    const focusables = container.querySelectorAll('a, button');
    expect(focusables.length).toBeGreaterThan(0);
    focusables.forEach((el) => {
      const cls = classes(el);
      expect(cls).toContain('focus-visible:outline-border-focus-on-rail');
      expect(cls).not.toContain('focus-visible:outline-border-focus');
      expect(cls).toContain('focus-visible:outline-3');
      expect(cls).toContain('focus-visible:outline-offset-2');
    });
  });

  it('renders the crest with institution alt and the wordmark hidden below 768px', () => {
    const { container } = render(<HeaderRail variant="public" />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('alt')).toBe('Ahmadu Bello University');
    expect(classes(img)).toContain('flex-none');
    const word = screen.getByText('ABU Smart Class');
    expect(classes(word)).toContain('hidden');
    expect(classes(word)).toContain('md:inline');
  });

  it('admin exposes the banner slot beneath the rail; public does not', () => {
    const { container, rerender } = render(
      <HeaderRail variant="admin">
        <p>Building the register.</p>
      </HeaderRail>,
    );
    const slot = container.querySelector('.banner-slot')!;
    expect(slot).not.toBeNull();
    expect(classes(slot)).toContain('pt-4');
    expect(classes(slot)).not.toContain('pt-5');
    expect(slot.textContent).toContain('Building the register.');
    rerender(<HeaderRail variant="public" />);
    expect(container.querySelector('.banner-slot')).toBeNull();
  });
});
