import {
  listIssueTimeEntries,
  logIssueTimeEntry,
  startIssueTimer,
  stopIssueTimer,
  suggestIssueEstimate,
  updateIssue,
} from './endpoints';
import { configureApi } from './client';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('time tracking API', () => {
  beforeAll(() => {
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  beforeEach(() => {
    jest.mocked(globalThis.fetch).mockReset();
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: 'authjs.session-token=abc' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('lists and normalizes issue time entries', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        entries: [
          {
            id: 'entry_1',
            issueId: 'issue_1',
            userId: 'user_1',
            startedAt: '2026-06-28T10:00:00.000Z',
            endedAt: null,
            durationSeconds: '1800',
            description: 'Investigation',
            source: 'timer',
          },
          { id: 'missing-start', issueId: 'issue_1' },
        ],
      }),
    );

    await expect(listIssueTimeEntries('issue_1')).resolves.toEqual([
      {
        id: 'entry_1',
        issueId: 'issue_1',
        userId: 'user_1',
        startedAt: '2026-06-28T10:00:00.000Z',
        endedAt: null,
        durationSeconds: 1800,
        description: 'Investigation',
        source: 'timer',
        integrationRef: null,
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/issues/issue_1/time-entries',
    );
  });

  it('starts and stops an issue timer', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(201, {
          entry: {
            id: 'entry_1',
            issueId: 'issue_1',
            startedAt: '2026-06-28T10:00:00.000Z',
            source: 'timer',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          entry: {
            id: 'entry_1',
            issueId: 'issue_1',
            startedAt: '2026-06-28T10:00:00.000Z',
            endedAt: '2026-06-28T10:30:00.000Z',
            source: 'timer',
          },
          actualHours: '0.5',
        }),
      );

    await expect(startIssueTimer('issue_1')).resolves.toMatchObject({
      entry: { id: 'entry_1', issueId: 'issue_1', source: 'timer' },
    });
    await expect(stopIssueTimer('issue_1', { description: 'Done' })).resolves.toMatchObject({
      entry: { id: 'entry_1', endedAt: '2026-06-28T10:30:00.000Z' },
      actualHours: 0.5,
    });

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/issues/issue_1/timer/start',
    );
    const [stopUrl, stopInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(stopUrl).toBe('https://tasks.example.com/api/issues/issue_1/timer/stop');
    expect(stopInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(stopInit?.body))).toEqual({ description: 'Done' });
  });

  it('logs manual time and persists estimate hours through PATCH', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(201, {
          entry: {
            id: 'entry_2',
            issueId: 'issue_1',
            startedAt: '2026-06-28T10:00:00.000Z',
            endedAt: '2026-06-28T11:15:00.000Z',
            durationSeconds: 4500,
            description: 'Build mobile panel',
            source: 'manual',
          },
          actualHours: 1.25,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'issue_1',
          projectId: 'project_1',
          type: 'task',
          title: 'Track time',
          estimateHours: '3',
          estimateSource: 'manual',
        }),
      );

    await logIssueTimeEntry('issue_1', {
      durationSeconds: 4500,
      description: 'Build mobile panel',
    });
    await updateIssue('issue_1', { estimateHours: 3, estimateSource: 'manual' });

    const [, logInit] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(JSON.parse(String(logInit?.body))).toEqual({
      durationSeconds: 4500,
      description: 'Build mobile panel',
    });
    const [patchUrl, patchInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(patchUrl).toBe('https://tasks.example.com/api/issues/issue_1');
    expect(patchInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(patchInit?.body))).toEqual({
      estimateHours: 3,
      estimateSource: 'manual',
    });
  });

  it('requests and normalizes an AI estimate suggestion', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        estimateHours: '5.5',
        p25Hours: '3',
        p75Hours: 8,
        reason: 'similar_issues',
        rationale: 'Similar to closed mobile issues.',
        sampleSize: '4',
        neighbours: [
          {
            id: 'issue_2',
            key: 'MOB-2',
            title: 'Previous work',
            actualHours: '5',
            similarity: '0.82',
          },
          { id: 'bad-neighbour' },
        ],
      }),
    );

    await expect(suggestIssueEstimate('issue_1')).resolves.toEqual({
      estimateHours: 5.5,
      p25Hours: 3,
      p75Hours: 8,
      reason: 'similar_issues',
      rationale: 'Similar to closed mobile issues.',
      sampleSize: 4,
      neighbours: [
        {
          id: 'issue_2',
          key: 'MOB-2',
          title: 'Previous work',
          actualHours: 5,
          similarity: 0.82,
        },
      ],
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/issues/issue_1/ai-estimate');
    expect(init).toMatchObject({ method: 'POST' });
  });
});
