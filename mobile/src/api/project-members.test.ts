import {
  addProjectMember,
  createProjectInviteLink,
  listProjectMembers,
  listProjectInviteLinks,
  removeProjectMember,
  revokeProjectInviteLink,
  updateProjectMember,
} from './endpoints';
import { configureApi } from './client';

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

describe('project members API', () => {
  beforeAll(() => {
    globalThis.fetch = jest.fn() as unknown as typeof fetch;
  });

  beforeEach(() => {
    jest.mocked(globalThis.fetch).mockReset();
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: 'authjs.session-token=abc' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('lists project members with normalized permissions', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'pm_1',
          userId: 'user_1',
          role: 'tech_lead',
          user: {
            id: 'user_1',
            name: 'Ada',
            email: 'ada@example.com',
          },
          permissions: {
            canBrowseProject: true,
            canManageMembers: 'false',
            canChangeRoles: 'true',
          },
        },
      ]),
    );

    await expect(listProjectMembers('project_1')).resolves.toEqual([
      expect.objectContaining({
        id: 'pm_1',
        userId: 'user_1',
        role: 'tech_lead',
        permissions: {
          canBrowseProject: true,
          canManageMembers: false,
          canChangeRoles: true,
        },
      }),
    ]);
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/projects/project_1/members',
    );
  });

  it('adds, updates, resets, and removes project members', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse(201, { id: 'pm_2' }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'pm_2' }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'pm_2' }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await addProjectMember({
      projectId: 'project_1',
      userId: 'user_2',
      role: 'developer',
    });
    await updateProjectMember({
      projectId: 'project_1',
      memberId: 'pm_2',
      role: 'tech_lead',
      permissions: { canBrowseProject: true, canManageMembers: false },
    });
    await updateProjectMember({
      projectId: 'project_1',
      memberId: 'pm_2',
      role: 'developer',
      resetToDefaults: true,
    });
    await removeProjectMember('project_1', 'pm_2');

    const calls = jest.mocked(globalThis.fetch).mock.calls;
    expect(calls[0]?.[0]).toBe('https://tasks.example.com/api/projects/project_1/members');
    expect(calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(calls[0]?.[1]?.body))).toEqual({
      userId: 'user_2',
      role: 'developer',
    });
    expect(calls[1]?.[0]).toBe('https://tasks.example.com/api/projects/project_1/members/pm_2');
    expect(calls[1]?.[1]).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({
      role: 'tech_lead',
      permissions: { canBrowseProject: true, canManageMembers: false },
      resetToDefaults: false,
    });
    expect(JSON.parse(String(calls[2]?.[1]?.body))).toEqual({
      role: 'developer',
      resetToDefaults: true,
    });
    expect(calls[3]?.[0]).toBe('https://tasks.example.com/api/projects/project_1/members/pm_2');
    expect(calls[3]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('lists, creates, and revokes project invite links', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          links: [
            {
              id: 'link_1',
              role: 'viewer',
              maxUses: '5',
              usedCount: 2,
              expiresAt: '2026-07-01T12:00:00.000Z',
              revokedAt: null,
              createdAt: '2026-06-28T12:00:00.000Z',
              createdBy: 'user_1',
              creatorName: 'Ada',
              creatorEmail: 'ada@example.com',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(201, {
          link: {
            id: 'link_2',
            role: 'developer',
            maxUses: 1,
            usedCount: 0,
            expiresAt: '2026-07-05T12:00:00.000Z',
          },
          inviteUrl: 'https://tasks.example.com/join/project/token_1',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          link: {
            id: 'link_2',
            role: 'developer',
            maxUses: 1,
            usedCount: 0,
            expiresAt: '2026-07-05T12:00:00.000Z',
            revokedAt: '2026-06-28T12:30:00.000Z',
          },
        }),
      );

    await expect(listProjectInviteLinks('project_1')).resolves.toEqual([
      expect.objectContaining({
        id: 'link_1',
        role: 'viewer',
        maxUses: 5,
        usedCount: 2,
        creatorName: 'Ada',
      }),
    ]);
    await expect(
      createProjectInviteLink({
        projectId: 'project_1',
        role: 'developer',
        expiresInDays: 7,
        maxUses: 1,
      }),
    ).resolves.toEqual({
      link: expect.objectContaining({ id: 'link_2', role: 'developer' }),
      inviteUrl: 'https://tasks.example.com/join/project/token_1',
    });
    await expect(revokeProjectInviteLink('project_1', 'link_2')).resolves.toEqual(
      expect.objectContaining({ id: 'link_2', revokedAt: '2026-06-28T12:30:00.000Z' }),
    );

    const calls = jest.mocked(globalThis.fetch).mock.calls;
    expect(calls[0]?.[0]).toBe('https://tasks.example.com/api/projects/project_1/invite-links');
    expect(calls[1]?.[0]).toBe('https://tasks.example.com/api/projects/project_1/invite-links');
    expect(calls[1]?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({
      role: 'developer',
      expiresInDays: 7,
      maxUses: 1,
    });
    expect(calls[2]?.[0]).toBe(
      'https://tasks.example.com/api/projects/project_1/invite-links/link_2',
    );
    expect(calls[2]?.[1]).toMatchObject({ method: 'DELETE' });
  });
});
