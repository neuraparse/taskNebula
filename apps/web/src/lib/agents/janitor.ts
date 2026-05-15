/**
 * Stale-issue Janitor — sweeps an organization for issues that have gone
 * quiet and decides what to do with each one.
 *
 * Decision tree (per issue):
 *   - ping_assignee — post a comment asking for an update (default).
 *   - snooze        — bump updated_at forward N days (label only, no comment).
 *   - auto_close_with_label — close the issue with a "stale-auto" label so
 *                             humans can sweep them in bulk.
 *
 * Claude Haiku is used to pick the action; the fallback heuristic mirrors
 * the same decision tree so the feature works without an LLM credential.
 *
 * The module returns *decisions* — it doesn't mutate the database. Callers
 * (the cron route) apply them so this module stays pure and trivial to
 * test.
 */

import { z } from 'zod';
import { DEFAULT_HAIKU_MODEL } from './standup';
import { commitUsage } from '@/lib/ai/budget';

export const JANITOR_ACTIONS = ['ping_assignee', 'snooze', 'auto_close_with_label'] as const;

export type JanitorAction = (typeof JANITOR_ACTIONS)[number];

export interface StaleIssue {
  id: string;
  key: string;
  title: string;
  description?: string | null;
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** Workflow status category — "done"/"cancelled" should be filtered out before this. */
  statusCategory: string;
  assigneeId: string | null;
  reporterId: string | null;
  priority: string;
  labels: string[];
  /** Days since last update. Pre-computed by the caller. */
  staleDays: number;
}

export interface JanitorDecision {
  issueId: string;
  issueKey: string;
  action: JanitorAction;
  reason: string;
  /** Days to snooze when action === 'snooze'. */
  snoozeDays?: number;
  /** Label to apply when action === 'auto_close_with_label'. */
  label?: string;
  /** 0..1, low confidence falls back to ping_assignee. */
  confidence: number;
}

export interface JanitorInput {
  workspaceId: string;
  issues: StaleIssue[];
  /** Threshold in days for being considered stale. Defaults to 30. */
  staleThresholdDays?: number;
  anthropicApiKey?: string | null;
  model?: string;
  /** Confidence floor below which we always pick ping_assignee. */
  confidenceFloor?: number;
}

export const DEFAULT_STALE_THRESHOLD_DAYS = 30;
export const DEFAULT_SNOOZE_DAYS = 14;
export const STALE_AUTO_LABEL = 'stale-auto';
export const DEFAULT_CONFIDENCE_FLOOR = 0.55;

const decisionSchema = z.object({
  action: z.enum(JANITOR_ACTIONS),
  reason: z.string().min(1).max(280),
  snoozeDays: z.number().int().min(1).max(60).optional(),
  confidence: z.number().min(0).max(1).default(0.5),
});

type DecisionShape = z.infer<typeof decisionSchema>;

/**
 * Deterministic decision tree — mirrors the prompt's behaviour so the
 * janitor stays useful without an LLM. Documented here so the LLM's
 * "no key" path produces identical results.
 *
 * Heuristics:
 *   - No assignee + low priority + 60+ days  -> auto_close_with_label.
 *   - Has assignee but only ~30-44 days stale -> ping_assignee.
 *   - 45-59 days stale and not critical       -> snooze 14d.
 *   - critical or blocker priority             -> always ping_assignee.
 */
export function decideJanitorActionHeuristic(issue: StaleIssue): JanitorDecision {
  const isCritical = issue.priority === 'critical';
  const hasAssignee = !!issue.assigneeId;

  if (isCritical) {
    return {
      issueId: issue.id,
      issueKey: issue.key,
      action: 'ping_assignee',
      reason: 'Critical priority — humans must triage rather than auto-close.',
      confidence: 0.9,
    };
  }

  if (!hasAssignee && issue.staleDays >= 60) {
    return {
      issueId: issue.id,
      issueKey: issue.key,
      action: 'auto_close_with_label',
      reason: `Unassigned and idle for ${issue.staleDays} days; closing with ${STALE_AUTO_LABEL} label.`,
      label: STALE_AUTO_LABEL,
      confidence: 0.8,
    };
  }

  if (issue.staleDays >= 45) {
    return {
      issueId: issue.id,
      issueKey: issue.key,
      action: 'snooze',
      reason: `Idle for ${issue.staleDays} days — snoozing ${DEFAULT_SNOOZE_DAYS}d to give the assignee a window.`,
      snoozeDays: DEFAULT_SNOOZE_DAYS,
      confidence: 0.7,
    };
  }

  return {
    issueId: issue.id,
    issueKey: issue.key,
    action: 'ping_assignee',
    reason: `Idle for ${issue.staleDays} days — pinging the assignee for an update.`,
    confidence: 0.85,
  };
}

