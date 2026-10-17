// @vitest-environment jsdom
import * as React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
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

import {
  signInWithPassword,
  signOut,
  getSession,
  getToken,
  setSessionForTesting,
  type AdminSession,
} from '@/lib/admin-auth';

describe('lib/admin-auth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    document.cookie =
      'sb-admin-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    setSessionForTesting(null);
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    };
  });

  it('rejects if configuration is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_ANON_KEY;

    await expect(
      signInWithPassword('admin@example.com', 'password123'),
    ).rejects.toThrow('Supabase configuration missing');
  });

  it('rejects with invalid-credentials when GoTrue returns 400', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      signInWithPassword('wrong@example.com', 'wrongpassword'),
    ).rejects.toMatchObject({
      code: 'invalid-credentials',
      status: 400,
    });
  });

  it('rejects with forbidden when user role is not admin', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'token-non-admin',
          user: {
            id: 'user-1',
            email: 'user@example.com',
            app_metadata: { role: 'viewer' },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      signInWithPassword('user@example.com', 'validpassword'),
    ).rejects.toMatchObject({
      code: 'forbidden',
      status: 403,
      message: 'Admin privileges required',
    });
  });

  it('authenticates valid admin and stores session in sessionStorage and cookie', async () => {
    const mockSession: AdminSession = {
      access_token: 'admin-jwt-token-xyz',
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        app_metadata: { role: 'admin' },
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockSession), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const session = await signInWithPassword(
      'admin@example.com',
      'correctpass',
    );
    expect(session.access_token).toBe('admin-jwt-token-xyz');
    expect(getSession()?.access_token).toBe('admin-jwt-token-xyz');
    expect(getToken()).toBe('admin-jwt-token-xyz');
    expect(sessionStorage.getItem('sb-admin-token')).toBe(
      'admin-jwt-token-xyz',
    );
    expect(document.cookie).toContain('sb-admin-token=admin-jwt-token-xyz');
  });

  it('clears session on signOut', () => {
    setSessionForTesting({
      access_token: 'test-token',
      user: { id: 'u1', email: 'a@b.com', app_metadata: { role: 'admin' } },
    });
    expect(getToken()).toBe('test-token');

    signOut();
    expect(getSession()).toBeNull();
    expect(getToken()).toBeNull();
    expect(sessionStorage.getItem('sb-admin-token')).toBeNull();
  });
});

describe('lib/admin-api', () => {
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

  it('getItems sends Authorization header and returns items', async () => {
    const { getItems } = await import('@/lib/admin-api');
    const mockItems = [
      {
        id: 'item-1',
        name: 'Monitors',
        condition: 'Working',
        quantity: 50,
        core_functionality: 'Class monitors',
        other_functionality: null,
        image_keys: [],
        created_at: '2026-10-09T08:00:00Z',
        updated_at: '2026-10-09T08:00:00Z',
        updated_by: null,
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockItems), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await getItems();
    expect(result).toEqual(mockItems);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3001/api/admin/items',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-admin-jwt',
        }),
      }),
    );
  });

  it('invokes onSlow callback after 3000ms delay', async () => {
    vi.useFakeTimers();
    const { getItems } = await import('@/lib/admin-api');
    const onSlow = vi.fn();

    let resolveFetch: (val: Response) => void;
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => pendingFetch);

    const callPromise = getItems({ onSlow });

    expect(onSlow).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2999);
    expect(onSlow).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onSlow).toHaveBeenCalledTimes(1);

    resolveFetch!(new Response(JSON.stringify([]), { status: 200 }));
    await callPromise;
    vi.useRealTimers();
  });

  it('parses error response into ApiError', async () => {
    const { createItem, ApiError } = await import('@/lib/admin-api');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'condition-enum-invalid',
          message:
            'Condition must be Working, Faulty, Under Maintenance, or Decommissioned',
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      createItem({
        name: 'Broken Item',
        condition:
          'Unknown' as unknown as import('@/app/_components/condition-enum').Condition,
        quantity: 1,
        core_functionality: 'Core',
      }),
    ).rejects.toSatisfy((err: unknown) => {
      return (
        err instanceof ApiError &&
        err.code === 'condition-enum-invalid' &&
        err.status === 409
      );
    });
  });

  it('deleteItem succeeds on 204 response', async () => {
    const { deleteItem } = await import('@/lib/admin-api');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );

    await expect(deleteItem('item-to-delete')).resolves.toBeUndefined();
  });
});

