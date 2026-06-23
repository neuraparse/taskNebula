import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { agentProviders, and, db, eq, inArray, organizations } from '@tasknebula/db';
import { generateAgentSecret, type AgentProviderKind } from '@/lib/agents/sessions';
import { getLocalAgentRunnerStatus } from '@/lib/agents/local-runner';

export const dynamic = 'force-dynamic';

const LOCAL_PROVIDER_VALUES = ['claude', 'codex'] as const;

const patchSchema = z.object({
  organizationId: z.string().min(1),
  provider: z.enum(LOCAL_PROVIDER_VALUES),
  enabled: z.boolean(),
});

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admin = await isSuperAdmin();
  if (!admin) {
    return {
      response: NextResponse.json({ error: 'Super admin access required' }, { status: 403 }),
    };
  }

  return { session };
}

async function ensureOrganization(organizationId: string) {
  const [organization] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return organization ?? null;
}

async function loadLocalProviders(organizationId: string) {
  const rows = await db
    .select()
    .from(agentProviders)
    .where(
      and(
        eq(agentProviders.workspaceId, organizationId),
        inArray(agentProviders.provider, [...LOCAL_PROVIDER_VALUES])
      )
    );

  return LOCAL_PROVIDER_VALUES.map((provider) => {
    const row = rows.find((item) => item.provider === provider) ?? null;
    const status = getLocalAgentRunnerStatus(
      provider as AgentProviderKind,
      row?.endpointUrl ?? null,
      row?.enabled ?? false
    );

    return {
      provider,
      enabled: Boolean(row?.enabled),
      endpointMode: row?.endpointUrl?.startsWith('local://') ? 'local_cli' : 'webhook',
      configured: Boolean(status?.configured),
      command: status?.command ?? provider,
      cwd: status?.cwd ?? process.cwd(),
      model: status?.model ?? null,
      timeoutSeconds: status?.timeoutSeconds ?? null,
      mode: status?.mode ?? null,
      reasonCode: status?.reasonCode ?? null,
      reasonDetail: status?.reasonDetail ?? null,
      enabledByEnv: Boolean(status?.enabledByEnv),
      enabledByProvider: Boolean(status?.enabledByProvider),
    };
  });
}

export async function GET(request: NextRequest) {
  const guard = await requireSuperAdmin();
  if ('response' in guard) return guard.response;

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }

  const organization = await ensureOrganization(organizationId);
  if (!organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  return NextResponse.json({
    organization,
    providers: await loadLocalProviders(organizationId),
  });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireSuperAdmin();
  if ('response' in guard) return guard.response;

  let parsed: z.infer<typeof patchSchema>;
  try {
    parsed = patchSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: err.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const organization = await ensureOrganization(parsed.organizationId);
  if (!organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const [existing] = await db
    .select()
    .from(agentProviders)
    .where(
      and(
        eq(agentProviders.workspaceId, parsed.organizationId),
        eq(agentProviders.provider, parsed.provider)
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(agentProviders)
      .set({
        endpointUrl: `local://${parsed.provider}`,
        enabled: parsed.enabled,
        hmacSecret: existing.hmacSecret || generateAgentSecret(),
        updatedAt: new Date(),
      })
      .where(eq(agentProviders.id, existing.id));
  } else {
    await db.insert(agentProviders).values({
      workspaceId: parsed.organizationId,
      provider: parsed.provider,
      endpointUrl: `local://${parsed.provider}`,
      hmacSecret: generateAgentSecret(),
      enabled: parsed.enabled,
    });
  }

  return NextResponse.json({
    organization,
    providers: await loadLocalProviders(parsed.organizationId),
  });
}
