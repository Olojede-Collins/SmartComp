import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import sharp from 'sharp';
import { app } from '../backend/src/server.js';
import { db } from '../backend/src/db.js';
import { createToken } from '../backend/src/auth.js';
import { setRevalidateListener } from '../backend/src/revalidate.js';
import { MAX_IMAGE_BYTES } from '../backend/src/routes/items.js';
import {
  isAllowedImage,
  sniffMimeType,
  withImageLock,
  processImage,
  getImageLockState,
} from '../backend/src/image-pipeline.js';
import { storage, StorageClient } from '../backend/src/storage.js';

describe('Image Pipeline & Upload Test Suite (S-06 M1)', () => {
  let server: http.Server;
  let baseUrl: string;

  const validAdminToken = createToken({
    sub: 'admin-upload-test-id',
    email: 'admin.upload@smartcomp.abu.edu.ng',
    app_metadata: { role: 'admin' },
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

  describe('1. Magic-Byte MIME Sniffer (isAllowedImage & sniffMimeType)', () => {
    it('detects JPEG headers', () => {
      const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(isAllowedImage(jpegBuf)).toBe(true);
      expect(sniffMimeType(jpegBuf)).toBe('image/jpeg');
    });

    it('detects PNG headers', () => {
      const pngBuf = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
      ]);
      expect(isAllowedImage(pngBuf)).toBe(true);
      expect(sniffMimeType(pngBuf)).toBe('image/png');
    });

    it('detects WebP headers', () => {
      const webpBuf = Buffer.concat([
        Buffer.from('RIFF', 'ascii'),
        Buffer.alloc(4),
        Buffer.from('WEBP', 'ascii'),
        Buffer.from('VP8 ', 'ascii'),
      ]);
      expect(isAllowedImage(webpBuf)).toBe(true);
      expect(sniffMimeType(webpBuf)).toBe('image/webp');
    });

    it('detects AVIF headers with ftyp brand', () => {
      const avifBuf = Buffer.concat([
        Buffer.alloc(4),
        Buffer.from('ftypavif', 'ascii'),
        Buffer.alloc(4),
      ]);
      expect(isAllowedImage(avifBuf)).toBe(true);
      expect(sniffMimeType(avifBuf)).toBe('image/avif');

      const avisBuf = Buffer.concat([
        Buffer.alloc(4),
        Buffer.from('ftypavis', 'ascii'),
        Buffer.alloc(4),
      ]);
      expect(isAllowedImage(avisBuf)).toBe(true);
      expect(sniffMimeType(avisBuf)).toBe('image/avif');

      const mif1Buf = Buffer.concat([
        Buffer.alloc(4),
        Buffer.from('ftypmif1', 'ascii'),
        Buffer.alloc(4),
      ]);
      expect(isAllowedImage(mif1Buf)).toBe(true);
      expect(sniffMimeType(mif1Buf)).toBe('image/avif');
    });

    it('rejects invalid or disguised file headers', () => {
      const pdfBuf = Buffer.from('%PDF-1.5 test document header');
      expect(isAllowedImage(pdfBuf)).toBe(false);
      expect(sniffMimeType(pdfBuf)).toBeNull();

      const textBuf = Buffer.from('Hello world this is plain text');
      expect(isAllowedImage(textBuf)).toBe(false);
      expect(sniffMimeType(textBuf)).toBeNull();

      const shortBuf = Buffer.from([0xff, 0xd8]);
      expect(isAllowedImage(shortBuf)).toBe(false);
      expect(sniffMimeType(shortBuf)).toBeNull();

      const emptyBuf = Buffer.alloc(0);
      expect(isAllowedImage(emptyBuf)).toBe(false);
      expect(sniffMimeType(emptyBuf)).toBeNull();
    });
  });

  describe('2. Async Mutex Lock (withImageLock & getImageLockState)', () => {
    it('serializes concurrent tasks to strictly 1 active execution at a time', async () => {
      let currentActive = 0;
      let maxActiveObserved = 0;
      const executionOrder: number[] = [];

      const runTask = (id: number, delayMs: number) =>
        withImageLock(async () => {
          currentActive += 1;
          if (currentActive > maxActiveObserved) {
            maxActiveObserved = currentActive;
          }
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          executionOrder.push(id);
          currentActive -= 1;
          return id;
        });

      const promises = [runTask(1, 40), runTask(2, 20), runTask(3, 10)];

      const results = await Promise.all(promises);

      expect(results).toEqual([1, 2, 3]);
      expect(executionOrder).toEqual([1, 2, 3]);
      expect(maxActiveObserved).toBe(1);
      expect(getImageLockState().active).toBe(false);
      expect(getImageLockState().activeCount).toBe(0);
    });

    it('releases lock when task throws error without blocking subsequent tasks', async () => {
      await expect(
        withImageLock(async () => {
          throw new Error('Lock failure simulation');
        }),
      ).rejects.toThrow('Lock failure simulation');

      expect(getImageLockState().active).toBe(false);

      const nextResult = await withImageLock(async () => 'recovered');
      expect(nextResult).toBe('recovered');
    });
  });

  describe('3. Sharp Image Processing (processImage)', () => {
    it('resizes image to longest edge <= 1200 px and transcodes to valid WebP', async () => {
      const inputPng = await sharp({
        create: {
          width: 1600,
          height: 1200,
          channels: 3,
          background: { r: 50, g: 100, b: 150 },
        },
      })
        .png()
        .toBuffer();

      const outputWebp = await processImage(inputPng);

      expect(outputWebp.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(outputWebp.subarray(8, 12).toString('ascii')).toBe('WEBP');
      expect(outputWebp.length).toBeLessThanOrEqual(400 * 1024);

      const meta = await sharp(outputWebp).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(1200);
      expect(meta.height).toBe(900);
      expect(meta.orientation).toBeUndefined();
    });

    it('does not enlarge images smaller than 1200 px', async () => {
      const inputPng = await sharp({
        create: {
          width: 640,
          height: 480,
          channels: 3,
          background: { r: 200, g: 150, b: 100 },
        },
      })
        .png()
        .toBuffer();

      const outputWebp = await processImage(inputPng);
      const meta = await sharp(outputWebp).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(640);
      expect(meta.height).toBe(480);
    });

    it('falls back to 1x1 WebP for synthetic truncated buffer in test mode', async () => {
      const truncatedBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);

      const fallbackWebp = await processImage(truncatedBuffer);
      const meta = await sharp(fallbackWebp).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(1);
      expect(meta.height).toBe(1);
    });
  });

  describe('4. Storage Client (storage & StorageClient)', () => {
    it('stores and retrieves binary objects with content type', async () => {
      const client = new StorageClient();
      const testData = Buffer.from('hello-storage');
      await client.putObject('test-key-1', testData, 'image/webp');

      expect(await client.hasObject('test-key-1')).toBe(true);
      const item = await client.getObject('test-key-1');
      expect(item?.data.toString()).toBe('hello-storage');
      expect(item?.contentType).toBe('image/webp');

      await client.deleteObject('test-key-1');
      expect(await client.hasObject('test-key-1')).toBe(false);
      expect(await client.getObject('test-key-1')).toBeNull();
    });

    it('simulates R2 failure when SIMULATE_R2_FAILURE env var is true', async () => {
      const client = new StorageClient();
      process.env.SIMULATE_R2_FAILURE = 'true';

      await expect(
        client.putObject('key-fail', Buffer.from('abc'), 'image/webp'),
      ).rejects.toThrow('r2-write-failed');

      await expect(client.deleteObject('key-fail')).rejects.toThrow(
        'r2-delete-failed',
      );
    });
  });

  describe('5. Runtime Upload Endpoint (POST /api/admin/items/:id/images)', () => {
    it('enforces 8 MB byte cap (8,388,608 bytes) with 413 image-too-large naming bytes', async () => {
      expect(MAX_IMAGE_BYTES).toBe(8 * 1024 * 1024);

      const created = await db.createEquipment(
        { name: 'Oscilloscope', condition: 'Working' },
        'admin-upload-test-id',
      );

      const oversizedLength = 8 * 1024 * 1024 + 1;
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
      const body = (await res.json()) as { error: string; message: string };
      expect(body.error).toBe('image-too-large');
      expect(body.message).toContain('8388609');
      expect(body.message).toContain('8388608');
    });

    it('rejects bad magic bytes with 415 mime-rejected', async () => {
      const created = await db.createEquipment(
        { name: 'Function Generator', condition: 'Working' },
        'admin-upload-test-id',
      );

      const fakeJpg = Buffer.from('%PDF-1.5 disguised as jpeg content');

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/jpeg',
          },
          body: fakeJpg,
        },
      );

      expect(res.status).toBe(415);
      const body = (await res.json()) as { error: string; message: string };
      expect(body.error).toBe('mime-rejected');
    });

    it('processes real PNG upload: executes Sharp, stores in R2, updates DB and triggers revalidation', async () => {
      const created = await db.createEquipment(
        { name: 'Spectrum Analyzer', condition: 'Working' },
        'admin-upload-test-id',
      );

      const realImage = await sharp({
        create: {
          width: 1400,
          height: 900,
          channels: 3,
          background: { r: 10, g: 80, b: 160 },
        },
      })
        .png()
        .toBuffer();

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
          body: realImage,
        },
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as { image_keys: string[] };
      expect(Array.isArray(body.image_keys)).toBe(true);
      expect(body.image_keys.length).toBe(1);

      const newKey = body.image_keys[0];
      expect(newKey).toMatch(new RegExp(`^equip-${created.id}-\\d+\\.webp$`));

      const stored = await storage.getObject(newKey);
      expect(stored).not.toBeNull();
      expect(stored?.contentType).toBe('image/webp');

      const meta = await sharp(stored!.data).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(1200);
      expect(meta.height).toBe(771);

      const dbItem = await db.getEquipmentById(created.id);
      expect(dbItem?.image_keys).toEqual([newKey]);
      expect(dbItem?.updated_by).toBe('admin-upload-test-id');

      expect(triggered.length).toBeGreaterThan(0);
      expect(triggered[0]).toContain(`/item/${created.id}`);
    });

    it('handles simulated storage failure: returns 502 r2-write-failed and leaves DB row untouched', async () => {
      const created = await db.createEquipment(
        { name: 'Logic Analyzer', condition: 'Working', image_keys: [] },
        'admin-upload-test-id',
      );

      const realImage = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 100, g: 100, b: 100 },
        },
      })
        .jpeg()
        .toBuffer();

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/jpeg',
            'x-simulate-r2-failure': 'true',
          },
          body: realImage,
        },
      );

      expect(res.status).toBe(502);
      const body = (await res.json()) as { error: string; message: string };
      expect(body.error).toBe('r2-write-failed');

      const dbItem = await db.getEquipmentById(created.id);
      expect(dbItem?.image_keys).toEqual([]);
    });
  });

  describe('6. Gallery Image Deletion Endpoint (DELETE /api/admin/items/:id/images/:key)', () => {
    it('deletes image from storage and equipment row, and triggers cache revalidation', async () => {
      const keyToDelete = 'equip-test-del-123.webp';
      await storage.putObject(
        keyToDelete,
        Buffer.from('fake-webp'),
        'image/webp',
      );

      const created = await db.createEquipment(
        {
          name: 'Breadboard Matrix',
          condition: 'Working',
          image_keys: [keyToDelete, 'equip-keep.webp'],
        },
        'admin-upload-test-id',
      );

      const triggered: string[][] = [];
      setRevalidateListener((paths) => triggered.push(paths));

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images/${keyToDelete}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
          },
        },
      );

      expect(res.status).toBe(204);

      expect(await storage.hasObject(keyToDelete)).toBe(false);

      const dbItem = await db.getEquipmentById(created.id);
      expect(dbItem?.image_keys).toEqual(['equip-keep.webp']);
      expect(dbItem?.updated_by).toBe('admin-upload-test-id');

      expect(triggered.length).toBeGreaterThan(0);
      expect(triggered[0]).toContain(`/item/${created.id}`);
    });

    it('returns 404 not-found when item does not exist', async () => {
      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/missing-uuid/images/any.webp`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
          },
        },
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('not-found');
    });

    it('returns 404 not-found when image key is not attached to item', async () => {
      const created = await db.createEquipment(
        { name: 'Wire Stripper', condition: 'Working', image_keys: [] },
        'admin-upload-test-id',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images/missing.webp`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
          },
        },
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe('not-found');
    });
  });
});
