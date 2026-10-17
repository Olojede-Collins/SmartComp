import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {
  auditImageBuffer,
  auditAllStoredImages,
} from '../backend/src/audit-images.js';
import { importLegacyData } from '../backend/src/legacy-import.js';
import { storage } from '../backend/src/storage.js';
import { db } from '../backend/src/db.js';

describe('NFR-3 Image Audit Suite (PRD §7 Metric 3)', () => {
  beforeEach(() => {
    storage.clear();
    db.reset();
  });

  describe('1. Negative Probes & Boundary Checks (auditImageBuffer)', () => {
    it('fails dimension check when width exceeds 1200 px (1201 x 800)', async () => {
      const buffer = await sharp({
        create: {
          width: 1201,
          height: 800,
          channels: 3,
          background: { r: 100, g: 100, b: 100 },
        },
      })
        .webp()
        .toBuffer();

      const result = await auditImageBuffer(buffer, 'oversized-width.webp');

      expect(result.passed).toBe(false);
      expect(result.width).toBe(1201);
      expect(result.height).toBe(800);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(
        result.violations.some(
          (v) => v.includes('1200') || v.includes('dimension'),
        ),
      ).toBe(true);
    });

    it('fails dimension check when height exceeds 1200 px (800 x 1201)', async () => {
      const buffer = await sharp({
        create: {
          width: 800,
          height: 1201,
          channels: 3,
          background: { r: 120, g: 120, b: 120 },
        },
      })
        .webp()
        .toBuffer();

      const result = await auditImageBuffer(buffer, 'oversized-height.webp');

      expect(result.passed).toBe(false);
      expect(result.width).toBe(800);
      expect(result.height).toBe(1201);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(
        result.violations.some(
          (v) => v.includes('1200') || v.includes('dimension'),
        ),
      ).toBe(true);
    });

    it('fails format check on raw JPEG image', async () => {
      const buffer = await sharp({
        create: {
          width: 600,
          height: 400,
          channels: 3,
          background: { r: 200, g: 50, b: 50 },
        },
      })
        .jpeg()
        .toBuffer();

      const result = await auditImageBuffer(buffer, 'test.jpg');

      expect(result.passed).toBe(false);
      expect(result.format).toBe('jpeg');
      expect(
        result.violations.some(
          (v) => v.includes('format') || v.includes('jpeg'),
        ),
      ).toBe(true);
    });

    it('fails format check on raw PNG image', async () => {
      const buffer = await sharp({
        create: {
          width: 400,
          height: 400,
          channels: 3,
          background: { r: 50, g: 200, b: 50 },
        },
      })
        .png()
        .toBuffer();

      const result = await auditImageBuffer(buffer, 'test.png');

      expect(result.passed).toBe(false);
      expect(result.format).toBe('png');
      expect(
        result.violations.some(
          (v) => v.includes('format') || v.includes('png'),
        ),
      ).toBe(true);
    });

    it('fails byte budget check when size exceeds 400 KB (409,600 bytes)', async () => {
      const highFreqPattern = crypto.randomBytes(600 * 600 * 3);

      const buffer = await sharp(highFreqPattern, {
        raw: {
          width: 600,
          height: 600,
          channels: 3,
        },
      })
        .webp({ quality: 100, lossless: true })
        .toBuffer();

      expect(buffer.length).toBeGreaterThan(400 * 1024);

      const result = await auditImageBuffer(buffer, 'huge-noise.webp');

      expect(result.passed).toBe(false);
      expect(result.sizeBytes).toBe(buffer.length);
      expect(result.meetsDesktopBudget).toBe(false);
      expect(
        result.violations.some(
          (v) =>
            v.includes('400') || v.includes('budget') || v.includes('desktop'),
        ),
      ).toBe(true);
    });

    it('fails gracefully with violations on corrupted non-image buffer', async () => {
      const garbage = Buffer.from('not an image at all - plain ASCII text');
      const result = await auditImageBuffer(garbage, 'corrupt.bin');

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.sizeBytes).toBe(garbage.length);
    });

    it('fails gracefully on zero-length buffer', async () => {
      const empty = Buffer.alloc(0);
      const result = await auditImageBuffer(empty, 'empty.webp');

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.sizeBytes).toBe(0);
    });

    it('passes for valid WebP image within 1200 px and 400 KB', async () => {
      const buffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 50, g: 100, b: 150 },
        },
      })
        .webp({ quality: 80 })
        .toBuffer();

      const result = await auditImageBuffer(buffer, 'valid.webp');

      expect(result.passed).toBe(true);
      expect(result.format).toBe('webp');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
      expect(result.sizeBytes).toBeLessThanOrEqual(400 * 1024);
      expect(result.meetsDesktopBudget).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('passes for valid AVIF image within 1200 px and 400 KB', async () => {
      const buffer = await sharp({
        create: {
          width: 500,
          height: 500,
          channels: 3,
          background: { r: 70, g: 140, b: 210 },
        },
      })
        .avif({ quality: 60 })
        .toBuffer();

      const result = await auditImageBuffer(buffer, 'valid.avif');

      expect(result.passed).toBe(true);
      expect(result.format).toBe('avif');
      expect(result.width).toBe(500);
      expect(result.height).toBe(500);
      expect(result.sizeBytes).toBeLessThanOrEqual(400 * 1024);
      expect(result.meetsDesktopBudget).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('tracks mobile budget compliance flag accurately (<= 150 KB)', async () => {
      const smallBuffer = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 30, g: 60, b: 90 },
        },
      })
        .webp()
        .toBuffer();

      const smallResult = await auditImageBuffer(smallBuffer, 'small.webp');
      expect(smallResult.meetsMobileBudget).toBe(true);
      expect(smallResult.meetsDesktopBudget).toBe(true);
      expect(smallResult.passed).toBe(true);
    });
  });

  describe('2. Custom Storage Map Audit (auditAllStoredImages with map)', () => {
    it('accurately computes summary metrics for a mixed map of images', async () => {
      const validWebp = await sharp({
        create: {
          width: 600,
          height: 600,
          channels: 3,
          background: { r: 10, g: 20, b: 30 },
        },
      })
        .webp()
        .toBuffer();

      const invalidJpeg = await sharp({
        create: {
          width: 600,
          height: 600,
          channels: 3,
          background: { r: 10, g: 20, b: 30 },
        },
      })
        .jpeg()
        .toBuffer();

      const map = new Map<string, { data: Buffer }>();
      map.set('img1.webp', { data: validWebp });
      map.set('img2.jpg', { data: invalidJpeg });

      const summary = await auditAllStoredImages(map);

      expect(summary.total).toBe(2);
      expect(summary.passed).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.complianceRate).toBe(0.5);
      expect(summary.results).toHaveLength(2);
    });

    it('returns complianceRate 1.0 for empty map', async () => {
      const emptyMap = new Map<string, { data: Buffer }>();
      const summary = await auditAllStoredImages(emptyMap);

      expect(summary.total).toBe(0);
      expect(summary.passed).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.complianceRate).toBe(1.0);
      expect(summary.results).toEqual([]);
    });
  });

  describe('3. Stored Legacy Images 100% Compliance Gate (PRD §7 Metric 3, NFR-3)', () => {
    it('audits 100% of stored equipment images asserting complianceRate === 1.0', async () => {
      await importLegacyData();

      const summary = await auditAllStoredImages();

      expect(summary.total).toBe(8);
      expect(summary.passed).toBe(8);
      expect(summary.failed).toBe(0);
      expect(summary.complianceRate).toBe(1.0);

      for (const res of summary.results) {
        expect(res.passed, `${res.key} passed`).toBe(true);
        expect(res.violations, `${res.key} violations`).toEqual([]);
        expect(res.format, `${res.key} format`).toBe('webp');
        expect(res.width, `${res.key} width`).toBeLessThanOrEqual(1200);
        expect(res.height, `${res.key} height`).toBeLessThanOrEqual(1200);
        expect(res.sizeBytes, `${res.key} byte size`).toBeLessThanOrEqual(
          400 * 1024,
        );
        expect(res.meetsDesktopBudget, `${res.key} desktop budget`).toBe(true);
      }
    }, 30000);

    it('auto-populates from legacy data if storage is initially empty', async () => {
      const summary = await auditAllStoredImages();

      expect(summary.total).toBe(8);
      expect(summary.complianceRate).toBe(1.0);
      expect(summary.passed).toBe(8);
      expect(summary.failed).toBe(0);
    }, 30000);
  });
});
