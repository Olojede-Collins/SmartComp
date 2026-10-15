import * as fs from 'fs';
import * as path from 'path';

const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.agent', '.opencode', 'dist']);

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  if (EXCLUDED_DIRS.has(path.basename(dir))) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!EXCLUDED_DIRS.has(file)) {
        getAllFiles(filePath, fileList);
      }
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

export function findMotionViolations(dir) {
  const violations = [];
  const files = getAllFiles(dir);
  const allowed = ['transform', 'opacity', 'none'];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');

    // CSS transition
    const transitionRegex = /transition(?:-property)?:\s*([^;]+)/g;
    let match;
    while ((match = transitionRegex.exec(content)) !== null) {
      const props = match[1].split(/[\s,]+/).filter(Boolean);
      for (const p of props) {
        if (!allowed.includes(p) && !p.match(/^\d+(ms|s)$/)) {
          violations.push({ message: `Non-allowlisted transition: ${p} in ${file}` });
        }
      }
    }

    // Keyframes
    const keyframeRegex = /@keyframes\s+\w+\s*\{([\s\S]*?)\}/g;
    while ((match = keyframeRegex.exec(content)) !== null) {
      const block = match[1];
      const propertyRegex = /([a-z-]+)\s*:/g;
      let propMatch;
      while ((propMatch = propertyRegex.exec(block)) !== null) {
        const prop = propMatch[1];
        if (!allowed.includes(prop)) {
          violations.push({ message: `Non-allowlisted property in keyframe: ${prop} in ${file}` });
        }
      }
    }
  }
  return violations;
}

// CLI handler
if (process.argv[1] && process.argv[1].endsWith('check-motion-allowlist.mjs')) {
  const dir = process.argv[2];
  const violations = findMotionViolations(dir);
  if (violations.length > 0) {
    violations.forEach(v => console.log(v.message));
    process.exit(1);
  }
}
