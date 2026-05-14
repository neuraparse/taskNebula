import { z } from 'zod';
import {
  getRunKindSummary,
  rankIssuesForPlanning,
} from './planner';
import type {
  AgentRunKind,
  EffectiveProjectAgentSettings,
} from './config';
import type { AgentModelConfigSettings } from './model-configs';
import type { ProjectContext } from './types';
import {
  buildCachedSystemPrompt,
  extractAnthropicCacheUsage,
  isPromptCacheEnabled,
} from '../ai/cache-blocks';

const PRIORITY_VALUES = ['critical', 'high', 'medium', 'low', 'none'] as const;

const trackingResponseSchema = z.object({
  summary: z.string().min(1).max(320),
  recommendations: z.array(z.string().min(1).max(220)).max(8).default([]),
  highlights: z.array(z.object({
    issueKey: z.string().min(1).max(32),
    reason: z.string().min(1).max(220),
  })).max(6).default([]),
});

const triageResponseSchema = z.object({
  summary: z.string().min(1).max(320),
  changedIssues: z.array(z.object({
    issueKey: z.string().min(1).max(32),
    nextPriority: z.enum(PRIORITY_VALUES),
    addLabels: z.array(z.string().min(1).max(32)).max(6).default([]),
    rationale: z.string().min(1).max(240),
  })).max(80).default([]),
});

const sprintPlanResponseSchema = z.object({
  summary: z.string().min(1).max(320),
  plannedSprints: z.array(z.object({
    name: z.string().min(1).max(80),
    goal: z.string().min(1).max(220),
    issueKeys: z.array(z.string().min(1).max(32)).max(50),
  })).max(6).default([]),
});

export type TrackingProviderPlan = z.infer<typeof trackingResponseSchema>;
export type TriageProviderPlan = z.infer<typeof triageResponseSchema>;
export type SprintPlanProviderPlan = z.infer<typeof sprintPlanResponseSchema>;

export type AgentProviderPlan =
  | ({ kind: 'project_tracking' } & TrackingProviderPlan)
  | ({ kind: 'backlog_triage' } & TriageProviderPlan)
  | ({ kind: 'sprint_planning' | 'bulk_sprint_creation' } & SprintPlanProviderPlan);

type ProviderParams = {
  kind: AgentRunKind;
  model: string;
  effectiveSettings: EffectiveProjectAgentSettings;
  context: ProjectContext;
  apiKey?: string | null;
  modelConfigId?: string | null;
  modelConfigName?: string | null;
  modelTuning?: AgentModelConfigSettings | null;
  // Passed by engine.ts for audit/budget attribution (P0-07 cost guard).
  userId?: string | null;
};

type OpenAiErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

export class AgentExecutionError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 500) {
    super(message);
    this.name = 'AgentExecutionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function formatDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function sanitizeLabel(label: string) {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_ -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 32);

  return normalized || null;
}

function buildProjectMetrics(context: ProjectContext) {
  const activeSprint = context.sprints.find((sprint) => sprint.status === 'active') ?? null;
  const openIssues = context.issues.filter((issue) => issue.statusCategory !== 'done');
  const overdueIssues = openIssues.filter((issue) => issue.dueDate && issue.dueDate.getTime() < Date.now());
  const unassignedIssues = openIssues.filter((issue) => !issue.assigneeId);
  const blockedIssues = openIssues.filter((issue) =>
    issue.statusCategory === 'blocked'
      || asStringArray(issue.labels).some((label) => label.toLowerCase() === 'blocked')
  );
  const backlogIssues = openIssues.filter((issue) => !issue.sprintId);

  return {
    activeSprint,
    metrics: {
      totalIssues: context.issues.length,
      openIssues: openIssues.length,
      overdueIssues: overdueIssues.length,
      unassignedIssues: unassignedIssues.length,
      blockedIssues: blockedIssues.length,
      backlogIssues: backlogIssues.length,
    },
    openIssues,
    backlogIssues,
  };
}

