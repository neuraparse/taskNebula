#!/usr/bin/env node

/**
 * TaskNebula UI quality gate.
 *
 * This script intentionally checks only deterministic design invariants.
 * Visual hierarchy, responsive composition, and state behavior still require
 * browser review (see apps/web/DESIGN.md).
 */

import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const WEB_ROOT = resolve(REPO_ROOT, 'apps/web');
const WEB_SOURCE = resolve(WEB_ROOT, 'src');
const ROUTE_MANIFEST = resolve(WEB_ROOT, 'design-route-manifest.json');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const EXCLUDED_SEGMENTS = ['/__tests__/', '/e2e/', '/test-results/'];

const LARGE_RADIUS_EXEMPTIONS = ['/components/marketing/', '/components/landing/'];

const GRADIENT_EXEMPTIONS = [
  '/components/marketing/',
  '/components/landing/',
  '/app/page.tsx',
  '/components/branding/tasknebula-logo.tsx',
];

const LITERAL_PROP_EXEMPTIONS = [
  '/components/marketing/',
  '/components/landing/',
  '/app/page.tsx',
  '/app/global-error.tsx',
  '/app/offline/',
];

const RULES = [
  {
    id: 'generic-large-radius',
    description:
      'Generic product UI uses rounded-md/rounded-lg; rounded-xl+ is reserved for an intentional hero.',
    pattern: /\brounded-(?:xl|2xl|3xl)\b/g,
    exemptions: LARGE_RADIUS_EXEMPTIONS,
  },
  {
    id: 'decorative-product-gradient',
    description:
      'Authenticated and utility product UI uses semantic flat color, not decorative gradients.',
    pattern:
      /\b(?:bg-gradient(?:-[a-z]+)*|from-(?:indigo|violet|purple|blue|cyan|emerald|amber|rose|pink)-\d{2,3})\b/g,
    exemptions: GRADIENT_EXEMPTIONS,
  },
  {
    id: 'slow-ui-transition',
    description: 'Interactive UI transitions stay within the 100–400ms product motion band.',
    pattern: /\bduration-(?:500|700|1000)\b|\bduration-\[(?:[5-9]\d{2}|\d{4,})ms\]/g,
    exemptions: ['/components/marketing/', '/components/landing/'],
  },
  {
    id: 'heavy-floating-shadow',
    description:
      'Product overlays use restrained elevation; shadow-xl/2xl is reserved for marketing artwork.',
    pattern: /\bshadow-(?:xl|2xl)\b/g,
    exemptions: ['/components/marketing/', '/components/landing/'],
  },
  {
    id: 'decorative-product-glass',
    description:
      'Product overlays use opaque semantic surfaces instead of glassmorphism utilities.',
    pattern: /\b(?:glass-panel|surface-glass)\b/g,
    exemptions: ['/components/marketing/', '/components/landing/'],
  },
  {
    id: 'placeholder-ui-action',
    description:
      'User actions must call real behavior; console.info/debug is not an interaction implementation.',
    pattern: /\bconsole\.(?:info|debug)\s*\(/g,
    exemptions: ['/lib/', '/app/api/'],
  },
  {
    id: 'literal-user-facing-prop',
    description:
      'Visible string props must use next-intl (placeholder, aria-label, title, alt, label, description, tooltip).',
    pattern:
      /\b(?:placeholder|aria-label|title|alt|label|description|tooltip)\s*=\s*(?:"[A-Za-z][^"]*"|'[A-Za-z][^']*'|\{\s*(?:"[A-Za-z][^"]*"|'[A-Za-z][^']*')\s*\})/g,
    exemptions: LITERAL_PROP_EXEMPTIONS,
  },
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolute)));
      continue;
    }

    const extension = entry.name.slice(entry.name.lastIndexOf('.'));
    if (SOURCE_EXTENSIONS.has(extension)) files.push(absolute);
  }

  return files;
}

function normalize(file) {
  return `/${relative(REPO_ROOT, file).replaceAll('\\', '/')}`;
}

function isExcluded(path) {
  return EXCLUDED_SEGMENTS.some((segment) => path.includes(segment)) || path.endsWith('.test.tsx');
}

