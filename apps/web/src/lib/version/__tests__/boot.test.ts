/**
 * Tests for src/lib/version/boot — boot-time version-change detection.
 *
 * Pins the idempotency contract: super admins are notified only when the
 * conditional UPDATE on `last_boot_version` actually changed a row, the
 * first-ever boot seeds silently, and DB failures never throw.
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

import {
  systemSettings as systemSettingsTable,
  notifications as notificationsTable,
} from '@tasknebula/db';
import { handleBootVersionChange } from '../boot';

type CapturedInsert = { table: unknown; rows: unknown };
let inserts: CapturedInsert[] = [];

/** db.select({...}).from(...).where(...).limit(1) → rows (last_boot_version read) */
function prevVersionChain(rows: Array<{ value: unknown }>) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

/** db.select({...}).from(users).where(...) → rows (super admin enumeration) */
function adminsChain(rows: Array<{ id: string }>) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(rows),
    }),
  };
}

/** db.update(...).set(...).where(...).returning(...) → rows */
function mockUpdateReturning(rows: Array<{ id: string }>) {
  dbUpdateMock.mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  inserts = [];
  process.env.TASKNEBULA_VERSION = '9.9.9';

  // Insert chain that records (table, rows) and supports both
  // `await .values(...)` and `await .values(...).onConflictDoNothing(...)`.
  dbInsertMock.mockImplementation((table: unknown) => ({
    values: jest.fn().mockImplementation((rows: unknown) => {
      inserts.push({ table, rows });
      const promise = Promise.resolve(undefined) as Promise<undefined> & {
        onConflictDoNothing: jest.Mock;
      };
      promise.onConflictDoNothing = jest.fn().mockResolvedValue(undefined);
      return promise;
    }),
  }));
});

afterEach(() => {
  delete process.env.TASKNEBULA_VERSION;
});

describe('handleBootVersionChange', () => {
  it('notifies every super admin when the version transition wins the conditional update', async () => {
    dbSelectMock
      .mockReturnValueOnce(prevVersionChain([{ value: { version: '9.9.8' } }]))
      .mockReturnValueOnce(adminsChain([{ id: 'admin-1' }, { id: 'admin-2' }]));
    mockUpdateReturning([{ id: 'setting-1' }]);

    await handleBootVersionChange();

    const notificationInserts = inserts.filter((i) => i.table === notificationsTable);
    expect(notificationInserts).toHaveLength(1);
    const rows = notificationInserts[0].rows as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.userId)).toEqual(['admin-1', 'admin-2']);
    for (const row of rows) {
      expect(row.type).toBe('issue_updated');
      expect(row.actorType).toBe('system');
      expect(row.title).toBe('TaskNebula updated to v9.9.9');
      expect(row.message).toContain('previously v9.9.8');
      expect(row.message).toContain('/admin?tab=updates');
      expect(row.message).toContain('https://github.com/neuraparse/taskNebula/releases/tag/v9.9.9');
    }
    // No baseline re-seed when the update already changed the row.
    expect(inserts.filter((i) => i.table === systemSettingsTable)).toHaveLength(0);
  });

  it('does NOT notify when the conditional update matched no row (same version / lost race)', async () => {
    dbSelectMock.mockReturnValueOnce(prevVersionChain([{ value: { version: '9.9.9' } }]));
    mockUpdateReturning([]);

    await handleBootVersionChange();

    expect(inserts.filter((i) => i.table === notificationsTable)).toHaveLength(0);
    // Baseline upsert path runs (ON CONFLICT DO NOTHING makes it a no-op).
    const settingInserts = inserts.filter((i) => i.table === systemSettingsTable);
    expect(settingInserts).toHaveLength(1);
    expect(settingInserts[0].rows).toEqual(
      expect.objectContaining({
        key: 'last_boot_version',
        value: expect.objectContaining({ version: '9.9.9' }),
      })
    );
  });

  it('seeds the baseline silently on first-ever boot', async () => {
    dbSelectMock.mockReturnValueOnce(prevVersionChain([]));
    mockUpdateReturning([]); // no row to update yet

    await handleBootVersionChange();

    expect(inserts.filter((i) => i.table === notificationsTable)).toHaveLength(0);
    expect(inserts.filter((i) => i.table === systemSettingsTable)).toHaveLength(1);
  });

  it('skips notification inserts when there are no super admins', async () => {
    dbSelectMock
      .mockReturnValueOnce(prevVersionChain([{ value: { version: '9.9.8' } }]))
      .mockReturnValueOnce(adminsChain([]));
    mockUpdateReturning([{ id: 'setting-1' }]);

    await handleBootVersionChange();

    expect(inserts).toHaveLength(0);
  });

  it('never throws when the database is unavailable', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    dbSelectMock.mockImplementation(() => {
      throw new Error('connection refused');
    });

    await expect(handleBootVersionChange()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
