#!/usr/bin/env node
/**
 * Tracks the remaining mobile locale debt where non-English catalogs still
 * contain the English source value.
 *
 * This is intentionally a debt guard, not proof that translations are done:
 * current fallback keys are allowlisted so the app can keep shipping while the
 * remaining mobile-only copy is translated. New translatable English fallbacks
 * fail CI instead of silently expanding the debt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const localesDir = path.join(mobileRoot, 'locales');
const baselinePath = path.join(mobileRoot, 'i18n-fallback-allowlist.json');
const writeBaseline = process.argv.includes('--write-baseline');
const verbose = process.argv.includes('--verbose');
const criticalFlowPrefixes = ['onboarding.', 'setup.', 'errors.', 'validation.', 'publicShare.'];
const criticalFlowZeroFallbackLocales = localeFiles().map((file) => file.replace(/\.json$/, ''));

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

function stripProtectedSegments(value) {
  return value
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/\{[A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[^{}]+)?\}/g, '')
    .replace(/(?:https?|wss?):\/\/[^\s)]+/g, '')
    .trim();
}

function isTokenLike(value) {
  const normalized = stripProtectedSegments(value).trim();

  if (!normalized || !/[A-Za-z]/.test(normalized)) return true;
  if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normalized)) return true;
  if (/^.+<[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>$/.test(normalized)) return true;
  if (/^\/[A-Za-z0-9._/-]+$/.test(normalized)) return true;
  if (/^[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}(?::\d+)?$/.test(normalized)) return true;
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(normalized)) return true;
  if (/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+){2,}$/.test(normalized)) return true;
  if (/^[A-Z0-9_./:{}[\]\-+% ·#]+$/.test(normalized)) return true;
  if (/^r$/i.test(normalized)) return true;
  if (
    /^(?:TaskNebula|GitHub|GitLab|Jira|Linear|Plane|Plane CSV|Redis|LiveKit|OpenAI|Azure OpenAI|Anthropic|Claude|Codex|Cursor|Devin|Copilot|OpenHands|Slack|Sentry|Datadog|Splunk HEC|Webhook|VS Code|Raycast|draw\.io|OpenAPI|CSV|JSON|PDF|API|MCP|SSO|SAML|OAuth|SMTP|HEAD|Fibonacci|IBM Plex|acme|MOB|MB)$/i.test(
      normalized,
    )
  ) {
    return true;
  }

  return false;
}

function isLikelyTranslatable(value) {
  return (
    typeof value === 'string' &&
    /[A-Za-z]/.test(stripProtectedSegments(value)) &&
    !isTokenLike(value)
  );
}

function isCriticalFlowKey(key) {
  return criticalFlowPrefixes.some((prefix) => key.startsWith(prefix));
}

function localeFiles() {
  return fs
    .readdirSync(localesDir)
    .filter((file) => file.endsWith('.json') && file !== 'en.json')
    .sort();
}

function collectFallbacks() {
  const english = flatten(readJson(path.join(localesDir, 'en.json')));
  let exactEnglishFallbacks = 0;
  let likelyTranslatableFallbacks = 0;
  let criticalFlowFallbacks = 0;
  const likelyTranslatableKeys = new Set();
  const perLocale = {};
  const perKey = new Map();
  const criticalFlowZeroLocaleFailures = new Map();

  for (const file of localeFiles()) {
    const locale = file.replace(/\.json$/, '');
    const catalog = flatten(readJson(path.join(localesDir, file)));
    let localeLikelyTranslatable = 0;

    for (const [key, englishValue] of Object.entries(english)) {
      if (
        typeof englishValue !== 'string' ||
        !/[A-Za-z]/.test(englishValue) ||
        catalog[key] !== englishValue
      ) {
        continue;
      }

      exactEnglishFallbacks++;

      if (!isLikelyTranslatable(englishValue)) continue;

      likelyTranslatableFallbacks++;
      localeLikelyTranslatable++;
      likelyTranslatableKeys.add(key);

      if (isCriticalFlowKey(key)) {
        criticalFlowFallbacks++;

        if (criticalFlowZeroFallbackLocales.includes(locale)) {
          const keys = criticalFlowZeroLocaleFailures.get(locale) ?? [];
          keys.push(key);
          criticalFlowZeroLocaleFailures.set(locale, keys);
        }
      }

      const locales = perKey.get(key) ?? [];
      locales.push(locale);
      perKey.set(key, locales);
    }

    perLocale[locale] = localeLikelyTranslatable;
  }

  return {
    exactEnglishFallbacks,
    likelyTranslatableFallbacks,
    criticalFlowFallbacks,
    likelyTranslatableKeys: [...likelyTranslatableKeys].sort(),
    perLocale,
    criticalFlowZeroLocaleFailures,
    topKeys: [...perKey.entries()]
      .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
      .slice(0, 20)
      .map(([key, locales]) => ({ key, count: locales.length, locales: locales.slice(0, 8) })),
  };
}

const current = collectFallbacks();

if (writeBaseline) {
  fs.writeFileSync(
    baselinePath,
    `${JSON.stringify(
      {
        maxExactEnglishFallbacks: current.exactEnglishFallbacks,
        maxLikelyTranslatableFallbacks: current.likelyTranslatableFallbacks,
        maxCriticalFlowFallbacks: current.criticalFlowFallbacks,
        criticalFlowPrefixes,
        criticalFlowZeroFallbackLocales,
        allowedLikelyTranslatableKeys: current.likelyTranslatableKeys,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote ${path.relative(mobileRoot, baselinePath)}`);
}

const baseline = readJson(baselinePath);
const allowedKeys = new Set(baseline.allowedLikelyTranslatableKeys ?? []);
const newKeys = current.likelyTranslatableKeys.filter((key) => !allowedKeys.has(key));
const failures = [];

if (current.exactEnglishFallbacks > baseline.maxExactEnglishFallbacks) {
  failures.push(
    `exact English fallbacks increased: ${current.exactEnglishFallbacks} > ${baseline.maxExactEnglishFallbacks}`,
  );
}

if (current.likelyTranslatableFallbacks > baseline.maxLikelyTranslatableFallbacks) {
  failures.push(
    `likely translatable English fallbacks increased: ${current.likelyTranslatableFallbacks} > ${baseline.maxLikelyTranslatableFallbacks}`,
  );
}

if (
  Number.isInteger(baseline.maxCriticalFlowFallbacks) &&
  current.criticalFlowFallbacks > baseline.maxCriticalFlowFallbacks
) {
  failures.push(
    `critical auth/setup/public-share fallbacks increased: ${current.criticalFlowFallbacks} > ${baseline.maxCriticalFlowFallbacks}`,
  );
}

for (const [locale, keys] of current.criticalFlowZeroLocaleFailures.entries()) {
  failures.push(
    `${locale} must not have critical auth/setup/public-share English fallbacks: ${keys
      .slice(0, 20)
      .join(', ')}` + (keys.length > 20 ? `, ...and ${keys.length - 20} more` : ''),
  );
}

if (newKeys.length > 0) {
  failures.push(
    `new likely-translatable fallback key(s): ${newKeys.slice(0, 20).join(', ')}` +
      (newKeys.length > 20 ? `, ...and ${newKeys.length - 20} more` : ''),
  );
}

console.log(
  JSON.stringify(
    {
      exactEnglishFallbacks: current.exactEnglishFallbacks,
      likelyTranslatableFallbacks: current.likelyTranslatableFallbacks,
      criticalFlowFallbacks: current.criticalFlowFallbacks,
      criticalFlowZeroFallbackLocales,
      allowedLikelyTranslatableKeys: allowedKeys.size,
      topLocales: Object.entries(current.perLocale)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 10),
      ...(verbose || failures.length > 0 ? { topKeys: current.topKeys } : {}),
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  console.error(`Mobile i18n fallback debt guard failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
