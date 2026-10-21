// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { checkMigrations } from '../scripts/check-migrations.mjs';

describe('Launch Hardening & Secrets Audit Suite (Session S-07 Launch Verification)', () => {
  const rootDir = process.cwd();

  describe('1. Secrets Policy & Git Isolation Audit (SECURITY §4)', () => {
    it('verifies .gitignore contains .env exclusion rules protecting secrets from git commit', () => {
      const gitignorePath = path.resolve(rootDir, '.gitignore');
      expect(fs.existsSync(gitignorePath)).toBe(true);
      const content = fs.readFileSync(gitignorePath, 'utf8');

      expect(content).toMatch(/\.env/);
      expect(content).toMatch(/\/\*/);
      expect(content).toMatch(/!\.gitignore/);
    });

    it('scans codebase to verify Render-only sensitive secrets are never hardcoded as string literals', () => {
      const sensitiveKeys = [
        'SUPABASE_SERVICE_ROLE_KEY',
        'R2_SECRET_ACCESS_KEY',
        'GMAIL_CLIENT_SECRET',
        'SUPABASE_JWT_SECRET',
      ];

      const searchDirs = ['app', 'backend/src', 'lib', 'scripts'];

      function collectFiles(dir: string): string[] {
        const fullDir = path.resolve(rootDir, dir);
        if (!fs.existsSync(fullDir)) return [];
        const entries = fs.readdirSync(fullDir, { withFileTypes: true });
        const files: string[] = [];
        for (const entry of entries) {
          const res = path.resolve(fullDir, entry.name);
          if (entry.isDirectory()) {
            if (
              entry.name !== 'node_modules' &&
              entry.name !== '.next' &&
              entry.name !== 'dist'
            ) {
              files.push(...collectFiles(path.relative(rootDir, res)));
            }
          } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
            files.push(res);
          }
        }
        return files;
      }

      const allFiles = searchDirs.flatMap((d) => collectFiles(d));
      expect(allFiles.length).toBeGreaterThan(0);

      const hardcodedSecretPattern =
        /(const|let|var)\s+(SUPABASE_SERVICE_ROLE_KEY|R2_SECRET_ACCESS_KEY|GMAIL_CLIENT_SECRET|SUPABASE_JWT_SECRET)\s*=\s*['"`][A-Za-z0-9_\-=+]{8,}['"`]/;

      for (const filePath of allFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        expect(hardcodedSecretPattern.test(content)).toBe(false);

        for (const key of sensitiveKeys) {
          const assignmentPattern = new RegExp(
            `${key}\\s*=\\s*['"\`][A-Za-z0-9_\\-=+]{8,}['"\`]`,
          );
          expect(assignmentPattern.test(content)).toBe(false);
        }
      }
    });

    it('verifies client components never import or reference server-only sensitive secrets', () => {
      function collectClientComponents(dir: string): string[] {
        const fullDir = path.resolve(rootDir, dir);
        if (!fs.existsSync(fullDir)) return [];
        const entries = fs.readdirSync(fullDir, { withFileTypes: true });
        const files: string[] = [];
        for (const entry of entries) {
          const res = path.resolve(fullDir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '.next') {
              files.push(
                ...collectClientComponents(path.relative(rootDir, res)),
              );
            }
          } else if (/\.(tsx|ts)$/.test(entry.name)) {
            const content = fs.readFileSync(res, 'utf8');
            if (
              content.includes("'use client'") ||
              content.includes('"use client"')
            ) {
              files.push(res);
            }
          }
        }
        return files;
      }

      const clientFiles = collectClientComponents('app');
      expect(clientFiles.length).toBeGreaterThan(0);

      const serverOnlySecrets = [
        'SUPABASE_SERVICE_ROLE_KEY',
        'R2_SECRET_ACCESS_KEY',
        'GMAIL_CLIENT_SECRET',
        'SUPABASE_JWT_SECRET',
      ];

      for (const file of clientFiles) {
        const src = fs.readFileSync(file, 'utf8');
        for (const sec of serverOnlySecrets) {
          expect(src).not.toContain(sec);
        }
      }
    });
  });

  describe('2. Rollback Rehearsal & Migration Verification (CICD §6)', () => {
    it('verifies all 8 database migrations have complete paired down-statements in backend/migrations', () => {
      const migrationsDir = path.resolve(rootDir, 'backend/migrations');
      const violations = checkMigrations(migrationsDir);
      expect(violations).toHaveLength(0);

      const expectedVersions = [
        '0001',
        '0002',
        '0003',
        '0004',
        '0005',
        '0006',
        '0007',
        '0008',
      ];
      for (const ver of expectedVersions) {
        const files = fs.readdirSync(migrationsDir);
        const upFile = files.find(
          (f) => f.startsWith(`${ver}_`) && f.endsWith('.up.sql'),
        );
        const downFile = files.find(
          (f) => f.startsWith(`${ver}_`) && f.endsWith('.down.sql'),
        );

        expect(upFile).toBeDefined();
        expect(downFile).toBeDefined();

        const downContent = fs.readFileSync(
          path.join(migrationsDir, downFile!),
          'utf8',
        );
        expect(downContent.trim().length).toBeGreaterThan(10);
      }
    });

    it('verifies down-statement rollback commands reverse schema structures cleanly', () => {
      const migrationsDir = path.resolve(rootDir, 'backend/migrations');

      const down0007 = fs.readFileSync(
        path.join(migrationsDir, '0007_rls.down.sql'),
        'utf8',
      );
      expect(down0007).toContain('DROP POLICY IF EXISTS');
      expect(down0007).toContain('DISABLE ROW LEVEL SECURITY');

      const down0006 = fs.readFileSync(
        path.join(migrationsDir, '0006_indexes.down.sql'),
        'utf8',
      );
      expect(down0006).toContain('DROP INDEX IF EXISTS');

      const down0005 = fs.readFileSync(
        path.join(migrationsDir, '0005_audit_log.down.sql'),
        'utf8',
      );
      expect(down0005).toContain('DROP TABLE IF EXISTS audit_log');

      const down0004 = fs.readFileSync(
        path.join(migrationsDir, '0004_admin_invites.down.sql'),
        'utf8',
      );
      expect(down0004).toContain('DROP TABLE IF EXISTS admin_invites');

      const down0003 = fs.readFileSync(
        path.join(migrationsDir, '0003_equipment.down.sql'),
        'utf8',
      );
      expect(down0003).toContain('DROP TABLE IF EXISTS equipment');

      const down0002 = fs.readFileSync(
        path.join(migrationsDir, '0002_admins.down.sql'),
        'utf8',
      );
      expect(down0002).toContain('DROP TABLE IF EXISTS admins');

      const down0001 = fs.readFileSync(
        path.join(migrationsDir, '0001_condition_enum.down.sql'),
        'utf8',
      );
      expect(down0001).toContain('DROP TYPE IF EXISTS condition_enum');
    });

    it('verifies CI workflow definition includes lint, test, docker build, and deploy smoke probes', () => {
      const ciPath = path.resolve(rootDir, '.github/workflows/ci.yml');
      expect(fs.existsSync(ciPath)).toBe(true);
      const ciContent = fs.readFileSync(ciPath, 'utf8');

      expect(ciContent).toContain('lint:');
      expect(ciContent).toContain('test:');
      expect(ciContent).toContain('build:');
      expect(ciContent).toContain('deploy:');
      expect(ciContent).toContain('docker build -f backend/Dockerfile .');
      expect(ciContent).toContain('Smoke probe 1');
      expect(ciContent).toContain('Smoke probe 2');
      expect(ciContent).toContain('RENDER_SERVICE_URL');
      expect(ciContent).toContain('VERCEL_PUBLIC_URL');
    });

    it('verifies GitHub Actions uses immutable commit SHAs for supply chain security', () => {
      const ciPath = path.resolve(rootDir, '.github/workflows/ci.yml');
      const ciContent = fs.readFileSync(ciPath, 'utf8');

      expect(ciContent).toContain(
        'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
      );
      expect(ciContent).toContain(
        'actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1',
      );
      expect(ciContent).not.toMatch(/actions\/checkout@v[0-9]/);
      expect(ciContent).not.toMatch(/actions\/setup-node@v[0-9]/);
    });
  });
});
