import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createAuditLog } from '@tasknebula/db';
import { getOrgAgentAccess } from '@/lib/agents/access';
import { createAgentModelConfig, listAgentModelConfigs } from '@/lib/agents/model-configs';

const settingsSchema = z.object({
  temperature: z.number().min(0).max(2).nullable().optional(),
  maxOutputTokens: z.number().min(32).max(300000).nullable().optional(),
  reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high', 'xhigh']).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

const createModelConfigSchema = z.object({
  name: z.string().min(2).max(120),
  provider: z.enum(['native', 'openai', 'anthropic', 'azure', 'custom']),
  model: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  settings: settingsSchema.optional(),
  isDefault: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { organizationId } = await params;
  const access = await getOrgAgentAccess(session.user.id, organizationId);
  if (!access.canView) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true';
  const configs = await listAgentModelConfigs(organizationId, { includeArchived });

  return NextResponse.json({
    organizationId,
    configs,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { organizationId } = await params;
  const access = await getOrgAgentAccess(session.user.id, organizationId);
  if (!access.canManage) {
    return NextResponse.json({ error: 'Only workspace owners and admins can manage model configs.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const payload = createModelConfigSchema.parse(body);
    const config = await createAgentModelConfig({
      organizationId,
      userId: session.user.id,
      name: payload.name,
      provider: payload.provider,
      model: payload.model,
      description: payload.description ?? null,
      settings: payload.settings,
      isDefault: payload.isDefault,
    });

    await createAuditLog({
      userId: session.user.id,
      organizationId,
      action: 'agent.model_config_created',
      resourceType: 'agent_model_config',
      resourceId: config?.id || payload.name,
      changes: {
        modelConfig: {
          from: null,
          to: config,
        },
      },
      metadata: {
        provider: payload.provider,
        model: payload.model,
      },
    });

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    console.error('Failed to create AI model config:', error);
    return NextResponse.json({ error: 'Failed to create AI model config' }, { status: 500 });
  }
}
