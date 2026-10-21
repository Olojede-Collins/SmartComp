import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { db, type AdminRecord } from '../backend/src/db.js';

const originalNodeEnv = process.env.NODE_ENV;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const mutableEnv = process.env as Record<string, string | undefined>;

function enableSupabase(): void {
  mutableEnv.NODE_ENV = 'development';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
}

function disableSupabase(): void {
  mutableEnv.NODE_ENV = 'test';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ADMIN_A: AdminRecord = {
  id: 'admin-a',
  name: 'Admin A',
  email: 'a@example.com',
  created_at: '2026-10-01T00:00:00.000Z',
};

const ADMIN_B: AdminRecord = {
  id: 'admin-b',
  name: 'Admin B',
  email: 'b@example.com',
  created_at: '2026-10-02T00:00:00.000Z',
};

interface Call {
  method: string;
  url: string;
  body?: Record<string, unknown>;
}

afterAll(() => {
  vi.restoreAllMocks();
  if (originalNodeEnv === undefined) {
    delete mutableEnv.NODE_ENV;
  } else {
    mutableEnv.NODE_ENV = originalNodeEnv;
  }
  if (originalUrl === undefined) {
    delete process.env.SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL = originalUrl;
  }
  if (originalKey === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

beforeEach(() => {
  vi.restoreAllMocks();
  db.reset();
});

describe('Admin removal against Supabase', () => {
  it('soft-removes the admin and revokes the auth role without deleting rows', async () => {
    enableSupabase();
    const calls: Call[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        const body = init?.body
          ? (JSON.parse(String(init.body)) as Record<string, unknown>)
          : undefined;
        calls.push({ method, url, body });

        if (url.includes('/rest/v1/admins?select=*&removed_at=is.null')) {
          return jsonResponse([ADMIN_A, ADMIN_B]);
        }
        if (url.includes('/auth/v1/admin/users?per_page=1000')) {
          return jsonResponse({
            users: [{ id: 'auth-b', email: 'b@example.com' }],
          });
        }
        if (method === 'PUT' && url.includes('/auth/v1/admin/users/auth-b')) {
          return jsonResponse({});
        }
        if (
          method === 'PATCH' &&
          url.includes('/rest/v1/admins?id=eq.admin-b')
        ) {
          return jsonResponse([
            { ...ADMIN_B, removed_at: '2026-10-21T16:58:44.600Z' },
          ]);
        }
        if (
          url.includes('/rest/v1/admins?id=eq.admin-a') &&
          url.includes('select=id')
        ) {
          return jsonResponse([{ id: 'admin-a' }]);
        }
        if (method === 'POST' && url.endsWith('/rest/v1/audit_log')) {
          return jsonResponse({}, 201);
        }
        throw new Error(`Unexpected ${method} ${url}`);
      },
    );

    const result = await db.deleteAdmin('admin-b', 'admin-a');

    expect(result).toEqual({ success: true });
    const authRevoke = calls.find(
      (c) =>
        c.method === 'PUT' && c.url.includes('/auth/v1/admin/users/auth-b'),
    );
    expect(authRevoke?.body).toEqual({ app_metadata: { role: 'removed' } });

    const recordPatch = calls.find(
      (c) =>
        c.method === 'PATCH' && c.url.includes('/rest/v1/admins?id=eq.admin-b'),
    );
    expect(recordPatch?.url).toContain('removed_at=is.null');
    expect(typeof recordPatch?.body?.removed_at).toBe('string');

    expect(
      calls.some(
        (c) => c.method === 'DELETE' && c.url.includes('/rest/v1/admins'),
      ),
    ).toBe(false);
    expect(calls.indexOf(authRevoke!)).toBeLessThan(
      calls.indexOf(recordPatch!),
    );

    const audit = calls.find(
      (c) => c.method === 'POST' && c.url.endsWith('/rest/v1/audit_log'),
    );
    expect(audit?.body).toMatchObject({
      action: 'admin.remove',
      target: 'b@example.com',
    });
  });

  it('blocks removal of the last active admin before revoking auth', async () => {
    enableSupabase();
    const calls: Call[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        calls.push({ method, url });
        if (url.includes('/rest/v1/admins?select=*&removed_at=is.null')) {
          return jsonResponse([ADMIN_A]);
        }
        throw new Error(`Unexpected ${method} ${url}`);
      },
    );

    const result = await db.deleteAdmin('admin-a', 'admin-a');

    expect(result).toEqual({ success: false, lastAdmin: true });
    expect(calls).toHaveLength(1);
  });

  it('reactivates a removed admin when a new invite is accepted', async () => {
    enableSupabase();
    const calls: Call[] = [];
    const tokenHash = crypto.randomBytes(32).toString('hex');

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        const body = init?.body
          ? (JSON.parse(String(init.body)) as Record<string, unknown>)
          : undefined;
        calls.push({ method, url, body });

        if (url.includes('/rest/v1/admin_invites?token_hash=eq.')) {
          return jsonResponse([
            {
              id: 'invite-1',
              email: 'b@example.com',
              token_hash: tokenHash,
              invited_by: 'admin-a',
              created_at: '2026-10-20T00:00:00.000Z',
              accepted_at: null,
            },
          ]);
        }
        if (url.endsWith('/auth/v1/admin/users') && method === 'GET') {
          return jsonResponse({
            users: [{ id: 'auth-b', email: 'b@example.com' }],
          });
        }
        if (method === 'PUT' && url.includes('/auth/v1/admin/users/auth-b')) {
          return jsonResponse({});
        }
        if (
          method === 'PATCH' &&
          url.includes('/rest/v1/admin_invites?email=ilike.')
        ) {
          return new Response(null, { status: 204 });
        }
        if (url.includes('/rest/v1/admins?email=ilike.') && method === 'GET') {
          return jsonResponse([
            { ...ADMIN_B, removed_at: '2026-10-21T16:58:44.600Z' },
          ]);
        }
        if (
          method === 'PATCH' &&
          url.includes('/rest/v1/admins?id=eq.admin-b')
        ) {
          return jsonResponse([{ ...ADMIN_B, removed_at: null }]);
        }
        if (method === 'POST' && url.endsWith('/rest/v1/audit_log')) {
          return jsonResponse({}, 201);
        }
        throw new Error(`Unexpected ${method} ${url}`);
      },
    );

    const admin = await db.acceptInvite(tokenHash, 'Admin B');

    expect(admin?.id).toBe('admin-b');
    expect(admin?.removed_at).toBeNull();

    const authRestore = calls.find(
      (c) =>
        c.method === 'PUT' && c.url.includes('/auth/v1/admin/users/auth-b'),
    );
    expect(authRestore?.body).toMatchObject({
      app_metadata: { role: 'admin' },
    });

    const recordRestore = calls.find(
      (c) =>
        c.method === 'PATCH' && c.url.includes('/rest/v1/admins?id=eq.admin-b'),
    );
    expect(recordRestore?.body).toMatchObject({ removed_at: null });
  });
});

