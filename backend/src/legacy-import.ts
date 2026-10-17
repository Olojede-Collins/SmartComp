import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { db, type EquipmentCondition, type EquipmentRecord } from './db.js';
import { storage } from './storage.js';

export interface LegacyRow {
  timestamp: string;
  name: string;
  core_functionality: string | null;
  other_functionality: string | null;
  condition: EquipmentCondition;
  quantity: number;
  image_urls: string[];
  slug: string;
}

const SLUG_TO_ID: Record<string, string> = {
  'smart-create-view-screen': 'e0000001-0000-4000-a000-000000000001',
  'recording-host': 'e0000001-0000-4000-a000-000000000002',
  monitors: 'e0000001-0000-4000-a000-000000000003',
  'student-camera': 'e0000001-0000-4000-a000-000000000004',
  'router-and-switch': 'e0000001-0000-4000-a000-000000000005',
  'students-screen-and-camera': 'e0000001-0000-4000-a000-000000000006',
  'hdmi-splitter-and-converter': 'e0000001-0000-4000-a000-000000000007',
};

export const LEGACY_EQUIPMENT_RECORDS: EquipmentRecord[] = [
  {
    id: 'e0000001-0000-4000-a000-000000000001',
    name: 'Smart Create view Screen',
    core_functionality:
      'Interactive digital podium and central multi-touch display screen serving as the primary visual medium for lectures, digital whiteboarding, and hybrid teleconferencing. Features integrated computing architecture capable of running local technical applications, digital annotation suites, and real-time remote presentations.',
    other_functionality:
      'Supports multi-point finger and stylus touch input, integrated wireless screen casting, and dynamic digital whiteboard recording for subsequent lecture distribution.',
    condition: 'Working',
    quantity: 1,
    image_keys: ['smart-create-view-screen-1.webp'],
    created_at: '2026-10-09T14:55:19.811Z',
    updated_at: '2026-10-09T14:55:19.811Z',
    updated_by: null,
  },
  {
    id: 'e0000001-0000-4000-a000-000000000002',
    name: 'Recording Host',
    core_functionality:
      'Dedicated rack-mounted multimedia lecture capture and video management server. Ingests synchronized high-definition video, slide presentations, and multi-channel audio feeds directly from smart podiums and room cameras for automated processing and local archival.',
    other_functionality:
      'Enables automated recording, time-synchronized slide-to-audio encoding, and local network streaming for remote asynchronous learning and archival review.',
    condition: 'Working',
    quantity: 1,
    image_keys: ['recording-host-1.webp'],
    created_at: '2026-10-09T15:01:52.381Z',
    updated_at: '2026-10-09T15:01:52.381Z',
    updated_by: null,
  },
  {
    id: 'e0000001-0000-4000-a000-000000000003',
    name: 'Monitors',
    core_functionality:
      'High-definition workstation displays deployed across all 50 laboratory student seats, networked into the smart classroom laboratory cluster to facilitate individual hands-on programming, circuit simulation, and interactive laboratory exercises.',
    other_functionality:
      'Integrates with central broadcast feeds to allow students to switch between local computational workstations and real-time instructional demonstrations.',
    condition: 'Working',
    quantity: 50,
    image_keys: ['monitors-1.webp'],
    created_at: '2026-10-09T15:04:58.527Z',
    updated_at: '2026-10-09T15:04:58.527Z',
    updated_by: null,
  },
  {
    id: 'e0000001-0000-4000-a000-000000000004',
    name: 'Student Camera',
    core_functionality:
      'High-definition wide-angle pan-tilt-zoom (PTZ) student-facing monitoring and telepresence camera. Captures laboratory student seating rows and streams live video feeds to the instructor feedback monitor and remote lecture sessions.',
    other_functionality:
      'Aids laboratory instructors in monitoring student engagement and facilitating interactive question-and-answer sessions during hybrid and distributed class proceedings.',
    condition: 'Working',
    quantity: 1,
    image_keys: ['student-camera-1.webp', 'student-camera-2.webp'],
    created_at: '2026-10-09T15:10:18.180Z',
    updated_at: '2026-10-09T15:10:18.180Z',
    updated_by: null,
  },
  {
    id: 'e0000001-0000-4000-a000-000000000005',
    name: 'Router and switch',
    core_functionality:
      'Enterprise gigabit network distribution rack consisting of a managed layer-2/3 network switch and dedicated routing gateway. Supplies isolated, high-bandwidth wired ethernet connectivity to student workstations and high-speed Wi-Fi across the facility.',
    other_functionality:
      'Manages VLAN segmentation for laboratory traffic, maintains dedicated Quality-of-Service (QoS) for live video capture streaming, and provides gateway security to institutional backbones.',
    condition: 'Working',
    quantity: 1,
    image_keys: ['router-and-switch-1.webp'],
    created_at: '2026-10-09T15:13:24.371Z',
    updated_at: '2026-10-09T15:13:24.371Z',
    updated_by: null,
  },
  {
    id: 'e0000001-0000-4000-a000-000000000006',
    name: 'Students screen and camera',
    core_functionality:
      'Auxiliary high-definition repeater display and integrated audience telepresence module mounted mid-hall. Mirrors primary instruction displays so students seated further back maintain clear, uncompromised sightlines of detailed technical slides and code demonstrations.',
    other_functionality:
      'Features supplementary ambient microphone and wide-lens camera integration to support distributed classroom discussion and mid-auditorium student participation.',
    condition: 'Working',
    quantity: 1,
    image_keys: ['students-screen-and-camera-1.webp'],
    created_at: '2026-10-09T15:15:54.655Z',
    updated_at: '2026-10-09T15:15:54.655Z',
    updated_by: null,
  },
  {
    id: 'e0000001-0000-4000-a000-000000000007',
    name: 'HDMI splitter and converter',
    core_functionality:
      'Hardware audiovisual matrix splitter and signal converter unit. Distributes uncompressed, low-latency HDMI digital video and audio signals from the main lectern simultaneously across multiple classroom repeaters, student monitors, and capture hosts.',
    other_functionality:
      'Performs active signal amplification and format handshaking (EDID management) across extended cable runs to eliminate video dropouts and display artifacts during laboratory sessions.',
    condition: 'Working',
    quantity: 1,
    image_keys: ['hdmi-splitter-and-converter-1.webp'],
    created_at: '2026-10-09T15:18:41.238Z',
    updated_at: '2026-10-09T15:18:41.238Z',
    updated_by: null,
  },
];

