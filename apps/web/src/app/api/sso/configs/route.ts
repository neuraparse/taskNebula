/**
 * SSO configuration CRUD — requires organization settings permission.
 *
 *   GET   ?organizationId=xxx           → fetch existing config (without privateKey)
 *   POST  body: SsoConfigInput          → upsert config
 *   DELETE ?organizationId=xxx          → disable + delete config
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, ssoConfigs, eq } from '@tasknebula/db';
import { z } from 'zod';
import { hasPermission } from '@/lib/auth/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const upsertSchema = z.object({
  organizationId: z.string().min(1),
  provider: z.enum(['saml', 'oidc']).default('saml'),
  entryPointUrl: z.string().url(),
  issuer: z.string().min(1),
  cert: z.string().min(1),
  privateKey: z.string().nullable().optional(),
  audience: z.string().min(1),
  attributeMap: z.record(z.string()).default({}),
  enabled: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const orgId = new URL(request.url).searchParams.get('organizationId');
  if (!orgId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }
  if (!(await hasPermission(orgId, 'org:settings'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const [row] = await db
    .select()
    .from(ssoConfigs)
    .where(eq(ssoConfigs.workspaceId, orgId))
    .limit(1);
  if (!row) return NextResponse.json({ ssoConfig: null });
  // Never expose privateKey through the API.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { privateKey, ...safe } = row;
  return NextResponse.json({ ssoConfig: { ...safe, hasPrivateKey: !!privateKey } });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  if (!(await hasPermission(parsed.data.organizationId, 'org:settings'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const [existing] = await db
    .select({ id: ssoConfigs.id })
    .from(ssoConfigs)
    .where(eq(ssoConfigs.workspaceId, parsed.data.organizationId))
    .limit(1);

  const values = {
    workspaceId: parsed.data.organizationId,
    provider: parsed.data.provider,
    entryPointUrl: parsed.data.entryPointUrl,
    issuer: parsed.data.issuer,
    cert: parsed.data.cert,
    privateKey: parsed.data.privateKey ?? null,
    audience: parsed.data.audience,
    attributeMap: parsed.data.attributeMap,
    enabled: parsed.data.enabled,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(ssoConfigs).set(values).where(eq(ssoConfigs.id, existing.id));
  } else {
    await db.insert(ssoConfigs).values(values);
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const orgId = new URL(request.url).searchParams.get('organizationId');
  if (!orgId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }
  if (!(await hasPermission(orgId, 'org:settings'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await db.delete(ssoConfigs).where(eq(ssoConfigs.workspaceId, orgId));
  return NextResponse.json({ ok: true });
}
