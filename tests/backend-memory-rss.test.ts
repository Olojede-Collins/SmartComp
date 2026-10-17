import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  processImage,
  withImageLock,
  getImageLockState,
} from '../backend/src/image-pipeline.js';
import { enhanceLegacyImage } from '../backend/src/legacy-import.js';

describe('Backend Memory & RSS Benchmark Suite (HB-10, TRD §7.3)', () => {
  it('enforces single-concurrency and disabled cache configuration on sharp', () => {
    expect(sharp.concurrency()).toBe(1);

    const cacheState = sharp.cache();
    expect(cacheState.memory.max).toBe(0);
    expect(cacheState.items.max).toBe(0);
    expect(cacheState.files.max).toBe(0);
  });

  it('keeps peak RSS well below 512 MB ceiling during 4000x3000 legacy image enhancement', async () => {
    const baselineRssBytes = process.memoryUsage().rss;
    const baselineRssMb = baselineRssBytes / (1024 * 1024);

    const largeInputBuffer = await sharp({
      create: {
        width: 4000,
        height: 3000,
        channels: 3,
        background: { r: 120, g: 150, b: 180 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();

    let peakRssBytes = process.memoryUsage().rss;

    const enhanced = await enhanceLegacyImage(largeInputBuffer);

    const postRssBytes = process.memoryUsage().rss;
    peakRssBytes = Math.max(peakRssBytes, postRssBytes);
    const peakRssMb = peakRssBytes / (1024 * 1024);

    expect(Buffer.isBuffer(enhanced)).toBe(true);
    expect(enhanced.length).toBeLessThanOrEqual(400 * 1024);

    expect(peakRssMb).toBeLessThan(512);
    expect(peakRssMb).toBeLessThan(350);

    const metadata = await sharp(enhanced).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBeLessThanOrEqual(1200);
    expect(metadata.height).toBeLessThanOrEqual(1200);

    expect(baselineRssMb).toBeGreaterThan(0);
  });

  it('keeps peak RSS well below 512 MB ceiling during 4000x3000 runtime image processing', async () => {
    const largeInputBuffer = await sharp({
      create: {
        width: 4000,
        height: 3000,
        channels: 3,
        background: { r: 180, g: 150, b: 120 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();

    let peakRssBytes = process.memoryUsage().rss;

    const processed = await processImage(largeInputBuffer);

    const postRssBytes = process.memoryUsage().rss;
    peakRssBytes = Math.max(peakRssBytes, postRssBytes);
    const peakRssMb = peakRssBytes / (1024 * 1024);

    expect(Buffer.isBuffer(processed)).toBe(true);
    expect(processed.length).toBeLessThanOrEqual(400 * 1024);
    expect(peakRssMb).toBeLessThan(512);

    const metadata = await sharp(processed).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBeLessThanOrEqual(1200);
    expect(metadata.height).toBeLessThanOrEqual(1200);
  });

  it('maintains bounded memory across 10 sequential large image transforms without accumulating', async () => {
    const sampleBuffer = await sharp({
      create: {
        width: 3000,
        height: 2000,
        channels: 3,
        background: { r: 90, g: 130, b: 170 },
      },
    })
      .jpeg({ quality: 85 })
      .toBuffer();

    let peakRssAcrossIterations = 0;
    const rssReadings: number[] = [];

    for (let i = 0; i < 10; i++) {
      const output = await enhanceLegacyImage(sampleBuffer);
      expect(output.length).toBeLessThanOrEqual(400 * 1024);

      const currentRssMb = process.memoryUsage().rss / (1024 * 1024);
      rssReadings.push(currentRssMb);
      if (currentRssMb > peakRssAcrossIterations) {
        peakRssAcrossIterations = currentRssMb;
      }
    }

    expect(peakRssAcrossIterations).toBeLessThan(512);

    const finalRssMb = rssReadings[rssReadings.length - 1];
    expect(finalRssMb).toBeLessThan(512);
  });

  it('verifies image processing mutex guarantees exactly single-concurrency execution', async () => {
    expect(getImageLockState().activeCount).toBe(0);

    let maxSimultaneousActive = 0;
    let concurrentRunning = 0;

    const task = async () => {
      return await withImageLock(async () => {
        concurrentRunning += 1;
        maxSimultaneousActive = Math.max(
          maxSimultaneousActive,
          concurrentRunning,
        );

        await new Promise((resolve) => setTimeout(resolve, 20));

        concurrentRunning -= 1;
        return true;
      });
    };

    const results = await Promise.all([task(), task(), task(), task()]);

    expect(results).toEqual([true, true, true, true]);
    expect(maxSimultaneousActive).toBe(1);
    expect(getImageLockState().activeCount).toBe(0);
  });
});
