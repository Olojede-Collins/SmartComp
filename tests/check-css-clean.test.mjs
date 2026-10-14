import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkCssClean } from '../scripts/check-css-clean.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hasBuild = existsSync(join(repoRoot, '.next', 'static'));
const globals = readFileSync(join(repoRoot, 'app', 'globals.css'), 'utf8');

function makeFakeBuild(css) {
  const root = mkdtempSync(join(tmpdir(), 'css-clean-'));
  mkdirSync(join(root, '.next', 'static', 'chunks'), { recursive: true });
  writeFileSync(join(root, '.next', 'static', 'chunks', 'app.css'), css);
  return root;
}

const GOOD_CHUNK = [
  '.page-container{max-width:75rem}',
  '.p-5{padding:var(--space-5)}',
  '--space-5:24px;',
  ':root{--font-family-sans:system-ui}',
].join('\n');

describe('built-CSS cleanliness gate (C2-M2-02)', () => {
  it('app/globals.css scopes the Tailwind source scan (source(none) + @source)', () => {
    expect(globals).toContain('source(none)');
    expect(globals).toContain('@source');
  });

  it('passes a clean synthetic build output', () => {
    const root = makeFakeBuild(GOOD_CHUNK);
    const result = checkCssClean(root);
    expect(result.skipped).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('flags forbidden raw-px utilities and off-scale steps in a stale build', () => {
    const root = makeFakeBuild(
      GOOD_CHUNK +
        '\n.p-\\[3px\\]{padding:3px}\n.w-\\[128px\\]{}\n.h-\\[40px\\]{}' +
        '\n.p-24{padding:calc(var(--spacing) * 24)}\n.\\!container{}' +
        '\n@media (min-width:40rem){.container{}}',
    );
    const result = checkCssClean(root);
    const rules = result.violations.map((v) => v.rule);
    expect(rules).toContain('forbidden-p-3px');
    expect(rules).toContain('forbidden-w-128px');
    expect(rules).toContain('forbidden-h-40px');
    expect(rules).toContain('forbidden-p-24');
    expect(rules).toContain('forbidden-container');
    expect(rules).toContain('forbidden-container-minwidth');
  });

  it('flags missing required elements in a stripped build', () => {
    const root = makeFakeBuild('body{color:red}');
    const result = checkCssClean(root);
    const rules = result.violations.map((v) => v.rule);
    expect(rules).toContain('missing-page-container');
    expect(rules).toContain('missing-p5-chain');
    expect(rules).toContain('missing-space5');
    expect(rules).toContain('missing-font-sans');
  });

  it('reports skipped when no build exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'css-clean-empty-'));
    const result = checkCssClean(root);
    expect(result.skipped).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it.skipIf(!hasBuild)(
    'real build output (.next/static) has no forbidden strings and keeps required rules (needs `npm run build`)',
    () => {
      const result = checkCssClean(repoRoot);
      expect(result.skipped).toBe(false);
      expect(result.violations).toEqual([]);
    },
  );
});
