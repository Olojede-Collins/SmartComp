import * as fs from 'fs';
import * as path from 'path';

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.agent',
  '.opencode',
  'dist',
  '.next',
]);

const ALLOWED_MOTION_PROPS = new Set(['transform', 'opacity', 'none']);

const ALLOWED_TRANSITION_TOKENS = new Set([
  'ease',
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'step-start',
  'step-end',
  'infinite',
  'alternate',
  'alternate-reverse',
  'normal',
  'reverse',
  'forwards',
  'backwards',
  'both',
  'initial',
  'inherit',
  'unset',
  'revert',
  '!important',
]);

const DURATION_RE = /^-?\d*\.?\d+(?:ms|s)$/;
const FUNCTION_RE = /^(?:cubic-bezier|steps|linear|var|calc)\(/;
const TRANSITION_DECL_RE = /transition(?:-property)?\s*:\s*([^;}]+)/g;
const KEYFRAMES_OPEN_RE = /@keyframes\s+[\w-]+\s*\{/g;
const KEYFRAME_PROP_RE = /(?<![\w-])([a-z][a-z0-9-]*)\s*:/g;
const STYLE_OBJECT_RE = /style\s*=\s*\{\{/g;
const INLINE_TRANSITION_RE =
  /\btransition(?:Property)?\s*:\s*(['"`])([\s\S]*?)\1/g;

function getAllFiles(dir, fileList = []) {
  if (!dir || !fs.existsSync(dir)) return fileList;
  if (EXCLUDED_DIRS.has(path.basename(dir))) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (!EXCLUDED_DIRS.has(file)) {
        getAllFiles(filePath, fileList);
      }
    } else {
      const ext = path.extname(file);
      if (['.css', '.tsx', '.ts'].includes(ext)) {
        fileList.push(filePath);
      }
    }
  });
  return fileList;
}

function stripCssComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    ' '.repeat(match.length),
  );
}

function isAllowedTransitionToken(token) {
  if (ALLOWED_MOTION_PROPS.has(token)) return true;
  if (ALLOWED_TRANSITION_TOKENS.has(token)) return true;
  if (DURATION_RE.test(token)) return true;
  if (FUNCTION_RE.test(token)) return true;
  return false;
}

function tokenizeTransitionValue(value) {
  const tokens = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') {
      depth += 1;
      current += ch;
    } else if (ch === ')') {
      depth = depth > 0 ? depth - 1 : 0;
      current += ch;
    } else if (depth === 0 && (ch === ',' || /\s/.test(ch))) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

function collectCssTransitionTokens(content) {
  const tokens = [];
  const commentFree = stripCssComments(content);
  let match;
  TRANSITION_DECL_RE.lastIndex = 0;
  while ((match = TRANSITION_DECL_RE.exec(commentFree)) !== null) {
    tokens.push(...tokenizeTransitionValue(match[1]));
  }
  return tokens;
}

function collectKeyframeProps(content) {
  const props = [];
  while (KEYFRAMES_OPEN_RE.exec(content) !== null) {
    let depth = 1;
    let i = KEYFRAMES_OPEN_RE.lastIndex;
    while (i < content.length && depth > 0) {
      const ch = content[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
    const block = content.slice(
      KEYFRAMES_OPEN_RE.lastIndex,
      depth === 0 ? i - 1 : content.length,
    );
    KEYFRAME_PROP_RE.lastIndex = 0;
    let propMatch;
    while ((propMatch = KEYFRAME_PROP_RE.exec(block)) !== null) {
      props.push(propMatch[1]);
    }
  }
  return props;
}

function collectInlineTransitionValues(content) {
  const values = [];
  while (STYLE_OBJECT_RE.exec(content) !== null) {
    let depth = 2;
    let i = STYLE_OBJECT_RE.lastIndex;
    while (i < content.length && depth > 0) {
      const ch = content[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      i += 1;
    }
    if (depth !== 0) continue;
    const object = content.slice(STYLE_OBJECT_RE.lastIndex, i - 1);
    INLINE_TRANSITION_RE.lastIndex = 0;
    let transitionMatch;
    while ((transitionMatch = INLINE_TRANSITION_RE.exec(object)) !== null) {
      values.push(transitionMatch[2]);
    }
  }
  return values;
}

function dedupeByMessage(violations) {
  const seen = new Set();
  const unique = [];
  for (const violation of violations) {
    if (seen.has(violation.message)) continue;
    seen.add(violation.message);
    unique.push(violation);
  }
  return unique;
}

export function findMotionViolations(dir) {
  const violations = [];
  const files = getAllFiles(dir);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');

    if (file.endsWith('.css')) {
      for (const token of collectCssTransitionTokens(content)) {
        if (!isAllowedTransitionToken(token)) {
          violations.push({
            message: `Non-allowlisted transition: ${token} in ${file}`,
          });
        }
      }
    }

    const keyframeSource = file.endsWith('.css')
      ? stripCssComments(content)
      : content;
    for (const prop of collectKeyframeProps(keyframeSource)) {
      if (!ALLOWED_MOTION_PROPS.has(prop)) {
        violations.push({
          message: `Non-allowlisted property in keyframe: ${prop} in ${file}`,
        });
      }
    }

    if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      for (const value of collectInlineTransitionValues(content)) {
        for (const token of tokenizeTransitionValue(value)) {
          if (!isAllowedTransitionToken(token)) {
            violations.push({
              message: `Non-allowlisted transition: ${token} in ${file}`,
            });
          }
        }
      }
    }
  }
  return dedupeByMessage(violations);
}

// CLI handler
if (process.argv[1] && process.argv[1].endsWith('check-motion-allowlist.mjs')) {
  const dir = process.argv[2];
  const violations = findMotionViolations(dir);
  if (violations.length > 0) {
    violations.forEach((v) => console.log(v.message));
    process.exit(1);
  }
}
