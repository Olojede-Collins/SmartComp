import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DIRS = ['app', 'styles'];
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'out',
  'dist',
  'coverage',
  '.git',
  '.agent',
  '.opencode',
]);
const CODE_EXT = new Set(['.css', '.js', '.jsx', '.ts', '.tsx']);
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_RE = /\b(rgba?|hsla?)\(/gi;
const PX_RE = /(\S+)\s*:\s*([^;{}]*?)(\b\d+(?:\.\d+)?px\b)([^;{}]*)/gi;
const ARBITRARY_PX_RE = /\[[^\]\n]*\b\d+(?:\.\d+)?px\b[^\]\n]*\]/g;

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p1) =>
      p1 + ' '.repeat(m.length - p1.length),
    );
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function blankAtThemeBlocks(text) {
  let src = text;
  const re = /@theme\b[^{]*\{/gi;
  let m;
  const ranges = [];
  while ((m = re.exec(src)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') depth -= 1;
      i += 1;
    }
    ranges.push([m.index, i - 1]);
  }
  for (const [start, end] of ranges.reverse()) {
    src = src.slice(0, start) + ' '.repeat(end - start + 1) + src.slice(end + 1);
  }
  return src;
}

function blankMediaConditions(text) {
  return text.replace(/@media\s*\([^)]*\)/gi, (m) => ' '.repeat(m.length));
}

const RADIUS_RE = /(-?\b[\w-]*radius)\s*:\s*([^;{}]+)/gi;
const SHADOW_RE = /(-?\b[\w-]*box-shadow)\s*:\s*([^;{}]+)/gi;

function blankRanges(src, ranges) {
  let out = src;
  for (const [start, end] of ranges.reverse()) {
    out = out.slice(0, start) + ' '.repeat(end - start) + out.slice(end);
  }
  return out;
}

function scanCss(text, file, violations) {
  let src = stripComments(text);
  src = blankAtThemeBlocks(src);
  src = blankMediaConditions(src);

  let m;
  const specialRanges = [];

  RADIUS_RE.lastIndex = 0;
  while ((m = RADIUS_RE.exec(src)) !== null) {
    const value = m[2].trim();
    specialRanges.push([m.index, m.index + m[0].length]);
    if (!value.startsWith('var(') && !/^0\b/.test(value)) {
      violations.push({
        file,
        line: lineOf(src, m.index),
        rule: 'radius-literal',
        property: m[1].trim(),
        message: `raw border-radius "${value}" — use --radius-sm/--radius-md tokens`,
      });
    }
  }

  SHADOW_RE.lastIndex = 0;
  while ((m = SHADOW_RE.exec(src)) !== null) {
    const value = m[2].trim();
    specialRanges.push([m.index, m.index + m[0].length]);
    if (!value.startsWith('var(') && !/^none\b/i.test(value)) {
      violations.push({
        file,
        line: lineOf(src, m.index),
        rule: 'shadow-literal',
        property: m[1].trim(),
        message: `raw box-shadow "${value}" — use --shadow-card/--shadow-raised/--shadow-modal tokens`,
      });
    }
  }

  src = blankRanges(src, specialRanges);

  HEX_RE.lastIndex = 0;
  while ((m = HEX_RE.exec(src)) !== null) {
    violations.push({
      file,
      line: lineOf(src, m.index),
      rule: 'hex',
      message: `raw hex colour "${m[0]}" — use a token from tokens.css`,
    });
  }

  RGB_RE.lastIndex = 0;
  while ((m = RGB_RE.exec(src)) !== null) {
    violations.push({
      file,
      line: lineOf(src, m.index),
      rule: 'rgb-function',
      message: `raw ${m[1]}() colour function — use a token from tokens.css`,
    });
  }

  PX_RE.lastIndex = 0;
  while ((m = PX_RE.exec(src)) !== null) {
    const value = `${m[3]}${m[4]}`;
    if (/^0px\b/.test(value.trim())) continue;
    violations.push({
      file,
      line: lineOf(src, m.index),
      rule: 'px-length',
      property: m[1].trim(),
      message: `raw px length in "${m[1].trim()}" — use a spacing/size/layout token`,
    });
  }
}

function scanCode(text, file, violations) {
  const src = stripComments(text);
  let m;
  HEX_RE.lastIndex = 0;
  while ((m = HEX_RE.exec(src)) !== null) {
    violations.push({
      file,
      line: lineOf(src, m.index),
      rule: 'hex',
      message: `raw hex colour "${m[0]}" — use a token from tokens.css`,
    });
  }
  ARBITRARY_PX_RE.lastIndex = 0;
  while ((m = ARBITRARY_PX_RE.exec(src)) !== null) {
    violations.push({
      file,
      line: lineOf(src, m.index),
      rule: 'arbitrary-px',
      message: `raw px arbitrary value "${m[0]}" — use a token scale step`,
    });
  }
}

function walk(dir, root, violations) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, root, violations);
      continue;
    }
    if (!entry.isFile()) continue;
    if (basename(entry.name) === 'tokens.css') continue;
    const dot = entry.name.lastIndexOf('.');
    const ext = dot === -1 ? '' : entry.name.slice(dot).toLowerCase();
    if (!CODE_EXT.has(ext)) continue;
    const rel = relative(root, full).split('\\').join('/');
    let text;
    try {
      text = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    if (ext === '.css') scanCss(text, rel, violations);
    else scanCode(text, rel, violations);
  }
}

export function findRawTokenViolations(rootDir, dirs = DEFAULT_DIRS) {
  const root = resolve(rootDir);
  const violations = [];
  for (const name of dirs) {
    const dir = join(root, name);
    if (existsSync(dir)) walk(dir, root, violations);
  }
  violations.sort(
    (a, b) =>
      a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule),
  );
  return violations;
}

const selfPath = resolve(fileURLToPath(import.meta.url)).toLowerCase();
const invokedPath = process.argv[1]
  ? resolve(process.argv[1]).toLowerCase()
  : '';
if (invokedPath === selfPath) {
  const rootArg = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
  const list = findRawTokenViolations(rootArg);
  for (const v of list) {
    console.log(`${v.file}:${v.line} ${v.rule} ${v.message}`);
  }
  process.exit(list.length > 0 ? 1 : 0);
}
