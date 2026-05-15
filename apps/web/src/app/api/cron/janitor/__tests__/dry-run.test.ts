/**
 * @jest-environment node
 *
 * Coverage for the janitor cron route's `effectiveDryRun` resolution:
 *
 *   - When the caller asks for a live run (`dryRun: false`) but no
 *     systemUserId can be resolved (neither body nor env), the route
 *     must short-circuit with HTTP 412 instead of silently downgrading
 *     to a dry-run or crashing on the first comment insert.
 *   - When a systemUserId is supplied, live runs are allowed and the
 *     mocked org loop is exercised.
 *   - When the caller omits `dryRun`, the effective value falls back to
 *     "dry-run unless a system user is configured".
 *   - `dryRun: true` is honoured regardless of systemUserId.
 *
 * `@tasknebula/db`, `requireCronAuth`, and `runJanitorForOrg` are all
 * mocked so the route can be required without booting Postgres.
 */

// --------------------------- mocks ---------------------------------------

jest.mock('@tasknebula/db', () => {
  const organizations = { __name: 'organizations' };
  const sql = (strings: TemplateStringsArray, ..._values: unknown[]) => strings.join('?');
  const db = {
    select() {
      return {
        from(_t: unknown) {
          return {
            where(_c: unknown) {
              return {
                limit: (_n: number) => Promise.resolve([{ id: 'org-a' }, { id: 'org-b' }]),
              };
            },
          };
        },
      };
    },
  };
  return { db, organizations, sql };
});

jest.mock('@/lib/agents/cron-auth', () => ({
  requireCronAuth: jest.fn().mockReturnValue(null),
}));

const runJanitorForOrgMock = jest.fn();
jest.mock('@/lib/agents/janitor-runner', () => ({
  runJanitorForOrg: (...args: unknown[]) => runJanitorForOrgMock(...args),
}));

// -------------------------------------------------------------------------

import { POST as janitorHandler } from '../route';

function buildRequest(body: unknown | undefined): {
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  headers: Headers;
  url: string;
} {
  return {
    json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
    headers: new Headers(),
    url: 'http://localhost/api/cron/janitor',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.JANITOR_SYSTEM_USER_ID;
  runJanitorForOrgMock.mockResolvedValue({
    decisions: [],
    total: 0,
  });
});

describe('POST /api/cron/janitor — effectiveDryRun resolution', () => {
  it('returns 412 when dryRun=false and no systemUserId is available', async () => {
    const res = await janitorHandler(buildRequest({ dryRun: false }) as never);
    expect(res.status).toBe(412);
    const body = await res.json();
    expect(body.error).toMatch(/JANITOR_SYSTEM_USER_ID/);
    expect(runJanitorForOrgMock).not.toHaveBeenCalled();
  });

  it('passes the guard when dryRun=false and systemUserId is supplied', async () => {
    const res = await janitorHandler(
      buildRequest({ dryRun: false, systemUserId: 'user-1' }) as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dryRun).toBe(false);
    expect(body.orgsProcessed).toBe(2);
    // The org loop ran once per seeded org.
    expect(runJanitorForOrgMock).toHaveBeenCalledTimes(2);
    expect(runJanitorForOrgMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-a',
        systemUserId: 'user-1',
        dryRun: false,
      })
    );
  });

  it('defaults effectiveDryRun=true when dryRun is omitted and no env user', async () => {
    const res = await janitorHandler(buildRequest({}) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dryRun).toBe(true);
    expect(runJanitorForOrgMock).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
  });

  it('honours dryRun=true even when systemUserId is supplied', async () => {
    const res = await janitorHandler(
      buildRequest({ dryRun: true, systemUserId: 'user-1' }) as never
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dryRun).toBe(true);
    expect(runJanitorForOrgMock).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true, systemUserId: 'user-1' })
    );
  });
});
