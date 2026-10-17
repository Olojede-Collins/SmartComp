// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageGallery } from '@/app/_components/image-gallery';

const TEST_IMAGES = [
  { src: '/images/monitor-1.jpg', alt: 'Monitors - front view' },
  { src: '/images/monitor-2.jpg', alt: 'Monitors - rear view' },
  { src: '/images/monitor-3.jpg', alt: 'Monitors - side view' },
];

describe('C-015 ImageGallery', () => {
  it('renders hero image in 4:3 placeholder slot and thumbnail row', () => {
    render(<ImageGallery images={TEST_IMAGES} title="Monitors" />);

    const heroImg = screen.getByAltText('Monitors - front view');
    expect(heroImg).toBeTruthy();

    const thumbsList = screen.getByRole('list');
    expect(thumbsList.className).toContain('gallery__thumbs');
    expect(thumbsList.className).toContain('flex');
    expect(thumbsList.className).toContain('gap-2');
    expect(thumbsList.className).toContain('mt-3');

    const thumbButtons = screen.getAllByRole('button', {
      name: /View photograph/i,
    });
    expect(thumbButtons.length).toBe(3);

    expect(thumbButtons[0].getAttribute('aria-current')).toBe('true');
    expect(thumbButtons[0].className).toContain('border-[3px]');
    expect(thumbButtons[0].className).toContain('border-border-focus');

    expect(thumbButtons[1].getAttribute('aria-current')).toBe('false');
    expect(thumbButtons[1].className).toContain('border-border-rule');
  });

  it('clicking a thumbnail updates the active hero image and aria-current state', () => {
    render(<ImageGallery images={TEST_IMAGES} title="Monitors" />);

    const thumbButtons = screen.getAllByRole('button', {
      name: /View photograph/i,
    });
    fireEvent.click(thumbButtons[1]);

    expect(thumbButtons[0].getAttribute('aria-current')).toBe('false');
    expect(thumbButtons[1].getAttribute('aria-current')).toBe('true');

    expect(screen.getByAltText('Monitors - rear view')).toBeTruthy();
  });

  it('opens viewer modal when hero is clicked and supports prev/next navigation and Esc to close', () => {
    render(<ImageGallery images={TEST_IMAGES} title="Monitors" />);

    const heroTrigger = screen.getByRole('button', {
      name: /Open full photograph viewer|View full size/i,
    });
    fireEvent.click(heroTrigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();

    const prevBtn = screen.getByRole('button', { name: 'Previous image' });
    const nextBtn = screen.getByRole('button', { name: 'Next image' });
    expect(prevBtn).toBeTruthy();
    expect(nextBtn).toBeTruthy();

    fireEvent.click(nextBtn);
    expect(screen.getByText('2 / 3')).toBeTruthy();

    fireEvent.click(prevBtn);
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders single empty hero without thumbs when images array is empty', () => {
    render(<ImageGallery images={[]} title="Monitors" />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText('PHOTO')).toBeTruthy();
  });
});
