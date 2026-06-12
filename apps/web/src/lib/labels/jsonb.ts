/**
 * SQL builders that keep the legacy `issues.labels` jsonb string arrays in
 * step with first-class label renames/deletes. Pure builders (no db import)
 * so they can be unit-tested via `PgDialect.sqlToQuery`.
 *
 * Both statements are single UPDATEs scoped to one organization and guarded
 * by a `labels @> '["<name>"]'` containment check, so only issues that
 * actually carry the name are touched (and rows with malformed non-array
 * jsonb are skipped entirely).
 */
import { sql, type SQL } from 'drizzle-orm';

export interface RenameLabelJsonbParams {
  organizationId: string;
  oldName: string;
  newName: string;
}

/**
 * Replace `oldName` with `newName` in every `issues.labels` array in the org.
 * `jsonb - text` removes all occurrences of the old string element; the new
 * name is appended only if not already present (no duplicates after rename).
 */
export function renameLabelInIssuesJsonbSql(params: RenameLabelJsonbParams): SQL {
  const oldJson = JSON.stringify([params.oldName]);
  const newJson = JSON.stringify([params.newName]);
  return sql`
    UPDATE issues
    SET labels = (labels - ${params.oldName}::text)
        || (CASE WHEN labels @> ${newJson}::jsonb THEN '[]'::jsonb ELSE ${newJson}::jsonb END),
        updated_at = NOW()
    WHERE organization_id = ${params.organizationId}
      AND labels @> ${oldJson}::jsonb
  `;
}

export interface RemoveLabelJsonbParams {
  organizationId: string;
  name: string;
}

/** Remove `name` from every `issues.labels` array in the org. */
export function removeLabelFromIssuesJsonbSql(params: RemoveLabelJsonbParams): SQL {
  const nameJson = JSON.stringify([params.name]);
  return sql`
    UPDATE issues
    SET labels = labels - ${params.name}::text,
        updated_at = NOW()
    WHERE organization_id = ${params.organizationId}
      AND labels @> ${nameJson}::jsonb
  `;
}
