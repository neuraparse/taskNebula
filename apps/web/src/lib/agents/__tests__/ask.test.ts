/**
 * @jest-environment node
 */

// Mock the @tasknebula/db package so we don't need a live Postgres for
// these unit tests. The tests focus on prompt construction, the Claude SSE
// parser, and the public event contract of runAsk().
jest.mock('@tasknebula/db', () => ({
  db: {
    execute: jest.fn().mockResolvedValue([]),
  },
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

import { runAsk, AskError, __internal } from '../ask';
import type { AskEvent } from '../ask';

async function collect(events: AsyncGenerator<AskEvent>): Promise<AskEvent[]> {
  const out: AskEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

describe('runAsk — input validation', () => {
  it('rejects empty queries', async () => {
    await expect(runAsk({ query: '', organizationId: 'org_1' })).rejects.toBeInstanceOf(AskError);
  });

  it('rejects oversized queries', async () => {
    await expect(
      runAsk({ query: 'x'.repeat(2001), organizationId: 'org_1' })
    ).rejects.toMatchObject({ code: 'query_too_long' });
  });
});

describe('runAsk — retrievalOnly mode', () => {
  it('emits sources then done without calling fetch', async () => {
    const fetchImpl = jest.fn();
    const bundle = await runAsk({
      query: 'what is dark mode?',
      organizationId: 'org_1',
      retrievalOnly: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const events = await collect(bundle.events);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(events.map((e) => e.type)).toEqual(['sources', 'done']);
  });
});

describe('runAsk — Claude streaming (mocked)', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
  });
  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalKey;
    delete process.env.COHERE_API_KEY;
  });

  function makeSseResponse(lines: string[]): Response {
    const body = lines.map((l) => `${l}\n`).join('');
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }

  it('streams token frames and finishes with usage', async () => {
    const fetchImpl = jest.fn(async () =>
      makeSseResponse([
        `data: ${JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 42, output_tokens: 0 } } })}`,
        `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello ' } })}`,
        `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: '[Source: TN-A].' } })}`,
        `data: ${JSON.stringify({ type: 'message_delta', usage: { output_tokens: 9 } })}`,
        `data: [DONE]`,
      ])
    );

    const bundle = await runAsk({
      query: 'anything',
      organizationId: 'org_1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const events = await collect(bundle.events);
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('sources');
    expect(types).toContain('token');
    expect(types[types.length - 1]).toBe('done');

    const tokens = events.filter(
      (e): e is Extract<AskEvent, { type: 'token' }> => e.type === 'token'
    );
    const joined = tokens.map((t) => t.text).join('');
    expect(joined).toBe('Hello [Source: TN-A].');

    const done = events.find((e) => e.type === 'done') as Extract<AskEvent, { type: 'done' }>;
    expect(done.usage.model).toBeDefined();
    expect(done.usage.inputTokens).toBe(42);
    expect(done.usage.outputTokens).toBe(9);
    expect(done.usage.costUsd).toBeGreaterThan(0);
    expect(done.usage.promptHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('emits an error frame when Anthropic returns 401', async () => {
    const fetchImpl = jest.fn(async () => new Response('forbidden', { status: 401 }));
    const bundle = await runAsk({
      query: 'anything',
      organizationId: 'org_1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const events = await collect(bundle.events);
    const err = events.find((e) => e.type === 'error') as
      | Extract<AskEvent, { type: 'error' }>
      | undefined;
    expect(err).toBeDefined();
    expect(err!.code).toBe('provider_auth_failed');
  });

  it('throws AskError when no Anthropic key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      runAsk({
        query: 'anything',
        organizationId: 'org_1',
        fetchImpl: jest.fn() as unknown as typeof fetch,
      })
    ).rejects.toMatchObject({ code: 'missing_credential' });
  });
});

describe('runAsk — internal helpers', () => {
  it('mergeHybrid dedupes by (type,id) and ranks by combined score', () => {
    const bm25 = [
      {
        type: 'issue' as const,
        id: 'a',
        key: 'TASK-1',
        title: 'A',
        snippet: '',
        score: 10,
        signal: 'bm25' as const,
      },
      {
        type: 'issue' as const,
        id: 'b',
        key: 'TASK-2',
        title: 'B',
        snippet: '',
        score: 5,
        signal: 'bm25' as const,
      },
    ];
    const vector = [
      {
        type: 'issue' as const,
        id: 'a',
        key: 'TASK-1',
        title: 'A',
        snippet: '',
        score: 0.9,
        signal: 'vector' as const,
      },
      {
        type: 'issue' as const,
        id: 'c',
        key: 'TASK-3',
        title: 'C',
        snippet: '',
        score: 0.8,
        signal: 'vector' as const,
      },
    ];
    const merged = __internal.mergeHybrid([bm25, vector]);
    expect(merged[0]!.id).toBe('a');
    expect(merged.map((m) => m.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('buildUserMessage labels issues with [TN-key] and docs with [DOC-id]', () => {
    const message = __internal.buildUserMessage('what?', [
      { type: 'issue', id: 'x', key: 'TASK-9', title: 'T', snippet: 'S', score: 1, signal: 'bm25' },
      { type: 'doc', id: 'd1', key: 'd1', title: 'D', snippet: 'DS', score: 1, signal: 'bm25' },
    ]);
    expect(message).toContain('[TN-TASK-9]');
    expect(message).toContain('[DOC-d1]');
    expect(message).toContain(
      'Now answer the question. Remember: every claim ends with [Source: ...].'
    );
  });

  it('estimateCost applies the per-model price table', () => {
    const sonnet = __internal.estimateCost('claude-sonnet-4-6', 1_000_000, 1_000_000);
    expect(sonnet).toBeCloseTo(18, 5);
  });

  it('SYSTEM_PROMPT enforces the citation discipline', () => {
    expect(__internal.SYSTEM_PROMPT).toMatch(/Citation rules/);
    expect(__internal.SYSTEM_PROMPT).toMatch(/\[Source: TN-/);
    expect(__internal.SYSTEM_PROMPT).toMatch(/\[Source: DOC-/);
  });
});
