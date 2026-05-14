/**
 * @jest-environment node
 */

// In-memory fake row store the mocked db reads/writes through.
const fakeRows: Array<Record<string, any>> = [];
let lastInserted: Record<string, any> | null = null;

jest.mock('@tasknebula/db', () => {
  // eqMatcher carries enough info for the fake `where` to filter.
  const eqMatcher = (col: any, value: any) => ({ __eq: true, col, value });

  const makeSelectChain = () => {
    let pendingFilter: any = null;
    const chain: any = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn(function (this: any, filter: any) {
        pendingFilter = filter;
        return this;
      }),
      limit: jest.fn().mockImplementation(async () => {
        if (pendingFilter?.__eq && pendingFilter.col === 'id') {
          return fakeRows.filter((r) => r.id === pendingFilter.value);
        }
        return fakeRows.slice();
      }),
    };
    return chain;
  };

  const insertChain = (values: any) => ({
    returning: jest.fn().mockImplementation(async () => {
      const row = {
        id: `bj_${fakeRows.length + 1}`,
        organizationId: values.organizationId ?? null,
        provider: values.provider,
        externalBatchId: values.externalBatchId,
        status: values.status ?? 'validating',
        workload: values.workload ?? 'other',
        totalRequests: values.totalRequests ?? 0,
        completedRequests: 0,
        errorCount: 0,
        resultsStoragePath: null,
        metadata: values.metadata ?? {},
        createdAt: new Date(),
        completedAt: null,
      };
      fakeRows.push(row);
      lastInserted = row;
      return [row];
    }),
  });

  const updateChain = (patch: any) => ({
    where: jest.fn().mockImplementation(async (filter: any) => {
      if (filter?.__eq && filter.col === 'id') {
        const row = fakeRows.find((r) => r.id === filter.value);
        if (row) Object.assign(row, patch);
      }
      return undefined;
    }),
  });

  return {
    db: {
      insert: jest.fn(() => ({
        values: (v: any) => insertChain(v),
      })),
      select: jest.fn(() => makeSelectChain()),
      update: jest.fn(() => ({
        set: (patch: any) => updateChain(patch),
      })),
    },
    eq: (col: any, value: any) => eqMatcher(col, value),
    llmBatchJobs: {
      id: 'id',
      organizationId: 'organizationId',
      externalBatchId: 'externalBatchId',
      status: 'status',
    },
  };
});

import {
  BATCH_ROUTED_WORKLOADS,
  fetchBatchResults,
  pollBatch,
  shouldRouteToBatch,
  submitBatchJob,
} from '../batch';

