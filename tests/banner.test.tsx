// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Banner } from '../app/_components/banner';

const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/);

describe('C-017 Banner', () => {
  it('caution (default) wears the brown ground, warn border and slot anatomy', () => {
    const { container } = render(
      <Banner heading="That file type is not accepted.">
        Nothing was saved.
      </Banner>,
    );
    const box = container.firstElementChild as HTMLElement;
    const cls = classes(box);
    expect(cls).toContain('banner');
    expect(cls).toContain('flex');
    expect(cls).toContain('gap-3');
    expect(cls).toContain('items-start');
    expect(cls).toContain('px-5');
    expect(cls).toContain('py-4');
    expect(cls).toContain('rounded-md');
    expect(cls).toContain('border');
    expect(cls).not.toContain('shadow-card');
    expect(cls).toContain('bg-bg-banner-warn');
    expect(cls).toContain('border-border-warn');
    expect(cls).not.toContain('banner--error');
    expect(cls).not.toContain('banner--success');
  });

  it('caution heading is an h3 with the stamp colour and I-11 alert mark', () => {
    const { container } = render(
      <Banner heading="That file type is not accepted.">Body.</Banner>,
    );
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.textContent).toBe('That file type is not accepted.');
    expect(classes(heading)).toContain('text-h3');
    expect(classes(heading)).toContain('text-fg-stamp');
    const svg = container.querySelector('svg')!;
    expect(classes(svg)).toContain('text-fg-stamp');
    expect(classes(svg)).toContain('mt-0.5');
    expect(classes(svg)).toContain('shrink-0');
    expect(container.querySelector('circle')!.getAttribute('r')).toBe('6.5');
  });

  it('error variant pairs surface ground with the faulty border and I-02 triangle', () => {
    const { container } = render(
      <Banner tone="error" heading="That condition is not on the list.">
        Nothing was saved.
      </Banner>,
    );
    const box = container.firstElementChild as HTMLElement;
    const cls = classes(box);
    expect(cls).toContain('banner--error');
    expect(cls).toContain('bg-bg-surface');
    expect(cls).toContain('border-border-error');
    expect(cls).not.toContain('bg-bg-banner-warn');
    const heading = screen.getByRole('heading', { level: 3 });
    expect(classes(heading)).toContain('text-fg-status-faulty');
    const svg = container.querySelector('svg')!;
    expect(classes(svg)).toContain('text-fg-status-faulty');
    expect(container.querySelector('path')!.getAttribute('d')).toContain(
      'M10 3.6',
    );
  });

  it('error carries role=alert and quotes the machine code in a mono line', () => {
    const { container } = render(
      <Banner tone="error" heading="Broken." code="condition-enum-invalid">
        Nothing was saved.
      </Banner>,
    );
    const box = container.firstElementChild as HTMLElement;
    expect(box.getAttribute('role')).toBe('alert');
    const code = container.querySelector('.banner__code') as HTMLElement;
    expect(code.textContent).toBe('condition-enum-invalid');
    expect(classes(code)).toContain('text-data');
    expect(classes(code)).toContain('text-fg-muted');
  });

  it('success variant pairs surface ground with the working border and no icon', () => {
    const { container } = render(
      <Banner tone="success" heading="Item saved.">
        The record is up to date.
      </Banner>,
    );
    const box = container.firstElementChild as HTMLElement;
    const cls = classes(box);
    expect(cls).toContain('banner--success');
    expect(cls).toContain('bg-bg-surface');
    expect(cls).toContain('border-border-status-working');
    expect(box.getAttribute('role')).toBe('status');
    expect(box.getAttribute('aria-live')).toBe('polite');
    const heading = screen.getByRole('heading', { level: 3 });
    expect(classes(heading)).toContain('text-fg-status-working');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('success may dismiss with a compact ghost control; the callback fires', () => {
    const onDismiss = vi.fn();
    render(
      <Banner
        tone="success"
        heading="Item saved."
        dismissible
        onDismiss={onDismiss}
      >
        The record is up to date.
      </Banner>,
    );
    const button = screen.getByRole('button', { name: 'Dismiss' });
    const cls = classes(button);
    expect(cls).toContain('bg-transparent');
    expect(cls).toContain('border-border-strong');
    expect(cls).toContain('min-h-11');
    button.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('caution and error are facts: dismissible is ignored, no control renders', () => {
    const { container, rerender } = render(
      <Banner heading="Caution." dismissible>
        Body.
      </Banner>,
    );
    expect(container.querySelector('button')).toBeNull();
    rerender(
      <Banner tone="error" heading="Error." dismissible>
        Body.
      </Banner>,
    );
    expect(container.querySelector('button')).toBeNull();
  });

  it('the waiting live region wraps heading + sentence in role=status inside the body', () => {
    const { container } = render(
      <Banner live heading="Building the register.">
        The admin area is starting up.
      </Banner>,
    );
    const box = container.firstElementChild as HTMLElement;
    expect(box.getAttribute('role')).toBe('alert');
    const live = container.querySelector('.banner__live') as HTMLElement;
    expect(live.getAttribute('role')).toBe('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.querySelector('h3')).not.toBeNull();
    expect(live.querySelector('p')).not.toBeNull();
  });

  it('an elapsed slot renders an aria-hidden banner__elapsed block', () => {
    const { container } = render(
      <Banner live heading="Building the register." elapsed={<span>0:00</span>}>
        Body.
      </Banner>,
    );
    const elapsed = container.querySelector('.banner__elapsed') as HTMLElement;
    expect(elapsed).not.toBeNull();
    expect(elapsed.getAttribute('aria-hidden')).toBe('true');
    expect(classes(elapsed)).toContain('flex-col');
    expect(elapsed.textContent).toBe('0:00');
  });

  it('the slot places the box in a centred container-width band (C-017 §2.1)', () => {
    const { container } = render(
      <Banner slot heading="Building the register.">
        Body.
      </Banner>,
    );
    const slot = container.firstElementChild as HTMLElement;
    const cls = classes(slot);
    expect(cls).toContain('banner-slot');
    expect(cls).toContain('max-w-[var(--layout-containerMax)]');
    expect(cls).toContain('mx-auto');
    expect(cls).toContain('pt-4');
    expect(slot.querySelector('.banner')).not.toBeNull();
  });

  it('is static (D-037): never animates severity', () => {
    const { container } = render(<Banner heading="Caution.">Body.</Banner>);
    const box = container.firstElementChild as HTMLElement;
    expect(box.className).not.toMatch(/transition|animate|motion-safe/);
  });
});
