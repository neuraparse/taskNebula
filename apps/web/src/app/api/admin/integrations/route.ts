import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { db, eq, systemAuditLogs } from '@tasknebula/db';
import { integrationClientCredentials } from '@tasknebula/db/src/schema/integration-client-credentials';
import {
  INTEGRATION_PROVIDERS,
  isIntegrationProvider,
  listClientCredentialSummaries,
  type IntegrationProvider,
} from '@/lib/integrations/client-credentials';
import { encryptToken } from '@/lib/integrations/token-crypto';

/**
 * Admin Integration Client Credentials API.
 *
 * GET  /api/admin/integrations          — sanitized list of every known
 *                                         provider (slack, gitlab, jira, ...)
 *                                         with either DB, env, or no config.
 * POST /api/admin/integrations          — upsert {provider, clientId,
 *                                         clientSecret, redirectUri?, scope?}.
 * DELETE /api/admin/integrations?provider=<p> — drops the DB row; env var
 *                                         fallback (if any) still applies.
 *
 * All mutations are guarded by `isSuperAdmin()` and recorded in
 * `system_audit_logs`. Secrets are encrypted with the same AES-256-GCM
 * envelope helper as integration connection tokens.
 */

const PROVIDERS = INTEGRATION_PROVIDERS as readonly IntegrationProvider[];

const upsertSchema = z.object({
  provider: z.enum(PROVIDERS as unknown as [IntegrationProvider, ...IntegrationProvider[]]),
  clientId: z.string().trim().min(1, 'clientId is required'),
  clientSecret: z.string().trim().min(1, 'clientSecret is required'),
  redirectUri: z
    .string()
    .trim()
    .url('redirectUri must be a valid URL')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  scope: z
    .string()
    .trim()
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    } as const;
  }
  const admin = await isSuperAdmin();
  if (!admin) {
    return {
      error: NextResponse.json(
        { error: 'Super admin access required' },
        { status: 403 }
      ),
    } as const;
  }
  return { userId: session.user.id } as const;
}

export async function GET() {
  const authz = await requireAdmin();
  if ('error' in authz) return authz.error;

  const providers = await listClientCredentialSummaries();
  return NextResponse.json({ providers });
}

export async function POST(request: NextRequest) {
  const authz = await requireAdmin();
  if ('error' in authz) return authz.error;

  const parsed = upsertSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
      { status: 400 }
    );
  }
  const { provider, clientId, clientSecret, redirectUri, scope } = parsed.data;

  const clientIdEnc = encryptToken(clientId);
  const clientSecretEnc = encryptToken(clientSecret);

  const [existing] = await db
    .select({ id: integrationClientCredentials.id })
    .from(integrationClientCredentials)
    .where(eq(integrationClientCredentials.provider, provider))
    .limit(1);

  if (existing) {
    await db
      .update(integrationClientCredentials)
      .set({
        clientIdEnc,
        clientSecretEnc,
        redirectUri: redirectUri ?? null,
        scope: scope ?? null,
        updatedBy: authz.userId,
        updatedAt: new Date(),
      })
      .where(eq(integrationClientCredentials.id, existing.id));
  } else {
    await db.insert(integrationClientCredentials).values({
      id: createId(),
      provider,
      clientIdEnc,
      clientSecretEnc,
      redirectUri: redirectUri ?? null,
      scope: scope ?? null,
      updatedBy: authz.userId,
    });
  }

  await db.insert(systemAuditLogs).values({
    id: createId(),
    userId: authz.userId,
    action: existing
      ? 'integration.client_credential_updated'
      : 'integration.client_credential_created',
    resourceType: 'integration_client_credential',
    resourceId: provider,
    metadata: {
      provider,
      hasRedirectUri: Boolean(redirectUri),
      hasScope: Boolean(scope),
    },
  });

  const providers = await listClientCredentialSummaries();
  return NextResponse.json({ providers });
}

export async function DELETE(request: NextRequest) {
  const authz = await requireAdmin();
  if ('error' in authz) return authz.error;

  const providerParam = new URL(request.url).searchParams.get('provider');
  if (!isIntegrationProvider(providerParam)) {
    return NextResponse.json(
      { error: 'Unknown provider' },
      { status: 400 }
    );
  }

  const provider = providerParam;

  const deleted = await db
    .delete(integrationClientCredentials)
    .where(eq(integrationClientCredentials.provider, provider))
    .returning({ id: integrationClientCredentials.id });

  if (deleted.length === 0) {
    return NextResponse.json(
      { error: 'Provider is not configured in the database.' },
      { status: 404 }
    );
  }

  await db.insert(systemAuditLogs).values({
    id: createId(),
    userId: authz.userId,
    action: 'integration.client_credential_removed',
    resourceType: 'integration_client_credential',
    resourceId: provider,
    metadata: { provider },
  });

  const providers = await listClientCredentialSummaries();
  return NextResponse.json({ providers });
}
