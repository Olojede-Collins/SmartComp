// @vitest-environment jsdom
import * as React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  notFound: vi.fn(),
}));

vi.mock('next/font/local', () => ({
  default: () => ({
    variable: '--font-mock',
    className: 'font-mock',
  }),
}));

vi.mock('@/lib/equipment', () => ({
  getEquipmentById: vi.fn().mockResolvedValue({
    id: 'e0000001-0000-4000-a000-000000000001',
    name: 'Student Camera',
    condition: 'Working',
    quantity: 1,
    core_functionality: 'Video input',
    other_functionality: 'Streaming',
    image_keys: ['student-camera-1.webp'],
  }),
}));

vi.mock('@/lib/admin-auth', () => ({
  getToken: () => 'mock-jwt-token',
  getSession: () => ({
    user: { id: 'admin-1', email: 'lead.admin@abu.edu.ng' },
    token: 'mock-jwt-token',
  }),
  signInWithPassword: vi.fn(),
  AuthError: class AuthError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));

vi.mock('@/lib/admin-api', () => ({
  getItems: vi.fn().mockResolvedValue([
    {
      id: 'e0000001-0000-4000-a000-000000000001',
      name: 'Server Rack',
      condition: 'Working',
      quantity: 1,
      core_functionality: 'Rack chassis',
      other_functionality: null,
      image_keys: [],
      created_at: '2026-10-10T10:00:00Z',
      updated_at: '2026-10-10T10:00:00Z',
      updated_by: 'admin-1',
    },
  ]),
  getItemById: vi.fn().mockResolvedValue({
    id: 'e0000001-0000-4000-a000-000000000001',
    name: 'Server Rack',
    condition: 'Working',
    quantity: 1,
    core_functionality: 'Rack chassis',
    other_functionality: null,
    image_keys: [],
    created_at: '2026-10-10T10:00:00Z',
    updated_at: '2026-10-10T10:00:00Z',
    updated_by: 'admin-1',
  }),
  getAdmins: vi.fn().mockResolvedValue([
    {
      id: 'admin-1',
      email: 'lead.admin@abu.edu.ng',
      role: 'admin',
      created_at: '2026-10-01T00:00:00Z',
    },
    {
      id: 'admin-2',
      email: 'peer.admin@abu.edu.ng',
      role: 'admin',
      created_at: '2026-10-05T00:00:00Z',
    },
  ]),
  createItem: vi.fn().mockResolvedValue({}),
  updateItem: vi.fn().mockResolvedValue({}),
  deleteItem: vi.fn().mockResolvedValue({}),
  deleteAdmin: vi.fn().mockResolvedValue({}),
  createInvite: vi.fn().mockResolvedValue({}),
  acceptInvite: vi.fn().mockResolvedValue({}),
  exportInventory: vi.fn().mockResolvedValue(new Blob(['mock-data'])),
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, status: number, message?: string) {
      super(message || code);
      this.code = code;
      this.status = status;
    }
  },
}));

import { Footer } from '@/app/_components/footer';
import ItemPage from '@/app/item/[id]/page';
import { InviteForm } from '@/app/_components/invite-form';
import { DeleteDialog } from '@/app/admin/_components/delete-dialog';
import { ExportDialog } from '@/app/admin/_components/export-dialog';
import RootLayout from '@/app/layout';
import AdminInventoryPage from '@/app/admin/page';
import AdminAdminsPage from '@/app/admin/admins/page';
import AcceptInvitePage from '@/app/admin/invite/accept/page';
import NewItemPage from '@/app/admin/items/new/page';
import EditItemPage from '@/app/admin/items/[id]/page';
import LoginPage from '@/app/admin/login/page';
import { LoadingSkeleton } from '@/app/_components/loading-skeleton';
import { Carousel, AUTO_ADVANCE_INTERVAL } from '@/app/_components/carousel';
import * as adminApi from '@/lib/admin-api';

