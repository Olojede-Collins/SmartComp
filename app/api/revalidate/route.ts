import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';

export async function POST(request: Request): Promise<Response> {
  const serverSecret = process.env.REVALIDATE_SECRET;
  if (!serverSecret || serverSecret.trim() === '') {
    return Response.json(
      { error: 'revalidate-secret-missing' },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null;
  const headerSecret = request.headers.get('x-revalidate-secret');
  const bodySecret =
    body && typeof body === 'object' && typeof body.secret === 'string'
      ? body.secret
      : null;

  const incomingSecret = headerSecret || bearerToken || bodySecret;

  if (!incomingSecret || typeof incomingSecret !== 'string') {
    return Response.json({ error: 'invalid-secret' }, { status: 401 });
  }

  const incomingDigest = crypto
    .createHash('sha256')
    .update(incomingSecret)
    .digest();
  const expectedDigest = crypto
    .createHash('sha256')
    .update(serverSecret)
    .digest();

  if (!crypto.timingSafeEqual(incomingDigest, expectedDigest)) {
    return Response.json({ error: 'invalid-secret' }, { status: 401 });
  }

  revalidatePath('/');
  revalidatePath('/room');

  const targetPaths: string[] = [];
  if (body && typeof body === 'object' && Array.isArray(body.paths)) {
    for (const p of body.paths) {
      if (typeof p === 'string' && p.startsWith('/')) {
        targetPaths.push(p);
        revalidatePath(p);
      }
    }
  }

  return Response.json(
    {
      revalidated: true,
      now: Date.now(),
      paths: ['/', '/room', ...targetPaths],
    },
    { status: 200 },
  );
}
