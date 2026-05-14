/**
 * SP metadata.xml — what the IdP admin uploads to configure trust with us.
 */
import { NextResponse } from 'next/server';
import { loadSsoForSlug } from '@/lib/sso/workspace';
import { getBaseUrl, getSpMetadataXml, type SamlContext } from '@/lib/sso/saml';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workspace_slug: string }> }
) {
  const { workspace_slug: slug } = await params;
  const workspace = await loadSsoForSlug(slug);
  if (!workspace) {
    return NextResponse.json({ error: 'Unknown workspace' }, { status: 404 });
  }

  const ctx: SamlContext = {
    config: workspace.config,
    workspaceSlug: workspace.workspaceSlug,
    baseUrl: getBaseUrl(),
  };

  try {
    const xml = getSpMetadataXml(ctx);
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/samlmetadata+xml; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Failed to build SAML metadata:', err);
    return NextResponse.json(
      { error: 'Failed to build SAML metadata' },
      { status: 500 }
    );
  }
}
