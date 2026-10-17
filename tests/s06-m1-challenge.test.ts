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
import { storage } from '../backend/src/storage.js';

describe('S-06 M1 Adversarial Challenger Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const validAdminToken = createToken({
    sub: 'admin-challenger-m1-id',
    email: 'admin.challenger@smartcomp.abu.edu.ng',
    app_metadata: { role: 'admin' },
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const nonAdminToken = createToken({
    sub: 'user-non-admin-id',
    email: 'visitor@smartcomp.abu.edu.ng',
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

  describe('Seam 1: Byte-cap enforcement boundary', () => {
    it('allows upload exactly at boundary minus 1 byte (8,388,607 bytes)', async () => {
      const created = await db.createEquipment(
        { name: 'Boundary Minus One Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const buffer = Buffer.alloc(8 * 1024 * 1024 - 1, 0x00);
      buffer[0] = 0x89;
      buffer[1] = 0x50;
      buffer[2] = 0x4e;
      buffer[3] = 0x47;
      buffer[4] = 0x0d;
      buffer[5] = 0x0a;
      buffer[6] = 0x1a;
      buffer[7] = 0x0a;

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: buffer,
        },
      );

      expect(res.status).toBe(201);
      const data = (await res.json()) as { image_keys: string[] };
      expect(data.image_keys.length).toBe(1);
    });

    it('allows upload exactly at 8 MB boundary (8,388,608 bytes)', async () => {
      const created = await db.createEquipment(
        { name: 'Boundary Exact Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const buffer = Buffer.alloc(8 * 1024 * 1024, 0x00);
      buffer[0] = 0xff;
      buffer[1] = 0xd8;
      buffer[2] = 0xff;
      buffer[3] = 0xe0;

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/jpeg',
          },
          body: buffer,
        },
      );

      expect(res.status).toBe(201);
      const data = (await res.json()) as { image_keys: string[] };
      expect(data.image_keys.length).toBe(1);
    });

    it('rejects upload at boundary plus 1 byte (8,388,609 bytes) with 413 image-too-large', async () => {
      const created = await db.createEquipment(
        { name: 'Boundary Plus One Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const buffer = Buffer.alloc(8 * 1024 * 1024 + 1, 0x00);
      buffer[0] = 0x89;
      buffer[1] = 0x50;
      buffer[2] = 0x4e;
      buffer[3] = 0x47;
      buffer[4] = 0x0d;
      buffer[5] = 0x0a;
      buffer[6] = 0x1a;
      buffer[7] = 0x0a;

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: buffer,
        },
      );

      expect(res.status).toBe(413);
      const data = (await res.json()) as { error: string; message: string };
      expect(data.error).toBe('image-too-large');
      expect(data.message).toBe(
        'Upload of 8388609 bytes exceeds maximum allowed size of 8388608 bytes',
      );
    });

    it('rejects upload of 10 MB payload with 413 naming actual vs max bytes', async () => {
      const created = await db.createEquipment(
        { name: 'High Overflow Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const tenMb = 10 * 1024 * 1024;
      const buffer = Buffer.alloc(tenMb, 0x00);
      buffer[0] = 0x89;
      buffer[1] = 0x50;
      buffer[2] = 0x4e;
      buffer[3] = 0x47;
      buffer[4] = 0x0d;
      buffer[5] = 0x0a;
      buffer[6] = 0x1a;
      buffer[7] = 0x0a;

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: buffer,
        },
      );

      expect(res.status).toBe(413);
      const data = (await res.json()) as { error: string; message: string };
      expect(data.error).toBe('image-too-large');
      expect(data.message).toContain('10485760');
      expect(data.message).toContain('8388608');
    });

    it('handles zero byte payload without crashing and returns 415 mime-rejected', async () => {
      const created = await db.createEquipment(
        { name: 'Zero Byte Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: Buffer.alloc(0),
        },
      );

      expect(res.status).toBe(415);
      const data = (await res.json()) as { error: string; message: string };
      expect(data.error).toBe('mime-rejected');
    });

    it('parses multipart/form-data with unquoted boundary correctly', async () => {
      const created = await db.createEquipment(
        { name: 'Multipart Unquoted Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const rawPng = await sharp({
        create: {
          width: 50,
          height: 50,
          channels: 3,
          background: { r: 10, g: 20, b: 30 },
        },
      })
        .png()
        .toBuffer();

      const boundary = 'X-BOUNDARY-12345';
      const preamble = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`;
      const epilogue = `\r\n--${boundary}--\r\n`;
      const multipartBody = Buffer.concat([
        Buffer.from(preamble),
        rawPng,
        Buffer.from(epilogue),
      ]);

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: multipartBody,
        },
      );

      expect(res.status).toBe(201);
      const data = (await res.json()) as { image_keys: string[] };
      expect(data.image_keys.length).toBe(1);
    });

    it('parses multipart/form-data with quoted boundary correctly', async () => {
      const created = await db.createEquipment(
        { name: 'Multipart Quoted Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const rawJpeg = await sharp({
        create: {
          width: 40,
          height: 40,
          channels: 3,
          background: { r: 50, g: 60, b: 70 },
        },
      })
        .jpeg()
        .toBuffer();

      const boundary = 'custom.quoted.boundary.9876';
      const preamble = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`;
      const epilogue = `\r\n--${boundary}--\r\n`;
      const multipartBody = Buffer.concat([
        Buffer.from(preamble),
        rawJpeg,
        Buffer.from(epilogue),
      ]);

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': `multipart/form-data; boundary="${boundary}"`,
          },
          body: multipartBody,
        },
      );

      expect(res.status).toBe(201);
      const data = (await res.json()) as { image_keys: string[] };
      expect(data.image_keys.length).toBe(1);
    });

    it('accepts multipart payload where overall body exceeds 8 MB but extracted file is under 8 MB', async () => {
      const created = await db.createEquipment(
        { name: 'Multipart Header Overhead Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const fileLength = 8 * 1024 * 1024 - 500;
      const fileBuffer = Buffer.alloc(fileLength, 0x00);
      fileBuffer[0] = 0x89;
      fileBuffer[1] = 0x50;
      fileBuffer[2] = 0x4e;
      fileBuffer[3] = 0x47;
      fileBuffer[4] = 0x0d;
      fileBuffer[5] = 0x0a;
      fileBuffer[6] = 0x1a;
      fileBuffer[7] = 0x0a;

      const boundary = 'boundary-large-test';
      const preamble = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="large.png"\r\nContent-Type: image/png\r\n\r\n`;
      const epilogue = `\r\n--${boundary}--\r\n`;
      const multipartBody = Buffer.concat([
        Buffer.from(preamble),
        fileBuffer,
        Buffer.from(epilogue),
      ]);

      expect(multipartBody.length).toBeLessThan(MAX_IMAGE_BYTES);

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: multipartBody,
        },
      );

      expect(res.status).toBe(201);
      const data = (await res.json()) as { image_keys: string[] };
      expect(data.image_keys.length).toBe(1);
    });

    it('rejects multipart payload when extracted file exceeds 8 MB with 413', async () => {
      const created = await db.createEquipment(
        { name: 'Multipart Oversized File Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const oversizedFile = Buffer.alloc(8 * 1024 * 1024 + 10, 0x00);
      oversizedFile[0] = 0x89;
      oversizedFile[1] = 0x50;
      oversizedFile[2] = 0x4e;
      oversizedFile[3] = 0x47;
      oversizedFile[4] = 0x0d;
      oversizedFile[5] = 0x0a;
      oversizedFile[6] = 0x1a;
      oversizedFile[7] = 0x0a;

      const boundary = 'boundary-oversized';
      const preamble = `--${boundary}\r\nContent-Disposition: form-data; name="file"\r\nContent-Type: image/png\r\n\r\n`;
      const epilogue = `\r\n--${boundary}--\r\n`;
      const multipartBody = Buffer.concat([
        Buffer.from(preamble),
        oversizedFile,
        Buffer.from(epilogue),
      ]);

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: multipartBody,
        },
      );

      expect(res.status).toBe(413);
      const data = (await res.json()) as { error: string; message: string };
      expect(data.error).toBe('image-too-large');
      expect(data.message).toContain('8388618');
    });

    it('handles malformed multipart missing header separator gracefully with 415', async () => {
      const created = await db.createEquipment(
        { name: 'Malformed Multipart Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const boundary = 'malformed-boundary';
      const badBody = Buffer.from(
        `--${boundary}\r\nNoHeadersHereJustGarbageDataWithoutEmptyLineSeparator`,
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: badBody,
        },
      );

      expect(res.status).toBe(415);
      const data = (await res.json()) as { error: string; message: string };
      expect(data.error).toBe('mime-rejected');
    });
  });

  describe('Seam 2: Magic-byte sniffing & MIME spoofing', () => {
    it('rejects GIF89a file header even with image/gif or image/jpeg content-type', async () => {
      const gifBuf = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00');
      expect(isAllowedImage(gifBuf)).toBe(false);
      expect(sniffMimeType(gifBuf)).toBeNull();

      const created = await db.createEquipment(
        { name: 'GIF Reject Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/jpeg',
          },
          body: gifBuf,
        },
      );

      expect(res.status).toBe(415);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('mime-rejected');
    });

    it('rejects Windows PE executable header (MZ) disguised as image/png', async () => {
      const exeBuf = Buffer.from([
        0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00,
      ]);
      expect(isAllowedImage(exeBuf)).toBe(false);

      const created = await db.createEquipment(
        { name: 'Executable Reject Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: exeBuf,
        },
      );

      expect(res.status).toBe(415);
    });

    it('rejects shell script disguised as image/webp', async () => {
      const shBuf = Buffer.from('#!/bin/bash\nrm -rf /tmp/test\n');
      expect(isAllowedImage(shBuf)).toBe(false);

      const created = await db.createEquipment(
        { name: 'Shell Script Reject Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/webp',
          },
          body: shBuf,
        },
      );

      expect(res.status).toBe(415);
    });

    it('rejects HTML polyglot script disguised as image/jpeg', async () => {
      const htmlBuf = Buffer.from(
        '<!DOCTYPE html><html><body><script>alert("xss")</script></body></html>',
      );
      expect(isAllowedImage(htmlBuf)).toBe(false);

      const created = await db.createEquipment(
        { name: 'HTML Reject Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/jpeg',
          },
          body: htmlBuf,
        },
      );

      expect(res.status).toBe(415);
    });

    it('rejects PHP code disguised as image/png', async () => {
      const phpBuf = Buffer.from('<?php echo "evil payload"; ?>');
      expect(isAllowedImage(phpBuf)).toBe(false);

      const created = await db.createEquipment(
        { name: 'PHP Reject Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: phpBuf,
        },
      );

      expect(res.status).toBe(415);
    });

    it('rejects ZIP archive disguised as image/avif', async () => {
      const zipBuf = Buffer.from([
        0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00,
      ]);
      expect(isAllowedImage(zipBuf)).toBe(false);

      const created = await db.createEquipment(
        { name: 'Zip Reject Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/avif',
          },
          body: zipBuf,
        },
      );

      expect(res.status).toBe(415);
    });

    it('rejects corrupt JPEG header with invalid third byte', () => {
      const corruptJpeg = Buffer.from([0xff, 0xd8, 0x00, 0xe0]);
      expect(isAllowedImage(corruptJpeg)).toBe(false);
      expect(sniffMimeType(corruptJpeg)).toBeNull();
    });

    it('rejects corrupt PNG header with altered control byte', () => {
      const corruptPng = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x00, 0x0a,
      ]);
      expect(isAllowedImage(corruptPng)).toBe(false);
      expect(sniffMimeType(corruptPng)).toBeNull();
    });

    it('rejects truncated PNG header of only 7 bytes', () => {
      const truncatedPng = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a,
      ]);
      expect(isAllowedImage(truncatedPng)).toBe(false);
      expect(sniffMimeType(truncatedPng)).toBeNull();
    });

    it('rejects RIFF buffer with AVI signature instead of WEBP', () => {
      const aviBuf = Buffer.concat([
        Buffer.from('RIFF', 'ascii'),
        Buffer.alloc(4),
        Buffer.from('AVI ', 'ascii'),
      ]);
      expect(isAllowedImage(aviBuf)).toBe(false);
      expect(sniffMimeType(aviBuf)).toBeNull();
    });

    it('rejects ftyp box with mp42 brand instead of avif', () => {
      const mp4Buf = Buffer.concat([
        Buffer.alloc(4),
        Buffer.from('ftypmp42', 'ascii'),
        Buffer.alloc(4),
      ]);
      expect(isAllowedImage(mp4Buf)).toBe(false);
      expect(sniffMimeType(mp4Buf)).toBeNull();
    });

    it('ignores client Content-Type and inspects buffer magic bytes', async () => {
      const created = await db.createEquipment(
        { name: 'MIME Sniff Ground Truth Equipment', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const validPng = await sharp({
        create: {
          width: 32,
          height: 32,
          channels: 3,
          background: { r: 120, g: 130, b: 140 },
        },
      })
        .png()
        .toBuffer();

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'application/octet-stream',
          },
          body: validPng,
        },
      );

      expect(res.status).toBe(201);
      const data = (await res.json()) as { image_keys: string[] };
      expect(data.image_keys.length).toBe(1);
    });

    it('correctly classifies all supported image signatures', () => {
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe1]);
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const webp = Buffer.concat([
        Buffer.from('RIFF', 'ascii'),
        Buffer.alloc(4),
        Buffer.from('WEBP', 'ascii'),
      ]);
      const avif = Buffer.concat([
        Buffer.alloc(4),
        Buffer.from('ftypavif', 'ascii'),
      ]);
      const avis = Buffer.concat([
        Buffer.alloc(4),
        Buffer.from('ftypavis', 'ascii'),
      ]);
      const mif1 = Buffer.concat([
        Buffer.alloc(4),
        Buffer.from('ftypmif1', 'ascii'),
      ]);

      expect(sniffMimeType(jpeg)).toBe('image/jpeg');
      expect(sniffMimeType(png)).toBe('image/png');
      expect(sniffMimeType(webp)).toBe('image/webp');
      expect(sniffMimeType(avif)).toBe('image/avif');
      expect(sniffMimeType(avis)).toBe('image/avif');
      expect(sniffMimeType(mif1)).toBe('image/avif');
    });
  });

  describe('Seam 3: Mutex lock concurrency & queue resilience', () => {
    it('serializes 8 concurrent tasks ensuring max active count never exceeds 1', async () => {
      let active = 0;
      let maxActive = 0;
      const order: number[] = [];

      const makeTask = (id: number, delayMs: number) =>
        withImageLock(async () => {
          active += 1;
          if (active > maxActive) {
            maxActive = active;
          }
          await new Promise((res) => setTimeout(res, delayMs));
          order.push(id);
          active -= 1;
          return id;
        });

      const promises = [
        makeTask(1, 30),
        makeTask(2, 20),
        makeTask(3, 15),
        makeTask(4, 25),
        makeTask(5, 10),
        makeTask(6, 15),
        makeTask(7, 20),
        makeTask(8, 5),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(order).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(maxActive).toBe(1);
      expect(getImageLockState().active).toBe(false);
      expect(getImageLockState().activeCount).toBe(0);
    });

    it('tracks queue state accurately and releases lock cleanly on error', async () => {
      let lockEntered = false;

      const failingTask = withImageLock(async () => {
        lockEntered = true;
        await new Promise((res) => setTimeout(res, 20));
        throw new Error('Forced lock failure');
      });

      const waitingTask = withImageLock(async () => {
        return 'success-after-error';
      });

      await expect(failingTask).rejects.toThrow('Forced lock failure');
      expect(lockEntered).toBe(true);

      const waitingResult = await waitingTask;
      expect(waitingResult).toBe('success-after-error');
      expect(getImageLockState().active).toBe(false);
      expect(getImageLockState().activeCount).toBe(0);
    });

    it('handles concurrent HTTP upload requests sequentially without deadlock', async () => {
      const item1 = await db.createEquipment(
        { name: 'Concurrent Item 1', condition: 'Working' },
        'admin-challenger-m1-id',
      );
      const item2 = await db.createEquipment(
        { name: 'Concurrent Item 2', condition: 'Working' },
        'admin-challenger-m1-id',
      );
      const item3 = await db.createEquipment(
        { name: 'Concurrent Item 3', condition: 'Working' },
        'admin-challenger-m1-id',
      );
      const item4 = await db.createEquipment(
        { name: 'Concurrent Item 4', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const makeImage = (w: number, h: number, r: number) =>
        sharp({
          create: {
            width: w,
            height: h,
            channels: 3,
            background: { r, g: 100, b: 100 },
          },
        })
          .png()
          .toBuffer();

      const [img1, img2, img3, img4] = await Promise.all([
        makeImage(100, 100, 10),
        makeImage(120, 120, 40),
        makeImage(140, 140, 80),
        makeImage(160, 160, 120),
      ]);

      const [res1, res2, res3, res4] = await Promise.all([
        globalThis.fetch(`${baseUrl}/api/admin/items/${item1.id}/images`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: img1,
        }),
        globalThis.fetch(`${baseUrl}/api/admin/items/${item2.id}/images`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: img2,
        }),
        globalThis.fetch(`${baseUrl}/api/admin/items/${item3.id}/images`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: img3,
        }),
        globalThis.fetch(`${baseUrl}/api/admin/items/${item4.id}/images`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: img4,
        }),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res3.status).toBe(201);
      expect(res4.status).toBe(201);

      const updated1 = await db.getEquipmentById(item1.id);
      const updated2 = await db.getEquipmentById(item2.id);
      const updated3 = await db.getEquipmentById(item3.id);
      const updated4 = await db.getEquipmentById(item4.id);

      expect(updated1?.image_keys.length).toBe(1);
      expect(updated2?.image_keys.length).toBe(1);
      expect(updated3?.image_keys.length).toBe(1);
      expect(updated4?.image_keys.length).toBe(1);
      expect(getImageLockState().active).toBe(false);
    });

    it('handles sequential rapid uploads to the same item correctly appending keys', async () => {
      const created = await db.createEquipment(
        { name: 'Sequential Rapid Item', condition: 'Working' },
        'admin-challenger-m1-id',
      );

      const makeImage = (r: number) =>
        sharp({
          create: {
            width: 80,
            height: 80,
            channels: 3,
            background: { r, g: 50, b: 50 },
          },
        })
          .png()
          .toBuffer();

      const [img1, img2] = await Promise.all([makeImage(10), makeImage(50)]);

      const res1 = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: img1,
        },
      );
      expect(res1.status).toBe(201);

      const res2 = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: img2,
        },
      );
      expect(res2.status).toBe(201);

      const updated = await db.getEquipmentById(created.id);
      expect(updated?.image_keys.length).toBe(2);
    });

    it('processes image within size constraints preserving aspect ratio', async () => {
      const widePng = await sharp({
        create: {
          width: 2400,
          height: 1200,
          channels: 3,
          background: { r: 15, g: 30, b: 45 },
        },
      })
        .png()
        .toBuffer();

      const out = await processImage(widePng);
      const meta = await sharp(out).metadata();

      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(1200);
      expect(meta.height).toBe(600);
      expect(out.length).toBeLessThanOrEqual(400 * 1024);
    });
  });

  describe('Seam 4: Storage failure & database isolation', () => {
    it('returns 502 r2-write-failed and leaves DB row image_keys completely unchanged', async () => {
      const created = await db.createEquipment(
        {
          name: 'Storage Failure Isolation Equipment',
          condition: 'Working',
          image_keys: ['equip-existing-key.webp'],
        },
        'admin-challenger-m1-id',
      );

      const beforeItem = await db.getEquipmentById(created.id);
      expect(beforeItem?.image_keys).toEqual(['equip-existing-key.webp']);
      const beforeUpdatedAt = beforeItem?.updated_at;

      const validPng = await sharp({
        create: {
          width: 80,
          height: 80,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
            'x-simulate-r2-failure': 'true',
          },
          body: validPng,
        },
      );

      expect(res.status).toBe(502);
      const data = (await res.json()) as { error: string; message: string };
      expect(data.error).toBe('r2-write-failed');
      expect(data.message).toBe('Failed to write image to storage');

      const afterItem = await db.getEquipmentById(created.id);
      expect(afterItem?.image_keys).toEqual(['equip-existing-key.webp']);
      expect(afterItem?.updated_at).toBe(beforeUpdatedAt);
    });

    it('returns 502 when SIMULATE_R2_FAILURE env var is true and preserves DB state', async () => {
      const created = await db.createEquipment(
        {
          name: 'Env Storage Failure Equipment',
          condition: 'Faulty',
          image_keys: [],
        },
        'admin-challenger-m1-id',
      );

      process.env.SIMULATE_R2_FAILURE = 'true';

      const validPng = await sharp({
        create: {
          width: 60,
          height: 60,
          channels: 3,
          background: { r: 10, g: 150, b: 20 },
        },
      })
        .png()
        .toBuffer();

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: validPng,
        },
      );

      expect(res.status).toBe(502);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('r2-write-failed');

      const afterItem = await db.getEquipmentById(created.id);
      expect(afterItem?.image_keys).toEqual([]);
    });

    it('recovers successfully on next upload after storage failure is cleared', async () => {
      const created = await db.createEquipment(
        {
          name: 'Storage Recovery Equipment',
          condition: 'Working',
          image_keys: [],
        },
        'admin-challenger-m1-id',
      );

      const validPng = await sharp({
        create: {
          width: 50,
          height: 50,
          channels: 3,
          background: { r: 70, g: 80, b: 90 },
        },
      })
        .png()
        .toBuffer();

      const failedRes = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
            'x-simulate-r2-failure': 'true',
          },
          body: validPng,
        },
      );
      expect(failedRes.status).toBe(502);

      const okRes = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: validPng,
        },
      );
      expect(okRes.status).toBe(201);
      const okData = (await okRes.json()) as { image_keys: string[] };
      expect(okData.image_keys.length).toBe(1);

      const stored = await storage.getObject(okData.image_keys[0]);
      expect(stored).not.toBeNull();
    });
  });

  describe('Seam 5: Image deletion edge cases', () => {
    it('returns 404 not-found for whitespace image key', async () => {
      const created = await db.createEquipment(
        {
          name: 'Whitespace Delete Equipment',
          condition: 'Working',
          image_keys: ['equip-valid.webp'],
        },
        'admin-challenger-m1-id',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images/%20%20%20`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
          },
        },
      );

      expect(res.status).toBe(404);
      const data = (await res.json()) as { error: string; message: string };
      expect(data.error).toBe('not-found');
      expect(data.message).toBe('Image key not found on item');
    });

    it('rejects path traversal attempts in image key with 404 without touching storage', async () => {
      const created = await db.createEquipment(
        {
          name: 'Traversal Delete Equipment',
          condition: 'Working',
          image_keys: ['equip-legit.webp'],
        },
        'admin-challenger-m1-id',
      );

      await storage.putObject(
        'equip-legit.webp',
        Buffer.from('legit'),
        'image/webp',
      );
      await storage.putObject(
        'etc-passwd-simulated',
        Buffer.from('sensitive'),
        'text/plain',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images/..%2F..%2Fetc-passwd-simulated`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
          },
        },
      );

      expect(res.status).toBe(404);
      expect(await storage.hasObject('etc-passwd-simulated')).toBe(true);
      expect(await storage.hasObject('equip-legit.webp')).toBe(true);
    });

    it('returns 404 when key belongs to another item but not this item', async () => {
      const itemA = await db.createEquipment(
        {
          name: 'Item A',
          condition: 'Working',
          image_keys: ['equip-item-a.webp'],
        },
        'admin-challenger-m1-id',
      );
      const itemB = await db.createEquipment(
        {
          name: 'Item B',
          condition: 'Working',
          image_keys: ['equip-item-b.webp'],
        },
        'admin-challenger-m1-id',
      );

      await storage.putObject(
        'equip-item-b.webp',
        Buffer.from('data-b'),
        'image/webp',
      );

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${itemA.id}/images/equip-item-b.webp`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
          },
        },
      );

      expect(res.status).toBe(404);
      const data = (await res.json()) as { error: string; message: string };
      expect(data.error).toBe('not-found');
      expect(data.message).toBe('Image key not found on item');

      expect(await storage.hasObject('equip-item-b.webp')).toBe(true);
      const fetchedB = await db.getEquipmentById(itemB.id);
      expect(fetchedB?.image_keys).toEqual(['equip-item-b.webp']);
    });

    it('returns 404 when item itself does not exist', async () => {
      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/nonexistent-item-uuid/images/some-key.webp`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
          },
        },
      );

      expect(res.status).toBe(404);
      const data = (await res.json()) as { error: string; message: string };
      expect(data.error).toBe('not-found');
      expect(data.message).toBe('Item not found');
    });

    it('deletes key cleanly, updates attribution and triggers cache revalidation', async () => {
      const key = 'equip-delete-me-1.webp';
      await storage.putObject(key, Buffer.from('data'), 'image/webp');

      const created = await db.createEquipment(
        {
          name: 'Clean Delete Equipment',
          condition: 'Working',
          image_keys: [key, 'equip-keep-me.webp'],
        },
        'initial-admin',
      );

      const revalidated: string[][] = [];
      setRevalidateListener((paths) => revalidated.push(paths));

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images/${key}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
          },
        },
      );

      expect(res.status).toBe(204);
      expect(await storage.hasObject(key)).toBe(false);

      const updated = await db.getEquipmentById(created.id);
      expect(updated?.image_keys).toEqual(['equip-keep-me.webp']);
      expect(updated?.updated_by).toBe('admin-challenger-m1-id');

      expect(revalidated.length).toBeGreaterThan(0);
      expect(revalidated[0]).toEqual(['/', '/room', `/item/${created.id}`]);
    });

    it('returns 404 when attempting to delete the same key twice', async () => {
      const key = 'equip-double-delete.webp';
      await storage.putObject(key, Buffer.from('data'), 'image/webp');

      const created = await db.createEquipment(
        {
          name: 'Double Delete Equipment',
          condition: 'Working',
          image_keys: [key],
        },
        'admin-challenger-m1-id',
      );

      const firstRes = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images/${key}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
          },
        },
      );
      expect(firstRes.status).toBe(204);

      const secondRes = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images/${key}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
          },
        },
      );
      expect(secondRes.status).toBe(404);
      const data = (await secondRes.json()) as { error: string };
      expect(data.error).toBe('not-found');
    });

    it('still returns 204 and updates DB if storage deleteObject encounters error', async () => {
      const key = 'equip-resilient-delete.webp';
      await storage.putObject(key, Buffer.from('data'), 'image/webp');

      const created = await db.createEquipment(
        {
          name: 'Resilient Delete Equipment',
          condition: 'Working',
          image_keys: [key],
        },
        'admin-challenger-m1-id',
      );

      process.env.SIMULATE_R2_FAILURE = 'true';

      const res = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images/${key}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${validAdminToken}`,
          },
        },
      );

      expect(res.status).toBe(204);

      delete process.env.SIMULATE_R2_FAILURE;

      const updated = await db.getEquipmentById(created.id);
      expect(updated?.image_keys).toEqual([]);
    });

    it('rejects unauthenticated and non-admin requests with 401 and 403', async () => {
      const created = await db.createEquipment(
        {
          name: 'Auth Guard Equipment',
          condition: 'Working',
          image_keys: ['equip-guard.webp'],
        },
        'admin-challenger-m1-id',
      );

      const unauthUpload = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          body: Buffer.from('test'),
        },
      );
      expect(unauthUpload.status).toBe(401);

      const nonAdminUpload = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${nonAdminToken}`,
            'Content-Type': 'image/png',
          },
          body: Buffer.from('test'),
        },
      );
      expect(nonAdminUpload.status).toBe(403);

      const unauthDelete = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images/equip-guard.webp`,
        {
          method: 'DELETE',
        },
      );
      expect(unauthDelete.status).toBe(401);

      const nonAdminDelete = await globalThis.fetch(
        `${baseUrl}/api/admin/items/${created.id}/images/equip-guard.webp`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${nonAdminToken}`,
          },
        },
      );
      expect(nonAdminDelete.status).toBe(403);
    });
  });
});
