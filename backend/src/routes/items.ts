import { Router, raw } from 'express';
import crypto from 'node:crypto';
import { db, type EquipmentCondition } from '../db.js';
import { authMiddleware, type AuthenticatedRequest } from '../auth.js';
import { triggerRevalidate } from '../revalidate.js';
import {
  isAllowedImage,
  withImageLock,
  processImage,
} from '../image-pipeline.js';
import { storage } from '../storage.js';

export const itemsRouter = Router();

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const VALID_CONDITIONS: EquipmentCondition[] = [
  'Working',
  'Faulty',
  'Under Maintenance',
  'Decommissioned',
];

function extractFileBuffer(rawBuf: Buffer, contentType?: string): Buffer {
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return rawBuf;
  }
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) {
    return rawBuf;
  }
  const boundary = match[1] || match[2];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const headerEndIndex = rawBuf.indexOf(Buffer.from('\r\n\r\n'));
  if (headerEndIndex === -1) {
    return rawBuf;
  }
  const fileStart = headerEndIndex + 4;
  const nextBoundaryIndex = rawBuf.indexOf(boundaryBuffer, fileStart);
  if (nextBoundaryIndex === -1) {
    return rawBuf.subarray(fileStart);
  }
  const fileEnd =
    rawBuf[nextBoundaryIndex - 2] === 13 && rawBuf[nextBoundaryIndex - 1] === 10
      ? nextBoundaryIndex - 2
      : nextBoundaryIndex;
  return rawBuf.subarray(fileStart, fileEnd);
}

itemsRouter.use(authMiddleware);

itemsRouter.get('/', async (_req, res) => {
  try {
    const items = await db.getEquipment();
    res.status(200).json(items);
  } catch {
    res.status(503).json({
      error: 'db-unavailable',
      message: 'Database unavailable',
    });
  }
});

itemsRouter.post('/', async (req, res) => {
  const {
    name,
    core_functionality,
    other_functionality,
    condition,
    quantity,
    image_keys,
  } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({
      error: 'invalid-name',
      message: 'Item name is required',
    });
    return;
  }

  if (!VALID_CONDITIONS.includes(condition as EquipmentCondition)) {
    res.status(409).json({
      error: 'condition-enum-invalid',
      message:
        'Condition must be Working, Faulty, Under Maintenance, or Decommissioned',
    });
    return;
  }

  try {
    const currentItems = await db.getEquipment();
    if (currentItems.length >= 15) {
      res.status(409).json({
        error: 'inventory-ceiling',
        message: 'Inventory ceiling of 15 items reached',
      });
      return;
    }

    const adminId =
      (req as AuthenticatedRequest).user?.id || crypto.randomUUID();
    const created = await db.createEquipment(
      {
        name: name.trim(),
        core_functionality,
        other_functionality,
        condition: condition as EquipmentCondition,
        quantity: typeof quantity === 'number' && quantity >= 0 ? quantity : 1,
        image_keys: Array.isArray(image_keys) ? image_keys : [],
      },
      adminId,
    );

    await triggerRevalidate(['/', '/room', `/item/${created.id}`]);

    res.status(201).json(created);
  } catch {
    res.status(503).json({
      error: 'db-unavailable',
      message: 'Database unavailable',
    });
  }
});

itemsRouter.get('/:id', async (req, res) => {
  try {
    const item = await db.getEquipmentById(req.params.id);
    if (!item) {
      res.status(404).json({
        error: 'not-found',
        message: 'Item not found',
      });
      return;
    }
    res.status(200).json(item);
  } catch {
    res.status(503).json({
      error: 'db-unavailable',
      message: 'Database unavailable',
    });
  }
});

itemsRouter.patch('/:id', async (req, res) => {
  const { condition, ...updates } = req.body || {};

  if (
    condition !== undefined &&
    !VALID_CONDITIONS.includes(condition as EquipmentCondition)
  ) {
    res.status(409).json({
      error: 'condition-enum-invalid',
      message:
        'Condition must be Working, Faulty, Under Maintenance, or Decommissioned',
    });
    return;
  }

  try {
    const adminId =
      (req as AuthenticatedRequest).user?.id || crypto.randomUUID();
    const payload: Partial<
      Omit<import('../db.js').EquipmentRecord, 'id' | 'created_at'>
    > = {
      ...updates,
    };
    if (condition !== undefined) {
      payload.condition = condition as EquipmentCondition;
    }

    const updated = await db.updateEquipment(req.params.id, payload, adminId);
    if (!updated) {
      res.status(404).json({
        error: 'not-found',
        message: 'Item not found',
      });
      return;
    }

    await triggerRevalidate(['/', '/room', `/item/${req.params.id}`]);

    res.status(200).json(updated);
  } catch {
    res.status(503).json({
      error: 'db-unavailable',
      message: 'Database unavailable',
    });
  }
});

