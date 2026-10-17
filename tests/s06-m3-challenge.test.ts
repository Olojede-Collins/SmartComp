import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { app } from '../backend/src/server.js';
import { db } from '../backend/src/db.js';
import { storage } from '../backend/src/storage.js';
import { createToken } from '../backend/src/auth.js';
import { setRevalidateListener } from '../backend/src/revalidate.js';
import {
  auditImageBuffer,
  auditAllStoredImages,
} from '../backend/src/audit-images.js';
import {
  withImageLock,
  processImage,
  getImageLockState,
} from '../backend/src/image-pipeline.js';
import { importLegacyData } from '../backend/src/legacy-import.js';

describe('S-06 M3 Adversarial Challenger Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const validAdminToken = createToken({
    sub: 'admin-s06-m3-id',
    email: 'admin.m3@smartcomp.abu.edu.ng',
    app_metadata: { role: 'admin' },
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const nonAdminToken = createToken({
    sub: 'user-s06-m3-id',
    email: 'viewer.m3@smartcomp.abu.edu.ng',
    app_metadata: { role: 'authenticated' },
    exp: Math.floor(Date.now() / 1000) + 3600,
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
    storage.clear();
    delete process.env.SIMULATE_R2_FAILURE;
  });

  describe('Seam 1: NFR-3 Boundary & Tolerance Probing', () => {
    it('Attack 1: passes width boundary at 1200x800 and fails at 1201x800', async () => {
      const passBuffer = await sharp({
        create: {
          width: 1200,
          height: 800,
          channels: 3,
          background: { r: 60, g: 80, b: 100 },
        },
      })
        .webp()
        .toBuffer();

      const failBuffer = await sharp({
        create: {
          width: 1201,
          height: 800,
          channels: 3,
          background: { r: 60, g: 80, b: 100 },
        },
      })
        .webp()
        .toBuffer();

      const passResult = await auditImageBuffer(
        passBuffer,
        'boundary-1200w.webp',
      );
      expect(passResult.passed).toBe(true);
      expect(passResult.width).toBe(1200);
      expect(passResult.height).toBe(800);
      expect(passResult.violations).toEqual([]);

      const failResult = await auditImageBuffer(
        failBuffer,
        'boundary-1201w.webp',
      );
      expect(failResult.passed).toBe(false);
      expect(failResult.width).toBe(1201);
      expect(failResult.height).toBe(800);
      expect(
        failResult.violations.some(
          (v) => v.includes('1200 pixel limit') && v.includes('1201x800'),
        ),
      ).toBe(true);
    });

    it('Attack 2: passes height boundary at 800x1200 and fails at 800x1201', async () => {
      const passBuffer = await sharp({
        create: {
          width: 800,
          height: 1200,
          channels: 3,
          background: { r: 70, g: 90, b: 110 },
        },
      })
        .webp()
        .toBuffer();

      const failBuffer = await sharp({
        create: {
          width: 800,
          height: 1201,
          channels: 3,
          background: { r: 70, g: 90, b: 110 },
        },
      })
        .webp()
        .toBuffer();

      const passResult = await auditImageBuffer(
        passBuffer,
        'boundary-1200h.webp',
      );
      expect(passResult.passed).toBe(true);
      expect(passResult.width).toBe(800);
      expect(passResult.height).toBe(1200);
      expect(passResult.violations).toEqual([]);

      const failResult = await auditImageBuffer(
        failBuffer,
        'boundary-1201h.webp',
      );
      expect(failResult.passed).toBe(false);
      expect(failResult.width).toBe(800);
      expect(failResult.height).toBe(1201);
      expect(
        failResult.violations.some(
          (v) => v.includes('1200 pixel limit') && v.includes('800x1201'),
        ),
      ).toBe(true);
    });

    it('Attack 3: passes square boundary at 1200x1200 and fails at 1201x1201', async () => {
      const passBuffer = await sharp({
        create: {
          width: 1200,
          height: 1200,
          channels: 3,
          background: { r: 80, g: 100, b: 120 },
        },
      })
        .webp()
        .toBuffer();

      const failBuffer = await sharp({
        create: {
          width: 1201,
          height: 1201,
          channels: 3,
          background: { r: 80, g: 100, b: 120 },
        },
      })
        .webp()
        .toBuffer();

      const passResult = await auditImageBuffer(
        passBuffer,
        'boundary-1200sq.webp',
      );
      expect(passResult.passed).toBe(true);
      expect(passResult.width).toBe(1200);
      expect(passResult.height).toBe(1200);

      const failResult = await auditImageBuffer(
        failBuffer,
        'boundary-1201sq.webp',
      );
      expect(failResult.passed).toBe(false);
      expect(failResult.width).toBe(1201);
      expect(failResult.height).toBe(1201);
      expect(failResult.violations.length).toBeGreaterThan(0);
    });

    it('Attack 4: enforces boundary on extreme panoramic and tall aspect ratios', async () => {
      const panoPass = await sharp({
        create: {
          width: 1200,
          height: 10,
          channels: 3,
          background: { r: 40, g: 50, b: 60 },
        },
      })
        .webp()
        .toBuffer();

      const panoFail = await sharp({
        create: {
          width: 1201,
          height: 10,
          channels: 3,
          background: { r: 40, g: 50, b: 60 },
        },
      })
        .webp()
        .toBuffer();

      const tallPass = await sharp({
        create: {
          width: 10,
          height: 1200,
          channels: 3,
          background: { r: 40, g: 50, b: 60 },
        },
      })
        .webp()
        .toBuffer();

      const tallFail = await sharp({
        create: {
          width: 10,
          height: 1201,
          channels: 3,
          background: { r: 40, g: 50, b: 60 },
        },
      })
        .webp()
        .toBuffer();

      expect((await auditImageBuffer(panoPass)).passed).toBe(true);
      expect((await auditImageBuffer(panoFail)).passed).toBe(false);
      expect((await auditImageBuffer(tallPass)).passed).toBe(true);
      expect((await auditImageBuffer(tallFail)).passed).toBe(false);
    });

    it('Attack 5: probes exact 400 KB desktop boundary (409,600 bytes vs 409,601 bytes)', async () => {
      const baseWebp = await sharp({
        create: {
          width: 150,
          height: 150,
          channels: 3,
          background: { r: 50, g: 75, b: 100 },
        },
      })
        .webp()
        .toBuffer();

      const exact400Kb = Buffer.concat([
        baseWebp,
        Buffer.alloc(400 * 1024 - baseWebp.length),
      ]);
      const over400Kb = Buffer.concat([
        baseWebp,
        Buffer.alloc(400 * 1024 + 1 - baseWebp.length),
      ]);

      const resExact = await auditImageBuffer(exact400Kb, 'exact-400kb.webp');
      expect(resExact.sizeBytes).toBe(409600);
      expect(resExact.meetsDesktopBudget).toBe(true);
      expect(resExact.passed).toBe(true);
      expect(resExact.violations).toEqual([]);

      const resOver = await auditImageBuffer(over400Kb, 'over-400kb.webp');
      expect(resOver.sizeBytes).toBe(409601);
      expect(resOver.meetsDesktopBudget).toBe(false);
      expect(resOver.passed).toBe(false);
      expect(
        resOver.violations.some((v) =>
          v.includes('Size exceeds 400 KB desktop budget: 409601 bytes.'),
        ),
      ).toBe(true);
    });

    it('Attack 6: probes exact 150 KB mobile boundary (153,600 bytes vs 153,601 bytes)', async () => {
      const baseWebp = await sharp({
        create: {
          width: 150,
          height: 150,
          channels: 3,
          background: { r: 90, g: 110, b: 130 },
        },
      })
        .webp()
        .toBuffer();

      const exact150Kb = Buffer.concat([
        baseWebp,
        Buffer.alloc(150 * 1024 - baseWebp.length),
      ]);
      const over150Kb = Buffer.concat([
        baseWebp,
        Buffer.alloc(150 * 1024 + 1 - baseWebp.length),
      ]);

      const resExact = await auditImageBuffer(exact150Kb, 'exact-150kb.webp');
      expect(resExact.sizeBytes).toBe(153600);
      expect(resExact.meetsMobileBudget).toBe(true);
      expect(resExact.meetsDesktopBudget).toBe(true);
      expect(resExact.passed).toBe(true);

      const resOver = await auditImageBuffer(over150Kb, 'over-150kb.webp');
      expect(resOver.sizeBytes).toBe(153601);
      expect(resOver.meetsMobileBudget).toBe(false);
      expect(resOver.meetsDesktopBudget).toBe(true);
      expect(resOver.passed).toBe(true);
    });

    it('Attack 7: zero-byte and single-byte buffers fail audit gracefully with recorded violations', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const resEmpty = await auditImageBuffer(emptyBuffer, 'zero.webp');
      expect(resEmpty.passed).toBe(false);
      expect(resEmpty.sizeBytes).toBe(0);
      expect(resEmpty.format).toBe('unknown');
      expect(resEmpty.violations.length).toBeGreaterThan(0);

      const oneByteBuffer = Buffer.from([0x00]);
      const resOneByte = await auditImageBuffer(oneByteBuffer, 'one-byte.webp');
      expect(resOneByte.passed).toBe(false);
      expect(resOneByte.sizeBytes).toBe(1);
      expect(resOneByte.format).toBe('unknown');
      expect(resOneByte.violations.length).toBeGreaterThan(0);
    });

    it('Attack 8: passes minimal 1x1 valid WebP and AVIF images', async () => {
      const minimalWebp = await sharp({
        create: {
          width: 1,
          height: 1,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .webp()
        .toBuffer();

      const resWebp = await auditImageBuffer(minimalWebp, 'minimal.webp');
      expect(resWebp.passed).toBe(true);
      expect(resWebp.width).toBe(1);
      expect(resWebp.height).toBe(1);
      expect(resWebp.format).toBe('webp');
      expect(resWebp.meetsMobileBudget).toBe(true);
      expect(resWebp.meetsDesktopBudget).toBe(true);

      const minimalAvif = await sharp({
        create: {
          width: 1,
          height: 1,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .avif()
        .toBuffer();

      const resAvif = await auditImageBuffer(minimalAvif, 'minimal.avif');
      expect(resAvif.passed).toBe(true);
      expect(resAvif.width).toBe(1);
      expect(resAvif.height).toBe(1);
      expect(resAvif.format).toBe('avif');
      expect(resAvif.meetsMobileBudget).toBe(true);
      expect(resAvif.meetsDesktopBudget).toBe(true);
    });
  });

  describe('Seam 2: Format Spoofing & Container Anomalies', () => {
    it('Attack 9: rejects GIF buffer disguised with .webp extension', async () => {
      const gifBuffer = await sharp({
        create: {
          width: 20,
          height: 20,
          channels: 3,
          background: { r: 200, g: 50, b: 50 },
        },
      })
        .gif()
        .toBuffer();

      const res = await auditImageBuffer(gifBuffer, 'disguised.webp');
      expect(res.passed).toBe(false);
      expect(res.format).toBe('gif');
      expect(
        res.violations.some((v) => v.includes('Invalid format: gif')),
      ).toBe(true);
    });

    it('Attack 10: rejects BMP buffer disguised with .webp extension', async () => {
      const bmpBuffer = Buffer.from(
        '424d36000000000000003600000028000000010000000100000001001800000000000400000000000000000000000000000000000000ff000000',
        'hex',
      );

      const res = await auditImageBuffer(bmpBuffer, 'disguised-bmp.webp');
      expect(res.passed).toBe(false);
      expect(res.violations.length).toBeGreaterThan(0);
    });

    it('Attack 11: rejects TIFF buffer disguised with .webp extension', async () => {
      const tiffBuffer = await sharp({
        create: {
          width: 20,
          height: 20,
          channels: 3,
          background: { r: 50, g: 200, b: 50 },
        },
      })
        .tiff()
        .toBuffer();

      const res = await auditImageBuffer(tiffBuffer, 'disguised-tiff.webp');
      expect(res.passed).toBe(false);
      expect(res.format).toBe('tiff');
      expect(
        res.violations.some((v) => v.includes('Invalid format: tiff')),
      ).toBe(true);
    });

    it('Attack 12: rejects SVG markup disguised with .webp extension', async () => {
      const svgBuffer = Buffer.from(
        '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="red"/></svg>',
      );

      const res = await auditImageBuffer(svgBuffer, 'disguised-svg.webp');
      expect(res.passed).toBe(false);
      expect(res.format).toBe('svg');
      expect(
        res.violations.some((v) => v.includes('Invalid format: svg')),
      ).toBe(true);
    });

    it('Attack 13: rejects HTML / JavaScript script polyglot disguised as image', async () => {
      const polyglotBuffer = Buffer.from(
        '<!DOCTYPE html><html><head><script>alert("xss")</script></head><body><h1>Exploit</h1></body></html>',
      );

      const res = await auditImageBuffer(polyglotBuffer, 'payload.webp');
      expect(res.passed).toBe(false);
      expect(res.format).toBe('unknown');
      expect(
        res.violations.some((v) =>
          v.includes('Corrupt or unsupported image buffer'),
        ),
      ).toBe(true);
    });

    it('Attack 14: rejects truncated RIFF header without unhandled rejection', async () => {
      const truncatedRiff = Buffer.from('RIFF\x20\x00\x00\x00WEBP');

      const res = await auditImageBuffer(truncatedRiff, 'truncated.webp');
      expect(res.passed).toBe(false);
      expect(res.format).toBe('unknown');
      expect(
        res.violations.some((v) =>
          v.includes('Corrupt or unsupported image buffer'),
        ),
      ).toBe(true);
    });

    it('Attack 15: rejects MP4 video / ISOM ftyp container disguised as AVIF', async () => {
      const mp4Ftyp = Buffer.from(
        '00000018667479706d7034320000000069736f6d6d703432',
        'hex',
      );

      const res = await auditImageBuffer(mp4Ftyp, 'spoofed-video.avif');
      expect(res.passed).toBe(false);
      expect(res.violations.length).toBeGreaterThan(0);
    });

    it('Attack 16: rejects corrupt RIFF header with random junk payload', async () => {
      const corruptRiff = Buffer.concat([
        Buffer.from('RIFF\xff\xff\x00\x00WEBPVP8 '),
        crypto.randomBytes(64),
      ]);

      const res = await auditImageBuffer(corruptRiff, 'corrupted-riff.webp');
      expect(res.passed).toBe(false);
      expect(res.violations.length).toBeGreaterThan(0);
    });

    it('Attack 17: rejects PDF document payload disguised with .webp extension', async () => {
      const pdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
      );

      const res = await auditImageBuffer(pdfBuffer, 'document.webp');
      expect(res.passed).toBe(false);
      expect(res.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Seam 3: Audit Engine Resilience', () => {
    it('Attack 18: returns total 0 and complianceRate 1.0 for empty custom storage map', async () => {
      const emptyMap = new Map<string, { data: Buffer }>();
      const summary = await auditAllStoredImages(emptyMap);

      expect(summary.total).toBe(0);
      expect(summary.passed).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.complianceRate).toBe(1.0);
      expect(summary.results).toEqual([]);
    });

    it('Attack 19: audits storage items directly when database is empty', async () => {
      db.reset({ equipment: [] });

      const sampleWebp = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 10, g: 30, b: 50 },
        },
      })
        .webp()
        .toBuffer();

      await storage.putObject('equip-item-001.webp', sampleWebp, 'image/webp');
      await storage.putObject('equip-item-002.webp', sampleWebp, 'image/webp');

      const summary = await auditAllStoredImages();
      expect(summary.total).toBe(2);
      expect(summary.passed).toBe(2);
      expect(summary.failed).toBe(0);
      expect(summary.complianceRate).toBe(1.0);
    });

    it('Attack 20: handles equipment items with empty image_keys arrays without crashing', async () => {
      const validWebp = await sharp({
        create: {
          width: 300,
          height: 300,
          channels: 3,
          background: { r: 50, g: 50, b: 50 },
        },
      })
        .webp()
        .toBuffer();

      await storage.putObject('valid-single.webp', validWebp, 'image/webp');

      db.reset({
        equipment: [
          {
            id: 'item-no-images-1',
            name: 'Oscilloscope No Img',
            core_functionality: null,
            other_functionality: null,
            condition: 'Working',
            quantity: 1,
            image_keys: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            updated_by: null,
          },
          {
            id: 'item-no-images-2',
            name: 'Multimeter No Img',
            core_functionality: null,
            other_functionality: null,
            condition: 'Working',
            quantity: 2,
            image_keys: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            updated_by: null,
          },
        ],
      });

      const summary = await auditAllStoredImages();
      expect(summary.total).toBe(1);
      expect(summary.passed).toBe(1);
      expect(summary.complianceRate).toBe(1.0);
    });

    it('Attack 21: handles missing storage keys referenced in equipment records gracefully', async () => {
      const validWebp = await sharp({
        create: {
          width: 300,
          height: 300,
          channels: 3,
          background: { r: 80, g: 40, b: 20 },
        },
      })
        .webp()
        .toBuffer();

      await storage.putObject('existing-key.webp', validWebp, 'image/webp');

      db.reset({
        equipment: [
          {
            id: 'item-with-ghost-key',
            name: 'Equipment Ghost Key',
            core_functionality: null,
            other_functionality: null,
            condition: 'Working',
            quantity: 1,
            image_keys: ['missing-key-404.webp'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            updated_by: null,
          },
        ],
      });

      const summary = await auditAllStoredImages();
      expect(summary.total).toBe(1);
      expect(summary.passed).toBe(1);
      expect(summary.complianceRate).toBe(1.0);
    });

    it('Attack 22: accurately calculates compliance rate for mixed valid and corrupt storage buffers', async () => {
      const validWebp = await sharp({
        create: {
          width: 400,
          height: 400,
          channels: 3,
          background: { r: 10, g: 100, b: 200 },
        },
      })
        .webp()
        .toBuffer();

      const corruptBuf = Buffer.from('not an image - corrupt stream');

      const map = new Map<string, { data: Buffer }>();
      map.set('img1.webp', { data: validWebp });
      map.set('img2.webp', { data: validWebp });
      map.set('img3.webp', { data: corruptBuf });
      map.set('img4.webp', { data: corruptBuf });

      const summary = await auditAllStoredImages(map);
      expect(summary.total).toBe(4);
      expect(summary.passed).toBe(2);
      expect(summary.failed).toBe(2);
      expect(summary.complianceRate).toBe(0.5);
    });

    it('Attack 23: executes 20 concurrent audit calls without race conditions or state mutation', async () => {
      await importLegacyData();

      const runs = await Promise.all(
        Array.from({ length: 20 }, () => auditAllStoredImages()),
      );

      expect(runs.length).toBe(20);
      const baselineTotal = runs[0].total;
      const baselineRate = runs[0].complianceRate;

      for (const res of runs) {
        expect(res.total).toBe(baselineTotal);
        expect(res.passed).toBe(baselineTotal);
        expect(res.failed).toBe(0);
        expect(res.complianceRate).toBe(baselineRate);
      }
    }, 30000);

    it('Attack 24: processes storage map keys with unicode, spaces, and extreme lengths cleanly', async () => {
      const sample = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 12, g: 34, b: 56 },
        },
      })
        .webp()
        .toBuffer();

      const map = new Map<string, { data: Buffer }>();
      map.set('equip-ñ-specimen-✨.webp', { data: sample });
      map.set('deep/nested/path/specimen key with spaces.webp', {
        data: sample,
      });
      map.set(`${'a'.repeat(250)}.webp`, { data: sample });

      const summary = await auditAllStoredImages(map);
      expect(summary.total).toBe(3);
      expect(summary.passed).toBe(3);
      expect(summary.failed).toBe(0);
      expect(summary.complianceRate).toBe(1.0);
    });
  });

  describe('Seam 4: Memory / RSS Stress Testing', () => {
    it('Attack 25: verifies sharp configuration defense (concurrency 1 and cache disabled)', () => {
      expect(sharp.concurrency()).toBe(1);

      const cache = sharp.cache();
      expect(cache.memory.max).toBe(0);
      expect(cache.items.max).toBe(0);
      expect(cache.files.max).toBe(0);

      sharp.concurrency(4);
      sharp.cache(true);
      expect(sharp.concurrency()).toBe(4);

      sharp.concurrency(1);
      sharp.cache(false);
      expect(sharp.concurrency()).toBe(1);
      const resetCache = sharp.cache();
      expect(resetCache.memory.max).toBe(0);
    });

    it('Attack 26: maintains strict single-active mutex serialisation under 15 concurrent processing tasks', async () => {
      const sampleJpeg = await sharp({
        create: {
          width: 1600,
          height: 1200,
          channels: 3,
          background: { r: 120, g: 140, b: 160 },
        },
      })
        .jpeg({ quality: 80 })
        .toBuffer();

      let maxSimultaneousActive = 0;
      let activeNow = 0;

      const tasks = Array.from({ length: 15 }, () =>
        withImageLock(async () => {
          activeNow += 1;
          maxSimultaneousActive = Math.max(maxSimultaneousActive, activeNow);
          const out = await processImage(sampleJpeg);
          activeNow -= 1;
          return out;
        }),
      );

      const outputs = await Promise.all(tasks);

      expect(outputs.length).toBe(15);
      expect(maxSimultaneousActive).toBe(1);
      expect(getImageLockState().activeCount).toBe(0);

      for (const buf of outputs) {
        expect(buf.length).toBeLessThanOrEqual(400 * 1024);
      }
    }, 30000);

    it('Attack 27: keeps peak RSS well below 512 MB ceiling during 15 concurrent processing tasks', async () => {
      const sampleBuffer = await sharp({
        create: {
          width: 1800,
          height: 1200,
          channels: 3,
          background: { r: 150, g: 120, b: 90 },
        },
      })
        .jpeg({ quality: 80 })
        .toBuffer();

      const tasks = Array.from({ length: 15 }, () =>
        withImageLock(() => processImage(sampleBuffer)),
      );

      await Promise.all(tasks);

      const rssMb = process.memoryUsage().rss / (1024 * 1024);
      expect(rssMb).toBeLessThan(512);
      expect(rssMb).toBeLessThan(400);
    }, 30000);

    it('Attack 28: verifies memory boundedness across 10 sequential 2000x2000 image transforms', async () => {
      const inputBuffer = await sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 3,
          background: { r: 75, g: 125, b: 175 },
        },
      })
        .jpeg({ quality: 85 })
        .toBuffer();

      let peakRss = 0;

      for (let i = 0; i < 10; i++) {
        const out = await processImage(inputBuffer);
        expect(out.length).toBeLessThanOrEqual(400 * 1024);

        const currentRssMb = process.memoryUsage().rss / (1024 * 1024);
        if (currentRssMb > peakRss) {
          peakRss = currentRssMb;
        }
      }

      expect(peakRss).toBeLessThan(512);
    }, 30000);

    it('Attack 29: processes near-limit 7.5 MB raw payload safely under lock without OOM', async () => {
      const highFreqNoise = crypto.randomBytes(1800 * 1400 * 3);
      const largeJpeg = await sharp(highFreqNoise, {
        raw: {
          width: 1800,
          height: 1400,
          channels: 3,
        },
      })
        .jpeg({ quality: 95 })
        .toBuffer();

      expect(largeJpeg.length).toBeGreaterThan(1 * 1024 * 1024);
      expect(largeJpeg.length).toBeLessThan(8 * 1024 * 1024);

      const processed = await withImageLock(() => processImage(largeJpeg));
      expect(processed.length).toBeLessThanOrEqual(400 * 1024);

      const meta = await sharp(processed).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBeLessThanOrEqual(1200);
      expect(meta.height).toBeLessThanOrEqual(1200);

      const rssMb = process.memoryUsage().rss / (1024 * 1024);
      expect(rssMb).toBeLessThan(512);
    }, 30000);
  });

  describe('Seam 5: Hardening & Regression Testing', () => {
    it('Attack 30: verifies full lifecycle (legacy import -> initial audit -> runtime upload -> re-audit)', async () => {
      await importLegacyData();

      const items = await db.getEquipment();
      expect(items.length).toBe(7);

      const initialAudit = await auditAllStoredImages();
      expect(initialAudit.total).toBe(8);
      expect(initialAudit.complianceRate).toBe(1.0);
      expect(initialAudit.failed).toBe(0);

      const targetItem = items[0];
      const initialKeyCount = targetItem.image_keys.length;

      const newUploadBuffer = await sharp({
        create: {
          width: 1600,
          height: 1200,
          channels: 3,
          background: { r: 180, g: 190, b: 200 },
        },
      })
        .jpeg({ quality: 85 })
        .toBuffer();

      const uploadRes = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${targetItem.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/jpeg',
          },
          body: newUploadBuffer,
        },
      );

      expect(uploadRes.status).toBe(201);
      const uploadData = (await uploadRes.json()) as { image_keys: string[] };
      expect(uploadData.image_keys.length).toBe(initialKeyCount + 1);

      const auditAfterUpload = await auditAllStoredImages();
      expect(auditAfterUpload.total).toBe(9);
      expect(auditAfterUpload.complianceRate).toBe(1.0);
      expect(auditAfterUpload.failed).toBe(0);
    }, 30000);

    it('Attack 31: verifies image deletion updates storage, DB, and preserves 100% audit compliance', async () => {
      await importLegacyData();
      const items = await db.getEquipment();
      const targetItem = items[0];

      const newUploadBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 110, g: 120, b: 130 },
        },
      })
        .jpeg()
        .toBuffer();

      const uploadRes = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${targetItem.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/jpeg',
          },
          body: newUploadBuffer,
        },
      );

      expect(uploadRes.status).toBe(201);
      const uploadData = (await uploadRes.json()) as { image_keys: string[] };
      const uploadedKey =
        uploadData.image_keys[uploadData.image_keys.length - 1];

      const delRes = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${targetItem.id}/images/${encodeURIComponent(uploadedKey)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
          },
        },
      );

      expect(delRes.status).toBe(204);

      const auditAfterDelete = await auditAllStoredImages();
      expect(auditAfterDelete.total).toBe(8);
      expect(auditAfterDelete.complianceRate).toBe(1.0);
      expect(auditAfterDelete.failed).toBe(0);
    }, 30000);

    it('Attack 32: executes adversarial M1 attacks concurrently with active audit without interference', async () => {
      await importLegacyData();
      const items = await db.getEquipment();
      const targetItem = items[0];

      const oversizedPayload = Buffer.alloc(8 * 1024 * 1024 + 10);
      oversizedPayload[0] = 0xff;
      oversizedPayload[1] = 0xd8;
      oversizedPayload[2] = 0xff;

      const badMimePayload = Buffer.from('plain text file not an image');

      const auditPromise = auditAllStoredImages();

      const attackOversized = globalThis.fetch(
        `${baseUrl}/api/admin/items/${targetItem.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/jpeg',
          },
          body: oversizedPayload,
        },
      );

      const attackBadMime = globalThis.fetch(
        `${baseUrl}/api/admin/items/${targetItem.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'text/plain',
          },
          body: badMimePayload,
        },
      );

      const attackUnauth = globalThis.fetch(
        `${baseUrl}/api/admin/items/${targetItem.id}/images`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'image/jpeg',
          },
          body: Buffer.from([0xff, 0xd8, 0xff]),
        },
      );

      const attackNonAdmin = globalThis.fetch(
        `${baseUrl}/api/admin/items/${targetItem.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${nonAdminToken}`,
            'Content-Type': 'image/jpeg',
          },
          body: Buffer.from([0xff, 0xd8, 0xff]),
        },
      );

      const attackNonexistent = globalThis.fetch(
        `${baseUrl}/api/admin/items/nonexistent-item-999/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/jpeg',
          },
          body: Buffer.from([0xff, 0xd8, 0xff]),
        },
      );

      const [resAudit, resOver, resMime, resUnauth, resNonAdmin, resNotFound] =
        await Promise.all([
          auditPromise,
          attackOversized,
          attackBadMime,
          attackUnauth,
          attackNonAdmin,
          attackNonexistent,
        ]);

      expect(resAudit.total).toBe(8);
      expect(resAudit.complianceRate).toBe(1.0);

      expect(resOver.status).toBe(413);
      const dataOver = (await resOver.json()) as { error: string };
      expect(dataOver.error).toBe('image-too-large');

      expect(resMime.status).toBe(415);
      const dataMime = (await resMime.json()) as { error: string };
      expect(dataMime.error).toBe('mime-rejected');

      expect(resUnauth.status).toBe(401);
      expect(resNonAdmin.status).toBe(403);
      expect(resNotFound.status).toBe(404);
    }, 30000);

    it('Attack 33: simulated storage failure (502) does not corrupt DB or audit compliance', async () => {
      await importLegacyData();
      const items = await db.getEquipment();
      const targetItem = items[0];
      const initialKeyCount = targetItem.image_keys.length;

      const validJpeg = await sharp({
        create: {
          width: 400,
          height: 300,
          channels: 3,
          background: { r: 50, g: 60, b: 70 },
        },
      })
        .jpeg()
        .toBuffer();

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${targetItem.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/jpeg',
            'x-simulate-r2-failure': 'true',
          },
          body: validJpeg,
        },
      );

      expect(res.status).toBe(502);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('r2-write-failed');

      const reloadedItem = await db.getEquipmentById(targetItem.id);
      expect(reloadedItem?.image_keys.length).toBe(initialKeyCount);

      const auditSummary = await auditAllStoredImages();
      expect(auditSummary.total).toBe(8);
      expect(auditSummary.complianceRate).toBe(1.0);
    }, 30000);

    it('Attack 34: overall process memory consumption remains verified well below 512 MB ceiling', () => {
      const currentRssMb = process.memoryUsage().rss / (1024 * 1024);
      expect(currentRssMb).toBeLessThan(512);
      expect(currentRssMb).toBeLessThan(450);
    });
  });
});