describe('S-006 /admin/login', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders shell-free layout with brand line, ADMIN key, title, lede, fields, and Back link', async () => {
    const { default: LoginPage } = await import('@/app/admin/login/page');
    const { render, screen } = await import('@testing-library/react');

    render(<LoginPage />);

    expect(screen.getByText('ABU Smart Class')).toBeTruthy();
    expect(screen.getByText('ADMIN')).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Sign In' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'For lab team admins. The public collection needs no account.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('EMAIL')).toBeTruthy();
    expect(screen.getByText('PASSWORD')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeTruthy();
    const backLink = screen.getByRole('link', {
      name: 'Back to the Collection',
    });
    expect(backLink.getAttribute('href')).toBe('/room');
  });

  it('submits credentials and displays invalid-credentials banner on 401 failure', async () => {
    const { default: LoginPage } = await import('@/app/admin/login/page');
    const { render, screen, fireEvent, waitFor } =
      await import('@testing-library/react');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
    );

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/EMAIL/i);
    const passInput = screen.getByLabelText(/PASSWORD/i);
    const submitBtn = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(emailInput, { target: { value: 'admin@abu.edu.ng' } });
    fireEvent.change(passInput, { target: { value: 'wrongpass' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText('That email and password do not match.'),
      ).toBeTruthy();
      expect(screen.getByText('invalid-credentials')).toBeTruthy();
    });
  });

  it('submits valid credentials and redirects to /admin upon success', async () => {
    const { default: LoginPage } = await import('@/app/admin/login/page');
    const { render, screen, fireEvent, waitFor } =
      await import('@testing-library/react');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'valid-jwt',
          user: {
            id: 'admin-id',
            email: 'admin@abu.edu.ng',
            app_metadata: { role: 'admin' },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/EMAIL/i), {
      target: { value: 'admin@abu.edu.ng' },
    });
    fireEvent.change(screen.getByLabelText(/PASSWORD/i), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin');
    });
  });
});

