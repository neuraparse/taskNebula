/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

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
const startSelfUpdateMock = jest.fn();
jest.mock('@/lib/version/self-update', () => {
  class SelfUpdateError extends Error {
    status: number;
    reason: string;
    constructor(message: string, status: number, reason: string) {
      super(message);
      this.status = status;
      this.reason = reason;
    }
  }
  return {
    getSelfUpdateStatus: (...args: any[]) => getSelfUpdateStatusMock(...args),
    startSelfUpdate: (...args: any[]) => startSelfUpdateMock(...args),
    SelfUpdateError,
  };
});

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { SelfUpdateError } from '@/lib/version/self-update';

function request(body?: unknown) {
  return new NextRequest('http://localhost/api/admin/version/self-update', {
    method: body === undefined ? 'GET' : 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
  });
}

const updateStatus = {
  current: '0.6.9',
  latest: '0.7.0',
  updateAvailable: true,
  image: { latestTag: '0.7.0', repository: 'neuraparse/tasknebula' },
};

const selfUpdateStatus = {
  enabled: true,
  available: true,
  mode: 'external-webhook',
  blockedReason: null,
  targetVersion: '0.7.0',
  repository: 'neuraparse/tasknebula',
  digest: null,
  webhookConfigured: true,
  manualCommands: 'docker compose pull web',
  job: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  getUpdateStatusMock.mockResolvedValue(updateStatus);
  getSelfUpdateStatusMock.mockResolvedValue(selfUpdateStatus);
  startSelfUpdateMock.mockResolvedValue(selfUpdateStatus);
});

describe('/api/admin/version/self-update', () => {
  it('returns 401 without a session', async () => {
    authMock.mockResolvedValue(null);

    const res = await POST(
      request({ targetVersion: '0.7.0', confirmedVersion: '0.7.0', acknowledged: true })
    );

    expect(res.status).toBe(401);
    expect(startSelfUpdateMock).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-super-admin', async () => {
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    isSuperAdminMock.mockResolvedValue(false);

    const res = await POST(
      request({ targetVersion: '0.7.0', confirmedVersion: '0.7.0', acknowledged: true })
    );

    expect(res.status).toBe(403);
    expect(startSelfUpdateMock).not.toHaveBeenCalled();
  });

  it('returns the current self-update status on GET', async () => {
    authMock.mockResolvedValue({ user: { id: 'admin-1' } });
    isSuperAdminMock.mockResolvedValue(true);

    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(selfUpdateStatus);
    expect(getSelfUpdateStatusMock).toHaveBeenCalledWith(updateStatus);
  });

  it('starts a self-update request for a super admin', async () => {
    authMock.mockResolvedValue({ user: { id: 'admin-1' } });
    isSuperAdminMock.mockResolvedValue(true);

    const res = await POST(
      request({ targetVersion: '0.7.0', confirmedVersion: '0.7.0', acknowledged: true })
    );

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual(selfUpdateStatus);
    expect(startSelfUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        targetVersion: '0.7.0',
        confirmedVersion: '0.7.0',
        acknowledged: true,
        triggeredBy: 'admin-1',
        status: updateStatus,
      })
    );
  });

  it('rejects an invalid request body', async () => {
    authMock.mockResolvedValue({ user: { id: 'admin-1' } });
    isSuperAdminMock.mockResolvedValue(true);

    const res = await POST(
      request({ targetVersion: '', confirmedVersion: '', acknowledged: true })
    );

    expect(res.status).toBe(400);
    expect(startSelfUpdateMock).not.toHaveBeenCalled();
  });

  it('surfaces self-update preflight failures', async () => {
    authMock.mockResolvedValue({ user: { id: 'admin-1' } });
    isSuperAdminMock.mockResolvedValue(true);
    startSelfUpdateMock.mockRejectedValue(
      new SelfUpdateError('Self-update is not available: disabled', 412, 'disabled')
    );

    const res = await POST(
      request({ targetVersion: '0.7.0', confirmedVersion: '0.7.0', acknowledged: true })
    );

    expect(res.status).toBe(412);
    expect(await res.json()).toEqual({
      error: 'Self-update is not available: disabled',
      reason: 'disabled',
    });
  });
});
