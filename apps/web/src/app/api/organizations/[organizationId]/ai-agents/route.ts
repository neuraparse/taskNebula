import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createAuditLog, db, eq, organizations, projects, agentRuns, users } from '@tasknebula/db';
import { getOrgAgentAccess } from '@/lib/agents/access';
import {
  getAgentProviderReadiness,
  getWorkspaceAgentConfigIssues,
  normalizeProjectAgentSettings,
  normalizeWorkspaceAgentSettings,
  type AgentCapabilityKey,
} from '@/lib/agents/config';
import {
  getProviderCredentialStatusFromSettings,
  removeProviderSecretFromSettings,
  upsertProviderSecretInSettings,
} from '@/lib/agents/credentials';
import {
  applyWorkspaceModelConfig,
  getAgentModelConfigById,
  listAgentModelConfigs,
} from '@/lib/agents/model-configs';
import { getSystemAgentControlSettingsFromDb } from '@/lib/agents/system';
import { and, count, desc } from 'drizzle-orm';

const capabilitySchema = z.object({
  project_tracking: z.boolean().optional(),
  backlog_triage: z.boolean().optional(),
  sprint_planning: z.boolean().optional(),
  bulk_sprint_creation: z.boolean().optional(),
});

const workspaceAgentSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  modelConfigId: z.string().min(1).max(255).nullable().optional(),
  provider: z.enum(['native', 'openai', 'anthropic', 'azure', 'custom']).optional(),
  model: z.string().min(1).max(255).optional(),
  executionMode: z.enum(['manual', 'assistive', 'auto']).optional(),
  allowWriteActions: z.boolean().optional(),
  requireApprovalForWrites: z.boolean().optional(),
  dailyRunLimit: z.number().min(1).max(500).optional(),
  capabilities: capabilitySchema.optional(),
  credential: z.object({
    provider: z.enum(['openai']).default('openai'),
    apiKey: z.string().min(20).max(500).optional(),
    remove: z.boolean().optional(),
  }).optional(),
});

function mergeCapabilities(
  current: Record<AgentCapabilityKey, boolean>,
  updates: Partial<Record<AgentCapabilityKey, boolean>> | undefined
) {
  return {
    ...current,
    ...(updates || {}),
  };
}

export async function GET(
  _request: NextRequest,
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

  const [[organization], systemControl] = await Promise.all([
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        settings: organizations.settings,
        updatedAt: organizations.updatedAt,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1),
    getSystemAgentControlSettingsFromDb(),
  ]);

  if (!organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const rawWorkspaceSettings = normalizeWorkspaceAgentSettings(
    (organization.settings as Record<string, unknown> | null)?.aiAgents
  );
  const [
    { workspaceSettings, selectedModelConfig },
    orgProjects,
    recentRuns,
    totalRunsResult,
    runningRunsResult,
    modelConfigs,
  ] = await Promise.all([
    applyWorkspaceModelConfig({
      organizationId,
      workspaceSettings: rawWorkspaceSettings,
    }),
    db
      .select({
        id: projects.id,
        settings: projects.settings,
      })
      .from(projects)
      .where(eq(projects.organizationId, organizationId)),
    db
      .select({
        id: agentRuns.id,
        kind: agentRuns.kind,
        status: agentRuns.status,
        dryRun: agentRuns.dryRun,
        summary: agentRuns.summary,
        writeActionsCount: agentRuns.writeActionsCount,
        createdAt: agentRuns.createdAt,
        completedAt: agentRuns.completedAt,
        error: agentRuns.error,
        projectId: projects.id,
        projectName: projects.name,
        initiatedBy: users.name,
      })
      .from(agentRuns)
      .leftJoin(projects, eq(agentRuns.projectId, projects.id))
      .leftJoin(users, eq(agentRuns.initiatedBy, users.id))
      .where(eq(agentRuns.organizationId, organizationId))
      .orderBy(desc(agentRuns.createdAt))
      .limit(8),
    db
      .select({ count: count() })
      .from(agentRuns)
      .where(eq(agentRuns.organizationId, organizationId)),
    db
      .select({ count: count() })
      .from(agentRuns)
      .where(and(eq(agentRuns.organizationId, organizationId), eq(agentRuns.status, 'running'))),
    listAgentModelConfigs(organizationId),
  ]);
  const providerCredential = getProviderCredentialStatusFromSettings(
    organization.settings as Record<string, unknown> | null,
    workspaceSettings.provider
  );
  const providerStatus = getAgentProviderReadiness(
    workspaceSettings.provider,
    workspaceSettings.model,
    providerCredential
  );
  const enabledProjectCount = orgProjects.filter((project) =>
    normalizeProjectAgentSettings((project.settings as Record<string, unknown> | null)?.aiAgents).enabled
  ).length;
  const configIssues = getWorkspaceAgentConfigIssues({
    workspaceSettings,
    providerStatus,
    systemControl,
  });
  const lastCompletedRun = recentRuns.find((run) => run.status === 'completed') ?? null;
  const lastFailedRun = recentRuns.find((run) => run.status === 'failed') ?? null;
  const totalRuns = Number(totalRunsResult[0]?.count || 0);
  const runningRuns = Number(runningRunsResult[0]?.count || 0);
  const executionIssue = configIssues.find((issue) => issue.blocksRuns) ?? null;
  const writeIssue = configIssues.find(
    (issue) => !issue.blocksRuns && (issue.code === 'writes_preview_only' || issue.code === 'write_approval_required')
  ) ?? null;
  const serviceStatus = [
    {
      key: 'provider',
      label: 'Provider adapter',
      state: providerStatus.ready ? 'ready' : 'blocked',
      detail: providerStatus.summary,
    },
    {
      key: 'execution',
      label: 'Run API',
      state: executionIssue
        ? executionIssue.code === 'workspace_disabled'
          ? 'disabled'
          : 'blocked'
        : 'ready',
      detail: executionIssue?.detail || 'Projects can request runs from the AI control plane.',
    },
    {
      key: 'writes',
      label: 'Write pipeline',
      state: !workspaceSettings.allowWriteActions
        ? 'preview'
        : workspaceSettings.requireApprovalForWrites
          ? 'preview'
          : 'ready',
      detail: writeIssue?.detail || 'Writes are allowed when projects request live runs.',
    },
    {
      key: 'monitoring',
      label: 'Live monitoring',
      state: 'ready',
      detail: 'Project and admin AI panels can subscribe to live run events.',
    },
  ];

  return NextResponse.json({
    organizationId: organization.id,
    organizationName: organization.name,
    workspaceSettings,
    selectedModelConfig,
    modelConfigs,
    access,
    providerStatus,
    configIssues,
    runtimeSummary: {
      projectCount: orgProjects.length,
      enabledProjectCount,
      runningRuns,
      totalRuns,
      lastRunAt: recentRuns[0]?.createdAt ?? null,
      lastCompletedAt: lastCompletedRun?.completedAt ?? lastCompletedRun?.createdAt ?? null,
      lastFailedAt: lastFailedRun?.completedAt ?? lastFailedRun?.createdAt ?? null,
      lastFailure: lastFailedRun?.error ?? null,
    },
    serviceStatus,
    recentRuns,
    updatedAt: organization.updatedAt,
  });
}