describe('S-004 /admin and admin-nav', () => {
  const mockItems = [
    {
      id: 'SC-001',
      name: 'HDMI splitter and converter ',
      condition: 'Working' as const,
      quantity: 1,
      core_functionality: 'Splitter',
      other_functionality: null,
      image_keys: [],
      created_at: '2026-10-09T08:00:00Z',
      updated_at: '2026-10-09T08:00:00Z',
      updated_by: null,
    },
    {
      id: 'SC-002',
      name: 'Monitors',
      condition: 'Faulty' as const,
      quantity: 50,
      core_functionality: 'Monitors for lab',
      other_functionality: null,
      image_keys: [],
      created_at: '2026-10-08T08:00:00Z',
      updated_at: '2026-10-09T08:00:00Z',
      updated_by: null,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockReset();
    setSessionForTesting({
      access_token: 'valid-jwt',
      user: {
        id: 'admin-1',
        email: 'admin@abu.edu.ng',
        app_metadata: { role: 'admin' },
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('admin-nav signs out and redirects to /admin/login', async () => {
    const { AdminNav } = await import('@/app/admin/_components/admin-nav');
    const { render, screen, fireEvent } =
      await import('@testing-library/react');

    render(<AdminNav current="/admin" />);

    const signOutBtn = screen.getByRole('button', { name: 'Sign out' });
    fireEvent.click(signOutBtn);

    expect(getToken()).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/admin/login');
  });

  it('renders inventory register with page head, data strip, and data table', async () => {
    const { default: AdminInventoryPage } = await import('@/app/admin/page');
    const { render, screen, waitFor } = await import('@testing-library/react');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockItems), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<AdminInventoryPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'The Inventory' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Everything the lab team has recorded, kept as submitted/i,
      ),
    ).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(/HDMI splitter and converter/)).toBeTruthy();
      expect(screen.getByText('Monitors')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy();
    });
  });

  it('renders empty state when inventory has zero items', async () => {
    const { default: AdminInventoryPage } = await import('@/app/admin/page');
    const { render, screen, waitFor } = await import('@testing-library/react');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<AdminInventoryPage />);

    await waitFor(() => {
      expect(screen.getByText('No items yet.')).toBeTruthy();
      expect(
        screen.getByText('Add the first item to start the register.'),
      ).toBeTruthy();
    });
  });

  it('displays ColdStartPanel in waiting state when request takes >3s', async () => {
    vi.useFakeTimers();
    const { default: AdminInventoryPage } = await import('@/app/admin/page');
    const { render, screen } = await import('@testing-library/react');

    let resolveFetch: (val: Response) => void;
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => pendingFetch);

    render(<AdminInventoryPage />);

    expect(screen.queryByText('Building the register.')).toBeNull();

    const { act } = await import('@testing-library/react');
    act(() => {
      vi.advanceTimersByTime(3001);
    });

    expect(screen.getByText('Building the register.')).toBeTruthy();
    expect(screen.getByText('ELAPSED')).toBeTruthy();

    resolveFetch!(new Response(JSON.stringify([]), { status: 200 }));
    vi.useRealTimers();
  });

  it('redirects to /admin/login when session token is missing', async () => {
    const { setSessionForTesting } = await import('@/lib/admin-auth');
    setSessionForTesting(null);
    const { default: AdminInventoryPage } = await import('@/app/admin/page');
    const { render } = await import('@testing-library/react');

    render(<AdminInventoryPage />);

    expect(mockPush).toHaveBeenCalledWith('/admin/login');
  });

  it('redirects to /admin/login when getItems rejects with 401', async () => {
    const { default: AdminInventoryPage } = await import('@/app/admin/page');
    const { render, waitFor } = await import('@testing-library/react');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: 'unauthorized',
          message: 'Auth required',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    render(<AdminInventoryPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/login');
    });
  });
});

describe('S-009 DeleteDialog', () => {
  const testItem = {
    id: 'SC-002',
    name: 'Monitors',
    recordCode: 'SC-002',
    quantity: 50,
    condition: 'Working',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders record preview and buttons with Cancel default-focused', async () => {
    const { DeleteDialog } =
      await import('@/app/admin/_components/delete-dialog');
    const { render, screen } = await import('@testing-library/react');

    render(
      <DeleteDialog
        open={true}
        onOpenChange={vi.fn()}
        item={testItem}
        onDeleted={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'Delete This Item?' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /This removes the item and its photographs from the register/i,
      ),
    ).toBeTruthy();
    expect(screen.getByText('Monitors')).toBeTruthy();
    expect(screen.getByText('SC-002')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete item' })).toBeTruthy();
  });

  it('transitions to deleted state on 204 success', async () => {
    const { DeleteDialog } =
      await import('@/app/admin/_components/delete-dialog');
    const { render, screen, fireEvent, waitFor } =
      await import('@testing-library/react');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );

    const onDeleted = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <DeleteDialog
        open={true}
        onOpenChange={onOpenChange}
        item={testItem}
        onDeleted={onDeleted}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));

    await waitFor(() => {
      expect(screen.getByText('Deleted.')).toBeTruthy();
      expect(
        screen.getByText(/Monitors \(SC-002\) is no longer on the register/i),
      ).toBeTruthy();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Back to the Inventory' }),
    );
    expect(onDeleted).toHaveBeenCalledWith('SC-002');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('transitions to not-found state on 404 response', async () => {
    const { DeleteDialog } =
      await import('@/app/admin/_components/delete-dialog');
    const { render, screen, fireEvent, waitFor } =
      await import('@testing-library/react');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'not-found', message: 'Item not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const onDeleted = vi.fn();

    render(
      <DeleteDialog
        open={true}
        onOpenChange={vi.fn()}
        item={testItem}
        onDeleted={onDeleted}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));

    await waitFor(() => {
      expect(screen.getByText('That item is already gone.')).toBeTruthy();
      expect(screen.getByText('item-not-found')).toBeTruthy();
      expect(
        screen.getByText(
          /Someone else deleted SC-002, or it was removed earlier/i,
        ),
      ).toBeTruthy();
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Back to the Inventory' }),
    );
    expect(onDeleted).toHaveBeenCalledWith('SC-002');
  });
});

