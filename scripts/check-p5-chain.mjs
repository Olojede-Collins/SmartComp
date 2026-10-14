import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_DECL_RE = /--space-5:\s*24px\s*;/;
const MAPPING_RE = /--spacing-5:\s*var\(--space-5\)/;
const COMPILED_RULE_RE = /\.p-5\{[^}]*var\(--space-5\)/;
const COMPILED_TOKEN_RE = /--space-5:\s*24px\s*;/;

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

export function checkP5Chain(rootDir) {
  const root = resolve(rootDir);
  const violations = [];

  const tokensPath = join(root, 'app', 'tokens.css');
  if (!existsSync(tokensPath)) {
    violations.push({
      rule: 'token-missing',
      message: 'app/tokens.css not found',
    });
  } else {
    const tokens = readFileSync(tokensPath, 'utf8');
    if (!TOKEN_DECL_RE.test(tokens)) {
      violations.push({
        rule: 'token-missing',
        message:
          'app/tokens.css does not declare `--space-5: 24px` — the p-5 chain base value is gone or changed',
      });
    }
  }

  const globalsPath = join(root, 'app', 'globals.css');
  if (!existsSync(globalsPath)) {
    violations.push({
      rule: 'mapping-missing',
      message: 'app/globals.css not found',
    });
  } else {
    const globals = readFileSync(globalsPath, 'utf8');
    if (!MAPPING_RE.test(globals)) {
      violations.push({
        rule: 'mapping-missing',
        message:
          'app/globals.css @theme inline no longer maps `--spacing-5: var(--space-5)` — p-5 utilities fall back to the Tailwind linear default (20px at step 5)',
      });
    }
  }

  const staticDir = join(root, '.next', 'static');
  let buildSegment = 'skipped';
  if (existsSync(staticDir)) {
    buildSegment = 'checked';
    const css = readAllCss(staticDir);
    if (!COMPILED_RULE_RE.test(css)) {
      violations.push({
        rule: 'compiled-rule-missing',
        message:
          'built CSS has no `.p-5{...var(--space-5)...}` rule — compiled utility no longer resolves through the design token',
      });
    }
    if (!COMPILED_TOKEN_RE.test(css)) {
      violations.push({
        rule: 'compiled-token-missing',
        message: 'built CSS does not contain `--space-5: 24px`',
      });
    }
  }

  return { violations, buildSegment };
}

const selfPath = resolve(fileURLToPath(import.meta.url)).toLowerCase();
const invokedPath = process.argv[1]
  ? resolve(process.argv[1]).toLowerCase()
  : '';
if (invokedPath === selfPath) {
  const rootArg = process.argv[2] ? resolve(process.argv[2]) : process.cwd();
  const { violations, buildSegment } = checkP5Chain(rootArg);
  for (const v of violations) {
    console.log(`p-5-chain ${v.rule}: ${v.message}`);
  }
  if (violations.length > 0) {
    console.log(`check-p5-chain: FAIL (${violations.length} violation(s))`);
    process.exit(1);
  }
  if (buildSegment === 'skipped') {
    console.log(
      'check-p5-chain: PASS (source chain) — build segment skipped: .next/static not found',
    );
  } else {
    console.log('check-p5-chain: PASS (source chain + compiled CSS)');
  }
  process.exit(0);
}
