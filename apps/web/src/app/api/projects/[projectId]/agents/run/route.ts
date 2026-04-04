import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createAuditLog, db, eq, organizations, projects } from '@tasknebula/db';
import { getProjectAgentAccess } from '@/lib/agents/access';
import {
  AGENT_RUN_KINDS,
  getAgentProviderReadiness,
  getProjectAgentRunAvailability,
  normalizeProjectAgentSettings,
  normalizeWorkspaceAgentSettings,
  resolveEffectiveProjectAgentSettings,
} from '@/lib/agents/config';
import {
  getProviderCredentialStatusFromSettings,
  resolveProviderApiKeyFromSettings,
} from '@/lib/agents/credentials';
import { applyWorkspaceModelConfig } from '@/lib/agents/model-configs';
import {
  getDailyAgentRunCount,
  getRunningAgentRunCount,
  runProjectAgent,
} from '@/lib/agents/engine';
import { getSystemAgentControlSettingsFromDb } from '@/lib/agents/system';

const runAgentSchema = z.object({
  kind: z.enum(AGENT_RUN_KINDS),
  dryRun: z.boolean().optional().default(false),
});

export async function POST(
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
    return NextResponse.json({ error: 'You do not have permission to run project agents.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { kind, dryRun } = runAgentSchema.parse(body);

    const [[project], [organization], systemControl] = await Promise.all([
      db
        .select({
          id: projects.id,
          settings: projects.settings,
          organizationId: projects.organizationId,
        })
        .from(projects)
        .where(eq(projects.id, access.project.id))
        .limit(1),
      db
        .select({
          id: organizations.id,
          settings: organizations.settings,
        })
        .from(organizations)
        .where(eq(organizations.id, access.project.organizationId))
        .limit(1),
      getSystemAgentControlSettingsFromDb(),
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
    const effectiveSettings = resolveEffectiveProjectAgentSettings(
      workspaceSettings,
      projectSettings,
      systemControl
    );
    const providerStatus = getAgentProviderReadiness(
      effectiveSettings.provider,
      effectiveSettings.model,
      getProviderCredentialStatusFromSettings(
        organization.settings as Record<string, unknown> | null,
        effectiveSettings.provider
      )
    );
    const runAvailability = getProjectAgentRunAvailability({
      workspaceSettings,
      projectSettings,
      effectiveSettings,
      providerStatus,
      systemControl,
    });

    if (!systemControl.globalEnabled) {
      return NextResponse.json({ error: 'Agents are paused globally by the admin team.' }, { status: 409 });
    }

    if (!workspaceSettings.enabled) {
      return NextResponse.json({ error: 'Workspace AI agents are disabled.' }, { status: 409 });
    }

    if (!projectSettings.enabled) {
      return NextResponse.json({ error: 'Project AI agents are disabled for this project.' }, { status: 409 });
    }

    if (!effectiveSettings.capabilities[kind]) {
      return NextResponse.json({ error: 'This agent capability is disabled for the project.' }, { status: 409 });
    }

    if (!runAvailability.canRun) {
      return NextResponse.json(
        {
          error: runAvailability.reason || 'Project agent run is blocked by configuration.',
          configIssue: runAvailability.blockingIssue,
          configIssues: runAvailability.issues,
        },
        { status: 409 }
      );
    }

    const [dailyCount, runningCount] = await Promise.all([
      getDailyAgentRunCount(access.project.organizationId),
      getRunningAgentRunCount(),
    ]);

    if (dailyCount >= effectiveSettings.dailyRunLimit) {
      return NextResponse.json(
        { error: `Daily agent run limit reached (${effectiveSettings.dailyRunLimit}).` },
        { status: 429 }
      );
    }

    if (runningCount >= systemControl.maxConcurrentRuns) {
      return NextResponse.json(
        { error: 'Too many agent runs are already in progress. Try again in a moment.' },
        { status: 429 }
      );
    }

    await createAuditLog({
      userId: session.user.id,
      organizationId: access.project.organizationId,
      action: 'agent.run_requested',
      resourceType: 'project_ai_agents',
      resourceId: access.project.id,
      projectId: access.project.id,
      metadata: {
        kind,
        dryRun,
      },
    });

    const result = await runProjectAgent({
      projectId: access.project.id,
      userId: session.user.id,
      kind,
      workspaceSettings,
      projectSettings,
      systemControl,
      dryRun,
      selectedModelConfig,
      providerApiKey: resolveProviderApiKeyFromSettings(
        organization.settings as Record<string, unknown> | null,
        effectiveSettings.provider
      ),
    });

    if (result.run.status === 'failed') {
      return NextResponse.json(
        {
          ...result,
          error: result.run.error || 'Agent run failed',
        },
        { status: result.httpStatus || 500 }
      );
    }

    return NextResponse.json(result, { status: result.httpStatus || 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    console.error('Failed to run project agent:', error);
    return NextResponse.json({ error: 'Failed to run project agent' }, { status: 500 });
  }
}
