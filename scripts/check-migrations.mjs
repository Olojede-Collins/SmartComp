import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE_RE = /^(\d{4})_([a-z0-9_]+)\.(up|down)\.sql$/;
const TBD_RE = /\bTBD\b/;

function push(violations, file, rule, message) {
  violations.push({ file, rule, message });
}

export function checkMigrations(rootDir) {
  const dir = resolve(rootDir);
  const violations = [];

  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    push(
      violations,
      dir,
      'missing-dir',
      `migrations directory not found: ${dir}`,
    );
    return violations;
  }

  const sqlFiles = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  if (sqlFiles.length === 0) {
    push(
      violations,
      dir,
      'empty',
      `no migration .sql files found in ${dir}`,
    );
    return violations;
  }

  const pairs = new Map();
  const versionSlugs = new Map();

  for (const name of sqlFiles) {
    const match = FILE_RE.exec(name);
    if (!match) {
      push(
        violations,
        name,
        'filename',
        `"${name}" does not match the NNNN_slug.(up|down).sql naming scheme`,
      );
      continue;
    }

    const [, version, slug, kind] = match;
    const key = `${version}_${slug}`;
    if (!pairs.has(key)) {
      pairs.set(key, { version, slug, up: false, down: false });
    }
    pairs.get(key)[kind] = true;

    if (!versionSlugs.has(version)) versionSlugs.set(version, new Set());
    versionSlugs.get(version).add(slug);

    const content = readFileSync(join(dir, name), 'utf8');
    if (TBD_RE.test(content)) {
      push(
        violations,
        name,
        'tbd-marker',
        `TBD marker found in ${name} — record TBDs in MIGRATION_NOTES.md, never in applied SQL`,
      );
    }
  }

  for (const pair of pairs.values()) {
    if (pair.up && !pair.down) {
      push(
        violations,
        `${pair.version}_${pair.slug}.up.sql`,
        'twin',
        `up migration ${pair.version}_${pair.slug} has no .down.sql twin`,
      );
    }
    if (pair.down && !pair.up) {
      push(
        violations,
        `${pair.version}_${pair.slug}.down.sql`,
        'twin',
        `down migration ${pair.version}_${pair.slug} has no .up.sql twin`,
      );
    }
  }

  for (const [version, slugs] of versionSlugs) {
    if (slugs.size > 1) {
      push(
        violations,
        `${version}_*.sql`,
        'duplicate-version',
        `version ${version} used by multiple migrations: ${[...slugs]
          .sort()
          .join(', ')}`,
      );
    }
  }

  const versions = [...versionSlugs.keys()].map(Number).sort((a, b) => a - b);
  if (versions.length > 0 && versions[0] !== 1) {
    push(
      violations,
      String(versions[0]).padStart(4, '0') + '_*.sql',
      'version-gap',
      `version sequence must start at 0001, found ${String(versions[0]).padStart(4, '0')}`,
    );
  }
  for (let i = 1; i < versions.length; i += 1) {
    if (versions[i] !== versions[i - 1] + 1) {
      const expected = String(versions[i - 1] + 1).padStart(4, '0');
      const found = String(versions[i]).padStart(4, '0');
      push(
        violations,
        `${found}_*.sql`,
        'version-gap',
        `version gap: expected ${expected}, found ${found}`,
      );
    }
  }

  violations.sort(
    (a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule),
  );
  return violations;
}

const selfPath = resolve(fileURLToPath(import.meta.url)).toLowerCase();
const invokedPath = process.argv[1]
  ? resolve(process.argv[1]).toLowerCase()
  : '';
if (invokedPath === selfPath) {
  const dirArg = process.argv[2]
    ? resolve(process.argv[2])
    : join(process.cwd(), 'backend', 'migrations');
  const list = checkMigrations(dirArg);
  for (const v of list) {
    console.log(`${v.file} ${v.rule} ${v.message}`);
  }
  if (list.length > 0) {
    console.log(`${list.length} migration check violation(s).`);
  }
  process.exit(list.length > 0 ? 1 : 0);
}
