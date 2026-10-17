import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function createToken(
  payload: Record<string, unknown>,
  secret?: string,
): string {
  const jwtSecret =
    secret ??
    (process.env.SUPABASE_JWT_SECRET ||
      (process.env.NODE_ENV === 'production' ? '' : 'test-jwt-secret'));
  if (!jwtSecret) {
    throw new Error('Server authentication secret is not configured');
  }
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', jwtSecret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  return `${headerB64}.${payloadB64}.${signature}`;
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    res.status(401).json({
      error: 'invalid-token',
      message: 'Authorization header is missing or malformed',
    });
    return;
  }

  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    res.status(401).json({
      error: 'invalid-token',
      message: 'Authorization header is missing or malformed',
    });
    return;
  }

  const token = match[1];
  const parts = token.split('.');
  if (parts.length !== 3) {
    res.status(401).json({
      error: 'invalid-token',
      message: 'Invalid token format',
    });
    return;
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const secret =
    process.env.SUPABASE_JWT_SECRET ||
    (process.env.NODE_ENV === 'production' ? '' : 'test-jwt-secret');

  if (!secret) {
    res.status(500).json({
      error: 'server-configuration-error',
      message: 'Server authentication secret is not configured',
    });
    return;
  }

  try {
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    const expectedBuf = Buffer.from(expectedSig);
    const actualBuf = Buffer.from(signatureB64);

    if (
      expectedBuf.length !== actualBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, actualBuf)
    ) {
      res.status(401).json({
        error: 'invalid-token',
        message: 'Invalid token signature',
      });
      return;
    }

    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;

    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) {
      res.status(401).json({
        error: 'invalid-token',
        message: 'Token has expired',
      });
      return;
    }

    const appMetadata = payload.app_metadata as { role?: string } | undefined;
    if (appMetadata?.role !== 'admin') {
      res.status(403).json({
        error: 'forbidden',
        message: 'Admin privileges required',
      });
      return;
    }

    (req as AuthenticatedRequest).user = {
      id: typeof payload.sub === 'string' ? payload.sub : crypto.randomUUID(),
      email: typeof payload.email === 'string' ? payload.email : undefined,
      role: 'admin',
    };

    next();
  } catch {
    res.status(401).json({
      error: 'invalid-token',
      message: 'Failed to verify token',
    });
  }
}
