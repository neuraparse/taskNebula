/**
 * AI Workspace Bootstrapper (P1-13).
 *
 * Given a natural-language project description plus team-size and primary
 * role hints, returns a fully-typed `WorkspaceSeed`: project name, team(s),
 * labels, priorities, an initial set of cycles (sprints) and a starter
 * backlog of issues. The seed is presented to the admin for review/edit
 * before any DB writes happen (see /api/onboarding/seed-preview ->
 * /api/onboarding/seed-apply).
 *
 * Provider selection:
 *   - "native" (default fallback): deterministic, no LLM. Used when no
 *     Anthropic credential is configured. Produces a sensible, generic
 *     plan based on the inputs so the wizard always works end-to-end.
 *   - "anthropic": Claude Sonnet via the public messages API with a
 *     strict-JSON prompt. Requires ANTHROPIC_API_KEY (env or override).
 *
 * This module performs NO database access on its own — it only generates
 * the plan. Applying the plan is the responsibility of the seed-apply
 * endpoint, which wraps everything in a transaction.
 */

import { z } from 'zod';

// ---------- Public schema ----------

export const SEED_PRIORITIES = ['critical', 'high', 'medium', 'low', 'none'] as const;

export const ONBOARDING_ROLES = [
  'engineering',
  'product',
  'design',
  'marketing',
  'operations',
  'founder',
  'other',
] as const;

export type OnboardingRole = (typeof ONBOARDING_ROLES)[number];

export const TEAM_SIZE_BUCKETS = ['solo', '2-5', '6-15', '16-50', '50+'] as const;
export type TeamSizeBucket = (typeof TEAM_SIZE_BUCKETS)[number];

const slugSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9-]+$/, 'slug must be kebab-case lowercase');

export const workspaceSeedSchema = z.object({
  projectName: z.string().min(1).max(120),
  projectKey: z
    .string()
    .min(2)
    .max(8)
    .regex(/^[A-Z][A-Z0-9]*$/, 'project key must be UPPERCASE alphanumeric starting with a letter'),
  teams: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        slug: slugSchema,
        members: z.array(z.string().min(1).max(120)).max(20).optional(),
      })
    )
    .min(1)
    .max(8),
  labels: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        // Tailwind-style hex is what the rest of the app uses, but we don't
        // hard-enforce a palette here — anything #rrggbb is fine.
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be #rrggbb hex'),
      })
    )
    .max(24),
  priorities: z.array(z.enum(SEED_PRIORITIES)).min(1).max(5),
  cycles: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        // ISO-8601 dates. The apply endpoint normalises these into Date()s.
        startDate: z.string().min(8),
        endDate: z.string().min(8),
      })
    )
    .min(1)
    .max(8),
  issues: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(4000).nullable().optional(),
        labels: z.array(z.string().min(1).max(40)).max(6).default([]),
        priority: z.enum(SEED_PRIORITIES).default('medium'),
        estimateHours: z.number().int().min(1).max(80).nullable().optional(),
        assigneeRole: z.string().min(1).max(40).optional(),
      })
    )
    .min(1)
    .max(40),
});

export type WorkspaceSeed = z.infer<typeof workspaceSeedSchema>;

// ---------- Errors ----------

export class BootstrapperError extends Error {
  constructor(
    public code:
      | 'invalid_input'
      | 'missing_credential'
      | 'provider_error'
      | 'invalid_json'
      | 'schema_violation',
    message: string
  ) {
    super(message);
    this.name = 'BootstrapperError';
  }
}

// ---------- Request types ----------

export type BootstrapperProvider = 'native' | 'anthropic';

export interface GenerateWorkspaceSeedInput {
  projectDescription: string;
  teamSize: TeamSizeBucket;
  role: OnboardingRole;
  /**
   * Optional provider override. Defaults to "anthropic" when ANTHROPIC_API_KEY
   * is set, otherwise "native".
   */
  provider?: BootstrapperProvider;
  /** Allows tests / callers to inject an explicit key. */
  apiKey?: string | null;
  /** Override the Claude model. Defaults to claude-sonnet-4-6. */
  model?: string | null;
  /**
   * Optional injected `fetch` for tests. Defaults to globalThis.fetch.
   */
  fetchImpl?: typeof fetch;
  /**
   * Today's date in ISO form, used to anchor cycle.startDate. Mostly useful
   * for deterministic tests.
   */
  now?: Date;
}

// ---------- Native fallback ----------

/**
 * Deterministic plan used when no LLM credentials are available. Generates a
 * reasonable starter workspace tuned by the supplied role + team size so the
 * /setup wizard is always functional even on air-gapped or zero-config
 * installs.
 */
