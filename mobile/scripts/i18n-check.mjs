#!/usr/bin/env node
/**
 * Mobile i18n key-parity checker.
 *
 * Verifies every catalog in mobile/locales/*.json has exactly the same leaf
 * keys, primitive leaf types, and ICU placeholder names as en.json, and that
 * the expected 30 TaskNebula locales are present. It also rejects hardcoded
 * user-facing TSX literals in the mobile app source.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const expectedLocales = [
  'ar',
  'bg',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'fi',
  'fr',
  'he',
  'hi',
  'hu',
  'id',
  'it',
  'ja',
  'ko',
  'nb',
  'nl',
  'pl',
  'pt',
  'ro',
  'ru',
  'sv',
  'th',
  'tr',
  'uk',
  'vi',
  'zh-CN',
  'zh-TW',
];

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(mobileRoot, 'locales');
const sourceDir = path.join(mobileRoot, 'src');
const sourceEntries = [path.join(mobileRoot, 'App.tsx'), sourceDir];
const userFacingLiteralProps = [
  'accessibilityHint',
  'accessibilityLabel',
  'aria-label',
  'alt',
  'caption',
  'description',
  'emptyDescription',
  'emptyTitle',
  'error',
  'helperText',
  'label',
  'message',
  'placeholder',
  'subtitle',
  'title',
];

function flatten(value, prefix = '', out = {}) {
  for (const [key, child] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flatten(child, nextKey, out);
    } else {
      out[nextKey] = child;
    }
  }
  return out;
}

function leafType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function placeholders(value) {
  if (typeof value !== 'string') return [];

  const names = new Set();
  const pattern = /\{\s*([A-Za-z_][A-Za-z0-9_]*)\b/g;
  let match;
  while ((match = pattern.exec(value))) {
    names.add(match[1]);
  }
  return [...names].sort();
}

function sameList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function walkFiles(directory, predicate, out = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkFiles(entryPath, predicate, out);
    } else if (predicate(entryPath)) {
      out.push(entryPath);
    }
  }
  return out;
}

function userFacingSourceFiles() {
  const files = [];
  const predicate = (file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx');

  for (const entry of sourceEntries) {
    if (!fs.existsSync(entry)) continue;

    const stat = fs.statSync(entry);
    if (stat.isDirectory()) {
      walkFiles(entry, predicate, files);
    } else if (predicate(entry)) {
      files.push(entry);
    }
  }

  return files;
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function isUserFacingLiteral(value) {
  const normalized = value.trim();
  return /[A-Za-zÀ-ÖØ-öø-ÿ\u0100-\uFFFF]/u.test(normalized);
}

function readTopLevelArgs(source, start, maxArgs) {
  const args = [];
  let current = '';
  let depth = 1;
  let quote = null;
  let escaped = false;

  for (let index = start; index < source.length; index++) {
    const char = source[index];

    if (quote) {
      current += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      current += char;
      continue;
    }

    if (char === '(' || char === '[' || char === '{') {
      depth++;
      current += char;
      continue;
    }

    if (char === ')' || char === ']' || char === '}') {
      depth--;
      if (depth === 0) {
        args.push(current.trim());
        break;
      }
      current += char;
      continue;
    }

    if (char === ',' && depth === 1) {
      args.push(current.trim());
      if (args.length >= maxArgs) break;
      current = '';
      continue;
    }

    current += char;
  }

  return args.slice(0, maxArgs);
}

function directStringLiteral(value) {
  const trimmed = value.trim();
  const quote = trimmed[0];

  if (
    (quote !== '"' && quote !== "'" && quote !== '`') ||
    trimmed.length < 2 ||
    trimmed[trimmed.length - 1] !== quote
  ) {
    return null;
  }

  if (quote === '`' && trimmed.includes('${')) {
    return null;
  }

  return trimmed.slice(1, -1);
}

function directObjectTextLiterals(value) {
  const literals = [];
  const pattern = /\btext\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
  let match;

  while ((match = pattern.exec(value))) {
    const literal = directStringLiteral(match[1] ?? '');
    if (literal) literals.push(literal);
  }

  return literals;
}

function hardcodedUserFacingLiterals() {
  const issues = [];
  const files = userFacingSourceFiles();
  const textPattern = /<Text(?:\s[^>]*)?>([^<{][^<>{}]*)<\/Text>/g;
  const propPattern = new RegExp(
    `\\b(${userFacingLiteralProps
      .map((prop) => prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})\\s*=\\s*["']([^"']*)["']`,
    'g',
  );
  const alertPattern = /Alert\.alert\s*\(/g;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    let match;

    while ((match = textPattern.exec(source))) {
      const value = match[1] ?? '';
      if (!isUserFacingLiteral(value)) continue;
      issues.push(
        `${path.relative(mobileRoot, file)}:${lineNumber(source, match.index)} hardcoded <Text> literal "${value.trim()}"`,
      );
    }

    while ((match = propPattern.exec(source))) {
      const prop = match[1] ?? '';
      const value = match[2] ?? '';
      if (!isUserFacingLiteral(value)) continue;
      issues.push(
        `${path.relative(mobileRoot, file)}:${lineNumber(source, match.index)} hardcoded ${prop} prop "${value.trim()}"`,
      );
    }

    while ((match = alertPattern.exec(source))) {
      const args = readTopLevelArgs(source, alertPattern.lastIndex, 3);

      args.slice(0, 2).forEach((arg, index) => {
        const value = directStringLiteral(arg);
        if (!value || !isUserFacingLiteral(value)) return;

        issues.push(
          `${path.relative(mobileRoot, file)}:${lineNumber(source, match.index)} hardcoded Alert.alert ${
            index === 0 ? 'title' : 'message'
          } literal "${value.trim()}"`,
        );
      });

      for (const value of directObjectTextLiterals(args[2] ?? '')) {
        if (!isUserFacingLiteral(value)) continue;
        issues.push(
          `${path.relative(mobileRoot, file)}:${lineNumber(
            source,
            match.index,
          )} hardcoded Alert.alert button text literal "${value.trim()}"`,
        );
      }
    }
  }

  return issues;
}

const files = fs
  .readdirSync(dir)
  .filter((file) => file.endsWith('.json'))
  .sort();
const locales = files.map((file) => file.replace(/\.json$/, ''));
const expectedSet = new Set(expectedLocales);
let failures = 0;

const missingLocaleFiles = expectedLocales.filter((locale) => !locales.includes(locale));
const extraLocaleFiles = locales.filter((locale) => !expectedSet.has(locale));

if (missingLocaleFiles.length || extraLocaleFiles.length) {
  failures++;
  if (missingLocaleFiles.length) {
    console.error(`Missing locale files: ${missingLocaleFiles.join(', ')}`);
  }
  if (extraLocaleFiles.length) {
    console.error(`Unexpected locale files: ${extraLocaleFiles.join(', ')}`);
  }
}

if (!files.includes('en.json')) {
  console.error('en.json not found in', dir);
  process.exit(1);
}

const english = flatten(JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8')));
const englishKeys = Object.keys(english);
const englishKeySet = new Set(englishKeys);
const englishPlaceholderMap = new Map(englishKeys.map((key) => [key, placeholders(english[key])]));

for (const file of files) {
  const locale = file.replace(/\.json$/, '');
  let catalog;

  try {
    catalog = flatten(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
  } catch (error) {
    failures++;
    console.error(`Invalid JSON in ${file}: ${error.message}`);
    continue;
  }

  if (locale === 'en') continue;

  const keys = new Set(Object.keys(catalog));
  const missing = englishKeys.filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !englishKeySet.has(key));
  const typeMismatches = [];
  const placeholderMismatches = [];

  for (const key of englishKeys) {
    if (!keys.has(key)) continue;

    const expectedType = leafType(english[key]);
    const actualType = leafType(catalog[key]);
    if (expectedType !== actualType) {
      typeMismatches.push(`${key}: ${actualType} !== ${expectedType}`);
      continue;
    }

    const expectedPlaceholders = englishPlaceholderMap.get(key) ?? [];
    const actualPlaceholders = placeholders(catalog[key]);
    if (!sameList(actualPlaceholders, expectedPlaceholders)) {
      placeholderMismatches.push(
        `${key}: {${actualPlaceholders.join(', ')}} !== {${expectedPlaceholders.join(', ')}}`,
      );
    }
  }

  if (missing.length || extra.length || typeMismatches.length || placeholderMismatches.length) {
    failures++;
    console.error(
      `${locale}: ${missing.length} missing, ${extra.length} extra` +
        (typeMismatches.length ? `, ${typeMismatches.length} type mismatch` : '') +
        (placeholderMismatches.length
          ? `, ${placeholderMismatches.length} placeholder mismatch`
          : '') +
        (missing.length ? `\n  missing: ${missing.slice(0, 8).join(', ')}` : '') +
        (extra.length ? `\n  extra: ${extra.slice(0, 8).join(', ')}` : '') +
        (typeMismatches.length
          ? `\n  type mismatches: ${typeMismatches.slice(0, 8).join(', ')}`
          : '') +
        (placeholderMismatches.length
          ? `\n  placeholder mismatches: ${placeholderMismatches.slice(0, 8).join(', ')}`
          : ''),
    );
  } else {
    console.log(`${locale}: ${keys.size} keys`);
  }
}

const hardcodedLiteralIssues = hardcodedUserFacingLiterals();
if (hardcodedLiteralIssues.length) {
  failures++;
  console.error(
    `Hardcoded user-facing mobile strings found:\n  ${hardcodedLiteralIssues
      .slice(0, 25)
      .join('\n  ')}` +
      (hardcodedLiteralIssues.length > 25
        ? `\n  ...and ${hardcodedLiteralIssues.length - 25} more`
        : ''),
  );
}

if (failures) {
  console.error(
    `\n${failures} mobile i18n issue(s). Keep all ${expectedLocales.length} catalogs in parity.`,
  );
  process.exit(1);
}

console.log(
  `\nAll ${expectedLocales.length} mobile locales are in parity (${englishKeys.length} keys each).`,
);
