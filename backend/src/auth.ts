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

interface JwkKey {
  kid?: string;
  kty: string;
  crv?: string;
  x?: string;
  y?: string;
  alg?: string;
}

let cachedJwks: { keys: JwkKey[] } | null = null;
let lastJwksFetch = 0;

export async function getJwksKeys(): Promise<JwkKey[]> {
  const now = Date.now();
  if (cachedJwks && now - lastJwksFetch < 3600000) {
    return cachedJwks.keys;
  }
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return cachedJwks?.keys || [];
  try {
    const cleanUrl = supabaseUrl.replace(/\/+$/, '');
    const res = await globalThis.fetch(
      `${cleanUrl}/auth/v1/.well-known/jwks.json`,
    );
    if (res.ok) {
      const data = (await res.json()) as { keys: JwkKey[] };
      cachedJwks = data;
      lastJwksFetch = now;
      return data.keys || [];
    }
  } catch {}
  return cachedJwks?.keys || [];
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
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

  try {
    let header: { alg?: string; kid?: string } = {};
    try {
      header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    } catch {
      res.status(401).json({
        error: 'invalid-token',
        message: 'Invalid token format',
      });
      return;
    }

    let isValid = false;

    if (header.alg === 'ES256') {
      const keys = await getJwksKeys();
      const matchingKey =
        (header.kid ? keys.find((k) => k.kid === header.kid) : null) ||
        keys.find((k) => k.alg === 'ES256') ||
        keys[0];

      if (matchingKey) {
        try {
          const pubKey = crypto.createPublicKey({
            key: matchingKey as any,
            format: 'jwk',
          }); // eslint-disable-line @typescript-eslint/no-explicit-any
          isValid = crypto.verify(
            'sha256',
            Buffer.from(`${headerB64}.${payloadB64}`),
            { key: pubKey, dsaEncoding: 'ieee-p1363' },
            Buffer.from(signatureB64, 'base64url'),
          );
        } catch {
          isValid = false;
        }
      }
    } else {
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

      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');

      const expectedBuf = Buffer.from(expectedSig);
      const actualBuf = Buffer.from(signatureB64);

      if (
        expectedBuf.length === actualBuf.length &&
        crypto.timingSafeEqual(expectedBuf, actualBuf)
      ) {
        isValid = true;
      }
    }

    if (!isValid) {
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
