#!/usr/bin/env node
/**
 * Static guard for the mobile React Native className adapter.
 *
 * The app intentionally uses a small local Tailwind-like subset instead of a
 * runtime styling library. Unknown tokens silently become no-ops at runtime, so
 * this check fails when JSX className usage drifts beyond the supported subset.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(mobileRoot, 'src');
const failures = [];

const spacing = new Set([
  '0.5',
  '1',
  '1.5',
  '2',
  '3',
  '4',
  '5',
  '6',
  '8',
  '10',
  '12',
  '16',
  '20',
  '24',
]);
const spacingPrefixes = new Set([
  'p',
  'px',
  'py',
  'pt',
  'pb',
  'mt',
  'mb',
  'mx',
  'my',
  'gap',
  'h',
  'w',
]);
const textSizes = new Set(['xs', 'sm', 'base', 'lg', 'xl', '2xl']);
const palette = new Set([
  'background',
  'card',
  'foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'border',
  'border-strong',
  'input',
  'ring',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'success',
  'destructive',
  'destructive-foreground',
  'surface',
  'surface-2',
  'info',
  'warning',
  'accent-blue',
  'accent-violet',
  'accent-cyan',
  'accent-emerald',
  'accent-amber',
  'accent-rose',
  'accent-indigo',
  'purple-500',
  'green-500',
  'blue-500',
  'red-500',
  'red-600',
  'cyan-500',
  'amber-500',
  'orange-500',
]);
const exactTokens = new Set([
  'flex-1',
  'flex-row',
  'flex-wrap',
  'items-center',
  'items-start',
  'items-end',
  'self-start',
  'justify-center',
  'justify-between',
  'text-center',
  'font-mono',
  'font-medium',
  'font-semibold',
  'font-bold',
  'leading-5',
  'border',
  'border-b',
  'border-t',
  'rounded-sm',
  'rounded-md',
  'rounded-lg',
  'rounded-full',
  'bg-transparent',
  'min-w-0',
]);

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function isSourceFile(filePath) {
  return (
    (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) &&
    !filePath.endsWith('.test.ts') &&
    !filePath.endsWith('.test.tsx')
  );
}

function walkFiles(directory, out = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkFiles(entryPath, out);
    } else if (isSourceFile(entryPath)) {
      out.push(entryPath);
    }
  }
  return out;
}

function skipQuoted(source, index, quote) {
  let escaped = false;
  for (let cursor = index + 1; cursor < source.length; cursor++) {
    const char = source[cursor];
    if (escaped) {
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === quote) {
      return cursor;
    }
  }
  return source.length - 1;
}

function readBalanced(source, start, openChar, closeChar) {
  let depth = 0;
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (char === '"' || char === "'" || char === '`') {
      index = skipQuoted(source, index, char);
      continue;
    }
    if (char === openChar) depth++;
    if (char === closeChar) {
      depth--;
      if (depth === 0) {
        return { body: source.slice(start + 1, index), end: index };
      }
    }
  }
  return null;
}

function readQuoted(source, start, quote) {
  const end = skipQuoted(source, start, quote);
  return { body: source.slice(start + 1, end), end };
}

function stringFragments(value) {
  return value.split(/\$\{[\s\S]*?\}/g);
}

function extractExpressionStringFragments(expression) {
  const fragments = [];
  const pattern = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
  let match;

  while ((match = pattern.exec(expression))) {
    const literal = match[1] ?? '';
    const quote = literal[0];
    const body = literal.slice(1, -1);
    if (quote === '`') fragments.push(...stringFragments(body));
    else fragments.push(body);
  }

  return fragments;
}

function classNameFragments(source) {
  const fragments = [];
  const pattern = /\bclassName\s*=/g;
  let match;

  while ((match = pattern.exec(source))) {
    let index = pattern.lastIndex;
    while (/\s/.test(source[index] ?? '')) index++;

    const char = source[index];
    if (char === '"' || char === "'") {
      const quoted = readQuoted(source, index, char);
      fragments.push({ text: quoted.body, index, fromExpression: false });
      pattern.lastIndex = quoted.end + 1;
      continue;
    }

    if (char === '{') {
      const expression = readBalanced(source, index, '{', '}');
      if (!expression) continue;
      for (const text of extractExpressionStringFragments(expression.body)) {
        fragments.push({ text, index, fromExpression: true });
      }
      pattern.lastIndex = expression.end + 1;
    }
  }

  return fragments;
}

function isSupportedToken(token) {
  if (token.startsWith('active:')) return isSupportedToken(token.slice('active:'.length));
  if (exactTokens.has(token)) return true;
  if (token.startsWith('min-h-')) return spacing.has(token.slice('min-h-'.length));

  const hyphenIndex = token.indexOf('-');
  if (hyphenIndex === -1) return false;

  const prefix = token.slice(0, hyphenIndex);
  const tail = token.slice(hyphenIndex + 1);
  if (spacing.has(tail) && spacingPrefixes.has(prefix)) return true;
  if (prefix === 'text' && (textSizes.has(tail) || palette.has(tail))) return true;
  if (prefix === 'bg' && palette.has(tail)) return true;
  if (prefix === 'border' && palette.has(tail)) return true;
  if (prefix === 'opacity' && (tail === '50' || tail === '70' || tail === '80')) return true;

  return false;
}

function looksLikeClassToken(token) {
  return token.includes('-') || token.includes(':') || exactTokens.has(token);
}

let checked = 0;
for (const filePath of walkFiles(sourceRoot)) {
  const source = fs.readFileSync(filePath, 'utf8');
  for (const fragment of classNameFragments(source)) {
    for (const token of fragment.text.split(/\s+/).filter(Boolean)) {
      if (token.includes('${')) continue;
      if (fragment.fromExpression && !looksLikeClassToken(token)) continue;
      checked++;
      if (!isSupportedToken(token)) {
        failures.push(
          `${path.relative(mobileRoot, filePath)}:${lineNumber(source, fragment.index)} unsupported className token "${token}"`,
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Native className verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Native className verification passed (${checked} utility tokens checked).`);