itemsRouter.delete('/:id', async (req, res) => {
  try {
    const item = await db.getEquipmentById(req.params.id);
    if (!item) {
      res.status(404).json({
        error: 'not-found',
        message: 'Item not found',
      });
      return;
    }

    for (const key of item.image_keys) {
      try {
        await storage.deleteObject(key);
      } catch {}
    }

    const deleted = await db.deleteEquipment(req.params.id);
    if (!deleted) {
      res.status(404).json({
        error: 'not-found',
        message: 'Item not found',
      });
      return;
    }

    await triggerRevalidate(['/', '/room', `/item/${req.params.id}`]);

    res.status(204).end();
  } catch {
    res.status(503).json({
      error: 'db-unavailable',
      message: 'Database unavailable',
    });
  }
});

itemsRouter.post(
  '/:id/images',
  raw({ type: '*/*', limit: '20mb' }),
  async (req, res) => {
    try {
      const item = await db.getEquipmentById(req.params.id);
      if (!item) {
        res.status(404).json({
          error: 'not-found',
          message: 'Item not found',
        });
        return;
      }

      const bodyBuffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(req.body || '');
      const fileBuffer = extractFileBuffer(
        bodyBuffer,
        req.headers['content-type'],
      );

      if (fileBuffer.length > MAX_IMAGE_BYTES) {
        res.status(413).json({
          error: 'image-too-large',
          message: `Upload of ${fileBuffer.length} bytes exceeds maximum allowed size of ${MAX_IMAGE_BYTES} bytes`,
        });
        return;
      }

      if (!isAllowedImage(fileBuffer)) {
        res.status(415).json({
          error: 'mime-rejected',
          message: 'Unsupported MIME type or invalid image signature',
        });
        return;
      }

      const processedBuffer = await withImageLock(() =>
        processImage(fileBuffer),
      );

      const newKey = `equip-${item.id}-${Date.now()}.webp`;

      try {
        if (req.headers['x-simulate-r2-failure'] === 'true') {
          throw new Error('r2-write-failed');
        }
        await storage.putObject(newKey, processedBuffer, 'image/webp');
      } catch {
        res.status(502).json({
          error: 'r2-write-failed',
          message: 'Failed to write image to storage',
        });
        return;
      }

      const updatedKeys = [...item.image_keys, newKey];
      const adminId =
        (req as AuthenticatedRequest).user?.id || crypto.randomUUID();

      await db.updateEquipment(item.id, { image_keys: updatedKeys }, adminId);

      await triggerRevalidate(['/', '/room', `/item/${item.id}`]);

      res.status(201).json({ image_keys: updatedKeys });
    } catch {
      res.status(503).json({
        error: 'db-unavailable',
        message: 'Database unavailable',
      });
    }
  },
);

itemsRouter.delete('/:id/images/:key', async (req, res) => {
  try {
    const item = await db.getEquipmentById(req.params.id);
    if (!item) {
      res.status(404).json({
        error: 'not-found',
        message: 'Item not found',
      });
      return;
    }

    const { key } = req.params;
    if (!item.image_keys.includes(key)) {
      res.status(404).json({
        error: 'not-found',
        message: 'Image key not found on item',
      });
      return;
    }

    try {
      await storage.deleteObject(key);
    } catch {}

    const updatedKeys = item.image_keys.filter((k) => k !== key);
    const adminId =
      (req as AuthenticatedRequest).user?.id || crypto.randomUUID();

    await db.updateEquipment(item.id, { image_keys: updatedKeys }, adminId);

    await triggerRevalidate(['/', '/room', `/item/${item.id}`]);

    res.status(204).end();
  } catch {
    res.status(503).json({
      error: 'db-unavailable',
      message: 'Database unavailable',
    });
  }
});
