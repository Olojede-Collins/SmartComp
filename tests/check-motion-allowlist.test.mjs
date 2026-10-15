import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, it, expect, afterEach } from 'vitest';
import { findMotionViolations } from '../scripts/check-motion-allowlist.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = join(repoRoot, 'scripts', 'check-motion-allowlist.mjs');

const temps = [];

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'motion-allowlist-'));
  temps.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

afterEach(() => {
  while (temps.length > 0) {
    rmSync(temps.pop(), { recursive: true, force: true });
  }
});

describe('findMotionViolations', () => {
  it('flags a non-allowlisted CSS transition property', () => {
    const dir = fixture({
      'app/globals.css': '.card { transition: background-color 200ms ease; }\n',
    });
    const violations = findMotionViolations(dir);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('background-color');
  });

  it('allows transform and opacity CSS transitions', () => {
    const dir = fixture({
      'app/globals.css': [
        '.a { transition: opacity 200ms ease; }',
        '.b { transition: transform 200ms ease, opacity 200ms; }',
        '.c { transition: none; }',
      ].join('\n'),
    });
    expect(findMotionViolations(dir)).toHaveLength(0);
  });

  it('flags transition-property declarations outside the allowlist', () => {
    const dir = fixture({
      'app/globals.css': '.d { transition-property: width, opacity; }\n',
    });
    const violations = findMotionViolations(dir);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('width');
  });

  it('flags non-allowlisted @keyframes animated properties', () => {
    const dir = fixture({
      'app/globals.css': [
        '@keyframes grow {',
        '  from { width: 0; }',
        '  to { width: 100%; }',
        '}',
        '@keyframes fade {',
        '  from { opacity: 0; }',
        '  to { opacity: 1; }',
        '}',
      ].join('\n'),
    });
    const violations = findMotionViolations(dir);
    expect(violations).toHaveLength(2);
    expect(violations.every((v) => v.message.includes('width'))).toBe(true);
  });

  it('flags non-allowlisted transition strings in JSX/TSX inline styles', () => {
    const dir = fixture({
      'app/page.tsx': [
        'export default function Page() {',
        "  return <div style={{ transition: 'background-color 1s ease' }} />;",
        '}',
      ].join('\n'),
    });
    const violations = findMotionViolations(dir);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('background-color');
  });

  it('allows transition: none and allowlisted properties in JS/TS strings', () => {
    const dir = fixture({
      'app/page.tsx': [
        'export default function Page() {',
        '  return (',
        '    <div>',
        "      <span style={{ transition: 'none' }} />",
        "      <span style={{ transition: 'transform 300ms ease' }} />",
        '    </div>',
        '  );',
        '}',
      ].join('\n'),
    });
    expect(findMotionViolations(dir)).toHaveLength(0);
  });

  it('finds no violations in the current repository scan roots', () => {
    expect(findMotionViolations(repoRoot)).toEqual([]);
  });
});

describe('check-motion-allowlist CLI', () => {
  it('exits 0 and prints nothing on a clean tree', () => {
    const dir = fixture({
      'app/globals.css': '.ok { transition: opacity 150ms ease; }\n',
    });
    const result = spawnSync(process.execPath, [cliPath, dir], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('exits 1 and lists violations on a dirty tree', () => {
    const dir = fixture({
      'app/globals.css': '.bad { transition: width 1s ease; }\n',
    });
    const result = spawnSync(process.execPath, [cliPath, dir], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('width');
    expect(result.stdout).toContain('globals.css');
  });
});
