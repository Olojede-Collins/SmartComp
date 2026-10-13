import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED = new Set([
  'transform',
  'opacity',
  'none',
  'initial',
  'inherit',
  'unset',
]);
const SCAN_DIRS = ['app', 'backend', 'styles', 'components', 'src'];
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'out',
  'dist',
  'coverage',
  '.git',
  '.agent',
  '.opencode',
  '.playwright-mcp',
  'design',
  'docs',
]);
const CSS_EXT = new Set(['.css']);
const CODE_EXT = new Set(['.js', '.jsx', '.cjs', '.mjs', '.ts', '.tsx']);
const TIMING = new Set([
  'ease',
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'step-start',
  'step-end',
  'end',
  'start',
]);

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

function splitTopLevelCommas(str) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of str) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts;
}

function transitionShorthandViolations(value) {
  const cleaned = value.replace(/!important\s*$/i, '').trim();
  const violations = [];
  for (const clause of splitTopLevelCommas(cleaned)) {
    for (const raw of clause.trim().split(/\s+/)) {
      if (!raw) continue;
      const t = raw.toLowerCase();
      if (ALLOWED.has(t)) continue;
      if (TIMING.has(t)) continue;
      if (t.startsWith('cubic-bezier(') || t.startsWith('steps(')) continue;
      if (t.startsWith('var(')) continue;
      const bare = t.replace(/[,)]+$/, '');
      if (ALLOWED.has(bare)) continue;
      if (/^[\d.]+$/.test(bare)) continue;
      if (/^[\d.]+m?s$/.test(bare)) continue;
      if (/^[\d.]+%$/.test(bare)) continue;
      if (/^-?[a-z][a-z-]*$/.test(bare)) violations.push(bare);
    }
  }
  return violations;
}

function propertyListViolations(value) {
  const cleaned = value.replace(/!important\s*$/i, '');
  const violations = [];
  for (const part of splitTopLevelCommas(cleaned)) {
    const t = part.trim().toLowerCase();
    if (!t) continue;
    if (ALLOWED.has(t)) continue;
    if (t.startsWith('var(')) continue;
    violations.push(t);
  }
  return violations;
}

function scanCss(text, file, violations) {
  const src = stripComments(text);
  const propRe = /\btransition-property\s*:\s*([^;{}]+)/gi;
  let m;
  while ((m = propRe.exec(src)) !== null) {
    for (const bad of propertyListViolations(m[1])) {
      violations.push({
        file,
        line: lineOf(src, m.index),
        rule: 'transition-property',
        message: `transition-property animates non-allowlisted property "${bad}" (allowed: transform, opacity)`,
      });
    }
  }
  const shorthandRe = /\btransition\s*:\s*([^;{}]+)/gi;
  while ((m = shorthandRe.exec(src)) !== null) {
    for (const bad of transitionShorthandViolations(m[1])) {
      violations.push({
        file,
        line: lineOf(src, m.index),
        rule: 'transition',
        message: `transition animates non-allowlisted property "${bad}" (allowed: transform, opacity)`,
      });
    }
  }
  const kfRe = /@keyframes[^{]*\{/gi;
  while ((m = kfRe.exec(src)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') depth -= 1;
      i += 1;
    }
    const block = src.slice(start, i - 1);
    const declRe = /(^|[;{])\s*([a-zA-Z-]+)\s*:\s*([^;{}]+)/g;
    let d;
    while ((d = declRe.exec(block)) !== null) {
      const prop = d[2].toLowerCase();
      if (prop === 'from' || prop === 'to') continue;
      if (ALLOWED.has(prop)) continue;
      if (d[3].trim().startsWith('var(')) continue;
      violations.push({
        file,
        line: lineOf(src, start + d.index),
        rule: '@keyframes',
        message: `@keyframes animates non-allowlisted property "${prop}" (allowed: transform, opacity)`,
      });
    }
  }
}

function scanCode(text, file, violations) {
  const src = stripComments(text);
  const re = /\btransition\s*:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const value = m[2];
    if (value.includes('${')) continue;
    for (const bad of transitionShorthandViolations(value)) {
      violations.push({
        file,
        line: lineOf(src, m.index),
        rule: 'transition',
        message: `transition animates non-allowlisted property "${bad}" (allowed: transform, opacity)`,
      });
    }
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
    const dot = entry.name.lastIndexOf('.');
    const ext = dot === -1 ? '' : entry.name.slice(dot).toLowerCase();
    const rel = relative(root, full).split('\\').join('/');
    let text;
    try {
      text = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    if (CSS_EXT.has(ext)) scanCss(text, rel, violations);
    else if (CODE_EXT.has(ext)) scanCode(text, rel, violations);
  }
}

export function findMotionViolations(rootDir) {
  const root = resolve(rootDir);
  const violations = [];
  for (const name of SCAN_DIRS) {
    const dir = join(root, name);
    if (existsSync(dir)) walk(dir, root, violations);
  }
  violations.sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      a.rule.localeCompare(b.rule),
  );
  return violations;
}

const selfPath = resolve(fileURLToPath(import.meta.url)).toLowerCase();
const invokedPath = process.argv[1]
  ? resolve(process.argv[1]).toLowerCase()
  : '';
if (invokedPath === selfPath) {
  const rootArg = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
  const list = findMotionViolations(rootArg);
  for (const v of list) {
    console.log(`${v.file}:${v.line} ${v.rule} ${v.message}`);
  }
  process.exit(list.length > 0 ? 1 : 0);
}