function createTrackingInput(context: ProjectContext) {
  const { activeSprint, metrics, openIssues, backlogIssues } = buildProjectMetrics(context);
  const interestingIssues = [...openIssues]
    .sort((left, right) => {
      const leftDue = left.dueDate ? left.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      const rightDue = right.dueDate ? right.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      if (leftDue !== rightDue) {
        return leftDue - rightDue;
      }

      return left.key.localeCompare(right.key);
    })
    .slice(0, 40)
    .map((issue) => ({
      key: issue.key,
      title: issue.title,
      type: issue.type,
      priority: issue.priority,
      dueDate: formatDate(issue.dueDate),
      sprintId: issue.sprintId,
      statusCategory: issue.statusCategory,
      assigneeId: issue.assigneeId,
      labels: asStringArray(issue.labels).slice(0, 8),
    }));

  return {
    objective: 'Summarize project health and recommend the next management actions.',
    project: context.project,
    activeSprint: activeSprint
      ? {
          name: activeSprint.name,
          startDate: activeSprint.startDate.toISOString(),
          endDate: activeSprint.endDate.toISOString(),
          status: activeSprint.status,
        }
      : null,
    metrics,
    note: openIssues.length > interestingIssues.length
      ? `Only the top ${interestingIssues.length} open issues are included for reasoning.`
      : 'All open issues are included.',
    openIssues: interestingIssues,
    backlogIssueKeys: backlogIssues.slice(0, 50).map((issue) => issue.key),
  };
}

function createBacklogInput(context: ProjectContext, effectiveSettings: EffectiveProjectAgentSettings) {
  const backlogIssues = rankIssuesForPlanning(
    context.issues
      .filter((issue) => !issue.sprintId && issue.statusCategory !== 'done')
      .map((issue) => ({
        id: issue.id,
        key: issue.key,
        title: issue.title,
        type: issue.type,
        priority: issue.priority,
        labels: asStringArray(issue.labels),
        dueDate: issue.dueDate,
      }))
  )
    .slice(0, 80);

  return {
    objective: 'Review the backlog and propose the minimal set of priority or label changes that would improve planning quality.',
    project: context.project,
    constraints: {
      maxIssuesToChange: Math.min(backlogIssues.length, effectiveSettings.issueCapacityPerSprint * effectiveSettings.sprintBatchSize),
      allowedPriorities: PRIORITY_VALUES,
      labelRules: [
        'Only short kebab-case labels.',
        'Do not remove existing labels.',
        'Prefer at most 2 added labels per issue.',
      ],
    },
    backlogIssues: backlogIssues.map((issue) => ({
      key: issue.key,
      title: issue.title,
      type: issue.type,
      priority: issue.priority,
      dueDate: formatDate(issue.dueDate ? new Date(issue.dueDate) : null),
      labels: issue.labels.slice(0, 8),
    })),
  };
}

function createSprintPlanningInput(context: ProjectContext, effectiveSettings: EffectiveProjectAgentSettings) {
  const backlogIssues = rankIssuesForPlanning(
    context.issues
      .filter((issue) => !issue.sprintId && issue.statusCategory !== 'done')
      .map((issue) => ({
        id: issue.id,
        key: issue.key,
        title: issue.title,
        type: issue.type,
        priority: issue.priority,
        labels: asStringArray(issue.labels),
        dueDate: issue.dueDate,
      }))
  )
    .slice(0, Math.max(20, effectiveSettings.issueCapacityPerSprint * effectiveSettings.sprintBatchSize * 3));

  const activeSprint = context.sprints.find((sprint) => sprint.status === 'active') ?? null;

  return {
    objective: 'Group backlog issues into sensible future sprint batches without inventing issue keys.',
    project: context.project,
    activeSprint: activeSprint
      ? {
          name: activeSprint.name,
          endDate: activeSprint.endDate.toISOString(),
        }
      : null,
    constraints: {
      maxSprintCount: effectiveSettings.sprintBatchSize,
      maxIssuesPerSprint: effectiveSettings.issueCapacityPerSprint,
      planningMode: 'Do not assign the same issue key to multiple sprints.',
    },
    backlogIssues: backlogIssues.map((issue) => ({
      key: issue.key,
      title: issue.title,
      type: issue.type,
      priority: issue.priority,
      dueDate: formatDate(issue.dueDate ? new Date(issue.dueDate) : null),
      labels: issue.labels.slice(0, 8),
    })),
  };
}

