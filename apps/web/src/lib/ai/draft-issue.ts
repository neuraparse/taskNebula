/**
 * AI-assisted issue drafter.
 *
 * Takes a natural-language prompt plus project context and returns a
 * structured issue draft (type, title, description, priority, labels)
 * that the UI can preview before calling POST /api/issues.
 *
 * Provider selection:
 *   - "native"  — deterministic heuristic (no LLM call). Always available.
 *                 Used as a fallback when no LLM credential is configured.
 *   - "openai"  — OpenAI Responses API with structured JSON schema.
 *                 Requires OPENAI_API_KEY or a workspace-scoped key.
 *   - "anthropic" — Claude messages API with a structured-output prompt.
 *                 Requires ANTHROPIC_API_KEY or a workspace-scoped key.
 *
 * Never calls POST /api/issues directly — the UI owns that action so the
 * user can edit the draft before accepting.
 */

import { z } from 'zod';
import {
  estimatePromptTokens,
  runWithBudget,
  type LlmFeature,
} from './budget';

export const ISSUE_TYPES = ['story', 'task', 'bug', 'epic', 'subtask'] as const;
export const ISSUE_PRIORITIES = ['critical', 'high', 'medium', 'low', 'none'] as const;

export const issueDraftSchema = z.object({
  type: z.enum(ISSUE_TYPES),
  title: z.string().min(1).max(500),
  description: z.string().max(10_000).nullable().optional(),
  priority: z.enum(ISSUE_PRIORITIES),
  labels: z.array(z.string().min(1).max(40)).max(8).default([]),
  estimate: z.number().int().min(1).max(200).nullable().optional(),
});

export type IssueDraft = z.infer<typeof issueDraftSchema>;

export type DraftProvider = 'native' | 'openai' | 'anthropic';

export interface BudgetContext {
  organizationId: string;
  userId?: string | null;
  feature?: LlmFeature;
}

export interface DraftRequest {
  prompt: string;
  projectName: string;
  projectKey: string;
  existingLabels?: string[];
  provider: DraftProvider;
  apiKey?: string | null;
  model?: string | null;
  /**
   * When present, the LLM call is gated by AI Cost Guard: a reservation
   * is taken against the org's token budget, an `llm_call_audit` row is
   * appended, and the kill switch is honoured. Omit only from offline
   * test harnesses.
   */
  budgetContext?: BudgetContext;
}

export class AiDraftError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AiDraftError';
  }
}

/**
 * Heuristic fallback — no LLM required. Good enough to smoke-test the
 * feature flag wiring end-to-end and degrades gracefully when the operator
 * flips the flag on before configuring a credential.
 */
export function draftIssueNative(request: DraftRequest): IssueDraft {
  const raw = request.prompt.trim();
  const firstLine = raw.split(/\n+/)[0] ?? raw;
  const lower = raw.toLowerCase();

  const type: IssueDraft['type'] =
    /\b(bug|crash|broken|fail(s|ed|ing)?|regression)\b/.test(lower) ? 'bug' :
    /\b(epic|initiative|milestone)\b/.test(lower) ? 'epic' :
    /\b(subtask|sub-?task|child)\b/.test(lower) ? 'subtask' :
    /\b(story|user story|as a user)\b/.test(lower) ? 'story' :
    'task';

  const priority: IssueDraft['priority'] =
    /\b(urgent|critical|blocker|asap|p0)\b/.test(lower) ? 'critical' :
    /\b(high|important|p1)\b/.test(lower) ? 'high' :
    /\b(low|minor|p3)\b/.test(lower) ? 'low' :
    'medium';

  const labels: string[] = [];
  if (/\b(ui|frontend|css)\b/.test(lower)) labels.push('frontend');
  if (/\b(api|backend|server)\b/.test(lower)) labels.push('backend');
  if (/\b(bug|fix|broken)\b/.test(lower)) labels.push('bug');
  if (/\b(perf|performance|slow)\b/.test(lower)) labels.push('performance');
  if (/\b(security|auth|xss|csrf)\b/.test(lower)) labels.push('security');

  const title = firstLine.replace(/^[-*]\s*/, '').slice(0, 140).trim() || 'Untitled task';
  const description = raw.length > title.length ? raw : null;

  return {
    type,
    title,
    description,
    priority,
    labels,
    estimate: null,
  };
}

const JSON_INSTRUCTIONS = `Return ONLY a JSON object — no prose, no markdown fences.
Fields:
  - type: one of "story" | "task" | "bug" | "epic" | "subtask"
  - title: concise imperative one-liner, max 140 chars
  - description: optional longer description (markdown OK), max 10000 chars, or null if nothing to add
  - priority: one of "critical" | "high" | "medium" | "low" | "none"
  - labels: array of lowercase-kebab-case strings, max 8, pick from the existing-labels list when possible
  - estimate: integer story points 1..200, or null if unknown`;

