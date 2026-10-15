import * as fs from 'fs';
import * as path from 'path';

const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'docs',
  'design',
  '.next',
  '.agent',
  'tests'
];

function isExcluded(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  // Also check if any parent directory is in the exclusion list
  const parts = relativePath.split(path.sep);
  return parts.some(part => EXCLUDED_DIRS.includes(part));
}

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    
    if (isExcluded(filePath)) {
      return;
    }
    
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      if (['.tsx', '.css', '.ts', '.js'].some(ext => filePath.endsWith(ext))) {
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
      if (!props.includes('transform') && !props.includes('opacity') && !props.includes('none')) {
        violations.push({ message: `Non-allowlisted transition: ${props} in ${file}` });
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
      violations.push({ rule: 'hex', file, message: 'Raw hex color', hex: hexMatch[0] });
    }

    // Check for arbitrary px units
    const pxRegex = /[: ](\d+)px/g;
    let pxMatch;
    while ((pxMatch = pxRegex.exec(content)) !== null) {
      violations.push({ rule: 'px-length', file, property: 'size', message: 'Raw px value', value: pxMatch[1] });
    }
  }
  return violations;
}