function buildPrompt(params: ProviderParams) {
  const baseRules = [
    'You are the TaskNebula project operations agent.',
    'Only use the JSON context that is provided.',
    'Never invent issue keys, sprint names tied to missing issues, users, labels, or counts.',
    'Keep summaries concise and operational.',
    'If there is no useful action, return empty arrays instead of filler.',
  ];

  switch (params.kind) {
    case 'project_tracking':
      return {
        instructions: [
          ...baseRules,
          'Produce a health summary, a short recommendation list, and optional issue highlights.',
        ].join(' '),
        input: createTrackingInput(params.context),
        schemaName: 'tasknebula_project_tracking',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'recommendations', 'highlights'],
          properties: {
            summary: { type: 'string', minLength: 1, maxLength: 320 },
            recommendations: {
              type: 'array',
              items: { type: 'string', minLength: 1, maxLength: 220 },
              maxItems: 8,
            },
            highlights: {
              type: 'array',
              maxItems: 6,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['issueKey', 'reason'],
                properties: {
                  issueKey: { type: 'string', minLength: 1, maxLength: 32 },
                  reason: { type: 'string', minLength: 1, maxLength: 220 },
                },
              },
            },
          },
        },
        parser: (value: unknown) => ({ kind: 'project_tracking' as const, ...trackingResponseSchema.parse(value) }),
      };
    case 'backlog_triage':
      return {
        instructions: [
          ...baseRules,
          'Only propose changes for backlog issues that clearly benefit from reprioritization or better backlog labeling.',
          'Do not downgrade urgent work without a strong reason.',
        ].join(' '),
        input: createBacklogInput(params.context, params.effectiveSettings),
        schemaName: 'tasknebula_backlog_triage',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'changedIssues'],
          properties: {
            summary: { type: 'string', minLength: 1, maxLength: 320 },
            changedIssues: {
              type: 'array',
              maxItems: 80,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['issueKey', 'nextPriority', 'addLabels', 'rationale'],
                properties: {
                  issueKey: { type: 'string', minLength: 1, maxLength: 32 },
                  nextPriority: { type: 'string', enum: [...PRIORITY_VALUES] },
                  addLabels: {
                    type: 'array',
                    maxItems: 6,
                    items: { type: 'string', minLength: 1, maxLength: 32 },
                  },
                  rationale: { type: 'string', minLength: 1, maxLength: 240 },
                },
              },
            },
          },
        },
        parser: (value: unknown) => ({ kind: 'backlog_triage' as const, ...triageResponseSchema.parse(value) }),
      };
    case 'sprint_planning':
    case 'bulk_sprint_creation':
      return {
        instructions: [
          ...baseRules,
          'Group issue keys into future sprint batches.',
          'Respect the provided sprint and capacity limits.',
          'Every issue key can appear at most once.',
        ].join(' '),
        input: createSprintPlanningInput(params.context, params.effectiveSettings),
        schemaName: 'tasknebula_sprint_plan',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'plannedSprints'],
          properties: {
            summary: { type: 'string', minLength: 1, maxLength: 320 },
            plannedSprints: {
              type: 'array',
              maxItems: 6,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['name', 'goal', 'issueKeys'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 80 },
                  goal: { type: 'string', minLength: 1, maxLength: 220 },
                  issueKeys: {
                    type: 'array',
                    maxItems: 50,
                    items: { type: 'string', minLength: 1, maxLength: 32 },
                  },
                },
              },
            },
          },
        },
        parser: (value: unknown) => ({
          kind: params.kind as 'sprint_planning' | 'bulk_sprint_creation',
          ...sprintPlanResponseSchema.parse(value),
        }),
      };
    default:
      throw new AgentExecutionError('Unsupported agent run kind.', 'unsupported_run_kind', 400);
  }
}