export function generateWorkspaceSeedNative(
  input: Omit<GenerateWorkspaceSeedInput, 'provider' | 'apiKey' | 'model' | 'fetchImpl'>
): WorkspaceSeed {
  const description = input.projectDescription.trim();
  if (!description) {
    throw new BootstrapperError('invalid_input', 'projectDescription cannot be empty.');
  }

  const now = input.now ?? new Date();

  // Try to extract a project name from the first sentence.
  const firstSentence = description.split(/[.!?\n]/)[0] ?? description;
  const words = firstSentence
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const projectName = words.slice(0, 4).join(' ').slice(0, 80) || 'My Project';
  const projectKey = (
    words
      .map((w) => w[0]?.toUpperCase())
      .filter(Boolean)
      .join('')
      .slice(0, 5) || 'PROJ'
  ).replace(/[^A-Z]/g, '') || 'PROJ';

  // Team setup by size + role.
  const teams = nativeTeams(input.teamSize, input.role);

  const labels = nativeLabels(input.role);

  const priorities: WorkspaceSeed['priorities'] = ['critical', 'high', 'medium', 'low'];

  // Two 2-week cycles.
  const cycleLengthDays = 14;
  const cycles: WorkspaceSeed['cycles'] = [0, 1].map((i) => {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() + i * cycleLengthDays);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + cycleLengthDays - 1);
    return {
      name: `Cycle ${i + 1}`,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  });

  const issues = nativeIssues(input.role, description);

  return workspaceSeedSchema.parse({
    projectName,
    projectKey: projectKey.padEnd(2, 'X').slice(0, 8),
    teams,
    labels,
    priorities,
    cycles,
    issues,
  });
}

function nativeTeams(
  size: TeamSizeBucket,
  role: OnboardingRole
): WorkspaceSeed['teams'] {
  if (size === 'solo') {
    return [{ name: 'Core', slug: 'core' }];
  }
  if (role === 'engineering') {
    return size === '2-5'
      ? [{ name: 'Engineering', slug: 'engineering' }]
      : [
          { name: 'Engineering', slug: 'engineering' },
          { name: 'Platform', slug: 'platform' },
        ];
  }
  if (role === 'design') {
    return [
      { name: 'Design', slug: 'design' },
      { name: 'Engineering', slug: 'engineering' },
    ];
  }
  if (role === 'product') {
    return [
      { name: 'Product', slug: 'product' },
      { name: 'Engineering', slug: 'engineering' },
    ];
  }
  return [{ name: 'Core', slug: 'core' }];
}

function nativeLabels(role: OnboardingRole): WorkspaceSeed['labels'] {
  const base: WorkspaceSeed['labels'] = [
    { name: 'bug', color: '#ef4444' },
    { name: 'feature', color: '#3b82f6' },
    { name: 'chore', color: '#94a3b8' },
    { name: 'docs', color: '#10b981' },
  ];
  if (role === 'engineering' || role === 'product') {
    base.push({ name: 'tech-debt', color: '#f59e0b' });
  }
  if (role === 'design') {
    base.push({ name: 'ui', color: '#a855f7' });
  }
  if (role === 'marketing') {
    base.push({ name: 'campaign', color: '#ec4899' });
  }
  return base;
}

function nativeIssues(role: OnboardingRole, description: string): WorkspaceSeed['issues'] {
  const intro = description.slice(0, 200);
  const base: WorkspaceSeed['issues'] = [
    {
      title: 'Define project goals and success metrics',
      description: `Based on: "${intro}"\n\nCapture the top 3 outcomes that would make this project a success.`,
      labels: ['docs'],
      priority: 'high',
      estimateHours: 2,
    },
    {
      title: 'Set up project repository and CI',
      description: 'Initialise the codebase, lint/test scaffolding, and CI pipeline.',
      labels: ['chore'],
      priority: 'high',
      estimateHours: 4,
      assigneeRole: 'engineering',
    },
    {
      title: 'Draft first milestone scope',
      description: 'List the features needed to ship a usable v0.1.',
      labels: ['feature'],
      priority: 'medium',
      estimateHours: 3,
    },
    {
      title: 'Schedule weekly planning meeting',
      description: 'Owner walks the team through the active cycle each Monday.',
      labels: ['chore'],
      priority: 'low',
      estimateHours: 1,
    },
  ];
  if (role === 'design') {
    base.push({
      title: 'Sketch initial UI wireframes',
      description: 'Low-fidelity wireframes for the primary user flow.',
      labels: ['ui', 'feature'],
      priority: 'high',
      estimateHours: 4,
      assigneeRole: 'design',
    });
  }
  if (role === 'marketing') {
    base.push({
      title: 'Outline launch announcement copy',
      description: 'Tagline, three pillars, distribution channel checklist.',
      labels: ['campaign'],
      priority: 'medium',
      estimateHours: 2,
    });
  }
  return base;
}

