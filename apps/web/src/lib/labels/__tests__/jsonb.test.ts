/**
 * Unit tests for the jsonb write-through SQL builders (@/lib/labels/jsonb).
 * Uses the real drizzle PgDialect to render the SQL + bound params — no db.
 */
import { PgDialect } from 'drizzle-orm/pg-core';
import { renameLabelInIssuesJsonbSql, removeLabelFromIssuesJsonbSql } from '../jsonb';

const dialect = new PgDialect();

describe('renameLabelInIssuesJsonbSql', () => {
  const query = dialect.sqlToQuery(
    renameLabelInIssuesJsonbSql({ organizationId: 'org_1', oldName: 'bug', newName: 'defect' })
  );

  it('is a single UPDATE over issues.labels', () => {
    expect(query.sql.match(/UPDATE issues/g)).toHaveLength(1);
    expect(query.sql).toContain('SET labels =');
  });

  it('scopes to the organization and to rows containing the old name', () => {
    expect(query.sql).toMatch(/WHERE organization_id = \$\d+/);
    expect(query.sql).toMatch(/AND labels @> \$\d+::jsonb/);
  });

  it('removes the old element and appends the new one only when absent', () => {
    expect(query.sql).toMatch(/labels - \$\d+::text/);
    expect(query.sql).toContain('ELSE');
    // Dedupe guard: append nothing when the new name is already present.
    expect(query.sql).toContain("THEN '[]'::jsonb");
  });

  it('binds names as jsonb-array containment params (no SQL interpolation)', () => {
    expect(query.params).toEqual(['bug', '["defect"]', '["defect"]', 'org_1', '["bug"]']);
    // The raw names never appear in the SQL text itself.
    expect(query.sql).not.toContain('bug');
    expect(query.sql).not.toContain('defect');
  });
});

describe('removeLabelFromIssuesJsonbSql', () => {
  const query = dialect.sqlToQuery(
    removeLabelFromIssuesJsonbSql({ organizationId: 'org_1', name: 'bug' })
  );

  it('is a single org-scoped UPDATE that strips the element', () => {
    expect(query.sql.match(/UPDATE issues/g)).toHaveLength(1);
    expect(query.sql).toMatch(/SET labels = labels - \$\d+::text/);
    expect(query.sql).toMatch(/WHERE organization_id = \$\d+/);
    expect(query.sql).toMatch(/AND labels @> \$\d+::jsonb/);
  });

  it('binds the name and org as params', () => {
    expect(query.params).toEqual(['bug', 'org_1', '["bug"]']);
    expect(query.sql).not.toContain('bug');
  });
});
