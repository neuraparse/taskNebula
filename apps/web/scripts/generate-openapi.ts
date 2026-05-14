#!/usr/bin/env tsx
/**
 * Generate `apps/web/public/openapi.json` from the registered routes.
 *
 * Importing `@/lib/openapi/routes` runs every route registration as a
 * side-effect. We then ask the registry for the full document and write it
 * to disk.
 *
 * Run with:
 *   pnpm --filter @tasknebula/web openapi:gen
 *
 * CI invokes the script and then `jest openapi` — the snapshot test fails
 * if the on-disk file disagrees with the freshly generated one.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Side-effect import — registers every documented route.
import '../src/lib/openapi/routes';
import { buildOpenApiDocument } from '../src/lib/openapi/registry';

const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'openapi.json');

function main() {
  const doc = buildOpenApiDocument();
  const serialized = JSON.stringify(doc, null, 2) + '\n';
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, serialized, 'utf8');
  // eslint-disable-next-line no-console
  console.log(
    `openapi: wrote ${OUTPUT_PATH} (${serialized.length} bytes, ${
      Object.keys(doc.paths ?? {}).length
    } paths)`
  );
}

main();
