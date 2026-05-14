/**
 * Common Zod helper schemas used across TaskNebula API routes.
 *
 * Keep these intentionally small and composable. Route-specific shapes
 * should live alongside the route; only put genuinely reusable primitives
 * here.
 */

import { z } from 'zod';

/**
 * cuid2 identifier — what `@paralleldrive/cuid2` produces.
 *
 * cuid2 ids are 24 lowercase alphanumeric chars starting with a letter.
 * We allow 8–32 to be tolerant of legacy / shorter ids that already exist
 * in the dataset, while still rejecting obvious garbage like empty strings
 * or strings with whitespace / special chars.
 */
export const id = z
  .string()
  .min(1, 'id is required')
  .regex(/^[a-z][a-z0-9]{7,31}$/, 'must be a valid cuid2 id');

/** RFC-4122 UUID (lowercase). Zod's built-in handles validation. */
export const uuid = z.string().uuid();

/** Email — Zod's built-in is good enough for API surface validation. */
export const email = z.string().email().max(320);

/** Sort direction — used in many list endpoints. */
export const sortDir = z.enum(['asc', 'desc']).default('desc');

/**
 * Cursor-based pagination, for use as a query schema (`?limit=…&cursor=…`).
 *
 * `limit` is coerced from string because query params are always strings.
 * Bounded 1..100 to keep request size predictable.
 */
export const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type Pagination = z.infer<typeof pagination>;
export type SortDir = z.infer<typeof sortDir>;