// ---------- Anthropic adapter ----------

const SYSTEM_PROMPT = `You are TaskNebula's onboarding bootstrapper. Given a project description, team size and primary role, produce a starter workspace seed.

Return ONLY a JSON object — no prose, no markdown fences. Use this exact shape:

{
  "projectName": string (max 120 chars),
  "projectKey": string (2-8 chars, UPPERCASE alphanumeric, starts with letter),
  "teams": [{"name": string, "slug": kebab-case-lowercase, "members"?: string[]}] (1-8 items),
  "labels": [{"name": string, "color": "#rrggbb"}] (max 24),
  "priorities": ("critical"|"high"|"medium"|"low"|"none")[] (1-5 items, typically ["critical","high","medium","low"]),
  "cycles": [{"name": string, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}] (1-8 items, usually two 2-week sprints starting today),
  "issues": [{"title": string, "description": string|null, "labels": string[] (max 6), "priority": one of priorities, "estimateHours": integer 1-80|null, "assigneeRole"?: string}] (5-15 items)
}

Rules:
  - Faithful to the user description; do not invent unrelated scope.
  - Tailor team layout to the team-size bucket.
  - Tailor labels and issues to the primary role (engineering, design, marketing, etc.).
  - All label names referenced in issues MUST exist in the top-level labels array.
  - All dates use ISO YYYY-MM-DD; cycles must not overlap; first cycle starts today (UTC).
  - Output minified JSON only. No commentary.`;

function buildUserPrompt(input: GenerateWorkspaceSeedInput): string {
  const today = (input.now ?? new Date()).toISOString().slice(0, 10);
  return [
    `Today (UTC): ${today}`,
    `Team size: ${input.teamSize}`,
    `Primary role: ${input.role}`,
    `Project description: ${input.projectDescription.trim()}`,
  ].join('\n');
}

async function generateWorkspaceSeedAnthropic(
  input: GenerateWorkspaceSeedInput
): Promise<WorkspaceSeed> {
  const apiKey = input.apiKey ?? process.env.ANTHROPIC_API_KEY ?? null;
  if (!apiKey) {
    throw new BootstrapperError(
      'missing_credential',
      'No Anthropic API key available. Set ANTHROPIC_API_KEY or pass `apiKey`.'
    );
  }
  const model = input.model || 'claude-sonnet-4-6';
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;

  let response: Response;
  try {
    response = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(input) }],
      }),
    });
  } catch (err) {
    throw new BootstrapperError(
      'provider_error',
      `Network error contacting Anthropic: ${(err as Error).message}`
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new BootstrapperError(
      'provider_error',
      `Anthropic returned ${response.status}: ${detail.slice(0, 200)}`
    );
  }

  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const raw = payload.content?.find((b) => b.type === 'text')?.text ?? '';
  return parseAndValidate(raw);
}

function parseAndValidate(raw: string): WorkspaceSeed {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  if (!cleaned) {
    throw new BootstrapperError('invalid_json', 'LLM returned an empty response.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new BootstrapperError('invalid_json', 'LLM returned non-JSON output.');
  }
  const result = workspaceSeedSchema.safeParse(parsed);
  if (!result.success) {
    throw new BootstrapperError(
      'schema_violation',
      `LLM output failed validation: ${result.error.errors
        .slice(0, 3)
        .map((e) => `${e.path.join('.')} ${e.message}`)
        .join('; ')}`
    );
  }
  return result.data;
}

// ---------- Public entry point ----------

/**
 * Generate a starter workspace seed. Uses Claude Sonnet when an Anthropic
 * key is available; otherwise falls back to a deterministic native plan.
 */
export async function generateWorkspaceSeed(
  input: GenerateWorkspaceSeedInput
): Promise<WorkspaceSeed> {
  if (!input.projectDescription || !input.projectDescription.trim()) {
    throw new BootstrapperError('invalid_input', 'projectDescription is required.');
  }
  if (!TEAM_SIZE_BUCKETS.includes(input.teamSize)) {
    throw new BootstrapperError('invalid_input', `teamSize must be one of ${TEAM_SIZE_BUCKETS.join(', ')}`);
  }
  if (!ONBOARDING_ROLES.includes(input.role)) {
    throw new BootstrapperError('invalid_input', `role must be one of ${ONBOARDING_ROLES.join(', ')}`);
  }

  const provider: BootstrapperProvider =
    input.provider ?? (input.apiKey || process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'native');

  if (provider === 'native') {
    return generateWorkspaceSeedNative(input);
  }
  return generateWorkspaceSeedAnthropic(input);
}
