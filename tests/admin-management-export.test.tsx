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
let searchParamsMock = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => searchParamsMock,
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { setSessionForTesting } from '@/lib/admin-auth';

describe('lib/admin-api (M2 extensions)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setSessionForTesting({
      access_token: 'valid-admin-jwt',
      user: {
        id: 'u-admin',
        email: 'admin@abu.edu.ng',
        app_metadata: { role: 'admin' },
      },
    });
    process.env.NEXT_PUBLIC_RENDER_SERVICE_URL = 'http://localhost:3001';
  });

  it('getAdmins sends Bearer token and returns AdminUser[]', async () => {
    const { getAdmins } = await import('@/lib/admin-api');
    const mockAdmins = [
      {
        id: 'a1',
        email: 'admin.one@abu.edu.ng',
        created_at: '2026-09-02T10:00:00Z',
      },
      {
        id: 'a2',
        email: 'admin.two@abu.edu.ng',
        created_at: '2026-09-15T10:00:00Z',
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockAdmins), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await getAdmins();
    expect(result).toEqual(mockAdmins);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/admins',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-admin-jwt',
        }),
      }),
    );
  });

  it('createInvite sends email in payload and returns invite object', async () => {
    const { createInvite } = await import('@/lib/admin-api');
    const mockCreated = {
      id: 'inv-123',
      email: 'new.colleague@abu.edu.ng',
      token: 'raw-token-abc',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockCreated), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await createInvite('new.colleague@abu.edu.ng');
    expect(result).toEqual(mockCreated);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/admins/invites',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-admin-jwt',
        }),
        body: JSON.stringify({ email: 'new.colleague@abu.edu.ng' }),
      }),
    );
  });

  it('deleteAdmin sends DELETE request to /api/admin/admins/:id', async () => {
    const { deleteAdmin } = await import('@/lib/admin-api');

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deleteAdmin('admin-del-id');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/admins/admin-del-id',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-admin-jwt',
        }),
      }),
    );
  });

  it('acceptInvite sends token and name without requiring authentication', async () => {
    const { acceptInvite } = await import('@/lib/admin-api');
    setSessionForTesting(null);

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'active' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await acceptInvite('secret-token-xyz', 'Ibrahim Musa');
    expect(result).toEqual({ status: 'active' });
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/invites/accept',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          token: 'secret-token-xyz',
          name: 'Ibrahim Musa',
        }),
      }),
    );
  });

  it('exportInventory returns blob from /api/admin/export/:format', async () => {
    const { exportInventory } = await import('@/lib/admin-api');
    const mockBlob = new Blob(
      ['name,condition,quantity\nMonitors,Working,50'],
      {
        type: 'text/csv',
      },
    );

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
          Authorization: 'Bearer valid-admin-jwt',
        }),
      }),
    );
  });
});

