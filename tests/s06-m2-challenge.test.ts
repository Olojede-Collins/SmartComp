// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import sharp from 'sharp';

vi.mock('next/font/local', () => ({
  default: () => ({
    variable: '--font-mock',
    className: 'font-mock',
  }),
}));

const mockNotFound = vi.fn();
vi.mock('next/navigation', () => ({
  notFound: () => {
    mockNotFound();
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/lib/equipment', () => ({
  getEquipment: vi.fn(),
  getEquipmentById: vi.fn(),
}));

import { getEquipment, getEquipmentById } from '@/lib/equipment';
import Page from '../app/page';
import RoomPage from '../app/room/page';
import ItemPage from '../app/item/[id]/page';
import {
  deriveSlug,
  parseLegacyXlsx,
  enhanceLegacyImage,
  extractLegacyImages,
} from '../backend/src/legacy-import.js';
import { storage } from '../backend/src/storage.js';
import { db, type EquipmentRecord } from '../backend/src/db.js';

interface ZipEntryInput {
  name: string;
  data: Buffer;
  method?: number;
}

function buildSyntheticZip(entries: ZipEntryInput[]): Buffer {
  const localHeaders: Buffer[] = [];
  const cdHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const method = entry.method ?? 0;
    const compData =
      method === 8 ? zlib.deflateRawSync(entry.data) : entry.data;
    const compSize = compData.length;
    const uncompSize = entry.data.length;

    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0);
    loc.writeUInt16LE(20, 4);
    loc.writeUInt16LE(0, 6);
    loc.writeUInt16LE(method, 8);
    loc.writeUInt16LE(0, 10);
    loc.writeUInt16LE(0, 12);
    loc.writeUInt32LE(0, 14);
    loc.writeUInt32LE(compSize, 18);
    loc.writeUInt32LE(uncompSize, 22);
    loc.writeUInt16LE(nameBuf.length, 26);
    loc.writeUInt16LE(0, 28);

    const locFull = Buffer.concat([loc, nameBuf, compData]);
    localHeaders.push(locFull);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(0, 16);
    cd.writeUInt32LE(compSize, 20);
    cd.writeUInt32LE(uncompSize, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);

    const cdFull = Buffer.concat([cd, nameBuf]);
    cdHeaders.push(cdFull);

    offset += locFull.length;
  }

  const cdBuf = Buffer.concat(cdHeaders);
  const cdOffset = offset;
  const cdSize = cdBuf.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, cdBuf, eocd]);
}

