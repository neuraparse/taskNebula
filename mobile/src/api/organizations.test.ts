import { configureApi } from './client';
import {
  addTeamspaceMember,
  assignOrganizationMemberProjects,
  createTeamspace,
  deleteOrganization,
  deleteTeamspace,
  getOrganization,
  inviteOrganizationMember,
  listOrganizations,
  listTeamspaceMembers,
  listTeamspaces,
  removeTeamspaceMember,
  updateOrganization,
  updateTeamspaceMember,
  updateTeamspace,
} from './endpoints';

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

describe('organizations API', () => {
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

  it('lists and normalizes organizations', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        canCreateOrganizations: true,
        organizations: [
          {
            id: 'org_1',
            name: 'Acme',
            slug: 'acme',
            domain: 'acme.test',
            logoUrl: null,
            plan: 'growth',
            status: 'trial',
            role: 'owner',
            createdAt: '2026-06-28T08:00:00.000Z',
          },
          { id: 'invalid' },
        ],
      }),
    );

    await expect(listOrganizations()).resolves.toEqual({
      canCreateOrganizations: true,
      organizations: [
        {
          id: 'org_1',
          name: 'Acme',
          slug: 'acme',
          domain: 'acme.test',
          logoUrl: null,
          plan: 'growth',
          status: 'trial',
          role: 'owner',
          createdAt: '2026-06-28T08:00:00.000Z',
        },
      ],
    });
    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/organizations',
    );
  });

  it('gets, updates, and deletes an organization', async () => {
    const organization = {
      id: 'org_1',
      name: 'Acme',
      slug: 'acme',
      domain: null,
      logoUrl: null,
      plan: 'free',
      status: 'active',
      userRole: 'admin',
      isSuperAdmin: false,
      stats: { members: '3', projects: '2', teams: '1', apiKeys: '4' },
    };
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse(200, organization))
      .mockResolvedValueOnce(jsonResponse(200, { ...organization, name: 'Acme Labs' }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await expect(getOrganization('org_1')).resolves.toEqual({
      id: 'org_1',
      name: 'Acme',
      slug: 'acme',
      domain: null,
      logoUrl: null,
      plan: 'free',
      status: 'active',
      userRole: 'admin',
      isSuperAdmin: false,
      stats: { members: 3, projects: 2, teams: 1, apiKeys: 4 },
    });
    await updateOrganization({
      organizationId: 'org_1',
      name: 'Acme Labs',
      domain: 'acme.test',
      logoUrl: '',
    });
    await deleteOrganization('org_1');

    const [updateUrl, updateInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    const [deleteUrl, deleteInit] = jest.mocked(globalThis.fetch).mock.calls[2] ?? [];

    expect(updateUrl).toBe('https://tasks.example.com/api/organizations/org_1');
    expect(updateInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(updateInit?.body))).toEqual({
      name: 'Acme Labs',
      domain: 'acme.test',
      logoUrl: '',
    });
    expect(deleteUrl).toBe('https://tasks.example.com/api/organizations/org_1');
    expect(deleteInit).toMatchObject({ method: 'DELETE' });
  });

  it('manages teamspaces for an organization', async () => {
    const teamspace = {
      id: 'team_1',
      organizationId: 'org_1',
      name: 'Platform',
      slug: 'platform',
      description: 'Core teamspace',
      avatarUrl: null,
      leadId: 'user_1',
      memberCount: '5',
      projectCount: '2',
      currentUserRole: 'lead',
      isMember: true,
      lead: { id: 'user_1', name: 'Ada', email: 'ada@example.com', image: null },
    };
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse(200, { teams: [teamspace, { id: 'invalid' }] }))
      .mockResolvedValueOnce(jsonResponse(201, { team: teamspace }))
      .mockResolvedValueOnce(jsonResponse(200, { team: { ...teamspace, name: 'Platform Core' } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await expect(listTeamspaces('org_1')).resolves.toEqual([
      {
        id: 'team_1',
        organizationId: 'org_1',
        name: 'Platform',
        slug: 'platform',
        description: 'Core teamspace',
        avatarUrl: null,
        leadId: 'user_1',
        memberCount: 5,
        projectCount: 2,
        currentUserRole: 'lead',
        isMember: true,
        lead: { id: 'user_1', name: 'Ada', email: 'ada@example.com', image: null },
      },
    ]);
    await createTeamspace('org_1', {
      name: 'Platform',
      slug: 'platform',
      description: 'Core teamspace',
      avatarUrl: '',
    });
    await updateTeamspace('org_1', {
      teamspaceId: 'team_1',
      name: 'Platform Core',
      slug: 'platform-core',
      description: '',
    });
    await deleteTeamspace('org_1', 'team_1');

    const [createUrl, createInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    const [updateUrl, updateInit] = jest.mocked(globalThis.fetch).mock.calls[2] ?? [];
    const [deleteUrl, deleteInit] = jest.mocked(globalThis.fetch).mock.calls[3] ?? [];

    expect(createUrl).toBe('https://tasks.example.com/api/organizations/org_1/teams');
    expect(createInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(createInit?.body))).toEqual({
      name: 'Platform',
      slug: 'platform',
      description: 'Core teamspace',
      avatarUrl: '',
    });
    expect(updateUrl).toBe('https://tasks.example.com/api/organizations/org_1/teams/team_1');
    expect(updateInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(updateInit?.body))).toEqual({
      name: 'Platform Core',
      slug: 'platform-core',
      description: '',
    });
    expect(deleteUrl).toBe('https://tasks.example.com/api/organizations/org_1/teams/team_1');
    expect(deleteInit).toMatchObject({ method: 'DELETE' });
  });

  it('manages teamspace members with list, add, update, and remove routes', async () => {
    const team = {
      id: 'team_1',
      organizationId: 'org_1',
      name: 'Platform',
      slug: 'platform',
    };
    const member = {
      id: 'user_1',
      teamRole: 'member',
      joinedAt: '2026-06-28T08:00:00.000Z',
      name: 'Ada',
      email: 'ada@example.com',
      image: null,
      status: 'active',
    };
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse(200, { team, members: [member, { id: 'invalid' }] }))
      .mockResolvedValueOnce(jsonResponse(200, { member: { ...member, id: 'user_2' } }))
      .mockResolvedValueOnce(jsonResponse(200, { member: { ...member, teamRole: 'lead' } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await expect(listTeamspaceMembers('org_1', 'team_1')).resolves.toEqual({
      team,
      members: [member],
    });
    await addTeamspaceMember('org_1', 'team_1', { userId: 'user_2', role: 'member' });
    await updateTeamspaceMember('org_1', 'team_1', { memberId: 'user_1', role: 'lead' });
    await removeTeamspaceMember('org_1', 'team_1', 'user_1');

    const [listUrl] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const [addUrl, addInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    const [updateUrl, updateInit] = jest.mocked(globalThis.fetch).mock.calls[2] ?? [];
    const [removeUrl, removeInit] = jest.mocked(globalThis.fetch).mock.calls[3] ?? [];

    expect(listUrl).toBe('https://tasks.example.com/api/organizations/org_1/teams/team_1/members');
    expect(addUrl).toBe('https://tasks.example.com/api/organizations/org_1/teams/team_1/members');
    expect(addInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(addInit?.body))).toEqual({ userId: 'user_2', role: 'member' });
    expect(updateUrl).toBe(
      'https://tasks.example.com/api/organizations/org_1/teams/team_1/members/user_1',
    );
    expect(updateInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(updateInit?.body))).toEqual({ role: 'lead' });
    expect(removeUrl).toBe(
      'https://tasks.example.com/api/organizations/org_1/teams/team_1/members/user_1',
    );
    expect(removeInit).toMatchObject({ method: 'DELETE' });
  });

  it('invites organization members with project assignments and assigns existing members', async () => {
    const member = {
      id: 'user_1',
      name: 'Ada',
      email: 'ada@example.com',
      role: 'member',
      memberStatus: 'invited',
      status: 'active',
    };
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          member,
          addedToProjects: ['proj_1'],
          skippedProjects: ['proj_2'],
          inviteExpiresInDays: 14,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          addedToProjects: ['proj_3'],
          skippedProjects: [],
        }),
      );

    await expect(
      inviteOrganizationMember('org_1', {
        email: 'ADA@EXAMPLE.COM',
        role: 'member',
        inviteExpiresInDays: 14,
        projectIds: ['proj_1', 'proj_2'],
        projectRole: 'developer',
      }),
    ).resolves.toMatchObject({
      member: { id: 'user_1', email: 'ada@example.com', role: 'member' },
      addedToProjects: ['proj_1'],
      skippedProjects: ['proj_2'],
      inviteExpiresInDays: 14,
    });
    await assignOrganizationMemberProjects('org_1', {
      memberId: 'user_1',
      projectIds: ['proj_3'],
      projectRole: 'tech_lead',
    });

    const [inviteUrl, inviteInit] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    const [assignUrl, assignInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];

    expect(inviteUrl).toBe('https://tasks.example.com/api/organizations/org_1/members');
    expect(inviteInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(inviteInit?.body))).toEqual({
      email: 'ada@example.com',
      role: 'member',
      inviteExpiresInDays: 14,
      projectIds: ['proj_1', 'proj_2'],
      projectRole: 'developer',
    });
    expect(assignUrl).toBe(
      'https://tasks.example.com/api/organizations/org_1/members/user_1/projects',
    );
    expect(assignInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(assignInit?.body))).toEqual({
      projectIds: ['proj_3'],
      projectRole: 'tech_lead',
    });
  });
});