function extractStructuredText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: Array<Record<string, unknown>> }).content
      : [];

    for (const block of content) {
      const text = typeof block.text === 'string' ? block.text : null;
      if (
        text
        && (block.type === 'output_text' || block.type === 'text')
      ) {
        return text;
      }
    }
  }

  throw new AgentExecutionError(
    'OpenAI returned a response without structured text output.',
    'provider_invalid_output',
    502
  );
}

function createOpenAiError(status: number, payload: OpenAiErrorPayload, model: string) {
  const message = payload.error?.message || 'OpenAI request failed.';
  const code = payload.error?.code || payload.error?.type || 'openai_error';

  if (status === 401 || status === 403) {
    return new AgentExecutionError(
      `OpenAI rejected the request for model ${model}. Check OPENAI_API_KEY and model access.`,
      'provider_auth_failed',
      502
    );
  }

  if (status === 429) {
    return new AgentExecutionError(
      `OpenAI rate limited the agent run: ${message}`,
      'provider_rate_limited',
      429
    );
  }

  if (status >= 400 && status < 500) {
    return new AgentExecutionError(
      `OpenAI request for model ${model} was rejected: ${message}`,
      code,
      502
    );
  }

  return new AgentExecutionError(
    `OpenAI failed while running ${model}: ${message}`,
    code,
    502
  );
}

async function generateOpenAiPlan(params: ProviderParams): Promise<AgentProviderPlan> {
  const apiKey = params.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AgentExecutionError(
      'OpenAI is selected but no workspace credential or OPENAI_API_KEY server variable is configured.',
      'provider_not_configured',
      503
    );
  }

  if (!params.model.trim() || params.model.startsWith('tasknebula-')) {
    throw new AgentExecutionError(
      'OpenAI is selected but the configured model is still a native placeholder. Pick a real OpenAI model such as gpt-5.4.',
      'provider_model_invalid',
      422
    );
  }

  const prompt = buildPrompt(params);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      store: false,
      instructions: `${prompt.instructions} Requested flow: ${getRunKindSummary(params.kind)}.`,
      input: JSON.stringify(prompt.input, null, 2),
      ...(params.modelTuning?.temperature !== null && params.modelTuning?.temperature !== undefined
        ? { temperature: params.modelTuning.temperature }
        : {}),
      ...(params.modelTuning?.maxOutputTokens
        ? { max_output_tokens: params.modelTuning.maxOutputTokens }
        : {}),
      ...(params.modelTuning?.reasoningEffort
        ? { reasoning: { effort: params.modelTuning.reasoningEffort } }
        : {}),
      text: {
        format: {
          type: 'json_schema',
          name: prompt.schemaName,
          strict: true,
          schema: prompt.schema,
        },
      },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw createOpenAiError(response.status, payload as OpenAiErrorPayload, params.model);
  }

  const structuredText = extractStructuredText(payload);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(structuredText);
  } catch {
    throw new AgentExecutionError(
      'OpenAI returned invalid JSON for the structured agent response.',
      'provider_invalid_output',
      502
    );
  }

  try {
    return prompt.parser(parsedJson);
  } catch {
    throw new AgentExecutionError(
      'OpenAI returned structured output that does not match the TaskNebula agent schema.',
      'provider_invalid_output',
      502
    );
  }
}

export function normalizeAgentLabels(labels: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const label of labels) {
    const next = sanitizeLabel(label);
    if (!next || seen.has(next)) {
      continue;
    }

    seen.add(next);
    normalized.push(next);
  }

  return normalized;
}