describe('OpenAI Batch API wrapper', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    fakeRows.length = 0;
    lastInserted = null;
    process.env.OPENAI_API_KEY = 'sk-test-batch';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
    jest.restoreAllMocks();
  });

  it('routes the expected workloads to Batch', () => {
    expect(shouldRouteToBatch('embedding_backfill')).toBe(true);
    expect(shouldRouteToBatch('weekly_summary')).toBe(true);
    expect(shouldRouteToBatch('stale_janitor')).toBe(true);
    expect(shouldRouteToBatch('release_notes')).toBe(true);
    expect(shouldRouteToBatch('triage_backfill')).toBe(true);
    expect(shouldRouteToBatch('other')).toBe(false);
    expect(BATCH_ROUTED_WORKLOADS.size).toBe(5);
  });

  it('rejects empty requests', async () => {
    await expect(
      submitBatchJob([], { workload: 'weekly_summary' })
    ).rejects.toMatchObject({ code: 'empty_batch' });
  });

  it('rejects when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(
      submitBatchJob(
        [
          {
            custom_id: 'r-1',
            method: 'POST',
            url: '/v1/chat/completions',
            body: {},
          },
        ],
        { workload: 'weekly_summary' }
      )
    ).rejects.toMatchObject({ code: 'missing_credential' });
  });

  it('uploads file, creates batch, persists row, returns ids', async () => {
    const fetchMock = jest.fn();
    // File upload
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'file_abc' }),
    });
    // Batch create
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'batch_xyz', status: 'validating' }),
    });
    global.fetch = fetchMock as any;

    const result = await submitBatchJob(
      [
        {
          custom_id: 'r-1',
          method: 'POST',
          url: '/v1/chat/completions',
          body: { model: 'gpt-4o-mini', messages: [] },
        },
        {
          custom_id: 'r-2',
          method: 'POST',
          url: '/v1/chat/completions',
          body: { model: 'gpt-4o-mini', messages: [] },
        },
      ],
      { workload: 'release_notes', organizationId: 'org_1' }
    );

    expect(result).toMatchObject({
      externalBatchId: 'batch_xyz',
      status: 'validating',
      totalRequests: 2,
    });
    expect(result.id).toMatch(/^bj_/);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [filesCall, batchesCall] = fetchMock.mock.calls;
    expect(filesCall[0]).toContain('/v1/files');
    expect(batchesCall[0]).toContain('/v1/batches');
    const batchBody = JSON.parse(batchesCall[1].body);
    expect(batchBody).toMatchObject({
      input_file_id: 'file_abc',
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
    });
    expect(batchBody.metadata.workload).toBe('release_notes');

    expect(lastInserted).toMatchObject({
      provider: 'openai',
      externalBatchId: 'batch_xyz',
      workload: 'release_notes',
      totalRequests: 2,
      organizationId: 'org_1',
    });
  });

  it('wraps a failed file upload with file_upload_failed', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    }) as any;
    await expect(
      submitBatchJob(
        [
          {
            custom_id: 'r-1',
            method: 'POST',
            url: '/v1/chat/completions',
            body: {},
          },
        ],
        { workload: 'weekly_summary' }
      )
    ).rejects.toMatchObject({ code: 'file_upload_failed' });
  });

  it('pollBatch updates row status, counts, and metadata', async () => {
    // Pre-seed an existing job row.
    fakeRows.push({
      id: 'bj_seed',
      organizationId: null,
      provider: 'openai',
      externalBatchId: 'batch_xyz',
      status: 'validating',
      workload: 'weekly_summary',
      totalRequests: 3,
      completedRequests: 0,
      errorCount: 0,
      resultsStoragePath: null,
      metadata: {},
      createdAt: new Date(),
      completedAt: null,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'batch_xyz',
        status: 'completed',
        request_counts: { total: 3, completed: 3, failed: 0 },
        output_file_id: 'file_out_1',
        completed_at: 1715600000,
      }),
    }) as any;

    const status = await pollBatch('bj_seed');
    expect(status).toMatchObject({
      status: 'completed',
      totalRequests: 3,
      completedRequests: 3,
      errorCount: 0,
    });
    expect(status.completedAt).toBeInstanceOf(Date);
    const updated = fakeRows.find((r) => r.id === 'bj_seed')!;
    expect(updated.status).toBe('completed');
    expect(updated.metadata.outputFileId).toBe('file_out_1');
  });

  it('fetchBatchResults parses JSONL output and records storage path', async () => {
    fakeRows.push({
      id: 'bj_done',
      organizationId: null,
      provider: 'openai',
      externalBatchId: 'batch_done',
      status: 'completed',
      workload: 'embedding_backfill',
      totalRequests: 2,
      completedRequests: 2,
      errorCount: 0,
      resultsStoragePath: null,
      metadata: { outputFileId: 'file_out_2' },
      createdAt: new Date(),
      completedAt: new Date(),
    });

    const jsonl = [
      JSON.stringify({
        custom_id: 'r-1',
        response: { status_code: 200, body: { id: 'r-1' } },
      }),
      JSON.stringify({
        custom_id: 'r-2',
        response: null,
        error: { message: 'rate limit' },
      }),
    ].join('\n');

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => jsonl,
    }) as any;

    const results = await fetchBatchResults('bj_done');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ customId: 'r-1' });
    expect(results[1].error).toMatchObject({ message: 'rate limit' });
    const updated = fakeRows.find((r) => r.id === 'bj_done')!;
    expect(updated.resultsStoragePath).toBe('openai://files/file_out_2');
  });

  it('fetchBatchResults rejects when status is not completed', async () => {
    fakeRows.push({
      id: 'bj_pending',
      organizationId: null,
      provider: 'openai',
      externalBatchId: 'batch_p',
      status: 'in_progress',
      workload: 'release_notes',
      totalRequests: 1,
      completedRequests: 0,
      errorCount: 0,
      resultsStoragePath: null,
      metadata: {},
      createdAt: new Date(),
      completedAt: null,
    });
    await expect(fetchBatchResults('bj_pending')).rejects.toMatchObject({
      code: 'not_ready',
    });
  });
});
