import { instantiateTemplate, listTemplates } from './endpoints';
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

describe('templates API', () => {
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

  it('normalizes visible templates from a self-hosted server', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        templates: [
          {
            id: 'tpl_1',
            organizationId: 'org_1',
            name: 'Mobile launch',
            description: null,
            category: 'product',
            kind: 'project',
            payload: { key: 'MOB', labels: ['launch'] },
            usageCount: '3',
            isPublic: false,
            isVerified: true,
          },
          { id: 'missing-name' },
        ],
        canAdminister: true,
        adminOrganizationIds: ['org_1'],
        memberOrganizationIds: ['org_1'],
      }),
    );

    await expect(listTemplates()).resolves.toEqual({
      templates: [
        expect.objectContaining({
          id: 'tpl_1',
          organizationId: 'org_1',
          name: 'Mobile launch',
          category: 'product',
          kind: 'project',
          payload: { key: 'MOB', labels: ['launch'] },
          usageCount: 3,
          isVerified: true,
        }),
      ],
      canAdminister: true,
      adminOrganizationIds: ['org_1'],
      memberOrganizationIds: ['org_1'],
    });
  });

  it('instantiates a template with native override fields', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(201, {
        kind: 'issue',
        resource: { id: 'issue_1', key: 'MOB-7', title: 'Fix mobile auth' },
      }),
    );

    await expect(
      instantiateTemplate('tpl_1', {
        projectId: 'project_1',
        title: 'Fix mobile auth',
        description: 'Cookie session issue',
      }),
    ).resolves.toEqual({
      kind: 'issue',
      resource: { id: 'issue_1', key: 'MOB-7', title: 'Fix mobile auth' },
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/templates/tpl_1/use');
    expect(JSON.parse(String(init?.body))).toEqual({
      overrides: {
        projectId: 'project_1',
        title: 'Fix mobile auth',
        description: 'Cookie session issue',
      },
    });
  });
});