describe('Admin removal in the in-memory fallback', () => {
  beforeEach(() => {
    disableSupabase();
  });

  it('hides the removed admin but keeps audit rows that reference them', async () => {
    db.reset({
      admins: [ADMIN_A, ADMIN_B],
      auditLogs: [
        {
          id: 'log-1',
          actor_admin_id: 'admin-b',
          action: 'admin.accept',
          target: 'b@example.com',
          created_at: '2026-10-02T00:00:00.000Z',
        },
      ],
    });

    const result = await db.deleteAdmin('admin-b', 'admin-a');

    expect(result).toEqual({ success: true });
    expect((await db.getAdmins()).map((a) => a.id)).toEqual(['admin-a']);

    const logs = await db.getAuditLogs();
    expect(logs.some((l) => l.actor_admin_id === 'admin-b')).toBe(true);
    expect(logs.find((l) => l.action === 'admin.remove')?.target).toBe(
      'b@example.com',
    );
  });

  it('reactivates a removed admin instead of creating a duplicate row', async () => {
    db.reset({ admins: [ADMIN_A, ADMIN_B] });
    await db.deleteAdmin('admin-b', 'admin-a');

    const { token } = await db.createInvite('b@example.com', 'admin-a');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const restored = await db.acceptInvite(tokenHash, 'Admin B Again');

    expect(restored?.id).toBe('admin-b');
    expect(restored?.removed_at).toBeNull();
    expect(restored?.name).toBe('Admin B Again');

    const active = await db.getAdmins();
    expect(active.filter((a) => a.email === 'b@example.com')).toHaveLength(1);
  });

  it('returns not-found when the admin is already removed', async () => {
    db.reset({ admins: [ADMIN_A, ADMIN_B] });

    expect(await db.deleteAdmin('admin-b', 'admin-a')).toEqual({
      success: true,
    });
    expect(await db.deleteAdmin('admin-b', 'admin-a')).toEqual({
      success: false,
      notFound: true,
    });
  });
});

describe('Admin removal migration', () => {
  it('adds removed_at and ships a reversible down migration', () => {
    const dir = path.resolve(process.cwd(), 'backend', 'migrations');
    const up = fs.readFileSync(
      path.join(dir, '0008_admin_removal.up.sql'),
      'utf8',
    );
    const down = fs.readFileSync(
      path.join(dir, '0008_admin_removal.down.sql'),
      'utf8',
    );

    expect(up).toContain('ALTER TABLE admins ADD COLUMN removed_at');
    expect(down).toContain('DROP COLUMN IF EXISTS removed_at');
  });
});
