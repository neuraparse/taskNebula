/**
 * "Catch me up" digest generator.
 *
 * Given a list of unread/recent notifications and the issues they touch,
 * produce a markdown summary plus a short list of structured action items.
 *
 * Provider selection prefers Claude Haiku for cost (cheapest+fastest of
 * Anthropic's offering for short summarization). Falls back to a
 * deterministic heuristic when no LLM credential is configured so the
 * banner still does something useful on day-1 deployments.
 */

import { z } from 'zod';

export const actionItemSchema = z.object({
  title: z.string().min(1).max(200),
  link: z.string().min(1).max(500),
  urgency: z.enum(['high', 'medium', 'low']),
});

export type ActionItem = z.infer<typeof actionItemSchema>;

export const catchMeUpResponseSchema = z.object({
  summary_markdown: z.string(),
  action_items: z.array(actionItemSchema).max(10),
});

export type CatchMeUpResponse = z.infer<typeof catchMeUpResponseSchema>;

export interface NotificationDigestInput {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date | string;
  actorName?: string | null;
  projectKey?: string | null;
  projectName?: string | null;
  issueKey?: string | null;
  issueTitle?: string | null;
  issueId?: string | null;
}

export interface CatchMeUpRequest {
  since: Date;
  notifications: NotificationDigestInput[];
  provider: 'native' | 'anthropic' | 'openai';
  apiKey?: string | null;
  model?: string | null;
}

// Cheapest Claude tier that still produces decent prose. Operators can
// override via aiAgents.model in workspace settings; tasks gravitate to
// Haiku unless the org pays for something heftier.
export const CATCH_ME_UP_DEFAULT_MODEL = 'claude-haiku-4-5';

/**
 * Deterministic fallback — buckets notifications by urgency heuristic so the
 * banner does *something* without a key. Used when no provider key is
 * configured and inside Jest where we don't want to call the network.
 */
export function catchMeUpNative(request: CatchMeUpRequest): CatchMeUpResponse {
  const { notifications, since } = request;
  if (notifications.length === 0) {
    return {
      summary_markdown: 'No new activity since your last visit. You are fully caught up.',
      action_items: [],
    };
  }

  const byProject = new Map<string, NotificationDigestInput[]>();
  for (const n of notifications) {
    const key = n.projectKey || 'Other';
    const bucket = byProject.get(key) ?? [];
    bucket.push(n);
    byProject.set(key, bucket);
  }

  const URGENT_TYPES = new Set(['mention', 'assigned', 'ai_draft_failed', 'agent_run_failed']);

  const lines: string[] = [];
  lines.push(`### Since ${since.toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push(
    `**${notifications.length} update${notifications.length === 1 ? '' : 's'}** across **${byProject.size} project${byProject.size === 1 ? '' : 's'}**.`
  );
  lines.push('');

  for (const [projectKey, items] of byProject.entries()) {
    lines.push(`#### ${items[0]?.projectName ?? projectKey}`);
    for (const item of items.slice(0, 5)) {
      const actor = item.actorName ?? 'Someone';
      lines.push(`- ${actor}: ${item.title}`);
    }
    if (items.length > 5) {
      lines.push(`- _(+${items.length - 5} more)_`);
    }
    lines.push('');
  }

  const actionItems: ActionItem[] = notifications
    .filter((n) => URGENT_TYPES.has(n.type) && !n.isRead)
    .slice(0, 6)
    .map((n) => ({
      title: n.title.slice(0, 200),
      link: n.issueId ? `/issues/${n.issueId}` : '/inbox',
      urgency: URGENT_TYPES.has(n.type) ? ('high' as const) : ('medium' as const),
    }));

  return {
    summary_markdown: lines.join('\n'),
    action_items: actionItems,
  };
}

function buildSystemPrompt(): string {
  return [
    'You write a short "while you were away" briefing for a project management app.',
    'Audience: a busy operator who just returned from focus time or sleep.',
    'Style: terse, factual, prioritized — no fluff, no marketing language.',
    '',
    'Return ONLY a JSON object — no prose outside the JSON, no markdown fences.',
    'Fields:',
    '  - summary_markdown: short markdown digest (1-3 H4 sections). Use sections like "Decisions needed", "Blocked", "Recent activity by project".',
    '  - action_items: array (max 6) of { title, link, urgency }. urgency is one of "high" | "medium" | "low". The link is a relative app path (e.g. "/issues/abc") taken from the input.',
    '',
    'Rules:',
    '  - Never invent issue keys, links, or actor names.',
    '  - Items the user is explicitly mentioned in or assigned to are high urgency.',
    '  - AI/agent failures are high urgency (they block downstream work).',
    '  - Prefer at most 3 sentences per section.',
  ].join('\n');
}

function buildUserPayload(request: CatchMeUpRequest): string {
  const compact = request.notifications.slice(0, 80).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    msg: n.message?.slice(0, 240),
    actor: n.actorName ?? null,
    project: n.projectKey ?? null,
    issueKey: n.issueKey ?? null,
    issueId: n.issueId ?? null,
    when: typeof n.createdAt === 'string' ? n.createdAt : n.createdAt.toISOString(),
    unread: !n.isRead,
  }));
  return JSON.stringify({
    since: request.since.toISOString(),
    notifications: compact,
  });
}

function parseAndValidate(raw: string): CatchMeUpResponse {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('LLM returned non-JSON output.');
  }
  const result = catchMeUpResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Catch-me-up output failed validation: ${result.error.errors
        .slice(0, 3)
        .map((e) => e.path.join('.') + ' ' + e.message)
        .join('; ')}`
    );
  }
  return result.data;
}

async function catchMeUpAnthropic(request: CatchMeUpRequest): Promise<CatchMeUpResponse> {
  const apiKey = request.apiKey;
  if (!apiKey) {
    throw new Error('No Anthropic key available.');
  }
  const model = request.model || CATCH_ME_UP_DEFAULT_MODEL;
  const system = buildSystemPrompt();
  const payload = buildUserPayload(request);

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
      messages: [{ role: 'user', content: payload }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Anthropic returned ${response.status}: ${detail.slice(0, 200)}`);
  }
  const result = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = result.content?.find((b) => b.type === 'text')?.text ?? '{}';
  return parseAndValidate(text);
}

async function catchMeUpOpenAi(request: CatchMeUpRequest): Promise<CatchMeUpResponse> {
  const apiKey = request.apiKey;
  if (!apiKey) {
    throw new Error('No OpenAI key available.');
  }
  const model = request.model || 'gpt-4o-mini';
  const system = buildSystemPrompt();
  const payload = buildUserPayload(request);

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
        { role: 'user', content: payload },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenAI returned ${response.status}: ${detail.slice(0, 200)}`);
  }
  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = result.choices?.[0]?.message?.content ?? '{}';
  return parseAndValidate(text);
}

export async function catchMeUp(request: CatchMeUpRequest): Promise<CatchMeUpResponse> {
  try {
    if (request.provider === 'anthropic' && request.apiKey) {
      return await catchMeUpAnthropic(request);
    }
    if (request.provider === 'openai' && request.apiKey) {
      return await catchMeUpOpenAi(request);
    }
    return catchMeUpNative(request);
  } catch (err) {
    // Defensive: never bubble an LLM failure to the user. The native digest
    // is good enough to fill the banner while the operator inspects logs.
    console.warn('catchMeUp: provider call failed, falling back to native', err);
    return catchMeUpNative(request);
  }
}
