/**
 * @jest-environment node
 */

import {
  decideJanitorActionHeuristic,
  sweepStaleIssues,
  STALE_AUTO_LABEL,
  StaleIssue,
} from '../janitor';

jest.mock('@/lib/ai/budget', () => ({
  commitUsage: jest.fn().mockResolvedValue(undefined),
}));

function mkIssue(overrides: Partial<StaleIssue> = {}): StaleIssue {
  return {
    id: 'i1',
    key: 'PROJ-1',
    title: 'Some old work',
    description: null,
    updatedAt: '2026-04-01T00:00:00Z',
    statusCategory: 'in_progress',
    assigneeId: 'u-assignee',
    reporterId: 'u-reporter',
    priority: 'medium',
    labels: [],
    staleDays: 35,
    ...overrides,
  };
}

describe('decideJanitorActionHeuristic', () => {
  it('always pings for critical priority', () => {
    const out = decideJanitorActionHeuristic(mkIssue({ priority: 'critical', staleDays: 120 }));
    expect(out.action).toBe('ping_assignee');
  });

  it('auto-closes unassigned low-priority issues over 60d', () => {
    const out = decideJanitorActionHeuristic(
      mkIssue({ assigneeId: null, priority: 'low', staleDays: 75 })
    );
    expect(out.action).toBe('auto_close_with_label');
    expect(out.label).toBe(STALE_AUTO_LABEL);
  });

  it('snoozes mid-stale assigned non-critical issues', () => {
    const out = decideJanitorActionHeuristic(mkIssue({ staleDays: 50, priority: 'medium' }));
    expect(out.action).toBe('snooze');
    expect(out.snoozeDays).toBe(14);
  });

  it('defaults to ping_assignee for ~30d stale issues', () => {
    const out = decideJanitorActionHeuristic(mkIssue({ staleDays: 32 }));
    expect(out.action).toBe('ping_assignee');
  });
});

describe('sweepStaleIssues without LLM credential', () => {
  it('uses the heuristic for every issue', async () => {
    const decisions = await sweepStaleIssues({
      workspaceId: 'org1',
      issues: [
        mkIssue({ id: 'a', key: 'A-1', staleDays: 32 }),
        mkIssue({
          id: 'b',
          key: 'B-1',
          assigneeId: null,
          priority: 'low',
          staleDays: 90,
        }),
      ],
    });
    expect(decisions.map((d) => d.action)).toEqual(['ping_assignee', 'auto_close_with_label']);
  });
});

describe('sweepStaleIssues with mocked Haiku responses', () => {
  const originalFetch = global.fetch;
  let warnSpy: jest.SpyInstance;
  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    global.fetch = originalFetch;
    warnSpy.mockRestore();
    jest.restoreAllMocks();
  });

  function mockHaiku(payload: object) {
    return jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: JSON.stringify(payload) }],
      }),
    });
  }

  it('uses the LLM action when confidence clears the floor', async () => {
    global.fetch = mockHaiku({
      action: 'snooze',
      reason: 'assignee on PTO',
      snoozeDays: 7,
      confidence: 0.82,
    }) as any;

    const [decision] = await sweepStaleIssues({
      workspaceId: 'org1',
      issues: [mkIssue()],
      anthropicApiKey: 'sk-ant-test',
    });
    expect(decision.action).toBe('snooze');
    expect(decision.snoozeDays).toBe(7);
    expect(decision.reason).toBe('assignee on PTO');
  });

  it('downgrades to ping_assignee when confidence is below floor', async () => {
    global.fetch = mockHaiku({
      action: 'auto_close_with_label',
      reason: 'looks done',
      confidence: 0.4, // below default floor 0.55
    }) as any;

    const [decision] = await sweepStaleIssues({
      workspaceId: 'org1',
      issues: [mkIssue()],
      anthropicApiKey: 'sk-ant-test',
    });
    expect(decision.action).toBe('ping_assignee');
    expect(decision.reason).toMatch(/Low confidence/);
  });

  it('falls back to heuristic when Haiku throws', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'oops',
    }) as any;

    const [decision] = await sweepStaleIssues({
      workspaceId: 'org1',
      issues: [mkIssue({ priority: 'critical' })],
      anthropicApiKey: 'sk-ant-test',
    });
    expect(decision.action).toBe('ping_assignee');
  });

  it('falls back to heuristic when Haiku returns non-JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'gibberish' }] }),
    }) as any;

    const [decision] = await sweepStaleIssues({
      workspaceId: 'org1',
      issues: [mkIssue({ staleDays: 50 })],
      anthropicApiKey: 'sk-ant-test',
    });
    // 50d, assigned, medium → heuristic picks snooze.
    expect(decision.action).toBe('snooze');
  });

  it('respects a custom confidence floor', async () => {
    global.fetch = mockHaiku({
      action: 'snooze',
      reason: 'looks fine',
      snoozeDays: 5,
      confidence: 0.6,
    }) as any;

    const [decision] = await sweepStaleIssues({
      workspaceId: 'org1',
      issues: [mkIssue()],
      anthropicApiKey: 'sk-ant-test',
      confidenceFloor: 0.8,
    });
    expect(decision.action).toBe('ping_assignee'); // 0.6 < 0.8 floor
  });
});
