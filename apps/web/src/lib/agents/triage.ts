/**
 * Triage Intelligence agent (TaskNebula Roadmap P0-02).
 *
 * Given an issue ID, builds a compact context window (issue body +
 * workspace label catalog + team taxonomies + last 50 issues for the
 * project as embedding-style context) and asks a cheap LLM to propose
 * structured triage metadata.
 *
 * Output shape (mirrors the persisted `issue_triage_suggestions.payload`):
 *
 *   {
 *     labels: string[],              // up to 8 lowercase-kebab-case
 *     priority: IssuePriority,       // 'critical' | 'high' | ... | 'none'
 *     suggested_assignee_id: string | null,
 *     team_id: string | null,
 *     confidence: number,            // 0..100
 *     rationale: string,             // <= 400 chars, human-readable why
 *   }
 *
 * Provider resolution mirrors apps/web/src/lib/ai/draft-issue.ts so the
 * same workspace + platform credential chain applies. The default model
 * is the cheapest Claude variant the catalog exposes ("claude-haiku-*")
 * because triage runs on every issue create — cost discipline matters.
 *
 * The agent never mutates the issue itself; persistence and apply flow
 * live in apps/web/src/app/api/issues/[issueId]/triage routes.
 */

import { z } from 'zod';
import {
  db,
  and,
  desc,
  eq,
  inArray,
  issues,
  organizationMembers,
  projectMembers,
  projects,
  teams,
  teamMembers,
  users,
} from '@tasknebula/db';
import { AiDraftError } from '@/lib/ai/draft-issue';
import {
  getOrganizationSettingsForAgentCredentials,
  resolveProviderApiKeyFromSettings,
} from '@/lib/agents/credentials';

export const TRIAGE_PRIORITIES = ['critical', 'high', 'medium', 'low', 'none'] as const;
export type TriagePriority = (typeof TRIAGE_PRIORITIES)[number];

export const triageSuggestionSchema = z.object({
  labels: z.array(z.string().min(1).max(40)).max(8).default([]),
  priority: z.enum(TRIAGE_PRIORITIES),
  suggested_assignee_id: z.string().nullable().default(null),
  team_id: z.string().nullable().default(null),
  confidence: z.number().int().min(0).max(100),
  rationale: z.string().min(1).max(400),
});

export type TriageSuggestionPayload = z.infer<typeof triageSuggestionSchema>;

/**
 * Minimal subset of fields the triage agent needs about an issue.
 * Kept separate from the DB row type so tests can construct fixtures
 * without dragging in every column.
 */
export interface TriageIssueSnapshot {
  id: string;
  organizationId: string;
  projectId: string;
  key: string;
  type: string;
  title: string;
  description: string | null;
  priority: TriagePriority;
  labels: string[];
  reporterId: string;
  assigneeId: string | null;
}

export interface TriageContext {
  issue: TriageIssueSnapshot;
  projectKey: string;
  projectName: string;
  // Distinct labels seen across recent issues in this project — acts as
  // an implicit "workspace label catalog" until task #4 introduces an
  // explicit labels table.
  labelCatalog: string[];
  teamTaxonomy: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
  // Members that could reasonably be assigned. We bound this aggressively
  // (max 30) so the prompt stays small; the LLM picks from this list.
  candidateAssignees: Array<{ id: string; name: string | null }>;
  // Up to 50 most recent issues; titles + statuses + assignees act as
  // implicit retrieval context (full embeddings live in task #1).
  recentIssues: Array<{
    key: string;
    title: string;
    type: string;
    priority: string;
    labels: string[];
    assigneeId: string | null;
  }>;
}

export interface TriageOptions {
  // Override the provider for tests / forced-routing. Defaults to
  // 'anthropic' when an API key is resolvable, otherwise 'native'.
  provider?: 'native' | 'openai' | 'anthropic';
  // Allow callers to inject an LLM client (used by jest tests).
  llmClient?: TriageLlmClient;
  // Override the model identifier — defaults to a cheap Haiku variant.
  model?: string;
  // Skip persistence when we just want the proposal back (tests).
  loadContextOverride?: TriageContext;
}

