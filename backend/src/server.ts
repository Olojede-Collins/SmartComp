import express from 'express';
import { healthRouter } from './routes/health.js';
import { itemsRouter } from './routes/items.js';
import { adminsRouter } from './routes/admins.js';

export const app = express();
const port = Number(process.env.PORT || 3001);

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
