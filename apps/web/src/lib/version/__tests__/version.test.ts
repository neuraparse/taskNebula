/**
 * Tests for src/lib/version — semver compare and the TTL/cache behavior of
 * checkLatestVersion (mocked fetch + db, per neighboring test idiom).
 */

const dbSelectMock = jest.fn();
const dbInsertMock = jest.fn();
const dbUpdateMock = jest.fn();

jest.mock('@tasknebula/db', () => ({
  db: {
    select: (...args: unknown[]) => dbSelectMock(...args),
    insert: (...args: unknown[]) => dbInsertMock(...args),
    update: (...args: unknown[]) => dbUpdateMock(...args),
  },
  systemSettings: new Proxy({}, { get: (_t, prop) => `systemSettings.${String(prop)}` }),
  notifications: new Proxy({}, { get: (_t, prop) => `notifications.${String(prop)}` }),
  users: new Proxy({}, { get: (_t, prop) => `users.${String(prop)}` }),
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  sql: (...args: unknown[]) => ({ type: 'sql', args }),
}));

jest.mock('../preferences', () => ({
  getVersionUpdatePreferences: jest.fn().mockResolvedValue({
    bannerEnabled: true,
    availableUpdateNotificationsEnabled: true,
    postUpdateNotificationsEnabled: true,
    updatedAt: null,
    updatedBy: null,
  }),
}));

import { systemSettings as systemSettingsTable } from '@tasknebula/db';
import {
  compareSemver,
  checkLatestVersion,
  getUpdateStatus,
  getCurrentVersion,
  handleDockerHubWebhook,
  DOCKER_HUB_REPOSITORY,
  DOCKER_HUB_TAGS_URL,
  RELEASES_LATEST_URL,
  UPDATE_NOTIFICATION_KEY,
  type VersionCheckState,
} from '../index';

const fetchMock = jest.fn();

/** db.select(...).from(...).where(...).limit(1) → rows */
function cacheSelectChain(rows: Array<{ value: unknown }>) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

/** db.select(...).from(...).where(...).limit(1) → rows */
function mockCachedRows(rows: Array<{ value: unknown }>) {
  dbSelectMock.mockReturnValue(cacheSelectChain(rows));
}

/** db.select({...}).from(users).where(...) → rows */
function adminsSelectChain(rows: Array<{ id: string }>) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(rows),
    }),
  };
}

/** db.insert(...).values(...).onConflictDoUpdate(...) → undefined */
function mockInsertChain() {
  const onConflictDoUpdate = jest.fn().mockResolvedValue(undefined);
  const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
  dbInsertMock.mockReturnValue({ values });
  return { values, onConflictDoUpdate };
}

function mockUpdateReturning(rows: Array<{ id: string }>) {
  dbUpdateMock.mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

function mockUpdateNotificationAlreadyMarked() {
  dbInsertMock.mockImplementation((table: unknown) => ({
    values:
      table === systemSettingsTable
        ? jest.fn().mockReturnValue({
            onConflictDoNothing: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([]),
            }),
          })
        : jest.fn().mockResolvedValue(undefined),
  }));
  mockUpdateReturning([]);
}

function githubResponse(overrides: Record<string, unknown> = {}, ok = true) {
  return {
    ok,
    json: jest.fn().mockResolvedValue({
      tag_name: 'v9.9.9',
      html_url: 'https://github.com/neuraparse/taskNebula/releases/tag/v9.9.9',
      published_at: '2026-06-01T00:00:00.000Z',
      body: 'Release notes',
      ...overrides,
    }),
  };
}

function dockerResponse(overrides: Record<string, unknown> = {}, ok = true) {
  return {
    ok,
    json: jest.fn().mockResolvedValue({
      results: [
        {
          name: '9.9.9',
          tag_last_pushed: '2026-06-01T00:01:00.000Z',
          last_updated: '2026-06-01T00:01:00.000Z',
          digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          full_size: 123456789,
          ...overrides,
        },
      ],
    }),
  };
}

function cachedState(ageMs: number, overrides: Partial<VersionCheckState> = {}): VersionCheckState {
  return {
    release: {
      latest: '8.8.8',
      htmlUrl: 'https://github.com/neuraparse/taskNebula/releases/tag/v8.8.8',
      publishedAt: '2026-01-01T00:00:00.000Z',
      notes: 'old notes',
    },
    docker: null,
    fetchedAt: new Date(Date.now() - ageMs).toISOString(),
    ...overrides,
  };
}

