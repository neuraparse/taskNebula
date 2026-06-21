/**
 * @jest-environment node
 *
 * Tests for GET /api/admin/version — the super-admin update-status endpoint.
 * Auth, super-admin gating, and the UpdateStatus passthrough are mocked at
 * the module boundary (no real DB or GitHub access).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

// ---- Mocks must be declared before the route import ----

const authMock = jest.fn();
jest.mock('@/auth', () => ({ auth: (...args: any[]) => authMock(...args) }));

const isSuperAdminMock = jest.fn();
jest.mock('@/lib/auth/permissions', () => ({
  isSuperAdmin: (...args: any[]) => isSuperAdminMock(...args),
}));

const getUpdateStatusMock = jest.fn();
jest.mock('@/lib/version', () => ({
  getUpdateStatus: (...args: any[]) => getUpdateStatusMock(...args),
}));

const getSelfUpdateStatusMock = jest.fn();
jest.mock('@/lib/version/self-update', () => ({
  getSelfUpdateStatus: (...args: any[]) => getSelfUpdateStatusMock(...args),
}));

import { NextRequest } from 'next/server';
import { GET } from '../route';
import type { UpdateStatus } from '@/lib/version';

function request(url = 'http://localhost/api/admin/version') {
  return new NextRequest(url);
}

const upToDateStatus: UpdateStatus = {
  current: '0.4.0',
  latest: '0.4.0',
  releaseUpdateAvailable: false,
  updateAvailable: false,
  releaseUrl: null,
  publishedAt: '2026-06-01T00:00:00.000Z',
  notes: null,
  checkedAt: '2026-06-12T08:00:00.000Z',
  image: {
    repository: 'neuraparse/tasknebula',
    latestTag: '0.4.0',
    latestTagUrl: 'https://hub.docker.com/r/neuraparse/tasknebula/tags?name=0.4.0',
    latestPushedAt: '2026-06-01T00:00:00.000Z',
    latestDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    latestSizeBytes: 123456789,
    updateAvailable: false,
    checkedAt: '2026-06-12T08:00:00.000Z',
  },
  checkDisabled: false,
};

const selfUpdateStatus = {
  enabled: false,
  available: false,
  mode: 'manual',
  blockedReason: 'disabled',
  targetVersion: null,
  repository: 'neuraparse/tasknebula',
  digest: null,
  webhookConfigured: false,
  manualCommands: 'docker compose pull web',
  job: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  getSelfUpdateStatusMock.mockResolvedValue(selfUpdateStatus);
});

describe('GET /api/admin/version', () => {
  it('returns 401 when there is no session', async () => {
    authMock.mockResolvedValue(null);

    const res = await GET(request());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(isSuperAdminMock).not.toHaveBeenCalled();
    expect(getUpdateStatusMock).not.toHaveBeenCalled();
  });

  it('returns 403 for an authenticated non-super-admin', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    isSuperAdminMock.mockResolvedValue(false);

    const res = await GET(request());

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Super admin access required' });
    expect(getUpdateStatusMock).not.toHaveBeenCalled();
  });

  it('returns the UpdateStatus shape for a super admin', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    isSuperAdminMock.mockResolvedValue(true);
    getUpdateStatusMock.mockResolvedValue(upToDateStatus);

    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...upToDateStatus, selfUpdate: selfUpdateStatus });
    // Default (no ?refresh) → honor the server-side cache TTL.
    expect(getUpdateStatusMock).toHaveBeenCalledWith({ refresh: false });
    expect(getSelfUpdateStatusMock).toHaveBeenCalledWith(upToDateStatus);
  });

  it('forwards ?refresh=true to getUpdateStatus', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    isSuperAdminMock.mockResolvedValue(true);
    getUpdateStatusMock.mockResolvedValue({ ...upToDateStatus, updateAvailable: true });

    const res = await GET(request('http://localhost/api/admin/version?refresh=true'));

    expect(res.status).toBe(200);
    expect(getUpdateStatusMock).toHaveBeenCalledWith({ refresh: true });
  });

  it('treats any non-"true" refresh value as no refresh', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    isSuperAdminMock.mockResolvedValue(true);
    getUpdateStatusMock.mockResolvedValue(upToDateStatus);

    await GET(request('http://localhost/api/admin/version?refresh=1'));

    expect(getUpdateStatusMock).toHaveBeenCalledWith({ refresh: false });
  });
});
