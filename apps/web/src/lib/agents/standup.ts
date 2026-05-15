/**
 * Standup Agent — builds a daily digest of a user's work activity.
 *
 * Pulls the last 24h of:
 *   - issues the user authored or transitioned (including closures)
 *   - comments the user wrote
 *   - PRs reviewed and commits (when a GitHub integration link exists)
 *
 * Feeds the raw events through Claude Haiku to produce a markdown digest
 * with three buckets — yesterday, today, blockers. Stores the result in
 * the `standups` table so the dashboard widget can render it cheaply.
 *
 * The LLM call is optional — when no Anthropic credential is available we
 * fall back to a deterministic markdown formatter so the feature still
 * works end-to-end (the dashboard will show a "configure Anthropic for
 * smarter summaries" hint).
 */

import { z } from 'zod';
import { commitUsage } from '@/lib/ai/budget';

export type StandupEventType =
  | 'issue_created'
  | 'issue_status_changed'
  | 'issue_closed'
  | 'issue_assigned'
  | 'comment_authored'
  | 'pr_reviewed'
  | 'commit_authored';

export interface StandupEvent {
  type: StandupEventType;
  ref: string; // e.g. "PROJ-123", commit sha, PR url
  summary: string; // short human description
  at: string; // ISO timestamp
  url?: string | null;
}

export interface StandupDigest {
  yesterday: string[];
  today: string[];
  blockers: string[];
  contentMd: string;
  blockersMd: string;
  /** Echo of the events we fed the prompt — stored alongside the digest. */
  sourceEvents: StandupEvent[];
}

export interface BuildStandupInput {
  userId: string;
  userName?: string | null;
  events: StandupEvent[];
  /** Inclusive start of the window covered (typically "now - 24h"). */
  windowStart: Date;
  /** Inclusive end of the window covered (typically now). */
  windowEnd: Date;
  /** Anthropic API key. When omitted, the deterministic fallback is used. */
  anthropicApiKey?: string | null;
  /** Override the default Haiku model (e.g. for tests). */
  model?: string;
  /** Required to attribute the LLM call in `llm_call_audit`. */
  organizationId?: string;
}

export const DEFAULT_HAIKU_MODEL = 'claude-haiku-4-5';

const summarySchema = z.object({
  yesterday: z.array(z.string().min(1)).max(12),
  today: z.array(z.string().min(1)).max(12),
  blockers: z.array(z.string().min(1)).max(8).default([]),
});

type SummaryShape = z.infer<typeof summarySchema>;

function dateRangeLabel(start: Date, end: Date): string {
  return `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`;
}

function bullet(line: string): string {
  return `- ${line.replace(/^[-*]\s*/, '').trim()}`;
}

function renderMarkdown(summary: SummaryShape, window: string, name: string): string {
  const sections: string[] = [];
  sections.push(`### Standup — ${name} (${window})`);
  sections.push('');
  sections.push('**Yesterday**');
  if (summary.yesterday.length === 0) {
    sections.push(bullet('No tracked activity in the last 24h.'));
  } else {
    summary.yesterday.forEach((y) => sections.push(bullet(y)));
  }
  sections.push('');
  sections.push('**Today**');
  if (summary.today.length === 0) {
    sections.push(bullet('Picking up the next item in the queue.'));
  } else {
    summary.today.forEach((t) => sections.push(bullet(t)));
  }
  if (summary.blockers.length > 0) {
    sections.push('');
    sections.push('**Blockers**');
    summary.blockers.forEach((b) => sections.push(bullet(b)));
  }
  return sections.join('\n');
}

function renderBlockers(blockers: string[]): string {
  if (blockers.length === 0) return '';
  return blockers.map(bullet).join('\n');
}

/**
 * Deterministic fallback summarizer — used when no Anthropic key is wired
 * up. Keeps the same shape as the LLM output so callers don't need a
 * branch on which path produced the digest.
 */
export function buildStandupFallback(input: BuildStandupInput): StandupDigest {
  const yesterday: string[] = [];
  const today: string[] = [];
  const blockers: string[] = [];

  for (const event of input.events) {
    switch (event.type) {
      case 'issue_closed':
        yesterday.push(`Closed ${event.ref} — ${event.summary}`);
        break;
      case 'issue_status_changed':
        yesterday.push(`Moved ${event.ref}: ${event.summary}`);
        break;
      case 'issue_created':
        yesterday.push(`Filed ${event.ref}: ${event.summary}`);
        break;
      case 'issue_assigned':
        today.push(`Picking up ${event.ref}: ${event.summary}`);
        break;
      case 'comment_authored':
        yesterday.push(`Commented on ${event.ref}: ${event.summary}`);
        break;
      case 'pr_reviewed':
        yesterday.push(`Reviewed ${event.ref}: ${event.summary}`);
        break;
      case 'commit_authored':
        yesterday.push(`Pushed ${event.ref}: ${event.summary}`);
        break;
    }

    // Heuristic blocker detection — anything tagged as blocked or mentioning
    // the word "blocked" in the summary surfaces in the blockers bucket.
    if (/\b(blocked|stuck|waiting on|cannot proceed)\b/i.test(event.summary)) {
      blockers.push(`${event.ref}: ${event.summary}`);
    }
  }

  const summary: SummaryShape = {
    yesterday: dedupe(yesterday).slice(0, 12),
    today: dedupe(today).slice(0, 12),
    blockers: dedupe(blockers).slice(0, 8),
  };
  const name = input.userName ?? 'you';
  const window = dateRangeLabel(input.windowStart, input.windowEnd);
  return {
    yesterday: summary.yesterday,
    today: summary.today,
    blockers: summary.blockers,
    contentMd: renderMarkdown(summary, window, name),
    blockersMd: renderBlockers(summary.blockers),
    sourceEvents: input.events,
  };
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of arr) {
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(line);
    }
  }
  return out;
}

