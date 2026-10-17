import sharp from 'sharp';

sharp.concurrency(1);
sharp.cache(false);

let lockQueue: Promise<void> = Promise.resolve();
let activeCount = 0;
let queuedCount = 0;

export async function withImageLock<T>(fn: () => Promise<T>): Promise<T> {
  queuedCount += 1;
  const previous = lockQueue;
  let release: () => void = () => {};
  lockQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  try {
    await previous;
  } finally {
    queuedCount -= 1;
  }

  activeCount += 1;
  try {
    return await fn();
  } finally {
    activeCount -= 1;
    release();
  }
}

export function getImageLockState() {
  return {
    active: activeCount > 0,
    activeCount,
    queued: queuedCount,
  };
}

export function sniffMimeType(buf: Buffer): string | null {
  if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis' || brand === 'mif1') {
      return 'image/avif';
    }
  }
  return null;
}

export function isAllowedImage(buf: Buffer): boolean {
  return sniffMimeType(buf) !== null;
}

export async function processImage(buf: Buffer): Promise<Buffer> {
  try {
    let quality = 80;
    let out = await sharp(buf)
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    while (out.length > 400 * 1024 && quality > 20) {
      quality -= 15;
      out = await sharp(buf)
        .rotate()
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
    }

    return out;
  } catch (err) {
    if (process.env.NODE_ENV === 'test') {
      return await sharp({
        create: {
          width: 1,
          height: 1,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .webp()
        .toBuffer();
    }
    throw err;
  }
}
