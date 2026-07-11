import {
  createSprint,
  deleteSprint,
  getSprint,
  getSprintBurndown,
  listSprintIssues,
  listSprints,
  updateSprint,
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

describe('sprints API', () => {
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

  it('lists and normalizes sprints for a project', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'sprint_1',
          projectId: 'project_1',
          name: 'Mobile parity',
          goal: 'Ship self-hosted mobile',
          startDate: '2026-07-01T00:00:00.000Z',
          endDate: '2026-07-14T00:00:00.000Z',
          status: 'active',
          issueCount: '8',
          completedCount: '3',
          inProgressCount: '2',
          todoCount: '3',
        },
        { id: 'invalid' },
      ]),
    );

    await expect(listSprints('project_1')).resolves.toEqual([
      expect.objectContaining({
        id: 'sprint_1',
        projectId: 'project_1',
        name: 'Mobile parity',
        issueCount: 8,
        completedCount: 3,
        inProgressCount: 2,
        todoCount: 3,
      }),
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/sprints?projectId=project_1',
    );
  });

  it('fetches one sprint with completion stats', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'sprint_1',
        projectId: 'project_1',
        name: 'Mobile parity',
        status: 'active',
        issueCount: 5,
        completedCount: 2,
        inProgressCount: 1,
        todoCount: 2,
      }),
    );

    await expect(getSprint('sprint_1')).resolves.toMatchObject({
      id: 'sprint_1',
      projectId: 'project_1',
      issueCount: 5,
      completedCount: 2,
      inProgressCount: 1,
      todoCount: 2,
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/sprints/sprint_1',
    );
  });

  it('lists sprint issues through the sprint-scoped web API', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'issue_1',
          organizationId: 'org_1',
          projectId: 'project_1',
          key: 'MOB-1',
          type: 'story',
          title: 'Build mobile sprint screen',
          priority: 'high',
          sprintId: 'sprint_1',
          status: 'in_progress',
          statusName: 'In Progress',
          statusColor: '#22c55e',
        },
      ]),
    );

    await expect(listSprintIssues('sprint_1')).resolves.toEqual([
      expect.objectContaining({
        id: 'issue_1',
        key: 'MOB-1',
        sprintId: 'sprint_1',
        status: expect.objectContaining({ category: 'in_progress', name: 'In Progress' }),
      }),
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/sprints/sprint_1/issues',
    );
  });

  it('fetches and normalizes sprint burndown analytics', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        sprintName: 'Sprint 1',
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        totalPoints: '21',
        totalIssues: '5',
        completedPoints: '8',
        completedIssues: '2',
        remainingPoints: '13',
        remainingIssues: '3',
        burndown: [
          { date: '2026-07-01', ideal: '21', actual: '21' },
          { date: '2026-07-02', ideal: 19, actual: null },
          { ideal: 7, actual: 4 },
        ],
        hours: {
          totalEstimateHours: '40.5',
          totalActualHours: '12',
          completedActualHours: '10.25',
          remainingEstimateHours: '30.25',
        },
      }),
    );

    await expect(getSprintBurndown('sprint_1', 'hours')).resolves.toEqual({
      sprintName: 'Sprint 1',
      startDate: '2026-07-01',
      endDate: '2026-07-14',
      totalPoints: 21,
      totalIssues: 5,
      completedPoints: 8,
      completedIssues: 2,
      remainingPoints: 13,
      remainingIssues: 3,
      burndown: [
        { date: '2026-07-01', ideal: 21, actual: 21 },
        { date: '2026-07-02', ideal: 19, actual: null },
      ],
      hours: {
        totalEstimateHours: 40.5,
        totalActualHours: 12,
        completedActualHours: 10.25,
        remainingEstimateHours: 30.25,
      },
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/analytics/burndown?sprintId=sprint_1&unit=hours',
    );
  });

  it('creates and updates sprints with the self-hosted API routes', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(201, {
          id: 'sprint_1',
          projectId: 'project_1',
          name: 'Mobile parity',
          status: 'planned',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'sprint_1',
          projectId: 'project_1',
          name: 'Mobile parity',
          status: 'active',
        }),
      );

    await createSprint({
      projectId: 'project_1',
      name: 'Mobile parity',
      goal: 'Ship self-hosted mobile',
      startDate: '2026-07-01',
      endDate: '2026-07-14',
    });
    await updateSprint('sprint_1', { status: 'active' });

    const [, createInit] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const [updateUrl, updateInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];

    expect(createInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(createInit?.body))).toEqual({
      projectId: 'project_1',
      name: 'Mobile parity',
      goal: 'Ship self-hosted mobile',
      startDate: '2026-07-01',
      endDate: '2026-07-14',
    });
    expect(updateUrl).toBe('https://tasks.example.com/api/sprints/sprint_1');
    expect(updateInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(updateInit?.body))).toEqual({ status: 'active' });
  });

  it('deletes sprints through the self-hosted API route', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(200, { success: true }));

    await expect(deleteSprint('sprint_1')).resolves.toEqual({ success: true });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/sprints/sprint_1');
    expect(init).toMatchObject({ method: 'DELETE' });
  });
});
