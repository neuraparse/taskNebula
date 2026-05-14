/**
 * Importer registry and shared helpers.
 *
 * Centralizes the source → adapter lookup used by the `[source]` API
 * routes. Adapters are intentionally untyped here (`Importer<any>`)
 * because each one consumes a different input shape — the routes
 * validate their own request bodies before handing off.
 */

import type { Importer } from './types';
import { csvImporter } from './csv';
import { linearImporter } from './linear';
import { jiraImporter } from './jira';
import { githubImporter } from './github';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const IMPORTERS: Record<string, Importer<any>> = {
  csv: csvImporter,
  linear: linearImporter,
  jira: jiraImporter,
  github: githubImporter,
};

export type ImportSource = keyof typeof IMPORTERS;

export function isImportSource(value: string): value is ImportSource {
  return value in IMPORTERS;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getImporter(source: string): Importer<any> | null {
  return IMPORTERS[source] ?? null;
}

export * from './types';
