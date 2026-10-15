import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { findRawTokenViolations } from '../scripts/check-raw-tokens.mjs';

describe('Raw Token Checker', () => {
  it('should only scan files in the app directory', () => {
    // Current working directory is the project root
    const rootDir = process.cwd();
    
    // This will now only scan 'app' because 'docs', 'design', etc., are excluded
    const violations = findRawTokenViolations(rootDir);
    
    // Log the files causing violations to verify they are all under /app
    violations.forEach(v => {
      console.log(`Violation in ${v.file}: ${v.message}`);
      expect(v.file).toContain(path.join(rootDir, 'app') + path.sep);
    });
  });
});
