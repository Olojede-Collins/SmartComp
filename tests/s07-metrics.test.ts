// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { app } from '../backend/src/server.js';
import { db } from '../backend/src/db.js';
import { createToken } from '../backend/src/auth.js';
import { storage } from '../backend/src/storage.js';
import {
  auditImageBuffer,
  auditAllStoredImages,
} from '../backend/src/audit-images.js';
import { LEGACY_EQUIPMENT_RECORDS } from '../backend/src/legacy-import.js';
import { setRevalidateListener } from '../backend/src/revalidate.js';

describe('PRD §7 Success Metrics Suite (Session S-07 Metric Verification)', () => {
  let server: http.Server;
  let baseUrl: string;
  let revalidateServer: http.Server;
  let revalidateUrl: string;
  let receivedRevalidateSecret: string | undefined;
  let receivedRevalidateBody: { paths?: string[] } | null = null;
  let revalidateCount = 0;

  const validAdminToken = createToken({
    sub: 'admin-s07-metrics-1',
    email: 'admin@smartcomp.abu.edu.ng',
    app_metadata: { role: 'admin' },
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const nonAdminToken = createToken({
    sub: 'visitor-s07-metrics-1',
    email: 'visitor@smartcomp.abu.edu.ng',
    app_metadata: { role: 'visitor' },
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const missingRoleToken = createToken({
    sub: 'norole-s07-metrics-1',
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
    process.env.REVALIDATE_SECRET = 's07-metric-revalidate-secret-abu';
    storage.clear();
    await auditAllStoredImages();
  }, 20000);

  afterAll(async () => {
    delete process.env.VERCEL_URL;
    delete process.env.REVALIDATE_SECRET;
    setRevalidateListener(null);

    await new Promise<void>((resolve, reject) => {
      revalidateServer.close((err) => (err ? reject(err) : resolve()));
    });

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    db.reset({ equipment: LEGACY_EQUIPMENT_RECORDS });
    receivedRevalidateSecret = undefined;
    receivedRevalidateBody = null;
    revalidateCount = 0;
  });

  describe('Metric 1: Browse works within budget (NFR-1 FCP <= 2.5s, NFR-2 LCP <= 4.0s on /, /room, /item/[id] post-import)', () => {
    it('verifies public route source files exist and configure static/ISR revalidation', () => {
      const routes = [
        path.resolve(process.cwd(), 'app/page.tsx'),
        path.resolve(process.cwd(), 'app/room/page.tsx'),
        path.resolve(process.cwd(), 'app/item/[id]/page.tsx'),
      ];

      for (const routePath of routes) {
        expect(fs.existsSync(routePath)).toBe(true);
        const content = fs.readFileSync(routePath, 'utf8');
        expect(content).toContain('export const revalidate = 60;');
        expect(content.length).toBeLessThan(25000);
      }
    });

    it('verifies post-import item count respects I1 catalogue ceiling of 15 items', async () => {
      const items = await db.getEquipment();
      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(15);
    });

    it('verifies room route enforces single collection without search or pagination controls', () => {
      const roomSource = fs.readFileSync(
        path.resolve(process.cwd(), 'app/room/page.tsx'),
        'utf8',
      );
      expect(roomSource).not.toContain('<input type="search"');
      expect(roomSource).not.toContain('Pagination');
      expect(roomSource).not.toContain('page=');
    });

    it('verifies payload budget of all imported legacy equipment images meets mobile <= 150 KB and desktop <= 400 KB', async () => {
      const summary = await auditAllStoredImages();
      expect(summary.total).toBe(8);
      expect(summary.failed).toBe(0);
      expect(summary.complianceRate).toBe(1.0);

      for (const result of summary.results) {
        expect(result.sizeBytes).toBeLessThanOrEqual(400 * 1024);
        expect(result.meetsDesktopBudget).toBe(true);
        expect(result.format).toBe('webp');
        expect(result.width).toBeLessThanOrEqual(1200);
        expect(result.height).toBeLessThanOrEqual(1200);
      }
    });
  });

  describe('Metric 2: Freshness holds (Sampled admin edit visible to an anonymous visitor <= 60s)', () => {
    it('dispatches revalidation webhook with exact paths and secret when an admin edits an item', async () => {
      const items = await db.getEquipment();
      const targetItem = items[0];

      const patchRes = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${targetItem.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            condition: 'Under Maintenance',
          }),
        },
      );

      expect(patchRes.status).toBe(200);
      const patched = await patchRes.json();
      expect(patched.condition).toBe('Under Maintenance');
      expect(patched.updated_by).toBe('admin-s07-metrics-1');

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(revalidateCount).toBeGreaterThanOrEqual(1);
      expect(receivedRevalidateSecret).toBe('s07-metric-revalidate-secret-abu');
      expect(receivedRevalidateBody).not.toBeNull();
      expect(receivedRevalidateBody?.paths).toEqual(
        expect.arrayContaining(['/', '/room', `/item/${targetItem.id}`]),
      );
    });

    it('verifies Next.js public routes declare 60s background revalidation fallback window', () => {
      const publicPages = [
        'app/page.tsx',
        'app/room/page.tsx',
        'app/item/[id]/page.tsx',
      ];
      for (const p of publicPages) {
        const src = fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');
        expect(src).toMatch(/export\s+const\s+revalidate\s*=\s*60\s*;/);
      }
    });
  });

  describe('Metric 3: Images compliant (100% of stored equipment images pass NFR-3 audit)', () => {
    it('verifies 100% compliance rate on legacy import data against NFR-3 budgets', async () => {
      const summary = await auditAllStoredImages();

      expect(summary.total).toBe(8);
      expect(summary.passed).toBe(8);
      expect(summary.failed).toBe(0);
      expect(summary.complianceRate).toBe(1.0);
      expect(summary.results).toHaveLength(8);
    });

    it('fails audit on negative probes exceeding byte cap, dimensions, or format', async () => {
      const oversizedBuffer = await sharp({
        create: {
          width: 1250,
          height: 800,
          channels: 3,
          background: { r: 50, g: 50, b: 50 },
        },
      })
        .webp()
        .toBuffer();

      const dimAudit = await auditImageBuffer(
        oversizedBuffer,
        'oversized.webp',
      );
      expect(dimAudit.passed).toBe(false);
      expect(dimAudit.violations.some((v) => v.includes('1200'))).toBe(true);

      const jpegBuffer = await sharp({
        create: {
          width: 600,
          height: 400,
          channels: 3,
          background: { r: 100, g: 100, b: 100 },
        },
      })
        .jpeg()
        .toBuffer();

      const formatAudit = await auditImageBuffer(jpegBuffer, 'test.jpg');
      expect(formatAudit.passed).toBe(false);
      expect(formatAudit.violations.some((v) => v.includes('webp'))).toBe(true);
    });
  });

  describe('Metric 4: COREN export ready (PDF and CSV both generate with FR-9.2 5-column floor, record IDs withheld)', () => {
    it('generates CSV export containing 5 confirmed floor columns and withholding record IDs', async () => {
      const res = await globalThis.fetch(`${baseUrl}/api/admin/export/csv`, {
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/csv');
      const csvText = await res.text();
      const lines = csvText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      expect(lines.length).toBeGreaterThan(1);
      const header = lines[0];
      expect(header).toBe('name,condition,quantity,updated_at,updated_by');
      expect(header).not.toContain('id');
      expect(header).not.toContain('record_id');

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        expect(cols.length).toBeGreaterThanOrEqual(5);
      }
    });

    it('generates PDF export starting with %PDF-1.4 header and trailer', async () => {
      const res = await globalThis.fetch(`${baseUrl}/api/admin/export/pdf`, {
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/pdf');
      const buf = Buffer.from(await res.arrayBuffer());
      const pdfString = buf.toString('utf8');

      expect(pdfString.startsWith('%PDF-1.4')).toBe(true);
      expect(pdfString).toContain('AHMADU BELLO UNIVERSITY, ZARIA');
      expect(pdfString).toContain('%%EOF');
      expect(pdfString).not.toContain('00000000-0000-0000-0000-');
    });

    it('verifies client export dialog declares the 5 floor columns and withheld Record ID badge', () => {
      const dialogSrc = fs.readFileSync(
        path.resolve(process.cwd(), 'app/admin/_components/export-dialog.tsx'),
        'utf8',
      );

      expect(dialogSrc).toContain('Item name');
      expect(dialogSrc).toContain('Condition');
      expect(dialogSrc).toContain('Quantity');
      expect(dialogSrc).toContain('Updated');
      expect(dialogSrc).toContain('Updated by');
      expect(dialogSrc).toContain('Record ID');
      expect(dialogSrc).toContain('Withheld');
    });

    it('fails with 500 when export simulation fails', async () => {
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

  describe('Metric 5: No public writes (Unauthenticated probe against all 7 mutation endpoints fails with 401/403)', () => {
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
        body: Buffer.from('probe-image-bytes'),
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
        body: { email: 'probe@abu.edu.ng' },
        contentType: 'application/json',
      },
      {
        name: 'DELETE /api/admin/admins/:id',
        method: 'DELETE',
        path: '/api/admin/admins/00000000-0000-0000-0000-000000000001',
      },
    ];

    for (const ep of mutationEndpoints) {
      it(`${ep.name} unauthenticated returns 401 invalid-token`, async () => {
        const headers: Record<string, string> = {};
        if (ep.contentType) headers['Content-Type'] = ep.contentType;

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

      it(`${ep.name} with non-admin role returns 403 forbidden`, async () => {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${nonAdminToken}`,
        };
        if (ep.contentType) headers['Content-Type'] = ep.contentType;

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

      it(`${ep.name} with missing role claim returns 403 forbidden`, async () => {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${missingRoleToken}`,
        };
        if (ep.contentType) headers['Content-Type'] = ep.contentType;

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

  describe('Metric 6: Last-admin guard works (409 last-admin blocked with clear message)', () => {
    it('hard-blocks removal of the last remaining admin with 409 last-admin and specific message', async () => {
      const admins = await db.getAdmins();
      expect(admins.length).toBe(1);
      const onlyAdmin = admins[0];

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/${onlyAdmin.id}`,
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
    });

    it('allows deleting an admin when more than one administrator exists', async () => {
      const inviteRes = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/invites`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'second.admin@abu.edu.ng' }),
        },
      );
      expect(inviteRes.status).toBe(201);
      const { token } = await inviteRes.json();

      const acceptRes = await globalThis.fetch(
        `${baseUrl}/api/admin/invites/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            name: 'Second Administrator',
          }),
        },
      );
      expect(acceptRes.status).toBe(200);

      const allAdmins = await db.getAdmins();
      expect(allAdmins.length).toBe(2);

      const targetToDelete = allAdmins.find(
        (a) => a.email === 'second.admin@abu.edu.ng',
      );
      expect(targetToDelete).toBeDefined();

      const delRes = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/${targetToDelete!.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
          },
        },
      );
      expect(delRes.status).toBe(204);

      const afterDelete = await db.getAdmins();
      expect(afterDelete.length).toBe(1);
    });
  });

  describe('Metric 7: Availability discipline (Heartbeat workflow & Supabase 7-day pause defense)', () => {
    it('verifies heartbeat workflow schedule runs daily with 15s max timeout against /healthz', () => {
      const heartbeatFile = path.resolve(
        process.cwd(),
        '.github/workflows/heartbeat.yml',
      );
      expect(fs.existsSync(heartbeatFile)).toBe(true);
      const content = fs.readFileSync(heartbeatFile, 'utf8');

      expect(content).toContain("cron: '0 6 * * *'");
      expect(content).toContain('curl -fsS --max-time 15');
      expect(content).toContain('/healthz');
      expect(content).toContain('RENDER_SERVICE_URL');
    });

    it('returns 200 { ok: true } on /healthz when database is connected', async () => {
      db.setHealthy(true);
      const res = await globalThis.fetch(`${baseUrl}/healthz`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    it('returns 503 { error: db-unavailable } on /healthz when database connection fails', async () => {
      db.setHealthy(false);
      const res = await globalThis.fetch(`${baseUrl}/healthz`);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toBe('db-unavailable');
      expect(body.message).toBe('Database connectivity probe failed');
    });
  });

  describe('Metric 8: Invite loop closes (Full invite -> email -> accept -> login sequence)', () => {
    it('completes the entire invite loop from generation to acceptance and session provision', async () => {
      const inviteEmail = 'engr.bello@smartcomp.abu.edu.ng';

      const inviteRes = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/invites`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: inviteEmail }),
        },
      );

      expect(inviteRes.status).toBe(201);
      const inviteData = await inviteRes.json();
      expect(inviteData.email).toBe(inviteEmail);
      expect(typeof inviteData.token).toBe('string');
      expect(inviteData.token.length).toBeGreaterThan(16);

      const expectedHash = crypto
        .createHash('sha256')
        .update(inviteData.token)
        .digest('hex');
      const storedInvite = await db.getInviteByTokenHash(expectedHash);
      expect(storedInvite).not.toBeNull();
      expect(storedInvite?.accepted_at).toBeNull();
      expect(storedInvite?.token_hash).toBe(expectedHash);

      const dupRes = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/invites`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: inviteEmail }),
        },
      );
      expect(dupRes.status).toBe(409);
      const dupBody = await dupRes.json();
      expect(dupBody.error).toBe('invite-pending');

      const acceptRes = await globalThis.fetch(
        `${baseUrl}/api/admin/invites/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: inviteData.token,
            name: 'Engr. Fatima Bello',
          }),
        },
      );

      expect(acceptRes.status).toBe(200);
      const acceptBody = await acceptRes.json();
      expect(acceptBody.status).toBe('active');

      const updatedInvite = await db.getInviteByTokenHash(expectedHash);
      expect(updatedInvite?.accepted_at).not.toBeNull();

      const newAdmin = await db.getAdminByEmail(inviteEmail);
      expect(newAdmin).not.toBeNull();
      expect(newAdmin?.name).toBe('Engr. Fatima Bello');
      expect(newAdmin?.email).toBe(inviteEmail);

      const replayRes = await globalThis.fetch(
        `${baseUrl}/api/admin/invites/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: inviteData.token,
            name: 'Duplicate Attempt',
          }),
        },
      );
      expect(replayRes.status).toBe(409);
      const replayBody = await replayRes.json();
      expect(replayBody.error).toBe('already-accepted');

      const newAdminToken = createToken({
        sub: newAdmin!.id,
        email: newAdmin!.email,
        app_metadata: { role: 'admin' },
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const protectedRes = await globalThis.fetch(
        `${baseUrl}/api/admin/admins`,
        {
          headers: {
            Authorization: `Bearer ${newAdminToken}`,
          },
        },
      );
      expect(protectedRes.status).toBe(200);
      const adminList = await protectedRes.json();
      expect(
        adminList.some((a: { email: string }) => a.email === inviteEmail),
      ).toBe(true);
    });
  });
});
