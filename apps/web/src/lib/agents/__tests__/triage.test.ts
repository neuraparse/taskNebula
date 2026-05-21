/**
 * @jest-environment node
 *
 * Unit tests for the Triage Intelligence agent. We bypass `loadTriageContext`
 * (which would hit the DB) via `loadContextOverride` and inject a fake LLM
 * client so the test stays fast and hermetic.
 */

import {
  triageIssue,
  triageIssueNative,
  triageSuggestionSchema,
  type TriageContext,
  type TriageLlmClient,
} from '../triage';
import { AiDraftError } from '@/lib/ai/draft-issue';

// Avoid pulling the real `@tasknebula/db` (which would try to connect to
// pg). We never trigger the DB path because every test passes
// `loadContextOverride`, but the file still imports the module so it
// must resolve.
jest.mock('@tasknebula/db', () => ({
  __esModule: true,
  db: {},
  desc: () => undefined,
  eq: () => undefined,
  inArray: () => undefined,
  issues: {},
  organizationMembers: {},
  projectMembers: {},
  projects: {},
  teams: {},
  teamMembers: {},
  users: {},
}));

// Same — credentials module would otherwise try to call into the DB.
jest.mock('@/lib/agents/credentials', () => ({
  getOrganizationSettingsForAgentCredentials: jest.fn().mockResolvedValue(null),
  resolveProviderApiKeyFromSettings: jest.fn().mockReturnValue(null),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const credentials = require('@/lib/agents/credentials') as {
  resolveProviderApiKeyFromSettings: jest.Mock;
};

const baseContext: TriageContext = {
  issue: {
    id: 'iss_1',
    organizationId: 'org_1',
    projectId: 'proj_1',
    key: 'ACME-42',
    type: 'bug',
    title: 'Login spinner stuck after SSO redirect',
    description:
      'Users using Okta SSO see the spinner freeze when redirected back. Repro: 1) click login 2) approve in Okta 3) loop.',
    priority: 'medium',
    labels: [],
    reporterId: 'usr_reporter',
    assigneeId: null,
  },
  projectKey: 'ACME',
  projectName: 'ACME Web',
  labelCatalog: ['auth', 'sso', 'frontend', 'backend', 'bug'],
  teamTaxonomy: [
    { id: 'team_identity', name: 'Identity', description: 'SSO/Auth platform' },
    { id: 'team_growth', name: 'Growth', description: null },
  ],
  candidateAssignees: [
    { id: 'usr_alice', name: 'Alice' },
    { id: 'usr_bob', name: 'Bob' },
  ],
  recentIssues: [
    {
      key: 'ACME-40',
      title: 'Okta callback drops state param',
      type: 'bug',
      priority: 'high',
      labels: ['auth', 'sso'],
      assigneeId: 'usr_alice',
    },
  ],
};

function fakeLlm(rawJson: string): TriageLlmClient {
  return {
    generate: jest.fn().mockResolvedValue(rawJson),
  };
}

describe('triageIssueNative (no-LLM fallback)', () => {
  it('produces a schema-valid suggestion with low confidence', () => {
    const out = triageIssueNative(baseContext);
    expect(triageSuggestionSchema.safeParse(out).success).toBe(true);
    expect(out.confidence).toBeLessThanOrEqual(30);
    expect(out.suggested_assignee_id).toBeNull();
    expect(out.team_id).toBeNull();
  });

  it('escalates priority on urgency cues in the description', () => {
    const urgent: TriageContext = {
      ...baseContext,
      issue: {
        ...baseContext.issue,
        title: 'Payments API outage — all checkouts failing',
        description:
          'P0: production payment endpoint returns 502 for every user. Customers cannot pay.',
      },
    };
    const out = triageIssueNative(urgent);
    expect(out.priority).toBe('critical');
  });

  it('picks up label cues from title + description', () => {
    const ui: TriageContext = {
      ...baseContext,
      issue: {
        ...baseContext.issue,
        title: 'UI bug: button alignment broken on Safari',
        description: 'Frontend CSS regression — auth login button shifts right.',
      },
    };
    const out = triageIssueNative(ui);
    expect(out.labels).toEqual(expect.arrayContaining(['frontend', 'bug', 'security']));
  });
});

describe('triageIssue with mocked LLM provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the native fallback when no provider credential is available', async () => {
    credentials.resolveProviderApiKeyFromSettings.mockReturnValue(null);
    const llm = fakeLlm('{}');
    const { suggestion } = await triageIssue('iss_1', {
      loadContextOverride: baseContext,
      llmClient: llm,
    });
    expect(llm.generate).not.toHaveBeenCalled();
    expect(suggestion.confidence).toBeLessThanOrEqual(30);
  });

  it('parses a well-formed LLM response and guards fabricated assignee ids', async () => {
    credentials.resolveProviderApiKeyFromSettings.mockReturnValue('sk-test');
    const llm = fakeLlm(
      JSON.stringify({
        labels: ['auth', 'sso', 'bug'],
        priority: 'high',
        // assignee_id that is NOT in candidateAssignees — must be dropped.
        suggested_assignee_id: 'usr_fabricated',
        team_id: 'team_identity',
        confidence: 87,
        rationale: 'Strongly resembles ACME-40 (Okta callback bug, also high).',
      })
    );
    const { suggestion } = await triageIssue('iss_1', {
      loadContextOverride: baseContext,
      llmClient: llm,
      provider: 'anthropic',
    });
    expect(llm.generate).toHaveBeenCalledTimes(1);
    expect(suggestion.priority).toBe('high');
    expect(suggestion.team_id).toBe('team_identity');
    expect(suggestion.suggested_assignee_id).toBeNull(); // fabricated id was scrubbed
    expect(suggestion.labels).toEqual(expect.arrayContaining(['auth', 'sso', 'bug']));
    expect(suggestion.confidence).toBe(87);
  });

  it('keeps a real assignee id from candidateAssignees', async () => {
    credentials.resolveProviderApiKeyFromSettings.mockReturnValue('sk-test');
    const llm = fakeLlm(
      JSON.stringify({
        labels: ['auth'],
        priority: 'medium',
        suggested_assignee_id: 'usr_alice',
        team_id: 'team_identity',
        confidence: 70,
        rationale: 'Alice owned the previous SSO callback bug.',
      })
    );
    const { suggestion } = await triageIssue('iss_1', {
      loadContextOverride: baseContext,
      llmClient: llm,
    });
    expect(suggestion.suggested_assignee_id).toBe('usr_alice');
  });

  it('rejects schema-invalid LLM output with AiDraftError("schema_violation")', async () => {
    credentials.resolveProviderApiKeyFromSettings.mockReturnValue('sk-test');
    const llm = fakeLlm(
      JSON.stringify({
        labels: 'not-an-array',
        priority: 'nonsense',
        confidence: 999,
      })
    );
    await expect(
      triageIssue('iss_1', { loadContextOverride: baseContext, llmClient: llm })
    ).rejects.toBeInstanceOf(AiDraftError);
  });

  it('rejects non-JSON LLM output with AiDraftError("invalid_json")', async () => {
    credentials.resolveProviderApiKeyFromSettings.mockReturnValue('sk-test');
    const llm = fakeLlm('this is not json');
    await expect(
      triageIssue('iss_1', { loadContextOverride: baseContext, llmClient: llm })
    ).rejects.toMatchObject({ code: 'invalid_json' });
  });

  it('strips markdown fences before parsing', async () => {
    credentials.resolveProviderApiKeyFromSettings.mockReturnValue('sk-test');
    const fenced =
      '```json\n' +
      JSON.stringify({
        labels: ['bug'],
        priority: 'low',
        suggested_assignee_id: null,
        team_id: null,
        confidence: 55,
        rationale: 'Minor cosmetic issue.',
      }) +
      '\n```';
    const llm = fakeLlm(fenced);
    const { suggestion } = await triageIssue('iss_1', {
      loadContextOverride: baseContext,
      llmClient: llm,
    });
    expect(suggestion.priority).toBe('low');
  });
});
