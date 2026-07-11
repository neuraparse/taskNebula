#!/usr/bin/env node
/**
 * Mobile design-token parity guard.
 *
 * The web app's globals.css is the canonical design system source. This guard
 * parses the web HSL variables and verifies the mobile native hex palettes stay
 * aligned for the tokens React Native can represent directly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(mobileRoot, '..');
const webGlobalsPath = path.join(repoRoot, 'apps/web/src/app/globals.css');
const mobileTokensPath = path.join(mobileRoot, 'src/design/tokens.ts');
const mobileThemePath = path.join(mobileRoot, 'src/design/theme.ts');

const failures = [];
const colorTokenMap = {
  background: 'background',
  foreground: 'foreground',
  card: 'card',
  surface: 'surface',
  surface2: 'surface-2',
  muted: 'muted',
  mutedForeground: 'muted-foreground',
  accent: 'accent',
  accentForeground: 'accent-foreground',
  border: 'border',
  borderStrong: 'border-strong',
  input: 'input',
  ring: 'ring',
  primary: 'primary',
  primaryForeground: 'primary-foreground',
  secondary: 'secondary',
  secondaryForeground: 'secondary-foreground',
  success: 'success',
  warning: 'warning',
  destructive: 'destructive',
  destructiveForeground: 'destructive-foreground',
  info: 'info',
  accentBlue: 'accent-blue',
  accentViolet: 'accent-violet',
  accentCyan: 'accent-cyan',
  accentEmerald: 'accent-emerald',
  accentAmber: 'accent-amber',
  accentRose: 'accent-rose',
  accentIndigo: 'accent-indigo',
};
const radiiTokenMap = {
  sm: 'radius-sm',
  md: 'radius',
  lg: 'radius-lg',
};
const colorThemes = ['ocean', 'forest', 'sunset', 'purple', 'rose'];

function fail(message) {
  failures.push(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readBlock(source, selector) {
  const selectorIndex = source.indexOf(selector);
  if (selectorIndex === -1) return null;
  const start = source.indexOf('{', selectorIndex);
  if (start === -1) return null;

  let depth = 0;
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) return source.slice(start + 1, index);
    }
  }

  return null;
}

function parseCssVars(block, label) {
  if (!block) {
    fail(`Missing CSS token block: ${label}`);
    return {};
  }

  const vars = {};
  const pattern = /--([a-z0-9-]+):\s*([^;]+);/gi;
  let match;
  while ((match = pattern.exec(block))) {
    vars[match[1]] = match[2].replace(/\/\*[\s\S]*?\*\//g, '').trim();
  }
  return vars;
}

function readConstObject(source, constName) {
  const declarationIndex = source.search(new RegExp(`(?:export\\s+)?const\\s+${constName}\\b`));
  if (declarationIndex === -1) {
    fail(`Missing ${constName} object in mobile design source.`);
    return null;
  }

  const equalsIndex = source.indexOf('=', declarationIndex);
  const start = source.indexOf('{', equalsIndex);
  if (equalsIndex === -1 || start === -1) {
    fail(`Missing ${constName} object initializer in mobile design source.`);
    return null;
  }

  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index++) {
    const char = source[index];

    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) return source.slice(start + 1, index);
    }
  }

  fail(`Could not parse ${constName} object in mobile design source.`);
  return null;
}

function parseTsHexObject(source, constName) {
  const objectBody = readConstObject(source, constName);
  if (!objectBody) return {};

  const values = {};
  const pattern = /([A-Za-z0-9_]+):\s*'(#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8}))'/g;
  let valueMatch;
  while ((valueMatch = pattern.exec(objectBody))) {
    values[valueMatch[1]] = valueMatch[2].toLowerCase();
  }
  return values;
}

function parseTsNumberObject(source, constName) {
  const objectBody = readConstObject(source, constName);
  if (!objectBody) return {};

  const values = {};
  const pattern = /([A-Za-z0-9_]+):\s*([0-9.]+)/g;
  let valueMatch;
  while ((valueMatch = pattern.exec(objectBody))) {
    values[valueMatch[1]] = Number(valueMatch[2]);
  }
  return values;
}

function parseThemeColorRecord(source, constName) {
  const objectBody = readConstObject(source, constName);
  if (!objectBody) return {};

  const values = {};
  for (const theme of colorThemes) {
    const match = objectBody.match(
      new RegExp(
        `${theme}:\\s*\\{\\s*light:\\s*'(#[0-9A-Fa-f]{6})',\\s*dark:\\s*'(#[0-9A-Fa-f]{6})'\\s*\\}`,
      ),
    );
    if (!match) {
      fail(`Missing ${theme} entry in ${constName}.`);
      continue;
    }
    values[theme] = { light: match[1].toLowerCase(), dark: match[2].toLowerCase() };
  }
  return values;
}

function hslTripletToHex(value, label) {
  const match = value.match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) {
    fail(`CSS token ${label} must be a plain HSL triplet, got "${value}".`);
    return null;
  }

  const h = ((Number(match[1]) % 360) + 360) % 360;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return `#${[r, g, b]
    .map((channel) =>
      Math.round((channel + m) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function remToPx(value, label) {
  const match = value.match(/^([0-9.]+)rem$/);
  if (!match) {
    fail(`CSS token ${label} must be a rem value, got "${value}".`);
    return null;
  }
  return Number(match[1]) * 16;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: mobile ${actual ?? '<missing>'} !== web ${expected ?? '<missing>'}`);
  }
}

const webCss = read(webGlobalsPath);
const mobileTokens = read(mobileTokensPath);
const mobileTheme = read(mobileThemePath);
const rootVars = parseCssVars(readBlock(webCss, ':root'), ':root');
const darkVars = parseCssVars(readBlock(webCss, '.dark'), '.dark');
const mobileDarkColors = parseTsHexObject(mobileTokens, 'colors');
const mobileLightColors = parseTsHexObject(mobileTheme, 'lightColors');
const mobileRadii = parseTsNumberObject(mobileTokens, 'radii');
const mobilePrimary = parseThemeColorRecord(mobileTheme, 'colorThemePrimary');
const mobilePrimaryForeground = parseThemeColorRecord(mobileTheme, 'colorThemePrimaryForeground');
mobilePrimary.default = {
  light: mobileLightColors.primary,
  dark: mobileDarkColors.primary,
};
mobilePrimaryForeground.default = {
  light: mobileLightColors.primaryForeground,
  dark: mobileDarkColors.primaryForeground,
};

for (const [mobileKey, webKey] of Object.entries(colorTokenMap)) {
  assertEqual(
    mobileLightColors[mobileKey],
    hslTripletToHex(rootVars[webKey] ?? '', `:root --${webKey}`),
    `light color ${mobileKey}`,
  );
  assertEqual(
    mobileDarkColors[mobileKey],
    hslTripletToHex(darkVars[webKey] ?? '', `.dark --${webKey}`),
    `dark color ${mobileKey}`,
  );
}

for (const [mobileKey, webKey] of Object.entries(radiiTokenMap)) {
  assertEqual(
    mobileRadii[mobileKey],
    remToPx(rootVars[webKey] ?? '', `:root --${webKey}`),
    `radius ${mobileKey}`,
  );
}

assertEqual(mobilePrimary.default?.light, mobileLightColors.primary, 'default light primary');
assertEqual(mobilePrimary.default?.dark, mobileDarkColors.primary, 'default dark primary');
assertEqual(
  mobilePrimaryForeground.default?.light,
  mobileLightColors.primaryForeground,
  'default light primaryForeground',
);
assertEqual(
  mobilePrimaryForeground.default?.dark,
  mobileDarkColors.primaryForeground,
  'default dark primaryForeground',
);

for (const theme of colorThemes) {
  const lightVars = parseCssVars(
    readBlock(webCss, `[data-theme='${theme}']`),
    `[data-theme='${theme}']`,
  );
  const darkThemeVars = parseCssVars(
    readBlock(webCss, `[data-theme='${theme}'].dark`),
    `[data-theme='${theme}'].dark`,
  );

  assertEqual(
    mobilePrimary[theme]?.light,
    hslTripletToHex(lightVars.primary ?? '', `${theme} --primary`),
    `${theme} light primary`,
  );
  assertEqual(
    mobilePrimary[theme]?.dark,
    hslTripletToHex(darkThemeVars.primary ?? '', `${theme}.dark --primary`),
    `${theme} dark primary`,
  );
  assertEqual(
    mobilePrimaryForeground[theme]?.light,
    hslTripletToHex(lightVars['primary-foreground'] ?? '', `${theme} --primary-foreground`),
    `${theme} light primaryForeground`,
  );
  assertEqual(
    mobilePrimaryForeground[theme]?.dark,
    hslTripletToHex(
      darkThemeVars['primary-foreground'] ?? '',
      `${theme}.dark --primary-foreground`,
    ),
    `${theme} dark primaryForeground`,
  );
}

if (failures.length) {
  console.error(`Design parity verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Design parity verification passed: mobile native tokens match web globals.css.');
