/**
 * @jest-environment node
 */

import {
  buildStandupDigest,
  buildStandupFallback,
  StandupEvent,
} from '../standup';

const FIXED_WINDOW_START = new Date('2026-05-13T08:00:00Z');
const FIXED_WINDOW_END = new Date('2026-05-14T08:00:00Z');

function ev(overrides: Partial<StandupEvent>): StandupEvent {
  return {
    type: 'issue_status_changed',
    ref: 'PROJ-1',
    summary: 'demo',
    at: '2026-05-13T12:00:00Z',
    ...overrides,
  };
}

describe('buildStandupFallback', () => {
  it('groups closed/transitioned/created issues into yesterday', () => {
    const digest = buildStandupFallback({
      userId: 'u1',
      userName: 'Ada',
      events: [
        ev({ type: 'issue_closed', ref: 'PROJ-1', summary: 'fix login' }),
        ev({ type: 'issue_status_changed', ref: 'PROJ-2', summary: 'add tests' }),
        ev({ type: 'issue_created', ref: 'PROJ-3', summary: 'flake' }),
      ],
      windowStart: FIXED_WINDOW_START,
      windowEnd: FIXED_WINDOW_END,
    });
    expect(digest.yesterday).toEqual([
      'Closed PROJ-1 — fix login',
      'Moved PROJ-2: add tests',
      'Filed PROJ-3: flake',
    ]);
    expect(digest.today).toEqual([]);
    expect(digest.contentMd).toContain('### Standup — Ada');
    expect(digest.contentMd).toContain('PROJ-1');
  });

  it('routes blocker phrases into the blockers bucket', () => {
    const digest = buildStandupFallback({
      userId: 'u1',
      userName: 'Ada',
      events: [
        ev({
          type: 'comment_authored',
          ref: 'PROJ-9',
          summary: 'blocked on review from infra team',
        }),
      ],
      windowStart: FIXED_WINDOW_START,
      windowEnd: FIXED_WINDOW_END,
    });
    expect(digest.blockers.length).toBe(1);
    expect(digest.blockersMd).toContain('PROJ-9');
    expect(digest.contentMd).toContain('**Blockers**');
  });

  it('produces a "no activity" digest when given zero events', () => {
    const digest = buildStandupFallback({
      userId: 'u1',
      events: [],
      windowStart: FIXED_WINDOW_START,
      windowEnd: FIXED_WINDOW_END,
    });
    expect(digest.yesterday).toEqual([]);
    expect(digest.contentMd).toContain('No tracked activity');
    expect(digest.blockers).toEqual([]);
  });

  it('dedupes identical lines', () => {
    const digest = buildStandupFallback({
      userId: 'u1',
      events: [
        ev({ type: 'issue_closed', ref: 'PROJ-1', summary: 'fix login' }),
        ev({ type: 'issue_closed', ref: 'PROJ-1', summary: 'fix login' }),
      ],
      windowStart: FIXED_WINDOW_START,
      windowEnd: FIXED_WINDOW_END,
    });
    expect(digest.yesterday).toEqual(['Closed PROJ-1 — fix login']);
  });
});

describe('buildStandupDigest (Haiku adapter)', () => {
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

  it('falls back to deterministic output when no api key', async () => {
    const digest = await buildStandupDigest({
      userId: 'u1',
      events: [ev({ type: 'issue_closed', ref: 'PROJ-1', summary: 'ship feature' })],
      windowStart: FIXED_WINDOW_START,
      windowEnd: FIXED_WINDOW_END,
      anthropicApiKey: null,
    });
    expect(digest.yesterday).toEqual(['Closed PROJ-1 — ship feature']);
  });

  it('uses Haiku output when provided and key is set', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              yesterday: ['Shipped PROJ-1: login flow refactor'],
              today: ['Reviewing PROJ-2: signup edge cases'],
              blockers: [],
            }),
          },
        ],
      }),
    }) as any;

    const digest = await buildStandupDigest({
      userId: 'u1',
      userName: 'Ada',
      events: [ev({ type: 'issue_closed', ref: 'PROJ-1', summary: 'ship login' })],
      windowStart: FIXED_WINDOW_START,
      windowEnd: FIXED_WINDOW_END,
      anthropicApiKey: 'sk-ant-test',
    });
    expect(digest.yesterday).toEqual(['Shipped PROJ-1: login flow refactor']);
    expect(digest.today).toEqual(['Reviewing PROJ-2: signup edge cases']);
    expect(digest.blockers).toEqual([]);
    expect(digest.contentMd).toContain('Shipped PROJ-1');
  });

  it('falls back to heuristic when Haiku returns invalid JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'not-json-at-all' }],
      }),
    }) as any;

    const digest = await buildStandupDigest({
      userId: 'u1',
      events: [ev({ type: 'issue_closed', ref: 'PROJ-1', summary: 'ship' })],
      windowStart: FIXED_WINDOW_START,
      windowEnd: FIXED_WINDOW_END,
      anthropicApiKey: 'sk-ant-test',
    });
    expect(digest.yesterday).toEqual(['Closed PROJ-1 — ship']);
  });

  it('falls back to heuristic when Haiku errors out', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'oops',
    }) as any;

    const digest = await buildStandupDigest({
      userId: 'u1',
      events: [ev({ type: 'issue_created', ref: 'PROJ-7', summary: 'new bug' })],
      windowStart: FIXED_WINDOW_START,
      windowEnd: FIXED_WINDOW_END,
      anthropicApiKey: 'sk-ant-test',
    });
    expect(digest.yesterday).toEqual(['Filed PROJ-7: new bug']);
  });

  it('skips Haiku entirely when events are empty', async () => {
    global.fetch = jest.fn();
    const digest = await buildStandupDigest({
      userId: 'u1',
      events: [],
      windowStart: FIXED_WINDOW_START,
      windowEnd: FIXED_WINDOW_END,
      anthropicApiKey: 'sk-ant-test',
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(digest.contentMd).toContain('No tracked activity');
  });
});
