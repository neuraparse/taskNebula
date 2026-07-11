import {
  assignProjectSecurityScheme,
  createAutomationRule,
  createSecurityLevel,
  createSecurityScheme,
  deleteAutomationRule,
  deleteSecurityLevel,
  deleteSecurityScheme,
  getProjectSecurityScheme,
  listAutomationExecutions,
  listAutomationRules,
  listSecuritySchemes,
  updateAutomationRule,
  updateSecurityScheme,
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

describe('security schemes API', () => {
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

  it('lists and normalizes issue security schemes', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'sec_1',
          name: 'Default security',
          description: null,
          isDefault: true,
          projectCount: '3',
          levels: [
            {
              id: 'level_1',
              schemeId: 'sec_1',
              name: 'Internal',
              sortOrder: '1',
              isDefault: true,
              members: [
                { id: 'member_1', memberType: 'project_role', memberValue: 'developer' },
                { memberType: null },
              ],
            },
          ],
        },
        { id: 'missing-name' },
      ]),
    );

    await expect(listSecuritySchemes('org_1')).resolves.toEqual([
      {
        id: 'sec_1',
        name: 'Default security',
        description: null,
        isDefault: true,
        projectCount: 3,
        createdAt: null,
        updatedAt: null,
        levels: [
          {
            id: 'level_1',
            schemeId: 'sec_1',
            name: 'Internal',
            description: null,
            sortOrder: 1,
            isDefault: true,
            members: [{ id: 'member_1', memberType: 'project_role', memberValue: 'developer' }],
          },
        ],
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/security-schemes?organizationId=org_1',
    );
  });

  it('creates, defaults, assigns, and deletes security schemes and levels', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse(201, { id: 'sec_2', name: 'Restricted' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { id: 'sec_2', name: 'Restricted', isDefault: true }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          projectId: 'project_1',
          assignedSchemeId: null,
          effectiveSchemeId: 'sec_2',
          source: 'organization-default',
          scheme: { id: 'sec_2', name: 'Restricted', isDefault: true },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          projectId: 'project_1',
          assignedSchemeId: 'sec_2',
          effectiveSchemeId: 'sec_2',
          source: 'project',
          scheme: { id: 'sec_2', name: 'Restricted', isDefault: true },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(201, {
          id: 'level_2',
          schemeId: 'sec_2',
          name: 'Leads',
          members: [{ memberType: 'project_role', memberValue: 'tech_lead' }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await createSecurityScheme({
      organizationId: 'org_1',
      name: 'Restricted',
      description: null,
    });
    await updateSecurityScheme({ schemeId: 'sec_2', isDefault: true });
    await getProjectSecurityScheme('project_1');
    await assignProjectSecurityScheme('project_1', 'sec_2');
    await createSecurityLevel({
      schemeId: 'sec_2',
      name: 'Leads',
      members: [{ type: 'project_role', value: 'tech_lead' }],
    });
    await deleteSecurityLevel('sec_2', 'level_2');
    await deleteSecurityScheme('sec_2');

    const calls = jest.mocked(globalThis.fetch).mock.calls;
    expect(calls[0]?.[0]).toBe('https://tasks.example.com/api/security-schemes');
    expect(calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(calls[0]?.[1]?.body))).toEqual({
      organizationId: 'org_1',
      name: 'Restricted',
      isDefault: false,
    });
    expect(calls[3]?.[0]).toBe('https://tasks.example.com/api/projects/project_1/security-scheme');
    expect(JSON.parse(String(calls[3]?.[1]?.body))).toEqual({ schemeId: 'sec_2' });
    expect(calls[4]?.[0]).toBe('https://tasks.example.com/api/security-schemes/sec_2/levels');
    expect(JSON.parse(String(calls[4]?.[1]?.body))).toEqual({
      name: 'Leads',
      description: null,
      isDefault: false,
      members: [{ type: 'project_role', value: 'tech_lead' }],
    });
    expect(calls[5]?.[0]).toBe(
      'https://tasks.example.com/api/security-schemes/sec_2/levels/level_2',
    );
    expect(calls[5]?.[1]).toMatchObject({ method: 'DELETE' });
    expect(calls[6]?.[0]).toBe('https://tasks.example.com/api/security-schemes/sec_2');
    expect(calls[6]?.[1]).toMatchObject({ method: 'DELETE' });
  });
});

describe('automation rules API', () => {
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

  it('lists and normalizes project automation rules', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'rule_1',
          organizationId: 'org_1',
          projectId: 'project_1',
          name: 'Triage',
          enabled: false,
          trigger: { type: 'issue_created' },
          conditions: [{ field: 'priority' }, null],
          actions: [{ type: 'add_comment', body: 'Review' }, { body: 'ignored' }],
        },
        { id: 'missing-name' },
      ]),
    );

    await expect(
      listAutomationRules({ organizationId: 'org_1', projectId: 'project_1' }),
    ).resolves.toEqual([
      {
        id: 'rule_1',
        organizationId: 'org_1',
        projectId: 'project_1',
        name: 'Triage',
        description: null,
        enabled: false,
        trigger: { type: 'issue_created' },
        conditions: [{ field: 'priority' }],
        actions: [{ type: 'add_comment', body: 'Review' }],
        createdAt: null,
        updatedAt: null,
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/automation-rules?organizationId=org_1&projectId=project_1',
    );
  });

  it('creates, updates, deletes, and loads automation executions', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(201, {
          id: 'rule_2',
          organizationId: 'org_1',
          projectId: 'project_1',
          name: 'Notify',
          trigger: { type: 'issue_updated' },
          actions: [{ type: 'send_notification' }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'rule_2',
          organizationId: 'org_1',
          projectId: 'project_1',
          name: 'Notify updated',
          enabled: true,
          trigger: { type: 'issue_assigned' },
          actions: [{ type: 'assign_issue' }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true }))
      .mockResolvedValueOnce(
        jsonResponse(200, [
          {
            id: 'exec_1',
            ruleId: 'rule_2',
            triggeredAt: '2026-06-28T10:00:00.000Z',
            triggerPayload: { issueId: 'issue_1' },
            status: 'success',
            actionResults: [],
            durationMs: '42',
          },
        ]),
      );

    await createAutomationRule({
      organizationId: 'org_1',
      projectId: 'project_1',
      name: 'Notify',
      trigger: { type: 'issue_updated' },
      actions: [{ type: 'send_notification' }],
    });
    await updateAutomationRule({
      ruleId: 'rule_2',
      name: 'Notify updated',
      enabled: true,
      trigger: { type: 'issue_assigned' },
      actions: [{ type: 'assign_issue' }],
    });
    await deleteAutomationRule('rule_2');
    await expect(listAutomationExecutions('rule_2', 25)).resolves.toMatchObject([
      { id: 'exec_1', ruleId: 'rule_2', status: 'success', durationMs: 42 },
    ]);

    const calls = jest.mocked(globalThis.fetch).mock.calls;
    expect(calls[0]?.[0]).toBe('https://tasks.example.com/api/automation-rules');
    expect(JSON.parse(String(calls[0]?.[1]?.body))).toEqual({
      organizationId: 'org_1',
      projectId: 'project_1',
      name: 'Notify',
      description: null,
      enabled: true,
      trigger: { type: 'issue_updated' },
      conditions: [],
      actions: [{ type: 'send_notification' }],
    });
    expect(calls[1]?.[0]).toBe('https://tasks.example.com/api/automation-rules/rule_2');
    expect(calls[1]?.[1]).toMatchObject({ method: 'PATCH' });
    expect(calls[2]?.[0]).toBe('https://tasks.example.com/api/automation-rules/rule_2');
    expect(calls[2]?.[1]).toMatchObject({ method: 'DELETE' });
    expect(calls[3]?.[0]).toBe(
      'https://tasks.example.com/api/automation-rules/rule_2/executions?limit=25',
    );
  });
});