function lineForOffset(source, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function isExempt(path, exemptions) {
  return exemptions.some((segment) => path.includes(segment));
}

const findings = [];
const files = (await walk(WEB_SOURCE)).filter((file) => !isExcluded(normalize(file)));

function addManifestFinding(match, description) {
  findings.push({
    rule: 'route-design-contract',
    description,
    path: relative(REPO_ROOT, ROUTE_MANIFEST).replaceAll('\\', '/'),
    line: 1,
    match,
  });
}

let routeManifest;

try {
  routeManifest = JSON.parse(await readFile(ROUTE_MANIFEST, 'utf8'));
} catch (error) {
  addManifestFinding(
    'invalid manifest',
    `The route design manifest must be readable JSON: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
}

if (routeManifest) {
  const declaredArchetypes = new Set(
    Array.isArray(routeManifest.archetypes) ? routeManifest.archetypes : []
  );
  const routes = Array.isArray(routeManifest.routes) ? routeManifest.routes : [];
  const actualPages = files
    .filter((file) => file.endsWith('/page.tsx'))
    .map((file) => relative(WEB_ROOT, file).replaceAll('\\', '/'))
    .sort();
  const actualPageSet = new Set(actualPages);
  const manifestPageSet = new Set();

  if (routeManifest.version !== 1) {
    addManifestFinding(
      `version ${String(routeManifest.version)}`,
      'The route design manifest version must be 1 until a migration is implemented.'
    );
  }

  if (declaredArchetypes.size === 0) {
    addManifestFinding(
      'no archetypes',
      'The route design manifest must declare the allowed page archetypes.'
    );
  }

  for (const route of routes) {
    const source = typeof route?.source === 'string' ? route.source : '';
    const archetype = typeof route?.archetype === 'string' ? route.archetype : '';
    const decision = typeof route?.decision === 'string' ? route.decision.trim() : '';

    if (!source) {
      addManifestFinding(
        'missing source',
        'Every route design contract needs the repository-relative source of its page.tsx.'
      );
      continue;
    }

    if (manifestPageSet.has(source)) {
      addManifestFinding(
        source,
        'Each page.tsx must appear exactly once in the route design manifest.'
      );
    }
    manifestPageSet.add(source);

    if (!declaredArchetypes.has(archetype)) {
      addManifestFinding(
        `${source}: ${archetype || 'missing archetype'}`,
        'Every route must use an archetype declared by the route design manifest.'
      );
    }

    if (decision.length < 20) {
      addManifestFinding(
        `${source}: missing decision`,
        'Every route must name the primary user decision so hierarchy can be reviewed objectively.'
      );
    }
  }

  for (const source of actualPages) {
    if (!manifestPageSet.has(source)) {
      addManifestFinding(
        source,
        'Every web page must be mapped to an archetype and primary decision before it ships.'
      );
    }
  }

  for (const source of manifestPageSet) {
    if (!actualPageSet.has(source)) {
      addManifestFinding(
        source,
        'Route design contracts must point to an existing page.tsx and be removed with deleted routes.'
      );
    }
  }
}

for (const file of files) {
  const path = normalize(file);
  const source = await readFile(file, 'utf8');

  for (const rule of RULES) {
    if (isExempt(path, rule.exemptions)) continue;

    rule.pattern.lastIndex = 0;
    for (const match of source.matchAll(rule.pattern)) {
      findings.push({
        rule: rule.id,
        description: rule.description,
        path: path.slice(1),
        line: lineForOffset(source, match.index ?? 0),
        match: match[0],
      });
    }
  }
}

if (findings.length > 0) {
  process.stderr.write(`UI quality check failed with ${findings.length} finding(s).\n\n`);

  for (const finding of findings) {
    process.stderr.write(
      `${finding.path}:${finding.line} [${finding.rule}] ${finding.match}\n` +
        `  ${finding.description}\n`
    );
  }

  process.exitCode = 1;
} else {
  process.stdout.write(
    `UI quality check passed: ${files.length} source files satisfy ${RULES.length} static rules and the route design contract.\n`
  );
}
