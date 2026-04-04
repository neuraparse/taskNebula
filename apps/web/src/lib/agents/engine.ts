import { createId } from '@paralleldrive/cuid2';
import {
  agentRuns,
  createActivity,
  createAuditLog,
  db,
  desc,
  eq,
  issues,
  projects,
  sprints,
  workflowStatuses,
} from '@tasknebula/db';
import { and, count, gte } from 'drizzle-orm';
import { publishEvent } from '@/lib/realtime/events';
import { emitAgentLog, emitAgentStatus } from '@/lib/websocket/server';
import {
  resolveEffectiveProjectAgentSettings,
  type AgentRunKind,
  type EffectiveProjectAgentSettings,
  type ProjectAgentSettings,
  type SystemAgentControlSettings,
  type WorkspaceAgentSettings,
} from './config';
import { buildSprintBatchPlan, deriveTriagePriority, getRunKindSummary } from './planner';
import {
  AgentExecutionError,
  generateAgentPlan,
  normalizeAgentLabels,
  type SprintPlanProviderPlan,
  type TriageProviderPlan,
  type TrackingProviderPlan,
} from './providers';
import type { AgentModelConfigRecord } from './model-configs';
import type { ProjectContext, ProjectIssueRow, ProjectSprintRow } from './types';

type AgentLogEntry = {
  logIndex: number;
  type: 'system' | 'stdout' | 'stderr';
  content: string;
  timestamp: string;
};

type RunResponse = {
  run: typeof agentRuns.$inferSelect;
  output: Record<string, unknown>;
  dryRun: boolean;
  forcedDryRun: boolean;
  errorCode?: string;
  httpStatus?: number;
};

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function nextLog(logs: AgentLogEntry[], content: string, type: AgentLogEntry['type'] = 'system') {
  const entry: AgentLogEntry = {
    logIndex: logs.length,
    type,
    content,
    timestamp: new Date().toISOString(),
  };

  logs.push(entry);
  return entry;
}

