import {
  createIssue,
  getMyWorkload,
  getIssue,
  listIssues,
  listProjectWorkflowStatuses,
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

describe('issues API', () => {
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

  it('normalizes issue resolution fields', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'issue_1',
        projectId: 'project_1',
        type: 'bug',
        title: 'Crash on launch',
        priority: 'high',
        resolution: 'fixed',
        resolvedAt: '2026-06-28T10:00:00.000Z',
      }),
    );

    await expect(getIssue('issue_1')).resolves.toMatchObject({
      id: 'issue_1',
      projectId: 'project_1',
      type: 'bug',
      title: 'Crash on launch',
      priority: 'high',
      resolution: 'fixed',
      resolvedAt: '2026-06-28T10:00:00.000Z',
    });
  });

  it('normalizes issue planning metadata fields', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'issue_1',
        projectId: 'project_1',
        type: 'story',
        title: 'Plan rollout',
        storyPoints: '5',
        flagged: true,
        epicId: 'issue_epic',
        parentId: 'issue_parent',
        customFields: {
          startDate: '2026-07-01T12:00:00.000Z',
          environment: 'Production',
        },
      }),
    );

    await expect(getIssue('issue_1')).resolves.toMatchObject({
      id: 'issue_1',
      projectId: 'project_1',
      type: 'story',
      title: 'Plan rollout',
      storyPoints: 5,
      flagged: true,
      epicId: 'issue_epic',
      parentId: 'issue_parent',
      customFields: {
        startDate: '2026-07-01T12:00:00.000Z',
        environment: 'Production',
      },
    });
  });

  it('sends resolution updates through PATCH /api/issues/:id', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'issue_1',
        projectId: 'project_1',
        type: 'task',
        title: 'Clean up duplicate',
        resolution: null,
        resolvedAt: null,
      }),
    );

    await updateIssue('issue_1', { resolution: null });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/issues/issue_1');
    expect(init).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(init?.body))).toEqual({ resolution: null });
  });

  it('sends issue planning metadata updates through PATCH /api/issues/:id', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'issue_1',
        projectId: 'project_1',
        type: 'task',
        title: 'Tune rollout',
        storyPoints: 8,
        flagged: true,
        customFields: {
          startDate: '2026-07-01T12:00:00.000Z',
          environment: 'Staging',
        },
      }),
    );

    await updateIssue('issue_1', {
      storyPoints: 8,
      flagged: true,
      customFields: {
        startDate: '2026-07-01T12:00:00.000Z',
        environment: 'Staging',
      },
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/issues/issue_1');
    expect(init).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(init?.body))).toEqual({
      storyPoints: 8,
      flagged: true,
      customFields: {
        startDate: '2026-07-01T12:00:00.000Z',
        environment: 'Staging',
      },
    });
  });

  it('sends parent issue updates through PATCH /api/issues/:id', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'issue_1',
        projectId: 'project_1',
        type: 'task',
        title: 'Nest mobile work',
        parentId: 'issue_parent',
      }),
    );

    await updateIssue('issue_1', { parentId: 'issue_parent' });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/issues/issue_1');
    expect(init).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(init?.body))).toEqual({ parentId: 'issue_parent' });
  });

  it('sends epic updates through PATCH /api/issues/:id', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'issue_1',
        projectId: 'project_1',
        type: 'story',
        title: 'Scope mobile parity',
        epicId: 'issue_epic',
      }),
    );

    await updateIssue('issue_1', { epicId: 'issue_epic' });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/issues/issue_1');
    expect(init).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(init?.body))).toEqual({ epicId: 'issue_epic' });
  });

  it('sends sprint assignment and backlog moves through PATCH /api/issues/:id', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'issue_1',
          projectId: 'project_1',
          type: 'task',
          title: 'Plan mobile backlog',
          sprintId: 'sprint_1',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'issue_1',
          projectId: 'project_1',
          type: 'task',
          title: 'Plan mobile backlog',
          sprintId: null,
        }),
      );

    await updateIssue('issue_1', { sprintId: 'sprint_1' });
    await updateIssue('issue_1', { sprintId: null });

    expect(JSON.parse(String(jest.mocked(globalThis.fetch).mock.calls[0]?.[1]?.body))).toEqual({
      sprintId: 'sprint_1',
    });
    expect(JSON.parse(String(jest.mocked(globalThis.fetch).mock.calls[1]?.[1]?.body))).toEqual({
      sprintId: null,
    });
  });

  it('lists subtasks through the parentId filter', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        issues: [
          {
            id: 'sub_1',
            key: 'MOB-2',
            projectId: 'project_1',
            parentId: 'issue_parent',
            type: 'task',
            title: 'Wire mobile subtasks',
            status: 'done',
            statusName: 'Done',
          },
        ],
      }),
    );

    await expect(listIssues({ parentId: 'issue_parent' })).resolves.toEqual([
      expect.objectContaining({
        id: 'sub_1',
        parentId: 'issue_parent',
        status: expect.objectContaining({ category: 'done', name: 'Done' }),
      }),
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/issues?parentId=issue_parent',
    );
  });

  it('loads my workload metrics and normalizes compact issue rows', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        window: 'overdue',
        total: '2',
        countsByStatus: { 'In progress': '1', Review: 1 },
        countsByPriority: { high: '2' },
        overdue: '2',
        dueSoon: 0,
        issues: [
          {
            id: 'issue_due',
            key: 'MOB-9',
            title: 'Fix due work',
            priority: 'high',
            dueDate: '2026-06-27T10:00:00.000Z',
            status: {
              id: 'status_1',
              name: 'In progress',
              category: 'in_progress',
              color: '#2563eb',
            },
            project: { id: 'project_1', key: 'MOB', name: 'Mobile' },
          },
        ],
      }),
    );

    await expect(getMyWorkload('overdue')).resolves.toEqual({
      window: 'overdue',
      total: 2,
      countsByStatus: { 'In progress': 1, Review: 1 },
      countsByPriority: { high: 2 },
      overdue: 2,
      dueSoon: 0,
      issues: [
        expect.objectContaining({
          id: 'issue_due',
          projectId: 'project_1',
          project: { id: 'project_1', key: 'MOB', name: 'Mobile' },
          status: expect.objectContaining({ category: 'in_progress', name: 'In progress' }),
          type: 'task',
        }),
      ],
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/metrics/my-workload?window=overdue',
    );
  });

  it('sends server-supported issue list filters through query params', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        issues: [
          {
            id: 'issue_1',
            key: 'MOB-1',
            projectId: 'project_1',
            type: 'bug',
            title: 'Fix mobile crash',
            status: 'in_progress',
            statusName: 'In progress',
            sprintId: null,
          },
        ],
      }),
    );

    await expect(
      listIssues({ status: 'in_progress', type: 'bug', sprintId: 'none' }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'issue_1',
        sprintId: null,
        status: expect.objectContaining({ category: 'in_progress', name: 'In progress' }),
        type: 'bug',
      }),
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/issues?status=in_progress&type=bug&sprintId=none',
    );
  });

  it('creates a sub issue with inherited parent context', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'sub_1',
        projectId: 'project_1',
        parentId: 'issue_parent',
        sprintId: 'sprint_1',
        epicId: 'epic_1',
        type: 'task',
        title: 'Wire mobile subtasks',
      }),
    );

    await createIssue({
      projectId: 'project_1',
      type: 'task',
      title: 'Wire mobile subtasks',
      priority: 'medium',
      parentId: 'issue_parent',
      sprintId: 'sprint_1',
      epicId: 'epic_1',
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/issues');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({
      projectId: 'project_1',
      type: 'task',
      title: 'Wire mobile subtasks',
      priority: 'medium',
      parentId: 'issue_parent',
      sprintId: 'sprint_1',
      epicId: 'epic_1',
    });
  });

  it('creates an issue with initial workflow and hierarchy context', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'issue_1',
        projectId: 'project_1',
        statusId: 'status_1',
        epicId: 'issue_epic',
        parentId: 'issue_parent',
        statusName: 'Ready',
        type: 'task',
        title: 'Start in selected status',
      }),
    );

    await createIssue({
      projectId: 'project_1',
      type: 'task',
      title: 'Start in selected status',
      priority: 'medium',
      statusId: 'status_1',
      epicId: 'issue_epic',
      parentId: 'issue_parent',
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/issues');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({
      projectId: 'project_1',
      type: 'task',
      title: 'Start in selected status',
      priority: 'medium',
      statusId: 'status_1',
      epicId: 'issue_epic',
      parentId: 'issue_parent',
    });
  });

  it('lists project workflow statuses', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        statuses: [
          {
            id: 'status_1',
            workflowId: 'workflow_1',
            name: 'Ready for QA',
            category: 'in_review',
            color: '#0ea5e9',
            position: '2',
          },
          { id: 'missing-name' },
        ],
      }),
    );

    await expect(listProjectWorkflowStatuses('project_1')).resolves.toEqual([
      {
        id: 'status_1',
        workflowId: 'workflow_1',
        name: 'Ready for QA',
        category: 'in_review',
        color: '#0ea5e9',
        position: 2,
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/projects/project_1/workflow-statuses',
    );
  });

  it('sends workflow statusId updates through PATCH /api/issues/:id', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'issue_1',
        projectId: 'project_1',
        type: 'task',
        title: 'Move card',
        statusId: 'status_2',
      }),
    );

    await updateIssue('issue_1', { statusId: 'status_2' });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/issues/issue_1');
    expect(init).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(init?.body))).toEqual({ statusId: 'status_2' });
  });
});
