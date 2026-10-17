import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/revalidate/route';
import { revalidatePath } from 'next/cache';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('POST /api/revalidate route handler', () => {
  const originalEnv = process.env.REVALIDATE_SECRET;
  const TEST_SECRET = 'test-revalidate-secret-12345';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVALIDATE_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    process.env.REVALIDATE_SECRET = originalEnv;
  });

  it('returns 500 when REVALIDATE_SECRET is unset in server environment', async () => {
    delete process.env.REVALIDATE_SECRET;
    const req = new Request('http://localhost:3000/api/revalidate', {
      method: 'POST',
      headers: {
        'x-revalidate-secret': TEST_SECRET,
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data).toEqual({ error: 'revalidate-secret-missing' });
  });

  it('returns 500 when REVALIDATE_SECRET is an empty string in server environment', async () => {
    process.env.REVALIDATE_SECRET = '   ';
    const req = new Request('http://localhost:3000/api/revalidate', {
      method: 'POST',
      headers: {
        'x-revalidate-secret': TEST_SECRET,
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data).toEqual({ error: 'revalidate-secret-missing' });
  });

  it('returns 401 when no secret is provided in headers or body', async () => {
    const req = new Request('http://localhost:3000/api/revalidate', {
      method: 'POST',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toEqual({ error: 'invalid-secret' });
  });

  it('returns 401 when forged/invalid secret is provided in x-revalidate-secret header', async () => {
    const req = new Request('http://localhost:3000/api/revalidate', {
      method: 'POST',
      headers: {
        'x-revalidate-secret': 'forged-secret-value',
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toEqual({ error: 'invalid-secret' });
  });

  it('returns 401 when forged/invalid secret is provided in Authorization Bearer header', async () => {
    const req = new Request('http://localhost:3000/api/revalidate', {
      method: 'POST',
      headers: {
        authorization: 'Bearer forged-secret-value',
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toEqual({ error: 'invalid-secret' });
  });

  it('returns 401 when forged/invalid secret is provided in JSON body', async () => {
    const req = new Request('http://localhost:3000/api/revalidate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ secret: 'forged-secret-value' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toEqual({ error: 'invalid-secret' });
  });

  it('returns 200 and revalidates default paths when valid secret is passed via x-revalidate-secret', async () => {
    const req = new Request('http://localhost:3000/api/revalidate', {
      method: 'POST',
      headers: {
        'x-revalidate-secret': TEST_SECRET,
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.revalidated).toBe(true);
    expect(typeof data.now).toBe('number');
    expect(data.paths).toEqual(['/', '/room']);
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/room');
  });

  it('returns 200 and revalidates when valid secret is passed via Authorization Bearer header', async () => {
    const req = new Request('http://localhost:3000/api/revalidate', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TEST_SECRET}`,
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.revalidated).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/room');
  });

  it('returns 200 and revalidates custom paths when valid secret and paths array are provided in JSON body', async () => {
    const req = new Request('http://localhost:3000/api/revalidate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: TEST_SECRET,
        paths: ['/item/550e8400-e29b-41d4-a716-446655440000', '/item/detail'],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.revalidated).toBe(true);
    expect(data.paths).toEqual([
      '/',
      '/room',
      '/item/550e8400-e29b-41d4-a716-446655440000',
      '/item/detail',
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/room');
    expect(revalidatePath).toHaveBeenCalledWith(
      '/item/550e8400-e29b-41d4-a716-446655440000',
    );
    expect(revalidatePath).toHaveBeenCalledWith('/item/detail');
  });

  it('safely ignores invalid path formats in body paths array', async () => {
    const req = new Request('http://localhost:3000/api/revalidate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: TEST_SECRET,
        paths: ['invalid-path-without-slash', 123, null, '/valid/path'],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.paths).toEqual(['/', '/room', '/valid/path']);
    expect(revalidatePath).toHaveBeenCalledWith('/valid/path');
    expect(revalidatePath).not.toHaveBeenCalledWith(
      'invalid-path-without-slash',
    );
  });

  it('handles malformed JSON body safely without returning 500', async () => {
    const req = new Request('http://localhost:3000/api/revalidate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': TEST_SECRET,
      },
      body: 'this is not json {',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.revalidated).toBe(true);
  });
});
