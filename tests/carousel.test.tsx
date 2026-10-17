// @vitest-environment jsdom
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Carousel, AUTO_ADVANCE_INTERVAL } from '../app/_components/carousel';

const sampleItems = [
  {
    href: '/item/SC-001',
    name: 'HDMI splitter and converter',
    condition: 'Working',
    facts: [
      { key: 'RECORD', value: 'SC-001' },
      { key: 'QUANTITY', value: '1', strong: true },
      { key: 'UPDATED', value: '2026-10-09' },
    ],
  },
  {
    href: '/item/SC-002',
    name: 'Monitors',
    condition: 'Working',
    facts: [
      { key: 'RECORD', value: 'SC-002' },
      { key: 'QUANTITY', value: '50', strong: true },
      { key: 'UPDATED', value: '2026-10-09' },
    ],
  },
  {
    href: '/item/SC-003',
    name: 'Recording Host',
    condition: 'Working',
    facts: [
      { key: 'RECORD', value: 'SC-003' },
      { key: 'QUANTITY', value: '1', strong: true },
      { key: 'UPDATED', value: '2026-10-09' },
    ],
  },
];

describe('C-016 Carousel (auto-advancing)', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    vi.useFakeTimers();
    originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    document.documentElement.removeAttribute('data-state');
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
    document.documentElement.removeAttribute('data-state');
  });

  it('exports AUTO_ADVANCE_INTERVAL as exactly 6000 ms', () => {
    expect(AUTO_ADVANCE_INTERVAL).toBe(6000);
  });

  it('advances slides every 6000 ms', () => {
    render(<Carousel items={sampleItems} />);
    const count = screen.getByText('1 / 3');
    expect(count).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('2 / 3')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('3 / 3')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('3 / 3')).toBeTruthy();
  });

  it('pauses auto-advance on hover and resumes on mouse leave', () => {
    render(<Carousel items={sampleItems} />);
    const carouselRegion = screen.getByRole('region', {
      name: /featured items/i,
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.mouseEnter(carouselRegion);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.mouseLeave(carouselRegion);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('pauses auto-advance on focus-within and resumes on blur', () => {
    render(<Carousel items={sampleItems} />);
    const carouselRegion = screen.getByRole('region', {
      name: /featured items/i,
    });
    const nextBtn = screen.getByRole('button', { name: 'Next slide' });
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.focus(nextBtn);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.blur(carouselRegion, { relatedTarget: document.body });
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('permanently stops auto-advance after manual interaction', () => {
    render(<Carousel items={sampleItems} />);
    const nextBtn = screen.getByRole('button', { name: 'Next slide' });
    const prevBtn = screen.getByRole('button', { name: 'Previous slide' });

    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.click(nextBtn);
    expect(screen.getByText('2 / 3')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('2 / 3')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(18000);
    });
    expect(screen.getByText('2 / 3')).toBeTruthy();

    const carouselRegion = screen.getByRole('region', {
      name: /featured items/i,
    });
    fireEvent.mouseEnter(carouselRegion);
    fireEvent.mouseLeave(carouselRegion);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('2 / 3')).toBeTruthy();

    fireEvent.click(prevBtn);
    expect(screen.getByText('1 / 3')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('kills auto-advance entirely and disables transitions when prefers-reduced-motion is active', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<Carousel items={sampleItems} />);
    expect(screen.getByText('1 / 3')).toBeTruthy();

    const track = container.querySelector('ul.carousel__track')!;
    expect(track.className).toContain('transition-none');

    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('kills auto-advance entirely when document data-state is reduced-motion', () => {
    document.documentElement.setAttribute('data-state', 'reduced-motion');

    const { container, unmount } = render(<Carousel items={sampleItems} />);
    expect(screen.getByText('1 / 3')).toBeTruthy();

    const track = container.querySelector('ul.carousel__track')!;
    expect(track.className).toContain('transition-none');

    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();
    unmount();
  });

  it('does not start timer when there are fewer than 2 slides and disables controls', () => {
    const singleItem = [sampleItems[0]];
    render(<Carousel items={singleItem} />);

    expect(screen.getByText('1 / 1')).toBeTruthy();
    const prevBtn = screen.getByRole('button', { name: 'Previous slide' });
    const nextBtn = screen.getByRole('button', { name: 'Next slide' });
    expect(prevBtn.hasAttribute('disabled')).toBe(true);
    expect(nextBtn.hasAttribute('disabled')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(screen.getByText('1 / 1')).toBeTruthy();
  });

  it('handles empty item list cleanly', () => {
    render(<Carousel items={[]} />);

    expect(screen.getByText('0 / 0')).toBeTruthy();
    const prevBtn = screen.getByRole('button', { name: 'Previous slide' });
    const nextBtn = screen.getByRole('button', { name: 'Next slide' });
    expect(prevBtn.hasAttribute('disabled')).toBe(true);
    expect(nextBtn.hasAttribute('disabled')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(screen.getByText('0 / 0')).toBeTruthy();
  });

  it('displays position count n / N and applies boundary disabling to previous and next buttons', () => {
    render(<Carousel items={sampleItems} />);
    const prevBtn = screen.getByRole('button', { name: 'Previous slide' });
    const nextBtn = screen.getByRole('button', { name: 'Next slide' });

    expect(prevBtn.hasAttribute('disabled')).toBe(true);
    expect(nextBtn.hasAttribute('disabled')).toBe(false);
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.click(nextBtn);
    expect(prevBtn.hasAttribute('disabled')).toBe(false);
    expect(nextBtn.hasAttribute('disabled')).toBe(false);
    expect(screen.getByText('2 / 3')).toBeTruthy();

    fireEvent.click(nextBtn);
    expect(prevBtn.hasAttribute('disabled')).toBe(false);
    expect(nextBtn.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('3 / 3')).toBeTruthy();
  });

  it('provides accessible carousel roles, slide roledescription, and slide labels', () => {
    const { container } = render(<Carousel items={sampleItems} />);

    const region = screen.getByRole('region', { name: /featured items/i });
    expect(region.getAttribute('aria-roledescription')).toBe('carousel');

    const slides = container.querySelectorAll('li.carousel__slide');
    expect(slides).toHaveLength(3);
    slides.forEach((slide, idx) => {
      expect(slide.getAttribute('role')).toBe('group');
      expect(slide.getAttribute('aria-roledescription')).toBe('slide');
      expect(slide.getAttribute('aria-label')).toBe(
        `Slide ${idx + 1} of ${sampleItems.length}`,
      );
    });

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links[0].getAttribute('href')).toBe('/item/SC-001');
  });

  it('cleans up interval timer on unmount', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = render(<Carousel items={sampleItems} />);

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it('supports keyboard navigation via ArrowLeft and ArrowRight', () => {
    render(<Carousel items={sampleItems} />);
    const carouselRegion = screen.getByRole('region', {
      name: /featured items/i,
    });

    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.keyDown(carouselRegion, { key: 'ArrowRight' });
    expect(screen.getByText('2 / 3')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('2 / 3')).toBeTruthy();

    fireEvent.keyDown(carouselRegion, { key: 'ArrowLeft' });
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('handles loading state with skeletons and disabled timer', () => {
    const { container } = render(
      <Carousel items={sampleItems} loading={true} />,
    );

    const prevBtn = screen.getByRole('button', { name: 'Previous slide' });
    const nextBtn = screen.getByRole('button', { name: 'Next slide' });
    expect(prevBtn.hasAttribute('disabled')).toBe(true);
    expect(nextBtn.hasAttribute('disabled')).toBe(true);

    expect(container.querySelectorAll('.bg-bg-skeleton')).not.toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('updates live region mode from off to polite when manual or paused', () => {
    render(<Carousel items={sampleItems} />);
    const count = screen.getByText('1 / 3');
    expect(count.getAttribute('aria-live')).toBe('off');

    const nextBtn = screen.getByRole('button', { name: 'Next slide' });
    fireEvent.click(nextBtn);
    expect(count.getAttribute('aria-live')).toBe('polite');
  });
});