export interface TriageLlmClient {
  generate(args: {
    system: string;
    user: string;
    provider: 'openai' | 'anthropic';
    apiKey: string;
    model: string;
  }): Promise<string>;
}

const DEFAULT_HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

/** ---------- context loading ---------- */

async function loadTriageContext(issueId: string): Promise<TriageContext | null> {
  const [issue] = await db
    .select({
      id: issues.id,
      organizationId: issues.organizationId,
      projectId: issues.projectId,
      key: issues.key,
      type: issues.type,
      title: issues.title,
      description: issues.description,
      priority: issues.priority,
      labels: issues.labels,
      reporterId: issues.reporterId,
      assigneeId: issues.assigneeId,
    })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);
  if (!issue) return null;

  const [project] = await db
    .select({ id: projects.id, name: projects.name, key: projects.key })
    .from(projects)
    .where(eq(projects.id, issue.projectId))
    .limit(1);

  // 50 most recent issues in the same project — used as retrieval context.
  const recent = await db
    .select({
      key: issues.key,
      title: issues.title,
      type: issues.type,
      priority: issues.priority,
      labels: issues.labels,
      assigneeId: issues.assigneeId,
    })
    .from(issues)
    .where(eq(issues.projectId, issue.projectId))
    .orderBy(desc(issues.createdAt))
    .limit(50);

  // Workspace label catalog = distinct labels across recent issues.
  const labelCatalog = Array.from(
    new Set(
      recent
        .flatMap((row) => (Array.isArray(row.labels) ? (row.labels as string[]) : []))
        .filter((l): l is string => typeof l === 'string' && l.length > 0)
    )
  ).slice(0, 80);

  // Team taxonomy for the issue's organization.
  const teamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
    })
    .from(teams)
    .where(eq(teams.organizationId, issue.organizationId))
    .limit(40);

  // Candidate assignees: project members + team members for any team in
  // this org. We dedupe and cap at 30 to keep the prompt tight.
  const projectMemberRows = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, issue.projectId))
    .limit(60);
  const orgMemberRows = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, issue.organizationId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(60);
  const memberIds = Array.from(
    new Set([...projectMemberRows.map((r) => r.userId), ...orgMemberRows.map((r) => r.userId)])
  ).slice(0, 30);

  const memberUsers = memberIds.length
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, memberIds))
    : [];

  return {
    issue: {
      id: issue.id,
      organizationId: issue.organizationId,
      projectId: issue.projectId,
      key: issue.key,
      type: issue.type as string,
      title: issue.title,
      description: issue.description ?? null,
      priority: issue.priority as TriagePriority,
      labels: Array.isArray(issue.labels) ? (issue.labels as string[]) : [],
      reporterId: issue.reporterId,
      assigneeId: issue.assigneeId,
    },
    projectKey: project?.key ?? '',
    projectName: project?.name ?? '',
    labelCatalog,
    teamTaxonomy: teamRows.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description ?? null,
    })),
    candidateAssignees: memberUsers.map((u) => ({ id: u.id, name: u.name })),
    recentIssues: recent.map((r) => ({
      key: r.key,
      title: r.title,
      type: r.type as string,
      priority: r.priority as string,
      labels: Array.isArray(r.labels) ? (r.labels as string[]) : [],
      assigneeId: r.assigneeId,
    })),
  };
}

/** ---------- prompt building ---------- */

