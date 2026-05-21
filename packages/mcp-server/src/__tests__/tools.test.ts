/**
 * Per-tool schema validation + mocked REST call coverage.
 *
 * We avoid spinning up the MCP server here — the unit under test is the
 * tool definition itself (schema + handler). The MCP wiring is covered
 * indirectly by `server.test.ts`.
 */
import { TaskNebulaClient } from '../client';
import {
  searchIssuesTool,
  getIssueTool,
  listMyAssignedTool,
  createIssueTool,
  updateIssueTool,
  transitionStatusTool,
  assignIssueTool,
  addCommentTool,
  linkPrTool,
  listProjectsTool,
  createSubtaskTool,
  getMyWorkloadTool,
  allTools,
} from '../tools';

type FetchCall = { url: string; init: RequestInit };

function mockClient(response: unknown = { ok: true }): {
  client: TaskNebulaClient;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetchImpl = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url: url.toString(), init });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  const client = new TaskNebulaClient({
    apiUrl: 'https://api.test.local',
    apiKey: 'test-key',
    fetchImpl,
  });
  return { client, calls };
}

describe('tool registry', () => {
  it('exports exactly 12 tools with unique names', () => {
    expect(allTools).toHaveLength(12);
    const names = new Set(allTools.map((t) => t.name));
    expect(names.size).toBe(12);
    expect([...names].sort()).toEqual(
      [
        'add_comment',
        'assign_issue',
        'create_issue',
        'create_subtask',
        'get_issue',
        'get_my_workload',
        'link_pr',
        'list_my_assigned',
        'list_projects',
        'search_issues',
        'transition_status',
        'update_issue',
      ].sort()
    );
  });

  it('every tool has a non-empty description and a Zod schema', () => {
    for (const tool of allTools) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(typeof tool.inputSchema.parse).toBe('function');
    }
  });
});

describe('search_issues', () => {
  it('rejects missing query', () => {
    expect(() => searchIssuesTool.inputSchema.parse({})).toThrow();
  });
  it('applies defaults for limit/offset', () => {
    const v = searchIssuesTool.inputSchema.parse({ query: 'foo', organizationId: 'org-1' });
    expect(v.limit).toBe(25);
    expect(v.offset).toBe(0);
  });
  it('calls /api/search with query params', async () => {
    const { client, calls } = mockClient({ items: [] });
    await searchIssuesTool.handler(
      searchIssuesTool.inputSchema.parse({
        query: 'bug',
        organizationId: 'org-1',
        projectId: 'p1',
        limit: 10,
      }),
      { client }
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain('/api/search');
    expect(calls[0]!.url).toContain('q=bug');
    expect(calls[0]!.url).toContain('organizationId=org-1');
    expect(calls[0]!.url).toContain('projectId=p1');
    expect(calls[0]!.url).toContain('limit=10');
  });
});

describe('get_issue', () => {
  it('requires issueId', () => {
    expect(() => getIssueTool.inputSchema.parse({})).toThrow();
  });
  it('hits /api/issues/:id', async () => {
    const { client, calls } = mockClient({ id: 'TN-1' });
    await getIssueTool.handler({ issueId: 'TN-1' }, { client });
    expect(calls[0]!.url).toMatch(/\/api\/issues\/TN-1$/);
    expect(calls[0]!.init.method).toBe('GET');
  });
});

describe('list_my_assigned', () => {
  it('defaults to status=open', () => {
    const v = listMyAssignedTool.inputSchema.parse({});
    expect(v.status).toBe('open');
    expect(v.limit).toBe(25);
  });
  it('rejects unknown status', () => {
    expect(() => listMyAssignedTool.inputSchema.parse({ status: 'nope' })).toThrow();
  });
  it('calls my-issues endpoint', async () => {
    const { client, calls } = mockClient({ items: [] });
    await listMyAssignedTool.handler({ status: 'open', limit: 25 }, { client });
    expect(calls[0]!.url).toContain('/api/issues/my-issues');
  });
});

describe('create_issue', () => {
  it('requires title and projectId', () => {
    expect(() => createIssueTool.inputSchema.parse({})).toThrow();
    expect(() => createIssueTool.inputSchema.parse({ projectId: 'p' })).toThrow();
  });
  it('POSTs to /api/issues with the payload', async () => {
    const { client, calls } = mockClient({ id: 'i1' });
    const input = createIssueTool.inputSchema.parse({ projectId: 'p1', title: 'New' });
    await createIssueTool.handler(input, { client });
    expect(calls[0]!.url).toMatch(/\/api\/issues$/);
    expect(calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
      projectId: 'p1',
      title: 'New',
      type: 'task',
      priority: 'medium',
    });
  });
});

