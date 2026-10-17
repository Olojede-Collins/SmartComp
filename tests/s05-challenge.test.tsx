// @vitest-environment jsdom
import * as React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from '@testing-library/react';

const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

import {
  signInWithPassword,
  signOut,
  getSession,
  getToken,
  setSessionForTesting,
} from '@/lib/admin-auth';

import { getItems, type Equipment } from '@/lib/admin-api';

import LoginPage from '@/app/admin/login/page';
import AdminInventoryPage from '@/app/admin/page';
import NewItemPage from '@/app/admin/items/new/page';
import EditItemPage from '@/app/admin/items/[id]/page';
import { DeleteDialog } from '@/app/admin/_components/delete-dialog';

describe('S-05 Challenger Suite — M1 Pre-Agreed Seams', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockReset();
    mockSearchParams = new URLSearchParams();
    sessionStorage.clear();
    document.cookie =
      'sb-admin-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setSessionForTesting(null);
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://challenge.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'challenge-anon-key',
      NEXT_PUBLIC_RENDER_SERVICE_URL: 'http://localhost:3001',
    };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('Seam 1: Client Authentication & Session Edge Cases', () => {
    it('Attack 1: rejects non-admin role in JWT (role: viewer) with 403 forbidden', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'jwt-viewer',
            user: {
              id: 'usr-viewer',
              email: 'viewer@abu.edu.ng',
              app_metadata: { role: 'viewer' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        signInWithPassword('viewer@abu.edu.ng', 'pass12345'),
      ).rejects.toMatchObject({
        name: 'AuthError',
        code: 'forbidden',
        status: 403,
        message: 'Admin privileges required',
      });
      expect(getToken()).toBeNull();
    });

    it('Attack 2: rejects default authenticated role in JWT (role: authenticated) with 403 forbidden', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'jwt-authenticated-user',
            user: {
              id: 'usr-auth',
              email: 'student@abu.edu.ng',
              app_metadata: { role: 'authenticated' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        signInWithPassword('student@abu.edu.ng', 'studentpass'),
      ).rejects.toMatchObject({
        code: 'forbidden',
        status: 403,
      });
    });

    it('Attack 3: rejects missing role property inside app_metadata with 403 forbidden', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'jwt-empty-app-meta',
            user: {
              id: 'usr-empty-meta',
              email: 'empty@abu.edu.ng',
              app_metadata: {},
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        signInWithPassword('empty@abu.edu.ng', 'secret123'),
      ).rejects.toMatchObject({
        code: 'forbidden',
        status: 403,
      });
    });

    it('Attack 4: rejects completely missing app_metadata on user object with 403 forbidden', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'jwt-no-meta',
            user: {
              id: 'usr-no-meta',
              email: 'nometa@abu.edu.ng',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(
        signInWithPassword('nometa@abu.edu.ng', 'secret123'),
      ).rejects.toMatchObject({
        code: 'forbidden',
        status: 403,
      });
    });

    it('Attack 5: handles malformed 502 HTML response from GoTrue without throwing parse error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          '<html><body>502 Bad Gateway: Render Proxy Timeout</body></html>',
          {
            status: 502,
            headers: { 'Content-Type': 'text/html' },
          },
        ),
      );

      await expect(
        signInWithPassword('admin@abu.edu.ng', 'pass'),
      ).rejects.toMatchObject({
        name: 'AuthError',
        status: 502,
      });
    });

    it('Attack 6: handles 500 error with empty body without crashing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        }),
      );

      await expect(
        signInWithPassword('admin@abu.edu.ng', 'pass'),
      ).rejects.toMatchObject({
        name: 'AuthError',
        status: 500,
      });
    });

    it('Attack 7: recovers gracefully when sessionStorage holds corrupted non-JSON data', () => {
      sessionStorage.setItem('sb-admin-session', '{corrupted-json-data:true');
      expect(getSession()).toBeNull();
      expect(getToken()).toBeNull();
    });

    it('Attack 8: recovers gracefully when sessionStorage holds JSON missing token and user', () => {
      sessionStorage.setItem(
        'sb-admin-session',
        JSON.stringify({ invalidKey: 123 }),
      );
      expect(getSession()).toEqual({ invalidKey: 123 });
      expect(getToken()).toBeNull();
    });

    it('Attack 9: verifies signOut completely clears session in storage, test ref, and cookie', () => {
      setSessionForTesting({
        access_token: 'valid-test-token',
        user: {
          id: 'admin-id',
          email: 'admin@abu.edu.ng',
          app_metadata: { role: 'admin' },
        },
      });
      expect(getToken()).toBe('valid-test-token');

      signOut();
      expect(getSession()).toBeNull();
      expect(getToken()).toBeNull();
      expect(sessionStorage.getItem('sb-admin-session')).toBeNull();
      expect(sessionStorage.getItem('sb-admin-token')).toBeNull();
    });

    it('Attack 10: ensures SQL injection strings in login email and password do not corrupt payload', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Bad credentials',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const sqlEmail = "' OR 1=1; DROP TABLE users; --";
      const sqlPassword = "admin' OR '1'='1";

      await expect(
        signInWithPassword(sqlEmail, sqlPassword),
      ).rejects.toMatchObject({
        code: 'invalid-credentials',
        status: 400,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/auth/v1/token?grant_type=password'),
        expect.objectContaining({
          body: JSON.stringify({ email: sqlEmail, password: sqlPassword }),
        }),
      );
    });

    it('Attack 11: ensures header injection strings in login email are safely JSON encoded', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'invalid_grant' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const headerInjectionEmail =
        'admin@abu.edu.ng\r\nX-Injected-Header: evil\r\n';
      await expect(
        signInWithPassword(headerInjectionEmail, 'pass'),
      ).rejects.toMatchObject({
        code: 'invalid-credentials',
      });

      const calledBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(calledBody.email).toBe(headerInjectionEmail);
    });

    it('Attack 12: mounts LoginPage with invite-expired error banner when query error=invite-expired', async () => {
      mockSearchParams = new URLSearchParams('error=invite-expired');
      render(<LoginPage />);

      expect(screen.getByText('That invitation has expired.')).toBeTruthy();
      expect(screen.getByText('invite-expired')).toBeTruthy();
      expect(
        screen.getByText(
          'Ask a lab team admin to send a new one. Nothing on the record has changed.',
        ),
      ).toBeTruthy();
    });

    it('Attack 13: moves keyboard focus to error banner heading upon failed login submission', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'invalid_grant' }), {
          status: 400,
        }),
      );

      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText(/EMAIL/i), {
        target: { value: 'admin@abu.edu.ng' },
      });
      fireEvent.change(screen.getByLabelText(/PASSWORD/i), {
        target: { value: 'badpass' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

      await waitFor(() => {
        expect(
          screen.getByText('That email and password do not match.'),
        ).toBeTruthy();
        const heading = screen.getByRole('heading', {
          name: 'That email and password do not match.',
        });
        expect(document.activeElement).toBe(heading);
        expect(heading.getAttribute('tabindex')).toBe('-1');
      });
    });

    it('Attack 14: disables form inputs and displays pending label Signing in… during submission', async () => {
      let resolveAuth: (res: Response) => void;
      const authPromise = new Promise<Response>((resolve) => {
        resolveAuth = resolve;
      });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => authPromise);

      render(<LoginPage />);

      const emailInput = screen.getByLabelText(/EMAIL/i) as HTMLInputElement;
      const passInput = screen.getByLabelText(/PASSWORD/i) as HTMLInputElement;
      const submitBtn = screen.getByRole('button', {
        name: 'Sign In',
      }) as HTMLButtonElement;

      fireEvent.change(emailInput, { target: { value: 'admin@abu.edu.ng' } });
      fireEvent.change(passInput, { target: { value: 'pendingtest' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Signing in…' }),
        ).toBeTruthy();
      });

      expect(emailInput.disabled).toBe(true);
      expect(passInput.disabled).toBe(true);
      expect(submitBtn.disabled).toBe(true);

      resolveAuth!(
        new Response(JSON.stringify({ error: 'invalid_grant' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Sign In' })).toBeTruthy();
      });
      expect(emailInput.disabled).toBe(false);
      expect(passInput.disabled).toBe(false);
    });
  });

  describe('Seam 2: Cold-Start Panel Timer & Transition Edge Cases', () => {
    it('Attack 15: clears slow timer cleanly on fast response (<3000ms) without triggering onSlow', async () => {
      vi.useFakeTimers();
      const onSlow = vi.fn();

      let resolveFetch: (res: Response) => void;
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => fetchPromise);

      setSessionForTesting({
        access_token: 'test-admin-jwt',
        user: {
          id: 'admin-1',
          email: 'admin@abu.edu.ng',
          app_metadata: { role: 'admin' },
        },
      });

      const itemsPromise = getItems({ onSlow, slowDelayMs: 3000 });

      vi.advanceTimersByTime(1200);
      resolveFetch!(new Response(JSON.stringify([]), { status: 200 }));

      const res = await itemsPromise;
      expect(res).toEqual([]);

      vi.advanceTimersByTime(2500);
      expect(onSlow).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('Attack 16: renders inventory page directly on fast response without mounting ColdStartPanel', async () => {
      setSessionForTesting({
        access_token: 'test-admin-jwt',
        user: {
          id: 'admin-1',
          email: 'admin@abu.edu.ng',
          app_metadata: { role: 'admin' },
        },
      });

      const sampleItems: Equipment[] = [
        {
          id: 'SC-002',
          name: 'Monitors',
          condition: 'Working',
          quantity: 50,
          core_functionality: 'Lab monitors',
          other_functionality: null,
          image_keys: [],
          created_at: '2026-10-09T08:00:00Z',
          updated_at: '2026-10-09T08:00:00Z',
          updated_by: null,
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(sampleItems), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<AdminInventoryPage />);

      await waitFor(() => {
        expect(screen.getByText('Monitors')).toBeTruthy();
      });

      expect(screen.queryByText('Building the register.')).toBeNull();
      expect(
        screen.queryByText('The register took too long to start.'),
      ).toBeNull();
    });

    it('Attack 17: triggers onSlow callback when backend request exceeds 3000ms', async () => {
      vi.useFakeTimers();
      const onSlow = vi.fn();

      let resolveFetch: (res: Response) => void;
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => fetchPromise);

      setSessionForTesting({
        access_token: 'test-admin-jwt',
        user: {
          id: 'admin-1',
          email: 'admin@abu.edu.ng',
          app_metadata: { role: 'admin' },
        },
      });

      const promise = getItems({ onSlow, slowDelayMs: 3000 });

      vi.advanceTimersByTime(2990);
      expect(onSlow).not.toHaveBeenCalled();

      vi.advanceTimersByTime(20);
      expect(onSlow).toHaveBeenCalledTimes(1);

      resolveFetch!(new Response(JSON.stringify([]), { status: 200 }));
      await promise;
      vi.useRealTimers();
    });

    it('Attack 18: transitions AdminInventoryPage to waiting state with ticking ELAPSED counter when slow', async () => {
      vi.useFakeTimers();
      setSessionForTesting({
        access_token: 'test-admin-jwt',
        user: {
          id: 'admin-1',
          email: 'admin@abu.edu.ng',
          app_metadata: { role: 'admin' },
        },
      });

      let resolveFetch: (res: Response) => void;
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => fetchPromise);

      render(<AdminInventoryPage />);

      expect(screen.queryByText('Building the register.')).toBeNull();

      act(() => {
        vi.advanceTimersByTime(3005);
      });

      expect(screen.getByText('Building the register.')).toBeTruthy();
      expect(screen.getByText('ELAPSED')).toBeTruthy();
      expect(screen.getByText('0:00')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText('0:01')).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText('0:02')).toBeTruthy();

      resolveFetch!(new Response(JSON.stringify([]), { status: 200 }));
      vi.useRealTimers();
    });

    it('Attack 19: replaces ColdStartPanel with inventory data when delayed response arrives', async () => {
      setSessionForTesting({
        access_token: 'test-admin-jwt',
        user: {
          id: 'admin-1',
          email: 'admin@abu.edu.ng',
          app_metadata: { role: 'admin' },
        },
      });

      const items: Equipment[] = [
        {
          id: 'SC-001',
          name: 'HDMI splitter and converter ',
          condition: 'Working',
          quantity: 1,
          core_functionality: 'Splitter',
          other_functionality: null,
          image_keys: [],
          created_at: '2026-10-09T08:00:00Z',
          updated_at: '2026-10-09T08:00:00Z',
          updated_by: null,
        },
      ];

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(items), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      render(<AdminInventoryPage />);

      await waitFor(() => {
        expect(screen.queryByText('Building the register.')).toBeNull();
        expect(screen.getByText(/HDMI splitter and converter/)).toBeTruthy();
      });
    });

    it('Attack 20: redirects 401 unauthenticated getItems to /admin/login without displaying error panel', async () => {
      setSessionForTesting({
        access_token: 'expired-or-bad-jwt',
        user: {
          id: 'admin-1',
          email: 'admin@abu.edu.ng',
          app_metadata: { role: 'admin' },
        },
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'invalid-token', message: 'Token expired' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<AdminInventoryPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/login');
      });

      expect(
        screen.queryByText('The register took too long to start.'),
      ).toBeNull();
      expect(screen.queryByText('cold-start-timeout')).toBeNull();
    });

    it('Attack 21: redirects 403 forbidden getItems to /admin/login without displaying error panel', async () => {
      setSessionForTesting({
        access_token: 'non-admin-jwt',
        user: {
          id: 'user-1',
          email: 'user@abu.edu.ng',
          app_metadata: { role: 'viewer' },
        },
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'forbidden',
            message: 'Admin role required',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<AdminInventoryPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/login');
      });

      expect(
        screen.queryByText('The register took too long to start.'),
      ).toBeNull();
      expect(screen.queryByText('cold-start-timeout')).toBeNull();
    });

    it('Attack 22: displays cold-start-timeout error panel when backend experiences genuine 500 failure', async () => {
      setSessionForTesting({
        access_token: 'test-admin-jwt',
        user: {
          id: 'admin-1',
          email: 'admin@abu.edu.ng',
          app_metadata: { role: 'admin' },
        },
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'internal-error',
            message: 'Database connection failed',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<AdminInventoryPage />);

      await waitFor(() => {
        expect(
          screen.getByText('The register took too long to start.'),
        ).toBeTruthy();
        expect(screen.getByText('cold-start-timeout')).toBeTruthy();
      });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('Attack 23: immediately redirects unauthenticated access (no token) to /admin/login without fetching', async () => {
      setSessionForTesting(null);
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      render(<AdminInventoryPage />);

      expect(mockPush).toHaveBeenCalledWith('/admin/login');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('Attack 24: component unmount while slow timer is pending cancels active state cleanly', async () => {
      vi.useFakeTimers();
      setSessionForTesting({
        access_token: 'test-admin-jwt',
        user: {
          id: 'admin-1',
          email: 'admin@abu.edu.ng',
          app_metadata: { role: 'admin' },
        },
      });

      let resolveFetch: (res: Response) => void;
      const fetchPromise = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => fetchPromise);

      const { unmount } = render(<AdminInventoryPage />);

      act(() => {
        vi.advanceTimersByTime(1500);
      });

      unmount();

      act(() => {
        vi.advanceTimersByTime(2000);
        resolveFetch(new Response(JSON.stringify([]), { status: 200 }));
      });

      vi.useRealTimers();
    });
  });

  describe('Seam 3: Item Creation, Editing & 409 Condition Validation', () => {
    it('Attack 25: displays condition-enum-invalid error banner when backend returns 409 on new item', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'condition-enum-invalid',
            message:
              'Condition must be Working, Faulty, Under Maintenance, or Decommissioned',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<NewItemPage />);

      fireEvent.change(screen.getByLabelText(/ITEM NAME/i), {
        target: { value: 'Faulty Hub' },
      });
      fireEvent.change(screen.getByLabelText(/CORE FUNCTIONALITY/i), {
        target: { value: 'Distributes USB' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

      await waitFor(() => {
        expect(
          screen.getByText('That condition is not on the list.'),
        ).toBeTruthy();
        expect(screen.getByText('condition-enum-invalid')).toBeTruthy();
      });
    });

    it('Attack 26: preserves rejected condition in EditItemPage with aria-invalid="true" when condition is Needs repair', async () => {
      const initialItem: Equipment = {
        id: 'SC-002',
        name: 'Monitors',
        condition:
          'Needs repair' as unknown as import('@/lib/supabase').Condition,
        quantity: 50,
        core_functionality: 'Lab monitors',
        other_functionality: null,
        image_keys: [],
        created_at: '2026-10-09T08:00:00Z',
        updated_at: '2026-10-09T08:00:00Z',
        updated_by: null,
      };

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify(initialItem), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: 'condition-enum-invalid',
              message: 'Condition Needs repair is invalid',
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } },
          ),
        );

      render(<EditItemPage params={{ id: 'SC-002' }} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Monitors')).toBeTruthy();
      });

      const select = screen.getByLabelText(/CONDITION/i) as HTMLSelectElement;
      expect(select.value).toBe('Needs repair');

      const form = select.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText('That condition is not on the list.'),
        ).toBeTruthy();
        expect(screen.getByText('condition-enum-invalid')).toBeTruthy();
      });

      expect(select.value).toBe('Needs repair');
      expect(select.getAttribute('aria-invalid')).toBe('true');
      expect(
        screen.getByText('Choose one of the four recorded states.'),
      ).toBeTruthy();
    });

    it('Attack 27: displays field error "Choose one of the four recorded states." on 409 rejection in NewItemPage', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'condition-enum-invalid',
            message: 'Invalid condition',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<NewItemPage />);

      fireEvent.change(screen.getByLabelText(/ITEM NAME/i), {
        target: { value: 'Widget' },
      });
      fireEvent.change(screen.getByLabelText(/CORE FUNCTIONALITY/i), {
        target: { value: 'Core' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

      await waitFor(() => {
        expect(
          screen.getByText('Choose one of the four recorded states.'),
        ).toBeTruthy();
      });

      const select = screen.getByLabelText(/CONDITION/i) as HTMLSelectElement;
      expect(select.getAttribute('aria-invalid')).toBe('true');
    });

    it('Attack 28: prototype pollution condition key (__proto__) is preserved safely without corrupting prototype', async () => {
      const initialItem: Equipment = {
        id: 'SC-009',
        name: 'Prototype Injection Specimen',
        condition: '__proto__' as unknown as import('@/lib/supabase').Condition,
        quantity: 1,
        core_functionality: 'Injection test',
        other_functionality: null,
        image_keys: [],
        created_at: '2026-10-09T08:00:00Z',
        updated_at: '2026-10-09T08:00:00Z',
        updated_by: null,
      };

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify(initialItem), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: 'condition-enum-invalid',
              message: 'Refused',
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } },
          ),
        );

      render(<EditItemPage params={{ id: 'SC-009' }} />);

      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Prototype Injection Specimen'),
        ).toBeTruthy();
      });

      const select = screen.getByLabelText(/CONDITION/i) as HTMLSelectElement;
      expect(select.value).toBe('__proto__');

      const form = select.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('condition-enum-invalid')).toBeTruthy();
      });

      expect(select.value).toBe('__proto__');
      expect(select.getAttribute('aria-invalid')).toBe('true');
      expect(({} as Record<string, unknown>)['__proto__']).toBe(
        Object.prototype,
      );
    });

    it('Attack 29: prototype pollution condition key (constructor) is preserved safely', async () => {
      const initialItem: Equipment = {
        id: 'SC-010',
        name: 'Constructor Injection Specimen',
        condition:
          'constructor' as unknown as import('@/lib/supabase').Condition,
        quantity: 1,
        core_functionality: 'Injection test 2',
        other_functionality: null,
        image_keys: [],
        created_at: '2026-10-09T08:00:00Z',
        updated_at: '2026-10-09T08:00:00Z',
        updated_by: null,
      };

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify(initialItem), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: 'condition-enum-invalid',
              message: 'Refused',
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } },
          ),
        );

      render(<EditItemPage params={{ id: 'SC-010' }} />);

      await waitFor(() => {
        expect(
          screen.getByDisplayValue('Constructor Injection Specimen'),
        ).toBeTruthy();
      });

      const select = screen.getByLabelText(/CONDITION/i) as HTMLSelectElement;
      expect(select.value).toBe('constructor');

      const form = select.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('condition-enum-invalid')).toBeTruthy();
      });

      expect(select.value).toBe('constructor');
      expect(select.getAttribute('aria-invalid')).toBe('true');
    });

    it('Attack 30: clamps negative quantity input to 0 before sending to API', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'new-id',
            name: 'Clamped Item',
            quantity: 0,
            condition: 'Working',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<NewItemPage />);

      fireEvent.change(screen.getByLabelText(/ITEM NAME/i), {
        target: { value: 'Clamped Item' },
      });
      fireEvent.change(screen.getByLabelText(/CORE FUNCTIONALITY/i), {
        target: { value: 'Core' },
      });
      fireEvent.change(screen.getByLabelText(/QUANTITY/i), {
        target: { value: '-25' },
      });

      const form = screen
        .getByRole('button', { name: 'Save item' })
        .closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin');
      });

      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(sentBody.quantity).toBe(0);
    });

    it('Attack 31: falls back non-numeric quantity input to 1 before sending to API', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'new-id-2',
            name: 'Fallback Item',
            quantity: 1,
            condition: 'Working',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<NewItemPage />);

      fireEvent.change(screen.getByLabelText(/ITEM NAME/i), {
        target: { value: 'Fallback Item' },
      });
      fireEvent.change(screen.getByLabelText(/CORE FUNCTIONALITY/i), {
        target: { value: 'Core' },
      });
      fireEvent.change(screen.getByLabelText(/QUANTITY/i), {
        target: { value: 'abc' },
      });

      const form = screen
        .getByRole('button', { name: 'Save item' })
        .closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin');
      });

      const sentBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(sentBody.quantity).toBe(1);
    });

    it('Attack 32: displays save-failed error banner when backend create returns 500', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'server-error',
            message: 'Failed to write record',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<NewItemPage />);

      fireEvent.change(screen.getByLabelText(/ITEM NAME/i), {
        target: { value: 'Crash Item' },
      });
      fireEvent.change(screen.getByLabelText(/CORE FUNCTIONALITY/i), {
        target: { value: 'Core' },
      });

      const form = screen
        .getByRole('button', { name: 'Save item' })
        .closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getAllByText('server-error').length,
        ).toBeGreaterThanOrEqual(1);
      });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('Attack 33: preserves rejected condition in EditItemPage with aria-invalid="true" when condition is Broken', async () => {
      const initialItem: Equipment = {
        id: 'SC-002',
        name: 'Monitors',
        condition: 'Broken' as unknown as import('@/lib/supabase').Condition,
        quantity: 50,
        core_functionality: 'Core text',
        other_functionality: null,
        image_keys: [],
        created_at: '2026-10-09T08:00:00Z',
        updated_at: '2026-10-09T08:00:00Z',
        updated_by: null,
      };

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify(initialItem), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: 'condition-enum-invalid',
              message: 'Condition Broken is invalid',
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } },
          ),
        );

      render(<EditItemPage params={{ id: 'SC-002' }} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Monitors')).toBeTruthy();
      });

      const select = screen.getByLabelText(/CONDITION/i) as HTMLSelectElement;
      expect(select.value).toBe('Broken');

      const form = select.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(
          screen.getByText('That condition is not on the list.'),
        ).toBeTruthy();
        expect(screen.getByText('condition-enum-invalid')).toBeTruthy();
      });

      expect(select.value).toBe('Broken');
      expect(select.getAttribute('aria-invalid')).toBe('true');
      expect(
        screen.getByText('Choose one of the four recorded states.'),
      ).toBeTruthy();
    });

    it('Attack 34: renders item-not-found error banner and recovery link when getItemById returns 404', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'item-not-found',
            message: 'Record not found',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(<EditItemPage params={{ id: 'non-existent-id' }} />);

      await waitFor(() => {
        expect(screen.getByText('item-not-found')).toBeTruthy();
      });

      const backLink = screen.getByRole('link', {
        name: 'Back to the Inventory',
      });
      expect(backLink.getAttribute('href')).toBe('/admin');
    });

    it('Attack 35: clamps negative quantity to 0 on EditItemPage update', async () => {
      const initialItem: Equipment = {
        id: 'SC-003',
        name: 'Recording Host',
        condition: 'Working',
        quantity: 1,
        core_functionality: 'Server',
        other_functionality: null,
        image_keys: [],
        created_at: '2026-10-09T08:00:00Z',
        updated_at: '2026-10-09T08:00:00Z',
        updated_by: null,
      };

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify(initialItem), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ...initialItem, quantity: 0 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );

      render(<EditItemPage params={{ id: 'SC-003' }} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Recording Host')).toBeTruthy();
      });

      fireEvent.change(screen.getByLabelText(/QUANTITY/i), {
        target: { value: '-5' },
      });
      const form = screen
        .getByRole('button', { name: 'Save item' })
        .closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Item saved.')).toBeTruthy();
      });

      const patchCall = fetchSpy.mock.calls[1];
      const patchBody = JSON.parse(patchCall[1]?.body as string);
      expect(patchBody.quantity).toBe(0);
    });

    it('Attack 36: displays Item saved. success banner with Dismiss action on successful update', async () => {
      const initialItem: Equipment = {
        id: 'SC-004',
        name: 'Router and switch',
        condition: 'Working',
        quantity: 1,
        core_functionality: 'Network',
        other_functionality: null,
        image_keys: [],
        created_at: '2026-10-09T08:00:00Z',
        updated_at: '2026-10-09T08:00:00Z',
        updated_by: null,
      };

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify(initialItem), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              ...initialItem,
              name: 'Router and switch updated',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );

      render(<EditItemPage params={{ id: 'SC-004' }} />);

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 1, name: /Router and switch/ }),
        ).toBeTruthy();
      });

      const form = screen
        .getByRole('button', { name: 'Save item' })
        .closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText('Item saved.')).toBeTruthy();
        expect(screen.getByText('The record is up to date.')).toBeTruthy();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByText('Item saved.')).toBeNull();
    });
  });

  describe('Seam 4: Destructive Delete Dialog Confirmation & Recovery', () => {
    const dialogItem = {
      id: 'SC-002',
      name: 'Monitors',
      recordCode: 'SC-002',
      quantity: 50,
      condition: 'Working',
    };

    it('Attack 37: initial render sets Cancel as primary action and Delete as danger action', () => {
      render(
        <DeleteDialog open={true} onOpenChange={vi.fn()} item={dialogItem} />,
      );

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      const deleteBtn = screen.getByRole('button', { name: 'Delete item' });

      expect(cancelBtn.className).toContain('bg-bg-action');
      expect(deleteBtn.className).toContain('bg-bg-danger');
      expect(deleteBtn.hasAttribute('autofocus')).toBe(false);
    });

    it('Attack 38: Delete button renders with danger styling and not as primary default', () => {
      render(
        <DeleteDialog open={true} onOpenChange={vi.fn()} item={dialogItem} />,
      );

      const deleteBtn = screen.getByRole('button', { name: 'Delete item' });
      expect(deleteBtn.className).toContain('bg-bg-danger');
      expect(deleteBtn.className).not.toContain('bg-bg-action');
    });

    it('Attack 39: transitions dialog to confirming state with label Deleting… upon click', async () => {
      let resolveDelete: (res: Response) => void;
      const deletePromise = new Promise<Response>((resolve) => {
        resolveDelete = resolve;
      });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => deletePromise);

      render(
        <DeleteDialog open={true} onOpenChange={vi.fn()} item={dialogItem} />,
      );

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Deleting…' })).toBeTruthy();
      });

      await act(async () => {
        resolveDelete!(new Response(null, { status: 204 }));
      });
    });

    it('Attack 40: disables both Cancel and Delete actions while deletion is confirming', async () => {
      let resolveDelete: (res: Response) => void;
      const deletePromise = new Promise<Response>((resolve) => {
        resolveDelete = resolve;
      });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => deletePromise);

      render(
        <DeleteDialog open={true} onOpenChange={vi.fn()} item={dialogItem} />,
      );

      const cancelBtn = screen.getByRole('button', {
        name: 'Cancel',
      }) as HTMLButtonElement;
      const deleteBtn = screen.getByRole('button', {
        name: 'Delete item',
      }) as HTMLButtonElement;

      expect(cancelBtn.disabled).toBe(false);
      expect(deleteBtn.disabled).toBe(false);

      act(() => {
        fireEvent.click(deleteBtn);
      });

      await waitFor(() => {
        expect(cancelBtn.disabled).toBe(true);
        expect(deleteBtn.disabled).toBe(true);
      });

      await act(async () => {
        resolveDelete!(new Response(null, { status: 204 }));
      });
    });

    it('Attack 41: rapid duplicate clicks while in confirming state do not trigger duplicate delete requests', async () => {
      let resolveDelete: (res: Response) => void;
      const deletePromise = new Promise<Response>((resolve) => {
        resolveDelete = resolve;
      });

      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementationOnce(() => deletePromise);

      render(
        <DeleteDialog open={true} onOpenChange={vi.fn()} item={dialogItem} />,
      );

      const deleteBtn = screen.getByRole('button', { name: 'Delete item' });
      act(() => {
        fireEvent.click(deleteBtn);
        fireEvent.click(deleteBtn);
        fireEvent.click(deleteBtn);
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      await act(async () => {
        resolveDelete!(new Response(null, { status: 204 }));
      });
    });

    it('Attack 42: ignores modal close and escape attempts while deletion is in flight', async () => {
      let resolveDelete: (res: Response) => void;
      const deletePromise = new Promise<Response>((resolve) => {
        resolveDelete = resolve;
      });

      vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => deletePromise);
      const onOpenChange = vi.fn();

      render(
        <DeleteDialog
          open={true}
          onOpenChange={onOpenChange}
          item={dialogItem}
        />,
      );

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Deleting…' })).toBeTruthy();
      });

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      act(() => {
        fireEvent.click(cancelBtn);
      });
      expect(onOpenChange).not.toHaveBeenCalled();

      await act(async () => {
        resolveDelete!(new Response(null, { status: 204 }));
      });
    });

    it('Attack 43: transitions to not-found state with item-not-found code when delete returns 404', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'not-found', message: 'Item already gone' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(
        <DeleteDialog open={true} onOpenChange={vi.fn()} item={dialogItem} />,
      );

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));
      });

      await waitFor(() => {
        expect(screen.getByText('That item is already gone.')).toBeTruthy();
        expect(screen.getByText('item-not-found')).toBeTruthy();
      });
    });

    it('Attack 44: clicking recovery CTA in not-found state invokes onDeleted callback', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'not-found', message: 'Item vanished' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const onDeleted = vi.fn();
      const onOpenChange = vi.fn();

      render(
        <DeleteDialog
          open={true}
          onOpenChange={onOpenChange}
          item={dialogItem}
          onDeleted={onDeleted}
        />,
      );

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));
      });

      await waitFor(() => {
        expect(screen.getByText('That item is already gone.')).toBeTruthy();
      });

      act(() => {
        fireEvent.click(
          screen.getByRole('button', { name: 'Back to the Inventory' }),
        );
      });
      expect(onDeleted).toHaveBeenCalledWith('SC-002');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('Attack 45: transitions to deleted state on 204 response quoting item name and accession code', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(null, { status: 204 }),
      );

      render(
        <DeleteDialog open={true} onOpenChange={vi.fn()} item={dialogItem} />,
      );

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));
      });

      await waitFor(() => {
        expect(screen.getByText('Deleted.')).toBeTruthy();
        expect(
          screen.getByText(
            'Monitors (SC-002) is no longer on the register, and its photographs are no longer shown in the collection.',
          ),
        ).toBeTruthy();
      });
    });

    it('Attack 46: returns to default state with error message when deletion fails with 500', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'delete-failed',
            message: 'Database delete locked',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      render(
        <DeleteDialog open={true} onOpenChange={vi.fn()} item={dialogItem} />,
      );

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));
      });

      await waitFor(() => {
        expect(screen.getByText('Database delete locked')).toBeTruthy();
      });

      expect(screen.getByRole('button', { name: 'Delete item' })).toBeTruthy();
      expect(
        (
          screen.getByRole('button', {
            name: 'Delete item',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    });
  });
});