async function generateAnthropicPlan(params: ProviderParams): Promise<AgentProviderPlan> {
  const apiKey = params.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AgentExecutionError(
      'Anthropic is selected but no workspace credential or ANTHROPIC_API_KEY server variable is configured.',
      'provider_not_configured',
      503
    );
  }

  if (!params.model.trim() || params.model.startsWith('tasknebula-')) {
    throw new AgentExecutionError(
      'Anthropic is selected but the configured model is still a native placeholder. Pick a Claude model such as claude-sonnet-4-6.',
      'provider_model_invalid',
      422
    );
  }

  const prompt = buildPrompt(params);

  // Split the system prompt into a stable instructions/schema prefix and
  // attach ephemeral cache markers so Claude can reuse it across calls.
  // The dynamic per-run input goes in `messages[0].content` and is NOT
  // cached.
  const stableInstructions = `${prompt.instructions} Requested flow: ${getRunKindSummary(params.kind)}.`;
  const stableSchemaBlock = [
    'Respond with a single JSON object that matches this schema exactly — no prose, no markdown fences:',
    JSON.stringify(prompt.schema),
  ].join('\n\n');

  const systemBlocks = buildCachedSystemPrompt({
    instructions: stableInstructions,
    toolSchemaBlock: stableSchemaBlock,
  });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      ...(isPromptCacheEnabled()
        ? { 'anthropic-beta': 'prompt-caching-2024-07-31' }
        : {}),
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.modelTuning?.maxOutputTokens || 4096,
      system: systemBlocks,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(prompt.input, null, 2),
        },
      ],
      ...(params.modelTuning?.temperature !== null && params.modelTuning?.temperature !== undefined
        ? { temperature: params.modelTuning.temperature }
        : {}),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = (payload as { error?: { message?: string; type?: string } }).error;
    const code =
      response.status === 401 || response.status === 403
        ? 'provider_auth_failed'
        : response.status === 429
          ? 'provider_rate_limited'
          : 'anthropic_error';
    throw new AgentExecutionError(
      error?.message || `Anthropic request failed (${response.status})`,
      code,
      response.status === 429 ? 429 : 502
    );
  }

  const content = Array.isArray((payload as { content?: unknown }).content)
    ? ((payload as { content: Array<{ type?: string; text?: string }> }).content)
    : [];
  const textBlock = content.find((block) => block.type === 'text' && typeof block.text === 'string');
  const rawText = textBlock?.text ?? '';

  // Record cache metrics for audit logging. The audit table from task #7 is
  // optional — if it's not present we just drop the numbers. We still emit
  // a structured log line so a dashboard/aggregator can scrape it.
  try {
    const usage = extractAnthropicCacheUsage(payload);
    if (usage.cacheReadTokens > 0 || usage.cacheCreationTokens > 0) {
      // Lazy require so this stays optional. The function is a no-op if the
      // module hasn't been added yet (task #7 hook).
      const auditMod = await import('../ai/audit-hook').catch(() => null);
      if (auditMod && typeof auditMod.recordPromptCacheUsage === 'function') {
        auditMod.recordPromptCacheUsage({
          provider: 'anthropic',
          model: params.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cachedTokens: usage.cacheReadTokens,
          cacheCreationTokens: usage.cacheCreationTokens,
        });
      }
    }
  } catch {
    // Audit failures must never break the agent path.
  }

  // Strip optional fenced ```json ... ``` wrappers Claude sometimes emits.
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    throw new AgentExecutionError(
      'Anthropic returned invalid JSON for the structured agent response.',
      'provider_invalid_output',
      502
    );
  }

  try {
    return prompt.parser(parsedJson);
  } catch {
    throw new AgentExecutionError(
      'Anthropic returned structured output that does not match the TaskNebula agent schema.',
      'provider_invalid_output',
      502
    );
  }
}

export async function generateAgentPlan(params: ProviderParams): Promise<AgentProviderPlan> {
  switch (params.effectiveSettings.provider) {
    case 'openai':
      return generateOpenAiPlan(params);
    case 'anthropic':
      return generateAnthropicPlan(params);
    case 'native':
      throw new AgentExecutionError(
        'Native provider plans are generated directly inside the TaskNebula engine.',
        'provider_not_needed',
        400
      );
    case 'azure':
    case 'custom':
      throw new AgentExecutionError(
        `${params.effectiveSettings.provider} is selectable in settings but its server-side run adapter is not implemented in this open-source build yet.`,
        'provider_not_implemented',
        501
      );
    default:
      throw new AgentExecutionError('Unsupported agent provider.', 'provider_not_supported', 400);
  }
}