function buildSystemPrompt(projectName: string, projectKey: string, existingLabels: string[]) {
  const labelsLine =
    existingLabels.length > 0
      ? `Existing labels in this project: ${existingLabels.slice(0, 50).join(', ')}`
      : `No labels exist yet; invent up to 3 concise ones.`;

  return [
    `You draft concise issue tickets for the project "${projectName}" (key: ${projectKey}).`,
    `Rules:`,
    `  - Stay faithful to the user prompt; do not invent requirements.`,
    `  - Pick the smallest type that fits (task for ordinary work, bug only for defects, epic only when the scope spans multiple sprints).`,
    `  - Prefer medium priority unless the prompt is explicit about urgency.`,
    labelsLine,
    JSON_INSTRUCTIONS,
  ].join('\n');
}

async function draftIssueOpenAi(request: DraftRequest): Promise<IssueDraft> {
  const apiKey = request.apiKey;
  if (!apiKey) {
    throw new AiDraftError(
      'missing_credential',
      'No OpenAI key available. Add one in Settings → AI & Agents → Quick setup, or ask a platform admin to set a default key in Admin → Agent control.'
    );
  }

  const model = request.model || 'gpt-4o-mini';
  const system = buildSystemPrompt(
    request.projectName,
    request.projectKey,
    request.existingLabels ?? []
  );

  const callOpenAi = async () => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: request.prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new AiDraftError(
        'provider_error',
        `OpenAI returned ${response.status}: ${detail.slice(0, 200)}`
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const raw = payload.choices?.[0]?.message?.content ?? '{}';
    return {
      value: parseAndValidate(raw),
      usage: {
        inputTokens: payload.usage?.prompt_tokens ?? estimatePromptTokens(system + request.prompt),
        outputTokens: payload.usage?.completion_tokens ?? estimatePromptTokens(raw),
      },
    };
  };

  if (request.budgetContext) {
    return runWithBudget(
      {
        organizationId: request.budgetContext.organizationId,
        userId: request.budgetContext.userId,
        provider: 'openai',
        model,
        feature: request.budgetContext.feature ?? 'draft',
        prompt: request.prompt,
        estimatedTokens:
          estimatePromptTokens(system + request.prompt) + 512,
      },
      callOpenAi
    );
  }

  return (await callOpenAi()).value;
}

async function draftIssueAnthropic(request: DraftRequest): Promise<IssueDraft> {
  const apiKey = request.apiKey;
  if (!apiKey) {
    throw new AiDraftError(
      'missing_credential',
      'No Anthropic key available. Add one in Settings → AI & Agents → Quick setup, or ask a platform admin to set a default key in Admin → Agent control.'
    );
  }

  const model = request.model || 'claude-sonnet-4-6';
  const system = buildSystemPrompt(
    request.projectName,
    request.projectKey,
    request.existingLabels ?? []
  );

  const callAnthropic = async () => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        temperature: 0.2,
        system,
        messages: [{ role: 'user', content: request.prompt }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new AiDraftError(
        'provider_error',
        `Anthropic returned ${response.status}: ${detail.slice(0, 200)}`
      );
    }

    const payload = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text =
      payload.content?.find((block) => block.type === 'text')?.text ?? '{}';
    return {
      value: parseAndValidate(text),
      usage: {
        inputTokens: payload.usage?.input_tokens ?? estimatePromptTokens(system + request.prompt),
        outputTokens: payload.usage?.output_tokens ?? estimatePromptTokens(text),
      },
    };
  };

  if (request.budgetContext) {
    return runWithBudget(
      {
        organizationId: request.budgetContext.organizationId,
        userId: request.budgetContext.userId,
        provider: 'anthropic',
        model,
        feature: request.budgetContext.feature ?? 'draft',
        prompt: request.prompt,
        estimatedTokens:
          estimatePromptTokens(system + request.prompt) + 1024,
      },
      callAnthropic
    );
  }

  return (await callAnthropic()).value;
}

function parseAndValidate(raw: string): IssueDraft {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AiDraftError('invalid_json', 'LLM returned non-JSON output.');
  }
  const result = issueDraftSchema.safeParse(parsed);
  if (!result.success) {
    throw new AiDraftError(
      'schema_violation',
      `LLM output failed validation: ${result.error.errors
        .slice(0, 3)
        .map((e) => e.path.join('.') + ' ' + e.message)
        .join('; ')}`
    );
  }
  return result.data;
}

export async function draftIssue(request: DraftRequest): Promise<IssueDraft> {
  switch (request.provider) {
    case 'native':
      return draftIssueNative(request);
    case 'openai':
      return draftIssueOpenAi(request);
    case 'anthropic':
      return draftIssueAnthropic(request);
    default:
      return draftIssueNative(request);
  }
}
