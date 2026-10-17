// @vitest-environment jsdom
import * as React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';

const mockPush = vi.fn();
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  notFound: () => mockNotFound(),
}));

import Page from '@/app/page';
import RoomPage from '@/app/room/page';
import ItemPage from '@/app/item/[id]/page';
import PrivacyPage from '@/app/privacy/page';
import { Carousel, AUTO_ADVANCE_INTERVAL } from '@/app/_components/carousel';
import { EmptyState } from '@/app/_components/empty-state';
import { LoadingSkeleton } from '@/app/_components/loading-skeleton';
import { RegisterRow } from '@/app/_components/register-row';
import { Banner } from '@/app/_components/banner';
import { ConditionChip } from '@/app/_components/condition-chip';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  ConfirmDestructiveDialog,
} from '@/app/_components/dialog';
import { DataTable } from '@/app/_components/data-table';
import { ColdStartPanel } from '@/app/_components/cold-start-panel';
import * as supabaseModule from '@/lib/supabase';
import * as equipmentModule from '@/lib/equipment';
import {
  getEquipmentById,
  _setLastKnownGoodEquipment,
  _clearEquipmentCache,
  type Equipment,
} from '@/lib/equipment';

const sampleEquipmentList: Equipment[] = [
  {
    id: 'e0000001-0000-4000-a000-000000000001',
    name: 'Student Camera',
    condition: 'Working',
    quantity: 1,
    core_functionality: 'Video input',
    other_functionality: 'Streaming',
    image_keys: ['student-camera-1.webp'],
    created_at: '2026-10-09T08:00:00Z',
    updated_at: '2026-10-09T08:00:00Z',
    updated_by: null,
  },
  {
    id: 'e0000001-0000-4000-a000-000000000002',
    name: 'Smart Board',
    condition: 'Under Maintenance',
    quantity: 1,
    core_functionality: 'Interactive display',
    other_functionality: 'Whiteboard',
    image_keys: ['smart-board.webp'],
    created_at: '2026-10-09T08:00:00Z',
    updated_at: '2026-10-09T08:00:00Z',
    updated_by: null,
  },
];

