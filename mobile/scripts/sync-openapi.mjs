import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(__dirname, '..');
const repoRoot = resolve(mobileRoot, '..');
const source = resolve(repoRoot, 'apps/web/public/openapi.json');
const target = resolve(mobileRoot, 'src/api/openapi.json');

if (!existsSync(source)) {
  throw new Error(`Missing OpenAPI source: ${source}`);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);

console.log(`synced ${source} -> ${target}`);