export async function PATCH(
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
    return NextResponse.json({ error: 'Only workspace owners and admins can manage AI agents.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updates = workspaceAgentSettingsSchema.parse(body);

    const [organization] = await db
      .select({
        id: organizations.id,
        settings: organizations.settings,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const currentSettings = normalizeWorkspaceAgentSettings(
      (organization.settings as Record<string, unknown> | null)?.aiAgents
    );

    const nextSettings = normalizeWorkspaceAgentSettings({
      ...currentSettings,
      ...updates,
      capabilities: mergeCapabilities(currentSettings.capabilities, updates.capabilities),
    });
    const selectedModelConfig = nextSettings.modelConfigId
      ? await getAgentModelConfigById(organizationId, nextSettings.modelConfigId)
      : null;

    if (nextSettings.modelConfigId && (!selectedModelConfig || selectedModelConfig.isArchived)) {
      return NextResponse.json(
        {
          error: 'The selected model config is missing or archived. Pick another saved profile or switch back to manual mode.',
        },
        { status: 409 }
      );
    }

    const appliedNextSettings = selectedModelConfig
      ? normalizeWorkspaceAgentSettings({
          ...nextSettings,
          provider: selectedModelConfig.provider,
          model: selectedModelConfig.model,
          modelConfigId: selectedModelConfig.id,
        })
      : nextSettings;

    let nextOrganizationSettings: Record<string, unknown> = {
      ...((organization.settings as Record<string, unknown>) || {}),
      aiAgents: appliedNextSettings,
    };

    if (updates.credential?.provider === 'openai' && updates.credential.apiKey) {
      nextOrganizationSettings = {
        ...upsertProviderSecretInSettings({
          settings: nextOrganizationSettings,
          provider: 'openai',
          apiKey: updates.credential.apiKey,
          userId: session.user.id,
        }),
        aiAgents: appliedNextSettings,
      };
    } else if (updates.credential?.provider === 'openai' && updates.credential.remove) {
      nextOrganizationSettings = {
        ...removeProviderSecretFromSettings({
          settings: nextOrganizationSettings,
          provider: 'openai',
        }),
        aiAgents: appliedNextSettings,
      };
    }

    await db
      .update(organizations)
      .set({
        settings: nextOrganizationSettings,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    await createAuditLog({
      userId: session.user.id,
      organizationId,
      action: 'agent.config_updated',
      resourceType: 'organization_ai_agents',
      resourceId: organizationId,
      changes: {
        aiAgents: { from: currentSettings, to: appliedNextSettings },
      },
      metadata: {
        scope: 'organization',
        modelConfigId: appliedNextSettings.modelConfigId || null,
      },
    });

    return NextResponse.json({
      organizationId,
      workspaceSettings: appliedNextSettings,
      selectedModelConfig,
      providerStatus: getAgentProviderReadiness(
        appliedNextSettings.provider,
        appliedNextSettings.model,
        getProviderCredentialStatusFromSettings(nextOrganizationSettings, appliedNextSettings.provider)
      ),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    console.error('Failed to update workspace AI agents:', error);
    return NextResponse.json({ error: 'Failed to update workspace AI agents' }, { status: 500 });
  }
}
