import sharp from 'sharp';
import { storage } from './storage.js';
import { db } from './db.js';
import {
  extractLegacyImages,
  enhanceLegacyImage,
  importLegacyData,
} from './legacy-import.js';

export interface ImageAuditResult {
  key?: string;
  format: string;
  width: number;
  height: number;
  sizeBytes: number;
  passed: boolean;
  violations: string[];
  meetsDesktopBudget: boolean;
  meetsMobileBudget: boolean;
}

export interface AuditSummary {
  total: number;
  passed: number;
  failed: number;
  complianceRate: number;
  results: ImageAuditResult[];
}

export async function auditImageBuffer(
  buffer: Buffer,
  key?: string,
): Promise<ImageAuditResult> {
  const sizeBytes = buffer.length;
  const violations: string[] = [];
  let format = 'unknown';
  let width = 0;
  let height = 0;

  try {
    const metadata = await sharp(buffer).metadata();
    const rawFormat = (metadata.format as string | undefined) ?? 'unknown';

    if (rawFormat === 'webp') {
      format = 'webp';
    } else if (
      rawFormat === 'avif' ||
      (rawFormat === 'heif' &&
        (metadata.compression === 'av1' ||
          (metadata as unknown as { mediaType?: string }).mediaType ===
            'image/avif'))
    ) {
      format = 'avif';
    } else {
      format = rawFormat;
    }

    width = metadata.width ?? 0;
    height = metadata.height ?? 0;

    if (format !== 'webp' && format !== 'avif') {
      violations.push(`Invalid format: ${format}. Expected webp or avif.`);
    }

    const longestEdge = Math.max(width, height);
    if (longestEdge > 1200) {
      violations.push(
        `Dimensions exceed 1200 pixel limit: ${width}x${height} (longest edge ${longestEdge} pixels).`,
      );
    }

    if (sizeBytes > 400 * 1024) {
      violations.push(
        `Size exceeds 400 KB desktop budget: ${sizeBytes} bytes.`,
      );
    }
  } catch (err) {
    violations.push(
      `Corrupt or unsupported image buffer: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const meetsDesktopBudget = sizeBytes <= 400 * 1024;
  const meetsMobileBudget = sizeBytes <= 150 * 1024;
  const passed = violations.length === 0;

  return {
    key,
    format,
    width,
    height,
    sizeBytes,
    passed,
    violations,
    meetsDesktopBudget,
    meetsMobileBudget,
  };
}

export async function auditAllStoredImages(
  storageMap?: Map<string, { data: Buffer }>,
): Promise<AuditSummary> {
  const imagesToAudit = new Map<string, Buffer>();

  if (storageMap) {
    for (const [key, item] of storageMap.entries()) {
      imagesToAudit.set(key, item.data);
    }
  } else {
    const inMemory = (
      storage as unknown as { inMemory?: Map<string, { data: Buffer }> }
    ).inMemory;
    if (inMemory && inMemory.size > 0) {
      for (const [key, item] of inMemory.entries()) {
        imagesToAudit.set(key, item.data);
      }
    }

    const equipmentList = await db.getEquipment();
    for (const eq of equipmentList) {
      for (const key of eq.image_keys) {
        if (!imagesToAudit.has(key)) {
          const item = await storage.getObject(key);
          if (item) {
            imagesToAudit.set(key, item.data);
          }
        }
      }
    }

    if (imagesToAudit.size === 0) {
      await importLegacyData();
      const populatedInMemory = (
        storage as unknown as { inMemory?: Map<string, { data: Buffer }> }
      ).inMemory;
      if (populatedInMemory) {
        for (const [key, item] of populatedInMemory.entries()) {
          imagesToAudit.set(key, item.data);
        }
      }
      if (imagesToAudit.size === 0) {
        const rawMap = await extractLegacyImages();
        for (const [name, buf] of rawMap.entries()) {
          const enhanced = await enhanceLegacyImage(buf);
          imagesToAudit.set(name, enhanced);
        }
      }
    }
  }

  const results: ImageAuditResult[] = [];
  for (const [key, buffer] of imagesToAudit.entries()) {
    const auditRes = await auditImageBuffer(buffer, key);
    results.push(auditRes);
  }

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  const complianceRate = total === 0 ? 1 : passed / total;

  return {
    total,
    passed,
    failed,
    complianceRate,
    results,
  };
}
