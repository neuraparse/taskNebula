import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createAuditLog, db, eq, organizations, projects, agentRuns } from '@tasknebula/db';
import { getProjectAgentAccess } from '@/lib/agents/access';
import {
  getAgentProviderReadiness,
  getProjectAgentRunAvailability,
  normalizeProjectAgentSettings,
  normalizeWorkspaceAgentSettings,
  resolveEffectiveProjectAgentSettings,
  type AgentCapabilityKey,
} from '@/lib/agents/config';
import { getProviderCredentialStatusFromSettings } from '@/lib/agents/credentials';
import { applyWorkspaceModelConfig } from '@/lib/agents/model-configs';
import { listProjectAgentRuns } from '@/lib/agents/engine';
import { getSystemAgentControlSettingsFromDb } from '@/lib/agents/system';
import { and, count } from 'drizzle-orm';

const capabilitySchema = z.object({
  project_tracking: z.boolean().optional(),
  backlog_triage: z.boolean().optional(),
  sprint_planning: z.boolean().optional(),
  bulk_sprint_creation: z.boolean().optional(),
});

const projectAgentSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  inheritWorkspaceDefaults: z.boolean().optional(),
  executionMode: z.enum(['manual', 'assistive', 'auto']).optional(),
  allowWriteActions: z.boolean().optional(),
  sprintBatchSize: z.number().min(1).max(6).optional(),
  sprintLengthDays: z.number().min(7).max(30).optional(),
  issueCapacityPerSprint: z.number().min(3).max(50).optional(),
  autoAssignToPlannedSprints: z.boolean().optional(),
  capabilities: capabilitySchema.optional(),
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
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = await params;
  const access = await getProjectAgentAccess(session.user.id, projectId);
  if (!access.canView || !access.project) {
    return NextResponse.json({ error: 'Project not found or access denied' }, { status: 403 });
  }

  const [[project], [organization], recentRuns, systemControl, runningRunsResult] = await Promise.all([
    db
      .select({
        id: projects.id,
        key: projects.key,
        name: projects.name,
        settings: projects.settings,
      })
      .from(projects)
      .where(eq(projects.id, access.project.id))
      .limit(1),
    db
      .select({
        id: organizations.id,
        settings: organizations.settings,
        name: organizations.name,
      })
      .from(organizations)
      .where(eq(organizations.id, access.project.organizationId))
      .limit(1),
    listProjectAgentRuns(access.project.id, 10),
    getSystemAgentControlSettingsFromDb(),
    db
      .select({ count: count() })
      .from(agentRuns)
      .where(and(eq(agentRuns.projectId, access.project.id), eq(agentRuns.status, 'running'))),
  ]);

  if (!project || !organization) {
    return NextResponse.json({ error: 'Project context could not be loaded' }, { status: 404 });
  }

  const rawWorkspaceSettings = normalizeWorkspaceAgentSettings(
    (organization.settings as Record<string, unknown> | null)?.aiAgents
  );
  const { workspaceSettings, selectedModelConfig } = await applyWorkspaceModelConfig({
    organizationId: organization.id,
    workspaceSettings: rawWorkspaceSettings,
  });
  const projectSettings = normalizeProjectAgentSettings(
    (project.settings as Record<string, unknown> | null)?.aiAgents
  );
  const effectiveSettings = resolveEffectiveProjectAgentSettings(workspaceSettings, projectSettings, systemControl);
  const providerCredential = getProviderCredentialStatusFromSettings(
    organization.settings as Record<string, unknown> | null,
    effectiveSettings.provider
  );
  const providerStatus = getAgentProviderReadiness(
    effectiveSettings.provider,
    effectiveSettings.model,
    providerCredential
  );
  const runAvailability = getProjectAgentRunAvailability({
    workspaceSettings,
    projectSettings,
    effectiveSettings,
    providerStatus,
    systemControl,
  });
  const runningRuns = Number(runningRunsResult[0]?.count || 0);
  const lastCompletedRun = recentRuns.find((run) => run.status === 'completed') ?? null;
  const lastFailedRun = recentRuns.find((run) => run.status === 'failed') ?? null;
  const lastRunByKind = recentRuns.reduce<Record<string, (typeof recentRuns)[number]>>((accumulator, run) => {
    if (!accumulator[run.kind]) {
      accumulator[run.kind] = run;
    }

    return accumulator;
  }, {});
  const executionIssue = runAvailability.blockingIssue;
  const writeIssue = runAvailability.issues.find(
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
        ? executionIssue.code === 'project_disabled' || executionIssue.code === 'workspace_disabled'
          ? 'disabled'
          : 'blocked'
        : 'ready',
      detail: executionIssue?.detail || 'Project runs can be requested right now.',
    },
    {
      key: 'writes',
      label: 'Write pipeline',
      state: !effectiveSettings.allowWriteActions
        ? 'preview'
        : effectiveSettings.requireApprovalForWrites
          ? 'preview'
          : 'ready',
      detail: writeIssue?.detail || 'Writes are fully available for supported capabilities.',
    },
    {
      key: 'monitoring',
      label: 'Live monitoring',
      state: 'ready',
      detail: 'This project can stream live run progress and logs into the settings panel.',
    },
  ];

  return NextResponse.json({
    project: {
      id: project.id,
      key: project.key,
      name: project.name,
    },
    access,
    workspaceSettings,
    selectedModelConfig,
    projectSettings,
    effectiveSettings,
    providerStatus,
    configIssues: runAvailability.issues,
    runtimeSummary: {
      runningRuns,
      lastRunAt: recentRuns[0]?.createdAt ?? null,
      lastCompletedAt: lastCompletedRun?.completedAt ?? lastCompletedRun?.createdAt ?? null,
      lastFailedAt: lastFailedRun?.completedAt ?? lastFailedRun?.createdAt ?? null,
      lastFailure: lastFailedRun?.error ?? null,
    },
    runAvailability: {
      canRun: runAvailability.canRun,
      reason: runAvailability.reason,
    },
    serviceStatus,
    lastRunByKind,
    recentRuns,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = await params;
  const access = await getProjectAgentAccess(session.user.id, projectId);
  if (!access.canManage || !access.project) {
    return NextResponse.json({ error: 'You do not have permission to manage project agents.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updates = projectAgentSettingsSchema.parse(body);

    const [project] = await db
      .select({
        id: projects.id,
        settings: projects.settings,
      })
      .from(projects)
      .where(eq(projects.id, access.project.id))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const currentSettings = normalizeProjectAgentSettings(
      (project.settings as Record<string, unknown> | null)?.aiAgents
    );

    const nextSettings = normalizeProjectAgentSettings({
      ...currentSettings,
      ...updates,
      capabilities: mergeCapabilities(currentSettings.capabilities, updates.capabilities),
    });

    const nextProjectSettings = {
      ...((project.settings as Record<string, unknown>) || {}),
      aiAgents: nextSettings,
    };

    await db
      .update(projects)
      .set({
        settings: nextProjectSettings,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(eq(projects.id, access.project.id));

    await createAuditLog({
      userId: session.user.id,
      organizationId: access.project.organizationId,
      action: 'agent.config_updated',
      resourceType: 'project_ai_agents',
      resourceId: access.project.id,
      projectId: access.project.id,
      changes: {
        aiAgents: { from: currentSettings, to: nextSettings },
      },
      metadata: {
        scope: 'project',
      },
    });

    return NextResponse.json({
      projectId: access.project.id,
      projectSettings: nextSettings,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    console.error('Failed to update project AI agents:', error);
    return NextResponse.json({ error: 'Failed to update project AI agents' }, { status: 500 });
  }
}
