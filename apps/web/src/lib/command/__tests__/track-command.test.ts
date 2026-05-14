/**
 * @jest-environment node
 *
 * The `/track 30m` slash command is the smallest piece of task #10's UI work
 * that ships standalone (full cmd-k wiring is task #25). We assert the parser
 * extracts the duration correctly, leaves the rest as description, and reports
 * structured errors so the dispatcher can toast.
 */

import { handleTrackCommand } from '../track-command';

function makeFetcher(status = 201, body: any = { ok: true }) {
  return jest.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

describe('handleTrackCommand', () => {
  it('rejects when no issue is open', async () => {
    const res = await handleTrackCommand('/track 30m', {
      issueId: null,
      fetcher: makeFetcher(),
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/Open an issue/i);
  });

  it('rejects when no duration is provided', async () => {
    const res = await handleTrackCommand('/track', { issueId: 'iss_1' });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/Usage/);
  });

  it('rejects unparseable durations', async () => {
    const res = await handleTrackCommand('/track banana', { issueId: 'iss_1' });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/Couldn't parse/);
  });

  it('parses "/track 30m" and POSTs the entry', async () => {
    const fetcher = makeFetcher();
    const res = await handleTrackCommand('/track 30m', {
      issueId: 'iss_1',
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect(res.ok).toBe(true);
    expect(res.seconds).toBe(1800);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/issues/iss_1/time-entries');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.durationSeconds).toBe(1800);
    expect(body.description).toBeUndefined();
  });

  it('parses "/track 1h 30m fixed flaky test" and uses the tail as description', async () => {
    const fetcher = makeFetcher();
    const res = await handleTrackCommand('/track 1h 30m fixed flaky test', {
      issueId: 'iss_1',
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect(res.ok).toBe(true);
    expect(res.seconds).toBe(5400);
    const body = JSON.parse((fetcher.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.description).toBe('fixed flaky test');
  });

  it('also accepts the bare "track" keyword without the slash', async () => {
    const fetcher = makeFetcher();
    const res = await handleTrackCommand('track 15m', {
      issueId: 'iss_1',
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect(res.ok).toBe(true);
    expect(res.seconds).toBe(900);
  });

  it('reports server errors with the status code', async () => {
    const fetcher = makeFetcher(500, 'boom');
    const res = await handleTrackCommand('/track 30m', {
      issueId: 'iss_1',
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/500/);
  });
});
