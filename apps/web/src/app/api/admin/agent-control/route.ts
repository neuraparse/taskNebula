import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { getSystemAgentControlSettingsFromDb, upsertSystemAgentControlSettings } from '@/lib/agents/system';
import { getAgentProviderReadiness, normalizeProjectAgentSettings, normalizeWorkspaceAgentSettings } from '@/lib/agents/config';
import { getProviderCredentialStatusFromSettings } from '@/lib/agents/credentials';
import { extractWorkspaceModelConfigId, listAgentModelConfigsByIds } from '@/lib/agents/model-configs';
import { db, agentRuns, organizations, projects, systemAuditLogs, users } from '@tasknebula/db';
import { and, desc, eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { invalidateAiFeatureCache } from '@/lib/ai/feature-gate';

const agentControlSchema = z.object({
  globalEnabled: z.boolean().optional(),
  allowWriteActions: z.boolean().optional(),
  requireSupervisionForAutoMode: z.boolean().optional(),
  maxConcurrentRuns: z.number().min(1).max(50).optional(),
});

export async function GET() {
  // No feature-gate check here — this is where super-admins flip the flag.
  // The super-admin guard below is sufficient for auth.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = await isSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  const [settings, allOrganizations, allProjects, recentRuns] = await Promise.all([
    getSystemAgentControlSettingsFromDb(),
    db.select({ id: organizations.id, settings: organizations.settings, name: organizations.name }).from(organizations),
    db.select({ id: projects.id, settings: projects.settings, name: projects.name, organizationId: projects.organizationId }).from(projects),
    db
      .select({
        id: agentRuns.id,
        kind: agentRuns.kind,
        status: agentRuns.status,
        dryRun: agentRuns.dryRun,
        summary: agentRuns.summary,
        writeActionsCount: agentRuns.writeActionsCount,
        createdAt: agentRuns.createdAt,
        error: agentRuns.error,
        organizationId: organizations.id,
        organizationName: organizations.name,
        projectId: projects.id,
        projectName: projects.name,
        initiatedBy: users.name,
      })
      .from(agentRuns)
      .leftJoin(organizations, eq(agentRuns.organizationId, organizations.id))
      .leftJoin(projects, eq(agentRuns.projectId, projects.id))
      .leftJoin(users, eq(agentRuns.initiatedBy, users.id))
      .orderBy(desc(agentRuns.createdAt))
      .limit(20),
  ]);

  const enabledWorkspaceCount = allOrganizations.filter((organization) =>
    normalizeWorkspaceAgentSettings((organization.settings as Record<string, unknown> | null)?.aiAgents).enabled
  ).length;
  const enabledProjectCount = allProjects.filter((project) =>
    normalizeProjectAgentSettings((project.settings as Record<string, unknown> | null)?.aiAgents).enabled
  ).length;
  const runningRuns = recentRuns.filter((run) => run.status === 'running').length;
  const failedRuns = recentRuns.filter((run) => run.status === 'failed').length;
  const selectedModelConfigIds = Array.from(
    new Set(
      allOrganizations
        .map((organization) => extractWorkspaceModelConfigId(organization.settings as Record<string, unknown> | null))
        .filter((configId): configId is string => Boolean(configId))
    )
  );
  const modelConfigs = await listAgentModelConfigsByIds(selectedModelConfigIds);
  const modelConfigById = new Map(modelConfigs.map((config) => [config.id, config]));
  const workspaceCoverage = allOrganizations
    .map((organization) => {
      const rawWorkspaceSettings = normalizeWorkspaceAgentSettings(
        (organization.settings as Record<string, unknown> | null)?.aiAgents
      );
      const selectedModelConfig = rawWorkspaceSettings.modelConfigId
        ? modelConfigById.get(rawWorkspaceSettings.modelConfigId) || null
        : null;
      const workspaceSettings = selectedModelConfig
        ? normalizeWorkspaceAgentSettings({
            ...rawWorkspaceSettings,
            provider: selectedModelConfig.provider,
            model: selectedModelConfig.model,
            modelConfigId: selectedModelConfig.id,
          })
        : rawWorkspaceSettings;
      const provider = workspaceSettings.provider;
      const providerStatus = getAgentProviderReadiness(
        provider,
        workspaceSettings.model,
        getProviderCredentialStatusFromSettings(organization.settings as Record<string, unknown> | null, provider)
      );
      const enabledProjects = allProjects.filter((project) =>
        project.organizationId === organization.id
        && normalizeProjectAgentSettings((project.settings as Record<string, unknown> | null)?.aiAgents).enabled
      ).length;
      const orgRuns = recentRuns.filter((run) => run.organizationId === organization.id);
      const lastRun = orgRuns[0] ?? null;
      const lastFailure = orgRuns.find((run) => run.status === 'failed') ?? null;

      return {
        organizationId: organization.id,
        organizationName: organization.name,
        workspaceEnabled: workspaceSettings.enabled,
        enabledProjects,
        provider,
        model: workspaceSettings.model,
        selectedModelConfigId: selectedModelConfig?.id || null,
        selectedModelConfigName: selectedModelConfig?.name || null,
        executionMode: workspaceSettings.executionMode,
        providerStatus,
        lastRunAt: lastRun?.createdAt ?? null,
        lastFailure: lastFailure?.error ?? null,
      };
    })
    .sort((left, right) => {
      if (left.workspaceEnabled !== right.workspaceEnabled) {
        return left.workspaceEnabled ? -1 : 1;
      }

      if (left.providerStatus.ready !== right.providerStatus.ready) {
        return left.providerStatus.ready ? 1 : -1;
      }

      return left.organizationName.localeCompare(right.organizationName);
    });
  const providerBreakdown = allOrganizations.reduce<Record<string, { total: number; enabled: number; ready: number; blocked: number }>>(
    (accumulator, organization) => {
      const rawWorkspaceSettings = normalizeWorkspaceAgentSettings(
        (organization.settings as Record<string, unknown> | null)?.aiAgents
      );
      const selectedModelConfig = rawWorkspaceSettings.modelConfigId
        ? modelConfigById.get(rawWorkspaceSettings.modelConfigId) || null
        : null;
      const workspaceSettings = selectedModelConfig
        ? normalizeWorkspaceAgentSettings({
            ...rawWorkspaceSettings,
            provider: selectedModelConfig.provider,
            model: selectedModelConfig.model,
            modelConfigId: selectedModelConfig.id,
          })
        : rawWorkspaceSettings;
      const provider = workspaceSettings.provider;
      const readiness = getAgentProviderReadiness(
        provider,
        workspaceSettings.model,
        getProviderCredentialStatusFromSettings(organization.settings as Record<string, unknown> | null, provider)
      );

      if (!accumulator[provider]) {
        accumulator[provider] = { total: 0, enabled: 0, ready: 0, blocked: 0 };
      }

      accumulator[provider].total += 1;
      if (workspaceSettings.enabled) {
        accumulator[provider].enabled += 1;
        if (readiness.ready) {
          accumulator[provider].ready += 1;
        } else {
          accumulator[provider].blocked += 1;
        }
      }

      return accumulator;
    },
    {}
  );
  const readyWorkspaceCount = Object.values(providerBreakdown).reduce((sum, item) => sum + item.ready, 0);
  const blockedWorkspaceCount = Object.values(providerBreakdown).reduce((sum, item) => sum + item.blocked, 0);
  const serviceStatus = [
    {
      key: 'control-plane',
      label: 'Control plane',
      state: settings.globalEnabled ? 'ready' : 'disabled',
      detail: settings.globalEnabled
        ? 'Workspace and project agent policies can execute when local settings allow it.'
        : 'All agent execution is paused globally.',
    },
    {
      key: 'live-monitoring',
      label: 'Live monitoring',
      state: 'ready',
      detail: 'Project and admin AI panels can subscribe to live run streams.',
    },
    {
      key: 'write-pipeline',
      label: 'Write pipeline',
      state: settings.allowWriteActions ? 'ready' : 'preview',
      detail: settings.allowWriteActions
        ? 'Live writes are allowed when workspace and project policy also permit them.'
        : 'All writes are forced back into preview mode.',
    },
    {
      key: 'provider-coverage',
      label: 'Provider coverage',
      state: blockedWorkspaceCount > 0 ? 'blocked' : 'ready',
      detail: `${readyWorkspaceCount}/${enabledWorkspaceCount} enabled workspaces currently have runnable provider access.`,
    },
  ];

  return NextResponse.json({
    settings,
    stats: {
      enabledWorkspaceCount,
      enabledProjectCount,
      recentRunCount: recentRuns.length,
      runningRuns,
      failedRuns,
      readyWorkspaceCount,
      blockedWorkspaceCount,
    },
    serviceStatus,
    providerBreakdown,
    workspaceCoverage,
    recentRuns,
  });
}

export async function PATCH(request: NextRequest) {
  // No feature-gate check here — this is where super-admins flip the flag.
  // The super-admin guard below is sufficient for auth.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = await isSuperAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updates = agentControlSchema.parse(body);
    const currentSettings = await getSystemAgentControlSettingsFromDb();
    const nextSettings = {
      ...currentSettings,
      ...updates,
    };

    await upsertSystemAgentControlSettings(nextSettings, session.user.id);
    invalidateAiFeatureCache();

    await db.insert(systemAuditLogs).values({
      id: createId(),
      userId: session.user.id,
      action: 'agent.control.updated',
      resourceType: 'system_setting',
      resourceId: 'agent_control_center',
      changes: {
        agentControl: { from: currentSettings, to: nextSettings },
      },
      metadata: {
        updatedFields: Object.keys(updates),
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ settings: nextSettings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    console.error('Failed to update admin agent control:', error);
    return NextResponse.json({ error: 'Failed to update admin agent control' }, { status: 500 });
  }
}
