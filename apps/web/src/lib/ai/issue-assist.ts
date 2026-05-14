/**
 * Issue-level AI helpers used from the issue detail sidebar:
 *   - summarize     → short plain-English summary of description + comments
 *   - rewrite       → polished/clarified description (keeps meaning)
 *   - suggest_next  → bullet list of next concrete actions
 *   - suggest_labels → up to 6 lowercase-kebab-case labels
 *
 * Uses the same provider abstraction as draft-issue.ts. Native fallback
 * gives a low-quality but always-available response so the UI is never
 * completely blank when no LLM is configured.
 */

import { AiDraftError, type DraftProvider, type BudgetContext } from './draft-issue';
import { estimatePromptTokens, runWithBudget } from './budget';

export const ISSUE_ASSIST_ACTIONS = [
  'summarize',
  'rewrite',
  'suggest_next',
  'suggest_labels',
] as const;
export type IssueAssistAction = (typeof ISSUE_ASSIST_ACTIONS)[number];

export interface IssueAssistRequest {
  action: IssueAssistAction;
  provider: DraftProvider;
  apiKey?: string | null;
  model?: string | null;
  issue: {
    key: string;
    type: string;
    title: string;
    description: string | null;
    priority: string;
    labels: string[];
  };
  recentComments?: Array<{ author: string; body: string; at: string }>;
  customPrompt?: string | null;
  budgetContext?: BudgetContext;
}

export interface IssueAssistResult {
  action: IssueAssistAction;
  text: string;
  labels?: string[];
}

function compactIssueBlock(r: IssueAssistRequest): string {
  const lines = [
    `Issue ${r.issue.key} · ${r.issue.type} · ${r.issue.priority}`,
    `Title: ${r.issue.title}`,
    r.issue.description ? `\nDescription:\n${r.issue.description}` : null,
    r.issue.labels.length > 0 ? `\nLabels: ${r.issue.labels.join(', ')}` : null,
  ];
  if (r.recentComments && r.recentComments.length > 0) {
    lines.push('\nRecent comments (newest first):');
    for (const c of r.recentComments.slice(0, 8)) {
      lines.push(`  - [${c.author} · ${c.at}] ${c.body.slice(0, 500)}`);
    }
  }
  return lines.filter(Boolean).join('\n');
}

function actionInstructions(action: IssueAssistAction): {
  system: string;
  expects: 'text' | 'json_labels';
} {
  switch (action) {
    case 'summarize':
      return {
        system:
          'Write a concise plain-English summary of the issue below — what is being worked on, what state it is in, and any open question from the comments. 3-5 short sentences max. No headers, no bullet lists.',
        expects: 'text',
      };
    case 'rewrite':
      return {
        system:
          'Rewrite the issue description to be clearer and better-structured without changing its meaning. Preserve technical details. Use short paragraphs or a short bullet list when it helps. Return the rewritten description only.',
        expects: 'text',
      };
    case 'suggest_next':
      return {
        system:
          'List the next concrete actions a developer should take on this issue. Output 3-5 bullet points only, each an imperative sentence starting with a verb ("Reproduce X", "Patch Y", etc). No preamble.',
        expects: 'text',
      };
    case 'suggest_labels':
      return {
        system:
          'Propose up to 6 useful labels for this issue. Return ONLY a JSON object {"labels": ["foo", "bar"]} with lowercase-kebab-case labels; no prose, no fences.',
        expects: 'json_labels',
      };
  }
}

