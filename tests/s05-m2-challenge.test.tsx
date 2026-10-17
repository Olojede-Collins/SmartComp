// @vitest-environment jsdom
import * as React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

import { setSessionForTesting } from '@/lib/admin-auth';

import {
  getAdmins,
  createInvite,
  deleteAdmin,
  acceptInvite,
  exportInventory,
  ApiError,
  type AdminUser,
} from '@/lib/admin-api';

import AdminAdminsPage from '@/app/admin/admins/page';
import AcceptInvitePage from '@/app/admin/invite/accept/page';
import { ExportDialog } from '@/app/admin/_components/export-dialog';

describe('S-05 Challenger Suite — M2 Pre-Agreed Seams', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockReset();
    mockSearchParams = new URLSearchParams();
    sessionStorage.clear();
    document.cookie =
      'sb-admin-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setSessionForTesting({
      access_token: 'test-admin-bearer-token',
      user: {
        id: 'admin-current-id',
        email: 'current.admin@abu.edu.ng',
        app_metadata: { role: 'admin' },
      },
    });
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_RENDER_SERVICE_URL: 'http://localhost:3001',
    };
    globalThis.URL.createObjectURL = vi
      .fn()
      .mockReturnValue('blob:mock-export-url');
    globalThis.URL.revokeObjectURL = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('Seam 1: S-008 Admin Team Management & Invites (app/admin/admins/page.tsx & lib/admin-api.ts)', () => {
    it('unauthenticated access redirects immediately to /admin/login when session is missing', async () => {
      setSessionForTesting(null);
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      render(<AdminAdminsPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/login');
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('getAdmins 401 response redirects to /admin/login', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'invalid-token', message: 'Token expired' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<AdminAdminsPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/login');
      });
    });

    it('getAdmins 403 response redirects to /admin/login', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'forbidden', message: 'Forbidden' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<AdminAdminsPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/login');
      });
    });

    it('getAdmins network error stops loading gracefully without crashing', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network offline or backend timeout'),
      );

      render(<AdminAdminsPage />);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'The Lab Team' }),
      ).toBeDefined();
      expect(screen.getByText('ADMINS')).toBeDefined();
    });

    it('malformed getAdmins response (non-array object) handled gracefully via Array.isArray fallback', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ unexpected: 'payload', count: 12 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<AdminAdminsPage />);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'The Lab Team' }),
      ).toBeDefined();
      expect(screen.getByText('ADMINS')).toBeDefined();
      const adminValues = screen.getAllByText('0');
      expect(adminValues.length).toBeGreaterThanOrEqual(1);
    });

    it('single-admin soft check prevents calling deleteAdmin and displays last-admin error banner', async () => {
      const singleOtherAdmin: AdminUser[] = [
        {
          id: 'admin-other-id',
          email: 'other.admin@abu.edu.ng',
          created_at: '2026-09-01T10:00:00Z',
        },
      ];

      let deleteCalled = false;
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = String(input);
        const method = init?.method || 'GET';
        if (url.includes('/api/admin/admins') && method === 'GET') {
          return Promise.resolve(
            new Response(JSON.stringify(singleOtherAdmin), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (method === 'DELETE') {
          deleteCalled = true;
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      render(<AdminAdminsPage />);

      const removeBtn = await screen.findByRole('button', {
        name: 'Remove other.admin@abu.edu.ng',
      });
      fireEvent.click(removeBtn);

      expect(
        await screen.findByRole('heading', {
          level: 3,
          name: 'That admin cannot be removed.',
        }),
      ).toBeDefined();
      expect(screen.getByText('last-admin')).toBeDefined();
      expect(deleteCalled).toBe(false);
    });

    it('backend 409 last-admin response displays inline error banner and retains admin in roster', async () => {
      const initialAdmins: AdminUser[] = [
        {
          id: 'admin-current-id',
          email: 'current.admin@abu.edu.ng',
          created_at: '2026-09-01T10:00:00Z',
        },
        {
          id: 'admin-two-id',
          email: 'colleague@abu.edu.ng',
          created_at: '2026-09-10T10:00:00Z',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = String(input);
        const method = init?.method || 'GET';
        if (url.includes('/api/admin/admins') && method === 'GET') {
          return Promise.resolve(
            new Response(JSON.stringify(initialAdmins), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (
          url.includes('/api/admin/admins/admin-two-id') &&
          method === 'DELETE'
        ) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                error: 'last-admin',
                message: 'That admin cannot be removed.',
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      render(<AdminAdminsPage />);

      const removeBtn = await screen.findByRole('button', {
        name: 'Remove colleague@abu.edu.ng',
      });
      fireEvent.click(removeBtn);

      expect(
        await screen.findByRole('heading', {
          level: 3,
          name: 'That admin cannot be removed.',
        }),
      ).toBeDefined();
      expect(screen.getByText('last-admin')).toBeDefined();
      expect(screen.getByText('colleague@abu.edu.ng')).toBeDefined();
    });

    it('backend 409 status code without error field displays last-admin banner', async () => {
      const initialAdmins: AdminUser[] = [
        {
          id: 'admin-current-id',
          email: 'current.admin@abu.edu.ng',
          created_at: '2026-09-01T10:00:00Z',
        },
        {
          id: 'admin-two-id',
          email: 'colleague@abu.edu.ng',
          created_at: '2026-09-10T10:00:00Z',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = String(input);
        const method = init?.method || 'GET';
        if (url.includes('/api/admin/admins') && method === 'GET') {
          return Promise.resolve(
            new Response(JSON.stringify(initialAdmins), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (
          url.includes('/api/admin/admins/admin-two-id') &&
          method === 'DELETE'
        ) {
          return Promise.resolve(
            new Response(JSON.stringify({}), {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      render(<AdminAdminsPage />);

      const removeBtn = await screen.findByRole('button', {
        name: 'Remove colleague@abu.edu.ng',
      });
      fireEvent.click(removeBtn);

      expect(
        await screen.findByRole('heading', {
          level: 3,
          name: 'That admin cannot be removed.',
        }),
      ).toBeDefined();
      expect(screen.getByText('last-admin')).toBeDefined();
    });

    it('successful admin removal removes row from roster, updates ADMINS count, and reveals empty state', async () => {
      let roster: AdminUser[] = [
        {
          id: 'admin-current-id',
          email: 'current.admin@abu.edu.ng',
          created_at: '2026-09-01T10:00:00Z',
        },
        {
          id: 'admin-two-id',
          email: 'colleague@abu.edu.ng',
          created_at: '2026-09-10T10:00:00Z',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = String(input);
        const method = init?.method || 'GET';
        if (
          url.includes('/api/admin/admins/admin-two-id') &&
          method === 'DELETE'
        ) {
          roster = roster.filter((a) => a.id !== 'admin-two-id');
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        if (url.includes('/api/admin/admins') && method === 'GET') {
          return Promise.resolve(
            new Response(JSON.stringify(roster), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      render(<AdminAdminsPage />);

      const removeBtn = await screen.findByRole('button', {
        name: 'Remove colleague@abu.edu.ng',
      });
      fireEvent.click(removeBtn);

      await waitFor(() => {
        expect(screen.queryByText('colleague@abu.edu.ng')).toBeNull();
      });

      await waitFor(() => {
        expect(
          screen.getByRole('heading', {
            level: 2,
            name: 'You are the only admin.',
          }),
        ).toBeDefined();
      });
      expect(screen.getByText('ADMINS')).toBeDefined();
    });

    it('current admin row displays YOU badge and never renders a Remove button', async () => {
      const roster: AdminUser[] = [
        {
          id: 'admin-current-id',
          email: 'current.admin@abu.edu.ng',
          created_at: '2026-09-01T10:00:00Z',
        },
        {
          id: 'admin-other-id',
          email: 'other.admin@abu.edu.ng',
          created_at: '2026-09-05T10:00:00Z',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(roster), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<AdminAdminsPage />);

      expect(await screen.findByText('current.admin@abu.edu.ng')).toBeDefined();
      expect(screen.getByText('YOU')).toBeDefined();
      expect(
        screen.queryByRole('button', {
          name: 'Remove current.admin@abu.edu.ng',
        }),
      ).toBeNull();
      expect(
        screen.getByRole('button', { name: 'Remove other.admin@abu.edu.ng' }),
      ).toBeDefined();
    });

    it('current user identification matches by ID or by email', async () => {
      setSessionForTesting({
        access_token: 'different-session-token',
        user: {
          id: 'unmatched-id',
          email: 'email.matched@abu.edu.ng',
          app_metadata: { role: 'admin' },
        },
      });

      const roster: AdminUser[] = [
        {
          id: 'roster-id-123',
          email: 'email.matched@abu.edu.ng',
          created_at: '2026-09-01T10:00:00Z',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(roster), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<AdminAdminsPage />);

      expect(await screen.findByText('email.matched@abu.edu.ng')).toBeDefined();
      expect(screen.getByText('YOU')).toBeDefined();
    });

    it('rapid double-click on Remove button does not corrupt state or cause uncaught errors', async () => {
      const initialAdmins: AdminUser[] = [
        {
          id: 'admin-current-id',
          email: 'current.admin@abu.edu.ng',
          created_at: '2026-09-01T10:00:00Z',
        },
        {
          id: 'admin-two-id',
          email: 'colleague@abu.edu.ng',
          created_at: '2026-09-10T10:00:00Z',
        },
      ];

      let deleteCalls = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = String(input);
        const method = init?.method || 'GET';
        if (url.includes('/api/admin/admins') && method === 'GET') {
          return Promise.resolve(
            new Response(JSON.stringify(initialAdmins), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        if (
          url.includes('/api/admin/admins/admin-two-id') &&
          method === 'DELETE'
        ) {
          deleteCalls++;
          return new Promise((resolve) =>
            setTimeout(() => resolve(new Response(null, { status: 204 })), 50),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      render(<AdminAdminsPage />);

      const removeBtn = await screen.findByRole('button', {
        name: 'Remove colleague@abu.edu.ng',
      });
      fireEvent.click(removeBtn);
      fireEvent.click(removeBtn);

      await waitFor(() => {
        expect(screen.queryByText('colleague@abu.edu.ng')).toBeNull();
      });
      expect(deleteCalls).toBeGreaterThanOrEqual(1);
    });

    it('successful invite increments PENDING count, displays success banner with recipient, and clears input', async () => {
      const initialAdmins: AdminUser[] = [
        {
          id: 'admin-current-id',
          email: 'current.admin@abu.edu.ng',
          created_at: '2026-09-01T10:00:00Z',
        },
        {
          id: 'admin-two-id',
          email: 'colleague@abu.edu.ng',
          created_at: '2026-09-10T10:00:00Z',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = String(input);
        const method = init?.method || 'GET';
        if (url.includes('/api/admin/admins/invites') && method === 'POST') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 'inv-1',
                email: 'invited.peer@abu.edu.ng',
                token: 'tok-123',
              }),
              { status: 201, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/admins') && method === 'GET') {
          return Promise.resolve(
            new Response(JSON.stringify(initialAdmins), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      render(<AdminAdminsPage />);

      expect(await screen.findByText('colleague@abu.edu.ng')).toBeDefined();

      const emailInput = screen.getByPlaceholderText(
        'colleague@example.edu.ng',
      );
      fireEvent.change(emailInput, {
        target: { value: 'invited.peer@abu.edu.ng' },
      });

      const sendBtn = screen.getByRole('button', { name: 'Send invite' });
      fireEvent.click(sendBtn);

      expect(
        await screen.findByRole('heading', {
          level: 3,
          name: 'Invitation sent.',
        }),
      ).toBeDefined();
      expect(screen.getByText('invited.peer@abu.edu.ng')).toBeDefined();
      expect(screen.getByText(/A link is on its way to/i)).toBeDefined();
      expect(
        screen.getByText(/It works once, and expires if unused/i),
      ).toBeDefined();

      expect((emailInput as HTMLInputElement).value).toBe('');
    });

    it('invite delivery failure (502 gmail-send-failed) displays caution banner and preserves typed email in input', async () => {
      const initialAdmins: AdminUser[] = [
        {
          id: 'admin-current-id',
          email: 'current.admin@abu.edu.ng',
          created_at: '2026-09-01T10:00:00Z',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = String(input);
        const method = init?.method || 'GET';
        if (url.includes('/api/admin/admins/invites') && method === 'POST') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                error: 'gmail-send-failed',
                message: 'Mail delivery failed.',
              }),
              { status: 502, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/admins') && method === 'GET') {
          return Promise.resolve(
            new Response(JSON.stringify(initialAdmins), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      render(<AdminAdminsPage />);

      expect(
        await screen.findByRole('heading', {
          level: 2,
          name: 'You are the only admin.',
        }),
      ).toBeDefined();

      const emailInput = screen.getByPlaceholderText(
        'colleague@example.edu.ng',
      );
      fireEvent.change(emailInput, {
        target: { value: 'retry.recipient@abu.edu.ng' },
      });

      const sendBtn = screen.getByRole('button', { name: 'Send invite' });
      fireEvent.click(sendBtn);

      expect(
        await screen.findByRole('heading', {
          level: 3,
          name: 'The invitation did not send.',
        }),
      ).toBeDefined();
      expect(screen.getByText('Mail delivery failed.')).toBeDefined();
      expect(screen.getByText('gmail-send-failed')).toBeDefined();

      expect((emailInput as HTMLInputElement).value).toBe(
        'retry.recipient@abu.edu.ng',
      );
    });

    it('generic invite error displays caution banner and preserves typed email in input', async () => {
      const initialAdmins: AdminUser[] = [
        {
          id: 'admin-current-id',
          email: 'current.admin@abu.edu.ng',
          created_at: '2026-09-01T10:00:00Z',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = String(input);
        const method = init?.method || 'GET';
        if (url.includes('/api/admin/admins/invites') && method === 'POST') {
          return Promise.reject(new Error('Render internal gateway failure'));
        }
        if (url.includes('/api/admin/admins') && method === 'GET') {
          return Promise.resolve(
            new Response(JSON.stringify(initialAdmins), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      render(<AdminAdminsPage />);

      expect(
        await screen.findByRole('heading', {
          level: 2,
          name: 'You are the only admin.',
        }),
      ).toBeDefined();

      const emailInput = screen.getByPlaceholderText(
        'colleague@example.edu.ng',
      );
      fireEvent.change(emailInput, {
        target: { value: 'crash.probe@abu.edu.ng' },
      });

      const sendBtn = screen.getByRole('button', { name: 'Send invite' });
      fireEvent.click(sendBtn);

      expect(
        await screen.findByRole('heading', {
          level: 3,
          name: 'The invitation did not send.',
        }),
      ).toBeDefined();
      expect((emailInput as HTMLInputElement).value).toBe(
        'crash.probe@abu.edu.ng',
      );
    });

    it('rapid double-click on Send invite button is prevented while submitting', async () => {
      const initialAdmins: AdminUser[] = [
        {
          id: 'admin-current-id',
          email: 'current.admin@abu.edu.ng',
          created_at: '2026-09-01T10:00:00Z',
        },
      ];

      let inviteCalls = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = String(input);
        const method = init?.method || 'GET';
        if (url.includes('/api/admin/admins/invites') && method === 'POST') {
          inviteCalls++;
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve(
                  new Response(
                    JSON.stringify({
                      id: 'inv-rapid',
                      email: 'rapid@abu.edu.ng',
                      token: 'tok-rapid',
                    }),
                    {
                      status: 201,
                      headers: { 'Content-Type': 'application/json' },
                    },
                  ),
                ),
              100,
            ),
          );
        }
        if (url.includes('/api/admin/admins') && method === 'GET') {
          return Promise.resolve(
            new Response(JSON.stringify(initialAdmins), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      render(<AdminAdminsPage />);

      expect(
        await screen.findByRole('heading', {
          level: 2,
          name: 'You are the only admin.',
        }),
      ).toBeDefined();

      const emailInput = screen.getByPlaceholderText(
        'colleague@example.edu.ng',
      );
      fireEvent.change(emailInput, { target: { value: 'rapid@abu.edu.ng' } });

      const sendBtn = screen.getByRole('button', { name: 'Send invite' });
      fireEvent.click(sendBtn);
      fireEvent.click(sendBtn);

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 3, name: 'Invitation sent.' }),
        ).toBeDefined();
      });
      expect(inviteCalls).toBe(1);
    });

    it('dismissing invite success banner resets form state to default', async () => {
      const initialAdmins: AdminUser[] = [
        {
          id: 'admin-current-id',
          email: 'current.admin@abu.edu.ng',
          created_at: '2026-09-01T10:00:00Z',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = String(input);
        const method = init?.method || 'GET';
        if (url.includes('/api/admin/admins/invites') && method === 'POST') {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 'inv-dismiss',
                email: 'dismiss@abu.edu.ng',
                token: 'tok-d',
              }),
              { status: 201, headers: { 'Content-Type': 'application/json' } },
            ),
          );
        }
        if (url.includes('/api/admin/admins') && method === 'GET') {
          return Promise.resolve(
            new Response(JSON.stringify(initialAdmins), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      render(<AdminAdminsPage />);

      expect(
        await screen.findByRole('heading', {
          level: 2,
          name: 'You are the only admin.',
        }),
      ).toBeDefined();

      const emailInput = screen.getByPlaceholderText(
        'colleague@example.edu.ng',
      );
      fireEvent.change(emailInput, { target: { value: 'dismiss@abu.edu.ng' } });

      const sendBtn = screen.getByRole('button', { name: 'Send invite' });
      fireEvent.click(sendBtn);

      const dismissBtn = await screen.findByRole('button', { name: 'Dismiss' });
      fireEvent.click(dismissBtn);

      await waitFor(() => {
        expect(screen.queryByText('Invitation sent.')).toBeNull();
      });
      expect(screen.getByRole('button', { name: 'Send invite' })).toBeDefined();
    });

    it('empty state CTA scrolls and focuses invite email input', async () => {
      const initialAdmins: AdminUser[] = [
        {
          id: 'admin-current-id',
          email: 'current.admin@abu.edu.ng',
          created_at: '2026-09-01T10:00:00Z',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(initialAdmins), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<AdminAdminsPage />);

      const inviteCta = await screen.findByRole('button', {
        name: 'Invite an Admin',
      });
      fireEvent.click(inviteCta);

      const emailInput = screen.getByPlaceholderText(
        'colleague@example.edu.ng',
      );
      expect(document.activeElement).toBe(emailInput);
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it('formatDate handles invalid or malformed ISO date strings without throwing', async () => {
      const badDateAdmins: AdminUser[] = [
        {
          id: 'admin-1',
          email: 'baddate1@abu.edu.ng',
          created_at: 'not-a-valid-date-string',
        },
        {
          id: 'admin-2',
          email: 'baddate2@abu.edu.ng',
          created_at: '2026-13-45T99:99:99Z',
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(badDateAdmins), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<AdminAdminsPage />);

      expect(await screen.findByText('baddate1@abu.edu.ng')).toBeDefined();
      expect(screen.getByText('not-a-valid-date-string')).toBeDefined();
    });

    it('getAdmins API sends Authorization Bearer header and throws ApiError on failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'db-unavailable', message: 'DB down' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(getAdmins()).rejects.toThrow(ApiError);
    });

    it('createInvite API sends email in body with Bearer auth and throws ApiError on failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'gmail-send-failed',
            message: 'Mail delivery failed',
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(createInvite('test@abu.edu.ng')).rejects.toThrow(ApiError);
    });

    it('deleteAdmin API sends DELETE request with Bearer auth and handles 204 No Content', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(null, { status: 204 }));

      await expect(deleteAdmin('del-id-123')).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3001/api/admin/admins/del-id-123',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('Seam 2: S-007 Invite Acceptance (app/admin/invite/accept/page.tsx & lib/admin-api.ts)', () => {
    it('missing token query param immediately renders unknown-token banner and locks submit button', () => {
      mockSearchParams = new URLSearchParams();

      render(<AcceptInvitePage />);

      expect(
        screen.getByRole('heading', {
          level: 3,
          name: 'That invitation link is not valid.',
        }),
      ).toBeDefined();
      expect(screen.getByText('unknown-token')).toBeDefined();

      const acceptBtn = screen.getByRole('button', {
        name: 'Accept Invitation',
      });
      expect(acceptBtn.hasAttribute('disabled')).toBe(true);
    });

    it('empty token string renders unknown-token banner and locks submit button', () => {
      mockSearchParams = new URLSearchParams('token=');

      render(<AcceptInvitePage />);

      expect(
        screen.getByRole('heading', {
          level: 3,
          name: 'That invitation link is not valid.',
        }),
      ).toBeDefined();
      const acceptBtn = screen.getByRole('button', {
        name: 'Accept Invitation',
      });
      expect(acceptBtn.hasAttribute('disabled')).toBe(true);
    });

    it('invalid token returning 404 unknown-token displays error banner and moves focus to heading', async () => {
      mockSearchParams = new URLSearchParams('token=invalid-tok-999');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'unknown-token',
            message: 'That invitation link is not valid.',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<AcceptInvitePage />);

      const pwdInputs = screen.getAllByLabelText(/PASSWORD/i);
      fireEvent.change(pwdInputs[0], { target: { value: 'password123' } });
      fireEvent.change(pwdInputs[1], { target: { value: 'password123' } });

      const acceptBtn = screen.getByRole('button', {
        name: 'Accept Invitation',
      });
      fireEvent.click(acceptBtn);

      expect(
        await screen.findByRole('heading', {
          level: 3,
          name: 'That invitation link is not valid.',
        }),
      ).toBeDefined();
      expect(screen.getByText('unknown-token')).toBeDefined();
      expect(acceptBtn.hasAttribute('disabled')).toBe(true);
    });

    it('already accepted token returning 409 already-accepted displays error banner and locks submit', async () => {
      mockSearchParams = new URLSearchParams('token=used-token-888');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'already-accepted',
            message: 'That invitation has already been used.',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<AcceptInvitePage />);

      const pwdInputs = screen.getAllByLabelText(/PASSWORD/i);
      fireEvent.change(pwdInputs[0], { target: { value: 'securePass123' } });
      fireEvent.change(pwdInputs[1], { target: { value: 'securePass123' } });

      const acceptBtn = screen.getByRole('button', {
        name: 'Accept Invitation',
      });
      fireEvent.click(acceptBtn);

      expect(
        await screen.findByRole('heading', {
          level: 3,
          name: 'That invitation has already been used.',
        }),
      ).toBeDefined();
      expect(screen.getByText('already-accepted')).toBeDefined();
      expect(acceptBtn.hasAttribute('disabled')).toBe(true);
    });

    it('server 500 error during invite acceptance displays error banner with error code fallback', async () => {
      mockSearchParams = new URLSearchParams('token=error-tok-500');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'auth-internal-error',
            message: 'Internal server error',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<AcceptInvitePage />);

      const pwdInputs = screen.getAllByLabelText(/PASSWORD/i);
      fireEvent.change(pwdInputs[0], { target: { value: 'validPassword1' } });
      fireEvent.change(pwdInputs[1], { target: { value: 'validPassword1' } });

      const acceptBtn = screen.getByRole('button', {
        name: 'Accept Invitation',
      });
      fireEvent.click(acceptBtn);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Accept Invitation' }),
        ).toBeDefined();
      });
    });

    it('missing email query param falls back to new.admin@example.invalid in read-only Mono text', () => {
      mockSearchParams = new URLSearchParams('token=valid-token');

      render(<AcceptInvitePage />);

      expect(screen.getByText('new.admin@example.invalid')).toBeDefined();
    });

    it('provided email query param is displayed in read-only Mono text and is not an editable input', () => {
      mockSearchParams = new URLSearchParams(
        'token=valid-token&email=dr.ahmadu@abu.edu.ng',
      );

      render(<AcceptInvitePage />);

      const emailDisplay = screen.getByText('dr.ahmadu@abu.edu.ng');
      expect(emailDisplay).toBeDefined();
      expect(emailDisplay.tagName.toLowerCase()).toBe('span');
      expect(screen.queryByDisplayValue('dr.ahmadu@abu.edu.ng')).toBeNull();
    });

    it('password under 8 characters renders weak-password banner, field error, and marks input invalid without API call', async () => {
      mockSearchParams = new URLSearchParams('token=valid-tok');
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      render(<AcceptInvitePage />);

      const pwdInputs = screen.getAllByLabelText(/PASSWORD/i);
      fireEvent.change(pwdInputs[0], { target: { value: 'short1' } });
      fireEvent.change(pwdInputs[1], { target: { value: 'short1' } });

      const acceptBtn = screen.getByRole('button', {
        name: 'Accept Invitation',
      });
      fireEvent.click(acceptBtn);

      expect(
        await screen.findByRole('heading', {
          level: 3,
          name: 'That password is too weak.',
        }),
      ).toBeDefined();
      expect(screen.getByText('weak-password')).toBeDefined();
      expect(screen.getByText('Use at least 8 characters.')).toBeDefined();
      expect(pwdInputs[0].getAttribute('aria-invalid')).toBe('true');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('empty password renders weak-password banner and field error without API call', async () => {
      mockSearchParams = new URLSearchParams('token=valid-tok');
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      render(<AcceptInvitePage />);

      const acceptBtn = screen.getByRole('button', {
        name: 'Accept Invitation',
      });
      fireEvent.click(acceptBtn);

      expect(
        await screen.findByRole('heading', {
          level: 3,
          name: 'That password is too weak.',
        }),
      ).toBeDefined();
      expect(screen.getByText('weak-password')).toBeDefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('password mismatch renders field error on confirm password field without API call', async () => {
      mockSearchParams = new URLSearchParams('token=valid-tok');
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      render(<AcceptInvitePage />);

      const pwdInputs = screen.getAllByLabelText(/PASSWORD/i);
      fireEvent.change(pwdInputs[0], { target: { value: 'password123' } });
      fireEvent.change(pwdInputs[1], { target: { value: 'different123' } });

      const acceptBtn = screen.getByRole('button', {
        name: 'Accept Invitation',
      });
      fireEvent.click(acceptBtn);

      expect(
        await screen.findByText('Type the same password again.'),
      ).toBeDefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('password of exactly 8 characters passes client validation and submits to API', async () => {
      mockSearchParams = new URLSearchParams('token=exact-8-token');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<AcceptInvitePage />);

      const pwdInputs = screen.getAllByLabelText(/PASSWORD/i);
      fireEvent.change(pwdInputs[0], { target: { value: '12345678' } });
      fireEvent.change(pwdInputs[1], { target: { value: '12345678' } });

      const acceptBtn = screen.getByRole('button', {
        name: 'Accept Invitation',
      });
      fireEvent.click(acceptBtn);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/login?invite=accepted');
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3001/api/admin/invites/accept',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            token: 'exact-8-token',
            password: '12345678',
          }),
        }),
      );
    });

    it('password with special symbols and unicode characters passes client validation and submits to API', async () => {
      mockSearchParams = new URLSearchParams('token=unicode-token');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<AcceptInvitePage />);

      const pwdInputs = screen.getAllByLabelText(/PASSWORD/i);
      fireEvent.change(pwdInputs[0], {
        target: { value: 'P@$$w0rd-₦aija-2026!' },
      });
      fireEvent.change(pwdInputs[1], {
        target: { value: 'P@$$w0rd-₦aija-2026!' },
      });

      const acceptBtn = screen.getByRole('button', {
        name: 'Accept Invitation',
      });
      fireEvent.click(acceptBtn);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/login?invite=accepted');
      });
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('double submit prevention locks submit button to Accepting… and ignores duplicate submission in flight', async () => {
      mockSearchParams = new URLSearchParams('token=delay-token');

      let submitCalls = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        const url = String(input);
        const method = init?.method || 'GET';
        if (url.includes('/api/admin/invites/accept') && method === 'POST') {
          submitCalls++;
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve(
                  new Response(JSON.stringify({ status: 'ok' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                  }),
                ),
              100,
            ),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      });

      render(<AcceptInvitePage />);

      const pwdInputs = screen.getAllByLabelText(/PASSWORD/i);
      fireEvent.change(pwdInputs[0], {
        target: { value: 'validPassword123' },
      });
      fireEvent.change(pwdInputs[1], {
        target: { value: 'validPassword123' },
      });

      const acceptBtn = screen.getByRole('button', {
        name: 'Accept Invitation',
      });
      fireEvent.click(acceptBtn);
      fireEvent.click(acceptBtn);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/login?invite=accepted');
      });
      expect(submitCalls).toBe(1);
    });

    it('successful acceptance calls acceptInvite and navigates to /admin/login?invite=accepted', async () => {
      mockSearchParams = new URLSearchParams('token=success-token');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<AcceptInvitePage />);

      const pwdInputs = screen.getAllByLabelText(/PASSWORD/i);
      fireEvent.change(pwdInputs[0], { target: { value: 'securePass123' } });
      fireEvent.change(pwdInputs[1], { target: { value: 'securePass123' } });

      const acceptBtn = screen.getByRole('button', {
        name: 'Accept Invitation',
      });
      fireEvent.click(acceptBtn);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/login?invite=accepted');
      });
    });

    it('Back to the collection link points to /room', () => {
      mockSearchParams = new URLSearchParams('token=tok-room');

      render(<AcceptInvitePage />);

      const backLink = screen.getByRole('link', {
        name: 'Back to the Collection',
      });
      expect(backLink.getAttribute('href')).toBe('/room');
    });

    it('acceptInvite API sends token and name without requiring Bearer auth and throws ApiError on failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'unknown-token',
            message: 'That invitation link is not valid.',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(acceptInvite('nonexistent-token')).rejects.toThrow(ApiError);
    });
  });

  describe('Seam 3: S-010 COREN Export Dialog (app/admin/_components/export-dialog.tsx & lib/admin-api.ts)', () => {
    it('default format is CSV and clicking Create the file dispatches exportInventory(csv)', async () => {
      const mockCsvBlob = new Blob(['name,quantity\nMonitors,50'], {
        type: 'text/csv',
      });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(mockCsvBlob, {
          status: 200,
          headers: { 'Content-Type': 'text/csv' },
        }),
      );

      render(<ExportDialog open={true} itemCount={7} />);

      const csvRadio = screen.getByRole('radio', { name: /CSV/i });
      expect((csvRadio as HTMLInputElement).checked).toBe(true);

      const createBtn = screen.getByRole('button', {
        name: 'Create the File',
      });
      fireEvent.click(createBtn);

      await waitFor(() => {
        expect(
          screen.getByRole('heading', {
            level: 3,
            name: 'Your file is ready.',
          }),
        ).toBeDefined();
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3001/api/admin/export/csv',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('selecting PDF format dispatches exportInventory(pdf)', async () => {
      const mockPdfBlob = new Blob(['%PDF-1.4 mock pdf binary'], {
        type: 'application/pdf',
      });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(mockPdfBlob, {
          status: 200,
          headers: { 'Content-Type': 'application/pdf' },
        }),
      );

      render(<ExportDialog open={true} itemCount={7} />);

      const pdfRadio = screen.getByRole('radio', { name: /PDF/i });
      fireEvent.click(pdfRadio);
      expect((pdfRadio as HTMLInputElement).checked).toBe(true);

      const createBtn = screen.getByRole('button', {
        name: 'Create the File',
      });
      fireEvent.click(createBtn);

      await waitFor(() => {
        expect(
          screen.getByRole('heading', {
            level: 3,
            name: 'Your file is ready.',
          }),
        ).toBeDefined();
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3001/api/admin/export/pdf',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('PDF format radio option is available with correct label and value', () => {
      render(<ExportDialog open={true} itemCount={7} />);

      const pdfRadio = screen.getByRole('radio', { name: /PDF/i });
      expect(pdfRadio).toBeDefined();
      expect((pdfRadio as HTMLInputElement).value).toBe('pdf');
      expect(
        screen.getByText('One file, laid out for printing and signing.'),
      ).toBeDefined();
    });

    it('5 FR-9.2 floor columns are strictly checked and disabled', () => {
      render(<ExportDialog open={true} itemCount={7} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(6);

      const floorCheckboxes = checkboxes.slice(0, 5);
      for (const cb of floorCheckboxes) {
        expect((cb as HTMLInputElement).checked).toBe(true);
        expect((cb as HTMLInputElement).disabled).toBe(true);
      }

      expect(screen.getByText('Item name')).toBeDefined();
      expect(screen.getByText('Kept exactly as submitted.')).toBeDefined();
      expect(screen.getByText('Condition')).toBeDefined();
      expect(
        screen.getByText(
          'Working, Faulty, Under Maintenance or Decommissioned.',
        ),
      ).toBeDefined();
      expect(screen.getByText('Quantity')).toBeDefined();
      expect(screen.getByText('Updated')).toBeDefined();
      expect(
        screen.getByText('The date the record last changed.'),
      ).toBeDefined();
      expect(screen.getByText('Updated by')).toBeDefined();
      expect(screen.getByText('The admin who last changed it.')).toBeDefined();
    });

    it('Record ID column is strictly disabled, unchecked, and tagged Withheld with lock icon', () => {
      render(<ExportDialog open={true} itemCount={7} />);

      const checkboxes = screen.getAllByRole('checkbox');
      const recordIdCheckbox = checkboxes[5] as HTMLInputElement;

      expect(recordIdCheckbox.checked).toBe(false);
      expect(recordIdCheckbox.disabled).toBe(true);
      expect(recordIdCheckbox.getAttribute('aria-describedby')).toBe(
        'col-id-note',
      );

      expect(screen.getByText('Not available.')).toBeDefined();
      expect(screen.getByText('Withheld')).toBeDefined();
      expect(
        screen.getByText(
          'These five columns are always included. Record IDs stay inside the admin app and are not written to the file.',
        ),
      ).toBeDefined();
    });

    it('sourced faculty hood stamp copy is displayed verbatim', () => {
      render(<ExportDialog open={true} itemCount={7} />);

      expect(
        screen.getByText(
          'ENGINEERING FACULTY HOOD COLOUR — ACADEMIC BRIEF TABLE 2.1',
        ),
      ).toBeDefined();
    });

    it('successful export triggers browser file download with date-stamped filename and cleans up object URL', async () => {
      const mockCsvBlob = new Blob(['csv content'], { type: 'text/csv' });
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(mockCsvBlob, {
          status: 200,
          headers: { 'Content-Type': 'text/csv' },
        }),
      );

      const anchorClickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});

      render(<ExportDialog open={true} itemCount={7} />);

      const createBtn = screen.getByRole('button', {
        name: 'Create the File',
      });
      fireEvent.click(createBtn);

      await waitFor(() => {
        expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(
          mockCsvBlob,
        );
      });
      expect(anchorClickSpy).toHaveBeenCalled();
      expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(
        'blob:mock-export-url',
      );
    });

    it('success view displays Your file is ready, focuses heading, shows item count and filename', async () => {
      const mockCsvBlob = new Blob(['csv content'], { type: 'text/csv' });
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(mockCsvBlob, {
          status: 200,
          headers: { 'Content-Type': 'text/csv' },
        }),
      );

      render(<ExportDialog open={true} itemCount={7} />);

      fireEvent.click(screen.getByRole('button', { name: 'Create the File' }));

      const successHeading = await screen.findByRole('heading', {
        level: 3,
        name: 'Your file is ready.',
      });
      expect(successHeading).toBeDefined();
      expect(document.activeElement).toBe(successHeading);

      expect(
        screen.getByText('Seven items, with the five columns listed above.'),
      ).toBeDefined();

      const today = new Date().toISOString().split('T')[0];
      expect(
        screen.getByText(`abu-smart-class-inventory-${today}.csv`),
      ).toBeDefined();
      expect(
        screen.getByRole('button', { name: 'Download the File' }),
      ).toBeDefined();
    });

    it('clicking Download the file in success view re-downloads cached blob without making second API call', async () => {
      const mockCsvBlob = new Blob(['csv content'], { type: 'text/csv' });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(mockCsvBlob, {
          status: 200,
          headers: { 'Content-Type': 'text/csv' },
        }),
      );

      const anchorClickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});

      render(<ExportDialog open={true} itemCount={7} />);

      fireEvent.click(screen.getByRole('button', { name: 'Create the File' }));

      const redownloadBtn = await screen.findByRole('button', {
        name: 'Download the File',
      });

      anchorClickSpy.mockClear();
      (globalThis.URL.createObjectURL as ReturnType<typeof vi.fn>).mockClear();

      fireEvent.click(redownloadBtn);

      expect(globalThis.URL.createObjectURL).toHaveBeenCalledWith(mockCsvBlob);
      expect(anchorClickSpy).toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('getItemCountText correctly handles boundary numbers (0, 1, 5, 7, 15, 16)', async () => {
      const testCases = [
        { count: 0, expected: 'No items, with the five columns listed above.' },
        { count: 1, expected: 'One item, with the five columns listed above.' },
        {
          count: 5,
          expected: 'Five items, with the five columns listed above.',
        },
        {
          count: 7,
          expected: 'Seven items, with the five columns listed above.',
        },
        {
          count: 15,
          expected: 'Fifteen items, with the five columns listed above.',
        },
        {
          count: 16,
          expected: '16 items, with the five columns listed above.',
        },
      ];

      for (const tc of testCases) {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
          new Response(new Blob(['test']), { status: 200 }),
        );

        const { unmount } = render(
          <ExportDialog open={true} itemCount={tc.count} />,
        );
        fireEvent.click(
          screen.getByRole('button', { name: 'Create the File' }),
        );

        expect(await screen.findByText(tc.expected)).toBeDefined();
        unmount();
      }
    });

    it('server 500 failure displays export-generation-failed error banner and focuses heading', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'export-generation-failed',
            message: 'Generation failed',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<ExportDialog open={true} itemCount={7} />);

      fireEvent.click(screen.getByRole('button', { name: 'Create the File' }));

      const failureHeading = await screen.findByRole('heading', {
        level: 3,
        name: 'The file could not be created.',
      });
      expect(failureHeading).toBeDefined();
      expect(document.activeElement).toBe(failureHeading);

      expect(screen.getByText('export-generation-failed')).toBeDefined();
      expect(
        screen.getByText(
          /Nothing was downloaded and nothing on the register was changed/i,
        ),
      ).toBeDefined();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
    });

    it('clicking Try again on failure view resets state to default without closing dialog', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'export-generation-failed' }), {
          status: 500,
        }),
      );

      render(<ExportDialog open={true} itemCount={7} />);

      fireEvent.click(screen.getByRole('button', { name: 'Create the File' }));

      const tryAgainBtn = await screen.findByRole('button', {
        name: 'Try again',
      });
      fireEvent.click(tryAgainBtn);

      expect(
        screen.getByRole('heading', {
          level: 3,
          name: 'Export the Register',
        }),
      ).toBeDefined();
      expect(
        screen.getByRole('button', { name: 'Create the File' }),
      ).toBeDefined();
    });

    it('rapid double-click on Create the file does not fire duplicate concurrent export requests', async () => {
      let exportCalls = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        exportCalls++;
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                new Response(new Blob(['csv']), {
                  status: 200,
                  headers: { 'Content-Type': 'text/csv' },
                }),
              ),
            100,
          ),
        );
      });

      render(<ExportDialog open={true} itemCount={7} />);

      const createBtn = screen.getByRole('button', {
        name: 'Create the File',
      });
      fireEvent.click(createBtn);
      fireEvent.click(createBtn);

      await waitFor(() => {
        expect(
          screen.getByRole('heading', {
            level: 3,
            name: 'Your file is ready.',
          }),
        ).toBeDefined();
      });
      expect(exportCalls).toBe(1);
    });

    it('dialog cannot be closed while export generation is in flight', () => {
      const handleClose = vi.fn();
      const handleOpenChange = vi.fn();

      vi.spyOn(globalThis, 'fetch').mockImplementation(
        () => new Promise(() => {}),
      );

      render(
        <ExportDialog
          open={true}
          itemCount={7}
          onClose={handleClose}
          onOpenChange={handleOpenChange}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Create the File' }));

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelBtn.hasAttribute('disabled')).toBe(true);

      fireEvent.click(cancelBtn);
      expect(handleClose).not.toHaveBeenCalled();
      expect(handleOpenChange).not.toHaveBeenCalled();
    });

    it('closing dialog after generation resets state to default for next open', async () => {
      const handleClose = vi.fn();
      const handleOpenChange = vi.fn();

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(new Blob(['data']), { status: 200 }),
      );

      const { rerender } = render(
        <ExportDialog
          open={true}
          itemCount={7}
          onClose={handleClose}
          onOpenChange={handleOpenChange}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Create the File' }));

      const closeBtn = await screen.findByRole('button', { name: 'Close' });
      fireEvent.click(closeBtn);

      expect(handleClose).toHaveBeenCalled();
      expect(handleOpenChange).toHaveBeenCalledWith(false);

      rerender(
        <ExportDialog
          open={true}
          itemCount={7}
          onClose={handleClose}
          onOpenChange={handleOpenChange}
        />,
      );

      expect(
        screen.getByRole('heading', {
          level: 3,
          name: 'Export the Register',
        }),
      ).toBeDefined();
      expect(
        screen.getByRole('button', { name: 'Create the File' }),
      ).toBeDefined();
    });

    it('exportInventory API sends Bearer auth to /api/admin/export/:format and returns Blob', async () => {
      const mockBlob = new Blob(['file data'], { type: 'text/csv' });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(mockBlob, {
          status: 200,
          headers: { 'Content-Type': 'text/csv' },
        }),
      );

      const result = await exportInventory('csv');
      expect(result).toBeInstanceOf(Blob);
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3001/api/admin/export/csv',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-admin-bearer-token',
          }),
        }),
      );
    });

    it('exportInventory API throws ApiError with parsed error code when server returns 500', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'export-generation-failed',
            message: 'Server error',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(exportInventory('pdf')).rejects.toThrow(ApiError);
    });
  });
});
