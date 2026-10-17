// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImagePlaceholder } from '../app/_components/image-placeholder';

describe('C-014 ImagePlaceholder', () => {
  it('empty full: placeholder ground with PHOTO micro + 4:3 geometry', () => {
    const { container } = render(<ImagePlaceholder />);
    const ground = container.firstElementChild as HTMLElement;
    const classes = ground.className.split(/\s+/);
    expect(classes).toContain('bg-bg-placeholder');
    expect(classes).toContain('border');
    expect(classes).toContain('border-border-rule');
    expect(classes).toContain('rounded-sm');
    expect(classes).toContain('aspect-[4/3]');
    expect(classes).toContain('p-4');
    expect(classes).toContain('text-fg-placeholder-text');
    expect(screen.getByText('PHOTO').className).toContain('text-micro');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('empty thumb: fixed 96x72 box', () => {
    const { container } = render(<ImagePlaceholder size="thumb" />);
    const ground = container.firstElementChild as HTMLElement;
    const classes = ground.className.split(/\s+/);
    expect(classes).toContain('w-[96px]');
    expect(classes).toContain('h-[72px]');
    expect(classes).toContain('p-2');
    expect(classes).toContain('gap-1');
    expect(classes).not.toContain('aspect-[4/3]');
  });

  it('failed: sunken ground + I-08 + verbatim sentence, no retry by default', () => {
    const { container } = render(<ImagePlaceholder state="failed" />);
    const ground = container.firstElementChild as HTMLElement;
    expect(ground.className).toContain('bg-bg-surface-sunken');
    expect(ground.className).not.toContain('bg-bg-placeholder');
    expect(container.querySelector('svg')).toBeTruthy();
    expect(screen.getByText('The image failed to load.')).toBeTruthy();
    expect(container.querySelector('button')).toBeNull();
  });

  it('failed with retry renders the C-006 "Try again" control', () => {
    const onRetry = vi.fn();
    render(<ImagePlaceholder state="failed" showRetry onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('loading: skeleton ground, aria-hidden, no animation', () => {
    const { container } = render(<ImagePlaceholder state="loading" />);
    const ground = container.firstElementChild as HTMLElement;
    expect(ground.className).toContain('bg-bg-skeleton');
    expect(ground.getAttribute('aria-hidden')).toBe('true');
    expect(container.innerHTML).not.toMatch(/animate-|pulse|shimmer/);
  });

  it('renders a real image and degrades to failed on error', () => {
    const { container } = render(
      <ImagePlaceholder src="/x.jpg" alt="Monitors" />,
    );
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/x.jpg');
    expect(img.getAttribute('alt')).toBe('Monitors');
    fireEvent.error(img);
    expect(screen.getByText('The image failed to load.')).toBeTruthy();
  });

  it('I-08 is decorative beside the sentence (never icon alone, 1.4.1)', () => {
    const { container } = render(<ImagePlaceholder state="failed" />);
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(screen.getByText('The image failed to load.')).toBeTruthy();
  });
});
