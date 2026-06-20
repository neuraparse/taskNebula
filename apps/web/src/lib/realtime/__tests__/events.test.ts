// Force the in-process transport (no Redis) so publishEvent delivers
// synchronously and fanOutToRedis is a no-op.
const ORIGINAL_REDIS_URL = process.env.REDIS_URL;

beforeAll(() => {
  delete process.env.REDIS_URL;
});

afterAll(() => {
  if (ORIGINAL_REDIS_URL === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = ORIGINAL_REDIS_URL;
});

// Imported after the env is forced so the redis client helper sees no URL.
import { eventBus, publishEvent, type RealtimeEvent } from '../events';

describe('publishEvent (in-process transport)', () => {
  it('delivers synchronously to subscribers in this process', () => {
    const received: RealtimeEvent[] = [];
    const unsubscribe = eventBus.subscribe((e) => received.push(e));

    publishEvent('issue.created', 'user-1', {
      projectId: 'demo',
      issueId: 'issue-1',
      organizationId: 'org-1',
    });

    unsubscribe();

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      type: 'issue.created',
      userId: 'user-1',
      projectId: 'demo',
      issueId: 'issue-1',
      organizationId: 'org-1',
    });
    expect(typeof received[0]?.timestamp).toBe('number');
  });

  it('does not deliver to a subscriber that has unsubscribed', () => {
    const received: RealtimeEvent[] = [];
    const unsubscribe = eventBus.subscribe((e) => received.push(e));
    unsubscribe();

    publishEvent('issue.deleted', 'user-2', { organizationId: 'org-1', issueId: 'issue-9' });

    expect(received).toHaveLength(0);
  });

  it('isolates a throwing listener from the others', () => {
    const received: RealtimeEvent[] = [];
    const unsubBad = eventBus.subscribe(() => {
      throw new Error('boom');
    });
    const unsubGood = eventBus.subscribe((e) => received.push(e));

    expect(() =>
      publishEvent('issue.updated', 'user-3', { organizationId: 'org-1', issueId: 'issue-3' })
    ).not.toThrow();

    unsubBad();
    unsubGood();

    expect(received).toHaveLength(1);
    expect(received[0]?.type).toBe('issue.updated');
  });
});
