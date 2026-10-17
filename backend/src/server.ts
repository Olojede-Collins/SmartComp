import express from 'express';
import { healthRouter } from './routes/health.js';
import { itemsRouter } from './routes/items.js';
import { adminsRouter } from './routes/admins.js';

export const app = express();
const port = Number(process.env.PORT || 3001);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader(
      'Access-Control-Allow-Origin',
      process.env.FRONTEND_URL || '*',
    );
  }
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS',
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-simulate-r2-failure',
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json());

app.use(healthRouter);
app.use('/api/admin/items', itemsRouter);
app.use('/api/admin', adminsRouter);

app.get('/', (_req, res) => {
  res.status(200).json({ service: 'abu-smartcomp-backend', status: 'ok' });
});

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    void _next;
    const errorObject = err as {
      code?: string;
      message?: string;
      status?: number;
    };
    const status = errorObject.status || 500;
    res.status(status).json({
      error: errorObject.code || 'internal-error',
      message: errorObject.message || 'Internal Server Error',
    });
  },
);

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`backend listening on :${port}`);
  });
}