function buildPrompt(context: TriageContext) {
  const issue = context.issue;
  const system = [
    `You are TaskNebula's triage assistant for project "${context.projectName}" (key ${context.projectKey}).`,
    `Goal: propose labels, priority, suggested assignee, owning team, and a confidence score for ONE new issue.`,
    `Rules:`,
    `  - Only pick assignees from "Candidate assignees" (use the id, not the name). Use null if none fits.`,
    `  - Only pick a team id from "Teams" (use the id). Use null if none fits.`,
    `  - Pick labels from "Existing labels" when one applies; invent at most 2 new ones.`,
    `  - Priority must be one of: critical | high | medium | low | none.`,
    `  - Confidence is an integer 0..100. Reflect actual uncertainty: low when the issue is vague, high when it clearly resembles past triaged work.`,
    `  - Rationale: one short sentence, <=350 chars, explaining the choice.`,
    `Return ONLY a JSON object with keys: labels, priority, suggested_assignee_id, team_id, confidence, rationale. No prose, no fences.`,
  ].join('\n');

  const labelsBlock = context.labelCatalog.length
    ? `Existing labels: ${context.labelCatalog.slice(0, 40).join(', ')}`
    : 'Existing labels: (none yet — invent up to 2)';

  const teamsBlock = context.teamTaxonomy.length
    ? `Teams:\n${context.teamTaxonomy
        .slice(0, 20)
        .map(
          (t) =>
            `  - ${t.id} :: ${t.name}${t.description ? ` — ${t.description.slice(0, 80)}` : ''}`
        )
        .join('\n')}`
    : 'Teams: (no teams defined)';

  const peopleBlock = context.candidateAssignees.length
    ? `Candidate assignees:\n${context.candidateAssignees
        .slice(0, 20)
        .map((u) => `  - ${u.id} :: ${u.name ?? '(unnamed)'}`)
        .join('\n')}`
    : 'Candidate assignees: (none — return null)';

  const recentBlock = context.recentIssues.length
    ? `Recent issues in this project (newest first, for pattern-matching):\n${context.recentIssues
        .slice(0, 30)
        .map(
          (r) =>
            `  - ${r.key} [${r.type}/${r.priority}] ${r.title.slice(0, 90)}${
              r.labels.length ? ` ::labels=${r.labels.slice(0, 4).join(',')}` : ''
            }`
        )
        .join('\n')}`
    : 'Recent issues: (none)';

  const user = [
    `New issue ${issue.key} (${issue.type})`,
    `Title: ${issue.title}`,
    issue.description
      ? `Description:\n${issue.description.slice(0, 4000)}`
      : 'Description: (empty)',
    `Current labels: ${issue.labels.join(', ') || '(none)'}`,
    `Current priority: ${issue.priority}`,
    '',
    labelsBlock,
    '',
    teamsBlock,
    '',
    peopleBlock,
    '',
    recentBlock,
  ].join('\n');

  return { system, user };
}

/** ---------- providers ---------- */

const defaultLlmClient: TriageLlmClient = {
  async generate({ system, user, provider, apiKey, model }) {
    if (provider === 'openai') {
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
            { role: 'user', content: user },
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
      };
      return payload.choices?.[0]?.message?.content ?? '{}';
    }
    // anthropic
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
    };
    return payload.content?.find((b) => b.type === 'text')?.text ?? '{}';
  },
};

/** ---------- native (LLM-free) fallback ---------- */

/**
 * Deterministic, no-LLM triage. Used when there's no provider credential
 * configured anywhere in the chain. Quality is intentionally low — its
 * job is to keep the API functional, not to compete with the LLM path.
 */
