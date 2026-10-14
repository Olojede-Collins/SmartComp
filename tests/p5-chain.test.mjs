import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkP5Chain } from '../scripts/check-p5-chain.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hasBuild = existsSync(join(repoRoot, '.next', 'static'));

describe('p-5 token chain (tokens.css -> @theme inline -> compiled CSS)', () => {
  const { violations, buildSegment } = checkP5Chain(repoRoot);
  const rules = violations.map((v) => v.rule);

  it('app/tokens.css declares --space-5: 24px', () => {
    expect(rules).not.toContain('token-missing');
  });

  it('app/globals.css @theme inline maps --spacing-5 to var(--space-5)', () => {
    expect(rules).not.toContain('mapping-missing');
  });

  it.skipIf(!hasBuild)(
    'compiled CSS keeps .p-5{...var(--space-5)} and --space-5:24px (needs `npm run build`)',
    () => {
      expect(buildSegment).toBe('checked');
      expect(rules).not.toContain('compiled-rule-missing');
      expect(rules).not.toContain('compiled-token-missing');
    },
  );

  it('finds no source-level chain violations', () => {
    expect(
      rules.filter((r) => r === 'token-missing' || r === 'mapping-missing'),
    ).toEqual([]);
  });

  it('maps the design token value directly (independent source of truth)', () => {
    const tokens = readFileSync(join(repoRoot, 'app', 'tokens.css'), 'utf8');
    expect(tokens).toMatch(/--space-5:\s*24px\s*;/);
  });
});
