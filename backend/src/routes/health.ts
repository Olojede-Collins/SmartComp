import { Router } from 'express';
import { db } from '../db.js';

export const healthRouter = Router();

healthRouter.get('/healthz', async (_req, res) => {
  const isHealthy = await db.checkHealth();
  if (!isHealthy) {
    res.status(503).json({
      error: 'db-unavailable',
      message: 'Database connectivity probe failed',
    });
    return;
  }
  res.status(200).json({ ok: true });
});
