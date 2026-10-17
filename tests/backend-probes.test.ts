import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { app } from '../backend/src/server.js';
import { db } from '../backend/src/db.js';
import { createToken } from '../backend/src/auth.js';

describe('Backend Probes & Deploy Integration Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let revalidateServer: http.Server;
  let revalidateUrl: string;
  let receivedRevalidateSecret: string | undefined;
  let receivedRevalidateBody: { paths?: string[] } | null = null;
  let revalidateCount = 0;

  const validAdminToken = createToken({
    sub: 'admin-probe-id-1',
    email: 'admin@smartcomp.abu.edu.ng',
    app_metadata: { role: 'admin' },
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const userRoleToken = createToken({
    sub: 'user-probe-id-1',
    email: 'user@smartcomp.abu.edu.ng',
    app_metadata: { role: 'user' },
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const missingRoleToken = createToken({
    sub: 'norole-probe-id-1',
    email: 'norole@smartcomp.abu.edu.ng',
    app_metadata: {},
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;

    revalidateServer = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/api/revalidate') {
        receivedRevalidateSecret = req.headers['x-revalidate-secret'] as
          string | undefined;
        revalidateCount++;
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        req.on('end', () => {
          try {
            receivedRevalidateBody = JSON.parse(
              Buffer.concat(chunks).toString('utf8'),
            );
          } catch {
            receivedRevalidateBody = null;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ revalidated: true }));
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      revalidateServer.listen(0, '127.0.0.1', () => resolve());
    });
    const rAddr = revalidateServer.address() as AddressInfo;
    revalidateUrl = `http://127.0.0.1:${rAddr.port}`;

    process.env.VERCEL_URL = revalidateUrl;
    process.env.REVALIDATE_SECRET = 'freshness-probe-secret-coren-42';
  });

  afterAll(async () => {
    delete process.env.VERCEL_URL;
    delete process.env.REVALIDATE_SECRET;

    await new Promise<void>((resolve, reject) => {
      revalidateServer.close((err) => (err ? reject(err) : resolve()));
    });

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    db.reset();
    receivedRevalidateSecret = undefined;
    receivedRevalidateBody = null;
    revalidateCount = 0;
  });

  describe('Success Metric 5: Unauthenticated write probe against all 7 mutation endpoints', () => {
    const mutationEndpoints: Array<{
      name: string;
      method: string;
      path: string;
      body?: Record<string, unknown> | Buffer;
      contentType?: string;
    }> = [
      {
        name: 'POST /api/admin/items',
        method: 'POST',
        path: '/api/admin/items',
        body: { name: 'Probe Item', condition: 'Working' },
        contentType: 'application/json',
      },
      {
        name: 'PATCH /api/admin/items/:id',
        method: 'PATCH',
        path: '/api/admin/items/00000000-0000-0000-0000-000000000001',
        body: { condition: 'Working' },
        contentType: 'application/json',
      },
      {
        name: 'DELETE /api/admin/items/:id',
        method: 'DELETE',
        path: '/api/admin/items/00000000-0000-0000-0000-000000000001',
      },
      {
        name: 'POST /api/admin/items/:id/images',
        method: 'POST',
        path: '/api/admin/items/00000000-0000-0000-0000-000000000001/images',
        body: Buffer.from('probe-image-content'),
        contentType: 'image/png',
      },
      {
        name: 'DELETE /api/admin/items/:id/images/:key',
        method: 'DELETE',
        path: '/api/admin/items/00000000-0000-0000-0000-000000000001/images/probe-key.webp',
      },
      {
        name: 'POST /api/admin/admins/invites',
        method: 'POST',
        path: '/api/admin/admins/invites',
        body: { email: 'probe@smartcomp.abu.edu.ng' },
        contentType: 'application/json',
      },
      {
        name: 'DELETE /api/admin/admins/:id',
        method: 'DELETE',
        path: '/api/admin/admins/00000000-0000-0000-0000-000000000001',
      },
    ];

    for (const ep of mutationEndpoints) {
      it(`${ep.name} without auth header strictly fails with 401 invalid-token`, async () => {
        const headers: Record<string, string> = {};
        if (ep.contentType) {
          headers['Content-Type'] = ep.contentType;
        }

        const res = await globalThis.fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers,
          body: ep.body
            ? Buffer.isBuffer(ep.body)
              ? new Uint8Array(ep.body)
              : JSON.stringify(ep.body)
            : undefined,
        });

        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe('invalid-token');
        expect(typeof body.message).toBe('string');
      });

      it(`${ep.name} with non-admin role: 'user' strictly fails with 403 forbidden`, async () => {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${userRoleToken}`,
        };
        if (ep.contentType) {
          headers['Content-Type'] = ep.contentType;
        }

        const res = await globalThis.fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers,
          body: ep.body
            ? Buffer.isBuffer(ep.body)
              ? new Uint8Array(ep.body)
              : JSON.stringify(ep.body)
            : undefined,
        });

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe('forbidden');
        expect(typeof body.message).toBe('string');
      });

      it(`${ep.name} with missing role claim strictly fails with 403 forbidden`, async () => {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${missingRoleToken}`,
        };
        if (ep.contentType) {
          headers['Content-Type'] = ep.contentType;
        }

        const res = await globalThis.fetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers,
          body: ep.body
            ? Buffer.isBuffer(ep.body)
              ? new Uint8Array(ep.body)
              : JSON.stringify(ep.body)
            : undefined,
        });

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe('forbidden');
        expect(typeof body.message).toBe('string');
      });
    }
  });

  describe('Success Metric 6: Last-admin removal block', () => {
    it('strictly returns 409 last-admin and blocks deletion of the sole existing admin', async () => {
      const initialAdmins = await db.getAdmins();
      expect(initialAdmins.length).toBe(1);
      const soleAdmin = initialAdmins[0];

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/${soleAdmin.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
          },
        },
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe('last-admin');
      expect(body.message).toBe(
        'Cannot delete the last remaining administrator',
      );

      const remainingAdmins = await db.getAdmins();
      expect(remainingAdmins.length).toBe(1);
      expect(remainingAdmins[0].id).toBe(soleAdmin.id);
      expect(remainingAdmins[0].email).toBe(soleAdmin.email);
    });
  });

  describe('/healthz target', () => {
    it('returns 200 { ok: true } when Supabase ping succeeds', async () => {
      db.setHealthy(true);
      const res = await globalThis.fetch(`${baseUrl}/healthz`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });

    it('returns 503 db-unavailable when Supabase ping fails', async () => {
      db.setHealthy(false);
      const res = await globalThis.fetch(`${baseUrl}/healthz`);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toBe('db-unavailable');
      expect([
        'Database connection failed',
        'Database connectivity probe failed',
      ]).toContain(body.message);
    });
  });

  describe('Success Metric 2: Freshness simulation', () => {
    it('verifies item condition mutation triggers outbound POST /api/revalidate with x-revalidate-secret under 60s', async () => {
      const item = await db.createEquipment(
        {
          name: 'Digital Storage Oscilloscope',
          condition: 'Working',
          quantity: 2,
        },
        'admin-probe-id-1',
      );

      const start = performance.now();

      const patchRes = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${item.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ condition: 'Under Maintenance' }),
        },
      );

      const elapsed = performance.now() - start;

      expect(patchRes.status).toBe(200);
      const updated = await patchRes.json();
      expect(updated.condition).toBe('Under Maintenance');

      expect(revalidateCount).toBe(1);
      expect(receivedRevalidateSecret).toBe('freshness-probe-secret-coren-42');
      expect(receivedRevalidateBody?.paths).toEqual([
        '/',
        '/room',
        `/item/${item.id}`,
      ]);
      expect(elapsed).toBeLessThan(60000);
    });

    it('verifies item field mutation triggers outbound POST /api/revalidate with x-revalidate-secret under 60s', async () => {
      const item = await db.createEquipment(
        {
          name: 'Spectrum Analyzer Pro',
          condition: 'Working',
          quantity: 1,
        },
        'admin-probe-id-1',
      );

      const start = performance.now();

      const patchRes = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${item.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Spectrum Analyzer Pro Max',
            core_functionality: 'RF spectrum and harmonic distortion analysis',
          }),
        },
      );

      const elapsed = performance.now() - start;

      expect(patchRes.status).toBe(200);
      const updated = await patchRes.json();
      expect(updated.name).toBe('Spectrum Analyzer Pro Max');

      expect(revalidateCount).toBe(1);
      expect(receivedRevalidateSecret).toBe('freshness-probe-secret-coren-42');
      expect(receivedRevalidateBody?.paths).toEqual([
        '/',
        '/room',
        `/item/${item.id}`,
      ]);
      expect(elapsed).toBeLessThan(60000);
    });
  });
});
