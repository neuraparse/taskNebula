import { configureApi } from './client';
import {
  createAuditLogSink,
  deleteAuditLogSink,
  listAuditLogSinks,
  testAuditLogSink,
  updateAuditLogSink,
} from './endpoints';

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

describe('audit log sink API', () => {
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

  it('lists and normalizes audit log sinks', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        sinks: [
          {
            id: 'sink_1',
            type: 'webhook',
            name: 'Security warehouse',
            config: { url: 'https://siem.example.com/ingest', token: '••••••••' },
            enabled: true,
            lastDeliveryAt: null,
            lastError: null,
            successCount: '12',
            failureCount: '1',
            createdAt: '2026-06-28T08:00:00.000Z',
            updatedAt: '2026-06-28T09:00:00.000Z',
          },
          { id: 'bad' },
        ],
      }),
    );

    await expect(listAuditLogSinks('org_1')).resolves.toEqual({
      sinks: [
        {
          id: 'sink_1',
          type: 'webhook',
          name: 'Security warehouse',
          config: { url: 'https://siem.example.com/ingest', token: '••••••••' },
          enabled: true,
          lastDeliveryAt: null,
          lastError: null,
          successCount: 12,
          failureCount: 1,
          createdAt: '2026-06-28T08:00:00.000Z',
          updatedAt: '2026-06-28T09:00:00.000Z',
        },
      ],
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/admin/audit-log-sinks?organizationId=org_1',
    );
  });

  it('creates, updates, deletes, and tests audit log sinks', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(201, {
          sink: {
            id: 'sink_1',
            type: 'webhook',
            name: 'Security warehouse',
            config: { url: 'https://siem.example.com/ingest' },
            enabled: true,
            successCount: 0,
            failureCount: 0,
            createdAt: '2026-06-28T08:00:00.000Z',
            updatedAt: null,
            signingSecret: 'secret_once',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          sink: {
            id: 'sink_1',
            type: 'webhook',
            name: 'Security warehouse',
            config: { url: 'https://siem.example.com/ingest' },
            enabled: false,
            successCount: '0',
            failureCount: '0',
            createdAt: '2026-06-28T08:00:00.000Z',
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
      .mockResolvedValueOnce(
        jsonResponse(200, { result: { ok: true, statusCode: 204, error: null } }),
      );

    await expect(
      createAuditLogSink({
        organizationId: 'org_1',
        type: 'webhook',
        name: 'Security warehouse',
        config: { url: 'https://siem.example.com/ingest' },
      }),
    ).resolves.toMatchObject({
      id: 'sink_1',
      signingSecret: 'secret_once',
    });
    const [createUrl, createInit] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(createUrl).toBe('https://tasks.example.com/api/admin/audit-log-sinks');
    expect(createInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(createInit?.body))).toEqual({
      organizationId: 'org_1',
      type: 'webhook',
      name: 'Security warehouse',
      config: { url: 'https://siem.example.com/ingest' },
    });

    await expect(updateAuditLogSink({ sinkId: 'sink_1', enabled: false })).resolves.toMatchObject({
      id: 'sink_1',
      enabled: false,
    });
    const [updateUrl, updateInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(updateUrl).toBe('https://tasks.example.com/api/admin/audit-log-sinks/sink_1');
    expect(updateInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(updateInit?.body))).toEqual({ enabled: false });

    await expect(deleteAuditLogSink('sink_1')).resolves.toEqual({ ok: true });
    const [, deleteInit] = jest.mocked(globalThis.fetch).mock.calls[2] ?? [];
    expect(deleteInit).toMatchObject({ method: 'DELETE' });

    await expect(testAuditLogSink('sink_1')).resolves.toEqual({
      ok: true,
      statusCode: 204,
      error: null,
    });
    const [testUrl, testInit] = jest.mocked(globalThis.fetch).mock.calls[3] ?? [];
    expect(testUrl).toBe('https://tasks.example.com/api/admin/audit-log-sinks/sink_1/test');
    expect(testInit).toMatchObject({ method: 'POST' });
  });
});