export function deriveSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function decodeXml(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function readZipArchive(buf: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) {
    throw new Error('Invalid ZIP archive');
  }

  const totalEntries = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  let p = cdOffset;
  const files = new Map<string, Buffer>();

  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) {
      break;
    }
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);
    const filename = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');

    if (!filename.endsWith('/')) {
      const locNameLen = buf.readUInt16LE(localHeaderOffset + 26);
      const locExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + locNameLen + locExtraLen;
      const compData = buf.subarray(dataOffset, dataOffset + compSize);
      let uncompData: Buffer;
      if (method === 0) {
        uncompData = compData;
      } else if (method === 8) {
        uncompData = zlib.inflateRawSync(compData);
      } else {
        throw new Error(`Unsupported ZIP compression method: ${method}`);
      }
      files.set(filename, uncompData);
    }

    p += 46 + nameLen + extraLen + commentLen;
  }

  return files;
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siMatches = xml.matchAll(/<si>(.*?)<\/si>/gs);
  for (const match of siMatches) {
    const inner = match[1];
    const tMatches = inner.matchAll(/<t(?:\s+[^>]*)?>(.*?)<\/t>/gs);
    let str = '';
    for (const t of tMatches) {
      str += t[1];
    }
    strings.push(decodeXml(str));
  }
  return strings;
}

function parseSheetRows(
  xml: string,
  sharedStrings: string[],
): Array<Record<string, string | null>> {
  const rows: Array<Record<string, string | null>> = [];
  const rowMatches = xml.matchAll(/<row\s+r="(\d+)"[^>]*>(.*?)<\/row>/gs);
  for (const rMatch of rowMatches) {
    const rowNum = parseInt(rMatch[1], 10);
    if (rowNum === 1) {
      continue;
    }
    const rowContent = rMatch[2];
    const cellMatches = rowContent.matchAll(
      /<c\s+r="([A-Z]+)\d+"(?:\s+s="\d+")?(?:\s+t="([^"]+)")?[^>]*>(?:<v>(.*?)<\/v>)?<\/c>/gs,
    );
    const cells: Record<string, string | null> = {};
    for (const cMatch of cellMatches) {
      const col = cMatch[1];
      const type = cMatch[2];
      const val = cMatch[3];
      if (type === 's' && val !== undefined) {
        cells[col] = sharedStrings[parseInt(val, 10)] ?? null;
      } else if (val !== undefined) {
        cells[col] = decodeXml(val);
      } else {
        cells[col] = null;
      }
    }
    rows.push(cells);
  }
  return rows;
}