function nativeFallback(request: IssueAssistRequest): IssueAssistResult {
  switch (request.action) {
    case 'summarize':
      return {
        action: request.action,
        text: `${request.issue.title}. Current priority: ${request.issue.priority}. ${
          request.issue.description ? 'A description is present.' : 'No description yet.'
        }${
          request.recentComments && request.recentComments.length > 0
            ? ` Latest comments from ${request.recentComments
                .slice(0, 3)
                .map((c) => c.author)
                .join(', ')}.`
            : ''
        }`,
      };
    case 'rewrite':
      return {
        action: request.action,
        text: request.issue.description
          ? request.issue.description.trim()
          : 'No description yet — add a short problem statement, steps to reproduce (if bug), and acceptance criteria.',
      };
    case 'suggest_next':
      return {
        action: request.action,
        text: [
          '- Confirm scope and acceptance criteria with the reporter.',
          '- Identify the smallest reproducible slice.',
          '- Open a draft implementation branch.',
        ].join('\n'),
      };
    case 'suggest_labels': {
      const lower = `${request.issue.title} ${request.issue.description ?? ''}`.toLowerCase();
      const hits = new Set<string>();
      if (/\b(ui|css|frontend)\b/.test(lower)) hits.add('frontend');
      if (/\b(api|backend|server)\b/.test(lower)) hits.add('backend');
      if (/\b(bug|fix|crash|broken)\b/.test(lower)) hits.add('bug');
      if (/\b(perf|slow)\b/.test(lower)) hits.add('performance');
      if (/\b(security|auth)\b/.test(lower)) hits.add('security');
      const labels = Array.from(hits);
      return { action: request.action, text: labels.join(', ') || 'triage', labels };
    }
  }
}

type CompletionResult = { text: string; inputTokens: number; outputTokens: number };

async function openAiCompletion(apiKey: string, model: string, system: string, user: string, json: boolean): Promise<CompletionResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
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
  const text = payload.choices?.[0]?.message?.content ?? '';
  return {
    text,
    inputTokens: payload.usage?.prompt_tokens ?? estimatePromptTokens(system + user),
    outputTokens: payload.usage?.completion_tokens ?? estimatePromptTokens(text),
  };
}

async function anthropicCompletion(apiKey: string, model: string, system: string, user: string): Promise<CompletionResult> {
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
      temperature: 0.3,
      system,
      messages: [{ role: 'user', content: user }],
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
  const text = payload.content?.find((b) => b.type === 'text')?.text ?? '';
  return {
    text,
    inputTokens: payload.usage?.input_tokens ?? estimatePromptTokens(system + user),
    outputTokens: payload.usage?.output_tokens ?? estimatePromptTokens(text),
  };
}

export async function runIssueAssist(request: IssueAssistRequest): Promise<IssueAssistResult> {
  const { system, expects } = actionInstructions(request.action);
  const user = request.customPrompt
    ? `${compactIssueBlock(request)}\n\nAdditional instruction: ${request.customPrompt}`
    : compactIssueBlock(request);

  if (request.provider === 'native' || !request.apiKey) {
    return nativeFallback(request);
  }

  const model =
    request.model ||
    (request.provider === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-4-6');

  const apiKey = request.apiKey;
  const provider = request.provider;

  const callProvider = async (): Promise<{
    value: CompletionResult;
    usage: { inputTokens: number; outputTokens: number };
  }> => {
    const out =
      provider === 'openai'
        ? await openAiCompletion(apiKey, model, system, user, expects === 'json_labels')
        : await anthropicCompletion(apiKey, model, system, user);
    return {
      value: out,
      usage: { inputTokens: out.inputTokens, outputTokens: out.outputTokens },
    };
  };

  const completion = request.budgetContext
    ? await runWithBudget(
        {
          organizationId: request.budgetContext.organizationId,
          userId: request.budgetContext.userId,
          provider: provider === 'openai' ? 'openai' : 'anthropic',
          model,
          feature: request.budgetContext.feature ?? 'assist',
          prompt: user,
          estimatedTokens: estimatePromptTokens(system + user) + 1024,
        },
        callProvider
      )
    : (await callProvider()).value;

  const raw = completion.text;

  if (expects === 'json_labels') {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      const parsed = JSON.parse(cleaned) as { labels?: unknown };
      const labels = Array.isArray(parsed.labels)
        ? parsed.labels
            .filter((v): v is string => typeof v === 'string')
            .map((v) => v.toLowerCase().trim())
            .filter(Boolean)
            .slice(0, 6)
        : [];
      return { action: request.action, text: labels.join(', '), labels };
    } catch {
      throw new AiDraftError(
        'invalid_json',
        'LLM returned non-JSON for label suggestion.'
      );
    }
  }

  return { action: request.action, text: raw.trim() };
}
