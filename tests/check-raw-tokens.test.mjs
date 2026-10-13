import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { findRawTokenViolations } from '../scripts/check-raw-tokens.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = resolve(repoRoot, 'tests', 'fixtures', 'raw-tokens');

function rulesFor(violations) {
  return violations.map((v) => v.rule).sort();
}

describe('check-raw-tokens', () => {
  it('flags raw hex colours in app CSS', () => {
    const violations = findRawTokenViolations(
      resolve(fixtureRoot, 'violations'),
    );
    const hex = violations.filter((v) => v.rule === 'hex');
    expect(hex.length).toBeGreaterThanOrEqual(1);
    expect(hex.some((v) => v.file.endsWith('page.css'))).toBe(true);
  });

  it('flags raw px lengths in app CSS', () => {
    const violations = findRawTokenViolations(
      resolve(fixtureRoot, 'violations'),
    );
    const px = violations.filter((v) => v.rule === 'px-length');
    const props = px.map((v) => v.property);
    expect(props).toContain('font-size');
    expect(props).toContain('padding');
  });

  it('flags raw border-radius lengths in app CSS', () => {
    const violations = findRawTokenViolations(
      resolve(fixtureRoot, 'violations'),
    );
    const radius = violations.filter((v) => v.rule === 'radius-literal');
    expect(radius.length).toBe(1);
  });

  it('flags raw box-shadow / rgba values in app CSS', () => {
    const violations = findRawTokenViolations(
      resolve(fixtureRoot, 'violations'),
    );
    const rules = rulesFor(violations);
    expect(rules).toContain('shadow-literal');
    expect(rules).toContain('rgb-function');
  });

  it('flags hex colours and px arbitrary values in TSX', () => {
    const violations = findRawTokenViolations(
      resolve(fixtureRoot, 'violations'),
    );
    const tsxHex = violations.filter(
      (v) => v.rule === 'hex' && v.file.endsWith('.tsx'),
    );
    const tsxPx = violations.filter((v) => v.rule === 'arbitrary-px');
    expect(tsxHex.length).toBeGreaterThanOrEqual(1);
    expect(tsxPx.length).toBeGreaterThanOrEqual(1);
  });

  it('reports zero violations on the clean fixture', () => {
    const violations = findRawTokenViolations(resolve(fixtureRoot, 'clean'));
    expect(violations).toEqual([]);
  });

  it('reports zero violations on the repository app and styles trees', () => {
    const violations = findRawTokenViolations(repoRoot);
    expect(violations).toEqual([]);
  });
});