async function loadProjectContext(projectId: string): Promise<ProjectContext | null> {
  const [project] = await db
    .select({
      id: projects.id,
      organizationId: projects.organizationId,
      name: projects.name,
      key: projects.key,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return null;
  }

  const [projectIssues, projectSprints] = await Promise.all([
    db
      .select({
        id: issues.id,
        key: issues.key,
        title: issues.title,
        type: issues.type,
        priority: issues.priority,
        labels: issues.labels,
        dueDate: issues.dueDate,
        sprintId: issues.sprintId,
        assigneeId: issues.assigneeId,
        statusCategory: workflowStatuses.category,
        statusName: workflowStatuses.name,
      })
      .from(issues)
      .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
      .where(eq(issues.projectId, projectId)),
    db
      .select({
        id: sprints.id,
        name: sprints.name,
        startDate: sprints.startDate,
        endDate: sprints.endDate,
        status: sprints.status,
      })
      .from(sprints)
      .where(eq(sprints.projectId, projectId))
      .orderBy(desc(sprints.startDate)),
  ]);

  return {
    project,
    issues: projectIssues,
    sprints: projectSprints,
  };
}

async function createAgentRunRecord(params: {
  organizationId: string;
  projectId: string;
  initiatedBy: string;
  kind: AgentRunKind;
  mode: EffectiveProjectAgentSettings['executionMode'];
  dryRun: boolean;
  input?: Record<string, unknown>;
}) {
  const [run] = await db
    .insert(agentRuns)
    .values({
      id: createId(),
      organizationId: params.organizationId,
      projectId: params.projectId,
      initiatedBy: params.initiatedBy,
      kind: params.kind,
      mode: params.mode,
      dryRun: params.dryRun,
      status: 'running',
      input: params.input ?? {},
      output: {},
      logs: [],
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return run!;
}

async function finalizeAgentRun(params: {
  runId: string;
  status: 'completed' | 'failed' | 'cancelled';
  logs: AgentLogEntry[];
  output?: Record<string, unknown>;
  summary?: string;
  writeActionsCount?: number;
  error?: string;
}) {
  const [run] = await db
    .update(agentRuns)
    .set({
      status: params.status,
      logs: params.logs,
      output: params.output ?? {},
      summary: params.summary,
      writeActionsCount: params.writeActionsCount ?? 0,
      error: params.error ?? null,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentRuns.id, params.runId))
    .returning();

  return run!;
}

type ProjectTrackingMetrics = {
  activeSprint: ProjectSprintRow | null;
  totalIssues: number;
  openIssues: number;
  overdueIssues: number;
  unassignedIssues: number;
  blockedIssues: number;
  backlogIssues: number;
};

type TriageProposal = {
  issue: ProjectIssueRow;
  targetPriority: ProjectIssueRow['priority'];
  nextLabels: string[];
  changed: boolean;
  rationale?: string;
};

type PlannedSprintRecord = {
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  issueKeys: string[];
};

function emitLog(runId: string, projectId: string, entry: AgentLogEntry) {
  emitAgentLog(runId, projectId, {
    logIndex: entry.logIndex,
    type: entry.type,
    content: entry.content,
    timestamp: new Date(entry.timestamp),
  });
}

function collectProjectTrackingMetrics(context: ProjectContext): ProjectTrackingMetrics {
  const activeSprint = context.sprints.find((sprint) => sprint.status === 'active') ?? null;
  const issuesInProject = context.issues;
  const openIssues = issuesInProject.filter((issue) => issue.statusCategory !== 'done');
  const overdueIssues = openIssues.filter((issue) => issue.dueDate && issue.dueDate.getTime() < Date.now());
  const unassignedIssues = openIssues.filter((issue) => !issue.assigneeId);
  const blockedIssues = openIssues.filter((issue) =>
    issue.statusCategory === 'blocked'
      || asStringArray(issue.labels).some((label) => label.toLowerCase() === 'blocked')
  );
  const backlogIssues = openIssues.filter((issue) => !issue.sprintId);

  return {
    activeSprint,
    totalIssues: issuesInProject.length,
    openIssues: openIssues.length,
    overdueIssues: overdueIssues.length,
    unassignedIssues: unassignedIssues.length,
    blockedIssues: blockedIssues.length,
    backlogIssues: backlogIssues.length,
  };
}

function createNativeTrackingRecommendations(metrics: ProjectTrackingMetrics) {
  const recommendations: string[] = [];

  if (metrics.overdueIssues > 0) {
    recommendations.push(`${metrics.overdueIssues} issue is overdue and needs a decision on scope or ownership.`);
  }
  if (metrics.blockedIssues > 0) {
    recommendations.push(`${metrics.blockedIssues} issue is blocked. Review blockers before the next planning cycle.`);
  }
  if (!metrics.activeSprint && metrics.backlogIssues >= 5) {
    recommendations.push('Backlog volume is high enough to draft the next sprint plan.');
  }
  if (metrics.unassignedIssues > 0) {
    recommendations.push(`${metrics.unassignedIssues} open issue is unassigned.`);
  }

  return recommendations;
}

function buildBacklogTriageProposals(
  context: ProjectContext,
  generatedPlan?: TriageProviderPlan
) {
  const backlogIssues = context.issues.filter(
    (issue) => !issue.sprintId && issue.statusCategory !== 'done'
  );

  if (!generatedPlan) {
    return backlogIssues
      .map((issue) => {
        const labels = asStringArray(issue.labels);
        const targetPriority = deriveTriagePriority({
          id: issue.id,
          key: issue.key,
          title: issue.title,
          type: issue.type,
          priority: issue.priority,
          labels,
          dueDate: issue.dueDate,
        });
        const nextLabels = normalizeAgentLabels(
          labels.includes('agent-triaged') ? labels : [...labels, 'agent-triaged']
        );

        return {
          issue,
          targetPriority,
          nextLabels,
          changed:
            targetPriority !== issue.priority
            || JSON.stringify(nextLabels) !== JSON.stringify(labels),
        } satisfies TriageProposal;
      })
      .filter((proposal) => proposal.changed);
  }

  const issueByKey = new Map(backlogIssues.map((issue) => [issue.key, issue]));
  const seenKeys = new Set<string>();
  const proposals: TriageProposal[] = [];

  for (const change of generatedPlan.changedIssues) {
    if (seenKeys.has(change.issueKey)) {
      continue;
    }

    const issue = issueByKey.get(change.issueKey);
    if (!issue) {
      continue;
    }

    const currentLabels = asStringArray(issue.labels);
    const nextLabels = normalizeAgentLabels([
      ...currentLabels,
      ...change.addLabels,
      'agent-triaged',
    ]);

    proposals.push({
      issue,
      targetPriority: change.nextPriority,
      nextLabels,
      changed:
        change.nextPriority !== issue.priority
        || JSON.stringify(nextLabels) !== JSON.stringify(currentLabels),
      rationale: change.rationale,
    });

    seenKeys.add(change.issueKey);
  }

  if (generatedPlan.changedIssues.length > 0 && proposals.length === 0) {
    throw new AgentExecutionError(
      'The LLM returned backlog changes, but none matched the current project backlog.',
      'provider_invalid_output',
      502
    );
  }

  return proposals.filter((proposal) => proposal.changed);
}

function materializePlannedSprints(params: {
  context: ProjectContext;
  effectiveSettings: EffectiveProjectAgentSettings;
  generatedPlan?: SprintPlanProviderPlan;
}) {
  if (!params.generatedPlan) {
    return buildSprintBatchPlan({
      issues: params.context.issues
        .filter((issue) => !issue.sprintId && issue.statusCategory !== 'done')
        .map((issue) => ({
          id: issue.id,
          key: issue.key,
          title: issue.title,
          type: issue.type,
          priority: issue.priority,
          labels: asStringArray(issue.labels),
          dueDate: issue.dueDate,
        })),
      sprintBatchSize: params.effectiveSettings.sprintBatchSize,
      sprintLengthDays: params.effectiveSettings.sprintLengthDays,
      issueCapacityPerSprint: params.effectiveSettings.issueCapacityPerSprint,
      startDate: resolveSprintStartDate(params.context.sprints),
      existingSprintCount: params.context.sprints.length,
    }).map((sprint) => ({
      name: sprint.name,
      goal: sprint.goal,
      startDate: sprint.startDate.toISOString(),
      endDate: sprint.endDate.toISOString(),
      issueKeys: sprint.issues.map((issue) => issue.key),
    })) satisfies PlannedSprintRecord[];
  }

  const backlogIssueMap = new Map(
    params.context.issues
      .filter((issue) => !issue.sprintId && issue.statusCategory !== 'done')
      .map((issue) => [issue.key, issue])
  );
  const seenIssueKeys = new Set<string>();
  const plannedSprints: PlannedSprintRecord[] = [];
  const startDate = resolveSprintStartDate(params.context.sprints);

  for (const [index, sprint] of params.generatedPlan.plannedSprints
    .slice(0, params.effectiveSettings.sprintBatchSize)
    .entries()) {
    const issueKeys = sprint.issueKeys
      .filter((issueKey) => {
        if (seenIssueKeys.has(issueKey) || !backlogIssueMap.has(issueKey)) {
          return false;
        }

        seenIssueKeys.add(issueKey);
        return true;
      })
      .slice(0, params.effectiveSettings.issueCapacityPerSprint);

    if (issueKeys.length === 0) {
      continue;
    }

    const sprintStart = new Date(startDate);
    sprintStart.setDate(sprintStart.getDate() + index * params.effectiveSettings.sprintLengthDays);

    const sprintEnd = new Date(sprintStart);
    sprintEnd.setDate(sprintEnd.getDate() + params.effectiveSettings.sprintLengthDays - 1);

    plannedSprints.push({
      name: sprint.name.trim() || `Sprint ${params.context.sprints.length + plannedSprints.length + 1}`,
      goal: sprint.goal.trim() || `Deliver ${issueKeys.slice(0, 3).join(', ')}.`,
      startDate: sprintStart.toISOString(),
      endDate: sprintEnd.toISOString(),
      issueKeys,
    });
  }

  if (params.generatedPlan.plannedSprints.length > 0 && plannedSprints.length === 0) {
    throw new AgentExecutionError(
      'The LLM returned sprint batches, but none mapped to backlog issues in this project.',
      'provider_invalid_output',
      502
    );
  }

  return plannedSprints;
}

async function runProjectTracking(params: {
  context: ProjectContext;
  logs: AgentLogEntry[];
  generatedPlan?: TrackingProviderPlan;
}) {
  const metrics = collectProjectTrackingMetrics(params.context);

  nextLog(params.logs, `Scanned ${metrics.totalIssues} issues across ${params.context.project.name}.`);
  nextLog(
    params.logs,
    metrics.activeSprint
      ? `Active sprint detected: ${metrics.activeSprint.name}.`
      : 'No active sprint is running in this project.'
  );

  const recommendations = params.generatedPlan?.recommendations?.length
    ? params.generatedPlan.recommendations
    : createNativeTrackingRecommendations(metrics);

  const summary = params.generatedPlan?.summary
    || (
      metrics.activeSprint
        ? `${params.context.project.name} has ${metrics.openIssues} open issues and ${metrics.blockedIssues} blockers in flight.`
        : `${params.context.project.name} has ${metrics.openIssues} open issues with no active sprint.`
    );

  return {
    summary,
    writeActionsCount: 0,
    output: {
      activeSprint: metrics.activeSprint,
      metrics: {
        totalIssues: metrics.totalIssues,
        openIssues: metrics.openIssues,
        overdueIssues: metrics.overdueIssues,
        unassignedIssues: metrics.unassignedIssues,
        blockedIssues: metrics.blockedIssues,
        backlogIssues: metrics.backlogIssues,
      },
      recommendations,
      highlights: params.generatedPlan?.highlights ?? [],
    },
  };
}

async function runBacklogTriage(params: {
  runId: string;
  userId: string;
  context: ProjectContext;
  effectiveSettings: EffectiveProjectAgentSettings;
  dryRun: boolean;
  logs: AgentLogEntry[];
  generatedPlan?: TriageProviderPlan;
}) {
  const backlogIssues = params.context.issues.filter(
    (issue) => !issue.sprintId && issue.statusCategory !== 'done'
  );

  nextLog(params.logs, `Found ${backlogIssues.length} backlog issues to inspect.`);

  const proposals = buildBacklogTriageProposals(params.context, params.generatedPlan);

  if (proposals.length === 0) {
    nextLog(params.logs, 'Backlog already matches the current triage heuristics.');
    return {
      summary: params.generatedPlan?.summary || 'Backlog triage found no changes to apply.',
      writeActionsCount: 0,
      output: {
        changedIssues: [],
      },
    };
  }

  nextLog(params.logs, `${proposals.length} issue will be re-ranked by the triage engine.`);

  if (params.dryRun || !params.effectiveSettings.allowWriteActions) {
    nextLog(params.logs, 'Write actions are disabled, returning a preview only.');
    return {
      summary: params.generatedPlan?.summary || `Prepared ${proposals.length} backlog triage updates.`,
      writeActionsCount: 0,
      output: {
        changedIssues: proposals.map((proposal) => ({
          issueId: proposal.issue.id,
          key: proposal.issue.key,
          title: proposal.issue.title,
          previousPriority: proposal.issue.priority,
          nextPriority: proposal.targetPriority,
          nextLabels: proposal.nextLabels,
          rationale: proposal.rationale ?? null,
        })),
      },
    };
  }

  let writeActionsCount = 0;
  for (const proposal of proposals) {
    await db
      .update(issues)
      .set({
        priority: proposal.targetPriority,
        labels: proposal.nextLabels,
        updatedAt: new Date(),
        updatedBy: params.userId,
      })
      .where(eq(issues.id, proposal.issue.id));

    await createActivity({
      issueId: proposal.issue.id,
      userId: params.userId,
      type: 'updated',
      field: 'priority',
      oldValue: proposal.issue.priority,
      newValue: proposal.targetPriority,
      metadata: {
        source: 'agent',
        runId: params.runId,
        labels: proposal.nextLabels,
      },
    });

    await createAuditLog({
      userId: params.userId,
      organizationId: params.context.project.organizationId,
      action: 'issue.priority_changed',
      resourceType: 'issue',
      resourceId: proposal.issue.id,
      projectId: params.context.project.id,
      issueId: proposal.issue.id,
      changes: {
        priority: { from: proposal.issue.priority, to: proposal.targetPriority },
        labels: { from: proposal.issue.labels, to: proposal.nextLabels },
      },
      metadata: {
        source: 'agent',
        runId: params.runId,
      },
    });

    publishEvent('issue.updated', params.userId, {
      projectId: params.context.project.id,
      issueId: proposal.issue.id,
      organizationId: params.context.project.organizationId,
    });

    writeActionsCount += 1;
  }

  nextLog(params.logs, `Applied ${writeActionsCount} triage updates to backlog issues.`);

  return {
    summary: params.generatedPlan?.summary || `Updated ${writeActionsCount} backlog issues with fresh priority and labels.`,
    writeActionsCount,
    output: {
      changedIssues: proposals.map((proposal) => ({
        issueId: proposal.issue.id,
        key: proposal.issue.key,
        title: proposal.issue.title,
        previousPriority: proposal.issue.priority,
        nextPriority: proposal.targetPriority,
        rationale: proposal.rationale ?? null,
      })),
    },
  };
}

function resolveSprintStartDate(projectSprints: ProjectSprintRow[]) {
  const latestSprint = [...projectSprints].sort((left, right) => right.endDate.getTime() - left.endDate.getTime())[0];
  const startDate = latestSprint ? new Date(latestSprint.endDate) : new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() + 1);
  return startDate;
}

async function buildSprintPlanningOutput(params: {
  context: ProjectContext;
  effectiveSettings: EffectiveProjectAgentSettings;
  logs: AgentLogEntry[];
  generatedPlan?: SprintPlanProviderPlan;
}) {
  const backlogIssues = params.context.issues.filter(
    (issue) => !issue.sprintId && issue.statusCategory !== 'done'
  );

  nextLog(params.logs, `Planning against ${backlogIssues.length} backlog issues.`);

  const plan = materializePlannedSprints({
    context: params.context,
    effectiveSettings: params.effectiveSettings,
    generatedPlan: params.generatedPlan,
  });

  return {
    summary: params.generatedPlan?.summary
      || (
        plan.length > 0
          ? `Prepared ${plan.length} sprint plan block${plan.length === 1 ? '' : 's'} for ${params.context.project.name}.`
          : 'No eligible backlog issues were found for sprint planning.'
      ),
    output: {
      plannedSprints: plan.map((sprint) => ({
        name: sprint.name,
        goal: sprint.goal,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        issueKeys: sprint.issueKeys,
      })),
    },
  };
}

async function runBulkSprintCreation(params: {
  runId: string;
  userId: string;
  context: ProjectContext;
  effectiveSettings: EffectiveProjectAgentSettings;
  dryRun: boolean;
  logs: AgentLogEntry[];
  generatedPlan?: SprintPlanProviderPlan;
}) {
  const planning = await buildSprintPlanningOutput({
    context: params.context,
    effectiveSettings: params.effectiveSettings,
    logs: params.logs,
    generatedPlan: params.generatedPlan,
  });

  const plannedSprints = (planning.output.plannedSprints ?? []) as Array<{
    name: string;
    goal: string;
    startDate: string;
    endDate: string;
    issueKeys: string[];
  }>;

  if (plannedSprints.length === 0) {
    return {
      summary: planning.summary,
      writeActionsCount: 0,
      output: planning.output,
    };
  }

  if (params.dryRun || !params.effectiveSettings.allowWriteActions) {
    nextLog(params.logs, 'Bulk sprint creation is in preview mode only.');
    return {
      summary: planning.summary,
      writeActionsCount: 0,
      output: planning.output,
    };
  }

  const issueByKey = new Map(params.context.issues.map((issue) => [issue.key, issue]));
  let writeActionsCount = 0;
  const createdSprints: Array<Record<string, unknown>> = [];

  for (const plannedSprint of plannedSprints) {
    const [createdSprint] = await db
      .insert(sprints)
      .values({
        id: createId(),
        projectId: params.context.project.id,
        name: plannedSprint.name,
        goal: plannedSprint.goal,
        startDate: new Date(plannedSprint.startDate),
        endDate: new Date(plannedSprint.endDate),
        status: 'planned',
        createdBy: params.userId,
        updatedBy: params.userId,
      })
      .returning();

    createdSprints.push({
      id: createdSprint.id,
      name: createdSprint.name,
      issueKeys: plannedSprint.issueKeys,
    });

    await createAuditLog({
      userId: params.userId,
      organizationId: params.context.project.organizationId,
      action: 'sprint.created',
      resourceType: 'sprint',
      resourceId: createdSprint.id,
      projectId: params.context.project.id,
      changes: {
        name: { from: null, to: createdSprint.name },
        status: { from: null, to: createdSprint.status },
      },
      metadata: {
        source: 'agent',
        runId: params.runId,
      },
    });

    publishEvent('sprint.created', params.userId, {
      projectId: params.context.project.id,
      sprintId: createdSprint.id,
      organizationId: params.context.project.organizationId,
    });

    writeActionsCount += 1;

    if (params.effectiveSettings.autoAssignToPlannedSprints) {
      for (const issueKey of plannedSprint.issueKeys) {
        const issue = issueByKey.get(issueKey);
        if (!issue) {
          continue;
        }

        await db
          .update(issues)
          .set({
            sprintId: createdSprint.id,
            updatedAt: new Date(),
            updatedBy: params.userId,
          })
          .where(eq(issues.id, issue.id));

        await createActivity({
          issueId: issue.id,
          userId: params.userId,
          type: 'updated',
          field: 'sprintId',
          oldValue: issue.sprintId,
          newValue: createdSprint.id,
          metadata: {
            source: 'agent',
            runId: params.runId,
            sprintName: createdSprint.name,
          },
        });

        await createAuditLog({
          userId: params.userId,
          organizationId: params.context.project.organizationId,
          action: 'sprint.issue_added',
          resourceType: 'sprint',
          resourceId: createdSprint.id,
          projectId: params.context.project.id,
          issueId: issue.id,
          changes: {
            sprintId: { from: issue.sprintId, to: createdSprint.id },
          },
          metadata: {
            source: 'agent',
            runId: params.runId,
            issueKey: issue.key,
          },
        });

        publishEvent('sprint.issues.changed', params.userId, {
          projectId: params.context.project.id,
          sprintId: createdSprint.id,
          issueId: issue.id,
          organizationId: params.context.project.organizationId,
        });

        writeActionsCount += 1;
      }
    }
  }

  nextLog(
    params.logs,
    `Created ${createdSprints.length} planned sprint${createdSprints.length === 1 ? '' : 's'} from backlog.`
  );

  return {
    summary: `Created ${createdSprints.length} planned sprints for ${params.context.project.name}.`,
    writeActionsCount,
    output: {
      createdSprints,
    },
  };
}

export async function getDailyAgentRunCount(organizationId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [result] = await db
    .select({ count: count() })
    .from(agentRuns)
    .where(and(eq(agentRuns.organizationId, organizationId), gte(agentRuns.createdAt, startOfDay)));

  return Number(result?.count || 0);
}

export async function getRunningAgentRunCount() {
  const [result] = await db
    .select({ count: count() })
    .from(agentRuns)
    .where(eq(agentRuns.status, 'running'));

  return Number(result?.count || 0);
}

export async function listProjectAgentRuns(projectId: string, limit = 12) {
  return db
    .select({
      id: agentRuns.id,
      kind: agentRuns.kind,
      status: agentRuns.status,
      dryRun: agentRuns.dryRun,
      summary: agentRuns.summary,
      writeActionsCount: agentRuns.writeActionsCount,
      createdAt: agentRuns.createdAt,
      completedAt: agentRuns.completedAt,
      mode: agentRuns.mode,
      output: agentRuns.output,
      error: agentRuns.error,
    })
    .from(agentRuns)
    .where(eq(agentRuns.projectId, projectId))
    .orderBy(desc(agentRuns.createdAt))
    .limit(limit);
}

export async function runProjectAgent(params: {
  projectId: string;
  userId: string;
  kind: AgentRunKind;
  workspaceSettings: WorkspaceAgentSettings;
  projectSettings: ProjectAgentSettings;
  systemControl: SystemAgentControlSettings;
  dryRun?: boolean;
  selectedModelConfig?: AgentModelConfigRecord | null;
  providerApiKey?: string | null;
}) : Promise<RunResponse> {
  const context = await loadProjectContext(params.projectId);
  if (!context) {
    throw new Error('Project not found');
  }

  const effectiveSettings = resolveEffectiveProjectAgentSettings(
    params.workspaceSettings,
    params.projectSettings,
    params.systemControl
  );

  const logs: AgentLogEntry[] = [];
  const forcedDryRun = !effectiveSettings.allowWriteActions && !params.dryRun && params.kind !== 'project_tracking' && params.kind !== 'sprint_planning';
  const dryRun = Boolean(params.dryRun || forcedDryRun);

  const run = await createAgentRunRecord({
    organizationId: context.project.organizationId,
    projectId: context.project.id,
    initiatedBy: params.userId,
    kind: params.kind,
    mode: effectiveSettings.executionMode,
    dryRun,
    input: {
      kind: params.kind,
      projectKey: context.project.key,
      forcedDryRun,
      provider: effectiveSettings.provider,
      model: effectiveSettings.model,
      modelConfigId: params.selectedModelConfig?.id || null,
      modelConfigName: params.selectedModelConfig?.name || null,
      modelConfigRevisionCount: params.selectedModelConfig?.revisionCount || 0,
      modelConfigSettings: params.selectedModelConfig?.settings || null,
    },
  });

  emitAgentStatus(run.id, context.project.id, { status: 'running', progress: 5 });
  const openingLog = nextLog(
    logs,
    `${getRunKindSummary(params.kind)} started for ${context.project.name}${dryRun ? ' in preview mode' : ''}.`
  );
  emitLog(run.id, context.project.id, openingLog);

  try {
    let result: {
      summary: string;
      writeActionsCount?: number;
      output: Record<string, unknown>;
    };
    let generatedPlan:
      | TrackingProviderPlan
      | TriageProviderPlan
      | SprintPlanProviderPlan
      | undefined;

    const providerLog = nextLog(
      logs,
      params.selectedModelConfig
        ? `Using ${effectiveSettings.provider} provider with model ${effectiveSettings.model || 'n/a'} via profile ${params.selectedModelConfig.name}.`
        : `Using ${effectiveSettings.provider} provider with model ${effectiveSettings.model || 'n/a'}.`
    );
    emitLog(run.id, context.project.id, providerLog);
    emitAgentStatus(run.id, context.project.id, { status: 'running', progress: 18 });

    if (effectiveSettings.provider !== 'native') {
      const plannerLog = nextLog(logs, 'Requesting a structured agent plan from the configured LLM provider.');
      emitLog(run.id, context.project.id, plannerLog);
      generatedPlan = await generateAgentPlan({
        kind: params.kind,
        model: effectiveSettings.model,
        effectiveSettings,
        context,
        apiKey: params.providerApiKey,
        modelConfigId: params.selectedModelConfig?.id || null,
        modelConfigName: params.selectedModelConfig?.name || null,
        modelTuning: params.selectedModelConfig?.settings || null,
      });

      const generatedLog = nextLog(logs, 'Structured provider plan generated successfully.');
      emitLog(run.id, context.project.id, generatedLog);
      emitAgentStatus(run.id, context.project.id, { status: 'running', progress: 42 });
    }

    switch (params.kind) {
      case 'project_tracking':
        result = await runProjectTracking({
          context,
          logs,
          generatedPlan: generatedPlan?.kind === 'project_tracking' ? generatedPlan : undefined,
        });
        break;
      case 'backlog_triage':
        result = await runBacklogTriage({
          runId: run.id,
          userId: params.userId,
          context,
          effectiveSettings,
          dryRun,
          logs,
          generatedPlan: generatedPlan?.kind === 'backlog_triage' ? generatedPlan : undefined,
        });
        break;
      case 'sprint_planning':
        result = await buildSprintPlanningOutput({
          context,
          effectiveSettings,
          logs,
          generatedPlan:
            generatedPlan?.kind === 'sprint_planning' || generatedPlan?.kind === 'bulk_sprint_creation'
              ? generatedPlan
              : undefined,
        });
        break;
      case 'bulk_sprint_creation':
        result = await runBulkSprintCreation({
          runId: run.id,
          userId: params.userId,
          context,
          effectiveSettings,
          dryRun,
          logs,
          generatedPlan:
            generatedPlan?.kind === 'sprint_planning' || generatedPlan?.kind === 'bulk_sprint_creation'
              ? generatedPlan
              : undefined,
        });
        break;
      default:
        throw new Error('Unsupported agent run kind');
    }

    const closingLog = nextLog(logs, result.summary);
    emitLog(run.id, context.project.id, closingLog);
    emitAgentStatus(run.id, context.project.id, { status: 'completed', progress: 100 });

    const finalizedRun = await finalizeAgentRun({
      runId: run.id,
      status: 'completed',
      logs,
      summary: result.summary,
      output: result.output,
      writeActionsCount: result.writeActionsCount ?? 0,
    });

    await createAuditLog({
      userId: params.userId,
      organizationId: context.project.organizationId,
      action: 'agent.run_completed',
      resourceType: 'agent_run',
      resourceId: run.id,
      projectId: context.project.id,
      changes: {
        status: { from: 'running', to: 'completed' },
      },
      metadata: {
        kind: params.kind,
        dryRun,
        writeActionsCount: result.writeActionsCount ?? 0,
        provider: effectiveSettings.provider,
        model: effectiveSettings.model,
        modelConfigId: params.selectedModelConfig?.id || null,
        modelConfigName: params.selectedModelConfig?.name || null,
      },
    });

    return {
      run: finalizedRun,
      output: result.output,
      dryRun,
      forcedDryRun,
      httpStatus: 201,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent run failed';
    const errorCode = error instanceof AgentExecutionError ? error.code : 'agent_run_failed';
    const httpStatus = error instanceof AgentExecutionError ? error.statusCode : 500;
    const failureLog = nextLog(logs, message, 'stderr');
    emitLog(run.id, context.project.id, failureLog);
    emitAgentStatus(run.id, context.project.id, { status: 'failed', progress: 100, error: message });

    const failedRun = await finalizeAgentRun({
      runId: run.id,
      status: 'failed',
      logs,
      error: message,
      summary: 'Agent run failed',
      output: {
        error: message,
        errorCode,
      },
    });

    await createAuditLog({
      userId: params.userId,
      organizationId: context.project.organizationId,
      action: 'agent.run_failed',
      resourceType: 'agent_run',
      resourceId: run.id,
      projectId: context.project.id,
      changes: {
        status: { from: 'running', to: 'failed' },
      },
      metadata: {
        kind: params.kind,
        dryRun,
        error: message,
        errorCode,
        provider: effectiveSettings.provider,
        model: effectiveSettings.model,
        modelConfigId: params.selectedModelConfig?.id || null,
        modelConfigName: params.selectedModelConfig?.name || null,
      },
    });

    return {
      run: failedRun,
      output: { error: message, errorCode },
      dryRun,
      forcedDryRun,
      errorCode,
      httpStatus,
    };
  }
}
