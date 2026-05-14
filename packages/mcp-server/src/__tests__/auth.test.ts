import { resolveStdioAuth, resolveHttpAuth } from '../auth';

describe('resolveStdioAuth', () => {
  it('reads env vars', () => {
    const ctx = resolveStdioAuth({
      TASKNEBULA_API_URL: 'https://x',
      TASKNEBULA_API_KEY: 'k',
    } as NodeJS.ProcessEnv);
    expect(ctx).toEqual({ apiUrl: 'https://x', apiKey: 'k' });
  });

  it('defaults apiUrl to localhost when unset', () => {
    const ctx = resolveStdioAuth({} as NodeJS.ProcessEnv);
    expect(ctx.apiUrl).toBe('http://localhost:3000');
    expect(ctx.apiKey).toBeUndefined();
  });
});

describe('resolveHttpAuth', () => {
  it('extracts bearer token from Headers', () => {
    const headers = new Headers({ Authorization: 'Bearer abc.def.ghi' });
    const ctx = resolveHttpAuth({ headers }, { TASKNEBULA_API_URL: 'https://x' } as NodeJS.ProcessEnv);
    expect(ctx.accessToken).toBe('abc.def.ghi');
    expect(ctx.apiUrl).toBe('https://x');
  });

  it('returns no token when header is missing', () => {
    const ctx = resolveHttpAuth({ headers: new Headers() });
    expect(ctx.accessToken).toBeUndefined();
  });

  it('rejects malformed authorization header', () => {
    const headers = new Headers({ Authorization: 'Basic abc' });
    const ctx = resolveHttpAuth({ headers });
    expect(ctx.accessToken).toBeUndefined();
  });
});