export function triageIssueNative(context: TriageContext): TriageSuggestionPayload {
  const issue = context.issue;
  const lower = `${issue.title} ${issue.description ?? ''}`.toLowerCase();

  const priority: TriagePriority = /\b(urgent|p0|critical|down|outage|payment|sev[- ]?1)\b/.test(
    lower
  )
    ? 'critical'
    : /\b(important|p1|regression|security)\b/.test(lower)
      ? 'high'
      : /\b(minor|nit|typo|p3|low)\b/.test(lower)
        ? 'low'
        : 'medium';

  const labels = new Set<string>(issue.labels);
  if (/\b(ui|css|frontend)\b/.test(lower)) labels.add('frontend');
  if (/\b(api|backend|server)\b/.test(lower)) labels.add('backend');
  if (/\b(bug|crash|broken|fix)\b/.test(lower)) labels.add('bug');
  if (/\b(perf|slow|latency)\b/.test(lower)) labels.add('performance');
  if (/\b(security|auth|xss)\b/.test(lower)) labels.add('security');

  return {
    labels: Array.from(labels).slice(0, 8),
    priority,
    suggested_assignee_id: null,
    team_id: null,
    confidence: 20, // intentionally low — heuristic guess
    rationale:
      'Heuristic triage (no LLM credential resolved); priority/labels inferred from title+description keywords.',
  };
}

/** ---------- parse + validate ---------- */

function parseTriageOutput(raw: string, context: TriageContext): TriageSuggestionPayload {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AiDraftError('invalid_json', 'Triage LLM returned non-JSON output.');
  }
  const result = triageSuggestionSchema.safeParse(parsed);
  if (!result.success) {
    throw new AiDraftError(
      'schema_violation',
      `Triage output failed validation: ${result.error.errors
        .slice(0, 3)
        .map((e) => e.path.join('.') + ' ' + e.message)
        .join('; ')}`
    );
  }
  const out = result.data;

  // Guardrail: drop fabricated IDs that don't appear in the candidate
  // sets. The LLM occasionally invents plausible-looking cuids.
  const memberSet = new Set(context.candidateAssignees.map((a) => a.id));
  if (out.suggested_assignee_id && !memberSet.has(out.suggested_assignee_id)) {
    out.suggested_assignee_id = null;
  }
  const teamSet = new Set(context.teamTaxonomy.map((t) => t.id));
  if (out.team_id && !teamSet.has(out.team_id)) {
    out.team_id = null;
  }
  // Normalize labels: lowercase + kebab-case-ish, dedupe.
  out.labels = Array.from(
    new Set(
      out.labels
        .map((l) => l.toLowerCase().trim().replace(/\s+/g, '-'))
        .filter((l) => l.length > 0 && l.length <= 40)
    )
  ).slice(0, 8);
  return out;
}

/** ---------- public entry ---------- */

export async function triageIssue(
  issueId: string,
  options: TriageOptions = {}
): Promise<{ context: TriageContext; suggestion: TriageSuggestionPayload }> {
  const context = options.loadContextOverride ?? (await loadTriageContext(issueId));
  if (!context) {
    throw new AiDraftError('issue_not_found', `Issue ${issueId} does not exist.`);
  }

  // Resolve provider + credentials from the issue's organization.
  const settings = await getOrganizationSettingsForAgentCredentials(
    context.issue.organizationId
  ).catch(() => null);

  let provider: 'native' | 'openai' | 'anthropic' = options.provider ?? 'anthropic';
  let apiKey: string | null = null;

  if (provider !== 'native') {
    apiKey =
      resolveProviderApiKeyFromSettings(settings, provider) ??
      // Try the other major provider as a fallback before falling back to native.
      (() => {
        const alt = provider === 'anthropic' ? 'openai' : 'anthropic';
        const altKey = resolveProviderApiKeyFromSettings(settings, alt as any);
        if (altKey) {
          provider = alt as typeof provider;
          return altKey;
        }
        return null;
      })();
  }

  if (provider === 'native' || !apiKey) {
    return { context, suggestion: triageIssueNative(context) };
  }

  const model =
    options.model ?? (provider === 'anthropic' ? DEFAULT_HAIKU_MODEL : DEFAULT_OPENAI_MODEL);
  const llm = options.llmClient ?? defaultLlmClient;
  const { system, user } = buildPrompt(context);
  const raw = await llm.generate({ system, user, provider, apiKey, model });
  const suggestion = parseTriageOutput(raw, context);
  return { context, suggestion };
}

export const __internal = {
  buildPrompt,
  parseTriageOutput,
  loadTriageContext,
};
