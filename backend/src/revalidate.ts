export type RevalidateListener = (paths: string[]) => void;

let revalidateListener: RevalidateListener | null = null;

export function setRevalidateListener(
  listener: RevalidateListener | null,
): void {
  revalidateListener = listener;
}

export async function triggerRevalidate(
  paths: string[] = [],
): Promise<boolean> {
  if (revalidateListener) {
    try {
      revalidateListener(paths);
    } catch {
      return false;
    }
  }

  const vercelUrl =
    process.env.VERCEL_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:3000';
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return false;
  }

  const baseUrl = vercelUrl.startsWith('http')
    ? vercelUrl
    : `https://${vercelUrl}`;
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/api/revalidate`;

  try {
    const res = await globalThis.fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify({ paths }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
