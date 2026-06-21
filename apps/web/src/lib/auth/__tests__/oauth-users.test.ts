const findFirstMock = jest.fn();
const selectMock = jest.fn();
const insertMock = jest.fn();
const getRegistrationPolicyMock = jest.fn();

jest.mock('@paralleldrive/cuid2', () => ({
  createId: () => 'generated-user-id',
}));

jest.mock('@tasknebula/db', () => ({
  accounts: {
    provider: 'accounts.provider',
    providerAccountId: 'accounts.providerAccountId',
    userId: 'accounts.userId',
  },
  db: {
    query: {
      users: {
        findFirst: (...args: unknown[]) => findFirstMock(...args),
      },
    },
    select: (...args: unknown[]) => selectMock(...args),
    insert: (...args: unknown[]) => insertMock(...args),
  },
  users: {
    id: 'users.id',
    email: 'users.email',
    name: 'users.name',
    image: 'users.image',
    status: 'users.status',
  },
}));

jest.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => ({ type: 'and', args }),
  eq: (left: unknown, right: unknown) => ({ type: 'eq', left, right }),
}));

jest.mock('@/lib/auth/registration-policy', () => ({
  getRegistrationPolicy: (...args: unknown[]) => getRegistrationPolicyMock(...args),
}));

function selectRows(rows: unknown[]) {
  const builder = {
    from: jest.fn(() => builder),
    innerJoin: jest.fn(() => builder),
    where: jest.fn(() => builder),
    limit: jest.fn().mockResolvedValue(rows),
  };
  return builder;
}

function insertReturning(row: unknown) {
  return {
    values: jest.fn().mockReturnValue({
      onConflictDoNothing: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([row]),
      }),
    }),
  };
}

function insertAccount() {
  return {
    values: jest.fn().mockReturnValue({
      onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
    }),
  };
}

describe('resolveOAuthDatabaseUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRegistrationPolicyMock.mockResolvedValue({ mode: 'allow_registration' });
  });

  it('creates a public OAuth user without organization or admin grants', async () => {
    const { resolveOAuthDatabaseUser } = await import('../oauth-users');
    const userInsert = insertReturning({
      id: 'generated-user-id',
      email: 'new@example.com',
      name: 'New User',
      image: 'https://example.test/avatar.png',
      status: 'active',
    });
    const accountInsert = insertAccount();

    selectMock.mockReturnValueOnce(selectRows([]));
    findFirstMock.mockResolvedValueOnce(null);
    insertMock.mockReturnValueOnce(userInsert).mockReturnValueOnce(accountInsert);

    const result = await resolveOAuthDatabaseUser({
      user: {
        email: ' New@Example.COM ',
        name: 'New User',
        image: 'https://example.test/avatar.png',
      },
      account: {
        type: 'oauth',
        provider: 'github',
        providerAccountId: 'github-123',
      },
    });

    expect(result).toEqual({
      id: 'generated-user-id',
      email: 'new@example.com',
      name: 'New User',
      image: 'https://example.test/avatar.png',
      status: 'active',
    });
    expect(insertMock).toHaveBeenCalledTimes(2);

    const insertedUser = userInsert.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertedUser).toMatchObject({
      id: 'generated-user-id',
      email: 'new@example.com',
      status: 'active',
    });
    expect(insertedUser).not.toHaveProperty('isSuperAdmin');
    expect(insertedUser).not.toHaveProperty('organizationId');
    expect(insertedUser).not.toHaveProperty('role');

    expect(accountInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'generated-user-id',
        provider: 'github',
        providerAccountId: 'github-123',
      })
    );
  });

  it('does not create an OAuth user when public registration is disabled', async () => {
    const { resolveOAuthDatabaseUser } = await import('../oauth-users');
    getRegistrationPolicyMock.mockResolvedValueOnce({ mode: 'invite_only' });
    selectMock.mockReturnValueOnce(selectRows([]));
    findFirstMock.mockResolvedValueOnce(null);

    await expect(
      resolveOAuthDatabaseUser({
        user: { email: 'new@example.com', name: 'New User' },
        account: { type: 'oauth', provider: 'google', providerAccountId: 'google-123' },
      })
    ).resolves.toBeNull();

    expect(insertMock).not.toHaveBeenCalled();
  });
});
