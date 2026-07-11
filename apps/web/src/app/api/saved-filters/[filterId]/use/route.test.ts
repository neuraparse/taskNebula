/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

const authMock = jest.fn();
const markSavedFilterUsedForUserMock = jest.fn();

jest.mock('@/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

jest.mock('@/lib/saved-filters/usage', () => ({
  markSavedFilterUsedForUser: (...args: unknown[]) => markSavedFilterUsedForUserMock(...args),
}));

import { POST } from './route';

describe('/api/saved-filters/[filterId]/use route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires authentication', async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(
      new NextRequest('https://tasks.example.com/api/saved-filters/view_1/use', {
        method: 'POST',
      }),
      { params: Promise.resolve({ filterId: 'view_1' }) }
    );

    expect(response.status).toBe(401);
    expect(markSavedFilterUsedForUserMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('increments usage for the authenticated owner scoped by user id', async () => {
    const updated = {
      id: 'view_1',
      userId: 'user_1',
      usageCount: '3',
      lastUsedAt: new Date('2026-06-28T12:00:00.000Z'),
    };

    authMock.mockResolvedValue({ user: { id: 'user_1' } });
    markSavedFilterUsedForUserMock.mockResolvedValue(updated);

    const response = await POST(
      new NextRequest('https://tasks.example.com/api/saved-filters/view_1/use', {
        method: 'POST',
      }),
      { params: Promise.resolve({ filterId: 'view_1' }) }
    );

    expect(response.status).toBe(200);
    expect(markSavedFilterUsedForUserMock).toHaveBeenCalledWith('view_1', 'user_1');
    await expect(response.json()).resolves.toEqual({
      filter: {
        ...updated,
        lastUsedAt: '2026-06-28T12:00:00.000Z',
      },
    });
  });

  it('returns 404 when the filter is not owned by the caller', async () => {
    authMock.mockResolvedValue({ user: { id: 'user_1' } });
    markSavedFilterUsedForUserMock.mockResolvedValue(null);

    const response = await POST(
      new NextRequest('https://tasks.example.com/api/saved-filters/view_2/use', {
        method: 'POST',
      }),
      { params: Promise.resolve({ filterId: 'view_2' }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Filter not found' });
  });
});
