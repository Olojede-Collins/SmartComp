import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { findRawTokenViolations } from '../scripts/check-raw-tokens.mjs';

describe('Raw Token Checker', () => {
  it('should only scan files in the app directory', () => {
    const rootDir = process.cwd();

    const violations = findRawTokenViolations(rootDir);

    violations.forEach((v) => {
      console.log(`Violation in ${v.file}: ${v.message}`);
      expect(v.file).toContain(path.join(rootDir, 'app') + path.sep);
    });
  });
});
