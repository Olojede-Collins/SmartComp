// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ColdStartPanel } from '../app/_components/cold-start-panel';

const WAITING_H = 'Building the register.';
const WAITING_B =
  'The admin area is starting up for the first time. This usually takes about a minute. The record will appear here when it is ready.';

const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/);

describe('C-020 ColdStartPanel', () => {
  it('waiting is a brown caution panel — never red, never a spinner', () => {
    const { container } = render(<ColdStartPanel state="waiting" />);
    const box = container.querySelector('.banner') as HTMLElement;
    const cls = classes(box);
    expect(cls).toContain('bg-bg-banner-warn');
    expect(cls).toContain('border-border-warn');
    expect(cls).not.toContain('border-border-error');
    expect(cls).not.toContain('bg-bg-danger');
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(box.className).not.toMatch(/transition|animate|spin/);
  });

  it('announces the state once through a polite live region with verbatim copy', () => {
    const { container } = render(<ColdStartPanel state="waiting" />);
    const live = container.querySelector('.banner__live') as HTMLElement;
    expect(live.getAttribute('role')).toBe('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByText(WAITING_H).tagName).toBe('H3');
    expect(screen.getByText(WAITING_B)).toBeTruthy();
  });

  it('shows the ELAPSED key and a mono ticker starting at 0:00, inside an aria-hidden block', () => {
    const { container } = render(<ColdStartPanel state="waiting" />);
    const elapsed = container.querySelector('.banner__elapsed') as HTMLElement;
    expect(elapsed.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('ELAPSED')).toBeTruthy();
    const ticker = screen.getByText('0:00');
    expect(classes(ticker)).toContain('text-data-strong');
    expect(classes(ticker)).toContain('tabular-nums');
  });

  it('ticks the elapsed text once per second (mm:ss)', () => {
    vi.useFakeTimers();
    try {
      render(<ColdStartPanel state="waiting" />);
      expect(screen.getByText('0:00')).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText('0:01')).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(60000);
      });
      expect(screen.getByText('1:01')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('ready removes the banner entirely', () => {
    const { container } = render(<ColdStartPanel state="ready" />);
    expect(container.innerHTML).toBe('');
  });

  it('over-bound switches to the error tone and names the failure', () => {
    const { container } = render(<ColdStartPanel state="error" />);
    const box = container.querySelector('.banner') as HTMLElement;
    const cls = classes(box);
    expect(cls).toContain('banner--error');
    expect(cls).toContain('border-border-error');
    expect(cls).not.toContain('bg-bg-banner-warn');
    expect(box.getAttribute('role')).toBe('alert');
    expect(
      screen.getByText('The register took too long to start.').tagName,
    ).toBe('H3');
    expect(
      screen.getByText(
        'The first run did not finish. Try again in a moment, and tell the lab team if it keeps happening.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('cold-start-timeout')).toBeTruthy();
    expect(container.querySelector('.banner__elapsed')).toBeNull();
  });
});