const HOUR_MS = 60 * 60 * 1000;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  delete process.env.TASKNEBULA_DISABLE_UPDATE_CHECK;
  delete process.env.TASKNEBULA_VERSION;
});

describe('compareSemver', () => {
  it('orders core versions numerically', () => {
    expect(compareSemver('0.4.1', '0.4.0')).toBeGreaterThan(0);
    expect(compareSemver('0.5.0', '0.4.9')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareSemver('0.4.0', '0.4.1')).toBeLessThan(0);
    expect(compareSemver('0.4.0', '0.4.0')).toBe(0);
  });

  it('compares segments numerically, not lexicographically', () => {
    expect(compareSemver('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareSemver('0.4.10', '0.4.2')).toBeGreaterThan(0);
  });

  it('tolerates a leading v on either side', () => {
    expect(compareSemver('v1.0.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', 'v1.0.0')).toBe(0);
  });

  it('sorts pre-releases below the plain release', () => {
    expect(compareSemver('1.0.0-rc.1', '1.0.0')).toBeLessThan(0);
    expect(compareSemver('1.0.0', '1.0.0-rc.1')).toBeGreaterThan(0);
  });

  it('compares pre-release identifiers per the semver spec', () => {
    expect(compareSemver('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
    // Numeric identifiers compare numerically…
    expect(compareSemver('1.0.0-rc.2', '1.0.0-rc.10')).toBeLessThan(0);
    // …and sort below alphanumeric ones.
    expect(compareSemver('1.0.0-1', '1.0.0-alpha')).toBeLessThan(0);
    // Fewer identifiers sort lower when the shared prefix is equal.
    expect(compareSemver('1.0.0-rc', '1.0.0-rc.1')).toBeLessThan(0);
    expect(compareSemver('1.0.0-rc.1', '1.0.0-rc.1')).toBe(0);
  });

  it('treats unparseable input as equal (fail soft)', () => {
    expect(compareSemver('not-a-version', '1.0.0')).toBe(0);
    expect(compareSemver('1.0.0', '')).toBe(0);
    expect(compareSemver('1.0', '1.0.0')).toBe(0);
  });
});

describe('getCurrentVersion', () => {
  it('reads the bundled package.json version by default', () => {
    expect(getCurrentVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('prefers a valid TASKNEBULA_VERSION env override (v-prefix stripped)', () => {
    process.env.TASKNEBULA_VERSION = 'v7.7.7';
    expect(getCurrentVersion()).toBe('7.7.7');
  });

  it('ignores a malformed TASKNEBULA_VERSION', () => {
    process.env.TASKNEBULA_VERSION = 'lol; drop table';
    expect(getCurrentVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('checkLatestVersion', () => {
  it('returns null and touches nothing when disabled via env', async () => {
    process.env.TASKNEBULA_DISABLE_UPDATE_CHECK = 'true';
    const result = await checkLatestVersion();
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dbSelectMock).not.toHaveBeenCalled();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('serves a fresh cache (< 6h) without fetching', async () => {
    const cached = cachedState(1 * HOUR_MS);
    mockCachedRows([{ value: cached }]);

    const result = await checkLatestVersion();
    expect(result).toEqual(cached);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('refetches and persists when the cache is stale (> 6h)', async () => {
    mockCachedRows([{ value: cachedState(7 * HOUR_MS) }]);
    const { values } = mockInsertChain();
    fetchMock.mockResolvedValueOnce(githubResponse()).mockResolvedValueOnce(dockerResponse());

    const result = await checkLatestVersion();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(RELEASES_LATEST_URL);
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/^tasknebula\//);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(DOCKER_HUB_TAGS_URL);

    expect(result?.release?.latest).toBe('9.9.9'); // leading v stripped
    expect(result?.release?.htmlUrl).toBe(
      'https://github.com/neuraparse/taskNebula/releases/tag/v9.9.9'
    );
    expect(result?.release?.notes).toBe('Release notes');
    expect(result?.docker).toEqual({
      repository: DOCKER_HUB_REPOSITORY,
      latestTag: '9.9.9',
      tagUrl: 'https://hub.docker.com/r/neuraparse/tasknebula/tags?name=9.9.9',
      pushedAt: '2026-06-01T00:01:00.000Z',
      digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      sizeBytes: 123456789,
    });
    // Persisted via upsert with the same state.
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'version_check', value: result })
    );
  });

  it('bypasses a fresh cache when forceRefresh is set', async () => {
    mockCachedRows([{ value: cachedState(1 * HOUR_MS) }]);
    mockInsertChain();
    fetchMock.mockResolvedValueOnce(githubResponse()).mockResolvedValueOnce(dockerResponse());

    const result = await checkLatestVersion({ forceRefresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result?.release?.latest).toBe('9.9.9');
  });

  it('falls back to the stale cache on network failure', async () => {
    const stale = cachedState(7 * HOUR_MS);
    mockCachedRows([{ value: stale }]);
    fetchMock.mockRejectedValue(new Error('offline'));

    const result = await checkLatestVersion();
    expect(result).toEqual(stale);
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('falls back to the stale cache on a non-OK response (rate limit)', async () => {
    const stale = cachedState(7 * HOUR_MS);
    mockCachedRows([{ value: stale }]);
    fetchMock.mockResolvedValue({ ok: false, json: jest.fn() });

    const result = await checkLatestVersion();
    expect(result).toEqual(stale);
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('returns null when there is no cache and the fetch fails', async () => {
    mockCachedRows([]);
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await checkLatestVersion()).toBeNull();
  });

  it('rejects a non-semver tag_name instead of storing it', async () => {
    mockCachedRows([]);
    fetchMock
      .mockResolvedValueOnce(githubResponse({ tag_name: '<script>alert(1)</script>' }))
      .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue({ results: [] }) });
    expect(await checkLatestVersion()).toBeNull();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('truncates release notes to 2000 chars', async () => {
    mockCachedRows([]);
    mockInsertChain();
    fetchMock
      .mockResolvedValueOnce(githubResponse({ body: 'x'.repeat(5000) }))
      .mockResolvedValueOnce(dockerResponse());

    const result = await checkLatestVersion();
    expect(result?.release?.notes).toHaveLength(2000);
  });

  it('uses the most recently pushed Docker Hub semver tag, not the largest stale semver', async () => {
    mockCachedRows([]);
    mockInsertChain();
    fetchMock.mockResolvedValueOnce(githubResponse()).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        results: [
          {
            name: '0.12.0',
            tag_last_pushed: '2026-04-21T07:21:33.745Z',
            digest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
            full_size: 320439109,
          },
          {
            name: '0.6.5',
            tag_last_pushed: '2026-06-20T02:13:49.101Z',
            digest: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
            full_size: 434303186,
          },
        ],
      }),
    });

    const result = await checkLatestVersion();

    expect(result?.docker?.latestTag).toBe('0.6.5');
    expect(result?.docker?.pushedAt).toBe('2026-06-20T02:13:49.101Z');
  });

  it('still works (fetch path) when the cache read throws', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    dbSelectMock.mockImplementation(() => {
      throw new Error('db down');
    });
    mockInsertChain();
    fetchMock.mockResolvedValueOnce(githubResponse()).mockResolvedValueOnce(dockerResponse());

    const result = await checkLatestVersion();
    expect(result?.release?.latest).toBe('9.9.9');
    warnSpy.mockRestore();
  });
});

describe('getUpdateStatus', () => {
  it('reports checkDisabled with null fields when disabled', async () => {
    process.env.TASKNEBULA_DISABLE_UPDATE_CHECK = 'true';
    const status = await getUpdateStatus();
    expect(status).toEqual({
      current: getCurrentVersion(),
      latest: null,
      releaseUpdateAvailable: false,
      updateAvailable: false,
      releaseUrl: null,
      publishedAt: null,
      notes: null,
      checkedAt: null,
      image: {
        repository: DOCKER_HUB_REPOSITORY,
        latestTag: null,
        latestTagUrl: null,
        latestPushedAt: null,
        latestDigest: null,
        latestSizeBytes: null,
        updateAvailable: false,
        checkedAt: null,
      },
      checkDisabled: true,
    });
  });

  it('flags updateAvailable only when latest is newer than current', async () => {
    process.env.TASKNEBULA_VERSION = '9.9.9';
    const sameVersion = cachedState(1 * HOUR_MS, {
      release: {
        latest: '9.9.9',
        htmlUrl: 'https://github.com/neuraparse/taskNebula/releases/tag/v9.9.9',
        publishedAt: '2026-06-01T00:00:00.000Z',
        notes: 'same notes',
      },
    });
    mockCachedRows([{ value: sameVersion }]);
    mockUpdateNotificationAlreadyMarked();
    let status = await getUpdateStatus();
    expect(status.updateAvailable).toBe(false);
    expect(status.latest).toBe('9.9.9');

    process.env.TASKNEBULA_VERSION = '9.9.8';
    status = await getUpdateStatus();
    expect(status.updateAvailable).toBe(true);
    expect(status.current).toBe('9.9.8');
    expect(status.checkedAt).toBe(sameVersion.fetchedAt);
    expect(status.checkDisabled).toBe(false);
  });

  it('flags image updates when Docker Hub has a newer semver tag than the running version', async () => {
    process.env.TASKNEBULA_VERSION = '1.2.3';
    const cached = cachedState(1 * HOUR_MS, {
      release: {
        latest: '1.2.3',
        htmlUrl: 'https://github.com/neuraparse/taskNebula/releases/tag/v1.2.3',
        publishedAt: '2026-06-01T00:00:00.000Z',
        notes: null,
      },
      docker: {
        repository: DOCKER_HUB_REPOSITORY,
        latestTag: '1.2.4',
        tagUrl: 'https://hub.docker.com/r/neuraparse/tasknebula/tags?name=1.2.4',
        pushedAt: '2026-06-02T00:00:00.000Z',
        digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        sizeBytes: 987654321,
      },
    });
    mockCachedRows([{ value: cached }]);
    mockUpdateNotificationAlreadyMarked();

    const status = await getUpdateStatus();

    expect(status.releaseUpdateAvailable).toBe(false);
    expect(status.updateAvailable).toBe(true);
    expect(status.latest).toBe('1.2.4');
    expect(status.image).toMatchObject({
      repository: DOCKER_HUB_REPOSITORY,
      latestTag: '1.2.4',
      updateAvailable: true,
      latestPushedAt: '2026-06-02T00:00:00.000Z',
      latestDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      latestSizeBytes: 987654321,
    });
  });

  it('notifies super admins once when Docker Hub has a newer image tag', async () => {
    process.env.TASKNEBULA_VERSION = '1.2.3';
    const cached = cachedState(1 * HOUR_MS, {
      release: {
        latest: '1.2.3',
        htmlUrl: 'https://github.com/neuraparse/taskNebula/releases/tag/v1.2.3',
        publishedAt: '2026-06-01T00:00:00.000Z',
        notes: null,
      },
      docker: {
        repository: DOCKER_HUB_REPOSITORY,
        latestTag: '1.2.4',
        tagUrl: 'https://hub.docker.com/r/neuraparse/tasknebula/tags?name=1.2.4',
        pushedAt: '2026-06-02T00:00:00.000Z',
        digest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        sizeBytes: 987654321,
      },
    });
    dbSelectMock
      .mockReturnValueOnce(cacheSelectChain([{ value: cached }]))
      .mockReturnValueOnce(adminsSelectChain([{ id: 'admin-1' }, { id: 'admin-2' }]));
    const notificationRows: unknown[] = [];
    const markerValues = jest.fn().mockReturnValue({
      onConflictDoNothing: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 'marker-1' }]),
      }),
    });
    const notificationValues = jest.fn().mockImplementation((rows: unknown) => {
      notificationRows.push(rows);
      return Promise.resolve(undefined);
    });
    dbInsertMock.mockImplementation((table: unknown) => ({
      values: table === systemSettingsTable ? markerValues : notificationValues,
    }));

    const status = await getUpdateStatus();

    expect(status.updateAvailable).toBe(true);
    expect(markerValues).toHaveBeenCalledWith(
      expect.objectContaining({
        key: UPDATE_NOTIFICATION_KEY,
        value: expect.objectContaining({
          version: '1.2.4',
          current: '1.2.3',
          source: 'docker',
          repository: DOCKER_HUB_REPOSITORY,
        }),
      })
    );
    expect(notificationRows).toHaveLength(1);
    expect(notificationRows[0]).toEqual([
      expect.objectContaining({
        userId: 'admin-1',
        type: 'issue_updated',
        actorType: 'system',
        title: 'TaskNebula v1.2.4 is available',
        message: expect.stringContaining('Docker Hub published neuraparse/tasknebula:1.2.4'),
      }),
      expect.objectContaining({
        userId: 'admin-2',
        title: 'TaskNebula v1.2.4 is available',
      }),
    ]);
  });

  it('does not re-notify when the same latest update was already marked', async () => {
    process.env.TASKNEBULA_VERSION = '1.2.3';
    const cached = cachedState(1 * HOUR_MS, {
      release: null,
      docker: {
        repository: DOCKER_HUB_REPOSITORY,
        latestTag: '1.2.4',
        tagUrl: 'https://hub.docker.com/r/neuraparse/tasknebula/tags?name=1.2.4',
        pushedAt: '2026-06-02T00:00:00.000Z',
        digest: null,
        sizeBytes: null,
      },
    });
    dbSelectMock.mockReturnValueOnce(cacheSelectChain([{ value: cached }]));
    dbInsertMock.mockImplementation((table: unknown) => ({
      values:
        table === systemSettingsTable
          ? jest.fn().mockReturnValue({
              onConflictDoNothing: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([]),
              }),
            })
          : jest.fn().mockResolvedValue(undefined),
    }));
    mockUpdateReturning([]);

    const status = await getUpdateStatus();

    expect(status.updateAvailable).toBe(true);
    expect(dbUpdateMock).toHaveBeenCalledTimes(1);
    expect(dbInsertMock).toHaveBeenCalledTimes(1);
    expect(dbSelectMock).toHaveBeenCalledTimes(1);
  });

  it('records Docker Hub semver webhook pushes and notifies super admins', async () => {
    process.env.TASKNEBULA_VERSION = '1.2.3';
    const cached = cachedState(1 * HOUR_MS, {
      release: {
        latest: '1.2.3',
        htmlUrl: 'https://github.com/neuraparse/taskNebula/releases/tag/v1.2.3',
        publishedAt: '2026-06-01T00:00:00.000Z',
        notes: null,
      },
      docker: null,
    });
    const webhookState: VersionCheckState = {
      release: cached.release,
      docker: {
        repository: DOCKER_HUB_REPOSITORY,
        latestTag: '1.2.4',
        tagUrl: 'https://hub.docker.com/r/neuraparse/tasknebula/tags?name=1.2.4',
        pushedAt: '2026-06-22T16:13:20.000Z',
        digest: null,
        sizeBytes: null,
      },
      fetchedAt: new Date().toISOString(),
    };

    dbSelectMock
      .mockReturnValueOnce(cacheSelectChain([{ value: cached }]))
      .mockReturnValueOnce(cacheSelectChain([{ value: webhookState }]))
      .mockReturnValueOnce(adminsSelectChain([{ id: 'admin-1' }]));

    const versionCheckValues = jest.fn().mockReturnValue({
      onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
    });
    const markerValues = jest.fn().mockReturnValue({
      onConflictDoNothing: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 'marker-1' }]),
      }),
    });
    const notificationValues = jest.fn().mockResolvedValue(undefined);
    dbInsertMock.mockImplementation((table: unknown) => ({
      values: jest.fn((rowOrRows: unknown) => {
        if (table !== systemSettingsTable) return notificationValues(rowOrRows);
        const row = rowOrRows as { key?: string };
        return row.key === UPDATE_NOTIFICATION_KEY
          ? markerValues(rowOrRows)
          : versionCheckValues(rowOrRows);
      }),
    }));

    const result = await handleDockerHubWebhook({
      push_data: {
        pushed_at: 1782144800,
        tag: '1.2.4',
      },
      repository: {
        repo_name: 'tasknebula',
        namespace: 'neuraparse',
        name: 'tasknebula',
      },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      action: 'recorded',
      repository: DOCKER_HUB_REPOSITORY,
      tag: '1.2.4',
      latest: '1.2.4',
      updateAvailable: true,
    });
    expect(versionCheckValues).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'version_check',
        value: expect.objectContaining({
          docker: expect.objectContaining({
            latestTag: '1.2.4',
            pushedAt: '2026-06-22T16:13:20.000Z',
          }),
        }),
      })
    );
    expect(notificationValues).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: 'admin-1',
        actorType: 'system',
        title: 'TaskNebula v1.2.4 is available',
        message: expect.stringContaining('Docker Hub published neuraparse/tasknebula:1.2.4'),
      }),
    ]);
  });

  it('forces a registry refresh for Docker Hub latest-tag webhooks', async () => {
    process.env.TASKNEBULA_VERSION = '9.9.9';
    mockCachedRows([]);
    mockInsertChain();
    fetchMock.mockResolvedValueOnce(githubResponse()).mockResolvedValueOnce(dockerResponse());

    const result = await handleDockerHubWebhook({
      push_data: { pushed_at: 1782144800, tag: 'latest' },
      repository: { repo_name: DOCKER_HUB_REPOSITORY },
    });

    expect(result.action).toBe('refreshed_from_registry');
    expect(fetchMock).toHaveBeenCalledWith(
      DOCKER_HUB_TAGS_URL,
      expect.objectContaining({ cache: 'no-store' })
    );
  });
});
