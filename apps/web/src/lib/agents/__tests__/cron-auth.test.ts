/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { requireCronAuth, CRON_SECRET_HEADER } from '../cron-auth';

function mkRequest(headers: Record<string, string> = {}, urlSuffix = ''): NextRequest {
  return new NextRequest(
    new Request(`http://localhost/api/cron/standup${urlSuffix}`, {
      method: 'POST',
      headers,
    })
  );
}

describe('requireCronAuth', () => {
  const originalEnv = process.env.CRON_SECRET;
  afterEach(() => {
    process.env.CRON_SECRET = originalEnv;
  });

  it('returns 503 when CRON_SECRET is not configured', () => {
    delete process.env.CRON_SECRET;
    const res = requireCronAuth(mkRequest({ [CRON_SECRET_HEADER]: 'anything' }));
    expect(res?.status).toBe(503);
  });

  it('returns 401 when the secret is wrong', () => {
    process.env.CRON_SECRET = 'super-long-secret-value-here';
    const res = requireCronAuth(mkRequest({ [CRON_SECRET_HEADER]: 'nope' }));
    expect(res?.status).toBe(401);
  });

  it('allows the request when the header matches', () => {
    process.env.CRON_SECRET = 'super-long-secret-value-here';
    const res = requireCronAuth(
      mkRequest({ [CRON_SECRET_HEADER]: 'super-long-secret-value-here' })
    );
    expect(res).toBeNull();
  });

  it('allows the request when the secret is passed as query param', () => {
    process.env.CRON_SECRET = 'super-long-secret-value-here';
    const res = requireCronAuth(
      mkRequest({}, '?secret=super-long-secret-value-here')
    );
    expect(res).toBeNull();
  });
});
