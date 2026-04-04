import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createAuditLog, db, eq, organizations } from '@tasknebula/db';
import { getOrgAgentAccess } from '@/lib/agents/access';
import { getAgentModelConfigById, updateAgentModelConfig } from '@/lib/agents/model-configs';

const settingsSchema = z.object({
  temperature: z.number().min(0).max(2).nullable().optional(),
  maxOutputTokens: z.number().min(32).max(300000).nullable().optional(),
  reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high', 'xhigh']).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

const updateModelConfigSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  provider: z.enum(['native', 'openai', 'anthropic', 'azure', 'custom']).optional(),
  model: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  settings: settingsSchema.optional(),
  isDefault: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

async function loadOrganizationSettings(organizationId: string) {
  const [organization] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return (organization?.settings as Record<string, unknown> | null) || null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string; configId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { organizationId, configId } = await params;
  const access = await getOrgAgentAccess(session.user.id, organizationId);
  if (!access.canManage) {
    return NextResponse.json({ error: 'Only workspace owners and admins can manage model configs.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updates = updateModelConfigSchema.parse(body);
    const current = await getAgentModelConfigById(organizationId, configId);

    if (!current) {
      return NextResponse.json({ error: 'Model config not found.' }, { status: 404 });
    }

    const next = await updateAgentModelConfig({
      organizationId,
      configId,
      userId: session.user.id,
      name: updates.name ?? current.name,
      provider: updates.provider ?? current.provider,
      model: updates.model ?? current.model,
      description: updates.description === undefined ? current.description : updates.description,
      settings: updates.settings ?? current.settings,
      isDefault: updates.isDefault ?? current.isDefault,
      isArchived: updates.isArchived ?? current.isArchived,
    });

    await createAuditLog({
      userId: session.user.id,
      organizationId,
      action: 'agent.model_config_updated',
      resourceType: 'agent_model_config',
      resourceId: configId,
      changes: {
        modelConfig: {
          from: current,
          to: next,
        },
      },
      metadata: {
        archived: updates.isArchived ?? false,
      },
    });

    return NextResponse.json({ config: next });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    console.error('Failed to update AI model config:', error);
    return NextResponse.json({ error: 'Failed to update AI model config' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ organizationId: string; configId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { organizationId, configId } = await params;
  const access = await getOrgAgentAccess(session.user.id, organizationId);
  if (!access.canManage) {
    return NextResponse.json({ error: 'Only workspace owners and admins can manage model configs.' }, { status: 403 });
  }

  const [current, organizationSettings] = await Promise.all([
    getAgentModelConfigById(organizationId, configId),
    loadOrganizationSettings(organizationId),
  ]);

  if (!current) {
    return NextResponse.json({ error: 'Model config not found.' }, { status: 404 });
  }

  const selectedModelConfigId =
    typeof organizationSettings?.aiAgents === 'object'
      && organizationSettings.aiAgents !== null
      && typeof (organizationSettings.aiAgents as Record<string, unknown>).modelConfigId === 'string'
      ? ((organizationSettings.aiAgents as Record<string, unknown>).modelConfigId as string)
      : null;

  if (selectedModelConfigId === configId) {
    return NextResponse.json(
      { error: 'This model config is currently applied to the workspace. Switch the workspace policy first.' },
      { status: 409 }
    );
  }

  const archived = await updateAgentModelConfig({
    organizationId,
    configId,
    userId: session.user.id,
    name: current.name,
    provider: current.provider,
    model: current.model,
    description: current.description,
    settings: current.settings,
    isDefault: false,
    isArchived: true,
  });

  await createAuditLog({
    userId: session.user.id,
    organizationId,
    action: 'agent.model_config_archived',
    resourceType: 'agent_model_config',
    resourceId: configId,
    changes: {
      modelConfig: {
        from: current,
        to: archived,
      },
    },
  });

  return NextResponse.json({ config: archived });
}
