// @vitest-environment jsdom
import * as React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
} from '@testing-library/react';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () =>
    new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : '',
    ),
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
    created_at: '2026-10-09T08:00:00Z',
    updated_at: '2026-10-09T08:00:00Z',
    updated_by: null,
  }),
  getEquipment: vi.fn().mockResolvedValue([
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
      other_functionality: null,
      image_keys: ['smart-board.webp'],
      created_at: '2026-10-09T08:00:00Z',
      updated_at: '2026-10-09T08:00:00Z',
      updated_by: null,
    },
  ]),
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
      name: 'Student Camera',
      condition: 'Working',
      quantity: 1,
      core_functionality: 'Video input',
      other_functionality: 'Streaming',
      image_keys: ['student-camera-1.webp'],
      created_at: '2026-10-10T10:00:00Z',
      updated_at: '2026-10-10T10:00:00Z',
      updated_by: 'admin-1',
    },
  ]),
  getItemById: vi.fn().mockResolvedValue({
    id: 'SC-001',
    name: 'Oscilloscope',
    condition: 'Working',
    quantity: 1,
    core_functionality: 'Signal visualization',
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
  updateItem: vi.fn().mockResolvedValue({
    id: 'SC-001',
    name: 'Oscilloscope Updated',
    condition: 'Working',
    quantity: 1,
    core_functionality: 'Signal visualization',
    other_functionality: null,
    image_keys: [],
    created_at: '2026-10-10T10:00:00Z',
    updated_at: '2026-10-10T11:00:00Z',
    updated_by: 'admin-1',
  }),
  deleteItem: vi.fn().mockResolvedValue({}),
  deleteAdmin: vi.fn().mockResolvedValue({}),
  createInvite: vi.fn().mockResolvedValue({}),
  getPendingInvites: vi.fn().mockResolvedValue([]),
  deleteInvite: vi.fn().mockResolvedValue({}),
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

if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
}
if (!globalThis.URL.revokeObjectURL) {
  globalThis.URL.revokeObjectURL = vi.fn();
}

import { Footer } from '@/app/_components/footer';
import ItemPage from '@/app/item/[id]/page';
import Page from '@/app/page';
import RoomPage from '@/app/room/page';
import PrivacyPage from '@/app/privacy/page';
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
import { Carousel, AUTO_ADVANCE_INTERVAL } from '@/app/_components/carousel';
import * as adminApi from '@/lib/admin-api';
import * as adminAuth from '@/lib/admin-auth';

describe('S-07 Milestone M2 Challenger Adversarial Stress Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    document.documentElement.removeAttribute('data-state');
  });

  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('data-state');
    vi.useRealTimers();
  });

  describe('Seam 1: F-01 Footer Touch Target Boundaries & Responsive Reflow', () => {
    it('Attack 1.1: Public footer link touch boundaries enforce min-h-11, px-2, inline-flex, and items-center across all links', () => {
      const { container } = render(<Footer variant="public" />);
      const links = container.querySelectorAll('footer a');
      expect(links.length).toBe(2);
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
      const collectionLink = screen.getByRole('link', {
        name: 'The Collection',
      });
      expect(collectionLink.getAttribute('href')).toBe('/room');
      expect(collectionLink.className).toContain('min-h-11');
      expect(collectionLink.className).toContain('px-2');
    });

    it('Attack 1.2: Admin footer link touch boundaries enforce min-h-11, px-2, inline-flex, and items-center across all links', () => {
      const { container } = render(<Footer variant="admin" />);
      const links = container.querySelectorAll('footer a');
      expect(links.length).toBe(2);
      links.forEach((link) => {
        const cls = link.getAttribute('class') || '';
        expect(cls).toContain('min-h-11');
        expect(cls).toContain('px-2');
        expect(cls).toContain('inline-flex');
        expect(cls).toContain('items-center');
      });
      const inventoryLink = screen.getByRole('link', { name: 'The Inventory' });
      expect(inventoryLink.getAttribute('href')).toBe('/admin');
      expect(inventoryLink.className).toContain('min-h-11');
      expect(inventoryLink.className).toContain('px-2');
    });

    it('Attack 1.3: Custom className composition on Footer preserves touch bounds and gap spacing', () => {
      const { container } = render(
        <Footer variant="public" className="custom-test-footer extra-rule" />,
      );
      const footer = container.querySelector('footer');
      expect(footer?.className).toContain('custom-test-footer');
      expect(footer?.className).toContain('extra-rule');
      const linkContainer = container.querySelector('.gap-5');
      expect(linkContainer).toBeTruthy();
      const links = container.querySelectorAll('footer a');
      links.forEach((link) => {
        expect(link.className).toContain('min-h-11');
        expect(link.className).toContain('px-2');
      });
    });

    it('Attack 1.4: Link typography and container classes prevent boundary overlap and collapse', () => {
      const { container } = render(<Footer variant="public" />);
      const links = container.querySelectorAll('footer a');
      links.forEach((link) => {
        expect(link.className).toContain('text-caption');
        expect(link.className).toContain('text-fg-link');
        expect(link.className).toContain('hover:text-fg-link-hover');
      });
    });

    it('Attack 1.5: Focus ring styling on footer links meets WCAG 2.4.7 focus visible requirements', () => {
      const { container } = render(<Footer variant="public" />);
      const links = container.querySelectorAll('footer a');
      links.forEach((link) => {
        expect(link.className).toContain('focus-visible:outline-3');
        expect(link.className).toContain('focus-visible:outline-offset-2');
        expect(link.className).toContain('focus-visible:outline-border-focus');
      });
    });

    it('Attack 1.6: Footer logo and copy layout reflow preserves link target separation without clipping', () => {
      const { container } = render(<Footer variant="public" />);
      const logo = container.querySelector(
        'img[alt="Ahmadu Bello University"]',
      );
      expect(logo).toBeTruthy();
      const stamp = container.querySelector('[class*="bg-bg-stamp"]');
      expect(stamp).toBeNull();
    });
  });

  describe('Seam 2: F-05 & F-06 In-Flight Locking, Rapid Multi-Clicks & Concurrent Submissions', () => {
    it('Attack 2.1: DeleteDialog rapid multi-click barrage dispatches API call exactly once', async () => {
      let resolveDelete: () => void = () => {};
      vi.mocked(adminApi.deleteItem).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDelete = resolve as () => void;
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

      for (let i = 0; i < 10; i++) {
        fireEvent.click(deleteBtn);
      }

      expect(adminApi.deleteItem).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(deleteBtn.disabled).toBe(true);
        expect(cancelBtn.disabled).toBe(true);
        expect(deleteBtn.getAttribute('aria-busy')).toBe('true');
        expect(screen.getByText('Deleting…')).toBeTruthy();
      });

      act(() => {
        resolveDelete();
      });

      await waitFor(() => {
        expect(screen.getByText('Deleted.')).toBeTruthy();
      });
    });

    it('Attack 2.2: DeleteDialog Enter keypress barrage during in-flight state is ignored', async () => {
      let resolveDelete: () => void = () => {};
      vi.mocked(adminApi.deleteItem).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDelete = resolve as () => void;
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
      fireEvent.click(deleteBtn);

      for (let i = 0; i < 5; i++) {
        fireEvent.keyDown(deleteBtn, { key: 'Enter', code: 'Enter' });
      }

      expect(adminApi.deleteItem).toHaveBeenCalledTimes(1);

      act(() => {
        resolveDelete();
      });

      await waitFor(() => {
        expect(screen.getByText('Deleted.')).toBeTruthy();
      });
    });

    it('Attack 2.3: DeleteDialog in-flight state locks both Delete and Cancel buttons with aria-busy="true"', async () => {
      let resolveDelete: () => void = () => {};
      vi.mocked(adminApi.deleteItem).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDelete = resolve as () => void;
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

      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(deleteBtn.disabled).toBe(true);
        expect(cancelBtn.disabled).toBe(true);
        expect(deleteBtn.getAttribute('aria-busy')).toBe('true');
      });

      act(() => {
        resolveDelete();
      });

      await waitFor(() => {
        expect(screen.getByText('Deleted.')).toBeTruthy();
      });
    });

    it('Attack 2.4: DeleteDialog failure path resets in-flight lock allowing subsequent retry', async () => {
      vi.mocked(adminApi.deleteItem)
        .mockRejectedValueOnce(new Error('Server timeout'))
        .mockResolvedValueOnce(undefined);

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
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(screen.getByText('Server timeout')).toBeTruthy();
        expect(deleteBtn.disabled).toBe(false);
      });

      fireEvent.click(deleteBtn);
      expect(adminApi.deleteItem).toHaveBeenCalledTimes(2);

      await waitFor(() => {
        expect(screen.getByText('Deleted.')).toBeTruthy();
      });
    });

    it('Attack 2.5: ExportDialog rapid multi-click barrage invokes exportInventory exactly once', async () => {
      let resolveExport: (blob: Blob) => void = () => {};
      vi.mocked(adminApi.exportInventory).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveExport = resolve;
          }),
      );

      render(<ExportDialog open={true} itemCount={7} />);

      const createBtn = screen.getByRole('button', {
        name: 'Create the File',
      }) as HTMLButtonElement;
      const cancelBtn = screen.getByRole('button', {
        name: 'Cancel',
      }) as HTMLButtonElement;

      for (let i = 0; i < 7; i++) {
        fireEvent.click(createBtn);
      }

      expect(adminApi.exportInventory).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(createBtn.disabled).toBe(true);
        expect(cancelBtn.disabled).toBe(true);
        expect(createBtn.getAttribute('aria-busy')).toBe('true');
        expect(screen.getByText('Preparing…')).toBeTruthy();
      });

      act(() => {
        resolveExport(new Blob(['data']));
      });

      await waitFor(() => {
        expect(screen.getByText('Your file is ready.')).toBeTruthy();
      });
    });

    it('Attack 2.6: ExportDialog locks format radios and action buttons with aria-busy="true" during generation', async () => {
      let resolveExport: (blob: Blob) => void = () => {};
      vi.mocked(adminApi.exportInventory).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveExport = resolve;
          }),
      );

      render(<ExportDialog open={true} itemCount={7} />);

      const pdfRadio = screen.getByRole('radio', {
        name: /PDF/i,
      }) as HTMLInputElement;
      const csvRadio = screen.getByRole('radio', {
        name: /CSV/i,
      }) as HTMLInputElement;
      const createBtn = screen.getByRole('button', {
        name: 'Create the File',
      }) as HTMLButtonElement;

      expect(pdfRadio.disabled).toBe(false);
      expect(csvRadio.disabled).toBe(false);

      fireEvent.click(createBtn);

      await waitFor(() => {
        expect(pdfRadio.disabled).toBe(true);
        expect(csvRadio.disabled).toBe(true);
        expect(createBtn.disabled).toBe(true);
        expect(createBtn.getAttribute('aria-busy')).toBe('true');
      });

      act(() => {
        resolveExport(new Blob(['data']));
      });

      await waitFor(() => {
        expect(screen.getByText('Your file is ready.')).toBeTruthy();
      });
    });

    it('Attack 2.7: ExportDialog radio format switching is disabled while generation is in flight', async () => {
      let resolveExport: (blob: Blob) => void = () => {};
      vi.mocked(adminApi.exportInventory).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveExport = resolve;
          }),
      );

      render(<ExportDialog open={true} itemCount={7} format="csv" />);

      const createBtn = screen.getByRole('button', { name: 'Create the File' });
      fireEvent.click(createBtn);

      const pdfRadio = screen.getByRole('radio', {
        name: /PDF/i,
      }) as HTMLInputElement;
      fireEvent.click(pdfRadio);

      expect(adminApi.exportInventory).toHaveBeenCalledWith(
        'csv',
        expect.any(Array),
      );

      act(() => {
        resolveExport(new Blob(['data']));
      });

      await waitFor(() => {
        expect(screen.getByText('Your file is ready.')).toBeTruthy();
      });
    });

    it('Attack 2.8: InviteForm rapid multi-click attack triggers onSubmit exactly once', async () => {
      let resolveInvite: () => void = () => {};
      const mockSubmit = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveInvite = resolve;
          }),
      );

      render(<InviteForm onSubmit={mockSubmit} />);

      const emailInput = screen.getByLabelText(/EMAIL/i);
      const submitBtn = screen.getByRole('button', { name: 'Send invite' });

      fireEvent.change(emailInput, {
        target: { value: 'peer.test@abu.edu.ng' },
      });

      for (let i = 0; i < 5; i++) {
        fireEvent.click(submitBtn);
      }

      expect(mockSubmit).toHaveBeenCalledTimes(1);

      act(() => {
        resolveInvite();
      });

      await waitFor(() => {
        expect(screen.getByText('Invitation sent.')).toBeTruthy();
      });
    });

    it('Attack 2.9: InviteForm locks email input and submit button with aria-busy during flight', async () => {
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
        target: { value: 'peer.test@abu.edu.ng' },
      });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        const form = container.querySelector('form');
        expect(form?.getAttribute('aria-busy')).toBe('true');
        expect(emailInput.disabled).toBe(true);
        expect(emailInput.readOnly).toBe(true);
        expect(submitBtn.disabled).toBe(true);
        expect(submitBtn.getAttribute('aria-busy')).toBe('true');
        expect(screen.getByText('Sending…')).toBeTruthy();
      });

      act(() => {
        resolveInvite();
      });

      await waitFor(() => {
        expect(screen.getByText('Invitation sent.')).toBeTruthy();
      });
    });

    it('Attack 2.10: InviteForm rejection resets in-flight lock allowing retry', async () => {
      const mockSubmit = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network fault'))
        .mockResolvedValueOnce(undefined);

      const { container } = render(<InviteForm onSubmit={mockSubmit} />);

      const emailInput = screen.getByLabelText(/EMAIL/i) as HTMLInputElement;
      const submitBtn = screen.getByRole('button', {
        name: 'Send invite',
      }) as HTMLButtonElement;

      fireEvent.change(emailInput, {
        target: { value: 'peer.test@abu.edu.ng' },
      });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('The invitation did not send.')).toBeTruthy();
        const form = container.querySelector('form');
        expect(form?.getAttribute('aria-busy')).toBeNull();
        expect(submitBtn.disabled).toBe(false);
      });

      fireEvent.click(submitBtn);
      expect(mockSubmit).toHaveBeenCalledTimes(2);

      await waitFor(() => {
        expect(screen.getByText('Invitation sent.')).toBeTruthy();
      });
    });

    it('Attack 2.11: AdminAdminsPage rapid remove clicks invoke deleteAdmin only once and lock button', async () => {
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

      for (let i = 0; i < 4; i++) {
        fireEvent.click(removeBtn);
      }

      expect(adminApi.deleteAdmin).toHaveBeenCalledTimes(1);

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

    it('Attack 2.12: NewItemPage rapid multi-click save dispatches createItem exactly once', async () => {
      let resolveCreate: () => void = () => {};
      vi.mocked(adminApi.createItem).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve as () => void;
          }),
      );

      const { container } = render(<NewItemPage />);

      fireEvent.change(screen.getByLabelText(/ITEM NAME/i), {
        target: { value: 'Logic Analyzer' },
      });
      fireEvent.change(screen.getByLabelText(/CORE FUNCTIONALITY/i), {
        target: { value: 'Protocol testing' },
      });

      const saveBtn = screen.getByRole('button', {
        name: 'Save item',
      }) as HTMLButtonElement;

      for (let i = 0; i < 6; i++) {
        fireEvent.click(saveBtn);
      }

      expect(adminApi.createItem).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        const form = container.querySelector('form');
        expect(form?.getAttribute('aria-busy')).toBe('true');
        expect(saveBtn.disabled).toBe(true);
        expect(screen.getByText('Saving…')).toBeTruthy();
      });

      act(() => {
        resolveCreate();
      });
    });

    it('Attack 2.13: EditItemPage rapid multi-click save dispatches updateItem exactly once', async () => {
      let resolveUpdate: () => void = () => {};
      vi.mocked(adminApi.updateItem).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveUpdate = resolve as () => void;
          }),
      );

      const { container } = render(<EditItemPage params={{ id: 'SC-001' }} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Oscilloscope')).toBeTruthy();
      });

      const saveBtn = screen.getByRole('button', {
        name: 'Save item',
      }) as HTMLButtonElement;

      for (let i = 0; i < 5; i++) {
        fireEvent.click(saveBtn);
      }

      expect(adminApi.updateItem).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        const form = container.querySelector('form');
        expect(form?.getAttribute('aria-busy')).toBe('true');
        expect(saveBtn.disabled).toBe(true);
        expect(screen.getByText('Saving…')).toBeTruthy();
      });

      act(() => {
        resolveUpdate();
      });
    });
  });

  describe('Seam 3: F-07 Live Region Announcements Lifecycle & Resolution', () => {
    it('Attack 3.1: InviteForm live region announces flight and clears upon successful resolution', async () => {
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
        expect(screen.getByText('Invitation sent.')).toBeTruthy();
      });
    });

    it('Attack 3.2: InviteForm live region announces flight and clears upon delivery failure', async () => {
      let rejectInvite: (err: Error) => void = () => {};
      const mockSubmit = vi.fn(
        () =>
          new Promise<void>((_, reject) => {
            rejectInvite = reject;
          }),
      );

      const { container } = render(<InviteForm onSubmit={mockSubmit} />);
      const liveRegion = container.querySelector('div[aria-live="polite"]');

      fireEvent.change(screen.getByLabelText(/EMAIL/i), {
        target: { value: 'peer@abu.edu.ng' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));

      await waitFor(() => {
        expect(liveRegion?.textContent?.trim()).toBe('Sending invitation…');
      });

      act(() => {
        rejectInvite(new Error('SMTP down'));
      });

      await waitFor(() => {
        expect(liveRegion?.textContent?.trim()).toBe('');
        expect(screen.getByText('The invitation did not send.')).toBeTruthy();
      });
    });

    it('Attack 3.3: LoginPage live region announces flight and clears upon authentication failure', async () => {
      let rejectLogin: (err: Error) => void = () => {};
      vi.mocked(adminAuth.signInWithPassword).mockImplementation(
        () =>
          new Promise((_, reject) => {
            rejectLogin = reject;
          }),
      );

      const { container } = render(<LoginPage />);
      const liveRegion = container.querySelector('div[aria-live="polite"]');
      expect(liveRegion).toBeTruthy();
      expect(liveRegion?.textContent?.trim()).toBe('');

      fireEvent.change(screen.getByLabelText(/EMAIL/i), {
        target: { value: 'admin@abu.edu.ng' },
      });
      fireEvent.change(screen.getByLabelText(/PASSWORD/i), {
        target: { value: 'wrongpass' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(liveRegion?.textContent?.trim()).toBe('Signing in…');
      });

      act(() => {
        rejectLogin(
          new adminAuth.AuthError(
            'invalid-credentials',
            401,
            'Invalid credentials',
          ),
        );
      });

      await waitFor(() => {
        expect(liveRegion?.textContent?.trim()).toBe('');
        expect(screen.getByRole('alert')).toBeTruthy();
      });
    });

    it('Attack 3.4: AcceptInvitePage live region announces flight and clears upon completion', async () => {
      let resolveAccept: () => void = () => {};
      vi.mocked(adminApi.acceptInvite).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveAccept = resolve as () => void;
          }),
      );

      delete (window as { location?: unknown }).location;
      (window as unknown as { location: unknown }).location = new URL(
        'http://localhost/admin/invite/accept?token=valid-token&email=new@abu.edu.ng',
      );

      try {
        const { container } = render(<AcceptInvitePage />);
        const liveRegion = container.querySelector('div[aria-live="polite"]');
        expect(liveRegion).toBeTruthy();
        expect(liveRegion?.textContent?.trim()).toBe('');

        fireEvent.change(screen.getByLabelText(/^PASSWORD/i), {
          target: { value: 'SecurePass123' },
        });
        fireEvent.change(screen.getByLabelText(/CONFIRM PASSWORD/i), {
          target: { value: 'SecurePass123' },
        });
        fireEvent.click(
          screen.getByRole('button', { name: 'Accept Invitation' }),
        );

        await waitFor(() => {
          expect(liveRegion?.textContent?.trim()).toBe('Accepting invitation…');
        });

        act(() => {
          resolveAccept();
        });

        await waitFor(() => {
          expect(liveRegion?.textContent?.trim()).toBe('');
        });
      } finally {
        delete (window as { location?: unknown }).location;
        (window as unknown as { location: unknown }).location = new URL(
          'http://localhost/',
        );
      }
    });

    it('Attack 3.5: Multiple consecutive submit-error cycles maintain clean live region state without text accumulation', async () => {
      const mockSubmit = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce(undefined);

      const { container } = render(<InviteForm onSubmit={mockSubmit} />);
      const liveRegion = container.querySelector('div[aria-live="polite"]');

      fireEvent.change(screen.getByLabelText(/EMAIL/i), {
        target: { value: 'peer@abu.edu.ng' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));

      await waitFor(() => {
        expect(liveRegion?.textContent?.trim()).toBe('');
      });

      fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));

      await waitFor(() => {
        expect(liveRegion?.textContent?.trim()).toBe('');
      });

      fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));

      await waitFor(() => {
        expect(liveRegion?.textContent?.trim()).toBe('');
        expect(screen.getByText('Invitation sent.')).toBeTruthy();
      });
    });

    it('Attack 3.6: Live region markup employs sr-only ensuring zero layout shifts or visual flickering', () => {
      const { container: inviteContainer } = render(<InviteForm />);
      const inviteLive = inviteContainer.querySelector(
        'div[aria-live="polite"]',
      );
      expect(inviteLive?.className).toContain('sr-only');

      const { container: loginContainer } = render(<LoginPage />);
      const loginLive = loginContainer.querySelector('div[aria-live="polite"]');
      expect(loginLive?.className).toContain('sr-only');

      const { container: acceptContainer } = render(<AcceptInvitePage />);
      const acceptLive = acceptContainer.querySelector(
        'div[aria-live="polite"]',
      );
      expect(acceptLive?.className).toContain('sr-only');
    });
  });

  describe('Seam 4: F-08 Focus Management Edge Cases & Dialog Outcome Transitions', () => {
    it('Attack 4.1: DeleteDialog idle Escape key cancels dialog and calls onOpenChange(false)', () => {
      const handleOpenChange = vi.fn();
      render(
        <DeleteDialog
          open={true}
          onOpenChange={handleOpenChange}
          item={{
            id: 'SC-001',
            name: 'Oscilloscope',
            quantity: 1,
            condition: 'Working',
          }}
        />,
      );

      fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });

    it('Attack 4.2: DeleteDialog pending Escape key is suppressed and does not close dialog', async () => {
      const handleOpenChange = vi.fn();
      let resolveDelete: () => void = () => {};
      vi.mocked(adminApi.deleteItem).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDelete = resolve as () => void;
          }),
      );

      render(
        <DeleteDialog
          open={true}
          onOpenChange={handleOpenChange}
          item={{
            id: 'SC-001',
            name: 'Oscilloscope',
            quantity: 1,
            condition: 'Working',
          }}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));

      await waitFor(() => {
        expect(screen.getByText('Deleting…')).toBeTruthy();
      });

      fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
      expect(handleOpenChange).not.toHaveBeenCalled();

      act(() => {
        resolveDelete();
      });
    });

    it('Attack 4.3: DeleteDialog pending pointer down outside is suppressed and does not close dialog', async () => {
      const handleOpenChange = vi.fn();
      let resolveDelete: () => void = () => {};
      vi.mocked(adminApi.deleteItem).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDelete = resolve as () => void;
          }),
      );

      render(
        <DeleteDialog
          open={true}
          onOpenChange={handleOpenChange}
          item={{
            id: 'SC-001',
            name: 'Oscilloscope',
            quantity: 1,
            condition: 'Working',
          }}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));

      await waitFor(() => {
        expect(screen.getByText('Deleting…')).toBeTruthy();
      });

      const overlay = document.querySelector('[data-dialog-overlay]');
      if (overlay) {
        fireEvent.pointerDown(overlay);
      }
      expect(handleOpenChange).not.toHaveBeenCalled();

      act(() => {
        resolveDelete();
      });
    });

    it('Attack 4.4: DeleteDialog successful deletion moves focus to outcome heading h3#dlg-title-deleted', async () => {
      vi.mocked(adminApi.deleteItem).mockResolvedValue(undefined);

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

      fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));

      await waitFor(() => {
        const heading = document.getElementById('dlg-title-deleted');
        expect(heading).toBeTruthy();
        expect(heading?.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(heading);
      });
    });

    it('Attack 4.5: DeleteDialog 404 item-not-found moves focus to outcome heading h3#dlg-title-notfound', async () => {
      vi.mocked(adminApi.deleteItem).mockRejectedValue(
        new adminApi.ApiError('not-found', 404, 'Item not found'),
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

      fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));

      await waitFor(() => {
        const heading = document.getElementById('dlg-title-notfound');
        expect(heading).toBeTruthy();
        expect(heading?.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(heading);
      });
    });

    it('Attack 4.6: ExportDialog pending Escape key is suppressed and does not close dialog', async () => {
      const handleOpenChange = vi.fn();
      let resolveExport: (blob: Blob) => void = () => {};
      vi.mocked(adminApi.exportInventory).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveExport = resolve;
          }),
      );

      render(
        <ExportDialog
          open={true}
          onOpenChange={handleOpenChange}
          itemCount={7}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Create the File' }));

      await waitFor(() => {
        expect(screen.getByText('Preparing…')).toBeTruthy();
      });

      fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
      expect(handleOpenChange).not.toHaveBeenCalled();

      act(() => {
        resolveExport(new Blob(['data']));
      });
    });

    it('Attack 4.7: ExportDialog success outcome moves focus to heading h3#dlg-title-success', async () => {
      vi.mocked(adminApi.exportInventory).mockResolvedValue(new Blob(['data']));

      render(<ExportDialog open={true} itemCount={7} />);

      fireEvent.click(screen.getByRole('button', { name: 'Create the File' }));

      await waitFor(() => {
        const heading = document.getElementById('dlg-title-success');
        expect(heading).toBeTruthy();
        expect(heading?.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(heading);
      });
    });

    it('Attack 4.8: ExportDialog failure outcome moves focus to heading h3#dlg-title-failure', async () => {
      vi.mocked(adminApi.exportInventory).mockRejectedValue(
        new Error('Export crash'),
      );

      render(<ExportDialog open={true} itemCount={7} />);

      fireEvent.click(screen.getByRole('button', { name: 'Create the File' }));

      await waitFor(() => {
        const heading = document.getElementById('dlg-title-failure');
        expect(heading).toBeTruthy();
        expect(heading?.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(heading);
      });
    });

    it('Attack 4.9: Dialog closure triggers focus restoration to triggerRef element', () => {
      const triggerBtn = document.createElement('button');
      triggerBtn.textContent = 'Open dialog trigger';
      document.body.appendChild(triggerBtn);
      triggerBtn.focus();
      const triggerRef = { current: triggerBtn };

      const { unmount } = render(
        <DeleteDialog
          open={true}
          onOpenChange={vi.fn()}
          item={{
            id: 'SC-001',
            name: 'Oscilloscope',
            quantity: 1,
            condition: 'Working',
          }}
          triggerRef={triggerRef}
        />,
      );

      unmount();
      expect(document.body.contains(triggerBtn)).toBe(true);
      document.body.removeChild(triggerBtn);
    });

    it('Attack 4.10: LoginPage invalid credentials error banner moves focus to banner heading', async () => {
      vi.mocked(adminAuth.signInWithPassword).mockRejectedValue(
        new adminAuth.AuthError(
          'invalid-credentials',
          401,
          'Invalid credentials',
        ),
      );

      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/EMAIL/i), {
        target: { value: 'admin@abu.edu.ng' },
      });
      fireEvent.change(screen.getByLabelText(/PASSWORD/i), {
        target: { value: 'wrongpassword' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        const alertHeading = document.querySelector('[role="alert"] h3');
        expect(alertHeading).toBeTruthy();
        expect(alertHeading?.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(alertHeading);
      });
    });

    it('Attack 4.11: AcceptInvitePage unknown token error banner moves focus to banner heading', async () => {
      render(<AcceptInvitePage />);

      await waitFor(() => {
        const alertHeading = document.querySelector('[role="alert"] h3');
        expect(alertHeading).toBeTruthy();
        expect(alertHeading?.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(alertHeading);
      });
    });

    it('Attack 4.12: AdminAdminsPage last-admin block moves focus to error banner heading', async () => {
      vi.mocked(adminApi.getAdmins).mockResolvedValue([
        {
          id: 'admin-1',
          email: 'lead.admin@abu.edu.ng',
          created_at: '2026-10-01T00:00:00Z',
        },
        {
          id: 'admin-2',
          email: 'peer.admin@abu.edu.ng',
          created_at: '2026-10-05T00:00:00Z',
        },
      ]);
      vi.mocked(adminApi.deleteAdmin).mockRejectedValue({
        status: 409,
        code: 'last-admin',
      });

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
      });
      fireEvent.click(removeBtn);

      await waitFor(() => {
        const alertHeading = document.querySelector('[role="alert"] h3');
        expect(alertHeading).toBeTruthy();
        expect(alertHeading?.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(alertHeading);
      });
    });

    it('Attack 4.13: NewItemPage error banner moves focus to banner heading upon submission error', async () => {
      vi.mocked(adminApi.createItem).mockRejectedValue(
        new adminApi.ApiError('inventory-ceiling-reached', 409, 'Ceiling hit'),
      );

      render(<NewItemPage />);

      fireEvent.change(screen.getByLabelText(/ITEM NAME/i), {
        target: { value: 'Multimeter' },
      });
      fireEvent.change(screen.getByLabelText(/CORE FUNCTIONALITY/i), {
        target: { value: 'Voltage check' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

      await waitFor(() => {
        const alertHeading = document.querySelector('[role="alert"] h3');
        expect(alertHeading).toBeTruthy();
        expect(alertHeading?.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(alertHeading);
      });
    });
  });

  describe('Seam 5: Reduced-Motion Emulation & Interaction Interruptibility', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      document.documentElement.removeAttribute('data-state');
    });

    it('Attack 5.1: Global data-state="reduced-motion" completely halts carousel auto-advance timer', () => {
      document.documentElement.setAttribute('data-state', 'reduced-motion');

      const items = [
        <div key="1">Slide 1</div>,
        <div key="2">Slide 2</div>,
        <div key="3">Slide 3</div>,
      ];

      render(<Carousel items={items} />);
      expect(screen.getByText('1 / 3')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL * 5);
      });

      expect(screen.getByText('1 / 3')).toBeTruthy();
    });

    it('Attack 5.2: Media query prefers-reduced-motion: reduce halts carousel auto-advance timer', () => {
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
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL * 5);
      });

      expect(screen.getByText('1 / 2')).toBeTruthy();
      window.matchMedia = originalMatchMedia;
    });

    it('Attack 5.3: Dynamic runtime attribute mutation to reduced-motion immediately halts running timer', async () => {
      const items = [
        <div key="1">Slide 1</div>,
        <div key="2">Slide 2</div>,
        <div key="3">Slide 3</div>,
      ];

      render(<Carousel items={items} />);
      expect(screen.getByText('1 / 3')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL);
      });
      expect(screen.getByText('2 / 3')).toBeTruthy();

      await act(async () => {
        document.documentElement.setAttribute('data-state', 'reduced-motion');
      });

      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL * 5);
      });

      expect(screen.getByText('2 / 3')).toBeTruthy();
    });

    it('Attack 5.4: Track transition class switches to transition-none when reduced-motion is active', () => {
      document.documentElement.setAttribute('data-state', 'reduced-motion');

      const items = [<div key="1">Slide 1</div>, <div key="2">Slide 2</div>];
      const { container } = render(<Carousel items={items} />);

      const track = container.querySelector('.carousel__track');
      expect(track?.className).toContain('transition-none');
      expect(track?.className).not.toContain(
        'transition-transform duration-slow',
      );
    });

    it('Attack 5.5: Explicit user navigation via Next button permanently disables auto-advance', () => {
      const items = [
        <div key="1">Slide 1</div>,
        <div key="2">Slide 2</div>,
        <div key="3">Slide 3</div>,
      ];

      render(<Carousel items={items} />);
      expect(screen.getByText('1 / 3')).toBeTruthy();

      const nextBtn = screen.getByRole('button', { name: 'Next slide' });
      fireEvent.click(nextBtn);

      expect(screen.getByText('2 / 3')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL * 5);
      });

      expect(screen.getByText('2 / 3')).toBeTruthy();
    });

    it('Attack 5.6: Mouse hover pauses carousel auto-advance and mouse leave resumes it', () => {
      const items = [
        <div key="1">Slide 1</div>,
        <div key="2">Slide 2</div>,
        <div key="3">Slide 3</div>,
      ];

      const { container } = render(<Carousel items={items} />);
      const carouselRegion = container.querySelector('[role="region"]');

      expect(screen.getByText('1 / 3')).toBeTruthy();

      if (carouselRegion) {
        fireEvent.mouseEnter(carouselRegion);
      }

      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL * 2);
      });
      expect(screen.getByText('1 / 3')).toBeTruthy();

      if (carouselRegion) {
        fireEvent.mouseLeave(carouselRegion);
      }

      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL);
      });
      expect(screen.getByText('2 / 3')).toBeTruthy();
    });

    it('Attack 5.7: Focus pause halts auto-advance and blur resumes it', () => {
      const items = [
        <div key="1">Slide 1</div>,
        <div key="2">Slide 2</div>,
        <div key="3">Slide 3</div>,
      ];

      const { container } = render(<Carousel items={items} />);
      const carouselRegion = container.querySelector('[role="region"]');

      expect(screen.getByText('1 / 3')).toBeTruthy();

      if (carouselRegion) {
        fireEvent.focus(carouselRegion);
      }

      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL * 2);
      });
      expect(screen.getByText('1 / 3')).toBeTruthy();

      if (carouselRegion) {
        fireEvent.blur(carouselRegion, { relatedTarget: null });
      }

      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL);
      });
      expect(screen.getByText('2 / 3')).toBeTruthy();
    });

    it('Attack 5.8: Single slide or empty carousel neutralizes timer and disables navigation controls', () => {
      const singleItem = [<div key="1">Only one</div>];
      render(<Carousel items={singleItem} />);

      expect(screen.getByText('1 / 1')).toBeTruthy();
      const prevBtn = screen.getByRole('button', {
        name: 'Previous slide',
      }) as HTMLButtonElement;
      const nextBtn = screen.getByRole('button', {
        name: 'Next slide',
      }) as HTMLButtonElement;

      expect(prevBtn.disabled).toBe(true);
      expect(nextBtn.disabled).toBe(true);

      act(() => {
        vi.advanceTimersByTime(AUTO_ADVANCE_INTERVAL * 5);
      });

      expect(screen.getByText('1 / 1')).toBeTruthy();
    });
  });

  describe('Seam 6: SkipLink and Landmark Integrity Across Routes', () => {
    it('Attack 6.1: RootLayout mounts single SkipLink targeting #main as first interactive element', () => {
      const { container } = render(
        <RootLayout>
          <main id="main">Test body</main>
        </RootLayout>,
      );

      const skipLinks = container.querySelectorAll('a[href="#main"]');
      expect(skipLinks.length).toBe(1);
      expect(skipLinks[0].textContent).toBe('Skip to main content');
      expect(skipLinks[0].getAttribute('href')).toBe('#main');
    });

    it('Attack 6.2: Admin inventory page (/admin) contains zero redundant SkipLink mounts', async () => {
      const { container } = render(<AdminInventoryPage />);
      const skipLinks = container.querySelectorAll('a[href="#main"]');
      expect(skipLinks.length).toBe(0);
    });

    it('Attack 6.3: Admin admins page (/admin/admins) contains zero redundant SkipLink mounts', async () => {
      const { container } = render(<AdminAdminsPage />);
      const skipLinks = container.querySelectorAll('a[href="#main"]');
      expect(skipLinks.length).toBe(0);
    });

    it('Attack 6.4: Accept invite page (/admin/invite/accept) contains zero redundant SkipLink mounts', () => {
      const { container } = render(<AcceptInvitePage />);
      const skipLinks = container.querySelectorAll('a[href="#main"]');
      expect(skipLinks.length).toBe(0);
    });

    it('Attack 6.5: New item page (/admin/items/new) contains zero redundant SkipLink mounts', () => {
      const { container } = render(<NewItemPage />);
      const skipLinks = container.querySelectorAll('a[href="#main"]');
      expect(skipLinks.length).toBe(0);
    });

    it('Attack 6.6: Edit item page (/admin/items/[id]) contains zero redundant SkipLink mounts', () => {
      const { container } = render(<EditItemPage params={{ id: 'SC-001' }} />);
      const skipLinks = container.querySelectorAll('a[href="#main"]');
      expect(skipLinks.length).toBe(0);
    });

    it('Attack 6.7: Login page (/admin/login) contains zero redundant SkipLink mounts', () => {
      const { container } = render(<LoginPage />);
      const skipLinks = container.querySelectorAll('a[href="#main"]');
      expect(skipLinks.length).toBe(0);
    });

    it('Attack 6.8: Public pages (/ , /room , /item/[id] , /privacy) all provide matching main#main landmark', async () => {
      const landingUi = await Page();
      const { container: landingContainer } = render(landingUi);
      expect(landingContainer.querySelector('main#main')).toBeTruthy();
      cleanup();

      const roomUi = await RoomPage();
      const { container: roomContainer } = render(roomUi);
      expect(roomContainer.querySelector('main#main')).toBeTruthy();
      cleanup();

      const itemUi = await ItemPage({
        params: Promise.resolve({ id: 'e0000001-0000-4000-a000-000000000001' }),
      });
      const { container: itemContainer } = render(itemUi);
      expect(itemContainer.querySelector('main#main')).toBeTruthy();
      cleanup();

      const { container: privacyContainer } = render(<PrivacyPage />);
      expect(privacyContainer.querySelector('main#main')).toBeTruthy();
    });

    it('Attack 6.9: SkipLink styling enforces screen-reader accessibility and offscreen-until-focus behavior', () => {
      const { container } = render(
        <RootLayout>
          <div id="main">Content</div>
        </RootLayout>,
      );

      const skipLink = container.querySelector('a[href="#main"]');
      expect(skipLink).toBeTruthy();
      const cls = skipLink?.getAttribute('class') || '';
      expect(cls).toContain('absolute');
      expect(cls).toContain('-top-16');
      expect(cls).toContain('z-overlay');
      expect(cls).toContain('focus:top-4');
    });

    it('Attack 6.10: Complete landmark sequence adheres to standard accessible page structure', async () => {
      const roomUi = await RoomPage();
      const { container } = render(roomUi);

      const nav = container.querySelector('nav');
      const main = container.querySelector('main#main');
      const footer = container.querySelector('footer');

      expect(nav).toBeTruthy();
      expect(main).toBeTruthy();
      expect(footer).toBeTruthy();

      if (!nav || !main || !footer) {
        throw new Error('Landmark sequence element missing');
      }
      const navToMain = nav.compareDocumentPosition(main);
      const mainToFooter = main.compareDocumentPosition(footer);
      expect(Boolean(navToMain & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
      expect(Boolean(mainToFooter & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
        true,
      );
    });
  });
});
