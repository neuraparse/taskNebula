import { configureApi } from './client';
import { listProjectWorkflowTransitions, updateProjectWorkflowTransitions } from './endpoints';

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

describe('project workflow transitions API', () => {
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

  it('loads workflow statuses and transition rows for a project', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        statuses: [
          {
            id: 'status_todo',
            workflowId: 'workflow_1',
            name: 'To Do',
            category: 'todo',
            color: '#64748b',
            position: '0',
          },
          { id: 'invalid_status' },
        ],
        transitions: [
          {
            id: 'transition_1',
            workflowId: 'workflow_1',
            fromStatusId: 'status_todo',
            toStatusId: 'status_done',
            name: 'Ship it',
          },
          { id: 'invalid_transition', fromStatusId: 'status_todo' },
        ],
      }),
    );

    await expect(listProjectWorkflowTransitions('project_1')).resolves.toEqual({
      statuses: [
        {
          id: 'status_todo',
          workflowId: 'workflow_1',
          name: 'To Do',
          category: 'todo',
          color: '#64748b',
          position: 0,
        },
      ],
      transitions: [
        {
          id: 'transition_1',
          workflowId: 'workflow_1',
          fromStatusId: 'status_todo',
          toStatusId: 'status_done',
          name: 'Ship it',
        },
      ],
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/projects/project_1/workflow-transitions',
    );
  });

  it('replaces project workflow transitions through the self-hosted API', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        transitions: [
          {
            id: 'transition_1',
            workflowId: 'workflow_1',
            fromStatusId: 'status_todo',
            toStatusId: 'status_done',
          },
        ],
      }),
    );

    await expect(
      updateProjectWorkflowTransitions('project_1', [
        { fromStatusId: 'status_todo', toStatusId: 'status_done' },
      ]),
    ).resolves.toEqual([
      {
        id: 'transition_1',
        workflowId: 'workflow_1',
        fromStatusId: 'status_todo',
        toStatusId: 'status_done',
        name: null,
      },
    ]);

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/projects/project_1/workflow-transitions');
    expect(init).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(String(init?.body))).toEqual({
      transitions: [{ fromStatusId: 'status_todo', toStatusId: 'status_done' }],
    });
  });
});
