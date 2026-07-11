#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const mobileLocalesDir = path.join(mobileRoot, 'locales');
const webMessagesDir = path.join(repoRoot, 'apps/web/messages');
const write = process.argv.includes('--write');
const check = process.argv.includes('--check');

if (write && check) {
  throw new Error('Use either --write or --check, not both.');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

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

function setPath(target, dottedKey, value) {
  const parts = dottedKey.split('.');
  let current = target;

  for (const part of parts.slice(0, -1)) {
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
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

function localeFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort();
}

const mobileEnglish = flatten(readJson(path.join(mobileLocalesDir, 'en.json')));
const webEnglish = flatten(readJson(path.join(webMessagesDir, 'en.json')));
const webKeysByEnglishValue = new Map();

for (const [key, value] of Object.entries(webEnglish)) {
  if (typeof value !== 'string') continue;

  const keys = webKeysByEnglishValue.get(value) ?? [];
  keys.push(key);
  webKeysByEnglishValue.set(value, keys);
}

const webLocaleSet = new Set(
  localeFiles(webMessagesDir).map((file) => file.replace(/\.json$/, '')),
);
let totalUpdated = 0;
let skippedMissingWebLocale = 0;
let skippedPlaceholderMismatch = 0;
let exactKeyUpdates = 0;
let uniqueValueUpdates = 0;
const perLocale = [];

for (const file of localeFiles(mobileLocalesDir)) {
  const locale = file.replace(/\.json$/, '');
  if (locale === 'en') continue;

  if (!webLocaleSet.has(locale)) {
    skippedMissingWebLocale++;
    continue;
  }

  const mobilePath = path.join(mobileLocalesDir, file);
  const mobileCatalog = readJson(mobilePath);
  const mobileFlat = flatten(mobileCatalog);
  const webFlat = flatten(readJson(path.join(webMessagesDir, file)));
  let updated = 0;

  for (const [mobileKey, englishValue] of Object.entries(mobileEnglish)) {
    if (typeof englishValue !== 'string' || mobileFlat[mobileKey] !== englishValue) continue;

    const expectedPlaceholders = placeholders(englishValue);
    const exactKeyCandidate =
      webEnglish[mobileKey] === englishValue ? webFlat[mobileKey] : undefined;

    if (
      typeof exactKeyCandidate === 'string' &&
      exactKeyCandidate !== englishValue &&
      sameList(placeholders(exactKeyCandidate), expectedPlaceholders)
    ) {
      setPath(mobileCatalog, mobileKey, exactKeyCandidate);
      updated++;
      exactKeyUpdates++;
      continue;
    }

    if (typeof exactKeyCandidate === 'string' && exactKeyCandidate !== englishValue) {
      skippedPlaceholderMismatch++;
      continue;
    }

    const matchingWebKeys = webKeysByEnglishValue.get(englishValue);
    if (!matchingWebKeys) continue;

    const translations = new Set();

    for (const webKey of matchingWebKeys) {
      const candidate = webFlat[webKey];
      if (typeof candidate !== 'string' || candidate === englishValue) continue;

      if (!sameList(placeholders(candidate), expectedPlaceholders)) {
        skippedPlaceholderMismatch++;
        continue;
      }

      translations.add(candidate);
    }

    if (translations.size !== 1) continue;

    setPath(mobileCatalog, mobileKey, [...translations][0]);
    updated++;
    uniqueValueUpdates++;
  }

  if (updated > 0 && write) {
    fs.writeFileSync(mobilePath, `${JSON.stringify(mobileCatalog, null, 2)}\n`);
  }

  totalUpdated += updated;
  perLocale.push([locale, updated]);
}

const topLocales = perLocale
  .filter(([, updated]) => updated > 0)
  .sort((left, right) => right[1] - left[1])
  .slice(0, 10);

console.log(
  JSON.stringify(
    {
      mode: write ? 'write' : check ? 'check' : 'dry-run',
      totalUpdated,
      exactKeyUpdates,
      uniqueValueUpdates,
      localesUpdated: perLocale.filter(([, updated]) => updated > 0).length,
      skippedMissingWebLocale,
      skippedPlaceholderMismatch,
      topLocales,
    },
    null,
    2,
  ),
);

if (check && totalUpdated > 0) {
  console.error(
    `Mobile locale catalogs have ${totalUpdated} stale English fallback value(s) that can be synced from web messages. Run pnpm i18n:sync-web in mobile/.`,
  );
  process.exit(1);
}
