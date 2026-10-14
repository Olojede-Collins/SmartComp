import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { checkMigrations } from '../scripts/check-migrations.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = join(repoRoot, 'scripts', 'check-migrations.mjs');
const fixturesRoot = join(repoRoot, 'tests', 'fixtures', 'migrations');
const cleanDir = join(fixturesRoot, 'clean');
const brokenDir = join(fixturesRoot, 'broken');
const realDir = join(repoRoot, 'backend', 'migrations');

function rules(violations) {
  return violations.map((v) => v.rule);
}

describe('checkMigrations', () => {
  it('reports no violations for a clean fixture set', () => {
    expect(checkMigrations(cleanDir)).toEqual([]);
  });

  it('flags an up file without its down twin', () => {
    const hit = checkMigrations(brokenDir).find(
      (v) => v.rule === 'twin' && v.file === '0002_beta.up.sql',
    );
    expect(hit).toBeDefined();
    expect(hit.message).toContain('down');
  });

  it('flags a down file without its up twin', () => {
    const hit = checkMigrations(brokenDir).find(
      (v) => v.rule === 'twin' && v.file === '0003_delta.down.sql',
    );
    expect(hit).toBeDefined();
    expect(hit.message).toContain('up');
  });

  it('flags a version used by two different migrations', () => {
    const hit = checkMigrations(brokenDir).find(
      (v) => v.rule === 'duplicate-version',
    );
    expect(hit).toBeDefined();
    expect(hit.message).toContain('0001');
    expect(hit.message).toContain('gamma');
  });

  it('flags a gap in the version sequence', () => {
    const hit = checkMigrations(brokenDir).find(
      (v) => v.rule === 'version-gap',
    );
    expect(hit).toBeDefined();
    expect(hit.message).toContain('0004');
  });

  it('flags a TBD marker inside a migration file', () => {
    const hit = checkMigrations(brokenDir).find(
      (v) => v.rule === 'tbd-marker' && v.file === '0005_epsilon.up.sql',
    );
    expect(hit).toBeDefined();
    expect(hit.message).toContain('MIGRATION_NOTES.md');
  });

  it('flags a migration file that breaks the naming scheme', () => {
    const hit = checkMigrations(brokenDir).find(
      (v) => v.rule === 'filename' && v.file === 'stray.sql',
    );
    expect(hit).toBeDefined();
  });

  it('reports every expected rule for the broken fixture', () => {
    const found = new Set(rules(checkMigrations(brokenDir)));
    for (const rule of [
      'twin',
      'duplicate-version',
      'version-gap',
      'tbd-marker',
      'filename',
    ]) {
      expect(found.has(rule)).toBe(true);
    }
  });

  it('flags a missing migrations directory', () => {
    const missing = join(fixturesRoot, 'does-not-exist');
    const found = rules(checkMigrations(missing));
    expect(found).toContain('missing-dir');
  });

  it('reports no violations for the real backend/migrations tree', () => {
    expect(checkMigrations(realDir)).toEqual([]);
  });
});

describe('check-migrations CLI', () => {
  it('exits 0 and prints nothing on the clean fixture', () => {
    const result = spawnSync(process.execPath, [cliPath, cleanDir], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('exits 1 and lists violations on the broken fixture', () => {
    const result = spawnSync(process.execPath, [cliPath, brokenDir], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('0005_epsilon.up.sql');
    expect(result.stdout).toContain('tbd-marker');
    expect(result.stdout).toContain('stray.sql');
  });
});
