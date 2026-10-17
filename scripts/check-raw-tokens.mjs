import * as fs from 'fs';
import * as path from 'path';

const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'docs',
  'design',
  '.next',
  '.agent',
  '.opencode',
  'tests',
  'backend',
];

const EXCLUDED_FILES = ['tokens.css', 'globals.css'];

function isExcluded(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  const parts = relativePath.split(path.sep);
  if (parts.some((part) => EXCLUDED_DIRS.includes(part))) return true;
  return EXCLUDED_FILES.includes(path.basename(filePath));
}

function getAllFiles(dir, fileList = []) {
  if (!dir || !fs.existsSync(dir)) return fileList;
  if (EXCLUDED_DIRS.includes(path.basename(dir))) return fileList;

  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);

    if (isExcluded(filePath)) {
      return;
    }

    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      if (
        ['.tsx', '.css', '.ts', '.js'].some((ext) => filePath.endsWith(ext))
      ) {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}

export function findMotionViolations(dir) {
  const violations = [];
  const files = getAllFiles(dir);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const transitionRegex = /transition(?:-property)?:\s*([^;]+)/g;
    let match;
    while ((match = transitionRegex.exec(content)) !== null) {
      const props = match[1];
      if (
        !props.includes('transform') &&
        !props.includes('opacity') &&
        !props.includes('none')
      ) {
        violations.push({
          message: `Non-allowlisted transition: ${props} in ${file}`,
        });
      }
    }
  }
  return violations;
}

export function findRawTokenViolations(dir) {
  const violations = [];
  const files = getAllFiles(dir);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');

    // Check for raw hex colors
    const hexRegex = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})/g;
    let hexMatch;
    while ((hexMatch = hexRegex.exec(content)) !== null) {
      violations.push({
        rule: 'hex',
        file,
        message: 'Raw hex color',
        hex: hexMatch[0],
      });
    }

    // Check for arbitrary px units
    const pxRegex = /[: ](\d+)px/g;
    let pxMatch;
    while ((pxMatch = pxRegex.exec(content)) !== null) {
      violations.push({
        rule: 'px-length',
        file,
        property: 'size',
        message: 'Raw px value',
        value: pxMatch[1],
      });
    }
  }
  return violations;
}

// CLI handler
if (process.argv[1] && process.argv[1].endsWith('check-raw-tokens.mjs')) {
  const dir = process.argv[2] || '.';
  const violations = findRawTokenViolations(dir);
  if (violations.length > 0) {
    violations.forEach((v) => console.log(`${v.message}: ${v.file}`));
    process.exit(1);
  }
}