describe('update_issue', () => {
  it('requires issueId', () => {
    expect(() => updateIssueTool.inputSchema.parse({ title: 'x' })).toThrow();
  });
  it('PATCHes /api/issues/:id excluding the id from the body', async () => {
    const { client, calls } = mockClient({ ok: true });
    await updateIssueTool.handler(
      { issueId: 'i1', title: 'Renamed', priority: 'high' },
      { client }
    );
    expect(calls[0]!.init.method).toBe('PATCH');
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toEqual({ title: 'Renamed', priority: 'high' });
  });
});

describe('transition_status', () => {
  it('requires both ids', () => {
    expect(() => transitionStatusTool.inputSchema.parse({ issueId: 'i' })).toThrow();
  });
  it('PATCHes with statusId', async () => {
    const { client, calls } = mockClient({ ok: true });
    await transitionStatusTool.handler({ issueId: 'i1', statusId: 's2' }, { client });
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ statusId: 's2' });
  });
});

describe('assign_issue', () => {
  it('accepts null to unassign', () => {
    const v = assignIssueTool.inputSchema.parse({ issueId: 'i', assigneeId: null });
    expect(v.assigneeId).toBeNull();
  });
  it('PATCHes assigneeId', async () => {
    const { client, calls } = mockClient({ ok: true });
    await assignIssueTool.handler({ issueId: 'i1', assigneeId: 'u1' }, { client });
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ assigneeId: 'u1' });
  });
});

describe('add_comment', () => {
  it('requires body', () => {
    expect(() => addCommentTool.inputSchema.parse({ issueId: 'i' })).toThrow();
  });
  it('POSTs to comments subroute', async () => {
    const { client, calls } = mockClient({ id: 'c1' });
    await addCommentTool.handler({ issueId: 'i1', body: 'hello' }, { client });
    expect(calls[0]!.url).toMatch(/\/api\/issues\/i1\/comments$/);
    expect(calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ content: 'hello' });
  });
});

describe('link_pr', () => {
  it('validates url', () => {
    expect(() => linkPrTool.inputSchema.parse({ issueId: 'i', url: 'not-a-url' })).toThrow();
  });
  it('POSTs to /links with provider', async () => {
    const { client, calls } = mockClient({ id: 'l1' });
    await linkPrTool.handler(
      linkPrTool.inputSchema.parse({
        issueId: 'i1',
        url: 'https://github.com/o/r/pull/1',
      }),
      { client }
    );
    expect(calls[0]!.url).toMatch(/\/api\/issues\/i1\/links$/);
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({ type: 'pull_request', provider: 'github' });
  });
});

describe('list_projects', () => {
  it('defaults includeArchived=false', () => {
    const v = listProjectsTool.inputSchema.parse({});
    expect(v.includeArchived).toBe(false);
  });
  it('calls /api/projects', async () => {
    const { client, calls } = mockClient({ items: [] });
    await listProjectsTool.handler({ includeArchived: false, limit: 50 }, { client });
    expect(calls[0]!.url).toContain('/api/projects');
  });
});

describe('create_subtask', () => {
  it('requires parentIssueId and title', () => {
    expect(() => createSubtaskTool.inputSchema.parse({ title: 'x' })).toThrow();
  });
  it('forces type=subtask and forwards parentIssueId', async () => {
    const { client, calls } = mockClient({ id: 'i2' });
    await createSubtaskTool.handler(
      { parentIssueId: 'i1', projectId: 'p1', title: 'Sub' },
      { client }
    );
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({
      type: 'subtask',
      parentIssueId: 'i1',
      projectId: 'p1',
      title: 'Sub',
    });
  });
});

describe('get_my_workload', () => {
  it('defaults to this_week window', () => {
    const v = getMyWorkloadTool.inputSchema.parse({});
    expect(v.window).toBe('this_week');
  });
  it('rejects unknown window', () => {
    expect(() => getMyWorkloadTool.inputSchema.parse({ window: 'forever' })).toThrow();
  });
  it('hits metrics endpoint', async () => {
    const { client, calls } = mockClient({ counts: {} });
    await getMyWorkloadTool.handler({ window: 'today' }, { client });
    expect(calls[0]!.url).toContain('/api/metrics/my-workload');
    expect(calls[0]!.url).toContain('window=today');
  });
});
