import { describe, it, expect, beforeEach } from 'vitest';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import {
  deriveSlug,
  parseLegacyXlsx,
  enhanceLegacyImage,
  extractLegacyImages,
  importLegacyData,
  LEGACY_EQUIPMENT_RECORDS,
} from '../backend/src/legacy-import.js';
import { storage } from '../backend/src/storage.js';
import { db } from '../backend/src/db.js';

describe('Legacy Import Tooling Suite (S-06 M2)', () => {
  beforeEach(() => {
    storage.clear();
    db.reset();
  });

  describe('1. Slug Derivation (deriveSlug)', () => {
    it('correctly derives slugs for all 7 legacy sheet equipment names', () => {
      expect(deriveSlug('Smart Create view Screen')).toBe(
        'smart-create-view-screen',
      );
      expect(deriveSlug('Recording Host')).toBe('recording-host');
      expect(deriveSlug('Monitors')).toBe('monitors');
      expect(deriveSlug('Student Camera')).toBe('student-camera');
      expect(deriveSlug('Router and switch ')).toBe('router-and-switch');
      expect(deriveSlug('Students screen and camera ')).toBe(
        'students-screen-and-camera',
      );
      expect(deriveSlug('HDMI splitter and converter ')).toBe(
        'hdmi-splitter-and-converter',
      );
    });

    it('handles edge cases: leading/trailing whitespace, multiple spaces, uppercase, and special chars', () => {
      expect(deriveSlug('   Leading and trailing   ')).toBe(
        'leading-and-trailing',
      );
      expect(deriveSlug('Mixed   Whitespace\t\nRuns')).toBe(
        'mixed-whitespace-runs',
      );
      expect(deriveSlug('Special!@#$%^&*()_+Characters')).toBe(
        'specialcharacters',
      );
      expect(deriveSlug('---Dashes---In---Front---')).toBe('dashes-in-front');
      expect(deriveSlug('   ')).toBe('');
    });
  });

  describe('2. Legacy XLSX Parsing (parseLegacyXlsx)', () => {
    it('parses all 7 rows from the legacy spreadsheet with correct headers and types', async () => {
      const rows = await parseLegacyXlsx();
      expect(rows).toHaveLength(7);

      const monitorsRow = rows.find((r) => r.slug === 'monitors');
      expect(monitorsRow).toBeDefined();
      expect(monitorsRow?.name).toBe('Monitors');
      expect(monitorsRow?.quantity).toBe(50);
      expect(monitorsRow?.condition).toBe('Working');
      expect(monitorsRow?.image_urls).toHaveLength(1);

      const studentCameraRow = rows.find((r) => r.slug === 'student-camera');
      expect(studentCameraRow).toBeDefined();
      expect(studentCameraRow?.name).toBe('Student Camera');
      expect(studentCameraRow?.quantity).toBe(1);
      expect(studentCameraRow?.condition).toBe('Working');
      expect(studentCameraRow?.image_urls).toHaveLength(2);

      const singleUnitSlugs = [
        'smart-create-view-screen',
        'recording-host',
        'student-camera',
        'router-and-switch',
        'students-screen-and-camera',
        'hdmi-splitter-and-converter',
      ];
      for (const slug of singleUnitSlugs) {
        const item = rows.find((r) => r.slug === slug);
        expect(item).toBeDefined();
        expect(item?.quantity).toBe(1);
        expect(item?.condition).toBe('Working');
      }

      const hdmiRow = rows.find(
        (r) => r.slug === 'hdmi-splitter-and-converter',
      );
      expect(hdmiRow).toBeDefined();
      expect(hdmiRow?.other_functionality).toBeNull();
    });

    it('accepts a raw Buffer as input to parseLegacyXlsx', async () => {
      const xlsxPath = path.resolve(
        process.cwd(),
        'Smart Class Data Form (Responses).xlsx',
      );
      const buf = fs.readFileSync(xlsxPath);
      const rows = await parseLegacyXlsx(buf);
      expect(rows).toHaveLength(7);
      expect(rows[0].slug).toBe('smart-create-view-screen');
    });
  });

  describe('3. Legacy Image Enhancement (enhanceLegacyImage)', () => {
    it('enhances raw image to WebP, strips EXIF, clamps dimensions to <= 1200px, and satisfies I4 budget', async () => {
      const zipPath = path.resolve(
        process.cwd(),
        'ABU-SmartComp-Legacy-Images-20261013T193523Z-1-001.zip',
      );
      const images = await extractLegacyImages(zipPath);
      const rawBuf = images.get('student-camera-1.jpg');
      expect(rawBuf).toBeDefined();

      if (rawBuf) {
        const enhanced = await enhanceLegacyImage(rawBuf);
        expect(Buffer.isBuffer(enhanced)).toBe(true);

        const metadata = await sharp(enhanced).metadata();
        expect(metadata.format).toBe('webp');
        expect(metadata.width).toBeLessThanOrEqual(1200);
        expect(metadata.height).toBeLessThanOrEqual(1200);
        expect(metadata.exif).toBeUndefined();
        expect(enhanced.length).toBeLessThanOrEqual(400 * 1024);
      }
    });

    it('enhances synthetic JPEG correctly', async () => {
      const testImage = await sharp({
        create: {
          width: 1600,
          height: 1200,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .jpeg()
        .toBuffer();

      const enhanced = await enhanceLegacyImage(testImage);
      const metadata = await sharp(enhanced).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.width).toBeLessThanOrEqual(1200);
      expect(metadata.height).toBeLessThanOrEqual(1200);
      expect(enhanced.length).toBeLessThanOrEqual(150 * 1024);
    });
  });

  describe('4. Legacy Image Extraction (extractLegacyImages)', () => {
    it('extracts all 8 legacy photographs from the zip file', async () => {
      const zipPath = path.resolve(
        process.cwd(),
        'ABU-SmartComp-Legacy-Images-20261013T193523Z-1-001.zip',
      );
      const imageMap = await extractLegacyImages(zipPath);
      expect(imageMap.size).toBe(8);

      const expectedFiles = [
        'smart-create-view-screen-1.jpg',
        'recording-host-1.jpg',
        'monitors-1.jpg',
        'student-camera-1.jpg',
        'student-camera-2.jpg',
        'router-and-switch-1.jpg',
        'students-screen-and-camera-1.jpg',
        'hdmi-splitter-and-converter-1.jpg',
      ];

      for (const expected of expectedFiles) {
        expect(imageMap.has(expected)).toBe(true);
        const buf = imageMap.get(expected);
        expect(buf).toBeDefined();
        expect(buf!.length).toBeGreaterThan(1000);
      }
    });
  });

  describe('5. Legacy Data & Image Import Pipeline (importLegacyData)', () => {
    it('imports all 7 records, associates images, writes to storage and db', async () => {
      const records = await importLegacyData();
      expect(records).toHaveLength(7);

      const studentCamera = records.find((r) => r.name === 'Student Camera');
      expect(studentCamera).toBeDefined();
      expect(studentCamera?.image_keys).toHaveLength(2);
      expect(studentCamera?.image_keys).toEqual([
        'student-camera-1.webp',
        'student-camera-2.webp',
      ]);

      const monitors = records.find((r) => r.name === 'Monitors');
      expect(monitors).toBeDefined();
      expect(monitors?.quantity).toBe(50);
      expect(monitors?.image_keys).toEqual(['monitors-1.webp']);

      for (const record of records) {
        if (record.name !== 'Student Camera') {
          expect(record.image_keys).toHaveLength(1);
        }
        for (const key of record.image_keys) {
          expect(await storage.hasObject(key)).toBe(true);
          const obj = await storage.getObject(key);
          expect(obj).toBeDefined();
          expect(obj?.contentType).toBe('image/webp');
          expect(obj?.data.length).toBeLessThanOrEqual(400 * 1024);
        }
      }

      const dbEquipment = await db.getEquipment();
      expect(dbEquipment).toHaveLength(7);
    }, 30000);
  });

  describe('6. Pre-seeded Legacy Equipment Records (LEGACY_EQUIPMENT_RECORDS)', () => {
    it('contains all 7 verified legacy records with valid UUIDs and required properties', () => {
      expect(LEGACY_EQUIPMENT_RECORDS).toHaveLength(7);

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const item of LEGACY_EQUIPMENT_RECORDS) {
        expect(item.id).toMatch(uuidRegex);
        expect(item.name).toBeTruthy();
        expect(item.condition).toBe('Working');
        expect(item.image_keys.length).toBeGreaterThanOrEqual(1);
        expect(item.created_at).toBeTruthy();
        expect(item.updated_at).toBeTruthy();
      }

      const monitors = LEGACY_EQUIPMENT_RECORDS.find(
        (i) => i.name === 'Monitors',
      );
      expect(monitors?.quantity).toBe(50);
    });
  });
});
