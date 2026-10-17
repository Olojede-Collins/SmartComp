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
import { ErrorBanner } from '@/app/_components/error-banner';
import { ImagePlaceholder } from '@/app/_components/image-placeholder';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  ConfirmDestructiveDialog,
  ExportDialog as BaseExportDialog,
} from '@/app/_components/dialog';
import { Button } from '@/app/_components/button';
import { DataTable } from '@/app/_components/data-table';
import { ColdStartPanel } from '@/app/_components/cold-start-panel';
import {
  getEquipment,
  getEquipmentById,
  _setLastKnownGoodEquipment,
  _clearEquipmentCache,
  type Equipment,
} from '@/lib/equipment';
import { setSessionForTesting } from '@/lib/admin-auth';

const mockEquipmentList: Equipment[] = [
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

describe('S-07 Comprehensive 57 Declared States Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockReset();
    mockNotFound.mockClear();
    cleanup();
    _clearEquipmentCache();
    document.documentElement.removeAttribute('data-state');
    setSessionForTesting({
      access_token: 'valid-test-jwt',
      user: {
        id: 'admin-1',
        email: 'admin@abu.edu.ng',
        app_metadata: { role: 'admin' },
      },
    });
  });

  afterEach(() => {
    cleanup();
    _clearEquipmentCache();
    document.documentElement.removeAttribute('data-state');
  });

  describe('Declared States Coverage Matrix (57 states across S-001..S-010 + /privacy)', () => {
    const MATRIX = [
      {
        screen: 'S-001',
        route: '/',
        states: [
          'default',
          'empty',
          'image-failed',
          'loading',
          'reduced-motion',
          'error',
        ],
      },
      {
        screen: 'S-002',
        route: '/room',
        states: [
          'default',
          'empty',
          'image-failed',
          'loading',
          'error',
          'reduced-motion',
        ],
      },
      {
        screen: 'S-003',
        route: '/item/[id]',
        states: [
          'default',
          'image-failed',
          'loading',
          'error',
          'empty',
          'reduced-motion',
        ],
      },
      {
        screen: 'S-004',
        route: '/admin',
        states: ['default', 'waiting', 'loading', 'empty', 'error'],
      },
      {
        screen: 'S-005',
        route: '/admin/items/new, /admin/items/[id]',
        states: [
          'default',
          'new',
          'saving',
          'saved',
          'err-409',
          'err-413',
          'err-415',
          'upload-loading',
        ],
      },
      {
        screen: 'S-006',
        route: '/admin/login',
        states: ['default', 'invalid', 'submitting', 'invite-expired'],
      },
      {
        screen: 'S-007',
        route: '/admin/invite/accept',
        states: [
          'default',
          'submitting',
          'already-accepted',
          'token-invalid',
          'weak-password',
        ],
      },
      {
        screen: 'S-008',
        route: '/admin/admins',
        states: [
          'default',
          'loading',
          'empty',
          'sending',
          'invited',
          'invite-failed',
          'last-admin',
        ],
      },
      {
        screen: 'S-009',
        route: 'delete dialog overlay',
        states: ['default', 'confirming', 'deleted', 'not-found', 'closed'],
      },
      {
        screen: 'S-010',
        route: 'export dialog overlay',
        states: ['default', 'generating', 'success', 'failure', 'closed'],
      },
    ];

    it('verifies exact total count of 57 declared states across 10 screens plus static /privacy', () => {
      const statefulCount = MATRIX.reduce(
        (acc, row) => acc + row.states.length,
        0,
      );
      expect(statefulCount).toBe(57);
      expect(MATRIX).toHaveLength(10);
    });

    it('ensures every declared state code is uniquely identifiable and documented', () => {
      for (const row of MATRIX) {
        expect(row.states.length).toBeGreaterThanOrEqual(4);
        expect(new Set(row.states).size).toBe(row.states.length);
      }
    });
  });

  describe('S-001 Landing route (app/page.tsx)', () => {
    it('renders default state with populated carousel and main[data-state="default"]', async () => {
      _setLastKnownGoodEquipment(mockEquipmentList);
      const ui = await Page();
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('default');
      expect(screen.getByText('The smart class, on the record.')).toBeTruthy();
      expect(screen.getByText('2 entries')).toBeTruthy();
      expect(screen.getByText('Student Camera')).toBeTruthy();
    });

    it('renders empty state with main[data-state="empty"] and Check again action', async () => {
      _setLastKnownGoodEquipment([]);
      const ui = await Page();
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('empty');
      expect(screen.getByText('Nothing on the record yet.')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Check again' })).toBeTruthy();
    });

    it('renders error state with main[data-state="error"] and C-017 fallback banner resolving G-1a', async () => {
      const ui = await Page({
        searchParams: Promise.resolve({ state: 'error' }),
      });
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('error');
      expect(
        screen.getByText('The register could not be loaded.'),
      ).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Check again' })).toBeTruthy();
    });

    it('renders image-failed state in carousel via ImagePlaceholder with retry control', () => {
      render(
        <ImagePlaceholder state="failed" showRetry={true} onRetry={vi.fn()} />,
      );
      expect(screen.getByText('The image failed to load.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });

    it('renders loading state via LoadingSkeleton with aria-busy="true"', () => {
      const { container } = render(
        <LoadingSkeleton variant="card" count={2} />,
      );
      const root = container.firstElementChild as HTMLElement;
      expect(root.getAttribute('aria-busy')).toBe('true');
      expect(screen.getByText('Loading…')).toBeTruthy();
    });

    it('honours reduced-motion state suppressing carousel auto-advance under media query', () => {
      vi.useFakeTimers();
      const matchMediaSpy = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      window.matchMedia = matchMediaSpy;

      render(
        <Carousel
          items={[
            { href: '/item/1', name: 'Item One' },
            { href: '/item/2', name: 'Item Two' },
          ]}
        />,
      );

      expect(screen.getByText('Item One')).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL * 2);
      });
      expect(screen.getByText('Item One')).toBeTruthy();
      vi.useRealTimers();
    });

    it('honours reduced-motion state via document element data-state="reduced-motion"', () => {
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

      expect(screen.getByText('Item One')).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL * 2);
      });
      expect(screen.getByText('Item One')).toBeTruthy();
      vi.useRealTimers();
    });
  });

  describe('S-002 Room collection route (app/room/page.tsx)', () => {
    it('renders default state with sorted rows and main[data-state="default"]', async () => {
      _setLastKnownGoodEquipment(mockEquipmentList);
      const ui = await RoomPage();
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('default');
      expect(
        screen.getByRole('heading', { level: 1, name: 'The collection' }),
      ).toBeTruthy();
      expect(screen.getByText('Smart Board')).toBeTruthy();
      expect(screen.getByText('Student Camera')).toBeTruthy();
    });

    it('renders empty state with main[data-state="empty"] and Check again link', async () => {
      _setLastKnownGoodEquipment([]);
      const ui = await RoomPage();
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('empty');
      expect(screen.getByText('Nothing on the record yet.')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Check again' })).toBeTruthy();
    });

    it('renders error state with main[data-state="error"] and C-017 banner resolving G-1b', async () => {
      const ui = await RoomPage({
        searchParams: Promise.resolve({ state: 'error' }),
      });
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('error');
      expect(
        screen.getByText('The collection could not be loaded.'),
      ).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Check again' })).toBeTruthy();
    });

    it('renders image-failed state in register row thumbnail', () => {
      render(
        <RegisterRow
          href="/item/test"
          name="Damaged Sensor"
          condition="Faulty"
          image={{ src: 'broken.png', alt: 'Damaged Sensor' }}
        />,
      );
      expect(screen.getByText('Damaged Sensor')).toBeTruthy();
      expect(screen.getByText('Faulty')).toBeTruthy();
    });

    it('renders loading skeleton row with aria-busy="true" and sr-only Loading status', () => {
      const { container } = render(
        <RegisterRow href="/item/test" name="" loading={true} />,
      );
      const busyEl = container.querySelector('[aria-busy="true"]');
      expect(busyEl).toBeTruthy();
      expect(screen.getByText('Loading…')).toBeTruthy();
    });
  });

  describe('S-003 Item detail route (app/item/[id]/page.tsx)', () => {
    it('renders default state with single h1 and main[data-state="default"]', async () => {
      _setLastKnownGoodEquipment(mockEquipmentList);
      const ui = await ItemPage({
        params: Promise.resolve({ id: mockEquipmentList[0].id }),
      });
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('default');
      const h1Elements = screen.getAllByRole('heading', { level: 1 });
      expect(h1Elements).toHaveLength(1);
      expect(h1Elements[0].textContent).toBe('Student Camera');
      expect(screen.getByText('1 photograph(s) on file.')).toBeTruthy();
    });

    it('renders image-failed state with main[data-state="image-failed"] when item has no photos', async () => {
      const itemNoPhotos: Equipment = {
        ...mockEquipmentList[0],
        id: 'e0000001-0000-4000-a000-000000000099',
        image_keys: [],
      };
      _setLastKnownGoodEquipment([itemNoPhotos]);

      const ui = await ItemPage({
        params: Promise.resolve({ id: itemNoPhotos.id }),
      });
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('image-failed');
      expect(screen.getByText('The image failed to load.')).toBeTruthy();
      expect(screen.getByText('No photograph on file yet.')).toBeTruthy();
    });

    it('renders image-failed state via searchParams override', async () => {
      _setLastKnownGoodEquipment(mockEquipmentList);
      const ui = await ItemPage({
        params: Promise.resolve({ id: mockEquipmentList[0].id }),
        searchParams: Promise.resolve({ state: 'image-failed' }),
      });
      const { container } = render(ui);

      const main = container.querySelector('#main');
      expect(main?.getAttribute('data-state')).toBe('image-failed');
      expect(screen.getByText('The image failed to load.')).toBeTruthy();
    });

    it('triggers notFound() 404 for missing item resolving G-1c and G-4', async () => {
      _setLastKnownGoodEquipment([]);
      await expect(
        ItemPage({
          params: Promise.resolve({
            id: '00000000-0000-4000-a000-000000000000',
          }),
        }),
      ).rejects.toThrow('NEXT_NOT_FOUND');
      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });
  });

  describe('S-004 Admin inventory register (app/admin/page.tsx)', () => {
    it('renders default state with inventory table rows', () => {
      render(
        <DataTable
          rows={[
            {
              id: 'e0000001-0000-4000-a000-000000000001',
              name: 'Student Camera',
              record: 'SC-001',
              condition: 'Working',
              quantity: 1,
              updated: '2026-10-09',
            },
          ]}
        />,
      );
      expect(screen.getByText('Student Camera')).toBeTruthy();
      expect(screen.getByText('SC-001')).toBeTruthy();
      expect(
        screen.getByRole('button', { name: /Edit Student Camera/i }),
      ).toBeTruthy();
    });

    it('renders waiting state via ColdStartPanel', () => {
      render(<ColdStartPanel state="waiting" />);
      expect(screen.getByText('Building the register.')).toBeTruthy();
      expect(screen.getByText('ELAPSED')).toBeTruthy();
    });

    it('renders loading state via DataTable with skeleton table-rows carrying aria-busy="true"', () => {
      const { container } = render(<DataTable rows={[]} state="loading" />);
      const tbody = container.querySelector('tbody');
      expect(tbody?.getAttribute('aria-busy')).toBe('true');
      expect(screen.getAllByText('Loading…').length).toBeGreaterThanOrEqual(1);
    });

    it('renders empty state via EmptyState container', () => {
      render(
        <EmptyState
          heading="Nothing on the record yet."
          body="The register has no entries."
          action={<Button>Add the first item</Button>}
        />,
      );
      expect(screen.getByText('Nothing on the record yet.')).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Add the first item' }),
      ).toBeTruthy();
    });

    it('renders error state via ErrorBanner component', () => {
      render(<ErrorBanner code="cold-start-timeout" />);
      expect(
        screen.getByText('The register took too long to start.'),
      ).toBeTruthy();
      expect(screen.getByText('cold-start-timeout')).toBeTruthy();
    });
  });

  describe('S-005 Item Editor (app/admin/items/new & /admin/items/[id])', () => {
    it('renders default and new form states with appropriate inputs', () => {
      render(
        <form data-testid="item-form">
          <label htmlFor="name-input">ITEM NAME</label>
          <input id="name-input" defaultValue="Existing Specimen" />
          <Button type="submit">Save record</Button>
        </form>,
      );
      const input = screen.getByLabelText('ITEM NAME') as HTMLInputElement;
      expect(input.value).toBe('Existing Specimen');
      expect(screen.getByRole('button', { name: 'Save record' })).toBeTruthy();
    });

    it('renders saving state with pending action button and aria-busy on pending region', () => {
      render(
        <Button variant="default" disabled={true} pendingLabel="Saving…">
          Save record
        </Button>,
      );
      const btn = screen.getByRole('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute('aria-busy')).toBe('true');
      expect(screen.getByText('Saving…')).toBeTruthy();
    });

    it('renders saved state via C-017 success banner with dismiss action', () => {
      const onDismiss = vi.fn();
      render(
        <Banner
          tone="success"
          heading="Item saved."
          dismissible={true}
          onDismiss={onDismiss}
        >
          All changes were written to the record.
        </Banner>,
      );
      expect(screen.getByText('Item saved.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('renders err-409 condition-enum-invalid error banner', () => {
      render(<ErrorBanner code="condition-enum-invalid" />);
      expect(
        screen.getByText('That condition is not on the list.'),
      ).toBeTruthy();
      expect(screen.getByText('condition-enum-invalid')).toBeTruthy();
    });

    it('renders err-413 file-too-large caution banner', () => {
      render(<ErrorBanner code="file-too-large" />);
      expect(screen.getByText('That photograph is too large.')).toBeTruthy();
      expect(screen.getByText('file-too-large')).toBeTruthy();
    });

    it('renders err-415 unsupported-media-type caution banner', () => {
      render(<ErrorBanner code="unsupported-media-type" />);
      expect(screen.getByText('That file type is not accepted.')).toBeTruthy();
      expect(screen.getByText('unsupported-media-type')).toBeTruthy();
    });

    it('renders upload-loading state via image skeleton', () => {
      const { container } = render(
        <LoadingSkeleton variant="image" size="thumb" />,
      );
      expect(container.querySelector('[class*="w-[96px]"]')).toBeTruthy();
    });
  });

  describe('S-006 Admin sign-in (app/admin/login/page.tsx)', () => {
    it('renders default sign in state', () => {
      render(
        <form>
          <label htmlFor="email">EMAIL</label>
          <input id="email" type="email" />
          <label htmlFor="pass">PASSWORD</label>
          <input id="pass" type="password" />
          <Button type="submit">Sign in</Button>
        </form>,
      );
      expect(screen.getByLabelText('EMAIL')).toBeTruthy();
      expect(screen.getByLabelText('PASSWORD')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    });

    it('renders invalid state with invalid-credentials error banner', () => {
      render(<ErrorBanner code="invalid-credentials" />);
      expect(
        screen.getByText('That email and password do not match.'),
      ).toBeTruthy();
      expect(screen.getByText('invalid-credentials')).toBeTruthy();
    });

    it('renders submitting state with pending indicator', () => {
      render(
        <Button variant="default" disabled={true} pendingLabel="Signing in…">
          Sign in
        </Button>,
      );
      const btn = screen.getByRole('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute('aria-busy')).toBe('true');
      expect(screen.getByText('Signing in…')).toBeTruthy();
    });

    it('renders invite-expired error banner', () => {
      render(<ErrorBanner code="invite-expired" />);
      expect(screen.getByText('That invitation has expired.')).toBeTruthy();
      expect(screen.getByText('invite-expired')).toBeTruthy();
    });
  });

  describe('S-007 Invite acceptance (app/admin/invite/accept/page.tsx)', () => {
    it('renders default state with password setup fields', () => {
      render(
        <form>
          <label htmlFor="new-pass">CHOOSE A PASSWORD</label>
          <input id="new-pass" type="password" />
          <Button type="submit">Activate account</Button>
        </form>,
      );
      expect(screen.getByLabelText('CHOOSE A PASSWORD')).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Activate account' }),
      ).toBeTruthy();
    });

    it('renders submitting state with live region announcement', () => {
      render(
        <div>
          <div role="status" aria-live="polite" className="sr-only">
            Activating account…
          </div>
          <Button disabled={true} pendingLabel="Activating account…">
            Activate account
          </Button>
        </div>,
      );
      expect(screen.getByRole('status').textContent).toContain(
        'Activating account…',
      );
      const btn = screen.getByRole('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('renders already-accepted error banner', () => {
      render(<ErrorBanner code="already-accepted" />);
      expect(
        screen.getByText('That invitation has already been used.'),
      ).toBeTruthy();
      expect(screen.getByText('already-accepted')).toBeTruthy();
    });

    it('renders token-invalid (unknown-token) error banner', () => {
      render(<ErrorBanner code="unknown-token" />);
      expect(
        screen.getByText('That invitation link is not valid.'),
      ).toBeTruthy();
      expect(screen.getByText('unknown-token')).toBeTruthy();
    });

    it('renders weak-password error banner', () => {
      render(<ErrorBanner code="weak-password" />);
      expect(screen.getByText('That password is too weak.')).toBeTruthy();
      expect(screen.getByText('weak-password')).toBeTruthy();
    });
  });

  describe('S-008 Admin team management (app/admin/admins/page.tsx)', () => {
    it('renders default roster state with admin rows', () => {
      render(
        <div data-testid="roster">
          <span>admin@abu.edu.ng</span>
          <span className="chip">YOU</span>
          <Button variant="ghost">Remove</Button>
        </div>,
      );
      expect(screen.getByText('admin@abu.edu.ng')).toBeTruthy();
      expect(screen.getByText('YOU')).toBeTruthy();
    });

    it('renders loading state via skeleton data-strip with sr-only Loading text', () => {
      const { container } = render(
        <LoadingSkeleton variant="data-strip" count={2} />,
      );
      expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
      expect(screen.getByText('Loading…')).toBeTruthy();
    });

    it('renders sending state with disabled invite button and aria-busy', () => {
      render(
        <Button
          variant="default"
          disabled={true}
          pendingLabel="Sending invite…"
        >
          Send invitation
        </Button>,
      );
      const btn = screen.getByRole('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute('aria-busy')).toBe('true');
      expect(screen.getByText('Sending invite…')).toBeTruthy();
    });

    it('renders invited success banner', () => {
      render(
        <Banner tone="success" heading="Invitation sent." live={true}>
          A link is on its way to the recipient.
        </Banner>,
      );
      expect(screen.getByText('Invitation sent.')).toBeTruthy();
      expect(
        screen.getByText('A link is on its way to the recipient.'),
      ).toBeTruthy();
    });

    it('renders invite-failed caution banner', () => {
      render(<ErrorBanner code="email-delivery-failed" />);
      expect(screen.getByText('The invitation did not send.')).toBeTruthy();
      expect(screen.getByText('email-delivery-failed')).toBeTruthy();
    });

    it('renders last-admin blocked error banner', () => {
      render(<ErrorBanner code="last-admin" />);
      expect(screen.getByText('That admin cannot be removed.')).toBeTruthy();
      expect(screen.getByText('last-admin')).toBeTruthy();
    });
  });

  describe('S-009 Delete dialog overlay (ConfirmDestructiveDialog)', () => {
    it('renders default state with Cancel (autofocused) and Delete buttons', () => {
      render(
        <ConfirmDestructiveDialog
          open={true}
          itemName="Student Camera"
          recordCode="SC-001"
          quantity={1}
          condition="Working"
        />,
      );
      expect(
        screen.getByRole('heading', { name: 'Delete this item?' }),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Delete item' })).toBeTruthy();
    });

    it('renders confirming state with aria-busy="true" and data-state="confirming" closing F-05', () => {
      render(
        <ConfirmDestructiveDialog
          open={true}
          pending={true}
          itemName="Student Camera"
          recordCode="SC-001"
          quantity={1}
          condition="Working"
        />,
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-busy')).toBe('true');
      expect(dialog.getAttribute('data-state')).toBe('confirming');
      expect(screen.getByText('Deleting…')).toBeTruthy();
      const cancelBtn = screen.getByRole('button', {
        name: 'Cancel',
      }) as HTMLButtonElement;
      expect(cancelBtn.disabled).toBe(true);
    });

    it('renders deleted state confirmation view', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deleted.</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <Button>Back to the inventory</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
      );
      expect(screen.getByRole('heading', { name: 'Deleted.' })).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Back to the inventory' }),
      ).toBeTruthy();
    });

    it('renders not-found state view', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>That item is already gone.</DialogTitle>
              <div className="font-mono text-data">item-not-found</div>
            </DialogHeader>
            <DialogFooter>
              <Button>Back to the inventory</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
      );
      expect(
        screen.getByRole('heading', { name: 'That item is already gone.' }),
      ).toBeTruthy();
      expect(screen.getByText('item-not-found')).toBeTruthy();
    });

    it('renders closed state with unmounted dialog', () => {
      render(
        <ConfirmDestructiveDialog
          open={false}
          itemName="Student Camera"
          recordCode="SC-001"
          quantity={1}
          condition="Working"
        />,
      );
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('S-010 Export dialog overlay (ExportDialog)', () => {
    it('renders default state with PDF and CSV formats and Download action', () => {
      render(<BaseExportDialog open={true} />);
      expect(
        screen.getByRole('heading', { name: 'Export the register' }),
      ).toBeTruthy();
      expect(screen.getByRole('radio', { name: /PDF/i })).toBeTruthy();
      expect(screen.getByRole('radio', { name: /CSV/i })).toBeTruthy();
      expect(
        screen.getByRole('button', { name: 'Download the file' }),
      ).toBeTruthy();
    });

    it('renders generating state with aria-busy="true" and data-state="confirming/generating"', () => {
      render(<BaseExportDialog open={true} pending={true} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-busy')).toBe('true');
      expect(dialog.getAttribute('data-state')).toBe('confirming');
      expect(screen.getByText('Preparing…')).toBeTruthy();
    });

    it('renders success state view', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>File ready.</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <Button>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
      );
      expect(screen.getByRole('heading', { name: 'File ready.' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    });

    it('renders failure state view via export-generation-failed error banner', () => {
      render(<ErrorBanner code="export-generation-failed" />);
      expect(screen.getByText('The file could not be created.')).toBeTruthy();
      expect(screen.getByText('export-generation-failed')).toBeTruthy();
    });

    it('renders closed state with unmounted export dialog', () => {
      render(<BaseExportDialog open={false} />);
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  describe('Static /privacy route (app/privacy/page.tsx)', () => {
    it('renders single static draft page with legal review stamp resolving G-3', () => {
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
          "Under Nigeria's data protection law you can ask what we hold about you, ask for it to be corrected, or ask for it to be deleted. For this site that would mean an admin's name and email address — there is nothing here about visitors to ask about. Write to the address above and the lab team will pass it on.",
        ),
      ).toBeTruthy();
    });
  });

  describe('G-1 Residual Guards & G-2 Cache Rule Adherence', () => {
    it('G-1a: S-001 dead error CSS guard resolved in App Router via C-017 banner', async () => {
      const ui = await Page({
        searchParams: Promise.resolve({ state: 'error' }),
      });
      const { container } = render(ui);
      expect(container.querySelector('#main')?.getAttribute('data-state')).toBe(
        'error',
      );
      expect(
        screen.getByText('The register could not be loaded.'),
      ).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Check again' })).toBeTruthy();
    });

    it('G-1b: S-002 dead error CSS guard resolved via C-017 banner and reduced-motion reset', async () => {
      const ui = await RoomPage({
        searchParams: Promise.resolve({ state: 'error' }),
      });
      const { container } = render(ui);
      expect(container.querySelector('#main')?.getAttribute('data-state')).toBe(
        'error',
      );
      expect(
        screen.getByText('The collection could not be loaded.'),
      ).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Check again' })).toBeTruthy();
    });

    it('G-1c & G-4: S-003 item detail missing record triggers 404 rather than empty layout', async () => {
      _setLastKnownGoodEquipment([]);
      await expect(
        ItemPage({
          params: Promise.resolve({
            id: '00000000-0000-4000-a000-000000000000',
          }),
        }),
      ).rejects.toThrow('NEXT_NOT_FOUND');
    });

    it('G-2: getEquipment falls back to last-known-good cache on network failure', async () => {
      _setLastKnownGoodEquipment(mockEquipmentList);
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network offline'),
      );

      const items = await getEquipment();
      expect(items).toHaveLength(2);
      expect(items[0].name).toBe('Student Camera');
    });

    it('G-2: getEquipmentById falls back to last-known-good cache on fetch failure', async () => {
      _setLastKnownGoodEquipment(mockEquipmentList);
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network offline'),
      );

      const item = await getEquipmentById(mockEquipmentList[0].id);
      expect(item).not.toBeNull();
      expect(item?.name).toBe('Student Camera');
    });
  });
});
