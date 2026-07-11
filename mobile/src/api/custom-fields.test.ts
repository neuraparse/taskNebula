import {
  createCustomField,
  deleteCustomField,
  listCustomFields,
  listIssueCustomFieldValues,
  setIssueCustomFieldValue,
  updateCustomField,
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

describe('custom fields API', () => {
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

  it('lists and normalizes project custom fields', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        customFields: [
          {
            id: 'field_1',
            organizationId: 'org_1',
            projectId: 'project_1',
            name: 'Severity',
            description: 'Operational impact',
            type: 'select',
            isRequired: true,
            options: '["S1","S2"]',
            position: '2',
            isActive: true,
          },
          { id: 'missing-name', type: 'text' },
        ],
      }),
    );

    await expect(
      listCustomFields({ organizationId: 'org_1', projectId: 'project_1' }),
    ).resolves.toEqual([
      {
        id: 'field_1',
        organizationId: 'org_1',
        projectId: 'project_1',
        name: 'Severity',
        description: 'Operational impact',
        type: 'select',
        isRequired: true,
        options: '["S1","S2"]',
        position: 2,
        isActive: true,
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/custom-fields?organizationId=org_1&projectId=project_1',
    );
  });

  it('lists issue custom field values with joined field metadata', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        customFieldValues: [
          {
            id: 'value_1',
            customFieldId: 'field_1',
            value: 'S1',
            updatedAt: '2026-06-28T10:00:00.000Z',
            field: {
              id: 'field_1',
              name: 'Severity',
              type: 'select',
              isRequired: false,
              options: '["S1","S2"]',
            },
          },
          { id: 'missing-field', customFieldId: 'field_2', value: 'x' },
        ],
      }),
    );

    await expect(listIssueCustomFieldValues('issue_1')).resolves.toEqual([
      {
        id: 'value_1',
        customFieldId: 'field_1',
        value: 'S1',
        updatedAt: '2026-06-28T10:00:00.000Z',
        field: {
          id: 'field_1',
          name: 'Severity',
          type: 'select',
          isRequired: false,
          options: '["S1","S2"]',
        },
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/issues/issue_1/custom-fields',
    );
  });

  it('creates a project custom field through the web API contract', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(201, {
        id: 'field_2',
        organizationId: 'org_1',
        projectId: 'project_1',
        name: 'Risk',
        type: 'multi_select',
        isRequired: false,
        options: '["Low","High"]',
      }),
    );

    await expect(
      createCustomField({
        organizationId: 'org_1',
        projectId: 'project_1',
        name: 'Risk',
        description: null,
        type: 'multi_select',
        isRequired: false,
        options: '["Low","High"]',
      }),
    ).resolves.toMatchObject({
      id: 'field_2',
      name: 'Risk',
      type: 'multi_select',
      options: '["Low","High"]',
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/custom-fields');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({
      organizationId: 'org_1',
      projectId: 'project_1',
      name: 'Risk',
      type: 'multi_select',
      isRequired: false,
      options: '["Low","High"]',
    });
  });

  it('updates a custom field through the web API contract', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'field_1',
        organizationId: 'org_1',
        projectId: 'project_1',
        name: 'Severity',
        type: 'select',
        isRequired: true,
        options: '["S1","S2","S3"]',
      }),
    );

    await updateCustomField('field_1', {
      name: 'Severity',
      description: 'Impact level',
      isRequired: true,
      options: '["S1","S2","S3"]',
    });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/custom-fields/field_1');
    expect(init).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'Severity',
      description: 'Impact level',
      isRequired: true,
      options: '["S1","S2","S3"]',
    });
  });

  it('deletes a custom field through the web API contract', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValue(jsonResponse(200, { message: 'Custom field deleted successfully' }));

    await deleteCustomField('field_1');

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/custom-fields/field_1');
    expect(init).toMatchObject({ method: 'DELETE' });
  });

  it('sets an issue custom field value through the web API contract', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        id: 'value_1',
        customFieldId: 'field_1',
        value: null,
      }),
    );

    await setIssueCustomFieldValue('issue_1', { customFieldId: 'field_1', value: null });

    const [url, init] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/issues/issue_1/custom-fields');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual({
      customFieldId: 'field_1',
      value: null,
    });
  });
});
