/**
 * Multi-issue drafter. Given a single prompt, returns up to `count`
 * structured issue drafts so a user can describe a whole feature / bug
 * triage list in one go and review N separate proposed tickets.
 *
 * Uses the same provider abstraction as draft-issue.ts but asks the LLM
 * for an array of drafts. Native fallback heuristically splits the prompt
 * on bullet points / numbered list items.
 */

import { z } from 'zod';
import { issueDraftSchema, type IssueDraft, type DraftProvider, AiDraftError, type BudgetContext } from './draft-issue';
import { estimatePromptTokens, runWithBudget } from './budget';

export const draftsResponseSchema = z.object({
  drafts: z.array(issueDraftSchema).min(1).max(20),
});

export interface DraftIssuesRequest {
  prompt: string;
  projectName: string;
  projectKey: string;
  existingLabels?: string[];
  provider: DraftProvider;
  apiKey?: string | null;
  model?: string | null;
  maxCount?: number;
  budgetContext?: BudgetContext;
}

function lineItems(raw: string): string[] {
  const lines = raw
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^(?:\d+[.)]|[-*•·])\s*/, '').trim())
    .filter(Boolean);
  return lines;
}

function draftIssuesNative(request: DraftIssuesRequest): IssueDraft[] {
  const items = lineItems(request.prompt);
  const seeds = items.length > 1 ? items : [request.prompt.trim()];

  return seeds.slice(0, request.maxCount ?? 5).map((seed) => {
    const lower = seed.toLowerCase();
    const type: IssueDraft['type'] = /\b(bug|crash|broken|fail)/.test(lower)
      ? 'bug'
      : /\b(epic|initiative)/.test(lower)
        ? 'epic'
        : /\b(subtask|sub-?task)/.test(lower)
          ? 'subtask'
          : 'task';
    const priority: IssueDraft['priority'] = /\b(urgent|critical|p0|asap)/.test(lower)
      ? 'critical'
      : /\b(high|p1|important)/.test(lower)
        ? 'high'
        : /\b(low|minor|p3)/.test(lower)
          ? 'low'
          : 'medium';
    const title = seed.slice(0, 140).trim() || 'Untitled task';
    return {
      type,
      title,
      description: seed.length > title.length ? seed : null,
      priority,
      labels: [],
      estimate: null,
    };
  });
}

function buildSystemPrompt(
  projectName: string,
  projectKey: string,
  existingLabels: string[],
  maxCount: number
) {
  const labelsLine =
    existingLabels.length > 0
      ? `Existing labels in this project: ${existingLabels.slice(0, 50).join(', ')}`
      : 'No labels exist yet; invent up to 3 concise ones per issue.';

  return [
    `You break a single user prompt into a list of separate issues for the project "${projectName}" (key ${projectKey}).`,
    `Rules:`,
    `  - Produce at most ${maxCount} drafts. Fewer is better when the prompt describes one thing.`,
    `  - Only split when the prompt genuinely describes multiple distinct tickets (bug list, feature checklist, multi-step plan).`,
    `  - Do NOT invent requirements beyond what the prompt says.`,
    `  - Each draft: tiny imperative title (max 140 chars), correct type (task/story/bug/epic/subtask), reasonable priority.`,
    `  - If issues are related, the first one can be an epic and the rest subtasks; only do this when the prompt implies hierarchy.`,
    labelsLine,
    `Return ONLY a JSON object of the form: {"drafts":[{type,title,description,priority,labels,estimate}, ...]}.`,
    `No prose, no markdown fences.`,
  ].join('\n');
}

async function draftIssuesOpenAi(request: DraftIssuesRequest): Promise<IssueDraft[]> {
  const apiKey = request.apiKey;
  if (!apiKey) {
    throw new AiDraftError(
      'missing_credential',
      'No OpenAI key available. Add one in Settings → AI & Agents → Quick setup.'
    );
  }
  const maxCount = Math.min(Math.max(request.maxCount ?? 5, 1), 20);
  const model = request.model || 'gpt-4o-mini';
  const systemPrompt = buildSystemPrompt(
    request.projectName,
    request.projectKey,
    request.existingLabels ?? [],
    maxCount
  );

  const call = async () => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
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
      value: parseAndValidate(raw, maxCount),
      usage: {
        inputTokens:
          payload.usage?.prompt_tokens ?? estimatePromptTokens(systemPrompt + request.prompt),
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
        feature: request.budgetContext.feature ?? 'draft_multi',
        prompt: request.prompt,
        estimatedTokens:
          estimatePromptTokens(systemPrompt + request.prompt) + 1024,
      },
      call
    );
  }
  return (await call()).value;
}

async function draftIssuesAnthropic(request: DraftIssuesRequest): Promise<IssueDraft[]> {
  const apiKey = request.apiKey;
  if (!apiKey) {
    throw new AiDraftError(
      'missing_credential',
      'No Anthropic key available. Add one in Settings → AI & Agents → Quick setup.'
    );
  }
  const maxCount = Math.min(Math.max(request.maxCount ?? 5, 1), 20);
  const model = request.model || 'claude-sonnet-4-6';
  const systemPrompt = buildSystemPrompt(
    request.projectName,
    request.projectKey,
    request.existingLabels ?? [],
    maxCount
  );

  const call = async () => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        temperature: 0.2,
        system: systemPrompt,
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
      value: parseAndValidate(text, maxCount),
      usage: {
        inputTokens:
          payload.usage?.input_tokens ?? estimatePromptTokens(systemPrompt + request.prompt),
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
        feature: request.budgetContext.feature ?? 'draft_multi',
        prompt: request.prompt,
        estimatedTokens:
          estimatePromptTokens(systemPrompt + request.prompt) + 2048,
      },
      call
    );
  }
  return (await call()).value;
}

function parseAndValidate(raw: string, maxCount: number): IssueDraft[] {
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
  const result = draftsResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new AiDraftError(
      'schema_violation',
      `LLM output failed validation: ${result.error.errors
        .slice(0, 3)
        .map((e) => `${e.path.join('.')} ${e.message}`)
        .join('; ')}`
    );
  }
  return result.data.drafts.slice(0, maxCount);
}

export async function draftIssuesMulti(request: DraftIssuesRequest): Promise<IssueDraft[]> {
  switch (request.provider) {
    case 'openai':
      return draftIssuesOpenAi(request);
    case 'anthropic':
      return draftIssuesAnthropic(request);
    case 'native':
    default:
      return draftIssuesNative(request);
  }
}
