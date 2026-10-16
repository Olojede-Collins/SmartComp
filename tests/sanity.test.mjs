import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('root package.json gate scripts', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  it('exposes the exact CI gate script commands', () => {
    expect(pkg.scripts.lint).toBe(
      'prettier --check . && eslint . && node scripts/check-motion-allowlist.mjs . && node scripts/check-raw-tokens.mjs . && node scripts/check-migrations.mjs',
    );
    expect(pkg.scripts.test).toBe('vitest run');
    expect(pkg.scripts.build).toBe(
      'next build && node scripts/check-css-clean.mjs && npm run build --workspace backend',
    );
    expect(pkg.scripts.format).toBe('prettier --write .');
  });
});