export async function parseLegacyXlsx(
  xlsxBufferOrPath: string | Buffer = path.resolve(
    process.cwd(),
    'Smart Class Data Form (Responses).xlsx',
  ),
): Promise<LegacyRow[]> {
  const buf = Buffer.isBuffer(xlsxBufferOrPath)
    ? xlsxBufferOrPath
    : fs.readFileSync(
        path.isAbsolute(xlsxBufferOrPath)
          ? xlsxBufferOrPath
          : path.resolve(process.cwd(), xlsxBufferOrPath),
      );

  const archive = readZipArchive(buf);
  const sharedXmlBuf = archive.get('xl/sharedStrings.xml');
  const sheetXmlBuf = archive.get('xl/worksheets/sheet1.xml');

  if (!sharedXmlBuf || !sheetXmlBuf) {
    throw new Error(
      'Missing xl/sharedStrings.xml or xl/worksheets/sheet1.xml in XLSX',
    );
  }

  const sharedStrings = parseSharedStrings(sharedXmlBuf.toString('utf8'));
  const rawRows = parseSheetRows(sheetXmlBuf.toString('utf8'), sharedStrings);

  const legacyRows: LegacyRow[] = [];

  for (const row of rawRows) {
    const rawTs = row['A'];
    let timestamp = '';
    if (rawTs) {
      const num = parseFloat(rawTs);
      if (!Number.isNaN(num) && num > 20000 && num < 100000) {
        timestamp = new Date((num - 25569) * 86400 * 1000).toISOString();
      } else {
        timestamp = rawTs;
      }
    }

    const rawName = row['B'] ?? '';
    const cleanName = rawName.trim();
    if (!cleanName) {
      continue;
    }

    const slug = deriveSlug(cleanName);
    const core = row['C']?.trim() || null;
    const other = row['D']?.trim() || null;
    const rawImgs = row['E'] ?? '';
    const imageUrls = rawImgs
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);

    const rawState = row['F']?.trim() ?? 'Working';
    const condition: EquipmentCondition =
      rawState === 'Working' ||
      rawState === 'Faulty' ||
      rawState === 'Under Maintenance' ||
      rawState === 'Decommissioned'
        ? rawState
        : 'Working';

    const quantity = slug === 'monitors' ? 50 : 1;

    legacyRows.push({
      timestamp,
      name: cleanName,
      core_functionality: core,
      other_functionality: other,
      condition,
      quantity,
      image_urls: imageUrls,
      slug,
    });
  }

  return legacyRows;
}

export async function enhanceLegacyImage(inputBuffer: Buffer): Promise<Buffer> {
  let quality = 80;
  let out = await sharp(inputBuffer)
    .normalize()
    .sharpen()
    .rotate()
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  while (out.length > 400 * 1024 && quality > 20) {
    quality -= 10;
    out = await sharp(inputBuffer)
      .normalize()
      .sharpen()
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  }

  return out;
}

class ImageMap extends Map<string, Buffer> {
  override get(key: string): Buffer | undefined {
    return super.get(key) ?? super.get(path.basename(key));
  }
  override has(key: string): boolean {
    return super.has(key) || super.has(path.basename(key));
  }
}

export async function extractLegacyImages(
  zipPath: string = path.resolve(
    process.cwd(),
    'ABU-SmartComp-Legacy-Images-20261013T193523Z-1-001.zip',
  ),
): Promise<Map<string, Buffer>> {
  const resolved = path.isAbsolute(zipPath)
    ? zipPath
    : path.resolve(process.cwd(), zipPath);
  const zipBuf = fs.readFileSync(resolved);
  const rawMap = readZipArchive(zipBuf);
  const result = new ImageMap();

  for (const [entryPath, data] of rawMap.entries()) {
    const base = path.basename(entryPath);
    if (base && !entryPath.endsWith('/')) {
      result.set(base, data);
    }
  }

  return result;
}

export async function importLegacyData(options?: {
  zipPath?: string;
  xlsxPath?: string;
  adminId?: string;
}): Promise<EquipmentRecord[]> {
  const rows = await parseLegacyXlsx(options?.xlsxPath);
  const images = await extractLegacyImages(options?.zipPath);

  const importedRecords: EquipmentRecord[] = [];

  for (const row of rows) {
    const matchingImages: { name: string; buf: Buffer }[] = [];
    for (const [imgName, imgBuf] of images.entries()) {
      if (imgName.startsWith(`${row.slug}-`)) {
        matchingImages.push({ name: imgName, buf: imgBuf });
      }
    }
    matchingImages.sort((a, b) => a.name.localeCompare(b.name));

    const imageKeys: string[] = [];
    for (const item of matchingImages) {
      const ext = path.extname(item.name);
      const baseNoExt = item.name.slice(0, -ext.length);
      const webpKey = `${baseNoExt}.webp`;
      const enhanced = await enhanceLegacyImage(item.buf);
      await storage.putObject(webpKey, enhanced, 'image/webp');
      imageKeys.push(webpKey);
    }

    const deterministicId = SLUG_TO_ID[row.slug] || crypto.randomUUID();
    const now = row.timestamp || new Date().toISOString();

    const record: EquipmentRecord = {
      id: deterministicId,
      name: row.name,
      core_functionality: row.core_functionality,
      other_functionality: row.other_functionality,
      condition: row.condition,
      quantity: row.quantity,
      image_keys: imageKeys,
      created_at: now,
      updated_at: now,
      updated_by: options?.adminId ?? null,
    };

    importedRecords.push(record);
  }

  db.reset({ equipment: importedRecords });
  return importedRecords;
}
