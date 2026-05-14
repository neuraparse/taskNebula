/**
 * GET /api/integrations/slack/authorize?organizationId=<id>
 *
 * Legacy alias for /api/integrations/slack/install. The roadmap renamed the
 * entry point to "install" for clarity, but existing UI buttons may still
 * point here — we 307-redirect so query params are preserved verbatim.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const url = new URL(request.url);
  const target = new URL('/api/integrations/slack/install', url.origin);
  for (const [k, v] of url.searchParams.entries()) {
    target.searchParams.set(k, v);
  }
  return NextResponse.redirect(target.toString(), { status: 307 });
}
