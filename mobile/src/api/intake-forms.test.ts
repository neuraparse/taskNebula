import {
  createIntakeForm,
  deleteIntakeForm,
  getIntakeForm,
  getPublicIntakeForm,
  listIntakeForms,
  submitPublicIntakeForm,
  updateIntakeForm,
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

const rawForm = {
  id: 'form_1',
  workspaceId: 'workspace_1',
  projectId: 'project_1',
  slug: 'bug-intake',
  title: 'Bug intake',
  description: null,
  fields: [
    {
      name: 'summary',
      label: 'Summary',
      type: 'text',
      required: true,
      placeholder: null,
      helpText: 'Short title',
    },
    {
      name: 'impact',
      label: 'Impact',
      type: 'select',
      options: ['High', '', 42],
    },
    { name: 'invalid' },
  ],
  isPublic: true,
  requiresCaptcha: false,
  targetStatus: 'triage',
  createdAt: '2026-06-28T08:00:00.000Z',
  updatedAt: '2026-06-28T09:00:00.000Z',
};

describe('intake forms API', () => {
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

  it('lists and normalizes intake forms from the self-hosted API', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        forms: [rawForm, { id: 'missing-project' }],
      }),
    );

    await expect(listIntakeForms('project_1')).resolves.toEqual([
      {
        id: 'form_1',
        workspaceId: 'workspace_1',
        projectId: 'project_1',
        slug: 'bug-intake',
        title: 'Bug intake',
        description: null,
        fields: [
          {
            name: 'summary',
            label: 'Summary',
            type: 'text',
            required: true,
            helpText: 'Short title',
          },
          {
            name: 'impact',
            label: 'Impact',
            type: 'select',
            options: ['High', '42'],
          },
        ],
        isPublic: true,
        requiresCaptcha: false,
        targetStatus: 'triage',
        createdAt: '2026-06-28T08:00:00.000Z',
        updatedAt: '2026-06-28T09:00:00.000Z',
      },
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/intake-forms?projectId=project_1',
    );
  });

  it('loads a single intake form by id', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(200, { form: rawForm }));

    await expect(getIntakeForm('form_1')).resolves.toMatchObject({
      id: 'form_1',
      slug: 'bug-intake',
      fields: expect.arrayContaining([expect.objectContaining({ name: 'summary' })]),
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://tasks.example.com/api/intake-forms/form_1',
      expect.any(Object),
    );
  });

  it('creates, updates, and deletes intake forms through the self-hosted API', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse(201, { form: rawForm }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          form: {
            ...rawForm,
            title: 'Bug intake v2',
            isPublic: false,
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await createIntakeForm({
      projectId: 'project_1',
      slug: 'bug-intake',
      title: 'Bug intake',
      description: null,
      fields: [{ name: 'summary', label: 'Summary', type: 'text', required: true }],
      isPublic: true,
      requiresCaptcha: false,
      targetStatus: 'triage',
    });
    await updateIntakeForm({
      formId: 'form_1',
      title: 'Bug intake v2',
      isPublic: false,
      fields: [{ name: 'summary', label: 'Summary', type: 'textarea', required: true }],
    });
    await deleteIntakeForm('form_1');

    const [createUrl, createInit] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const [updateUrl, updateInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    const [deleteUrl, deleteInit] = jest.mocked(globalThis.fetch).mock.calls[2] ?? [];

    expect(createUrl).toBe('https://tasks.example.com/api/intake-forms');
    expect(createInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(createInit?.body))).toEqual({
      projectId: 'project_1',
      slug: 'bug-intake',
      title: 'Bug intake',
      description: null,
      fields: [{ name: 'summary', label: 'Summary', type: 'text', required: true }],
      isPublic: true,
      requiresCaptcha: false,
      targetStatus: 'triage',
    });

    expect(updateUrl).toBe('https://tasks.example.com/api/intake-forms/form_1');
    expect(updateInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(updateInit?.body))).toEqual({
      title: 'Bug intake v2',
      isPublic: false,
      fields: [{ name: 'summary', label: 'Summary', type: 'textarea', required: true }],
    });

    expect(deleteUrl).toBe('https://tasks.example.com/api/intake-forms/form_1');
    expect(deleteInit).toMatchObject({ method: 'DELETE' });
  });

  it('loads and submits a public intake form without authenticated metadata', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          form: {
            id: 'form_public',
            slug: 'bug-intake',
            title: 'Bug intake',
            description: 'Tell us what broke.',
            fields: rawForm.fields,
            isPublic: true,
            requiresCaptcha: false,
          },
          captchaConfigured: false,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(201, {
          success: true,
          submissionId: 'sub_1',
          issueKey: 'MOB-42',
        }),
      );

    await expect(getPublicIntakeForm('bug-intake')).resolves.toEqual({
      form: expect.objectContaining({
        id: 'form_public',
        slug: 'bug-intake',
        title: 'Bug intake',
        fields: expect.arrayContaining([expect.objectContaining({ name: 'summary' })]),
      }),
      captchaConfigured: false,
    });

    await expect(
      submitPublicIntakeForm('bug-intake', {
        payload: {
          summary: 'Crash on launch',
          impact: 'High',
        },
      }),
    ).resolves.toEqual({
      success: true,
      submissionId: 'sub_1',
      issueKey: 'MOB-42',
    });

    const [loadUrl] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const [submitUrl, submitInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(loadUrl).toBe('https://tasks.example.com/api/public/intake/bug-intake');
    expect(submitUrl).toBe('https://tasks.example.com/api/public/intake/bug-intake');
    expect(submitInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(submitInit?.body))).toEqual({
      payload: {
        summary: 'Crash on launch',
        impact: 'High',
      },
    });
  });
});
