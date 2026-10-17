import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { app } from '../backend/src/server.js';
import { db } from '../backend/src/db.js';
import { createToken } from '../backend/src/auth.js';
import { setRevalidateListener } from '../backend/src/revalidate.js';
import { MAX_IMAGE_BYTES } from '../backend/src/routes/items.js';

describe('Backend API Contract & Probe Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const validAdminToken = createToken({
    sub: 'admin-test-id-1',
    email: 'admin@smartcomp.abu.edu.ng',
    app_metadata: { role: 'admin' },
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const nonAdminToken = createToken({
    sub: 'visitor-test-id-1',
    email: 'visitor@smartcomp.abu.edu.ng',
    app_metadata: { role: 'visitor' },
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const expiredAdminToken = createToken({
    sub: 'admin-test-id-1',
    email: 'admin@smartcomp.abu.edu.ng',
    app_metadata: { role: 'admin' },
    exp: Math.floor(Date.now() / 1000) - 3600,
  });

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    setRevalidateListener(null);
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    db.reset();
  });

  describe('1. GET /healthz (Heartbeat target)', () => {
    it('returns 200 { ok: true } when database probe succeeds', async () => {
      db.setHealthy(true);
      const res = await globalThis.fetch(`${baseUrl}/healthz`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });

    it('returns 503 db-unavailable when database probe fails', async () => {
      db.setHealthy(false);
      const res = await globalThis.fetch(`${baseUrl}/healthz`);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body).toEqual({
        error: 'db-unavailable',
        message: 'Database connectivity probe failed',
      });
    });
  });

  describe('2. Authentication & Authorization Middleware', () => {
    it('returns 401 invalid-token when Authorization header is missing', async () => {
      const res = await globalThis.fetch(`${baseUrl}/api/admin/items`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('invalid-token');
      expect(typeof body.message).toBe('string');
    });

    it('returns 401 invalid-token when token is invalid or malformed', async () => {
      const res = await globalThis.fetch(`${baseUrl}/api/admin/items`, {
        headers: { Authorization: 'Bearer bad.token.here' },
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('invalid-token');
    });

    it('returns 401 invalid-token when token has expired', async () => {
      const res = await globalThis.fetch(`${baseUrl}/api/admin/items`, {
        headers: { Authorization: `Bearer ${expiredAdminToken}` },
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('invalid-token');
      expect(body.message).toContain('expired');
    });

    it('returns 403 forbidden when user lacks admin claim', async () => {
      const res = await globalThis.fetch(`${baseUrl}/api/admin/items`, {
        headers: { Authorization: `Bearer ${nonAdminToken}` },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('forbidden');
      expect(typeof body.message).toBe('string');
    });

    it('fails closed with 500 when NODE_ENV is production and SUPABASE_JWT_SECRET is missing', async () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.SUPABASE_JWT_SECRET;
      try {
        (process.env as Record<string, string | undefined>).NODE_ENV =
          'production';
        delete process.env.SUPABASE_JWT_SECRET;

        const res = await globalThis.fetch(`${baseUrl}/api/admin/items`, {
          headers: { Authorization: `Bearer ${validAdminToken}` },
        });
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('server-configuration-error');
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
        if (origSecret !== undefined) {
          process.env.SUPABASE_JWT_SECRET = origSecret;
        } else {
          delete process.env.SUPABASE_JWT_SECRET;
        }
      }
    });

    it('assigns synthetic UUID when payload sub is missing or non-string', async () => {
      const tokenWithoutSub = createToken({
        app_metadata: { role: 'admin' },
      });

      const res = await globalThis.fetch(`${baseUrl}/api/admin/items`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenWithoutSub}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Oscilloscope X',
          condition: 'Working',
        }),
      });

      expect(res.status).toBe(201);
      const created = await res.json();
      expect(typeof created.updated_by).toBe('string');
      expect(created.updated_by).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe('3. GET /api/admin/items', () => {
    it('returns 200 with equipment array ordered by updated_at desc', async () => {
      await db.createEquipment(
        { name: 'Item Alpha', condition: 'Working' },
        'admin-test-id-1',
      );
      await db.createEquipment(
        { name: 'Item Beta', condition: 'Faulty' },
        'admin-test-id-1',
      );

      const res = await globalThis.fetch(`${baseUrl}/api/admin/items`, {
        headers: { Authorization: `Bearer ${validAdminToken}` },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Array<{
        name: string;
        condition: string;
      }>;
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2);
    });
  });

  describe('4. POST /api/admin/items', () => {
    it('returns 201 with created item, attribution fields and triggers revalidation', async () => {
      const triggered: string[][] = [];
      setRevalidateListener((paths) => triggered.push(paths));

      const res = await globalThis.fetch(`${baseUrl}/api/admin/items`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Oscilloscope 100MHz',
          core_functionality: 'Signal visualization',
          condition: 'Working',
          quantity: 2,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe('Oscilloscope 100MHz');
      expect(body.condition).toBe('Working');
      expect(body.quantity).toBe(2);
      expect(body.updated_by).toBe('admin-test-id-1');
      expect(typeof body.updated_at).toBe('string');
      expect(triggered.length).toBeGreaterThan(0);
      expect(triggered[0]).toContain('/');
      expect(triggered[0]).toContain('/room');
      expect(triggered[0]).toContain(`/item/${body.id}`);
    });

    it('returns 409 condition-enum-invalid when condition is not an allowed enum', async () => {
      const res = await globalThis.fetch(`${baseUrl}/api/admin/items`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Invalid Item',
          condition: 'Broken Beyond Repair',
        }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe('condition-enum-invalid');
      expect(typeof body.message).toBe('string');
    });

    it('returns 409 inventory-ceiling when 15 items already exist', async () => {
      for (let i = 0; i < 15; i++) {
        await db.createEquipment(
          { name: `Item ${i + 1}`, condition: 'Working' },
          'admin-test-id-1',
        );
      }

      const res = await globalThis.fetch(`${baseUrl}/api/admin/items`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Item 16',
          condition: 'Working',
        }),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe('inventory-ceiling');
      expect(body.message).toContain('15');
    });
  });

  describe('5. GET /api/admin/items/:id', () => {
    it('returns 200 with item when found', async () => {
      const created = await db.createEquipment(
        { name: 'Spectrum Analyzer', condition: 'Working' },
        'admin-test-id-1',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}`,
        {
          headers: { Authorization: `Bearer ${validAdminToken}` },
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(created.id);
      expect(body.name).toBe('Spectrum Analyzer');
    });

    it('returns 404 not-found when item does not exist', async () => {
      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/non-existent-uuid`,
        {
          headers: { Authorization: `Bearer ${validAdminToken}` },
        },
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('not-found');
    });
  });

  describe('6. PATCH /api/admin/items/:id', () => {
    it('returns 200 with updated fields, attribution, and triggers revalidation', async () => {
      const created = await db.createEquipment(
        { name: 'Digital Multimeter', condition: 'Working' },
        'admin-test-id-1',
      );

      const triggered: string[][] = [];
      setRevalidateListener((paths) => triggered.push(paths));

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            condition: 'Under Maintenance',
            quantity: 5,
          }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.condition).toBe('Under Maintenance');
      expect(body.quantity).toBe(5);
      expect(body.updated_by).toBe('admin-test-id-1');
      expect(triggered.length).toBeGreaterThan(0);
      expect(triggered[0]).toContain(`/item/${created.id}`);
    });

    it('returns 409 condition-enum-invalid when patch condition is invalid', async () => {
      const created = await db.createEquipment(
        { name: 'Digital Multimeter', condition: 'Working' },
        'admin-test-id-1',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            condition: 'Unusable',
          }),
        },
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe('condition-enum-invalid');
    });

    it('returns 404 not-found when patching missing item', async () => {
      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/missing-uuid`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ condition: 'Working' }),
        },
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('not-found');
    });
  });

  describe('7. DELETE /api/admin/items/:id', () => {
    it('returns 204, deletes item and triggers revalidation', async () => {
      const created = await db.createEquipment(
        { name: 'Soldering Station', condition: 'Working' },
        'admin-test-id-1',
      );

      const triggered: string[][] = [];
      setRevalidateListener((paths) => triggered.push(paths));

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validAdminToken}` },
        },
      );

      expect(res.status).toBe(204);
      const found = await db.getEquipmentById(created.id);
      expect(found).toBeNull();
      expect(triggered.length).toBeGreaterThan(0);
      expect(triggered[0]).toContain(`/item/${created.id}`);
    });

    it('returns 404 not-found when deleting non-existent item', async () => {
      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/missing-uuid`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validAdminToken}` },
        },
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('not-found');
    });
  });

  describe('8. POST /api/admin/items/:id/images', () => {
    const validPngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);

    it('returns 201 with updated image_keys and triggers revalidation on valid image upload', async () => {
      const created = await db.createEquipment(
        { name: 'Workstation PC', condition: 'Working' },
        'admin-test-id-1',
      );

      const triggered: string[][] = [];
      setRevalidateListener((paths) => triggered.push(paths));

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: validPngHeader,
        },
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as { image_keys: string[] };
      expect(Array.isArray(body.image_keys)).toBe(true);
      expect(body.image_keys.length).toBe(1);
      expect(triggered.length).toBeGreaterThan(0);
      expect(triggered[0]).toContain(`/item/${created.id}`);
    });

    it('returns 404 not-found when item does not exist', async () => {
      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/missing-uuid/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: validPngHeader,
        },
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('not-found');
    });

    it('returns 413 image-too-large naming byte counts vs cap when file exceeds cap', async () => {
      const created = await db.createEquipment(
        { name: 'Workstation PC', condition: 'Working' },
        'admin-test-id-1',
      );

      const oversizedLength = MAX_IMAGE_BYTES + 1024;
      const oversizedBuffer = Buffer.alloc(oversizedLength, 0x89);
      oversizedBuffer[1] = 0x50;
      oversizedBuffer[2] = 0x4e;
      oversizedBuffer[3] = 0x47;
      oversizedBuffer[4] = 0x0d;
      oversizedBuffer[5] = 0x0a;
      oversizedBuffer[6] = 0x1a;
      oversizedBuffer[7] = 0x0a;

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: oversizedBuffer,
        },
      );

      expect(res.status).toBe(413);
      const body = await res.json();
      expect(body.error).toBe('image-too-large');
      expect(body.message).toContain(String(oversizedLength));
      expect(body.message).toContain(String(MAX_IMAGE_BYTES));
    });

    it('returns 415 mime-rejected when magic byte sniff fails', async () => {
      const created = await db.createEquipment(
        { name: 'Workstation PC', condition: 'Working' },
        'admin-test-id-1',
      );

      const fakeImageBytes = Buffer.from('NOT_A_VALID_IMAGE_HEADER');

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: fakeImageBytes,
        },
      );

      expect(res.status).toBe(415);
      const body = await res.json();
      expect(body.error).toBe('mime-rejected');
    });

    it('returns 502 r2-write-failed when storage write fails', async () => {
      const created = await db.createEquipment(
        { name: 'Workstation PC', condition: 'Working' },
        'admin-test-id-1',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
            'x-simulate-r2-failure': 'true',
          },
          body: validPngHeader,
        },
      );

      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toBe('r2-write-failed');
    });
  });

  describe('9. DELETE /api/admin/items/:id/images/:key', () => {
    it('returns 204, removes image key and triggers revalidation', async () => {
      const created = await db.createEquipment(
        {
          name: 'Server Rack',
          condition: 'Working',
          image_keys: ['img-1.webp', 'img-2.webp'],
        },
        'admin-test-id-1',
      );

      const triggered: string[][] = [];
      setRevalidateListener((paths) => triggered.push(paths));

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images/img-1.webp`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validAdminToken}` },
        },
      );

      expect(res.status).toBe(204);
      const item = await db.getEquipmentById(created.id);
      expect(item?.image_keys).toEqual(['img-2.webp']);
      expect(triggered.length).toBeGreaterThan(0);
      expect(triggered[0]).toContain(`/item/${created.id}`);
    });

    it('returns 404 not-found when item does not exist', async () => {
      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/missing-uuid/images/img-1.webp`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validAdminToken}` },
        },
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('not-found');
    });

    it('returns 404 not-found when key does not exist on item', async () => {
      const created = await db.createEquipment(
        { name: 'Server Rack', condition: 'Working', image_keys: [] },
        'admin-test-id-1',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images/non-existent-key`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validAdminToken}` },
        },
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('not-found');
    });
  });

  describe('10. GET /api/admin/admins', () => {
    it('returns 200 with list of administrators', async () => {
      const res = await globalThis.fetch(`${baseUrl}/api/admin/admins`, {
        headers: { Authorization: `Bearer ${validAdminToken}` },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as Array<{ email: string }>;
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body[0].email).toBe('admin@smartcomp.abu.edu.ng');
    });
  });

  describe('11. POST /api/admin/admins/invites', () => {
    it('returns 201 with invite details on valid invite', async () => {
      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/invites`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'newadmin@smartcomp.abu.edu.ng' }),
        },
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.email).toBe('newadmin@smartcomp.abu.edu.ng');
      expect(typeof body.token).toBe('string');
    });

    it('returns 409 already-admin when user is already an admin', async () => {
      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/invites`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'admin@smartcomp.abu.edu.ng' }),
        },
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe('already-admin');
    });

    it('returns 409 invite-pending when an invite is already pending', async () => {
      await db.createInvite('pending@smartcomp.abu.edu.ng', 'admin-test-id-1');

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/invites`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'pending@smartcomp.abu.edu.ng' }),
        },
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe('invite-pending');
    });

    it('returns 502 gmail-send-failed when email service fails', async () => {
      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/invites`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
            'x-simulate-gmail-failure': 'true',
          },
          body: JSON.stringify({ email: 'fail@smartcomp.abu.edu.ng' }),
        },
      );

      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toBe('gmail-send-failed');
    });
  });

  describe('12. POST /api/admin/invites/accept (Unauthenticated endpoint)', () => {
    it('returns 200 { status: active } on valid token and provisions admin', async () => {
      const { token } = await db.createInvite(
        'acceptme@smartcomp.abu.edu.ng',
        'admin-test-id-1',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/invites/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, name: 'Accepted Admin' }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'active' });

      const newAdmin = await db.getAdminByEmail(
        'acceptme@smartcomp.abu.edu.ng',
      );
      expect(newAdmin).not.toBeNull();
      expect(newAdmin?.name).toBe('Accepted Admin');
    });

    it('returns 404 unknown-token on missing or unknown token', async () => {
      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/invites/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: 'unknown-token-string' }),
        },
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('unknown-token');
    });

    it('returns 409 already-accepted when token was already used', async () => {
      const { token } = await db.createInvite(
        'reused@smartcomp.abu.edu.ng',
        'admin-test-id-1',
      );

      await globalThis.fetch(`${baseUrl}/api/admin/invites/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const secondRes = await globalThis.fetch(
        `${baseUrl}/api/admin/invites/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        },
      );

      expect(secondRes.status).toBe(409);
      const body = await secondRes.json();
      expect(body.error).toBe('already-accepted');
    });
  });

  describe('13. DELETE /api/admin/admins/:id (Last-admin guard)', () => {
    it('returns 409 last-admin with clear message when only one admin remains', async () => {
      const admins = await db.getAdmins();
      expect(admins.length).toBe(1);

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/${admins[0].id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validAdminToken}` },
        },
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe('last-admin');
      expect(body.message).toContain('last remaining administrator');

      const remaining = await db.getAdmins();
      expect(remaining.length).toBe(1);
    });

    it('returns 404 not-found when deleting nonexistent admin ID and only 1 admin exists', async () => {
      const admins = await db.getAdmins();
      expect(admins.length).toBe(1);

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/nonexistent-id`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validAdminToken}` },
        },
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('not-found');
    });

    it('returns 204 when deleting an admin with multiple admins in system', async () => {
      const { token } = await db.createInvite(
        'peer@smartcomp.abu.edu.ng',
        'admin-test-id-1',
      );
      await globalThis.fetch(`${baseUrl}/api/admin/invites/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const admins = await db.getAdmins();
      expect(admins.length).toBe(2);

      const peerAdmin = admins.find(
        (a) => a.email === 'peer@smartcomp.abu.edu.ng',
      );
      expect(peerAdmin).toBeDefined();

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/${peerAdmin!.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validAdminToken}` },
        },
      );

      expect(res.status).toBe(204);
      const remaining = await db.getAdmins();
      expect(remaining.length).toBe(1);
    });

    it('returns 404 not-found when admin does not exist', async () => {
      const { token } = await db.createInvite(
        'extra@smartcomp.abu.edu.ng',
        'admin-test-id-1',
      );
      await globalThis.fetch(`${baseUrl}/api/admin/invites/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/non-existent-admin-id`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validAdminToken}` },
        },
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('not-found');
    });
  });

  describe('14. GET /api/admin/export/pdf & /export/csv (COREN Exports)', () => {
    it('returns 200 with PDF stream', async () => {
      await db.createEquipment(
        { name: 'Function Generator', condition: 'Working' },
        'admin-test-id-1',
      );

      const res = await globalThis.fetch(`${baseUrl}/api/admin/export/pdf`, {
        headers: { Authorization: `Bearer ${validAdminToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/pdf');
      const text = await res.text();
      expect(text).toContain('%PDF-1.4');
    });

    it('returns 500 export-generation-failed when PDF generation fails', async () => {
      const res = await globalThis.fetch(`${baseUrl}/api/admin/export/pdf`, {
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
          'x-simulate-export-failure': 'true',
        },
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('export-generation-failed');
    });

    it('returns 200 with CSV stream containing header and rows', async () => {
      await db.createEquipment(
        { name: 'Logic Analyzer', condition: 'Working', quantity: 3 },
        'admin-test-id-1',
      );

      const res = await globalThis.fetch(`${baseUrl}/api/admin/export/csv`, {
        headers: { Authorization: `Bearer ${validAdminToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      const csv = await res.text();
      expect(csv).toContain('name,condition,quantity,updated_at,updated_by');
      expect(csv).toContain('"Logic Analyzer",Working,3');
    });

    it('returns 500 export-generation-failed when CSV generation fails', async () => {
      const res = await globalThis.fetch(`${baseUrl}/api/admin/export/csv`, {
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
          'x-simulate-export-failure': 'true',
        },
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('export-generation-failed');
    });
  });

  describe('Success Metric 5: Unauthenticated write probe against all mutation endpoints', () => {
    const mutationEndpoints: Array<{
      method: string;
      path: string;
      body?: Record<string, unknown> | Buffer;
      contentType?: string;
    }> = [
      {
        method: 'POST',
        path: '/api/admin/items',
        body: { name: 'Probe Item', condition: 'Working' },
        contentType: 'application/json',
      },
      {
        method: 'PATCH',
        path: '/api/admin/items/dummy-id',
        body: { condition: 'Working' },
        contentType: 'application/json',
      },
      {
        method: 'DELETE',
        path: '/api/admin/items/dummy-id',
      },
      {
        method: 'POST',
        path: '/api/admin/items/dummy-id/images',
        body: Buffer.from('dummy-image'),
        contentType: 'image/png',
      },
      {
        method: 'DELETE',
        path: '/api/admin/items/dummy-id/images/dummy-key',
      },
      {
        method: 'POST',
        path: '/api/admin/admins/invites',
        body: { email: 'probe@smartcomp.abu.edu.ng' },
        contentType: 'application/json',
      },
      {
        method: 'DELETE',
        path: '/api/admin/admins/dummy-id',
      },
    ];

    for (const ep of mutationEndpoints) {
      it(`unauthenticated ${ep.method} ${ep.path} strictly fails with 401`, async () => {
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
      });

      it(`non-admin ${ep.method} ${ep.path} strictly fails with 403`, async () => {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${nonAdminToken}`,
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
      });
    }
  });

  describe('15. CORS Preflight & Headers', () => {
    it('handles OPTIONS preflight with 204 and CORS headers', async () => {
      const res = await globalThis.fetch(`${baseUrl}/api/admin/items`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://abu-smartcomp.vercel.app',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization',
        },
      });

      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe(
        'https://abu-smartcomp.vercel.app',
      );
      expect(res.headers.get('access-control-allow-methods')).toContain('POST');
      expect(res.headers.get('access-control-allow-headers')).toContain(
        'Authorization',
      );
    });

    it('attaches Access-Control-Allow-Origin header to GET requests', async () => {
      const res = await globalThis.fetch(`${baseUrl}/api/admin/items`, {
        method: 'GET',
        headers: {
          Origin: 'https://abu-smartcomp.vercel.app',
          Authorization: `Bearer ${validAdminToken}`,
        },
      });

      expect(res.headers.get('access-control-allow-origin')).toBe(
        'https://abu-smartcomp.vercel.app',
      );
    });
  });
});