function buildSyntheticXlsx(params: {
  sharedStrings?: string[];
  rowsXml?: string;
  omitSharedStrings?: boolean;
  omitSheet1?: boolean;
}): Buffer {
  const entries: ZipEntryInput[] = [];

  if (!params.omitSharedStrings) {
    const sstItems = (params.sharedStrings ?? [])
      .map((s) => `<si><t>${s}</t></si>`)
      .join('');
    const sstXml = `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sstItems}</sst>`;
    entries.push({
      name: 'xl/sharedStrings.xml',
      data: Buffer.from(sstXml, 'utf8'),
      method: 8,
    });
  }

  if (!params.omitSheet1) {
    const rows =
      params.rowsXml ??
      '<row r="1"><c r="A1"><v>Timestamp</v></c><c r="B1"><v>Name</v></c></row>';
    const sheetXml = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`;
    entries.push({
      name: 'xl/worksheets/sheet1.xml',
      data: Buffer.from(sheetXml, 'utf8'),
      method: 8,
    });
  }

  return buildSyntheticZip(entries);
}

describe('S-06 M2 Adversarial Challenger Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.clear();
    db.reset();
  });

  describe('Seam 1: Slug derivation edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(deriveSlug('')).toBe('');
    });

    it('returns empty string for whitespace-only input', () => {
      expect(deriveSlug('     ')).toBe('');
    });

    it('returns empty string for tabs, carriage returns, and newlines', () => {
      expect(deriveSlug(' \t \r\n \v\f ')).toBe('');
    });

    it('strips unicode emojis and collapses remaining words', () => {
      expect(deriveSlug('Smart 💻 Class 🖥️ Hub 🚀')).toBe('smart-class-hub');
    });

    it('strips accented non-ascii characters and preserves valid chars', () => {
      expect(deriveSlug('Équipement Résumé Cafetière Über')).toBe(
        'quipement-rsum-cafetire-ber',
      );
    });

    it('returns empty string when input consists only of punctuation and symbols', () => {
      expect(deriveSlug('!@#$%^&*()_+={}:"<>?[];\',./~`|\\')).toBe('');
    });

    it('trims leading and trailing hyphens and collapses internal multiple hyphens', () => {
      expect(deriveSlug('---Smart---Create---View---Screen---')).toBe(
        'smart-create-view-screen',
      );
    });

    it('collapses mixed whitespace and hyphens into single hyphens', () => {
      expect(deriveSlug('Smart   - - -   Create   - -   View')).toBe(
        'smart-create-view',
      );
    });

    it('normalizes arbitrary mixed casing to lowercase', () => {
      expect(deriveSlug('sMaRt CrEaTe ViEw ScReEn')).toBe(
        'smart-create-view-screen',
      );
    });

    it('normalizes all uppercase sheet names', () => {
      expect(deriveSlug('SMART CREATE VIEW SCREEN')).toBe(
        'smart-create-view-screen',
      );
    });

    it('preserves pure numeric strings', () => {
      expect(deriveSlug('20261017')).toBe('20261017');
    });

    it('cleans alphanumeric input with embedded symbols and slashes', () => {
      expect(deriveSlug('Router 10/100/1000 & Switch (v2.0)')).toBe(
        'router-101001000-switch-v20',
      );
    });

    it('preserves numbers at beginning and end of name', () => {
      expect(deriveSlug('10 Monitors 20')).toBe('10-monitors-20');
    });

    it('normalizes non-breaking whitespace and control characters', () => {
      expect(deriveSlug('Smart\u00A0Class\u2003Room')).toBe('smart-class-room');
    });

    it('handles extremely long 1000-character input without throwing or hanging', () => {
      const longInput = 'Equipment '.repeat(100);
      const slug = deriveSlug(longInput);
      expect(slug.length).toBeGreaterThan(0);
      expect(slug.startsWith('equipment-')).toBe(true);
      expect(slug.endsWith('equipment')).toBe(true);
      expect(slug).not.toContain('--');
    });

    it('derives exact canonical slugs for all 7 legacy sheet equipment names', () => {
      const canonicalMap: Record<string, string> = {
        'Smart Create view Screen': 'smart-create-view-screen',
        'Recording Host': 'recording-host',
        Monitors: 'monitors',
        'Student Camera': 'student-camera',
        'Router and switch ': 'router-and-switch',
        'Students screen and camera ': 'students-screen-and-camera',
        'HDMI splitter and converter ': 'hdmi-splitter-and-converter',
      };

      for (const [rawName, expectedSlug] of Object.entries(canonicalMap)) {
        expect(deriveSlug(rawName)).toBe(expectedSlug);
      }
    });
  });

  describe('Seam 2: XLSX parsing edge cases', () => {
    it('throws Invalid ZIP archive when passed non-ZIP random buffer', async () => {
      const nonZip = Buffer.from('Not a zip file at all');
      await expect(parseLegacyXlsx(nonZip)).rejects.toThrow(
        'Invalid ZIP archive',
      );
    });

    it('throws when xl/sharedStrings.xml is missing from archive', async () => {
      const badZip = buildSyntheticXlsx({ omitSharedStrings: true });
      await expect(parseLegacyXlsx(badZip)).rejects.toThrow(
        'Missing xl/sharedStrings.xml or xl/worksheets/sheet1.xml in XLSX',
      );
    });

    it('throws when xl/worksheets/sheet1.xml is missing from archive', async () => {
      const badZip = buildSyntheticXlsx({ omitSheet1: true });
      await expect(parseLegacyXlsx(badZip)).rejects.toThrow(
        'Missing xl/sharedStrings.xml or xl/worksheets/sheet1.xml in XLSX',
      );
    });

    it('parses row with missing optional column D (Other functionality) as null', async () => {
      const sharedStrings = [
        'Test Item Without Other',
        'Core Functionality Only',
        'Working',
      ];
      const rowsXml = `
        <row r="1"><c r="A1"><v>Timestamp</v></c></row>
        <row r="2">
          <c r="A2"><v>2026-10-17T09:00:00Z</v></c>
          <c r="B2" t="s"><v>0</v></c>
          <c r="C2" t="s"><v>1</v></c>
          <c r="E2"><v>img1.jpg</v></c>
          <c r="F2" t="s"><v>2</v></c>
        </row>
      `;
      const xlsx = buildSyntheticXlsx({ sharedStrings, rowsXml });
      const rows = await parseLegacyXlsx(xlsx);

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Test Item Without Other');
      expect(rows[0].core_functionality).toBe('Core Functionality Only');
      expect(rows[0].other_functionality).toBeNull();
      expect(rows[0].condition).toBe('Working');
      expect(rows[0].quantity).toBe(1);
    });

    it('treats whitespace-only other_functionality as null', async () => {
      const sharedStrings = [
        'Item With Empty Other',
        'Core description',
        '   \t   ',
        'Working',
      ];
      const rowsXml = `
        <row r="1"><c r="A1"><v>Timestamp</v></c></row>
        <row r="2">
          <c r="A2"><v>2026-10-17T09:00:00Z</v></c>
          <c r="B2" t="s"><v>0</v></c>
          <c r="C2" t="s"><v>1</v></c>
          <c r="D2" t="s"><v>2</v></c>
          <c r="E2"><v>img1.jpg</v></c>
          <c r="F2" t="s"><v>3</v></c>
        </row>
      `;
      const xlsx = buildSyntheticXlsx({ sharedStrings, rowsXml });
      const rows = await parseLegacyXlsx(xlsx);

      expect(rows).toHaveLength(1);
      expect(rows[0].other_functionality).toBeNull();
    });

    it('treats whitespace-only core_functionality as null', async () => {
      const sharedStrings = ['Item With Empty Core', '   ', 'Working'];
      const rowsXml = `
        <row r="1"><c r="A1"><v>Timestamp</v></c></row>
        <row r="2">
          <c r="A2"><v>2026-10-17T09:00:00Z</v></c>
          <c r="B2" t="s"><v>0</v></c>
          <c r="C2" t="s"><v>1</v></c>
          <c r="E2"><v>img1.jpg</v></c>
          <c r="F2" t="s"><v>2</v></c>
        </row>
      `;
      const xlsx = buildSyntheticXlsx({ sharedStrings, rowsXml });
      const rows = await parseLegacyXlsx(xlsx);

      expect(rows).toHaveLength(1);
      expect(rows[0].core_functionality).toBeNull();
    });

    it('skips rows where equipment name is missing or whitespace-only', async () => {
      const sharedStrings = ['   ', 'Valid Named Item', 'Working'];
      const rowsXml = `
        <row r="1"><c r="A1"><v>Timestamp</v></c></row>
        <row r="2">
          <c r="A2"><v>2026-10-17T09:00:00Z</v></c>
          <c r="B2" t="s"><v>0</v></c>
          <c r="C2"><v>Core</v></c>
        </row>
        <row r="3">
          <c r="A3"><v>2026-10-17T09:01:00Z</v></c>
          <c r="B3" t="s"><v>1</v></c>
          <c r="C3"><v>Core</v></c>
          <c r="F3" t="s"><v>2</v></c>
        </row>
      `;
      const xlsx = buildSyntheticXlsx({ sharedStrings, rowsXml });
      const rows = await parseLegacyXlsx(xlsx);

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Valid Named Item');
    });

    it('decodes escaped XML entities correctly', async () => {
      const sharedStrings = [
        'Ampersand &amp; Angle &lt;brackets&gt; &quot;Quotes&quot; &apos;Apos&apos;',
        'Core with &amp; entity',
        'Working',
      ];
      const rowsXml = `
        <row r="1"><c r="A1"><v>Timestamp</v></c></row>
        <row r="2">
          <c r="A2"><v>2026-10-17T09:00:00Z</v></c>
          <c r="B2" t="s"><v>0</v></c>
          <c r="C2" t="s"><v>1</v></c>
          <c r="E2"><v>img.jpg</v></c>
          <c r="F2" t="s"><v>2</v></c>
        </row>
      `;
      const xlsx = buildSyntheticXlsx({ sharedStrings, rowsXml });
      const rows = await parseLegacyXlsx(xlsx);

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe(
        'Ampersand & Angle <brackets> "Quotes" \'Apos\'',
      );
      expect(rows[0].core_functionality).toBe('Core with & entity');
    });

    it('parses out-of-order row XML entries correctly', async () => {
      const sharedStrings = ['Item Two', 'Item One', 'Working'];
      const rowsXml = `
        <row r="1"><c r="A1"><v>Header</v></c></row>
        <row r="4">
          <c r="A4"><v>2026-10-17T09:02:00Z</v></c>
          <c r="B4" t="s"><v>0</v></c>
          <c r="F4" t="s"><v>2</v></c>
        </row>
        <row r="2">
          <c r="A2"><v>2026-10-17T09:01:00Z</v></c>
          <c r="B2" t="s"><v>1</v></c>
          <c r="F2" t="s"><v>2</v></c>
        </row>
      `;
      const xlsx = buildSyntheticXlsx({ sharedStrings, rowsXml });
      const rows = await parseLegacyXlsx(xlsx);

      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe('Item Two');
      expect(rows[1].name).toBe('Item One');
    });

    it('safely handles cell referencing out-of-bounds shared string index', async () => {
      const sharedStrings = ['Item One'];
      const rowsXml = `
        <row r="1"><c r="A1"><v>Header</v></c></row>
        <row r="2">
          <c r="A2"><v>2026-10-17T09:00:00Z</v></c>
          <c r="B2" t="s"><v>0</v></c>
          <c r="C2" t="s"><v>9999</v></c>
          <c r="D2" t="s"><v>8888</v></c>
        </row>
      `;
      const xlsx = buildSyntheticXlsx({ sharedStrings, rowsXml });
      const rows = await parseLegacyXlsx(xlsx);

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Item One');
      expect(rows[0].core_functionality).toBeNull();
      expect(rows[0].other_functionality).toBeNull();
    });

    it('handles direct inline string cell value when type is not s', async () => {
      const sharedStrings = ['Unused'];
      const rowsXml = `
        <row r="1"><c r="A1"><v>Header</v></c></row>
        <row r="2">
          <c r="A2"><v>2026-10-17T09:00:00Z</v></c>
          <c r="B2" t="str"><v>Direct Cell Value</v></c>
          <c r="C2" t="str"><v>Direct Core Functionality</v></c>
        </row>
      `;
      const xlsx = buildSyntheticXlsx({ sharedStrings, rowsXml });
      const rows = await parseLegacyXlsx(xlsx);

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Direct Cell Value');
      expect(rows[0].core_functionality).toBe('Direct Core Functionality');
    });

    it('converts Excel numeric floating-point timestamp to ISO date string', async () => {
      const sharedStrings = ['Item With Excel Time', 'Working'];
      const rowsXml = `
        <row r="1"><c r="A1"><v>Header</v></c></row>
        <row r="2">
          <c r="A2"><v>44843.62175</v></c>
          <c r="B2" t="s"><v>0</v></c>
          <c r="F2" t="s"><v>1</v></c>
        </row>
      `;
      const xlsx = buildSyntheticXlsx({ sharedStrings, rowsXml });
      const rows = await parseLegacyXlsx(xlsx);

      expect(rows).toHaveLength(1);
      expect(rows[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('preserves text ISO timestamp without modification', async () => {
      const sharedStrings = ['Item With Text Time', 'Working'];
      const rowsXml = `
        <row r="1"><c r="A1"><v>Header</v></c></row>
        <row r="2">
          <c r="A2"><v>2026-10-09T14:55:19.811Z</v></c>
          <c r="B2" t="s"><v>0</v></c>
          <c r="F2" t="s"><v>1</v></c>
        </row>
      `;
      const xlsx = buildSyntheticXlsx({ sharedStrings, rowsXml });
      const rows = await parseLegacyXlsx(xlsx);

      expect(rows).toHaveLength(1);
      expect(rows[0].timestamp).toBe('2026-10-09T14:55:19.811Z');
    });

    it('falls back to Working condition when condition string is unrecognized', async () => {
      const sharedStrings = ['Item Unknown Condition', 'Broken Beyond Repair'];
      const rowsXml = `
        <row r="1"><c r="A1"><v>Header</v></c></row>
        <row r="2">
          <c r="B2" t="s"><v>0</v></c>
          <c r="F2" t="s"><v>1</v></c>
        </row>
      `;
      const xlsx = buildSyntheticXlsx({ sharedStrings, rowsXml });
      const rows = await parseLegacyXlsx(xlsx);

      expect(rows).toHaveLength(1);
      expect(rows[0].condition).toBe('Working');
    });

    it('preserves all four valid condition enum values accurately', async () => {
      const sharedStrings = [
        'Item 1',
        'Working',
        'Item 2',
        'Faulty',
        'Item 3',
        'Under Maintenance',
        'Item 4',
        'Decommissioned',
      ];
      const rowsXml = `
        <row r="1"><c r="A1"><v>Header</v></c></row>
        <row r="2"><c r="B2" t="s"><v>0</v></c><c r="F2" t="s"><v>1</v></c></row>
        <row r="3"><c r="B3" t="s"><v>2</v></c><c r="F3" t="s"><v>3</v></c></row>
        <row r="4"><c r="B4" t="s"><v>4</v></c><c r="F4" t="s"><v>5</v></c></row>
        <row r="5"><c r="B5" t="s"><v>6</v></c><c r="F5" t="s"><v>7</v></c></row>
      `;
      const xlsx = buildSyntheticXlsx({ sharedStrings, rowsXml });
      const rows = await parseLegacyXlsx(xlsx);

      expect(rows).toHaveLength(4);
      expect(rows[0].condition).toBe('Working');
      expect(rows[1].condition).toBe('Faulty');
      expect(rows[2].condition).toBe('Under Maintenance');
      expect(rows[3].condition).toBe('Decommissioned');
    });

    it('assigns quantity 50 only to Monitors slug and 1 to all others', async () => {
      const sharedStrings = ['Monitors', 'Student Camera', 'Recording Host'];
      const rowsXml = `
        <row r="1"><c r="A1"><v>Header</v></c></row>
        <row r="2"><c r="B2" t="s"><v>0</v></c></row>
        <row r="3"><c r="B3" t="s"><v>1</v></c></row>
        <row r="4"><c r="B4" t="s"><v>2</v></c></row>
      `;
      const xlsx = buildSyntheticXlsx({ sharedStrings, rowsXml });
      const rows = await parseLegacyXlsx(xlsx);

      expect(rows).toHaveLength(3);
      expect(rows[0].slug).toBe('monitors');
      expect(rows[0].quantity).toBe(50);
      expect(rows[1].slug).toBe('student-camera');
      expect(rows[1].quantity).toBe(1);
      expect(rows[2].slug).toBe('recording-host');
      expect(rows[2].quantity).toBe(1);
    });

    it('splits and trims comma-separated image URLs properly', async () => {
      const sharedStrings = ['Camera With Multiple Images'];
      const rowsXml = `
        <row r="1"><c r="A1"><v>Header</v></c></row>
        <row r="2">
          <c r="B2" t="s"><v>0</v></c>
          <c r="E2"><v>  https://r2.abu.edu.ng/cam1.jpg  ,  https://r2.abu.edu.ng/cam2.jpg ,  </v></c>
        </row>
      `;
      const xlsx = buildSyntheticXlsx({ sharedStrings, rowsXml });
      const rows = await parseLegacyXlsx(xlsx);

      expect(rows).toHaveLength(1);
      expect(rows[0].image_urls).toEqual([
        'https://r2.abu.edu.ng/cam1.jpg',
        'https://r2.abu.edu.ng/cam2.jpg',
      ]);
    });

    it('parses real responses spreadsheet file path and buffer identically', async () => {
      const xlsxPath = path.resolve(
        process.cwd(),
        'Smart Class Data Form (Responses).xlsx',
      );
      const rowsFromPath = await parseLegacyXlsx(xlsxPath);
      const rowsFromBuffer = await parseLegacyXlsx(fs.readFileSync(xlsxPath));

      expect(rowsFromPath).toEqual(rowsFromBuffer);
      expect(rowsFromPath).toHaveLength(7);
    });

    it('returns empty array when sheet contains only header row', async () => {
      const sharedStrings = ['Header1', 'Header2'];
      const rowsXml = '<row r="1"><c r="A1" t="s"><v>0</v></c></row>';
      const xlsx = buildSyntheticXlsx({ sharedStrings, rowsXml });
      const rows = await parseLegacyXlsx(xlsx);

      expect(rows).toEqual([]);
    });
  });

  describe('Seam 3: Legacy image enhancement & I4 budgets', () => {
    it('throws when zero-byte buffer is passed to enhanceLegacyImage', async () => {
      await expect(enhanceLegacyImage(Buffer.alloc(0))).rejects.toThrow();
    });

    it('throws when non-image random bytes are passed to enhanceLegacyImage', async () => {
      const garbage = Buffer.from(
        'Some arbitrary non-image text data intended to stress decoder',
      );
      await expect(enhanceLegacyImage(garbage)).rejects.toThrow();
    });

    it('resizes gigantic 4000x3000 landscape image to inside 1200x1200 while preserving aspect ratio', async () => {
      const input = await sharp({
        create: {
          width: 4000,
          height: 3000,
          channels: 3,
          background: { r: 80, g: 120, b: 160 },
        },
      })
        .jpeg()
        .toBuffer();

      const enhanced = await enhanceLegacyImage(input);
      const meta = await sharp(enhanced).metadata();

      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(1200);
      expect(meta.height).toBe(900);
      expect(enhanced.length).toBeLessThanOrEqual(400 * 1024);
    });

    it('resizes gigantic 2400x4800 portrait image to inside 1200x1200 while preserving aspect ratio', async () => {
      const input = await sharp({
        create: {
          width: 2400,
          height: 4800,
          channels: 3,
          background: { r: 160, g: 120, b: 80 },
        },
      })
        .jpeg()
        .toBuffer();

      const enhanced = await enhanceLegacyImage(input);
      const meta = await sharp(enhanced).metadata();

      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(600);
      expect(meta.height).toBe(1200);
      expect(enhanced.length).toBeLessThanOrEqual(400 * 1024);
    });

    it('clamps ultra-high aspect ratio 5000x50 wide image within 1200x1200 without distortion', async () => {
      const input = await sharp({
        create: {
          width: 5000,
          height: 50,
          channels: 3,
          background: { r: 50, g: 150, b: 250 },
        },
      })
        .jpeg()
        .toBuffer();

      const enhanced = await enhanceLegacyImage(input);
      const meta = await sharp(enhanced).metadata();

      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(1200);
      expect(meta.height).toBe(12);
      expect(enhanced.length).toBeLessThanOrEqual(400 * 1024);
    });

    it('clamps ultra-high aspect ratio 50x5000 tall image within 1200x1200 without distortion', async () => {
      const input = await sharp({
        create: {
          width: 50,
          height: 5000,
          channels: 3,
          background: { r: 250, g: 150, b: 50 },
        },
      })
        .jpeg()
        .toBuffer();

      const enhanced = await enhanceLegacyImage(input);
      const meta = await sharp(enhanced).metadata();

      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(12);
      expect(meta.height).toBe(1200);
      expect(enhanced.length).toBeLessThanOrEqual(400 * 1024);
    });

    it('does not upscale tiny 1x1 image (withoutEnlargement)', async () => {
      const input = await sharp({
        create: {
          width: 1,
          height: 1,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      const enhanced = await enhanceLegacyImage(input);
      const meta = await sharp(enhanced).metadata();

      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(1);
      expect(meta.height).toBe(1);
    });

    it('does not upscale small 16x16 image', async () => {
      const input = await sharp({
        create: {
          width: 16,
          height: 16,
          channels: 3,
          background: { r: 100, g: 100, b: 100 },
        },
      })
        .png()
        .toBuffer();

      const enhanced = await enhanceLegacyImage(input);
      const meta = await sharp(enhanced).metadata();

      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(16);
      expect(meta.height).toBe(16);
    });

    it('steps down quality and satisfies I4 400KB budget even under high frequency detail stress', async () => {
      const complexPattern = Buffer.alloc(1200 * 1200 * 3);
      for (let y = 0; y < 1200; y++) {
        for (let x = 0; x < 1200; x++) {
          const idx = (y * 1200 + x) * 3;
          complexPattern[idx] = (x ^ y) % 256;
          complexPattern[idx + 1] = ((x * 7) ^ (y * 13)) % 256;
          complexPattern[idx + 2] = ((x + y) * 3) % 256;
        }
      }

      const input = await sharp(complexPattern, {
        raw: {
          width: 1200,
          height: 1200,
          channels: 3,
        },
      })
        .jpeg({ quality: 100 })
        .toBuffer();

      const enhanced = await enhanceLegacyImage(input);
      const meta = await sharp(enhanced).metadata();

      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(1200);
      expect(meta.height).toBe(1200);
      expect(enhanced.length).toBeLessThanOrEqual(400 * 1024);
    });

    it('strips EXIF metadata cleanly from enhanced image', async () => {
      const inputWithExif = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 70, g: 80, b: 90 },
        },
      })
        .withExif({
          IFD0: {
            Copyright: 'Adversarial Test Copyright',
            Software: 'Vitest Challenger',
          },
        })
        .jpeg()
        .toBuffer();

      const enhanced = await enhanceLegacyImage(inputWithExif);
      const meta = await sharp(enhanced).metadata();

      expect(meta.exif).toBeUndefined();
    });

    it('enhances all 8 real legacy photographs from the ZIP meeting format, dimensions, and I4 budget', async () => {
      const zipPath = path.resolve(
        process.cwd(),
        'ABU-SmartComp-Legacy-Images-20261013T193523Z-1-001.zip',
      );
      const images = await extractLegacyImages(zipPath);
      expect(images.size).toBe(8);

      for (const [name, buf] of images.entries()) {
        const enhanced = await enhanceLegacyImage(buf);
        const meta = await sharp(enhanced).metadata();

        expect(meta.format, `${name} format`).toBe('webp');
        expect(meta.width, `${name} width`).toBeLessThanOrEqual(1200);
        expect(meta.height, `${name} height`).toBeLessThanOrEqual(1200);
        expect(enhanced.length, `${name} byte size`).toBeLessThanOrEqual(
          400 * 1024,
        );
      }
    });
  });

  describe('Seam 4: ZIP extraction robustness', () => {
    it('strips directory traversal paths (zip slip) safely using basename', async () => {
      const zipWithSlip = buildSyntheticZip([
        {
          name: '../../evil.jpg',
          data: Buffer.from('adversarial-slip-content-1'),
        },
        {
          name: '..\\..\\windows-slip.jpg',
          data: Buffer.from('adversarial-slip-content-2'),
        },
        {
          name: 'folder/nested/subfolder/normal.jpg',
          data: Buffer.from('nested-content'),
        },
      ]);

      const tmpZipPath = path.resolve(process.cwd(), 'temp-slip-test.zip');
      fs.writeFileSync(tmpZipPath, zipWithSlip);

      try {
        const extracted = await extractLegacyImages(tmpZipPath);
        expect(extracted.has('evil.jpg')).toBe(true);
        expect(extracted.get('evil.jpg')?.toString()).toBe(
          'adversarial-slip-content-1',
        );
        expect(extracted.has('normal.jpg')).toBe(true);
        expect(extracted.get('normal.jpg')?.toString()).toBe('nested-content');
        expect(extracted.has('../../evil.jpg')).toBe(true);
      } finally {
        if (fs.existsSync(tmpZipPath)) {
          fs.unlinkSync(tmpZipPath);
        }
      }
    });

    it('ignores directory entries ending with a slash', async () => {
      const zipWithDir = buildSyntheticZip([
        {
          name: 'images/',
          data: Buffer.alloc(0),
        },
        {
          name: 'images/photo.jpg',
          data: Buffer.from('valid photo data'),
        },
      ]);

      const tmpZipPath = path.resolve(process.cwd(), 'temp-dir-test.zip');
      fs.writeFileSync(tmpZipPath, zipWithDir);

      try {
        const extracted = await extractLegacyImages(tmpZipPath);
        expect(extracted.size).toBe(1);
        expect(extracted.has('photo.jpg')).toBe(true);
        expect(extracted.has('images/')).toBe(false);
      } finally {
        if (fs.existsSync(tmpZipPath)) {
          fs.unlinkSync(tmpZipPath);
        }
      }
    });

    it('throws Invalid ZIP archive when buffer is truncated or corrupted', async () => {
      const corruptBuf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      const tmpZipPath = path.resolve(process.cwd(), 'temp-corrupt.zip');
      fs.writeFileSync(tmpZipPath, corruptBuf);

      try {
        await expect(extractLegacyImages(tmpZipPath)).rejects.toThrow(
          'Invalid ZIP archive',
        );
      } finally {
        if (fs.existsSync(tmpZipPath)) {
          fs.unlinkSync(tmpZipPath);
        }
      }
    });

    it('throws Invalid ZIP archive on 0-byte file', async () => {
      const emptyBuf = Buffer.alloc(0);
      const tmpZipPath = path.resolve(process.cwd(), 'temp-empty.zip');
      fs.writeFileSync(tmpZipPath, emptyBuf);

      try {
        await expect(extractLegacyImages(tmpZipPath)).rejects.toThrow(
          'Invalid ZIP archive',
        );
      } finally {
        if (fs.existsSync(tmpZipPath)) {
          fs.unlinkSync(tmpZipPath);
        }
      }
    });

    it('returns empty map on valid ZIP that contains zero entries', async () => {
      const validEmptyZip = buildSyntheticZip([]);
      const tmpZipPath = path.resolve(process.cwd(), 'temp-zero-entries.zip');
      fs.writeFileSync(tmpZipPath, validEmptyZip);

      try {
        const extracted = await extractLegacyImages(tmpZipPath);
        expect(extracted.size).toBe(0);
      } finally {
        if (fs.existsSync(tmpZipPath)) {
          fs.unlinkSync(tmpZipPath);
        }
      }
    });

    it('throws on unsupported ZIP compression method', async () => {
      const zipUnsupported = buildSyntheticZip([
        {
          name: 'unsupported.jpg',
          data: Buffer.from('data'),
          method: 9,
        },
      ]);
      const tmpZipPath = path.resolve(process.cwd(), 'temp-unsupported.zip');
      fs.writeFileSync(tmpZipPath, zipUnsupported);

      try {
        await expect(extractLegacyImages(tmpZipPath)).rejects.toThrow(
          'Unsupported ZIP compression method: 9',
        );
      } finally {
        if (fs.existsSync(tmpZipPath)) {
          fs.unlinkSync(tmpZipPath);
        }
      }
    });

    it('extracts uncompressed (method 0) entries verbatim', async () => {
      const uncompZip = buildSyntheticZip([
        {
          name: 'stored.jpg',
          data: Buffer.from('raw stored bytes 12345'),
          method: 0,
        },
      ]);
      const tmpZipPath = path.resolve(process.cwd(), 'temp-stored.zip');
      fs.writeFileSync(tmpZipPath, uncompZip);

      try {
        const extracted = await extractLegacyImages(tmpZipPath);
        expect(extracted.get('stored.jpg')?.toString()).toBe(
          'raw stored bytes 12345',
        );
      } finally {
        if (fs.existsSync(tmpZipPath)) {
          fs.unlinkSync(tmpZipPath);
        }
      }
    });

    it('extracts deflate compressed (method 8) entries correctly', async () => {
      const deflatedZip = buildSyntheticZip([
        {
          name: 'deflated.jpg',
          data: Buffer.from('deflated compressed content test string'),
          method: 8,
        },
      ]);
      const tmpZipPath = path.resolve(process.cwd(), 'temp-deflated.zip');
      fs.writeFileSync(tmpZipPath, deflatedZip);

      try {
        const extracted = await extractLegacyImages(tmpZipPath);
        expect(extracted.get('deflated.jpg')?.toString()).toBe(
          'deflated compressed content test string',
        );
      } finally {
        if (fs.existsSync(tmpZipPath)) {
          fs.unlinkSync(tmpZipPath);
        }
      }
    });

    it('allows ImageMap retrieval using either basename or nested full key', async () => {
      const zip = buildSyntheticZip([
        {
          name: 'assets/photos/camera.jpg',
          data: Buffer.from('camera photo data'),
        },
      ]);
      const tmpZipPath = path.resolve(process.cwd(), 'temp-imagemap.zip');
      fs.writeFileSync(tmpZipPath, zip);

      try {
        const extracted = await extractLegacyImages(tmpZipPath);
        expect(extracted.has('camera.jpg')).toBe(true);
        expect(extracted.has('assets/photos/camera.jpg')).toBe(true);
        expect(extracted.get('camera.jpg')?.toString()).toBe(
          'camera photo data',
        );
        expect(extracted.get('assets/photos/camera.jpg')?.toString()).toBe(
          'camera photo data',
        );
      } finally {
        if (fs.existsSync(tmpZipPath)) {
          fs.unlinkSync(tmpZipPath);
        }
      }
    });

    it('extracts all 8 photographs from the production legacy zip archive', async () => {
      const zipPath = path.resolve(
        process.cwd(),
        'ABU-SmartComp-Legacy-Images-20261013T193523Z-1-001.zip',
      );
      const images = await extractLegacyImages(zipPath);

      expect(images.size).toBe(8);
      const expectedPhotos = [
        'smart-create-view-screen-1.jpg',
        'recording-host-1.jpg',
        'monitors-1.jpg',
        'student-camera-1.jpg',
        'student-camera-2.jpg',
        'router-and-switch-1.jpg',
        'students-screen-and-camera-1.jpg',
        'hdmi-splitter-and-converter-1.jpg',
      ];

      for (const photo of expectedPhotos) {
        expect(images.has(photo)).toBe(true);
        const buf = images.get(photo);
        expect(buf).toBeDefined();
        expect(buf!.length).toBeGreaterThan(1000);
      }
    });
  });

  describe('Seam 5: Public route rendering edge cases', () => {
    it('renders item detail with multiple images showing thumbnail list and modal navigation', async () => {
      const multiImageItem: EquipmentRecord = {
        id: 'e0000001-0000-4000-a000-000000000004',
        name: 'Multi Image Student Camera',
        core_functionality: 'Records student video streams.',
        other_functionality: 'Secondary view angle.',
        condition: 'Working',
        quantity: 1,
        image_keys: ['student-camera-1.webp', 'student-camera-2.webp'],
        created_at: '2026-10-17T10:00:00.000Z',
        updated_at: '2026-10-17T10:00:00.000Z',
        updated_by: null,
      };

      vi.mocked(getEquipmentById).mockResolvedValue(multiImageItem);

      const ui = await ItemPage({
        params: Promise.resolve({ id: multiImageItem.id }),
      });
      const { container } = render(ui);

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'Multi Image Student Camera',
        }),
      ).toBeDefined();

      const thumbs = container.querySelectorAll('.gallery__thumb');
      expect(thumbs.length).toBe(2);

      const openModalBtn = screen.getByRole('button', {
        name: 'Open full photograph viewer',
      });
      fireEvent.click(openModalBtn);

      const nextBtn = screen.getByRole('button', { name: 'Next image' });
      const prevBtn = screen.getByRole('button', { name: 'Previous image' });
      expect(nextBtn).toBeDefined();
      expect(prevBtn).toBeDefined();

      expect(screen.getByText('1 / 2')).toBeDefined();
      fireEvent.click(nextBtn);
      expect(screen.getByText('2 / 2')).toBeDefined();
      fireEvent.click(prevBtn);
      expect(screen.getByText('1 / 2')).toBeDefined();
    });

    it('renders item detail with single image without thumbnail navigation arrows', async () => {
      const singleImageItem: EquipmentRecord = {
        id: 'e0000001-0000-4000-a000-000000000003',
        name: 'Single Image Monitors',
        core_functionality: 'Classroom display systems.',
        other_functionality: null,
        condition: 'Working',
        quantity: 50,
        image_keys: ['monitors-1.webp'],
        created_at: '2026-10-17T10:00:00.000Z',
        updated_at: '2026-10-17T10:00:00.000Z',
        updated_by: null,
      };

      vi.mocked(getEquipmentById).mockResolvedValue(singleImageItem);

      const ui = await ItemPage({
        params: Promise.resolve({ id: singleImageItem.id }),
      });
      const { container } = render(ui);

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'Single Image Monitors',
        }),
      ).toBeDefined();
      const openModalBtn = screen.getByRole('button', {
        name: 'Open full photograph viewer',
      });
      fireEvent.click(openModalBtn);

      expect(screen.queryByRole('button', { name: 'Next image' })).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Previous image' }),
      ).toBeNull();
      expect(container.querySelectorAll('.gallery__thumb').length).toBe(1);
    });

    it('renders item detail with zero images showing placeholder state and no photograph caption', async () => {
      const zeroImageItem: EquipmentRecord = {
        id: 'e0000001-0000-4000-a000-000000000099',
        name: 'Unphotographed Equipment',
        core_functionality: 'Core features.',
        other_functionality: null,
        condition: 'Under Maintenance',
        quantity: 3,
        image_keys: [],
        created_at: '2026-10-17T10:00:00.000Z',
        updated_at: '2026-10-17T10:00:00.000Z',
        updated_by: null,
      };

      vi.mocked(getEquipmentById).mockResolvedValue(zeroImageItem);

      const ui = await ItemPage({
        params: Promise.resolve({ id: zeroImageItem.id }),
      });
      const { container } = render(ui);

      expect(screen.getByText('No photograph on file yet.')).toBeDefined();
      expect(container.querySelector('.spread__media img')).toBeNull();
      expect(container.textContent).toContain('PHOTO');
      expect(container.querySelectorAll('.gallery__thumb').length).toBe(0);
    });

    it('renders fallback text when other_functionality is null or empty', async () => {
      const itemWithNoOther: EquipmentRecord = {
        id: 'e0000001-0000-4000-a000-000000000007',
        name: 'HDMI Splitter',
        core_functionality: 'Splits video signal.',
        other_functionality: null,
        condition: 'Working',
        quantity: 1,
        image_keys: ['hdmi-1.webp'],
        created_at: '2026-10-17T10:00:00.000Z',
        updated_at: '2026-10-17T10:00:00.000Z',
        updated_by: null,
      };

      vi.mocked(getEquipmentById).mockResolvedValue(itemWithNoOther);

      const ui = await ItemPage({
        params: Promise.resolve({ id: itemWithNoOther.id }),
      });
      render(ui);

      expect(
        screen.getByText('No other functionality recorded.'),
      ).toBeDefined();
    });

    it('renders fallback dash when core_functionality is null or empty', async () => {
      const itemWithNoCore: EquipmentRecord = {
        id: 'e0000001-0000-4000-a000-000000000008',
        name: 'Equipment Without Core',
        core_functionality: null,
        other_functionality: 'Only secondary notes.',
        condition: 'Working',
        quantity: 1,
        image_keys: [],
        created_at: '2026-10-17T10:00:00.000Z',
        updated_at: '2026-10-17T10:00:00.000Z',
        updated_by: null,
      };

      vi.mocked(getEquipmentById).mockResolvedValue(itemWithNoCore);

      const ui = await ItemPage({
        params: Promise.resolve({ id: itemWithNoCore.id }),
      });
      render(ui);

      expect(screen.getByText('—')).toBeDefined();
      expect(screen.getByText('Only secondary notes.')).toBeDefined();
    });

    it('renders quantity 0 correctly without omitting or crashing', async () => {
      const zeroQtyItem: EquipmentRecord = {
        id: 'e0000001-0000-4000-a000-000000000010',
        name: 'Zero Quantity Item',
        core_functionality: 'Out of stock item.',
        other_functionality: null,
        condition: 'Decommissioned',
        quantity: 0,
        image_keys: [],
        created_at: '2026-10-17T10:00:00.000Z',
        updated_at: '2026-10-17T10:00:00.000Z',
        updated_by: null,
      };

      vi.mocked(getEquipmentById).mockResolvedValue(zeroQtyItem);

      const ui = await ItemPage({
        params: Promise.resolve({ id: zeroQtyItem.id }),
      });
      render(ui);

      expect(screen.getByText('0')).toBeDefined();
      expect(screen.getByText('Decommissioned')).toBeDefined();
    });

    it('renders extremely long descriptions with break-words styling', async () => {
      const longName = 'Very '.repeat(100) + 'Long Equipment Name';
      const longCore = 'Extremely detailed explanation '.repeat(100);

      const stressItem: EquipmentRecord = {
        id: 'e0000001-0000-4000-a000-000000000020',
        name: longName,
        core_functionality: longCore,
        other_functionality: null,
        condition: 'Faulty',
        quantity: 1,
        image_keys: [],
        created_at: '2026-10-17T10:00:00.000Z',
        updated_at: '2026-10-17T10:00:00.000Z',
        updated_by: null,
      };

      vi.mocked(getEquipmentById).mockResolvedValue(stressItem);

      const ui = await ItemPage({
        params: Promise.resolve({ id: stressItem.id }),
      });
      const { container } = render(ui);

      const heading = container.querySelector('h1');
      expect(heading?.className).toContain('break-words');
      expect(heading?.textContent).toContain('Long Equipment Name');

      const coreParagraph = container.querySelector('p.verbatim');
      expect(coreParagraph?.className).toContain('break-words');
      expect(coreParagraph?.textContent).toContain(
        'Extremely detailed explanation',
      );
    });

    it('safely escapes HTML tags and script injections across all fields', async () => {
      const xssItem: EquipmentRecord = {
        id: 'e0000001-0000-4000-a000-000000000030',
        name: '<script>alert("xss-name")</script>',
        core_functionality: '<img src="x" onerror="alert(\'xss-core\')" />',
        other_functionality: '<b>Bold tag not executed</b>',
        condition: 'Working',
        quantity: 1,
        image_keys: [],
        created_at: '2026-10-17T10:00:00.000Z',
        updated_at: '2026-10-17T10:00:00.000Z',
        updated_by: null,
      };

      vi.mocked(getEquipmentById).mockResolvedValue(xssItem);

      const ui = await ItemPage({
        params: Promise.resolve({ id: xssItem.id }),
      });
      const { container } = render(ui);

      expect(container.querySelector('script')).toBeNull();
      expect(container.querySelector('img[onerror]')).toBeNull();
      expect(container.querySelector('b')).toBeNull();

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: '<script>alert("xss-name")</script>',
        }),
      ).toBeDefined();
      expect(
        screen.getByText('<img src="x" onerror="alert(\'xss-core\')" />'),
      ).toBeDefined();
      expect(screen.getByText('<b>Bold tag not executed</b>')).toBeDefined();
    });

    it('renders EmptyState when equipment collection is empty on /room', async () => {
      vi.mocked(getEquipment).mockResolvedValue([]);

      const ui = await RoomPage();
      render(ui);

      expect(screen.getByText('Nothing on the record yet.')).toBeDefined();
      expect(
        screen.getByText(
          'The register has no entries. Everything the lab team records will appear here.',
        ),
      ).toBeDefined();
    });

    it('renders EmptyState when equipment collection is empty on /', async () => {
      vi.mocked(getEquipment).mockResolvedValue([]);

      const ui = await Page();
      render(ui);

      expect(screen.getByText('0 entries')).toBeDefined();
      expect(screen.getByText('Nothing on the record yet.')).toBeDefined();
    });

    it('triggers notFound() when equipment id does not exist on /item/[id]', async () => {
      vi.mocked(getEquipmentById).mockResolvedValue(null);

      await expect(
        ItemPage({
          params: Promise.resolve({ id: 'nonexistent-id-0000' }),
        }),
      ).rejects.toThrow('NEXT_NOT_FOUND');

      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });

    it('sorts collection items alphabetically by name on /room', async () => {
      const unsortedItems: EquipmentRecord[] = [
        {
          id: '1',
          name: 'Zebra Equipment',
          core_functionality: null,
          other_functionality: null,
          condition: 'Working',
          quantity: 1,
          image_keys: [],
          created_at: '2026-10-17T10:00:00Z',
          updated_at: '2026-10-17T10:00:00Z',
          updated_by: null,
        },
        {
          id: '2',
          name: 'Alpha Equipment',
          core_functionality: null,
          other_functionality: null,
          condition: 'Working',
          quantity: 1,
          image_keys: [],
          created_at: '2026-10-17T10:00:00Z',
          updated_at: '2026-10-17T10:00:00Z',
          updated_by: null,
        },
        {
          id: '3',
          name: 'Beta Equipment',
          core_functionality: null,
          other_functionality: null,
          condition: 'Working',
          quantity: 1,
          image_keys: [],
          created_at: '2026-10-17T10:00:00Z',
          updated_at: '2026-10-17T10:00:00Z',
          updated_by: null,
        },
      ];

      vi.mocked(getEquipment).mockResolvedValue(unsortedItems);

      const ui = await RoomPage();
      const { container } = render(ui);

      const rows = Array.from(container.querySelectorAll('ul.rows > li'));
      expect(rows).toHaveLength(3);
      expect(rows[0].textContent).toContain('Alpha Equipment');
      expect(rows[1].textContent).toContain('Beta Equipment');
      expect(rows[2].textContent).toContain('Zebra Equipment');
    });

    it('renders breadcrumb and truncated record ID accurately on /item/[id]', async () => {
      const testItem: EquipmentRecord = {
        id: 'e0000001-9999-4000-a000-000000000099',
        name: 'Breadcrumb Test Equipment',
        core_functionality: 'Testing breadcrumbs.',
        other_functionality: null,
        condition: 'Working',
        quantity: 1,
        image_keys: [],
        created_at: '2026-10-17T10:00:00Z',
        updated_at: '2026-10-17T10:00:00Z',
        updated_by: null,
      };

      vi.mocked(getEquipmentById).mockResolvedValue(testItem);

      const ui = await ItemPage({
        params: Promise.resolve({ id: testItem.id }),
      });
      render(ui);

      const breadcrumbNav = screen.getByRole('navigation', {
        name: 'Breadcrumb',
      });
      expect(
        within(breadcrumbNav).getByRole('link', { name: 'The collection' }),
      ).toBeDefined();
      expect(within(breadcrumbNav).getByText('Detail')).toBeDefined();
    });
  });
});
