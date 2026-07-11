import { getDoraAnalytics, getProjectAnalytics } from './endpoints';
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

describe('project analytics API', () => {
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

  it('loads and normalizes project analytics from web endpoints', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          overview: {
            totalIssues: '12',
            overdueIssues: '2',
            unassignedIssues: 3,
          },
          sprints: {
            total: '4',
            active: '1',
            completed: '2',
          },
          issuesByStatus: [
            {
              status: 'done',
              name: 'Done',
              color: '#22c55e',
              category: 'done',
              count: '5',
            },
            { name: 'Missing status' },
          ],
          issuesByPriority: [{ priority: 'high', count: '3' }],
          issuesByType: [{ type: 'bug', count: '2' }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          sprints: [
            {
              sprintId: 'sprint_1',
              sprintName: 'Sprint 1',
              startDate: '2026-06-01',
              endDate: '2026-06-14',
              completedIssues: '4',
              completedPoints: '13',
            },
            { sprintId: 'missing-name' },
          ],
          averageVelocity: {
            issues: '4.5',
            points: 12,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          projectId: 'project_1',
          bucket: 'week',
          days: '60',
          data: [{ period: '2026-24', count: '3' }, { count: 4 }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          projectId: 'project_1',
          days: '30',
          sampleSize: '5',
          values: ['1.5', 3, null, 'bad'],
          p50: '2',
          p90: '4.2',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          projectId: 'project_1',
          backlog: '18',
          throughputHistory: ['3', 5, null, 'bad'],
          p50Date: '2026-07-13',
          p80Date: '2026-07-27',
          p95Date: '2026-08-10',
          p50Sprints: '2',
          p80Sprints: 3,
          p95Sprints: '4',
          iterations: '1000',
          histogram: [{ sprints: '2', count: '420' }, { sprints: 3, count: 360 }, { count: 12 }],
        }),
      );

    await expect(getProjectAnalytics('project_1')).resolves.toEqual({
      health: {
        overview: {
          totalIssues: 12,
          overdueIssues: 2,
          unassignedIssues: 3,
        },
        sprints: {
          total: 4,
          active: 1,
          completed: 2,
        },
        issuesByStatus: [
          {
            status: 'done',
            name: 'Done',
            color: '#22c55e',
            category: 'done',
            count: 5,
          },
        ],
        issuesByPriority: [{ priority: 'high', count: 3 }],
        issuesByType: [{ type: 'bug', count: 2 }],
      },
      velocity: {
        sprints: [
          {
            sprintId: 'sprint_1',
            sprintName: 'Sprint 1',
            startDate: '2026-06-01',
            endDate: '2026-06-14',
            completedIssues: 4,
            completedPoints: 13,
          },
        ],
        averageVelocity: {
          issues: 4.5,
          points: 12,
        },
      },
      throughput: {
        projectId: 'project_1',
        bucket: 'week',
        days: 60,
        data: [{ period: '2026-24', count: 3 }],
      },
      cycleTime: {
        projectId: 'project_1',
        days: 30,
        sampleSize: 5,
        values: [1.5, 3],
        p50: 2,
        p90: 4.2,
      },
      forecast: {
        projectId: 'project_1',
        backlog: 18,
        throughputHistory: [3, 5],
        p50Date: '2026-07-13',
        p80Date: '2026-07-27',
        p95Date: '2026-08-10',
        p50Sprints: 2,
        p80Sprints: 3,
        p95Sprints: 4,
        iterations: 1000,
        histogram: [
          { sprints: 2, count: 420 },
          { sprints: 3, count: 360 },
        ],
      },
    });

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/analytics/project-health?projectId=project_1',
    );
    expect(jest.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe(
      'https://tasks.example.com/api/analytics/velocity?projectId=project_1',
    );
    expect(jest.mocked(globalThis.fetch).mock.calls[2]?.[0]).toBe(
      'https://tasks.example.com/api/analytics/throughput?projectId=project_1&days=60&bucket=week',
    );
    expect(jest.mocked(globalThis.fetch).mock.calls[3]?.[0]).toBe(
      'https://tasks.example.com/api/analytics/cycle-time?projectId=project_1&days=30',
    );
    expect(jest.mocked(globalThis.fetch).mock.calls[4]?.[0]).toBe(
      'https://tasks.example.com/api/analytics/forecast?projectId=project_1',
    );
  });

  it('loads and normalizes DORA analytics from the web endpoint', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse(200, {
        connected: true,
        deployFrequencyPerDay: '1.25',
        deployFrequencyDelta: '0.2',
        deployFrequencySpark: ['0', 1, '2', null, 'bad'],
        leadTimeHours: '18.5',
        leadTimeDelta: null,
        leadTimeSpark: ['24', 18],
        changeFailureRate: '0.125',
        changeFailureRateDelta: '-0.02',
        changeFailureRateSpark: ['0.2', '0.125'],
        reworkRate: '0.04',
        reworkRateDelta: 'bad',
        reworkRateSpark: ['0.1', 'bad', '0.04'],
        recoveryHours: '3.5',
        recoveryHoursDelta: '-1',
        recoveryHoursSpark: ['5', '3.5'],
      }),
    );

    await expect(getDoraAnalytics('org_1')).resolves.toEqual({
      connected: true,
      deployFrequencyPerDay: 1.25,
      deployFrequencyDelta: 0.2,
      deployFrequencySpark: [0, 1, 2],
      leadTimeHours: 18.5,
      leadTimeDelta: null,
      leadTimeSpark: [24, 18],
      changeFailureRate: 0.125,
      changeFailureRateDelta: -0.02,
      changeFailureRateSpark: [0.2, 0.125],
      reworkRate: 0.04,
      reworkRateDelta: null,
      reworkRateSpark: [0.1, 0.04],
      recoveryHours: 3.5,
      recoveryHoursDelta: -1,
      recoveryHoursSpark: [5, 3.5],
    });

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/analytics/dora?organizationId=org_1',
    );
  });
});