describe('app/admin/admins/page (S-008)', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockReset();
    setSessionForTesting({
      access_token: 'test-jwt',
      user: {
        id: 'admin-1',
        email: 'admin.one@example.invalid',
        app_metadata: { role: 'admin' },
      },
    });
    process.env.NEXT_PUBLIC_RENDER_SERVICE_URL = 'http://localhost:3001';
  });

  it('renders the lab team roster, YOU chip, and summary counts', async () => {
    const mockAdmins = [
      {
        id: 'admin-1',
        email: 'admin.one@example.invalid',
        created_at: '2026-09-02T12:00:00Z',
      },
      {
        id: 'admin-2',
        email: 'admin.two@example.invalid',
        created_at: '2026-09-15T12:00:00Z',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/admin/admins')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockAdmins), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const PageModule = await import('@/app/admin/admins/page');
    const AdminAdminsPage = PageModule.default;
    render(<AdminAdminsPage />);

    expect(await screen.findByText('admin.two@example.invalid')).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 1, name: 'The Lab Team' }),
    ).toBeDefined();
    expect(screen.getByText('ADMINS')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('admin.one@example.invalid')).toBeDefined();
    expect(screen.getByText('YOU')).toBeDefined();
    expect(screen.getByText('2026-09-02')).toBeDefined();
    expect(screen.getByText('2026-09-15')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Remove admin.two@example.invalid' }),
    ).toBeDefined();
    expect(
      screen.queryByRole('button', {
        name: 'Remove admin.one@example.invalid',
      }),
    ).toBeNull();
  });

  it('deletes non-last admin and removes the row from the table', async () => {
    let admins = [
      {
        id: 'admin-1',
        email: 'admin.one@example.invalid',
        created_at: '2026-09-02T12:00:00Z',
      },
      {
        id: 'admin-2',
        email: 'admin.two@example.invalid',
        created_at: '2026-09-15T12:00:00Z',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/api/admin/admins/') && method === 'DELETE') {
        admins = admins.filter((a) => !url.endsWith(a.id));
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.includes('/api/admin/admins') && method === 'GET') {
        return Promise.resolve(
          new Response(JSON.stringify(admins), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const PageModule = await import('@/app/admin/admins/page');
    const AdminAdminsPage = PageModule.default;
    render(<AdminAdminsPage />);

    const removeBtn = await screen.findByRole('button', {
      name: 'Remove admin.two@example.invalid',
    });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText('admin.two@example.invalid')).toBeNull();
    });
  });

  it('blocks last-admin removal with client-side or server 409 error banner', async () => {
    const mockAdmins = [
      {
        id: 'admin-1',
        email: 'admin.one@example.invalid',
        created_at: '2026-09-02T12:00:00Z',
      },
      {
        id: 'admin-2',
        email: 'admin.two@example.invalid',
        created_at: '2026-09-15T12:00:00Z',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/api/admin/admins/') && method === 'DELETE') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: 'last-admin',
              message: 'Cannot delete the last remaining administrator',
            }),
            {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      }
      if (url.includes('/api/admin/admins') && method === 'GET') {
        return Promise.resolve(
          new Response(JSON.stringify(mockAdmins), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const PageModule = await import('@/app/admin/admins/page');
    const AdminAdminsPage = PageModule.default;
    render(<AdminAdminsPage />);

    const removeBtn = await screen.findByRole('button', {
      name: 'Remove admin.two@example.invalid',
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

  it('renders EmptyState and focuses invite email input when 1 admin exists', async () => {
    const mockAdmins = [
      {
        id: 'admin-1',
        email: 'admin.one@example.invalid',
        created_at: '2026-09-02T12:00:00Z',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/admin/admins')) {
        return Promise.resolve(
          new Response(JSON.stringify(mockAdmins), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const PageModule = await import('@/app/admin/admins/page');
    const AdminAdminsPage = PageModule.default;
    render(<AdminAdminsPage />);

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'You are the only admin.',
      }),
    ).toBeDefined();

    const inviteCta = screen.getByRole('button', { name: 'Invite an Admin' });
    const emailInput = screen.getByPlaceholderText('colleague@example.edu.ng');
    fireEvent.click(inviteCta);

    expect(document.activeElement).toBe(emailInput);
  });

  it('submits invite form, increments PENDING count on 201 success', async () => {
    const mockAdmins = [
      {
        id: 'admin-1',
        email: 'admin.one@example.invalid',
        created_at: '2026-09-02T12:00:00Z',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/api/admin/admins/invites') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 'inv-1',
              email: 'admin.five@example.invalid',
              token: 'token-abc',
            }),
            {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      }
      if (url.includes('/api/admin/admins') && method === 'GET') {
        return Promise.resolve(
          new Response(JSON.stringify(mockAdmins), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const PageModule = await import('@/app/admin/admins/page');
    const AdminAdminsPage = PageModule.default;
    render(<AdminAdminsPage />);

    await screen.findByText('admin.one@example.invalid');
    const emailInput = screen.getByPlaceholderText('colleague@example.edu.ng');
    fireEvent.change(emailInput, {
      target: { value: 'admin.five@example.invalid' },
    });

    const sendBtn = screen.getByRole('button', { name: 'Send invite' });
    fireEvent.click(sendBtn);

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'Invitation sent.',
      }),
    ).toBeDefined();
    expect(screen.getByText('admin.five@example.invalid')).toBeDefined();
  });

  it('renders caution banner when invite delivery fails with 502', async () => {
    const mockAdmins = [
      {
        id: 'admin-1',
        email: 'admin.one@example.invalid',
        created_at: '2026-09-02T12:00:00Z',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/api/admin/admins/invites') && method === 'POST') {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: 'gmail-send-failed',
              message: 'Failed to send invite email',
            }),
            {
              status: 502,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      }
      if (url.includes('/api/admin/admins') && method === 'GET') {
        return Promise.resolve(
          new Response(JSON.stringify(mockAdmins), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    const PageModule = await import('@/app/admin/admins/page');
    const AdminAdminsPage = PageModule.default;
    render(<AdminAdminsPage />);

    await screen.findByText('admin.one@example.invalid');
    const emailInput = screen.getByPlaceholderText('colleague@example.edu.ng');
    fireEvent.change(emailInput, { target: { value: 'fail@example.invalid' } });

    const sendBtn = screen.getByRole('button', { name: 'Send invite' });
    fireEvent.click(sendBtn);

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'The invitation did not send.',
      }),
    ).toBeDefined();
    expect(screen.getByText('gmail-send-failed')).toBeDefined();
    expect(screen.getByText('Mail delivery failed.')).toBeDefined();
  });
});

describe('app/admin/invite/accept/page (S-007)', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockReset();
    searchParamsMock = new URLSearchParams({ token: 'test-token-123' });
    process.env.NEXT_PUBLIC_RENDER_SERVICE_URL = 'http://localhost:3001';
  });

  it('renders shell-free layout, catalogue key, and fields', async () => {
    const PageModule = await import('@/app/admin/invite/accept/page');
    const AcceptInvitePage = PageModule.default;
    render(<AcceptInvitePage />);

    expect(screen.getByText('ABU Smart Class')).toBeDefined();
    expect(screen.getByText('INVITATION')).toBeDefined();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /Accept your invitation|Accept invitation/i,
      }),
    ).toBeDefined();
    expect(screen.getByText('INVITED EMAIL')).toBeDefined();
    expect(screen.getByLabelText(/^PASSWORD/i)).toBeDefined();
    expect(screen.getByLabelText(/^CONFIRM PASSWORD/i)).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Accept Invitation' }),
    ).toBeDefined();
    expect(
      screen.getByRole('link', { name: 'Back to the Collection' }),
    ).toBeDefined();
  });

  it('displays unknown-token banner when token is missing', async () => {
    searchParamsMock = new URLSearchParams();

    const PageModule = await import('@/app/admin/invite/accept/page');
    const AcceptInvitePage = PageModule.default;
    render(<AcceptInvitePage />);

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'That invitation link is not valid.',
      }),
    ).toBeDefined();
    expect(screen.getByText('unknown-token')).toBeDefined();
  });

  it('shows weak-password banner and field error when password is < 8 characters', async () => {
    const PageModule = await import('@/app/admin/invite/accept/page');
    const AcceptInvitePage = PageModule.default;
    render(<AcceptInvitePage />);

    const passwordInput = screen.getByLabelText(/^PASSWORD/i);
    const confirmInput = screen.getByLabelText(/^CONFIRM PASSWORD/i);

    fireEvent.change(passwordInput, { target: { value: 'short' } });
    fireEvent.change(confirmInput, { target: { value: 'short' } });

    const submitBtn = screen.getByRole('button', { name: 'Accept Invitation' });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'That password is too weak.',
      }),
    ).toBeDefined();
    expect(screen.getByText('weak-password')).toBeDefined();
    expect(screen.getByText('Use at least 8 characters.')).toBeDefined();
    expect(passwordInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows confirm field error when passwords do not match', async () => {
    const PageModule = await import('@/app/admin/invite/accept/page');
    const AcceptInvitePage = PageModule.default;
    render(<AcceptInvitePage />);

    const passwordInput = screen.getByLabelText(/^PASSWORD/i);
    const confirmInput = screen.getByLabelText(/^CONFIRM PASSWORD/i);

    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmInput, { target: { value: 'mismatch456' } });

    const submitBtn = screen.getByRole('button', { name: 'Accept Invitation' });
    fireEvent.click(submitBtn);

    expect(screen.getByText('Type the same password again.')).toBeDefined();
    expect(confirmInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('handles backend 404 with unknown-token error banner', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: 'unknown-token',
            message: 'Invite token is invalid or expired',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });

    const PageModule = await import('@/app/admin/invite/accept/page');
    const AcceptInvitePage = PageModule.default;
    render(<AcceptInvitePage />);

    const passwordInput = screen.getByLabelText(/^PASSWORD/i);
    const confirmInput = screen.getByLabelText(/^CONFIRM PASSWORD/i);

    fireEvent.change(passwordInput, { target: { value: 'ValidPass123' } });
    fireEvent.change(confirmInput, { target: { value: 'ValidPass123' } });

    const submitBtn = screen.getByRole('button', { name: 'Accept Invitation' });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'That invitation link is not valid.',
      }),
    ).toBeDefined();
    expect(screen.getByText('unknown-token')).toBeDefined();
  });

  it('handles backend 409 with already-accepted error banner', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: 'already-accepted',
            message: 'Invite token has already been accepted',
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });

    const PageModule = await import('@/app/admin/invite/accept/page');
    const AcceptInvitePage = PageModule.default;
    render(<AcceptInvitePage />);

    const passwordInput = screen.getByLabelText(/^PASSWORD/i);
    const confirmInput = screen.getByLabelText(/^CONFIRM PASSWORD/i);

    fireEvent.change(passwordInput, { target: { value: 'ValidPass123' } });
    fireEvent.change(confirmInput, { target: { value: 'ValidPass123' } });

    const submitBtn = screen.getByRole('button', { name: 'Accept Invitation' });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'That invitation has already been used.',
      }),
    ).toBeDefined();
    expect(screen.getByText('already-accepted')).toBeDefined();
  });

  it('navigates to /admin/login?invite=accepted on successful acceptance', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      return Promise.resolve(
        new Response(JSON.stringify({ status: 'active' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    const PageModule = await import('@/app/admin/invite/accept/page');
    const AcceptInvitePage = PageModule.default;
    render(<AcceptInvitePage />);

    const passwordInput = screen.getByLabelText(/^PASSWORD/i);
    const confirmInput = screen.getByLabelText(/^CONFIRM PASSWORD/i);

    fireEvent.change(passwordInput, { target: { value: 'ValidPass123' } });
    fireEvent.change(confirmInput, { target: { value: 'ValidPass123' } });

    const submitBtn = screen.getByRole('button', { name: 'Accept Invitation' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/login?invite=accepted');
    });
  });
});

describe('app/admin/_components/export-dialog (S-010)', () => {
  const originalCreateObjectURL = globalThis.URL.createObjectURL;
  const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.URL.createObjectURL = vi.fn(
      () => 'blob:http://localhost/mock-blob',
    );
    globalThis.URL.revokeObjectURL = vi.fn();
    process.env.NEXT_PUBLIC_RENDER_SERVICE_URL = 'http://localhost:3001';
  });

  afterEach(() => {
    cleanup();
    globalThis.URL.createObjectURL = originalCreateObjectURL;
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('renders dialog elements, default CSV format, and 5 locked columns', async () => {
    const { ExportDialog } =
      await import('@/app/admin/_components/export-dialog');
    render(<ExportDialog open={true} itemCount={7} />);

    expect(
      screen.getByRole('heading', { level: 3, name: 'Export the Register' }),
    ).toBeDefined();
    expect(
      screen.getByText(
        /Two formats for inventory record keeping and reporting/i,
      ),
    ).toBeDefined();

    const csvRadio = screen.getByRole('radio', {
      name: /CSV/i,
    }) as HTMLInputElement;
    const pdfRadio = screen.getByRole('radio', {
      name: /PDF/i,
    }) as HTMLInputElement;

    expect(csvRadio.checked).toBe(true);
    expect(pdfRadio.checked).toBe(false);

    expect(screen.getByText('Item name')).toBeDefined();
    expect(screen.getByText('Kept exactly as submitted.')).toBeDefined();
    expect(screen.getByText('Condition')).toBeDefined();
    expect(
      screen.getByText('Working, Faulty, Under Maintenance or Decommissioned.'),
    ).toBeDefined();
    expect(screen.getByText('Quantity')).toBeDefined();
    expect(screen.getByText('Updated')).toBeDefined();
    expect(screen.getByText('The date the record last changed.')).toBeDefined();
    expect(screen.getByText('Updated by')).toBeDefined();
    expect(screen.getByText('The admin who last changed it.')).toBeDefined();

    expect(screen.getByText(/^Record ID/i)).toBeDefined();
    expect(screen.getByText('Withheld')).toBeDefined();
    expect(
      screen.getByText(
        'These five columns are always included. Record IDs stay inside the admin app and are not written to the file.',
      ),
    ).toBeDefined();

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Create the File' }),
    ).toBeDefined();
  });

  it('switches between CSV and PDF formats', async () => {
    const { ExportDialog } =
      await import('@/app/admin/_components/export-dialog');
    render(<ExportDialog open={true} itemCount={7} />);

    const pdfRadio = screen.getByRole('radio', {
      name: /PDF/i,
    }) as HTMLInputElement;
    const csvRadio = screen.getByRole('radio', {
      name: /CSV/i,
    }) as HTMLInputElement;

    fireEvent.click(pdfRadio);
    expect(pdfRadio.checked).toBe(true);
    expect(csvRadio.checked).toBe(false);

    fireEvent.click(csvRadio);
    expect(csvRadio.checked).toBe(true);
    expect(pdfRadio.checked).toBe(false);
  });

  it('handles successful CSV export and triggers download', async () => {
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/admin/export/csv')) {
        return Promise.resolve(
          new Response('name,condition\nLaptop,Working', {
            status: 200,
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition':
                'attachment; filename="abu-smart-class-inventory.csv"',
            },
          }),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const { ExportDialog } =
      await import('@/app/admin/_components/export-dialog');
    render(<ExportDialog open={true} itemCount={7} />);

    const createBtn = screen.getByRole('button', { name: 'Create the File' });
    fireEvent.click(createBtn);

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'Your file is ready.',
      }),
    ).toBeDefined();
    expect(
      screen.getByText('Seven items, with the five columns listed above.'),
    ).toBeDefined();
    expect(screen.getByText(/abu-smart-class-inventory-.*\.csv/)).toBeDefined();

    expect(anchorClickSpy).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Download the File' }),
    ).toBeDefined();
  });

  it('handles export 500 failure and permits retry', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/admin/export/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: 'export-generation-failed',
              message: 'Failed to generate export file',
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const { ExportDialog } =
      await import('@/app/admin/_components/export-dialog');
    render(<ExportDialog open={true} itemCount={7} />);

    const createBtn = screen.getByRole('button', { name: 'Create the File' });
    fireEvent.click(createBtn);

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'The file could not be created.',
      }),
    ).toBeDefined();
    expect(screen.getByText('export-generation-failed')).toBeDefined();
    expect(
      screen.getByText(
        /Nothing was downloaded and nothing on the register was changed/i,
      ),
    ).toBeDefined();

    const retryBtn = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(retryBtn);

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'Export the Register',
      }),
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Create the File' }),
    ).toBeDefined();
  });

  it('wires into /admin page and opens on Export button click', async () => {
    setSessionForTesting({
      access_token: 'valid-admin-jwt',
      user: {
        id: 'u-admin',
        email: 'admin@abu.edu.ng',
        app_metadata: { role: 'admin' },
      },
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/admin/items')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 'SC-001',
                name: 'Server Rack',
                condition: 'Working',
                quantity: 2,
                created_at: '2026-10-10T00:00:00Z',
              },
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    });

    const PageModule = await import('@/app/admin/page');
    const AdminPage = PageModule.default;
    render(<AdminPage />);

    expect(await screen.findByText('Server Rack')).toBeDefined();

    const exportBtn = screen.getByRole('button', { name: 'Export' });
    fireEvent.click(exportBtn);

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'Export the Register',
      }),
    ).toBeDefined();
  });
});
