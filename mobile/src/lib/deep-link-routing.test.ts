import {
  contentIntentFromAuthenticatedAuthIntent,
  contentIntentFromAuthCallbackUrl,
  postAuthIntentFromCallbackUrl,
  projectInviteIntentFromAuthCallbackUrl,
  routeTaskNebulaDeepLink,
} from './deep-link-routing';

describe('deep-link routing', () => {
  it('connects to a different self-hosted server before dispatching auth intents', async () => {
    const order: string[] = [];
    const connectServer = jest.fn(async () => {
      order.push('connect:start');
      await Promise.resolve();
      order.push('connect:end');
    });
    const setPendingAuthIntent = jest.fn(() => {
      order.push('auth');
    });

    await expect(
      routeTaskNebulaDeepLink(
        'tasknebula://auth/oauth?server=https%3A%2F%2Fnew.example.com&provider=github&status=authenticated&token=exchange-1',
        {
          currentServerUrl: 'https://old.example.com',
          connectServer,
          setPendingAuthIntent,
          setPendingContentLink: jest.fn(),
        },
      ),
    ).resolves.toBe(true);

    expect(connectServer).toHaveBeenCalledWith('https://new.example.com');
    expect(setPendingAuthIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'login-oauth',
        serverUrl: 'https://new.example.com',
        token: 'exchange-1',
      }),
    );
    expect(order).toEqual(['connect:start', 'connect:end', 'auth']);
  });

  it('clears stale pending intents after switching self-hosted servers before dispatching content', async () => {
    const order: string[] = [];
    const connectServer = jest.fn(async () => {
      order.push('connect');
    });
    const clearPendingAuthIntent = jest.fn(() => {
      order.push('clear-auth');
    });
    const clearPendingContentLink = jest.fn(() => {
      order.push('clear-content');
    });
    const setPendingContentLink = jest.fn(() => {
      order.push('content');
    });

    await expect(
      routeTaskNebulaDeepLink('https://fresh.example.com/projects/project_1/board', {
        currentServerUrl: 'https://old.example.com',
        connectServer,
        setPendingAuthIntent: jest.fn(),
        setPendingContentLink,
        clearPendingAuthIntent,
        clearPendingContentLink,
      }),
    ).resolves.toBe(true);

    expect(connectServer).toHaveBeenCalledWith('https://fresh.example.com');
    expect(clearPendingAuthIntent).toHaveBeenCalledTimes(1);
    expect(clearPendingContentLink).toHaveBeenCalledTimes(1);
    expect(setPendingContentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'project',
        projectId: 'project_1',
        serverUrl: 'https://fresh.example.com',
      }),
    );
    expect(order).toEqual(['connect', 'clear-auth', 'clear-content', 'content']);
  });

  it('clears stale content intents before dispatching same-server auth callbacks', async () => {
    const order: string[] = [];
    const setPendingAuthIntent = jest.fn(() => {
      order.push('auth');
    });
    const clearPendingContentLink = jest.fn(() => {
      order.push('clear-content');
    });

    await expect(
      routeTaskNebulaDeepLink(
        'tasknebula://auth/oauth?server=https%3A%2F%2Ftasks.example.com&provider=github&status=authenticated&token=exchange-1',
        {
          currentServerUrl: 'https://tasks.example.com',
          connectServer: jest.fn(async () => undefined),
          setPendingAuthIntent,
          setPendingContentLink: jest.fn(),
          clearPendingAuthIntent: jest.fn(),
          clearPendingContentLink,
        },
      ),
    ).resolves.toBe(true);

    expect(clearPendingContentLink).toHaveBeenCalledTimes(1);
    expect(setPendingAuthIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'login-oauth',
        token: 'exchange-1',
      }),
    );
    expect(order).toEqual(['clear-content', 'auth']);
  });

  it('clears stale auth intents before dispatching same-server content links', async () => {
    const order: string[] = [];
    const setPendingContentLink = jest.fn(() => {
      order.push('content');
    });
    const clearPendingAuthIntent = jest.fn(() => {
      order.push('clear-auth');
    });

    await expect(
      routeTaskNebulaDeepLink('https://tasks.example.com/inbox?unread=1', {
        currentServerUrl: 'https://tasks.example.com',
        connectServer: jest.fn(async () => undefined),
        setPendingAuthIntent: jest.fn(),
        setPendingContentLink,
        clearPendingAuthIntent,
        clearPendingContentLink: jest.fn(),
      }),
    ).resolves.toBe(true);

    expect(clearPendingAuthIntent).toHaveBeenCalledTimes(1);
    expect(setPendingContentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'tab',
        tab: 'Inbox',
        inboxUnreadOnly: true,
      }),
    );
    expect(order).toEqual(['clear-auth', 'content']);
  });

  it('dispatches content links without reconnecting when the server already matches', async () => {
    const connectServer = jest.fn(async () => undefined);
    const setPendingContentLink = jest.fn();

    await expect(
      routeTaskNebulaDeepLink('https://tasks.example.com/projects/project_1/board', {
        currentServerUrl: 'https://tasks.example.com',
        connectServer,
        setPendingAuthIntent: jest.fn(),
        setPendingContentLink,
      }),
    ).resolves.toBe(true);

    expect(connectServer).not.toHaveBeenCalled();
    expect(setPendingContentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'project',
        projectId: 'project_1',
        section: 'board',
      }),
    );
  });

  it('connects before dispatching self-hosted root links to the dashboard', async () => {
    const order: string[] = [];
    const connectServer = jest.fn(async () => {
      order.push('connect:start');
      await Promise.resolve();
      order.push('connect:end');
    });
    const setPendingContentLink = jest.fn(() => {
      order.push('content');
    });

    await expect(
      routeTaskNebulaDeepLink('https://fresh.example.com/tr', {
        currentServerUrl: 'https://old.example.com',
        connectServer,
        setPendingAuthIntent: jest.fn(),
        setPendingContentLink,
      }),
    ).resolves.toBe(true);

    expect(connectServer).toHaveBeenCalledWith('https://fresh.example.com');
    expect(setPendingContentLink).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'tab',
        serverUrl: 'https://fresh.example.com',
        tab: 'Dashboard',
      }),
    );
    expect(order).toEqual(['connect:start', 'connect:end', 'content']);
  });

  it('connects setup links without dispatching auth or content intents', async () => {
    const connectServer = jest.fn(async () => undefined);
    const setPendingAuthIntent = jest.fn();
    const setPendingContentLink = jest.fn();
    const clearPendingAuthIntent = jest.fn();
    const clearPendingContentLink = jest.fn();

    await expect(
      routeTaskNebulaDeepLink('https://fresh.example.com/setup', {
        currentServerUrl: null,
        connectServer,
        setPendingAuthIntent,
        setPendingContentLink,
        clearPendingAuthIntent,
        clearPendingContentLink,
      }),
    ).resolves.toBe(true);

    expect(connectServer).toHaveBeenCalledWith('https://fresh.example.com');
    expect(clearPendingAuthIntent).toHaveBeenCalledTimes(1);
    expect(clearPendingContentLink).toHaveBeenCalledTimes(1);
    expect(setPendingAuthIntent).not.toHaveBeenCalled();
    expect(setPendingContentLink).not.toHaveBeenCalled();
  });

  it('connects before dispatching integration OAuth callbacks', async () => {
    const connectServer = jest.fn(async () => undefined);
    const setPendingAuthIntent = jest.fn();

    await expect(
      routeTaskNebulaDeepLink(
        'tasknebula://integrations/oauth?server=https%3A%2F%2Fintegrations.example.com&provider=slack&status=connected',
        {
          currentServerUrl: 'https://tasks.example.com',
          connectServer,
          setPendingAuthIntent,
          setPendingContentLink: jest.fn(),
        },
      ),
    ).resolves.toBe(true);

    expect(connectServer).toHaveBeenCalledWith('https://integrations.example.com');
    expect(setPendingAuthIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'integration-oauth',
        provider: 'slack',
        serverUrl: 'https://integrations.example.com',
        status: 'connected',
      }),
    );
  });

  it('connects before dispatching sign-in project invite links', async () => {
    const connectServer = jest.fn(async () => undefined);
    const setPendingAuthIntent = jest.fn();

    await expect(
      routeTaskNebulaDeepLink(
        'https://invite.example.com/auth/signin?projectInviteToken=project-invite-1',
        {
          currentServerUrl: null,
          connectServer,
          setPendingAuthIntent,
          setPendingContentLink: jest.fn(),
        },
      ),
    ).resolves.toBe(true);

    expect(connectServer).toHaveBeenCalledWith('https://invite.example.com');
    expect(setPendingAuthIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'signin',
        serverUrl: 'https://invite.example.com',
        projectInviteToken: 'project-invite-1',
      }),
    );
  });

  it('does not dispatch intents when switching to a self-hosted server fails', async () => {
    const connectServer = jest.fn(async () => {
      throw new Error('unreachable');
    });
    const setPendingAuthIntent = jest.fn();
    const setPendingContentLink = jest.fn();

    await expect(
      routeTaskNebulaDeepLink(
        'tasknebula://auth/oauth?server=https%3A%2F%2Foffline.example.com&provider=github&status=authenticated&token=exchange-1',
        {
          currentServerUrl: 'https://tasks.example.com',
          connectServer,
          setPendingAuthIntent,
          setPendingContentLink,
        },
      ),
    ).resolves.toBe(false);

    expect(connectServer).toHaveBeenCalledWith('https://offline.example.com');
    expect(setPendingAuthIntent).not.toHaveBeenCalled();
    expect(setPendingContentLink).not.toHaveBeenCalled();
  });

  it('converts same-server auth callback URLs into content intents', () => {
    expect(
      contentIntentFromAuthCallbackUrl(
        '/settings/import?source=plane&projectId=project_1',
        'https://tasks.example.com',
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'screen',
        screen: 'ImportSettings',
        serverUrl: 'https://tasks.example.com',
      }),
    );

    expect(
      contentIntentFromAuthCallbackUrl(
        'https://tasks.example.com/projects/TN/chat',
        'https://tasks.example.com',
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'project',
        projectId: 'TN',
        section: 'chat',
      }),
    );
  });

  it('rejects auth callback URLs outside the active server or auth surface', () => {
    expect(
      contentIntentFromAuthCallbackUrl(
        'https://evil.example.com/projects/TN',
        'https://tasks.example.com',
      ),
    ).toBeNull();
    expect(
      contentIntentFromAuthCallbackUrl(
        '/auth/signin?callbackUrl=/projects/TN',
        'https://tasks.example.com',
      ),
    ).toBeNull();
    expect(contentIntentFromAuthCallbackUrl('/setup', 'https://tasks.example.com')).toBeNull();
  });

  it('converts project invite auth callback URLs into post-auth invite intents', () => {
    expect(
      projectInviteIntentFromAuthCallbackUrl(
        '/join/project/project-invite-1',
        'https://tasks.example.com',
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'signup',
        serverUrl: 'https://tasks.example.com',
        projectInviteToken: 'project-invite-1',
      }),
    );
    expect(
      projectInviteIntentFromAuthCallbackUrl('/settings/sso', 'https://tasks.example.com'),
    ).toBeNull();
  });

  it('converts authenticated sign-in callback intents into content intents', () => {
    expect(
      contentIntentFromAuthenticatedAuthIntent(
        {
          kind: 'signin',
          rawUrl: 'https://tasks.example.com/auth/signin?callbackUrl=%2Fsettings%2Fsso',
          serverUrl: 'https://tasks.example.com',
          callbackUrl: '/settings/sso',
        },
        'https://tasks.example.com',
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'screen',
        screen: 'SsoSettings',
        serverUrl: 'https://tasks.example.com',
      }),
    );

    expect(
      contentIntentFromAuthenticatedAuthIntent(
        {
          kind: 'signin',
          rawUrl: 'https://tasks.example.com/auth/signin?callbackUrl=%2Fprojects%2FTN%2Fchat',
          serverUrl: 'https://tasks.example.com',
          callbackUrl: '/projects/TN/chat',
        },
        'https://tasks.example.com',
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'project',
        projectId: 'TN',
        section: 'chat',
      }),
    );
  });

  it('does not convert authenticated sign-in callbacks for project invites or other origins', () => {
    expect(
      contentIntentFromAuthenticatedAuthIntent(
        {
          kind: 'signin',
          rawUrl: 'https://tasks.example.com/auth/signin?projectInviteToken=invite-1',
          serverUrl: 'https://tasks.example.com',
          projectInviteToken: 'invite-1',
          callbackUrl: '/projects/TN',
        },
        'https://tasks.example.com',
      ),
    ).toBeNull();

    expect(
      contentIntentFromAuthenticatedAuthIntent(
        {
          kind: 'signin',
          rawUrl:
            'https://tasks.example.com/auth/signin?callbackUrl=https%3A%2F%2Fevil.example.com%2Fprojects%2FTN',
          serverUrl: 'https://tasks.example.com',
          callbackUrl: 'https://evil.example.com/projects/TN',
        },
        'https://tasks.example.com',
      ),
    ).toBeNull();
  });

  it('maps authenticated sign-in verification status to the dashboard success notice', () => {
    expect(
      contentIntentFromAuthenticatedAuthIntent(
        {
          kind: 'signin',
          rawUrl: 'https://tasks.example.com/auth/signin?verified=1',
          serverUrl: 'https://tasks.example.com',
          signinStatus: 'verified',
        },
        'https://tasks.example.com',
      ),
    ).toEqual({
      kind: 'tab',
      rawUrl: 'https://tasks.example.com/auth/signin?verified=1',
      serverUrl: 'https://tasks.example.com',
      tab: 'Dashboard',
      dashboardNotice: 'emailVerified',
    });
  });

  it('classifies post-auth callback URLs before queueing navigation', () => {
    expect(
      postAuthIntentFromCallbackUrl('/join/project/invite-1', 'https://tasks.example.com'),
    ).toEqual({
      kind: 'project-invite',
      intent: expect.objectContaining({
        kind: 'signup',
        projectInviteToken: 'invite-1',
      }),
    });

    expect(postAuthIntentFromCallbackUrl('/settings/import', 'https://tasks.example.com')).toEqual({
      kind: 'content',
      intent: expect.objectContaining({
        kind: 'screen',
        screen: 'ImportSettings',
      }),
    });

    expect(
      postAuthIntentFromCallbackUrl(
        'https://evil.example.com/settings/import',
        'https://tasks.example.com',
      ),
    ).toBeNull();
  });
});
