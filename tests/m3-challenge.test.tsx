// @vitest-environment jsdom
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import { Carousel, AUTO_ADVANCE_INTERVAL } from '../app/_components/carousel';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogOverlay,
  ConfirmDestructiveDialog,
  ExportDialog,
} from '../app/_components/dialog';
import { ErrorBanner } from '../app/_components/error-banner';
import { ImageGallery } from '../app/_components/image-gallery';
import { InviteForm } from '../app/_components/invite-form';

function classes(el: Element | null | undefined): string[] {
  if (!el) return [];
  const raw = el.getAttribute('class') || '';
  return raw.trim().split(/\s+/).filter(Boolean);
}

const carouselSampleItems = [
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

const gallerySampleImages = [
  { src: '/images/monitor-front.jpg', alt: 'Monitors - front view' },
  { src: '/images/monitor-rear.jpg', alt: 'Monitors - rear view' },
  { src: '/images/monitor-ports.jpg', alt: 'Monitors - ports view' },
];

describe('M3-CHALLENGE Seam 1: C-016 Carousel (auto-advancing motion, timers, and pause guards)', () => {
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

  it('1.1 exports AUTO_ADVANCE_INTERVAL constant strictly equal to 6000 ms', () => {
    expect(AUTO_ADVANCE_INTERVAL).toBe(6000);
  });

  it('1.2 advances slides sequentially every 6000 ms and halts at track end', () => {
    render(<Carousel items={carouselSampleItems} />);
    expect(screen.getByText('1 / 3')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('2 / 3')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('3 / 3')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(screen.getByText('3 / 3')).toBeTruthy();
  });

  it('1.3 pauses auto-advance on mouseEnter and resumes timer on mouseLeave', () => {
    render(<Carousel items={carouselSampleItems} />);
    const region = screen.getByRole('region', { name: /featured items/i });
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.mouseEnter(region);

    act(() => {
      vi.advanceTimersByTime(18000);
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.mouseLeave(region);

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('1.4 pauses auto-advance on focus-within and resumes on blur to external element', () => {
    render(<Carousel items={carouselSampleItems} />);
    const nextBtn = screen.getByRole('button', { name: 'Next slide' });
    const carouselRegion = screen.getByRole('region', {
      name: /featured items/i,
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.focus(nextBtn);

    act(() => {
      vi.advanceTimersByTime(18000);
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.blur(carouselRegion, { relatedTarget: document.body });

    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('1.5 clicking next slide permanently halts auto-advance', () => {
    render(<Carousel items={carouselSampleItems} />);
    const nextBtn = screen.getByRole('button', { name: 'Next slide' });
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.click(nextBtn);
    expect(screen.getByText('2 / 3')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('1.6 clicking prev slide permanently halts auto-advance', () => {
    render(<Carousel items={carouselSampleItems} initialIndex={1} />);
    const prevBtn = screen.getByRole('button', { name: 'Previous slide' });
    expect(screen.getByText('2 / 3')).toBeTruthy();

    fireEvent.click(prevBtn);
    expect(screen.getByText('1 / 3')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('1.7 keyboard ArrowRight navigation permanently halts auto-advance', () => {
    render(<Carousel items={carouselSampleItems} />);
    const region = screen.getByRole('region', { name: /featured items/i });
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.keyDown(region, { key: 'ArrowRight', code: 'ArrowRight' });
    expect(screen.getByText('2 / 3')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('1.8 reduced-motion kill: timer is OFF ENTIRELY under prefers-reduced-motion: reduce', () => {
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

    const { container } = render(<Carousel items={carouselSampleItems} />);
    const track = container.querySelector('ul.carousel__track');
    expect(classes(track)).toContain('transition-none');
    expect(classes(track)).not.toContain('transition-transform');
    expect(screen.getByText('1 / 3')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('1.9 reduced-motion kill: timer is OFF ENTIRELY under html[data-state="reduced-motion"]', () => {
    document.documentElement.setAttribute('data-state', 'reduced-motion');
    const { container, unmount } = render(
      <Carousel items={carouselSampleItems} />,
    );
    const track = container.querySelector('ul.carousel__track');
    expect(classes(track)).toContain('transition-none');
    expect(classes(track)).not.toContain('transition-transform');
    expect(screen.getByText('1 / 3')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();
    unmount();
  });

  it('1.10 single slide (< 2 slides) disables controls, reads 1 / 1, and never starts auto-advance timer', () => {
    render(<Carousel items={[carouselSampleItems[0]]} />);
    const count = screen.getByText('1 / 1');
    expect(count).toBeTruthy();

    const prevBtn = screen.getByRole('button', { name: 'Previous slide' });
    const nextBtn = screen.getByRole('button', { name: 'Next slide' });
    expect(prevBtn.hasAttribute('disabled')).toBe(true);
    expect(nextBtn.hasAttribute('disabled')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(screen.getByText('1 / 1')).toBeTruthy();
  });

  it('1.11 empty slide list reads 0 / 0 and disables all controls', () => {
    render(<Carousel items={[]} />);
    expect(screen.getByText('0 / 0')).toBeTruthy();
    const prevBtn = screen.getByRole('button', { name: 'Previous slide' });
    const nextBtn = screen.getByRole('button', { name: 'Next slide' });
    expect(prevBtn.hasAttribute('disabled')).toBe(true);
    expect(nextBtn.hasAttribute('disabled')).toBe(true);
  });

  it('1.12 loading state renders skeleton rows and prevents auto-advance timer from advancing', () => {
    render(<Carousel items={carouselSampleItems} loading={true} />);
    const prevBtn = screen.getByRole('button', { name: 'Previous slide' });
    const nextBtn = screen.getByRole('button', { name: 'Next slide' });
    expect(prevBtn.hasAttribute('disabled')).toBe(true);
    expect(nextBtn.hasAttribute('disabled')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('1.13 unmount clears interval timer cleanly to prevent memory leaks', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = render(<Carousel items={carouselSampleItems} />);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('1.14 position count adheres to n / N Mono format in micro size', () => {
    render(<Carousel items={carouselSampleItems} />);
    const countEl = screen.getByText('1 / 3');
    const elClasses = classes(countEl);
    expect(elClasses).toContain('font-mono');
    expect(elClasses).toContain('text-micro');
    expect(elClasses).toContain('text-fg-muted');
    expect(countEl.textContent?.trim()).toMatch(/^\d+\s\/\s\d+$/);
  });
});

describe('M3-CHALLENGE Seam 2: C-021 Dialog (focus containment, Esc pending block, destructive & export layouts)', () => {
  it('2.1 dialog shell renders role="dialog", aria-modal="true", and token-exact panel classes', () => {
    render(
      <Dialog open>
        <DialogOverlay />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Dialog</DialogTitle>
            <DialogDescription>Description of test dialog</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <button type="button">Close</button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const panelClasses = classes(dialog);
    expect(panelClasses).toContain('w-full');
    expect(panelClasses).toContain('max-w-[560px]');
    expect(panelClasses).toContain('bg-bg-surface');
    expect(panelClasses).not.toContain('border-border-strong');
    expect(panelClasses).toContain('rounded-md');
    expect(panelClasses).toContain('shadow-modal');
    expect(panelClasses).toContain('p-5');

    const overlay = document.querySelector('[data-dialog-overlay]');
    expect(overlay).toBeTruthy();
    const overlayClasses = classes(overlay);
    expect(overlayClasses).toContain('fixed');
    expect(overlayClasses).toContain('inset-0');
    expect(overlayClasses).toContain('z-modal');
    expect(overlayClasses).toContain('bg-neutral-900/45');
  });

  it('2.2 Esc key closes dialog when pending is false', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent pending={false}>
          <DialogTitle>Closable Dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('2.3 Esc key is strictly BLOCKED when pending is true', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent pending={true}>
          <DialogTitle>Pending Mutation Dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('2.4 S-009 ConfirmDestructiveDialog: Cancel has autofocus and primary variant, Delete has danger variant and never has autofocus', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDestructiveDialog
        open
        itemName="Recording Host"
        recordCode="SC-003"
        quantity={1}
        condition="Working"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    const deleteBtn = screen.getByRole('button', { name: 'Delete item' });

    expect(cancelBtn.hasAttribute('data-autofocus')).toBe(true);
    expect(deleteBtn.hasAttribute('data-autofocus')).toBe(false);

    const cancelClasses = classes(cancelBtn);
    expect(cancelClasses).toContain('bg-bg-action');
    expect(cancelClasses).toContain('text-fg-on-action');

    const deleteClasses = classes(deleteBtn);
    expect(deleteClasses).toContain('bg-bg-danger');
    expect(deleteClasses).toContain('text-fg-on-danger');

    expect(screen.getByText('SC-003')).toBeTruthy();
    expect(classes(screen.getByText('SC-003'))).toContain('font-mono');
    expect(classes(screen.getByText('SC-003'))).toContain('text-data');
  });

  it('2.5 S-009 ConfirmDestructiveDialog pending state disables actions and swaps label to Deleting…', () => {
    render(
      <ConfirmDestructiveDialog
        open
        itemName="Recording Host"
        recordCode="SC-003"
        quantity={1}
        condition="Working"
        pending={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const deletingBtn = screen.getByRole('button', { name: 'Deleting…' });
    expect(deletingBtn).toBeTruthy();
    expect(deletingBtn.hasAttribute('disabled')).toBe(true);
    expect(deletingBtn.getAttribute('aria-busy')).toBe('true');

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelBtn.hasAttribute('disabled')).toBe(true);
  });

  it('2.6 S-010 ExportDialog: format radios, ghost Close, download button with icon, and D-018 note', () => {
    const onExport = vi.fn();
    const onClose = vi.fn();

    render(<ExportDialog open onExport={onExport} onClose={onClose} />);

    expect(screen.getByText('Export the Register')).toBeTruthy();
    expect(screen.getByRole('group', { name: /FORMAT/i })).toBeTruthy();

    const pdfRadio = screen.getByRole('radio', { name: /PDF/i });
    const csvRadio = screen.getByRole('radio', { name: /CSV/i });
    expect(pdfRadio).toBeTruthy();
    expect(csvRadio).toBeTruthy();

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    expect(classes(closeBtn)).toContain('border-border-strong');

    const downloadBtn = screen.getByRole('button', {
      name: /Download the file/i,
    });
    expect(classes(downloadBtn)).toContain('bg-bg-action');
    expect(downloadBtn.querySelector('svg')).toBeTruthy();

    expect(
      screen.getByText(
        /Record IDs stay inside the admin app and are not written to the file/i,
      ),
    ).toBeTruthy();

    fireEvent.click(pdfRadio);
    expect((pdfRadio as HTMLInputElement).checked).toBe(true);

    fireEvent.click(downloadBtn);
    expect(onExport).toHaveBeenCalledWith('pdf');

    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('2.7 S-010 ExportDialog pending state swaps label to Preparing… and disables controls', () => {
    render(<ExportDialog open pending={true} onExport={vi.fn()} />);

    const preparingBtn = screen.getByRole('button', { name: 'Preparing…' });
    expect(preparingBtn).toBeTruthy();
    expect(preparingBtn.hasAttribute('disabled')).toBe(true);

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    expect(closeBtn.hasAttribute('disabled')).toBe(true);

    const csvRadio = screen.getByRole('radio', { name: /CSV/i });
    expect(csvRadio.hasAttribute('disabled')).toBe(true);
  });
});

describe('M3-CHALLENGE Seam 3: C-026 ErrorBanner (verbatim codes, tone classification, and live regions)', () => {
  const REQUIRED_MACHINE_CODES = [
    'condition-enum-invalid',
    'inventory-ceiling',
    'file-too-large',
    'unsupported-media-type',
    'gmail-send-failed',
    'last-admin',
    'item-not-found',
    'admin-unauthorized',
    'export-generation-failed',
    'cold-start-timeout',
  ];

  it.each(REQUIRED_MACHINE_CODES)(
    '3.1 renders verbatim machine code "%s" in Mono (font-mono text-data)',
    (code) => {
      render(<ErrorBanner code={code} />);
      const codeSpan = screen.getByText(code);
      expect(codeSpan).toBeTruthy();
      const codeClasses = classes(codeSpan);
      expect(codeClasses).toContain('font-mono');
      expect(codeClasses).toContain('text-data');
    },
  );

  it('3.2 tone classification: 413, 415, and email failure MUST be brown caution (bg-bg-banner-warn border-border-warn text-fg-stamp)', () => {
    const cautionCodes = [
      'file-too-large',
      'image-too-large',
      'image-oversize',
      'unsupported-media-type',
      'mime-rejected',
      'image-type',
      'gmail-send-failed',
      'email-delivery-failed',
      'email-failed',
    ];

    cautionCodes.forEach((code) => {
      const { container, unmount } = render(<ErrorBanner code={code} />);
      const banner = container.querySelector('.banner');
      expect(banner).not.toBeNull();
      const bannerClasses = classes(banner);
      expect(bannerClasses).toContain('bg-bg-banner-warn');
      expect(bannerClasses).toContain('border-border-warn');
      expect(bannerClasses).not.toContain('banner--error');
      expect(bannerClasses).not.toContain('border-border-error');

      const heading = container.querySelector('h3');
      expect(classes(heading)).toContain('text-fg-stamp');

      const icon = container.querySelector('svg');
      expect(classes(icon)).toContain('text-fg-stamp');

      unmount();
    });
  });

  it('3.3 tone classification: 409, 404, 403, 500, and timeout MUST be red error (border-border-error text-fg-status-faulty)', () => {
    const errorCodes = [
      'condition-enum-invalid',
      'invalid-condition',
      'inventory-ceiling',
      'last-admin',
      'last-admin-blocked',
      'item-not-found',
      'not-found',
      'admin-unauthorized',
      'forbidden',
      'export-generation-failed',
      'export-failed',
      'cold-start-timeout',
    ];

    errorCodes.forEach((code) => {
      const { container, unmount } = render(<ErrorBanner code={code} />);
      const banner = container.querySelector('.banner');
      expect(banner).not.toBeNull();
      const bannerClasses = classes(banner);
      expect(bannerClasses).toContain('banner--error');
      expect(bannerClasses).toContain('bg-bg-surface');
      expect(bannerClasses).toContain('border-border-error');
      expect(bannerClasses).not.toContain('bg-bg-banner-warn');
      expect(bannerClasses).not.toContain('border-border-warn');

      const heading = container.querySelector('h3');
      expect(classes(heading)).toContain('text-fg-status-faulty');

      const icon = container.querySelector('svg');
      expect(classes(icon)).toContain('text-fg-status-faulty');

      unmount();
    });
  });

  it('3.4 banner container has role="alert" live region attribute', () => {
    render(<ErrorBanner code="condition-enum-invalid" />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeTruthy();
  });

  it('3.5 email failure renders secondary faulty line "Mail delivery failed."', () => {
    render(<ErrorBanner code="gmail-send-failed" />);
    const faultyLine = screen.getByText('Mail delivery failed.');
    expect(faultyLine).toBeTruthy();
    expect(classes(faultyLine)).toContain('text-fg-status-faulty');
  });
});

describe('M3-CHALLENGE Seam 4: C-015 ImageGallery (thumbnails geometry, active border, and modal viewer)', () => {
  it('4.1 renders thumbnails at 96x72 geometry with 3px focus border when active and aria-current="true"', () => {
    render(<ImageGallery images={gallerySampleImages} title="Monitors" />);

    const thumbButtons = screen.getAllByRole('button', {
      name: /View photograph/i,
    });
    expect(thumbButtons.length).toBe(3);

    thumbButtons.forEach((btn) => {
      const btnClasses = classes(btn);
      expect(btnClasses).toContain('w-[96px]');
      expect(btnClasses).toContain('h-[72px]');
      expect(btnClasses).toContain('rounded-sm');
    });

    expect(thumbButtons[0].getAttribute('aria-current')).toBe('true');
    expect(classes(thumbButtons[0])).toContain('border-[3px]');
    expect(classes(thumbButtons[0])).toContain('border-border-focus');

    expect(thumbButtons[1].getAttribute('aria-current')).toBe('false');
    expect(classes(thumbButtons[1])).toContain('border');
    expect(classes(thumbButtons[1])).toContain('border-border-rule');
  });

  it('4.2 clicking thumbnail updates active hero image and toggles aria-current selection', () => {
    render(<ImageGallery images={gallerySampleImages} title="Monitors" />);

    const thumbButtons = screen.getAllByRole('button', {
      name: /View photograph/i,
    });
    fireEvent.click(thumbButtons[1]);

    expect(thumbButtons[0].getAttribute('aria-current')).toBe('false');
    expect(classes(thumbButtons[0])).toContain('border-border-rule');

    expect(thumbButtons[1].getAttribute('aria-current')).toBe('true');
    expect(classes(thumbButtons[1])).toContain('border-[3px]');
    expect(classes(thumbButtons[1])).toContain('border-border-focus');

    expect(screen.getByAltText('Monitors - rear view')).toBeTruthy();
  });

  it('4.3 clicking hero opens full viewer modal dialog with prev/next buttons carrying accessible labels', () => {
    render(<ImageGallery images={gallerySampleImages} title="Monitors" />);

    const heroTrigger = screen.getByRole('button', {
      name: /Open full photograph viewer/i,
    });
    fireEvent.click(heroTrigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();

    const prevBtn = screen.getByRole('button', { name: 'Previous image' });
    const nextBtn = screen.getByRole('button', { name: 'Next image' });
    expect(prevBtn).toBeTruthy();
    expect(nextBtn).toBeTruthy();

    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.click(nextBtn);
    expect(screen.getByText('2 / 3')).toBeTruthy();

    fireEvent.click(prevBtn);
    expect(screen.getByText('1 / 3')).toBeTruthy();

    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('4.4 empty image list renders honest empty PHOTO placeholder without thumbnails row', () => {
    render(<ImageGallery images={[]} title="Monitors" />);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText('PHOTO')).toBeTruthy();
  });
});

describe('M3-CHALLENGE Seam 5: C-025 InviteForm (structure, sending state, and failure preservation)', () => {
  it('5.1 renders anatomy: head h2, email field with autocomplete, and primary submit button', () => {
    render(<InviteForm />);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent?.trim()).toBe('Invite an administrator');

    const emailInput = screen.getByLabelText(/EMAIL/i);
    expect(emailInput).toBeTruthy();
    expect(emailInput.getAttribute('type')).toBe('email');
    expect(emailInput.getAttribute('autocomplete')).toBe('email');

    const submitBtn = screen.getByRole('button', { name: 'Send invite' });
    expect(submitBtn).toBeTruthy();
    expect(classes(submitBtn)).toContain('bg-bg-action');
    expect(classes(submitBtn)).toContain('text-fg-on-action');
    expect(submitBtn.hasAttribute('disabled')).toBe(false);
  });

  it('5.2 sending state: button disabled, label "Sending…", aria-busy="true", input read-only', () => {
    render(
      <InviteForm
        state="sending"
        defaultEmail="lab.supervisor@example.edu.ng"
      />,
    );

    const submitBtn = screen.getByRole('button', { name: 'Sending…' });
    expect(submitBtn).toBeTruthy();
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
    expect(submitBtn.getAttribute('aria-busy')).toBe('true');

    const emailInput = screen.getByLabelText(/EMAIL/i);
    expect(
      emailInput.hasAttribute('readonly') ||
        emailInput.hasAttribute('disabled'),
    ).toBe(true);
  });

  it('5.3 failure state: email address is preserved in input, caution banner with verbatim copy renders', () => {
    render(
      <InviteForm
        state="invite-failed"
        defaultEmail="bounced.admin@example.edu.ng"
      />,
    );

    const emailInput = screen.getByLabelText(/EMAIL/i) as HTMLInputElement;
    expect(emailInput.value).toBe('bounced.admin@example.edu.ng');

    const alertBanner = screen.getByRole('alert');
    expect(alertBanner).toBeTruthy();
    expect(classes(alertBanner)).toContain('bg-bg-banner-warn');
    expect(classes(alertBanner)).toContain('border-border-warn');

    expect(screen.getByText('The invitation did not send.')).toBeTruthy();
    expect(screen.getByText('Mail delivery failed.')).toBeTruthy();
    expect(screen.getByText('gmail-send-failed')).toBeTruthy();
  });

  it('5.4 interactive submission rejection preserves typed email and renders caution banner', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('SMTP timeout'));

    render(<InviteForm onSubmit={onSubmit} />);

    const emailInput = screen.getByLabelText(/EMAIL/i) as HTMLInputElement;
    fireEvent.change(emailInput, {
      target: { value: 'failed.user@example.edu.ng' },
    });

    const submitBtn = screen.getByRole('button', { name: 'Send invite' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('The invitation did not send.')).toBeTruthy();
      expect(screen.getByText('Mail delivery failed.')).toBeTruthy();
      expect(emailInput.value).toBe('failed.user@example.edu.ng');
    });
  });
});