const JANITOR_SYSTEM_PROMPT = `You are a calm, conservative janitor for a project tracker. For each stale
issue you receive, pick ONE action and explain it in a sentence.

Actions:
  - "ping_assignee"  — post a comment asking the assignee for an update.
    Default when in doubt. Always pick this for critical-priority issues.
  - "snooze"         — bump the issue forward without bothering anyone.
    Pick when there's a clear assignee, mid-staleness, and no urgency.
    Provide snoozeDays (1..30).
  - "auto_close_with_label" — close the issue with the "stale-auto" label.
    Only pick for unassigned, low/medium priority issues older than 60 days,
    or when the title clearly suggests the work is no longer relevant.

Confidence: 0..1, your subjective certainty. Anything below 0.55 will be
overridden to ping_assignee by the runtime, so use low confidence to abstain.

Return ONLY valid JSON matching this shape, no prose, no markdown fences:
  { "action": "ping_assignee"|"snooze"|"auto_close_with_label",
    "reason": string, "snoozeDays"?: number, "confidence": number }
`;

function parseDecision(raw: string): DecisionShape {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Haiku returned non-JSON output for janitor decision.');
  }
  const result = decisionSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      'Haiku output failed janitor schema validation: ' +
        result.error.errors
          .slice(0, 3)
          .map((e) => e.path.join('.') + ' ' + e.message)
          .join('; ')
    );
  }
  return result.data;
}

async function decideViaHaiku(
  issue: StaleIssue,
  apiKey: string,
  model: string
): Promise<DecisionShape> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      temperature: 0.1,
      system: JANITOR_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            key: issue.key,
            title: issue.title,
            description: issue.description?.slice(0, 600) ?? null,
            priority: issue.priority,
            statusCategory: issue.statusCategory,
            assignee: issue.assigneeId ? 'present' : 'none',
            labels: issue.labels,
            staleDays: issue.staleDays,
          }),
        },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Anthropic returned ${response.status}: ${detail.slice(0, 200)}`);
  }
  const body = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = body.content?.find((b) => b.type === 'text')?.text ?? '{}';
  return parseDecision(text);
}

/**
 * Apply the confidence floor and normalize the LLM's decision into a
 * stored JanitorDecision row.
 */
function finalizeDecision(raw: DecisionShape, issue: StaleIssue, floor: number): JanitorDecision {
  if (raw.confidence < floor) {
    return {
      issueId: issue.id,
      issueKey: issue.key,
      action: 'ping_assignee',
      reason: `Low confidence (${raw.confidence.toFixed(2)} < ${floor}); defaulting to ping_assignee.`,
      confidence: raw.confidence,
    };
  }
  return {
    issueId: issue.id,
    issueKey: issue.key,
    action: raw.action,
    reason: raw.reason,
    snoozeDays: raw.action === 'snooze' ? (raw.snoozeDays ?? DEFAULT_SNOOZE_DAYS) : undefined,
    label: raw.action === 'auto_close_with_label' ? STALE_AUTO_LABEL : undefined,
    confidence: raw.confidence,
  };
}

/**
 * Sweep stale issues and produce a decision for each one. Caller is
 * responsible for *applying* the decisions (commenting / closing /
 * snoozing) — keeping this pure makes the unit tests trivial.
 */
export async function sweepStaleIssues(input: JanitorInput): Promise<JanitorDecision[]> {
  const floor = input.confidenceFloor ?? DEFAULT_CONFIDENCE_FLOOR;
  const model = input.model ?? DEFAULT_HAIKU_MODEL;
  const decisions: JanitorDecision[] = [];

  for (const issue of input.issues) {
    if (!input.anthropicApiKey) {
      decisions.push(decideJanitorActionHeuristic(issue));
      continue;
    }
    const startedAt = Date.now();
    const promptString = JSON.stringify({ issueKey: issue.key, staleDays: issue.staleDays });
    try {
      const raw = await decideViaHaiku(issue, input.anthropicApiKey, model);
      // Best-effort audit so admin/usage dashboards reflect janitor activity.
      // Token counts estimated (callsite doesn't surface provider usage yet).
      commitUsage({
        organizationId: input.workspaceId,
        userId: null,
        provider: 'anthropic',
        model,
        prompt: promptString,
        inputTokens: Math.ceil(promptString.length / 4),
        outputTokens: Math.ceil(JSON.stringify(raw).length / 4),
        latencyMs: Date.now() - startedAt,
        status: 'success',
        feature: 'janitor',
      }).catch((auditErr) => {
        console.warn('[janitor] llm_call_audit insert failed', auditErr);
      });
      decisions.push(finalizeDecision(raw, issue, floor));
    } catch (err) {
      commitUsage({
        organizationId: input.workspaceId,
        userId: null,
        provider: 'anthropic',
        model,
        prompt: promptString,
        inputTokens: Math.ceil(promptString.length / 4),
        outputTokens: 0,
        latencyMs: Date.now() - startedAt,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
        feature: 'janitor',
      }).catch(() => {});
      console.warn('[janitor] Haiku call failed, falling back to heuristic', err);
      decisions.push(decideJanitorActionHeuristic(issue));
    }
  }

  return decisions;
}