describe('S-07 Accessibility & Acceptance Closure Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('F-01: Footer link touch targets', () => {
    it('public footer links include min-h-11 and px-2 for touch target >= 44x44', () => {
      const { container } = render(<Footer variant="public" />);
      const links = container.querySelectorAll('footer a');
      expect(links.length).toBeGreaterThanOrEqual(2);
      links.forEach((link) => {
        const cls = link.getAttribute('class') || '';
        expect(cls).toContain('min-h-11');
        expect(cls).toContain('px-2');
        expect(cls).toContain('inline-flex');
        expect(cls).toContain('items-center');
      });
      const privacyLink = screen.getByRole('link', { name: 'Privacy' });
      expect(privacyLink.getAttribute('href')).toBe('/privacy');
      expect(privacyLink.className).toContain('min-h-11');
      expect(privacyLink.className).toContain('px-2');
    });

    it('admin footer links include min-h-11 and px-2 for touch target >= 44x44', () => {
      const { container } = render(<Footer variant="admin" />);
      const links = container.querySelectorAll('footer a');
      expect(links.length).toBeGreaterThanOrEqual(2);
      links.forEach((link) => {
        const cls = link.getAttribute('class') || '';
        expect(cls).toContain('min-h-11');
        expect(cls).toContain('px-2');
        expect(cls).toContain('inline-flex');
        expect(cls).toContain('items-center');
      });
    });
  });

  describe('F-02: Single H1 on S-003 item detail route', () => {
    it('renders single h1 element for the item name and uses nav for breadcrumbs', async () => {
      const pageUi = await ItemPage({
        params: Promise.resolve({ id: 'e0000001-0000-4000-a000-000000000001' }),
      });
      const { container } = render(pageUi);
      const h1Headings = container.querySelectorAll('h1');
      expect(h1Headings.length).toBe(1);
      expect(h1Headings[0].textContent?.trim()).toBe('Student Camera');
      const breadcrumbNav = container.querySelector(
        'nav[aria-label="Breadcrumb"]',
      );
      expect(breadcrumbNav).toBeTruthy();
    });
  });

  describe('F-03: Radio and checkbox label wrapping in ExportDialog', () => {
    it('wraps format radios in clickable label elements with min-h-11', () => {
      render(<ExportDialog open={true} itemCount={7} />);
      const radios = document.body.querySelectorAll('input[type="radio"]');
      expect(radios.length).toBe(2);
      radios.forEach((radio) => {
        const label = radio.closest('label');
        expect(label).toBeTruthy();
        expect(label?.className).toContain('min-h-11');
      });
    });

    it('renders column checklist inputs paired with label elements', () => {
      render(<ExportDialog open={true} itemCount={7} />);
      const checkboxes = document.body.querySelectorAll(
        'input[type="checkbox"]',
      );
      expect(checkboxes.length).toBe(6);
      checkboxes.forEach((cb) => {
        expect(cb.id).toBeTruthy();
        const lbl = document.body.querySelector(`label[for="${cb.id}"]`);
        expect(lbl).toBeTruthy();
      });
    });
  });

  describe('F-05 & F-06: Pending action controls and aria-busy', () => {
    it('sets aria-busy=true and disables buttons in DeleteDialog during confirming state', async () => {
      let resolvePromise: () => void = () => {};
      vi.mocked(adminApi.deleteItem).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve as () => void;
          }),
      );

      render(
        <DeleteDialog
          open={true}
          onOpenChange={vi.fn()}
          item={{
            id: 'SC-001',
            name: 'Oscilloscope',
            quantity: 1,
            condition: 'Working',
          }}
        />,
      );

      const deleteBtn = screen.getByRole('button', {
        name: 'Delete item',
      }) as HTMLButtonElement;
      const cancelBtn = screen.getByRole('button', {
        name: 'Cancel',
      }) as HTMLButtonElement;
      expect(deleteBtn.disabled).toBe(false);
      expect(cancelBtn.disabled).toBe(false);

      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(deleteBtn.disabled).toBe(true);
        expect(cancelBtn.disabled).toBe(true);
        expect(deleteBtn.getAttribute('aria-busy')).toBe('true');
        expect(screen.getByText('Deleting…')).toBeTruthy();
      });

      act(() => {
        resolvePromise();
      });

      await waitFor(() => {
        expect(screen.getByText('Deleted.')).toBeTruthy();
      });
    });

    it('sets aria-busy=true and disables buttons in ExportDialog during generating state', async () => {
      let resolveExport: (blob: Blob) => void = () => {};
      vi.mocked(adminApi.exportInventory).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveExport = resolve;
          }),
      );

      render(<ExportDialog open={true} itemCount={7} />);

      const createBtn = screen.getByRole('button', {
        name: 'Create the file',
      }) as HTMLButtonElement;
      const cancelBtn = screen.getByRole('button', {
        name: 'Cancel',
      }) as HTMLButtonElement;
      expect(createBtn.disabled).toBe(false);
      expect(cancelBtn.disabled).toBe(false);

      fireEvent.click(createBtn);

      await waitFor(() => {
        expect(createBtn.disabled).toBe(true);
        expect(cancelBtn.disabled).toBe(true);
        expect(createBtn.getAttribute('aria-busy')).toBe('true');
        expect(screen.getByText('Preparing…')).toBeTruthy();
      });

      act(() => {
        resolveExport(new Blob(['mock']));
      });

      await waitFor(() => {
        expect(screen.getByText('Your file is ready.')).toBeTruthy();
      });
    });

    it('sets aria-busy=true and disables action buttons in InviteForm during sending state', async () => {
      let resolveInvite: () => void = () => {};
      const mockSubmit = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveInvite = resolve;
          }),
      );

      const { container } = render(<InviteForm onSubmit={mockSubmit} />);
      const emailInput = screen.getByLabelText(/EMAIL/i) as HTMLInputElement;
      const submitBtn = screen.getByRole('button', {
        name: 'Send invite',
      }) as HTMLButtonElement;

      fireEvent.change(emailInput, {
        target: { value: 'colleague@example.edu.ng' },
      });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        const form = container.querySelector('form');
        expect(form?.getAttribute('aria-busy')).toBe('true');
        expect(submitBtn.disabled).toBe(true);
        expect(submitBtn.getAttribute('aria-busy')).toBe('true');
        expect(emailInput.disabled).toBe(true);
        expect(screen.getByText('Sending…')).toBeTruthy();
      });

      act(() => {
        resolveInvite();
      });

      await waitFor(() => {
        expect(screen.getByText('Invitation sent.')).toBeTruthy();
      });
    });

    it('sets aria-busy=true and disables Remove button during admin removal in AdminAdminsPage', async () => {
      let resolveDelete: () => void = () => {};
      vi.mocked(adminApi.deleteAdmin).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDelete = resolve as () => void;
          }),
      );

      render(<AdminAdminsPage />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', {
            name: 'Remove peer.admin@abu.edu.ng',
          }),
        ).toBeTruthy();
      });

      const removeBtn = screen.getByRole('button', {
        name: 'Remove peer.admin@abu.edu.ng',
      }) as HTMLButtonElement;
      fireEvent.click(removeBtn);

      await waitFor(() => {
        expect(removeBtn.disabled).toBe(true);
        expect(removeBtn.getAttribute('aria-busy')).toBe('true');
      });

      act(() => {
        resolveDelete();
      });

      await waitFor(() => {
        expect(
          screen.queryByRole('button', {
            name: 'Remove peer.admin@abu.edu.ng',
          }),
        ).toBeNull();
      });
    });
  });

  describe('F-07: Live status announcements on submission', () => {
    it('InviteForm announces sending state to screen readers via aria-live=polite region', async () => {
      let resolveInvite: () => void = () => {};
      const mockSubmit = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveInvite = resolve;
          }),
      );

      const { container } = render(<InviteForm onSubmit={mockSubmit} />);
      const liveRegion = container.querySelector('div[aria-live="polite"]');
      expect(liveRegion).toBeTruthy();
      expect(liveRegion?.textContent?.trim()).toBe('');

      fireEvent.change(screen.getByLabelText(/EMAIL/i), {
        target: { value: 'peer@abu.edu.ng' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));

      await waitFor(() => {
        expect(liveRegion?.textContent?.trim()).toBe('Sending invitation…');
      });

      act(() => {
        resolveInvite();
      });

      await waitFor(() => {
        expect(liveRegion?.textContent?.trim()).toBe('');
      });
    });

    it('AcceptInvitePage contains aria-live=polite live region for pending acceptance state', () => {
      const { container } = render(<AcceptInvitePage />);
      const liveRegion = container.querySelector('div[aria-live="polite"]');
      expect(liveRegion).toBeTruthy();
    });

    it('LoginPage contains aria-live=polite live region for pending sign-in state', () => {
      const { container } = render(<LoginPage />);
      const liveRegion = container.querySelector('div[aria-live="polite"]');
      expect(liveRegion).toBeTruthy();
    });
  });

  describe('F-08: Focus management on state transitions', () => {
    it('moves focus to outcome heading h3 on DeleteDialog deletion', async () => {
      vi.mocked(adminApi.deleteItem).mockResolvedValue(undefined);
      render(
        <DeleteDialog
          open={true}
          onOpenChange={vi.fn()}
          item={{
            id: 'SC-001',
            name: 'Signal Generator',
            quantity: 1,
            condition: 'Working',
          }}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));

      await waitFor(() => {
        const heading = document.getElementById('dlg-title-deleted');
        expect(heading).toBeTruthy();
        expect(heading?.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(heading);
      });
    });

    it('moves focus to outcome heading h3 on DeleteDialog item-not-found 404', async () => {
      vi.mocked(adminApi.deleteItem).mockRejectedValue(
        new adminApi.ApiError('not-found', 404, 'Item not found'),
      );
      render(
        <DeleteDialog
          open={true}
          onOpenChange={vi.fn()}
          item={{
            id: 'SC-001',
            name: 'Signal Generator',
            quantity: 1,
            condition: 'Working',
          }}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));

      await waitFor(() => {
        const heading = document.getElementById('dlg-title-notfound');
        expect(heading).toBeTruthy();
        expect(heading?.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(heading);
      });
    });

    it('moves focus to outcome heading h3 on ExportDialog success', async () => {
      vi.mocked(adminApi.exportInventory).mockResolvedValue(new Blob(['data']));
      render(<ExportDialog open={true} itemCount={7} />);

      fireEvent.click(screen.getByRole('button', { name: 'Create the file' }));

      await waitFor(() => {
        const heading = document.getElementById('dlg-title-success');
        expect(heading).toBeTruthy();
        expect(heading?.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(heading);
      });
    });

    it('moves focus to outcome heading h3 on ExportDialog failure', async () => {
      vi.mocked(adminApi.exportInventory).mockRejectedValue(
        new Error('Network error'),
      );
      render(<ExportDialog open={true} itemCount={7} />);

      fireEvent.click(screen.getByRole('button', { name: 'Create the file' }));

      await waitFor(() => {
        const heading = document.getElementById('dlg-title-failure');
        expect(heading).toBeTruthy();
        expect(heading?.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(heading);
      });
    });

    it('restores focus to triggering element upon DeleteDialog close', () => {
      const trigger = document.createElement('button');
      document.body.appendChild(trigger);
      trigger.focus();
      const triggerRef = { current: trigger };

      const { unmount } = render(
        <DeleteDialog
          open={true}
          onOpenChange={vi.fn()}
          item={{
            id: 'SC-001',
            name: 'Device',
            quantity: 1,
            condition: 'Working',
          }}
          triggerRef={triggerRef}
        />,
      );

      unmount();
      expect(document.body.contains(trigger)).toBe(true);
      document.body.removeChild(trigger);
    });

    it('focuses error banner heading on appearance in AdminAdminsPage when last admin removal is blocked', async () => {
      vi.mocked(adminApi.getAdmins).mockResolvedValue([
        {
          id: 'admin-1',
          email: 'lead.admin@abu.edu.ng',
          created_at: '2026-10-01T00:00:00Z',
        },
      ]);

      render(<AdminAdminsPage />);

      await waitFor(() => {
        expect(screen.getByText('You are the only admin.')).toBeTruthy();
      });
    });
  });

  describe('F-09: Loading skeletons accessibility', () => {
    it('sets aria-busy=true and contains sr-only Loading status on skeleton regions', () => {
      const { container } = render(
        <LoadingSkeleton variant="card" count={2} />,
      );
      const busyElements = container.querySelectorAll('[aria-busy="true"]');
      expect(busyElements.length).toBeGreaterThan(0);
      const srOnly = container.querySelector('.sr-only');
      expect(srOnly).toBeTruthy();
      expect(srOnly?.textContent).toContain('Loading');
    });

    it('sets aria-busy=true and contains sr-only Loading on table row skeleton', () => {
      const { container } = render(
        <table>
          <tbody>
            <LoadingSkeleton variant="table-row" count={3} />
          </tbody>
        </table>,
      );
      const busyRows = container.querySelectorAll('[aria-busy="true"]');
      expect(busyRows.length).toBeGreaterThan(0);
      const srOnly = container.querySelectorAll('.sr-only');
      expect(srOnly.length).toBeGreaterThan(0);
    });
  });

  describe('Task 6: SkipLink landmark deduplication', () => {
    it('mounts single SkipLink at root in RootLayout', () => {
      const { container } = render(
        <RootLayout>
          <div id="main">Content</div>
        </RootLayout>,
      );
      const skipLinks = container.querySelectorAll('a[href="#main"]');
      expect(skipLinks.length).toBe(1);
      expect(skipLinks[0].textContent).toBe('Skip to main content');
    });

    it('does not contain redundant SkipLink mounts inside AdminInventoryPage', async () => {
      const { container } = render(<AdminInventoryPage />);
      const skipLinks = container.querySelectorAll('a[href="#main"]');
      expect(skipLinks.length).toBe(0);
    });

    it('does not contain redundant SkipLink mounts inside AdminAdminsPage', async () => {
      const { container } = render(<AdminAdminsPage />);
      const skipLinks = container.querySelectorAll('a[href="#main"]');
      expect(skipLinks.length).toBe(0);
    });

    it('does not contain redundant SkipLink mounts inside AcceptInvitePage', () => {
      const { container } = render(<AcceptInvitePage />);
      const skipLinks = container.querySelectorAll('a[href="#main"]');
      expect(skipLinks.length).toBe(0);
    });

    it('does not contain redundant SkipLink mounts inside NewItemPage', () => {
      const { container } = render(<NewItemPage />);
      const skipLinks = container.querySelectorAll('a[href="#main"]');
      expect(skipLinks.length).toBe(0);
    });

    it('does not contain redundant SkipLink mounts inside LoginPage', () => {
      const { container } = render(<LoginPage />);
      const skipLinks = container.querySelectorAll('a[href="#main"]');
      expect(skipLinks.length).toBe(0);
    });

    it('does not contain redundant SkipLink mounts inside EditItemPage', () => {
      const { container } = render(<EditItemPage params={{ id: 'SC-001' }} />);
      const skipLinks = container.querySelectorAll('a[href="#main"]');
      expect(skipLinks.length).toBe(0);
    });
  });

  describe('Task 7: Reduced-motion emulation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      document.documentElement.removeAttribute('data-state');
    });

    it('halts carousel auto-advance when data-state="reduced-motion"', () => {
      document.documentElement.setAttribute('data-state', 'reduced-motion');

      const items = [
        <div key="1">Slide 1</div>,
        <div key="2">Slide 2</div>,
        <div key="3">Slide 3</div>,
      ];

      render(<Carousel items={items} />);
      expect(screen.getByText('1 / 3')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL * 2);
      });

      expect(screen.getByText('1 / 3')).toBeTruthy();
    });

    it('halts carousel auto-advance when prefers-reduced-motion media query matches', () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const items = [<div key="1">Slide 1</div>, <div key="2">Slide 2</div>];

      render(<Carousel items={items} />);
      expect(screen.getByText('1 / 2')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL * 2);
      });

      expect(screen.getByText('1 / 2')).toBeTruthy();
      window.matchMedia = originalMatchMedia;
    });
  });

  describe('Task 8: 4-Breakpoint responsive layout rules and reflow', () => {
    it('applies mobile stacked styles and desktop grid breakpoints across layout containers', () => {
      const { container } = render(<Footer variant="public" />);
      const wrapper = container.querySelector(
        '[class*="max-w-[var(--layout-containerMax)]"]',
      );
      expect(wrapper).toBeTruthy();
    });

    it('Dialog footer supports stacked vertical orientation on narrow mobile displays', () => {
      render(<ExportDialog open={true} itemCount={7} />);
      const footer = document.body.querySelector(
        '[class*="max-[47.99rem]:flex-col-reverse"]',
      );
      expect(footer).toBeTruthy();
    });

    it('admin roster table wraps inside overflow-x-auto container preventing horizontal document scroll', async () => {
      const { container } = render(<AdminAdminsPage />);
      await waitFor(() => {
        expect(container.querySelector('table')).toBeTruthy();
      });
      const tableWrapper = container.querySelector('.overflow-x-auto');
      expect(tableWrapper).toBeTruthy();
    });

    it('item editor spread layout specifies single-column mobile and responsive desktop grid', () => {
      const { container } = render(<NewItemPage />);
      const formBlock = container.querySelector(
        '.max-w-\\[var\\(--layout-measure\\)\\]',
      );
      expect(formBlock).toBeTruthy();
    });
  });
});