describe('S-005 Item Editor (/admin/items/new and /admin/items/[id])', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockReset();
    setSessionForTesting({
      access_token: 'valid-jwt',
      user: {
        id: 'admin-1',
        email: 'admin@abu.edu.ng',
        app_metadata: { role: 'admin' },
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders new item form with breadcrumb, fields, and 8 MB help text', async () => {
    const { default: NewItemPage } = await import('@/app/admin/items/new/page');
    const { render, screen } = await import('@testing-library/react');

    render(<NewItemPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Add an Item' }),
    ).toBeTruthy();
    expect(
      screen.getByText('The Inventory', {
        selector: 'nav[aria-label="Breadcrumb"] a',
      }),
    ).toBeTruthy();
    expect(screen.getByText('New Item')).toBeTruthy();

    expect(screen.getByText('ITEM NAME')).toBeTruthy();
    expect(screen.getByText('CORE FUNCTIONALITY (AS SUBMITTED)')).toBeTruthy();
    expect(screen.getByText('OTHER FUNCTIONALITY (AS SUBMITTED)')).toBeTruthy();
    expect(screen.getByText('QUANTITY')).toBeTruthy();
    expect(screen.getByText('CONDITION')).toBeTruthy();
    expect(screen.getByText('PHOTOGRAPHS')).toBeTruthy();
    expect(
      screen.getByText(/Photographs must be 8 MB or smaller/i),
    ).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Save item' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete item' })).toBeNull();
  });

  it('handles 409 condition-enum-invalid with frozen banner and field error', async () => {
    const { default: NewItemPage } = await import('@/app/admin/items/new/page');
    const { render, screen, fireEvent, waitFor } =
      await import('@testing-library/react');

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
      target: { value: 'Faulty Widget' },
    });
    fireEvent.change(
      screen.getByLabelText(/CORE FUNCTIONALITY \(AS SUBMITTED\)/i),
      { target: { value: 'Does something' } },
    );
    fireEvent.change(screen.getByLabelText(/QUANTITY/i), {
      target: { value: '2' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

    await waitFor(() => {
      expect(
        screen.getByText('That condition is not on the list.'),
      ).toBeTruthy();
      expect(screen.getByText('condition-enum-invalid')).toBeTruthy();
      expect(
        screen.getByText('Choose one of the four recorded states.'),
      ).toBeTruthy();
    });
  });

  it('renders edit item form pre-filled and handles update and success banner', async () => {
    const { default: EditItemPage } =
      await import('@/app/admin/items/[id]/page');
    const { render, screen, fireEvent, waitFor } =
      await import('@testing-library/react');

    const existingItem = {
      id: 'SC-002',
      name: 'Monitors',
      core_functionality: 'Computer engineering monitors',
      other_functionality: 'Display screens',
      condition: 'Working' as const,
      quantity: 50,
      image_keys: [],
      created_at: '2026-10-09T08:00:00Z',
      updated_at: '2026-10-09T08:00:00Z',
      updated_by: 'admin-1',
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const method = init?.method || 'GET';
      if (method === 'GET') {
        return new Response(JSON.stringify(existingItem), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (method === 'PATCH') {
        return new Response(JSON.stringify({ ...existingItem, quantity: 55 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(null, { status: 404 });
    });

    render(<EditItemPage params={Promise.resolve({ id: 'SC-002' })} />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Monitors' }),
      ).toBeTruthy();
      expect(screen.getAllByText('SC-002').length).toBeGreaterThan(0);
    });

    const qtyInput = screen.getByLabelText(/QUANTITY/i) as HTMLInputElement;
    expect(qtyInput.value).toBe('50');

    fireEvent.change(qtyInput, { target: { value: '55' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));

    await waitFor(() => {
      expect(screen.getByText('Item saved.')).toBeTruthy();
      expect(screen.getByText('The record is up to date.')).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'Delete item' })).toBeTruthy();
  });
});
