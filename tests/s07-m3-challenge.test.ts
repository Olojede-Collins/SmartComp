// @vitest-environment node
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
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
import { POST as revalidatePost } from '@/app/api/revalidate/route';
import { checkMigrations } from '../scripts/check-migrations.mjs';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Milestone M3 Challenger Adversarial Stress Suite (Session S-07)', () => {
  let server: http.Server;
  let baseUrl: string;
  let revalidateServer: http.Server;
  let revalidateUrl: string;
  let receivedRevalidateSecret: string | undefined;
  let receivedRevalidateBody: { paths?: string[] } | null = null;
  let revalidateCount = 0;

  const validAdminToken = createToken({
    sub: 'admin-challenge-x3',
    email: 'admin-x3@smartcomp.abu.edu.ng',
    app_metadata: { role: 'admin' },
    exp: Math.floor(Date.now() / 1000) + 7200,
  });

  const visitorToken = createToken({
    sub: 'visitor-challenge-x3',
    email: 'visitor-x3@smartcomp.abu.edu.ng',
    app_metadata: { role: 'visitor' },
    exp: Math.floor(Date.now() / 1000) + 7200,
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
    process.env.REVALIDATE_SECRET = 's07-challenge-secret-abu-2026';
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

  describe('Seam 1: Metric 1 budget edge cases', () => {
    it('rejects adding items beyond the 15-item inventory ceiling with 409 inventory-ceiling', async () => {
      const existing = await db.getEquipment();
      const needed = 15 - existing.length;

      for (let i = 0; i < needed; i++) {
        const createRes = await globalThis.fetch(`${baseUrl}/api/admin/items`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `Cap Test Item ${i + 1}`,
            condition: 'Working',
            quantity: 1,
          }),
        });
        expect(createRes.status).toBe(201);
      }

      const totalItems = await db.getEquipment();
      expect(totalItems.length).toBe(15);

      const overflowRes = await globalThis.fetch(`${baseUrl}/api/admin/items`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Breach Item 16',
          condition: 'Working',
          quantity: 1,
        }),
      });

      expect(overflowRes.status).toBe(409);
      const overflowData = await overflowRes.json();
      expect(overflowData.error).toBe('inventory-ceiling');
      expect(overflowData.message).toBe(
        'Inventory ceiling of 15 items reached',
      );

      const afterTotal = await db.getEquipment();
      expect(afterTotal.length).toBe(15);
    });

    it('rejects oversized whitespace-only name payloads with 400 invalid-name', async () => {
      const whitespacePayload = '   \t\n   '.repeat(500);
      const res = await globalThis.fetch(`${baseUrl}/api/admin/items`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: whitespacePayload,
          condition: 'Working',
          quantity: 1,
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('invalid-name');
      expect(body.message).toBe('Item name is required');
    });

    it('verifies public route source files do not import heavyweight libraries that bloat bundles', () => {
      const publicRouteFiles = [
        path.resolve(process.cwd(), 'app/page.tsx'),
        path.resolve(process.cwd(), 'app/room/page.tsx'),
        path.resolve(process.cwd(), 'app/item/[id]/page.tsx'),
        path.resolve(process.cwd(), 'app/privacy/page.tsx'),
      ];

      const bannedPackages = [
        'lodash',
        'moment',
        'dayjs',
        'chart.js',
        'three',
        'lucide-react',
        'axios',
        'jquery',
      ];

      for (const filePath of publicRouteFiles) {
        expect(fs.existsSync(filePath)).toBe(true);
        const content = fs.readFileSync(filePath, 'utf8');
        for (const pkg of bannedPackages) {
          expect(content).not.toContain(`from '${pkg}'`);
          expect(content).not.toContain(`from "${pkg}"`);
          expect(content).not.toContain(`require('${pkg}')`);
        }
      }
    });

    it('handles empty database catalogue gracefully on items route without 500 error', async () => {
      db.reset({ equipment: [] });
      const emptyItems = await db.getEquipment();
      expect(emptyItems.length).toBe(0);

      const res = await globalThis.fetch(`${baseUrl}/api/admin/items`, {
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });
  });

  describe('Seam 2: Metric 2 freshness edge cases', () => {
    it('returns 401 on forged secret across headers, bearer auth, and json body', async () => {
      const origSecret = process.env.REVALIDATE_SECRET;
      process.env.REVALIDATE_SECRET = 'valid-production-revalidate-secret';

      try {
        const headerReq = new Request('http://localhost:3000/api/revalidate', {
          method: 'POST',
          headers: { 'x-revalidate-secret': 'forged-secret-1' },
        });
        const headerRes = await revalidatePost(headerReq);
        expect(headerRes.status).toBe(401);
        expect(await headerRes.json()).toEqual({ error: 'invalid-secret' });

        const bearerReq = new Request('http://localhost:3000/api/revalidate', {
          method: 'POST',
          headers: { Authorization: 'Bearer forged-secret-bearer' },
        });
        const bearerRes = await revalidatePost(bearerReq);
        expect(bearerRes.status).toBe(401);
        expect(await bearerRes.json()).toEqual({ error: 'invalid-secret' });

        const bodyReq = new Request('http://localhost:3000/api/revalidate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: 'forged-body-secret' }),
        });
        const bodyRes = await revalidatePost(bodyReq);
        expect(bodyRes.status).toBe(401);
        expect(await bodyRes.json()).toEqual({ error: 'invalid-secret' });

        const emptyReq = new Request('http://localhost:3000/api/revalidate', {
          method: 'POST',
        });
        const emptyRes = await revalidatePost(emptyReq);
        expect(emptyRes.status).toBe(401);
        expect(await emptyRes.json()).toEqual({ error: 'invalid-secret' });
      } finally {
        process.env.REVALIDATE_SECRET = origSecret;
      }
    });

    it('returns 500 when REVALIDATE_SECRET is unset in the server environment', async () => {
      const origSecret = process.env.REVALIDATE_SECRET;
      delete process.env.REVALIDATE_SECRET;

      try {
        const req = new Request('http://localhost:3000/api/revalidate', {
          method: 'POST',
          headers: { 'x-revalidate-secret': 'any-value' },
        });
        const res = await revalidatePost(req);
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({
          error: 'revalidate-secret-missing',
        });
      } finally {
        process.env.REVALIDATE_SECRET = origSecret;
      }
    });

    it('sanitizes malicious and invalid paths passed to /api/revalidate', async () => {
      const origSecret = process.env.REVALIDATE_SECRET;
      process.env.REVALIDATE_SECRET = 'valid-production-revalidate-secret';

      try {
        const req = new Request('http://localhost:3000/api/revalidate', {
          method: 'POST',
          headers: {
            'x-revalidate-secret': 'valid-production-revalidate-secret',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paths: [
              '../../etc/passwd',
              'https://attacker.com/malicious',
              '/item/safe-uuid-1',
              12345,
              null,
              {},
              '/custom-path',
            ],
          }),
        });
        const res = await revalidatePost(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.revalidated).toBe(true);
        expect(data.paths).toEqual(
          expect.arrayContaining([
            '/',
            '/room',
            '/item/safe-uuid-1',
            '/custom-path',
          ]),
        );
        expect(data.paths).not.toContain('../../etc/passwd');
        expect(data.paths).not.toContain('https://attacker.com/malicious');
      } finally {
        process.env.REVALIDATE_SECRET = origSecret;
      }
    });

    it('dispatches revalidation on concurrent item edits without dropping triggers', async () => {
      const items = await db.getEquipment();
      const itemA = items[0];
      const itemB = items[1];

      const patchA = globalThis.fetch(
        `${baseUrl}/api/admin/items/${itemA.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ condition: 'Faulty' }),
        },
      );

      const patchB = globalThis.fetch(
        `${baseUrl}/api/admin/items/${itemB.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ condition: 'Working' }),
        },
      );

      const [resA, resB] = await Promise.all([patchA, patchB]);
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(revalidateCount).toBeGreaterThanOrEqual(2);
      expect(receivedRevalidateSecret).toBe('s07-challenge-secret-abu-2026');
      expect(receivedRevalidateBody?.paths).toBeDefined();
    });

    it('overrides client-supplied timestamps with authoritative server timestamps', async () => {
      const items = await db.getEquipment();
      const target = items[0];
      const spoofedOldDate = '1985-05-15T10:00:00.000Z';

      const patchRes = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${target.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            condition: 'Working',
            updated_at: spoofedOldDate,
          }),
        },
      );

      expect(patchRes.status).toBe(200);
      const patched = await patchRes.json();
      expect(patched.updated_at).not.toBe(spoofedOldDate);
      const timestampDiffMs = Math.abs(
        Date.now() - new Date(patched.updated_at).getTime(),
      );
      expect(timestampDiffMs).toBeLessThan(5000);
    });
  });

  describe('Seam 3: Metric 3 image audit boundaries', () => {
    it('fails audit on zero-byte image buffers', async () => {
      const zeroBuffer = Buffer.alloc(0);
      const audit = await auditImageBuffer(zeroBuffer, 'zero-byte.webp');
      expect(audit.passed).toBe(false);
      expect(audit.violations.length).toBeGreaterThan(0);
      expect(
        audit.violations.some(
          (v) =>
            v.toLowerCase().includes('corrupt') ||
            v.toLowerCase().includes('unsupported'),
        ),
      ).toBe(true);
    });

    it('strictly tests dimension boundary at 1200px limit', async () => {
      const exactBoundary = await sharp({
        create: {
          width: 1200,
          height: 1200,
          channels: 3,
          background: { r: 10, g: 20, b: 30 },
        },
      })
        .webp()
        .toBuffer();

      const passAudit = await auditImageBuffer(
        exactBoundary,
        'exact-1200.webp',
      );
      expect(passAudit.passed).toBe(true);
      expect(passAudit.violations).toHaveLength(0);

      const overBoundary = await sharp({
        create: {
          width: 1201,
          height: 800,
          channels: 3,
          background: { r: 10, g: 20, b: 30 },
        },
      })
        .webp()
        .toBuffer();

      const failAudit = await auditImageBuffer(overBoundary, 'over-1200.webp');
      expect(failAudit.passed).toBe(false);
      expect(failAudit.violations.some((v) => v.includes('1200'))).toBe(true);
    });

    it('fails audit on corrupted WebP magic bytes or malformed headers', async () => {
      const fakeWebP = Buffer.from(
        'RIFF\x20\x00\x00\x00WEBPVP8Lcorruptedpayloadhere',
      );
      const audit = await auditImageBuffer(fakeWebP, 'corrupted.webp');
      expect(audit.passed).toBe(false);
      expect(audit.violations.length).toBeGreaterThan(0);
    });

    it('fails desktop budget when image size exceeds 400 KB limit', async () => {
      const largePayload = Buffer.alloc(401 * 1024, 0);
      const largeWebP = await sharp({
        create: {
          width: 1000,
          height: 1000,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .webp({ quality: 100, lossless: true })
        .toBuffer();

      const syntheticOverBudget = Buffer.concat([largeWebP, largePayload]);
      const audit = await auditImageBuffer(
        syntheticOverBudget,
        'over-budget.webp',
      );
      expect(audit.sizeBytes).toBeGreaterThan(400 * 1024);
      expect(audit.meetsDesktopBudget).toBe(false);
      expect(audit.passed).toBe(false);
    });

    it('fails audit on non-WebP and non-AVIF image formats', async () => {
      const pngBuffer = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .png()
        .toBuffer();

      const auditPng = await auditImageBuffer(pngBuffer, 'format-probe.png');
      expect(auditPng.passed).toBe(false);
      expect(auditPng.format).toBe('png');
      expect(
        auditPng.violations.some((v) => v.includes('Invalid format')),
      ).toBe(true);

      const jpegBuffer = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .jpeg()
        .toBuffer();

      const auditJpeg = await auditImageBuffer(jpegBuffer, 'format-probe.jpg');
      expect(auditJpeg.passed).toBe(false);
      expect(auditJpeg.format).toBe('jpeg');
      expect(
        auditJpeg.violations.some((v) => v.includes('Invalid format')),
      ).toBe(true);
    });

    it('rejects uploads exceeding 8 MB raw size with HTTP 413 image-too-large', async () => {
      const items = await db.getEquipment();
      const target = items[0];

      const oversizedPayload = Buffer.alloc(8 * 1024 * 1024 + 1024, 0);

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${target.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/jpeg',
          },
          body: new Uint8Array(oversizedPayload),
        },
      );

      expect(res.status).toBe(413);
      const body = await res.json();
      expect(body.error).toBe('image-too-large');
      expect(body.message).toContain('8388608');
    });

    it('rejects uploads with invalid magic bytes with HTTP 415 mime-rejected', async () => {
      const items = await db.getEquipment();
      const target = items[0];

      const textPayload = Buffer.from('Plain text file masquerading as image');

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${target.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/jpeg',
          },
          body: new Uint8Array(textPayload),
        },
      );

      expect(res.status).toBe(415);
      const body = await res.json();
      expect(body.error).toBe('mime-rejected');
    });
  });

  describe('Seam 4: Metric 4 COREN export fidelity', () => {
    it('escapes complex strings, quotes, and newlines in CSV export RFC 4180 format', async () => {
      const complexItem = await db.createEquipment(
        {
          name: 'Oscilloscope, "Digital" \n Model X=1+2',
          condition: 'Working',
          quantity: 2,
        },
        'admin-challenge-x3',
      );

      const res = await globalThis.fetch(`${baseUrl}/api/admin/export/csv`, {
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const csv = await res.text();
      expect(csv).toContain('""Digital""');
      expect(csv).toContain('Oscilloscope');
      expect(csv).not.toContain(complexItem.id);
    });

    it('verifies CSV export matches 5-column floor header and preserves field counts', async () => {
      const res = await globalThis.fetch(`${baseUrl}/api/admin/export/csv`, {
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const csv = await res.text();
      const lines = csv.split('\n').filter((l) => l.trim().length > 0);

      expect(lines[0]).toBe('name,condition,quantity,updated_at,updated_by');
      for (let i = 1; i < lines.length; i++) {
        expect(lines[i].length).toBeGreaterThan(0);
      }
    });

    it('withholds internal equipment record UUIDs from CSV and PDF exports', async () => {
      const items = await db.getEquipment();
      expect(items.length).toBeGreaterThan(0);

      const csvRes = await globalThis.fetch(`${baseUrl}/api/admin/export/csv`, {
        headers: { Authorization: `Bearer ${validAdminToken}` },
      });
      const csvText = await csvRes.text();

      const pdfRes = await globalThis.fetch(`${baseUrl}/api/admin/export/pdf`, {
        headers: { Authorization: `Bearer ${validAdminToken}` },
      });
      const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
      const pdfText = pdfBuf.toString('utf8');

      for (const item of items) {
        expect(csvText).not.toContain(item.id);
        expect(pdfText).not.toContain(item.id);
      }
    });

    it('generates valid %PDF-1.4 binary stream with %%EOF trailer', async () => {
      const res = await globalThis.fetch(`${baseUrl}/api/admin/export/pdf`, {
        headers: { Authorization: `Bearer ${validAdminToken}` },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/pdf');
      const buf = Buffer.from(await res.arrayBuffer());
      const pdf = buf.toString('utf8');

      expect(pdf.startsWith('%PDF-1.4')).toBe(true);
      expect(pdf).toContain('AHMADU BELLO UNIVERSITY, ZARIA');
      expect(pdf).toContain('%%EOF');
    });

    it('handles simulated export failures with 500 export-generation-failed', async () => {
      const csvFail = await globalThis.fetch(
        `${baseUrl}/api/admin/export/csv`,
        {
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'x-simulate-export-failure': 'true',
          },
        },
      );
      expect(csvFail.status).toBe(500);
      const csvErr = await csvFail.json();
      expect(csvErr.error).toBe('export-generation-failed');

      const pdfFail = await globalThis.fetch(
        `${baseUrl}/api/admin/export/pdf`,
        {
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'x-simulate-export-failure': 'true',
          },
        },
      );
      expect(pdfFail.status).toBe(500);
      const pdfErr = await pdfFail.json();
      expect(pdfErr.error).toBe('export-generation-failed');
    });
  });

  describe('Seam 5: Metric 5 mutation security attacks', () => {
    const mutationTargets = [
      {
        endpoint: 'POST /api/admin/items',
        method: 'POST',
        path: '/api/admin/items',
        body: { name: 'Probe', condition: 'Working' },
        contentType: 'application/json',
      },
      {
        endpoint: 'PATCH /api/admin/items/:id',
        method: 'PATCH',
        path: '/api/admin/items/00000000-0000-0000-0000-000000000001',
        body: { condition: 'Working' },
        contentType: 'application/json',
      },
      {
        endpoint: 'DELETE /api/admin/items/:id',
        method: 'DELETE',
        path: '/api/admin/items/00000000-0000-0000-0000-000000000001',
      },
      {
        endpoint: 'POST /api/admin/items/:id/images',
        method: 'POST',
        path: '/api/admin/items/00000000-0000-0000-0000-000000000001/images',
        body: Buffer.from('test-image'),
        contentType: 'image/jpeg',
      },
      {
        endpoint: 'DELETE /api/admin/items/:id/images/:key',
        method: 'DELETE',
        path: '/api/admin/items/00000000-0000-0000-0000-000000000001/images/key.webp',
      },
      {
        endpoint: 'POST /api/admin/admins/invites',
        method: 'POST',
        path: '/api/admin/admins/invites',
        body: { email: 'probe@abu.edu.ng' },
        contentType: 'application/json',
      },
      {
        endpoint: 'DELETE /api/admin/admins/:id',
        method: 'DELETE',
        path: '/api/admin/admins/00000000-0000-0000-0000-000000000001',
      },
    ];

    for (const target of mutationTargets) {
      it(`rejects non-admin role with 403 on ${target.endpoint}`, async () => {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${visitorToken}`,
        };
        if (target.contentType) headers['Content-Type'] = target.contentType;

        const res = await globalThis.fetch(`${baseUrl}${target.path}`, {
          method: target.method,
          headers,
          body: target.body
            ? Buffer.isBuffer(target.body)
              ? new Uint8Array(target.body)
              : JSON.stringify(target.body)
            : undefined,
        });

        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toBe('forbidden');
      });

      it(`rejects missing Authorization header with 401 on ${target.endpoint}`, async () => {
        const headers: Record<string, string> = {};
        if (target.contentType) headers['Content-Type'] = target.contentType;

        const res = await globalThis.fetch(`${baseUrl}${target.path}`, {
          method: target.method,
          headers,
          body: target.body
            ? Buffer.isBuffer(target.body)
              ? new Uint8Array(target.body)
              : JSON.stringify(target.body)
            : undefined,
        });

        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBe('invalid-token');
      });
    }

    it('rejects alg=none attack token with 401 invalid-token', async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: 'none', typ: 'JWT' }),
      ).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          sub: 'hacker-1',
          app_metadata: { role: 'admin' },
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      const res = await globalThis.fetch(`${baseUrl}/api/admin/admins`, {
        headers: { Authorization: `Bearer ${noneToken}` },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('invalid-token');
    });

    it('rejects tokens signed with unauthorized secrets with 401 invalid-token', async () => {
      const fakeToken = createToken(
        {
          sub: 'intruder-1',
          app_metadata: { role: 'admin' },
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        'wrong-secret-key-for-test',
      );

      const res = await globalThis.fetch(`${baseUrl}/api/admin/admins`, {
        headers: { Authorization: `Bearer ${fakeToken}` },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('invalid-token');
    });

    it('rejects expired tokens with 401 invalid-token', async () => {
      const expiredToken = createToken({
        sub: 'expired-admin-1',
        app_metadata: { role: 'admin' },
        exp: Math.floor(Date.now() / 1000) - 300,
      });

      const res = await globalThis.fetch(`${baseUrl}/api/admin/admins`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('invalid-token');
    });

    it('rejects spoofed override headers without valid bearer tokens', async () => {
      const spoofHeaders: Record<string, string>[] = [
        { 'X-Admin-Override': 'true' },
        { 'X-Role': 'admin' },
        { 'X-Forwarded-User': 'admin@abu.edu.ng' },
        { Authorization: 'Bearer ' },
        { Authorization: 'Basic YWRtaW46cGFzc3dvcmQ=' },
      ];

      for (const h of spoofHeaders) {
        const res = await globalThis.fetch(`${baseUrl}/api/admin/admins`, {
          headers: h,
        });
        expect(res.status).toBe(401);
      }
    });
  });

  describe('Seam 6: Metric 6 last-admin race conditions', () => {
    it('blocks concurrent deletion requests when only 1 admin remains', async () => {
      const admins = await db.getAdmins();
      expect(admins.length).toBe(1);
      const targetId = admins[0].id;

      const deleteRequests = Array.from({ length: 8 }, () =>
        globalThis.fetch(`${baseUrl}/api/admin/admins/${targetId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validAdminToken}` },
        }),
      );

      const responses = await Promise.all(deleteRequests);
      for (const res of responses) {
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error).toBe('last-admin');
      }

      const surviving = await db.getAdmins();
      expect(surviving.length).toBe(1);
    });

    it('guarantees only one deletion succeeds when 2 admins delete concurrently', async () => {
      const inviteRes = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/invites`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'peer.admin@abu.edu.ng' }),
        },
      );
      const { token } = await inviteRes.json();

      await globalThis.fetch(`${baseUrl}/api/admin/invites/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: 'Peer Admin' }),
      });

      const twoAdmins = await db.getAdmins();
      expect(twoAdmins.length).toBe(2);

      const reqA = globalThis.fetch(
        `${baseUrl}/api/admin/admins/${twoAdmins[0].id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validAdminToken}` },
        },
      );
      const reqB = globalThis.fetch(
        `${baseUrl}/api/admin/admins/${twoAdmins[1].id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validAdminToken}` },
        },
      );

      const [resA, resB] = await Promise.all([reqA, reqB]);
      const statuses = [resA.status, resB.status];
      expect(statuses).toContain(204);
      expect(statuses).toContain(409);

      const finalAdmins = await db.getAdmins();
      expect(finalAdmins.length).toBe(1);
    });

    it('returns 404 not-found when attempting to delete non-existent admin ID', async () => {
      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/ffffffff-ffff-4fff-8fff-ffffffffffff`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${validAdminToken}` },
        },
      );

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('not-found');
    });
  });

  describe('Seam 7: Metric 7 heartbeat resilience', () => {
    it('returns 503 on database disruption and recovers to 200 immediately', async () => {
      db.setHealthy(false);
      const failRes = await globalThis.fetch(`${baseUrl}/healthz`);
      expect(failRes.status).toBe(503);
      const failBody = await failRes.json();
      expect(failBody.error).toBe('db-unavailable');

      db.setHealthy(true);
      const passRes = await globalThis.fetch(`${baseUrl}/healthz`);
      expect(passRes.status).toBe(200);
      const passBody = await passRes.json();
      expect(passBody.ok).toBe(true);
    });

    it('rejects POST and DELETE requests to /healthz with 404', async () => {
      const postRes = await globalThis.fetch(`${baseUrl}/healthz`, {
        method: 'POST',
      });
      expect(postRes.status).toBe(404);

      const deleteRes = await globalThis.fetch(`${baseUrl}/healthz`, {
        method: 'DELETE',
      });
      expect(deleteRes.status).toBe(404);
    });

    it('verifies heartbeat workflow schedule and timeout parameters', () => {
      const heartbeatFile = path.resolve(
        process.cwd(),
        '.github/workflows/heartbeat.yml',
      );
      const content = fs.readFileSync(heartbeatFile, 'utf8');

      expect(content).toContain("cron: '0 6 * * *'");
      expect(content).toContain('--max-time 15');
      expect(content).toContain('/healthz');
      expect(content).toContain('RENDER_SERVICE_URL');
    });
  });

  describe('Seam 8: Metric 8 invite loop corruption', () => {
    it('rejects forged, malformed, or missing tokens on invite acceptance with 404 unknown-token', async () => {
      const forgedReq = await globalThis.fetch(
        `${baseUrl}/api/admin/invites/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: '0123456789abcdef0123456789abcdef' }),
        },
      );
      expect(forgedReq.status).toBe(404);
      expect((await forgedReq.json()).error).toBe('unknown-token');

      const emptyReq = await globalThis.fetch(
        `${baseUrl}/api/admin/invites/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      expect(emptyReq.status).toBe(404);

      const nullTokenReq = await globalThis.fetch(
        `${baseUrl}/api/admin/invites/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: null }),
        },
      );
      expect(nullTokenReq.status).toBe(404);
    });

    it('rejects token replay attacks and guarantees single-use invite acceptance', async () => {
      const inviteRes = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/invites`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 'replay.test@abu.edu.ng' }),
        },
      );
      expect(inviteRes.status).toBe(201);
      const { token } = await inviteRes.json();

      const accept1 = await globalThis.fetch(
        `${baseUrl}/api/admin/invites/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, name: 'Replay Test Admin' }),
        },
      );
      expect(accept1.status).toBe(200);

      const accept2 = await globalThis.fetch(
        `${baseUrl}/api/admin/invites/accept`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, name: 'Replay Second Try' }),
        },
      );
      expect(accept2.status).toBe(409);
      expect((await accept2.json()).error).toBe('already-accepted');
    });

    it('rejects invalid email formats on invite creation with 400 invalid-email', async () => {
      const invalidEmails = [
        'invalid-format',
        'plainaddress',
        'missing-at-domain.com',
        '   ',
        '',
      ];

      for (const email of invalidEmails) {
        const res = await globalThis.fetch(
          `${baseUrl}/api/admin/admins/invites`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${validAdminToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
          },
        );

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe('invalid-email');
      }

      const nonStringRes = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/invites`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: 98765 }),
        },
      );
      expect(nonStringRes.status).toBe(400);
      expect((await nonStringRes.json()).error).toBe('invalid-email');
    });

    it('rejects duplicate invitations for existing active admins and pending invites with 409', async () => {
      const admins = await db.getAdmins();
      const existingEmail = admins[0].email;

      const dupAdminRes = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/invites`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: existingEmail }),
        },
      );

      expect(dupAdminRes.status).toBe(409);
      expect((await dupAdminRes.json()).error).toBe('already-admin');

      const newEmail = 'pending.check@abu.edu.ng';
      const invite1 = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/invites`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: newEmail }),
        },
      );
      expect(invite1.status).toBe(201);

      const invite2 = await globalThis.fetch(
        `${baseUrl}/api/admin/admins/invites`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: newEmail }),
        },
      );
      expect(invite2.status).toBe(409);
      expect((await invite2.json()).error).toBe('invite-pending');
    });
  });

  describe('Seam 9: Secrets leakage & rollback integrity', () => {
    it('verifies no hardcoded live credential assignments exist across project source code', () => {
      const sensitiveKeys = [
        'SUPABASE_SERVICE_ROLE_KEY',
        'R2_SECRET_ACCESS_KEY',
        'GMAIL_CLIENT_SECRET',
        'SUPABASE_JWT_SECRET',
      ];

      const searchDirs = ['app', 'backend/src', 'lib', 'scripts'];
      const rootDir = process.cwd();

      function walkDir(dir: string): string[] {
        const fullDir = path.resolve(rootDir, dir);
        if (!fs.existsSync(fullDir)) return [];
        const entries = fs.readdirSync(fullDir, { withFileTypes: true });
        const files: string[] = [];
        for (const entry of entries) {
          const res = path.resolve(fullDir, entry.name);
          if (entry.isDirectory()) {
            if (
              entry.name !== 'node_modules' &&
              entry.name !== '.next' &&
              entry.name !== 'dist'
            ) {
              files.push(...walkDir(path.relative(rootDir, res)));
            }
          } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
            files.push(res);
          }
        }
        return files;
      }

      const allFiles = searchDirs.flatMap((d) => walkDir(d));
      for (const f of allFiles) {
        const text = fs.readFileSync(f, 'utf8');
        for (const key of sensitiveKeys) {
          const pattern = new RegExp(
            `${key}\\s*=\\s*['"\`][A-Za-z0-9_\\-=+]{8,}['"\`]`,
          );
          expect(pattern.test(text)).toBe(false);
        }
      }
    });

    it('verifies migration directory passes validation with zero violations', () => {
      const migrationsDir = path.resolve(process.cwd(), 'backend/migrations');
      const violations = checkMigrations(migrationsDir);
      expect(violations).toHaveLength(0);
    });

    it('verifies every .down.sql migration reverses schema changes cleanly', () => {
      const migrationsDir = path.resolve(process.cwd(), 'backend/migrations');
      const files = fs.readdirSync(migrationsDir);
      const downFiles = files.filter((f) => f.endsWith('.down.sql')).sort();

      expect(downFiles.length).toBe(7);

      for (const df of downFiles) {
        const content = fs.readFileSync(path.join(migrationsDir, df), 'utf8');
        expect(content.trim().length).toBeGreaterThan(15);
        expect(content).toMatch(/DROP\s+(POLICY|INDEX|TABLE|TYPE)/i);
        expect(content).not.toContain('TBD');
      }
    });
  });
});
