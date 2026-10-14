import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN_STRINGS = [
  { rule: 'forbidden-p-3px', value: 'p-\\[3px\\]', display: 'p-[3px]' },
  { rule: 'forbidden-w-128px', value: 'w-\\[128px\\]', display: 'w-[128px]' },
  { rule: 'forbidden-h-40px', value: 'h-\\[40px\\]', display: 'h-[40px]' },
  {
    rule: 'forbidden-p-24',
    value: '.p-24{',
    display: '.p-24 (off-scale step)',
  },
  { rule: 'forbidden-container', value: '!container', display: '!container' },
];
const FORBIDDEN_REGEXES = [
  {
    rule: 'forbidden-container-minwidth',
    re: /min-width:\s*40rem/,
    display: 'min-width: 40rem (container baseline breakpoint)',
  },
];
const REQUIRED = [
  { rule: 'missing-page-container', value: '.page-container' },
  { rule: 'missing-p5-chain', re: /\.p-5\{[^}]*var\(--space-5\)/ },
  { rule: 'missing-space5', value: '--space-5' },
  { rule: 'missing-font-sans', value: '--font-family-sans' },
];

function readAllCss(dir) {
  let out = '';
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out += readAllCss(full);
    else if (entry.name.endsWith('.css')) {
      try {
        out += readFileSync(full, 'utf8');
      } catch {
        continue;
      }
    }
  }
  return out;
}

export function checkCssClean(rootDir) {
  const root = resolve(rootDir);
  const staticDir = join(root, '.next', 'static');
  if (!existsSync(staticDir)) {
    return { skipped: true, violations: [] };
  }
  const css = readAllCss(staticDir);
  const violations = [];

  for (const f of FORBIDDEN_STRINGS) {
    if (css.includes(f.value)) {
      violations.push({
        rule: f.rule,
        message: `built CSS contains forbidden "${f.display}" — remove the source string and rebuild`,
      });
    }
  }
  for (const f of FORBIDDEN_REGEXES) {
    if (f.re.test(css)) {
      violations.push({
        rule: f.rule,
        message: `built CSS contains forbidden ${f.display} — remove the source string and rebuild`,
      });
    }
  }
  for (const r of REQUIRED) {
    const hit = r.re ? r.re.test(css) : css.includes(r.value);
    if (!hit) {
      violations.push({
        rule: r.rule,
        message: `built CSS is missing required "${r.value ?? r.rule}" — expected rule/token absent`,
      });
    }
  }

  return { skipped: false, violations };
}

const selfPath = resolve(fileURLToPath(import.meta.url)).toLowerCase();
const invokedPath = process.argv[1]
  ? resolve(process.argv[1]).toLowerCase()
  : '';
if (invokedPath === selfPath) {
  const rootArg = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
  const result = checkCssClean(rootArg);
  if (result.skipped) {
    console.log(
      'check-css-clean: SKIPPED — .next/static not found (run `next build` first)',
    );
    process.exit(0);
  }
  for (const v of result.violations) {
    console.log(`css-clean ${v.rule}: ${v.message}`);
  }
  if (result.violations.length > 0) {
    console.log(
      `check-css-clean: FAIL (${result.violations.length} violation(s))`,
    );
    process.exit(1);
  }
  console.log(
    'check-css-clean: PASS — no forbidden utilities, required rules present',
  );
  process.exit(0);
}
