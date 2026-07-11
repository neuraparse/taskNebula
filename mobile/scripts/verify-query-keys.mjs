#!/usr/bin/env node
/**
 * React Query server-namespace guard for the native app.
 *
 * Mobile supports arbitrary self-hosted TaskNebula servers and persists query
 * cache locally. Every query key must start with the active server URL so data
 * from one server cannot appear while connected to another.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hooksPath = path.join(mobileRoot, 'src/hooks/queries.ts');
const srcRoot = path.join(mobileRoot, 'src');
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

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
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === quote) return cursor;
  }
  return source.length - 1;
}

function skipComment(source, index) {
  if (source[index] === '/' && source[index + 1] === '/') {
    const end = source.indexOf('\n', index + 2);
    return end === -1 ? source.length - 1 : end;
  }
  if (source[index] === '/' && source[index + 1] === '*') {
    const end = source.indexOf('*/', index + 2);
    return end === -1 ? source.length - 1 : end + 1;
  }
  return index;
}

function readBalanced(source, start, openChar, closeChar) {
  let depth = 0;
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (char === '"' || char === "'" || char === '`') {
      index = skipQuoted(source, index, char);
      continue;
    }
    if (char === '/') {
      const nextIndex = skipComment(source, index);
      if (nextIndex !== index) {
        index = nextIndex;
        continue;
      }
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

function splitTopLevel(source, offset = 0) {
  const parts = [];
  let start = 0;
  let depth = 0;

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '"' || char === "'" || char === '`') {
      index = skipQuoted(source, index, char);
      continue;
    }
    if (char === '/') {
      const nextIndex = skipComment(source, index);
      if (nextIndex !== index) {
        index = nextIndex;
        continue;
      }
    }
    if (char === '(' || char === '[' || char === '{') depth++;
    if (char === ')' || char === ']' || char === '}') depth--;
    if (char === ',' && depth === 0) {
      const text = source.slice(start, index);
      if (text.trim()) parts.push({ text, start: offset + start });
      start = index + 1;
    }
  }

  const text = source.slice(start);
  if (text.trim()) parts.push({ text, start: offset + start });
  return parts;
}

function firstArrayElement(source, openBracketIndex) {
  let start = openBracketIndex + 1;
  while (/\s/.test(source[start] ?? '')) start++;

  let depth = 0;
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (char === '"' || char === "'" || char === '`') {
      index = skipQuoted(source, index, char);
      continue;
    }
    if (char === '/') {
      const nextIndex = skipComment(source, index);
      if (nextIndex !== index) {
        index = nextIndex;
        continue;
      }
    }
    if (char === '(' || char === '[' || char === '{') {
      depth++;
      continue;
    }
    if (char === ')' || char === ']' || char === '}') {
      if (char === ']' && depth === 0) return source.slice(start, index).trim();
      depth--;
      continue;
    }
    if (char === ',' && depth === 0) return source.slice(start, index).trim();
  }

  return source.slice(start).trim();
}

function assertServerFirst(filePath, source, openBracketIndex, label) {
  const first = firstArrayElement(source, openBracketIndex);
  if (first !== 'server()') {
    fail(
      `${path.relative(mobileRoot, filePath)}:${lineNumber(
        source,
        openBracketIndex,
      )} ${label} must start with server(); got ${JSON.stringify(first)}.`,
    );
  }
}

function verifyQueryKeyFactories() {
  const source = read(hooksPath);
  const declarationIndex = source.search(/\bexport\s+const\s+qk\s*=/);
  if (declarationIndex === -1) {
    fail('src/hooks/queries.ts is missing export const qk.');
    return 0;
  }

  const openIndex = source.indexOf('{', declarationIndex);
  const object = openIndex === -1 ? null : readBalanced(source, openIndex, '{', '}');
  if (!object) {
    fail('Could not parse export const qk in src/hooks/queries.ts.');
    return 0;
  }

  let checked = 0;
  for (const property of splitTopLevel(object.body, openIndex + 1)) {
    const nameMatch = property.text.match(/^\s*([A-Za-z_$][\w$]*)\s*:/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    const arrowIndex = property.text.indexOf('=>');
    if (arrowIndex === -1) {
      fail(`qk.${name} must be an arrow function query-key factory.`);
      continue;
    }

    const bracketIndex = property.text.indexOf('[', arrowIndex);
    if (bracketIndex === -1) {
      fail(`qk.${name} must return a query-key array.`);
      continue;
    }

    assertServerFirst(hooksPath, source, property.start + bracketIndex, `qk.${name}`);
    checked++;
  }

  return checked;
}

function verifyInlineQueryKeys() {
  let checked = 0;
  const pattern = /queryKey\s*:\s*\[/g;
  for (const filePath of walkFiles(srcRoot)) {
    const source = read(filePath);
    let match;
    while ((match = pattern.exec(source))) {
      const openBracketIndex = match.index + match[0].lastIndexOf('[');
      assertServerFirst(filePath, source, openBracketIndex, 'inline queryKey');
      checked++;
    }
  }
  return checked;
}

const factoryCount = verifyQueryKeyFactories();
const inlineCount = verifyInlineQueryKeys();

if (failures.length > 0) {
  console.error('React Query server namespace check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `React Query server namespace check passed (${factoryCount} qk factories, ${inlineCount} inline query keys).`,
);
