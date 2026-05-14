import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, organizationMembers, eq, and } from '@tasknebula/db';
import { getImporter, isImportSource } from '@/lib/importers';
import { suggestColumnMapping, parseCsvText } from '@/lib/importers/csv';

export const dynamic = 'force-dynamic';

/**
 * POST /api/import/[source]/preview
 *
 * Returns the first 20 normalized records produced by the adapter plus a
 * suggested column mapping (CSV only — other adapters return an empty
 * mapping object). The UI uses this to power the "preview + column
 * picker" step before the user clicks "Run import".
 *
 * Request body shape varies by source:
 *   csv:    { workspaceId, csvText, columns? }
 *   linear: { workspaceId, apiKey, teamKey?, first? }
 *   jira:   { workspaceId, site, email, apiToken, jql?, maxResults? }
 *   github: { workspaceId, accessToken, owner, repo, perPage? }
 *
 * `workspaceId` is required on every request — we check membership so
 * one workspace's API key can't be used to preview another's data.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { source } = await params;
  if (!isImportSource(source)) {
    return NextResponse.json(
      { error: `Unknown import source: ${source}` },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const workspaceId =
    typeof body.workspaceId === 'string' ? body.workspaceId : null;
  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspaceId is required' },
      { status: 400 }
    );
  }

  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, session.user.id),
        eq(organizationMembers.organizationId, workspaceId)
      )
    )
    .limit(1);
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adapter = getImporter(source);
  if (!adapter) {
    return NextResponse.json(
      { error: `Adapter for ${source} is not registered.` },
      { status: 500 }
    );
  }

  try {
    let suggestedMapping: Record<string, string> = {};
    let parseInput: unknown;
    if (source === 'csv') {
      const csvText = typeof body.csvText === 'string' ? body.csvText : '';
      const parsed = parseCsvText(csvText);
      suggestedMapping = suggestColumnMapping(parsed.headers) as Record<
        string,
        string
      >;
      parseInput = {
        text: csvText,
        columns:
          typeof body.columns === 'object' && body.columns
            ? body.columns
            : suggestedMapping,
      };
    } else {
      // Non-CSV: pass the body through; the adapter validates required
      // fields and surfaces a clear error if any are missing.
      parseInput = body;
    }

    const records = await adapter.parseSource(parseInput);
    return NextResponse.json({
      source,
      total: records.length,
      sample: records.slice(0, 20),
      suggestedMapping,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Preview failed' },
      { status: 400 }
    );
  }
}
