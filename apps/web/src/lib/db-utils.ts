/**
 * Database utility helpers for narrowing result row types.
 *
 * Drizzle's `.returning()` / `.select()` calls return arrays whose elements
 * are typed as `T | undefined` after destructuring. In many API routes we
 * know the operation produced at least one row and need to access its
 * fields directly. These helpers provide a terse, throw-on-empty path.
 */

export function firstOrThrow<T>(
  rows: T[],
  message = 'Expected a row but got none',
): T {
  const row = rows[0];
  if (!row) {
    throw new Error(message);
  }
  return row;
}
