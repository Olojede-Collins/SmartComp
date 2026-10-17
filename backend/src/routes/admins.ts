import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { authMiddleware, type AuthenticatedRequest } from '../auth.js';
import { sendInviteEmail } from '../mailer.js';

export const adminsRouter = Router();

adminsRouter.get(
  ['/invites/verify', '/admins/invites/verify'],
  async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      res.status(404).json({
        error: 'unknown-token',
        message: 'Invite token is invalid or expired',
      });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invite = await db.getInviteByTokenHash(tokenHash);

    if (!invite) {
      res.status(404).json({
        error: 'unknown-token',
        message: 'Invite token is invalid or expired',
      });
      return;
    }

    if (invite.accepted_at !== null) {
      res.status(409).json({
        error: 'already-accepted',
        message: 'Invite token has already been accepted',
      });
      return;
    }

    res.status(200).json({ email: invite.email });
  },
);

adminsRouter.post(
  ['/invites/accept', '/admins/invites/accept'],
  async (req, res) => {
    const { token, name, password } = req.body || {};
    if (!token || typeof token !== 'string') {
      res.status(404).json({
        error: 'unknown-token',
        message: 'Invite token is invalid or expired',
      });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invite = await db.getInviteByTokenHash(tokenHash);

    if (!invite) {
      res.status(404).json({
        error: 'unknown-token',
        message: 'Invite token is invalid or expired',
      });
      return;
    }

    if (invite.accepted_at !== null) {
      res.status(409).json({
        error: 'already-accepted',
        message: 'Invite token has already been accepted',
      });
      return;
    }

    try {
      await db.acceptInvite(tokenHash, name, password);
      res.status(200).json({ status: 'active' });
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      if (errorObj.message === 'already-accepted') {
        res.status(409).json({
          error: 'already-accepted',
          message: 'Invite token has already been accepted',
        });
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Failed to accept invite:', msg);
      res.status(503).json({
        error: 'db-unavailable',
        message: msg || 'Database unavailable',
      });
    }
  },
);

adminsRouter.use(authMiddleware);

adminsRouter.get('/admins', async (_req, res) => {
  try {
    const admins = await db.getAdmins();
    res.status(200).json(admins);
  } catch {
    res.status(503).json({
      error: 'db-unavailable',
      message: 'Database unavailable',
    });
  }
});

adminsRouter.post('/admins/invites', async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({
      error: 'invalid-email',
      message: 'Valid email is required',
    });
    return;
  }

  try {
    const existingAdmin = await db.getAdminByEmail(email);
    if (existingAdmin) {
      res.status(409).json({
        error: 'already-admin',
        message: 'User is already an administrator',
      });
      return;
    }

    const pendingInvite = await db.getPendingInviteByEmail(email);
    if (pendingInvite) {
      res.status(409).json({
        error: 'invite-pending',
        message: 'An invite is already pending for this email',
      });
      return;
    }

    if (
      req.headers['x-simulate-gmail-failure'] === 'true' ||
      process.env.SIMULATE_GMAIL_FAILURE === 'true'
    ) {
      res.status(502).json({
        error: 'gmail-send-failed',
        message: 'Failed to send invite email',
      });
      return;
    }

    const adminId =
      (req as AuthenticatedRequest).user?.id || crypto.randomUUID();
    const { invite, token } = await db.createInvite(email, adminId);

    try {
      await sendInviteEmail({ to: email, token });
    } catch (err) {
      console.error('Failed to send invite email:', err);
      await db.deleteInvite(invite.id);
      const detail = err instanceof Error ? err.message : String(err);
      res.status(502).json({
        error: 'gmail-send-failed',
        message: detail || 'Failed to send invite email',
      });
      return;
    }

    const baseUrl =
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'https://smartcomp.vercel.app';
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const acceptUrl = `${cleanBaseUrl}/admin/invite/accept?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    res.status(201).json({
      id: invite.id,
      email: invite.email,
      token,
      acceptUrl,
    });
  } catch {
    res.status(503).json({
      error: 'db-unavailable',
      message: 'Database unavailable',
    });
  }
});

adminsRouter.delete('/admins/:id', async (req, res) => {
  try {
    const actorId =
      (req as AuthenticatedRequest).user?.id || crypto.randomUUID();
    const result = await db.deleteAdmin(req.params.id, actorId);

    if (result.notFound) {
      res.status(404).json({
        error: 'not-found',
        message: 'Admin not found',
      });
      return;
    }

    if (result.lastAdmin) {
      res.status(409).json({
        error: 'last-admin',
        message: 'Cannot delete the last remaining administrator',
      });
      return;
    }

    res.status(204).end();
  } catch {
    res.status(503).json({
      error: 'db-unavailable',
      message: 'Database unavailable',
    });
  }
});

adminsRouter.get('/export/pdf', async (req, res) => {
  if (
    req.headers['x-simulate-export-failure'] === 'true' ||
    process.env.SIMULATE_EXPORT_FAILURE === 'true'
  ) {
    res.status(500).json({
      error: 'export-generation-failed',
      message: 'Failed to generate PDF export',
    });
    return;
  }

  try {
    const items = await db.getEquipment();
    const pdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 64 >>\nstream\nBT /F1 12 Tf 50 700 Td (COREN Inventory - Count: ${items.length}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n328\n%%EOF\n`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="coren-inventory.pdf"',
    );
    res.status(200).send(Buffer.from(pdfContent));
  } catch {
    res.status(500).json({
      error: 'export-generation-failed',
      message: 'Failed to generate PDF export',
    });
  }
});

adminsRouter.get('/export/csv', async (req, res) => {
  if (
    req.headers['x-simulate-export-failure'] === 'true' ||
    process.env.SIMULATE_EXPORT_FAILURE === 'true'
  ) {
    res.status(500).json({
      error: 'export-generation-failed',
      message: 'Failed to generate CSV export',
    });
    return;
  }

  try {
    const items = await db.getEquipment();
    const header = 'name,condition,quantity,updated_at,updated_by';
    const rows = items.map((item) => {
      const escapedName = `"${item.name.replace(/"/g, '""')}"`;
      return `${escapedName},${item.condition},${item.quantity},${item.updated_at},${item.updated_by || ''}`;
    });
    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="coren-inventory.csv"',
    );
    res.status(200).send(csv);
  } catch {
    res.status(500).json({
      error: 'export-generation-failed',
      message: 'Failed to generate CSV export',
    });
  }
});