const STANDUP_SYSTEM_PROMPT = `You are an engineering standup assistant. Given a JSON list of activity
events for ONE engineer covering the last 24 hours, produce a concise standup
in three buckets: yesterday, today, blockers.

Rules:
  - Stay faithful to the events; do not invent work that isn't listed.
  - Each bullet is one short sentence, ideally <= 14 words.
  - "Yesterday" describes what was completed or worked on.
  - "Today" describes what is in progress or assigned next (look at
    issue_assigned events and uncompleted work).
  - "Blockers" lists anything stuck, waiting on review, or explicitly blocked.
    Leave the array empty if nothing is blocked.
  - Reference issue keys / PR ids when present so the reader can click through.

Return ONLY valid JSON matching this shape, no prose, no markdown fences:
  { "yesterday": string[], "today": string[], "blockers": string[] }
`;

function parseSummary(raw: string): SummaryShape {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Haiku returned non-JSON output for standup digest.');
  }
  const result = summarySchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      'Haiku output failed standup schema validation: ' +
        result.error.errors
          .slice(0, 3)
          .map((e) => e.path.join('.') + ' ' + e.message)
          .join('; ')
    );
  }
  return result.data;
}

async function callHaiku(
  apiKey: string,
  model: string,
  payload: { events: StandupEvent[]; userName: string; window: string }
): Promise<SummaryShape> {
  const userMessage = JSON.stringify(payload);
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
      system: STANDUP_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
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
  return parseSummary(text);
}

/**
 * Build a daily standup digest for one user. Uses Claude Haiku when an
 * Anthropic API key is supplied, otherwise falls back to the deterministic
 * formatter. Always returns a digest with a non-empty `contentMd`.
 */
export async function buildStandupDigest(input: BuildStandupInput): Promise<StandupDigest> {
  // Empty-event short-circuit so we don't burn a Haiku call for nothing.
  if (input.events.length === 0) {
    return buildStandupFallback(input);
  }

  if (!input.anthropicApiKey) {
    return buildStandupFallback(input);
  }

  const window = dateRangeLabel(input.windowStart, input.windowEnd);
  const name = input.userName ?? 'this engineer';
  const model = input.model ?? DEFAULT_HAIKU_MODEL;
  const startedAt = Date.now();
  const userMessage = JSON.stringify({ events: input.events, userName: name, window });
  try {
    const summary = await callHaiku(input.anthropicApiKey, model, {
      events: input.events,
      userName: name,
      window,
    });
    // Best-effort audit. We don't have the provider's exact token counts
    // from this minimal callHaiku() — estimate from message length so the
    // admin spend dashboard reflects standup activity. A future revision
    // should plumb the real usage block through callHaiku.
    if (input.organizationId) {
      await commitUsage({
        organizationId: input.organizationId,
        userId: input.userId,
        provider: 'anthropic',
        model,
        prompt: userMessage,
        inputTokens: Math.ceil(userMessage.length / 4),
        outputTokens: Math.ceil(JSON.stringify(summary).length / 4),
        latencyMs: Date.now() - startedAt,
        status: 'success',
        feature: 'standup',
      }).catch((auditErr) => {
        // Never let auditing break the cron run; just log.
        console.warn('[standup] llm_call_audit insert failed', auditErr);
      });
    }
    return {
      yesterday: summary.yesterday,
      today: summary.today,
      blockers: summary.blockers,
      contentMd: renderMarkdown(summary, window, name),
      blockersMd: renderBlockers(summary.blockers),
      sourceEvents: input.events,
    };
  } catch (err) {
    if (input.organizationId) {
      await commitUsage({
        organizationId: input.organizationId,
        userId: input.userId,
        provider: 'anthropic',
        model,
        prompt: userMessage,
        inputTokens: Math.ceil(userMessage.length / 4),
        outputTokens: 0,
        latencyMs: Date.now() - startedAt,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
        feature: 'standup',
      }).catch(() => {});
    }
    // Degrade to deterministic output instead of throwing — a missed
    // standup is better than a broken cron run.
    console.warn('[standup] Haiku call failed, falling back to heuristic', err);
    return buildStandupFallback(input);
  }
}
