#!/usr/bin/env node
/**
 * i18n key-parity checker. Verifies every locale catalog in
 * apps/web/messages/*.json has EXACTLY the same set of leaf keys as the
 * English source (en.json) and is valid JSON. Exits non-zero on any drift so
 * it can gate CI / pre-commit.
 *
 *   node scripts/i18n-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/web/messages');
const flatten = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    const np = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, np, out);
    else out[np] = v;
  }
  return out;
};

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
if (!files.includes('en.json')) {
  console.error('en.json not found in', dir);
  process.exit(1);
}
const en = flatten(JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8')));
const enKeys = Object.keys(en);
const enSet = new Set(enKeys);
let bad = 0;

for (const file of files.sort()) {
  const locale = file.replace('.json', '');
  let data;
  try {
    data = flatten(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
  } catch (e) {
    console.error(`✗ ${locale}: invalid JSON — ${e.message}`);
    bad++;
    continue;
  }
  if (locale === 'en') continue;
  const keys = new Set(Object.keys(data));
  const missing = enKeys.filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !enSet.has(k));
  if (missing.length || extra.length) {
    bad++;
    console.error(
      `✗ ${locale}: ${missing.length} missing, ${extra.length} extra` +
        (missing.length ? `\n    missing e.g. ${missing.slice(0, 8).join(', ')}` : '') +
        (extra.length ? `\n    extra e.g. ${extra.slice(0, 8).join(', ')}` : '')
    );
  } else {
    console.log(`✓ ${locale} (${keys.size} keys)`);
  }
}

if (bad) {
  console.error(
    `\n${bad} locale(s) out of parity with en.json (${enKeys.length} keys). Fix before committing.`
  );
  process.exit(1);
}
console.log(`\nAll ${files.length} locales in parity (${enKeys.length} keys each). ✓`);