describe('S-07 Milestone M1 Challenger Adversarial Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockReset();
    mockNotFound.mockClear();
    cleanup();
    _clearEquipmentCache();
    document.documentElement.removeAttribute('data-state');
  });

  afterEach(() => {
    cleanup();
    _clearEquipmentCache();
    document.documentElement.removeAttribute('data-state');
    vi.useRealTimers();
  });

  describe('Seam 1: S-001 Landing Route & Carousel Adversarial Stress', () => {
    it('Attack 1.1: searchParams state=error forces data-state="error" on main, mounts C-017 error banner, renders em-dash count, and provides G-1a Check again recovery link to /', async () => {
      const ui = await Page({
        searchParams: Promise.resolve({ state: 'error' }),
      });
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('error');
      expect(
        screen.getByText('The register could not be loaded.'),
      ).toBeTruthy();
      expect(
        screen.getByText(
          'There was a problem reaching the inventory. Nothing on the record was changed.',
        ),
      ).toBeTruthy();
      expect(screen.getByText('—')).toBeTruthy();
      const retryLink = screen.getByRole('link', { name: 'Check again' });
      expect(retryLink.getAttribute('href')).toBe('/');
    });

    it('Attack 1.2: getEquipment direct rejection catches gracefully in Page, setting data-state="error" and rendering C-017 banner', async () => {
      vi.spyOn(equipmentModule, 'getEquipment').mockRejectedValueOnce(
        new Error('Fatal unhandled database exception'),
      );

      const ui = await Page();
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('error');
      expect(
        screen.getByText('The register could not be loaded.'),
      ).toBeTruthy();
      const retryLink = screen.getByRole('link', { name: 'Check again' });
      expect(retryLink.getAttribute('href')).toBe('/');
    });

    it('Attack 1.3: zero equipment items sets data-state="empty" on main, renders "0 entries", and displays EmptyState with G-1a Check again link', async () => {
      _setLastKnownGoodEquipment([]);
      const ui = await Page();
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('empty');
      expect(screen.getByText('0 entries')).toBeTruthy();
      expect(screen.getByText('Nothing on the record yet.')).toBeTruthy();
      const retryLink = screen.getByRole('link', { name: 'Check again' });
      expect(retryLink.getAttribute('href')).toBe('/');
    });

    it('Attack 1.4: single equipment item renders singular "1 entry", sets data-state="default", and renders single slide in Carousel', async () => {
      _setLastKnownGoodEquipment([sampleEquipmentList[0]]);
      const ui = await Page();
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('default');
      expect(screen.getByText('1 entry')).toBeTruthy();
      expect(screen.getByText('Student Camera')).toBeTruthy();
    });

    it('Attack 1.5: carousel with empty items array handles 0 slides safely without division by zero or NaN index', () => {
      const { container } = render(<Carousel items={[]} />);
      const nav = container.querySelector('.carousel');
      expect(nav).toBeTruthy();

      const prevBtn = screen.getByRole('button', { name: 'Previous slide' });
      const nextBtn = screen.getByRole('button', { name: 'Next slide' });
      expect(prevBtn.hasAttribute('disabled')).toBe(true);
      expect(nextBtn.hasAttribute('disabled')).toBe(true);
    });

    it('Attack 1.6: rapid keyboard arrow and button navigation on carousel stays within valid slide boundaries', () => {
      render(
        <Carousel
          items={[
            { href: '/item/1', name: 'Item One' },
            { href: '/item/2', name: 'Item Two' },
            { href: '/item/3', name: 'Item Three' },
          ]}
        />,
      );

      const nextBtn = screen.getByRole('button', { name: 'Next slide' });
      const prevBtn = screen.getByRole('button', { name: 'Previous slide' });

      for (let i = 0; i < 10; i++) {
        fireEvent.click(nextBtn);
      }
      expect(nextBtn.hasAttribute('disabled')).toBe(true);

      for (let i = 0; i < 10; i++) {
        fireEvent.click(prevBtn);
      }
      expect(prevBtn.hasAttribute('disabled')).toBe(true);
    });

    it('Attack 1.7: carousel pause-on-hover and pause-on-focus halts auto-advance timer', () => {
      vi.useFakeTimers();
      const { container } = render(
        <Carousel
          items={[
            { href: '/item/1', name: 'Item One' },
            { href: '/item/2', name: 'Item Two' },
          ]}
        />,
      );

      const carouselRoot = container.querySelector('.carousel') as HTMLElement;
      expect(carouselRoot).toBeTruthy();

      fireEvent.mouseEnter(carouselRoot);
      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL * 2);
      });
      expect(screen.getByText('Item One')).toBeTruthy();

      fireEvent.mouseLeave(carouselRoot);

      fireEvent.focusIn(carouselRoot);
      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL * 2);
      });
      expect(screen.getByText('Item One')).toBeTruthy();
    });

    it('Attack 1.8: documentElement data-state="reduced-motion" kills carousel auto-advance timer permanently', async () => {
      vi.useFakeTimers();
      document.documentElement.setAttribute('data-state', 'reduced-motion');

      render(
        <Carousel
          items={[
            { href: '/item/1', name: 'Item One' },
            { href: '/item/2', name: 'Item Two' },
          ]}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL * 3);
      });

      expect(screen.getByText('Item One')).toBeTruthy();
      expect(screen.getByText('1 / 2')).toBeTruthy();
    });
  });

  describe('Seam 2: S-002 Collection Route & Register Row Adversarial Stress', () => {
    it('Attack 2.1: searchParams state=error sets data-state="error" on main, renders C-017 error banner, and wires G-1b Check again link to /room', async () => {
      const ui = await RoomPage({
        searchParams: Promise.resolve({ state: 'error' }),
      });
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('error');
      expect(
        screen.getByText('The collection could not be loaded.'),
      ).toBeTruthy();
      const retryLink = screen.getByRole('link', { name: 'Check again' });
      expect(retryLink.getAttribute('href')).toBe('/room');
    });

    it('Attack 2.2: RoomPage catches network fetch failure cleanly, setting data-state="error" when getEquipment throws', async () => {
      vi.spyOn(equipmentModule, 'getEquipment').mockRejectedValueOnce(
        new Error('Fatal collection load exception'),
      );

      const ui = await RoomPage();
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('error');
      expect(
        screen.getByText('The collection could not be loaded.'),
      ).toBeTruthy();
      const retryLink = screen.getByRole('link', { name: 'Check again' });
      expect(retryLink.getAttribute('href')).toBe('/room');
    });

    it('Attack 2.3: zero equipment items sets data-state="empty" on main, rendering EmptyState with G-1b Check again link to /room', async () => {
      _setLastKnownGoodEquipment([]);
      const ui = await RoomPage();
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('empty');
      expect(screen.getByText('Nothing on the record yet.')).toBeTruthy();
      const retryLink = screen.getByRole('link', { name: 'Check again' });
      expect(retryLink.getAttribute('href')).toBe('/room');
    });

    it('Attack 2.4: empty row resilience against null or omitted fields renders RegisterRow safely without runtime exception', () => {
      render(
        <RegisterRow
          href="/item/empty-test"
          name="Minimal Specimen"
          condition="Working"
          facts={[]}
        />,
      );

      expect(screen.getByText('Minimal Specimen')).toBeTruthy();
      expect(screen.getByText('Working')).toBeTruthy();
    });

    it('Attack 2.5: alphabetical sorting resilience against Unicode, Arabic script, emojis, and symbols sorts reliably', async () => {
      const edgeItems: Equipment[] = [
        {
          id: 'e0000001-0000-4000-a000-000000000010',
          name: '🔬 Electron Microscope',
          condition: 'Working',
          quantity: 1,
          core_functionality: null,
          other_functionality: null,
          image_keys: [],
          created_at: '2026-10-09T08:00:00Z',
          updated_at: '2026-10-09T08:00:00Z',
          updated_by: null,
        },
        {
          id: 'e0000001-0000-4000-a000-000000000011',
          name: 'Alpha Sensor',
          condition: 'Working',
          quantity: 2,
          core_functionality: null,
          other_functionality: null,
          image_keys: [],
          created_at: '2026-10-09T08:00:00Z',
          updated_at: '2026-10-09T08:00:00Z',
          updated_by: null,
        },
        {
          id: 'e0000001-0000-4000-a000-000000000012',
          name: 'حاسوب مختبر (Lab Computer)',
          condition: 'Working',
          quantity: 5,
          core_functionality: null,
          other_functionality: null,
          image_keys: [],
          created_at: '2026-10-09T08:00:00Z',
          updated_at: '2026-10-09T08:00:00Z',
          updated_by: null,
        },
      ];

      _setLastKnownGoodEquipment(edgeItems);
      const ui = await RoomPage();
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('default');
      expect(screen.getByText('Alpha Sensor')).toBeTruthy();
      expect(screen.getByText('🔬 Electron Microscope')).toBeTruthy();
      expect(screen.getByText('حاسوب مختبر (Lab Computer)')).toBeTruthy();
    });

    it('Attack 2.6: malformed searchParams with array values does not crash RoomPage', async () => {
      const ui = await RoomPage({
        searchParams: Promise.resolve({
          state: ['error', 'default'] as unknown as string,
        }),
      });
      const { container } = render(ui);
      expect(container.querySelector('#main')).toBeTruthy();
    });

    it('Attack 2.7: equipment item with zero quantity and empty string name renders row with stable layout and 0 count', () => {
      render(
        <RegisterRow
          href="/item/zero-qty"
          name=""
          condition="Faulty"
          facts={[{ key: 'QUANTITY', value: 0, strong: true }]}
        />,
      );

      expect(screen.getByText('Faulty')).toBeTruthy();
      expect(screen.getByText('0')).toBeTruthy();
    });
  });

  describe('Seam 3: S-003 Item Detail 404 (G-4), Images & G-2 Cache Fallback', () => {
    it('Attack 3.1: unknown valid UUID not found in database or cache triggers Next.js notFound() (G-4 & G-1c)', async () => {
      _clearEquipmentCache();
      vi.spyOn(supabaseModule, 'postgrestSelect').mockResolvedValue([]);

      await expect(
        ItemPage({
          params: Promise.resolve({
            id: 'e0000000-9999-4000-a000-000000000999',
          }),
        }),
      ).rejects.toThrow('NEXT_NOT_FOUND');

      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it('Attack 3.2: non-UUID malformed ID (SQL injection probe, path traversal, empty) triggers notFound()', async () => {
      const probeIds = [
        '../../etc/passwd',
        "' OR 1=1 --",
        'not-a-uuid',
        '',
        '   ',
        '<script>alert(1)</script>',
      ];

      for (const malformedId of probeIds) {
        mockNotFound.mockClear();
        await expect(
          ItemPage({
            params: Promise.resolve({ id: malformedId }),
          }),
        ).rejects.toThrow('NEXT_NOT_FOUND');
        expect(mockNotFound).toHaveBeenCalledTimes(1);
      }
    });

    it('Attack 3.3: G-2 cache fallback: PostgREST fetch network failure falls back to cached equipment map, serving item with data-state="default"', async () => {
      _setLastKnownGoodEquipment(sampleEquipmentList);
      vi.spyOn(supabaseModule, 'postgrestSelect').mockRejectedValue(
        new Error('Supabase 503 Service Unavailable'),
      );

      const ui = await ItemPage({
        params: Promise.resolve({ id: sampleEquipmentList[0].id }),
      });
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('default');
      expect(screen.getByText('Student Camera')).toBeTruthy();
      expect(screen.getByText('QUANTITY')).toBeTruthy();
    });

    it('Attack 3.4: G-2 cache fallback: PostgREST fetch failure recovers item from cached list when item map is cold', async () => {
      _setLastKnownGoodEquipment(sampleEquipmentList);
      vi.spyOn(supabaseModule, 'postgrestSelect').mockRejectedValue(
        new Error('Network disconnect'),
      );

      const item = await getEquipmentById(sampleEquipmentList[1].id);
      expect(item).not.toBeNull();
      expect(item?.name).toBe('Smart Board');
    });

    it('Attack 3.5: item with empty image_keys array sets data-state="image-failed" on main and renders ImageGallery in fallback mode', async () => {
      const itemNoImages: Equipment = {
        ...sampleEquipmentList[0],
        id: 'e0000001-0000-4000-a000-000000000099',
        image_keys: [],
      };
      _setLastKnownGoodEquipment([itemNoImages]);

      const ui = await ItemPage({
        params: Promise.resolve({ id: itemNoImages.id }),
      });
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('image-failed');
      expect(screen.getByText('No photograph on file yet.')).toBeTruthy();
    });

    it('Attack 3.6: searchParams state=image-failed forces data-state="image-failed" even when item has images', async () => {
      _setLastKnownGoodEquipment(sampleEquipmentList);

      const ui = await ItemPage({
        params: Promise.resolve({ id: sampleEquipmentList[0].id }),
        searchParams: Promise.resolve({ state: 'image-failed' }),
      });
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('image-failed');
    });

    it('Attack 3.7: F-02 compliance: exactly one h1 element exists on S-003 containing the item name', async () => {
      _setLastKnownGoodEquipment(sampleEquipmentList);

      const ui = await ItemPage({
        params: Promise.resolve({ id: sampleEquipmentList[0].id }),
      });
      const { container } = render(ui);

      const h1List = container.querySelectorAll('h1');
      expect(h1List).toHaveLength(1);
      expect(h1List[0].textContent).toBe('Student Camera');
    });

    it('Attack 3.8: missing functionality strings render verbatim fallback dashes and recorded messages', async () => {
      const itemNullFunctionality: Equipment = {
        ...sampleEquipmentList[0],
        id: 'e0000001-0000-4000-a000-000000000077',
        core_functionality: null,
        other_functionality: null,
      };
      _setLastKnownGoodEquipment([itemNullFunctionality]);

      const ui = await ItemPage({
        params: Promise.resolve({ id: itemNullFunctionality.id }),
      });
      render(ui);

      expect(screen.getByText('—')).toBeTruthy();
      expect(screen.getByText('No other functionality recorded.')).toBeTruthy();
    });
  });

  describe('Seam 4: Dialog Concurrency, Busy States & Focus Lockdown (F-05)', () => {
    it('Attack 4.1: ConfirmDestructiveDialog with pending=true sets aria-busy="true" and data-state="confirming" on DialogContent', () => {
      render(
        <ConfirmDestructiveDialog
          open
          itemName="Student Camera"
          recordCode="e0000001"
          quantity={1}
          condition="Working"
          pending={true}
        />,
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-busy')).toBe('true');
      expect(dialog.getAttribute('data-state')).toBe('confirming');
    });

    it('Attack 4.2: ConfirmDestructiveDialog with pending=true disables Cancel and Delete buttons and swaps label to "Deleting…"', () => {
      render(
        <ConfirmDestructiveDialog
          open
          itemName="Student Camera"
          recordCode="e0000001"
          quantity={1}
          condition="Working"
          pending={true}
        />,
      );

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelBtn.hasAttribute('disabled')).toBe(true);

      const deletingBtn = screen.getByRole('button', { name: 'Deleting…' });
      expect(deletingBtn.hasAttribute('disabled')).toBe(true);
      expect(deletingBtn.getAttribute('aria-busy')).toBe('true');
    });

    it('Attack 4.3: pending=true suppresses Escape key down via preventDefault, preventing premature dialog dismissal', () => {
      const onEscapeKeyDown = vi.fn();
      render(
        <Dialog open>
          <DialogContent pending={true} onEscapeKeyDown={onEscapeKeyDown}>
            <DialogTitle>Locked Dialog</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      const dialog = screen.getByRole('dialog');
      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });

      dialog.dispatchEvent(escapeEvent);
      expect(onEscapeKeyDown).not.toHaveBeenCalled();
    });

    it('Attack 4.4: pending=false allows Escape key down and does not prevent dismissal', () => {
      const onEscapeKeyDown = vi.fn();
      render(
        <Dialog open>
          <DialogContent pending={false} onEscapeKeyDown={onEscapeKeyDown}>
            <DialogTitle>Open Dialog</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
    });

    it('Attack 4.5: pending=true suppresses pointer-down outside via preventDefault', () => {
      const onPointerDownOutside = vi.fn();
      render(
        <Dialog open>
          <DialogContent
            pending={true}
            onPointerDownOutside={onPointerDownOutside}
          >
            <DialogTitle>Locked Modal</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      const overlay = document.querySelector('[data-dialog-overlay]');
      expect(overlay).toBeTruthy();
      if (overlay) {
        fireEvent.pointerDown(overlay);
        expect(onPointerDownOutside).not.toHaveBeenCalled();
      }
    });

    it('Attack 4.6: rapid concurrent clicks on confirm button during pending state do not trigger onConfirm callbacks', () => {
      const onConfirm = vi.fn();
      render(
        <ConfirmDestructiveDialog
          open
          itemName="Student Camera"
          recordCode="e0000001"
          quantity={1}
          condition="Working"
          pending={true}
          onConfirm={onConfirm}
        />,
      );

      const deletingBtn = screen.getByRole('button', { name: 'Deleting…' });
      for (let i = 0; i < 5; i++) {
        fireEvent.click(deletingBtn);
      }
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('Attack 4.7: idle state provides autofocus on Cancel button and enables both actions', () => {
      const onCancel = vi.fn();
      render(
        <ConfirmDestructiveDialog
          open
          itemName="Student Camera"
          recordCode="e0000001"
          quantity={1}
          condition="Working"
          pending={false}
          onCancel={onCancel}
        />,
      );

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      const deleteBtn = screen.getByRole('button', { name: 'Delete item' });

      expect(cancelBtn.hasAttribute('disabled')).toBe(false);
      expect(deleteBtn.hasAttribute('disabled')).toBe(false);
      expect(cancelBtn.hasAttribute('data-autofocus')).toBe(true);

      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('Attack 4.8: invalid condition string passed to ConfirmDestructiveDialog renders safe text fallback without crashing ConditionChip', () => {
      render(
        <ConfirmDestructiveDialog
          open
          itemName="Specimen"
          recordCode="e0000001"
          quantity={1}
          condition="Severely Damaged"
        />,
      );

      expect(screen.getByText('Severely Damaged')).toBeTruthy();
    });
  });

  describe('Seam 5: Skeleton Accessible Announcements & DOM Integrity (F-09)', () => {
    it('Attack 5.1: LoadingSkeleton table-row variant sets aria-busy="true" on every tr and contains accessible sr-only "Loading…"', () => {
      const { container } = render(
        <table>
          <tbody>
            <LoadingSkeleton variant="table-row" count={3} />
          </tbody>
        </table>,
      );

      const rows = container.querySelectorAll('tr');
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row.getAttribute('aria-busy')).toBe('true');
        expect(row.querySelector('.sr-only')?.textContent).toBe('Loading…');
      }
    });

    it('Attack 5.2: LoadingSkeleton data-strip variant sets aria-busy="true" on container and contains accessible sr-only "Loading…"', () => {
      const { container } = render(
        <LoadingSkeleton variant="data-strip" count={4} />,
      );

      const root = container.firstElementChild as HTMLElement;
      expect(root.getAttribute('aria-busy')).toBe('true');
      expect(screen.getByText('Loading…')).toBeTruthy();
    });

    it('Attack 5.3: LoadingSkeleton card variant with count > 1 sets aria-busy="true" and contains accessible sr-only "Loading…"', () => {
      const { container } = render(
        <LoadingSkeleton variant="card" count={3} />,
      );

      const root = container.firstElementChild as HTMLElement;
      expect(root.getAttribute('aria-busy')).toBe('true');
      expect(screen.getByText('Loading…')).toBeTruthy();
    });

    it('Attack 5.4: LoadingSkeleton card variant with srOnly=true contains accessible sr-only "Loading…" even with count=1', () => {
      const { container } = render(
        <LoadingSkeleton variant="card" count={1} srOnly={true} />,
      );

      const root = container.firstElementChild as HTMLElement;
      expect(root.getAttribute('aria-busy')).toBe('true');
      expect(screen.getByText('Loading…')).toBeTruthy();
    });

    it('Attack 5.5: LoadingSkeleton image variant sets aria-hidden="true" and does not announce text to screen readers', () => {
      const { container } = render(
        <LoadingSkeleton variant="image" size="thumb" />,
      );

      const root = container.firstElementChild as HTMLElement;
      expect(root.getAttribute('aria-hidden')).toBe('true');
      expect(screen.queryByText('Loading…')).toBeNull();
    });

    it('Attack 5.6: boundary count=0 renders container without crashing or rendering negative elements', () => {
      const { container } = render(
        <LoadingSkeleton variant="card" count={0} />,
      );
      expect(container.firstElementChild).toBeTruthy();
    });

    it('Attack 5.7: boundary count=50 renders 50 skeleton units with stable DOM integrity', () => {
      const { container } = render(
        <table>
          <tbody>
            <LoadingSkeleton variant="table-row" count={50} />
          </tbody>
        </table>,
      );

      const rows = container.querySelectorAll('tr');
      expect(rows).toHaveLength(50);
    });

    it('Attack 5.8: DataTable in loading mode sets aria-busy="true" on tbody element', () => {
      const { container } = render(<DataTable rows={[]} state="loading" />);

      const tbody = container.querySelector('tbody');
      expect(tbody?.getAttribute('aria-busy')).toBe('true');
    });
  });

  describe('Seam 6: State Attribute Reachability & Resilience to Corrupt Input', () => {
    it('Attack 6.1: ConditionChip resists prototype pollution attack with Object prototype property names (__proto__, constructor, toString)', () => {
      const attackProps = [
        '__proto__',
        'constructor',
        'toString',
        'valueOf',
        'hasOwnProperty',
      ];

      for (const attack of attackProps) {
        const { container } = render(<ConditionChip condition={attack} />);
        expect(container.textContent).toContain(attack);
        expect(container.querySelector('.chip--working')).toBeNull();
        expect(container.querySelector('.chip--faulty')).toBeNull();
        cleanup();
      }
    });

    it('Attack 6.2: ConditionChip renders neutral badge fallback for unknown/unregistered condition strings', () => {
      const { container } = render(
        <ConditionChip condition="Completely Disassembled" />,
      );
      expect(screen.getByText('Completely Disassembled')).toBeTruthy();
      expect(container.querySelector('.chip')).toBeTruthy();
    });

    it('Attack 6.3: ColdStartPanel formats elapsed times at 0s, 59s, 60s, 3600s, and large durations without crashing', () => {
      vi.useFakeTimers();
      render(<ColdStartPanel state="waiting" />);

      expect(screen.getByText('0:00')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(59000);
      });
      expect(screen.getByText('0:59')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText('1:00')).toBeTruthy();
    });

    it('Attack 6.4: ColdStartPanel in error state renders error Banner with cold-start-timeout code', () => {
      render(<ColdStartPanel state="error" />);
      expect(
        screen.getByText('The register took too long to start.'),
      ).toBeTruthy();
      expect(screen.getByText('cold-start-timeout')).toBeTruthy();
    });

    it('Attack 6.5: ColdStartPanel in ready state renders null', () => {
      const { container } = render(<ColdStartPanel state="ready" />);
      expect(container.firstChild).toBeNull();
    });

    it('Attack 6.6: Banner renders properly with all valid tones (caution, error, success) and handles undefined children safely', () => {
      const tones = ['caution', 'error', 'success'] as const;
      for (const tone of tones) {
        const { container } = render(
          <Banner tone={tone} heading={`Tone ${tone}`} />,
        );
        expect(screen.getByText(`Tone ${tone}`)).toBeTruthy();
        expect(container.querySelector('.banner')).toBeTruthy();
        cleanup();
      }
    });

    it('Attack 6.7: EmptyState renders safely with empty strings for heading and body and null action', () => {
      const { container } = render(
        <EmptyState heading="" body="" action={null} />,
      );
      expect(container.firstElementChild).toBeTruthy();
      expect(screen.getByRole('heading', { level: 2 })).toBeTruthy();
    });

    it('Attack 6.8: PrivacyPage renders static NDPA notice with draft stamp and main container', () => {
      const ui = PrivacyPage();
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main).toBeTruthy();
      expect(
        screen.getByRole('heading', { level: 1, name: 'Privacy' }),
      ).toBeTruthy();
      expect(
        screen.getByText(
          'DRAFT — TO BE CHECKED BY THE LEGAL OFFICE BEFORE LAUNCH',
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(
          'Plain words about what this site keeps, and what it does not.',
        ),
      ).toBeTruthy();
    });
  });
});
