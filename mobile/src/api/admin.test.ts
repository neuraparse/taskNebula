import {
  getAdminAgentControl,
  getAdminAiUsage,
  getAdminLivekitConfig,
  getAdminSmtpConfig,
  getAdminStats,
  getAdminRealtimeHealth,
  getAdminStorageConfig,
  getAdminVersionStatus,
  getRegistrationPolicy,
  listAdminOrganizations,
  listAdminUsers,
  listAdminFeatureFlags,
  listSystemAuditLogs,
  resetAdminAiUsageCounters,
  testAdminLivekitConfig,
  testAdminSmtpConfig,
  updateAdminAiKillSwitch,
  updateAdminAgentControl,
  updateAdminLivekitConfig,
  updateAdminOrganization,
  updateAdminSmtpConfig,
  updateAdminStorageConfig,
  updateAdminUser,
  updateAdminFeatureFlag,
  updateRegistrationPolicy,
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

describe('admin API', () => {
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

  it('loads and normalizes super-admin stats', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        overview: {
          totalOrganizations: '2',
          totalUsers: 8,
          activeUsers: '6',
          superAdmins: 1,
          totalProjects: '5',
          totalIssues: 21,
          totalComments: '34',
        },
        organizations: {
          byStatus: { active: '2' },
          byPlan: { enterprise: 1 },
        },
        growth: {
          newOrganizations30d: '1',
          newUsers30d: 3,
        },
      }),
    );

    await expect(getAdminStats()).resolves.toEqual({
      overview: {
        totalOrganizations: 2,
        totalUsers: 8,
        activeUsers: 6,
        superAdmins: 1,
        totalProjects: 5,
        totalIssues: 21,
        totalComments: 34,
      },
      organizations: {
        byStatus: { active: 2 },
        byPlan: { enterprise: 1 },
      },
      growth: {
        newOrganizations30d: 1,
        newUsers30d: 3,
      },
    });

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/admin/stats');
  });

  it('lists and updates super-admin organizations and users', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          organizations: [
            {
              id: 'org_1',
              name: 'Acme',
              slug: 'acme',
              plan: 'enterprise',
              status: 'trial',
              domain: 'acme.example.com',
              logoUrl: null,
              stats: { members: '12', projects: '4', issues: '48' },
              owner: {
                id: 'user_1',
                name: 'Ada',
                email: 'ada@example.com',
                image: null,
              },
              createdAt: '2026-06-28T08:00:00.000Z',
            },
            { id: 'missing-name' },
          ],
          pagination: { page: '1', limit: '8', total: '1', totalPages: '1' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          users: [
            {
              id: 'user_1',
              name: 'Ada',
              email: 'ada@example.com',
              image: null,
              status: 'active',
              isSuperAdmin: true,
              superAdminGrantedAt: '2026-06-28T08:00:00.000Z',
              emailVerified: null,
              lastSeenAt: '2026-06-28T09:00:00.000Z',
              organizations: [
                {
                  organizationId: 'org_1',
                  organizationName: 'Acme',
                  role: 'owner',
                },
              ],
              projectMemberships: [
                {
                  projectId: 'project_1',
                  projectKey: 'ACME',
                  projectName: 'Platform',
                  organizationId: 'org_1',
                  organizationName: 'Acme',
                  role: 'admin',
                },
              ],
              lastActivity: {
                action: 'user.updated',
                resourceType: 'user',
                resourceId: 'user_2',
                projectId: null,
                createdAt: '2026-06-28T09:15:00.000Z',
                scope: 'system',
              },
            },
            { id: 'missing-email' },
          ],
          pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'org_1',
          name: 'Acme',
          slug: 'acme',
          plan: 'growth',
          status: 'active',
          domain: null,
          logoUrl: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'user_1',
          name: 'Ada',
          email: 'ada@example.com',
          image: null,
          status: 'inactive',
          isSuperAdmin: false,
          superAdminGrantedAt: null,
          createdAt: '2026-06-28T08:00:00.000Z',
        }),
      );

    await expect(listAdminOrganizations({ limit: 8 })).resolves.toEqual({
      organizations: [
        expect.objectContaining({
          id: 'org_1',
          plan: 'enterprise',
          status: 'trial',
          stats: { members: 12, projects: 4, issues: 48 },
          owner: expect.objectContaining({ email: 'ada@example.com' }),
        }),
      ],
      pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
    });

    await expect(listAdminUsers({ limit: 8 })).resolves.toEqual({
      users: [
        expect.objectContaining({
          id: 'user_1',
          status: 'active',
          isSuperAdmin: true,
          organizations: [
            {
              organizationId: 'org_1',
              organizationName: 'Acme',
              role: 'owner',
            },
          ],
          projectMemberships: [
            expect.objectContaining({
              projectKey: 'ACME',
              role: 'admin',
            }),
          ],
          lastActivity: expect.objectContaining({ scope: 'system' }),
        }),
      ],
      pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
    });

    await expect(
      updateAdminOrganization({ id: 'org_1', plan: 'growth', status: 'active' }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'org_1',
        plan: 'growth',
        status: 'active',
      }),
    );

    await expect(
      updateAdminUser({ id: 'user_1', status: 'inactive', isSuperAdmin: false }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'user_1',
        status: 'inactive',
        isSuperAdmin: false,
      }),
    );

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/admin/organizations?page=1&limit=8',
    );
    expect(jest.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe(
      'https://tasks.example.com/api/admin/users?page=1&limit=8',
    );
    const [orgUrl, orgInit] = jest.mocked(globalThis.fetch).mock.calls[2] ?? [];
    expect(orgUrl).toBe('https://tasks.example.com/api/admin/organizations/org_1');
    expect(orgInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(orgInit?.body))).toEqual({ plan: 'growth', status: 'active' });
    const [userUrl, userInit] = jest.mocked(globalThis.fetch).mock.calls[3] ?? [];
    expect(userUrl).toBe('https://tasks.example.com/api/admin/users/user_1');
    expect(userInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(userInit?.body))).toEqual({
      status: 'inactive',
      isSuperAdmin: false,
    });
  });

  it('reads, updates, and tests system configuration', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          smtp: {
            host: 'smtp.example.com',
            port: '587',
            secure: true,
            user: 'mailer',
            passwordPreview: 'sec_123...',
            emailFrom: 'TaskNebula <noreply@example.com>',
            updatedAt: '2026-06-28T08:00:00.000Z',
            updatedBy: 'user_1',
            configured: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          storage: {
            uploadsDir: '/app/uploads',
            s3Bucket: 'files',
            s3Region: 'eu-central-1',
            s3AccessKey: 'access',
            s3SecretKeyPreview: 'sec_456...',
            updatedAt: null,
            updatedBy: null,
            configured: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          livekit: {
            url: 'wss://livekit.example.com',
            apiKey: 'lk_key',
            apiSecretPreview: 'sec_789...',
            updatedAt: null,
            updatedBy: null,
            configured: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          smtp: {
            host: 'smtp.internal',
            port: 2525,
            secure: false,
            user: 'mailer',
            passwordPreview: 'sec_new...',
            emailFrom: 'TaskNebula <ops@example.com>',
            configured: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          source: 'db',
          messageId: 'msg_1',
          recipient: 'ops@example.com',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          storage: {
            uploadsDir: '/data/uploads',
            s3Bucket: 'files',
            s3Region: 'eu-central-1',
            s3AccessKey: 'access',
            s3SecretKeyPreview: 'sec_456...',
            configured: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          livekit: {
            url: 'wss://livekit.internal',
            apiKey: 'lk_next',
            apiSecretPreview: 'sec_next...',
            configured: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          source: 'db',
          url: 'wss://livekit.internal',
          roomName: 'tn-admin-test-1',
          tokenPreview: 'eyJ...',
        }),
      );

    await expect(getAdminSmtpConfig()).resolves.toEqual(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        secure: true,
        configured: true,
      }),
    );
    await expect(getAdminStorageConfig()).resolves.toEqual(
      expect.objectContaining({
        uploadsDir: '/app/uploads',
        s3Bucket: 'files',
        configured: true,
      }),
    );
    await expect(getAdminLivekitConfig()).resolves.toEqual(
      expect.objectContaining({
        url: 'wss://livekit.example.com',
        apiKey: 'lk_key',
        configured: true,
      }),
    );

    await expect(
      updateAdminSmtpConfig({
        host: 'smtp.internal',
        port: 2525,
        secure: false,
        user: 'mailer',
        password: 'new-secret',
        emailFrom: 'TaskNebula <ops@example.com>',
      }),
    ).resolves.toEqual(expect.objectContaining({ host: 'smtp.internal', port: 2525 }));
    await expect(testAdminSmtpConfig({ to: 'ops@example.com' })).resolves.toEqual(
      expect.objectContaining({ success: true, recipient: 'ops@example.com' }),
    );
    await expect(
      updateAdminStorageConfig({
        uploadsDir: '/data/uploads',
        s3Bucket: 'files',
        s3Region: 'eu-central-1',
        s3AccessKey: 'access',
        s3SecretKey: 'new-secret',
      }),
    ).resolves.toEqual(expect.objectContaining({ uploadsDir: '/data/uploads' }));
    await expect(
      updateAdminLivekitConfig({
        url: 'wss://livekit.internal',
        apiKey: 'lk_next',
        apiSecret: 'new-secret',
      }),
    ).resolves.toEqual(expect.objectContaining({ url: 'wss://livekit.internal' }));
    await expect(testAdminLivekitConfig()).resolves.toEqual(
      expect.objectContaining({ success: true, roomName: 'tn-admin-test-1' }),
    );

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/admin/system/smtp',
    );
    expect(jest.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe(
      'https://tasks.example.com/api/admin/system/storage',
    );
    expect(jest.mocked(globalThis.fetch).mock.calls[2]?.[0]).toBe(
      'https://tasks.example.com/api/admin/system/livekit',
    );
    const [, smtpInit] = jest.mocked(globalThis.fetch).mock.calls[3] ?? [];
    expect(smtpInit).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(String(smtpInit?.body))).toEqual({
      host: 'smtp.internal',
      port: 2525,
      secure: false,
      user: 'mailer',
      password: 'new-secret',
      emailFrom: 'TaskNebula <ops@example.com>',
    });
    const [smtpTestUrl, smtpTestInit] = jest.mocked(globalThis.fetch).mock.calls[4] ?? [];
    expect(smtpTestUrl).toBe('https://tasks.example.com/api/admin/system/smtp/test');
    expect(smtpTestInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(smtpTestInit?.body))).toEqual({ to: 'ops@example.com' });
    const [, storageInit] = jest.mocked(globalThis.fetch).mock.calls[5] ?? [];
    expect(storageInit).toMatchObject({ method: 'PUT' });
    const [, livekitInit] = jest.mocked(globalThis.fetch).mock.calls[6] ?? [];
    expect(livekitInit).toMatchObject({ method: 'PUT' });
    expect(jest.mocked(globalThis.fetch).mock.calls[7]?.[0]).toBe(
      'https://tasks.example.com/api/admin/system/livekit/test',
    );
  });

  it('reads and updates the registration policy', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          registration: {
            mode: 'invite_only',
            updatedAt: '2026-06-28T08:00:00.000Z',
            updatedBy: 'user_1',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          registration: {
            mode: 'admin_created_only',
            updatedAt: '2026-06-28T09:00:00.000Z',
          },
        }),
      );

    await expect(getRegistrationPolicy()).resolves.toEqual({
      mode: 'invite_only',
      updatedAt: '2026-06-28T08:00:00.000Z',
      updatedBy: 'user_1',
    });

    await expect(updateRegistrationPolicy('admin_created_only')).resolves.toEqual({
      mode: 'admin_created_only',
      updatedAt: '2026-06-28T09:00:00.000Z',
    });

    const [, updateInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(jest.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe(
      'https://tasks.example.com/api/admin/system/registration',
    );
    expect(updateInit).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(String(updateInit?.body))).toEqual({ mode: 'admin_created_only' });
  });

  it('loads version status with forced refresh support', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        current: '0.7.11',
        latest: '0.7.12',
        releaseUpdateAvailable: true,
        updateAvailable: true,
        releaseUrl: 'https://github.com/neuraparse/taskNebula/releases/tag/v0.7.12',
        publishedAt: '2026-06-28T08:00:00.000Z',
        checkedAt: '2026-06-28T08:05:00.000Z',
        image: {
          repository: 'neuraparse/tasknebula',
          latestTag: '0.7.12',
          latestSizeBytes: '1234',
          updateAvailable: true,
          checkedAt: '2026-06-28T08:05:00.000Z',
        },
        checkDisabled: false,
        selfUpdate: {
          enabled: true,
          available: false,
          mode: 'manual',
          blockedReason: 'missing_webhook',
          repository: 'neuraparse/tasknebula',
          webhookConfigured: false,
          manualCommands: 'docker compose pull web',
        },
      }),
    );

    await expect(getAdminVersionStatus({ refresh: true })).resolves.toEqual(
      expect.objectContaining({
        current: '0.7.11',
        latest: '0.7.12',
        updateAvailable: true,
        image: expect.objectContaining({
          latestSizeBytes: 1234,
          updateAvailable: true,
        }),
        selfUpdate: expect.objectContaining({
          blockedReason: 'missing_webhook',
          manualCommands: 'docker compose pull web',
        }),
      }),
    );

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/admin/version?refresh=true');
  });

  it('loads AI usage and controls the cost guard', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          generatedAt: '2026-06-28T10:00:00.000Z',
          windowDays: '14',
          dayStart: '2026-06-28T00:00:00.000Z',
          monthStart: '2026-06-01T00:00:00.000Z',
          organizations: [
            {
              organizationId: 'org_1',
              organizationName: 'Acme',
              limits: {
                dailyTokens: '1000',
                monthlyTokens: '30000',
                dailyCostUsd: '5.5',
                monthlyCostUsd: null,
              },
              reservedUsage: {
                dailyTokens: '120',
                monthlyTokens: '900',
                dailyCostUsd: '0.44',
                monthlyCostUsd: '3.25',
              },
              actualUsage: {
                callsToday: '4',
                callsMonth: 22,
                tokensToday: '120',
                tokensMonth: '900',
                costTodayUsd: '0.44',
                costMonthUsd: '3.25',
                budgetExhaustedMonth: '1',
                errorsMonth: '2',
              },
              killSwitchEnabled: true,
              periodResetsAt: '2026-06-29T00:00:00.000Z',
              history: [
                { day: '2026-06-28T00:00:00.000Z', calls: '4', tokens: '120', cost: '0.44' },
              ],
              featureBreakdown: [{ feature: 'ask', calls: '4', tokens: '120', cost: '0.44' }],
            },
            { organizationName: 'Missing id' },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ok: true,
          organizationId: 'org_1',
          killSwitchEnabled: false,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ok: true,
          scope: 'daily',
          organizationId: 'org_1',
        }),
      );

    await expect(getAdminAiUsage({ days: 14 })).resolves.toEqual(
      expect.objectContaining({
        generatedAt: '2026-06-28T10:00:00.000Z',
        windowDays: 14,
        organizations: [
          expect.objectContaining({
            organizationId: 'org_1',
            organizationName: 'Acme',
            limits: {
              dailyTokens: 1000,
              monthlyTokens: 30000,
              dailyCostUsd: 5.5,
              monthlyCostUsd: null,
            },
            reservedUsage: expect.objectContaining({
              dailyTokens: 120,
              monthlyCostUsd: 3.25,
            }),
            actualUsage: expect.objectContaining({
              callsToday: 4,
              tokensMonth: 900,
              budgetExhaustedMonth: 1,
            }),
            killSwitchEnabled: true,
            history: [{ day: '2026-06-28', calls: 4, tokens: 120, cost: 0.44 }],
            featureBreakdown: [{ feature: 'ask', calls: 4, tokens: 120, cost: 0.44 }],
          }),
        ],
      }),
    );

    await expect(
      updateAdminAiKillSwitch({
        organizationId: 'org_1',
        enabled: false,
        reason: 'mobile',
      }),
    ).resolves.toEqual({
      ok: true,
      organizationId: 'org_1',
      killSwitchEnabled: false,
    });

    await expect(
      resetAdminAiUsageCounters({ organizationId: 'org_1', scope: 'daily' }),
    ).resolves.toEqual({
      ok: true,
      scope: 'daily',
      organizationId: 'org_1',
    });

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/admin/ai-usage?days=14',
    );
    const [toggleUrl, toggleInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(toggleUrl).toBe('https://tasks.example.com/api/admin/ai-usage/kill-switch');
    expect(toggleInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(toggleInit?.body))).toEqual({
      organizationId: 'org_1',
      enabled: false,
      reason: 'mobile',
    });
    const [resetUrl, resetInit] = jest.mocked(globalThis.fetch).mock.calls[2] ?? [];
    expect(resetUrl).toBe('https://tasks.example.com/api/admin/ai-usage/reset-counters');
    expect(resetInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(resetInit?.body))).toEqual({
      organizationId: 'org_1',
      scope: 'daily',
    });
  });

  it('loads and updates the agent control center', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          settings: {
            globalEnabled: true,
            allowWriteActions: false,
            requireSupervisionForAutoMode: true,
            maxConcurrentRuns: '9',
          },
          stats: {
            enabledWorkspaceCount: '3',
            enabledProjectCount: 7,
            recentRunCount: '12',
            runningRuns: '2',
            failedRuns: '1',
            readyWorkspaceCount: '2',
            blockedWorkspaceCount: '1',
          },
          serviceStatus: [
            {
              key: 'control-plane',
              label: 'Control plane',
              state: 'ready',
              detail: 'Agent execution is enabled.',
            },
          ],
          providerBreakdown: {
            openai: {
              total: '3',
              enabled: '2',
              ready: '1',
              blocked: '1',
            },
          },
          workspaceCoverage: [
            {
              organizationId: 'org_1',
              organizationName: 'Acme',
              workspaceEnabled: true,
              enabledProjects: '4',
              provider: 'openai',
              model: 'gpt-5',
              selectedModelConfigId: 'model_1',
              selectedModelConfigName: 'Production OpenAI',
              executionMode: 'assistive',
              providerStatus: {
                ready: false,
                summary: 'Missing credential',
                configured: false,
                source: null,
                label: null,
                updatedAt: null,
              },
              lastRunAt: '2026-06-28T10:00:00.000Z',
              lastFailure: 'Missing credential',
            },
            { organizationName: 'Missing id' },
          ],
          recentRuns: [
            {
              id: 'run_1',
              kind: 'backlog_triage',
              status: 'failed',
              dryRun: true,
              summary: 'Checked backlog',
              writeActionsCount: '3',
              createdAt: '2026-06-28T10:05:00.000Z',
              error: 'Provider blocked',
              organizationId: 'org_1',
              organizationName: 'Acme',
              projectId: 'project_1',
              projectName: 'Platform',
              initiatedBy: 'Ada',
            },
            { kind: 'missing-id' },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          settings: {
            globalEnabled: false,
            allowWriteActions: true,
            requireSupervisionForAutoMode: false,
            maxConcurrentRuns: 4,
          },
        }),
      );

    await expect(getAdminAgentControl()).resolves.toEqual(
      expect.objectContaining({
        settings: {
          globalEnabled: true,
          allowWriteActions: false,
          requireSupervisionForAutoMode: true,
          maxConcurrentRuns: 9,
        },
        stats: expect.objectContaining({
          enabledWorkspaceCount: 3,
          enabledProjectCount: 7,
          runningRuns: 2,
          blockedWorkspaceCount: 1,
        }),
        serviceStatus: [
          expect.objectContaining({
            key: 'control-plane',
            state: 'ready',
          }),
        ],
        providerBreakdown: [
          {
            provider: 'openai',
            total: 3,
            enabled: 2,
            ready: 1,
            blocked: 1,
          },
        ],
        workspaceCoverage: [
          expect.objectContaining({
            organizationId: 'org_1',
            enabledProjects: 4,
            providerStatus: expect.objectContaining({ ready: false }),
          }),
        ],
        recentRuns: [
          expect.objectContaining({
            id: 'run_1',
            dryRun: true,
            writeActionsCount: 3,
          }),
        ],
      }),
    );

    await expect(
      updateAdminAgentControl({
        globalEnabled: false,
        allowWriteActions: true,
        requireSupervisionForAutoMode: false,
        maxConcurrentRuns: 4,
      }),
    ).resolves.toEqual({
      globalEnabled: false,
      allowWriteActions: true,
      requireSupervisionForAutoMode: false,
      maxConcurrentRuns: 4,
    });

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/admin/agent-control',
    );
    const [updateUrl, updateInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(updateUrl).toBe('https://tasks.example.com/api/admin/agent-control');
    expect(updateInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(updateInit?.body))).toEqual({
      globalEnabled: false,
      allowWriteActions: true,
      requireSupervisionForAutoMode: false,
      maxConcurrentRuns: 4,
    });
  });

  it('lists and updates super-admin feature flags', async () => {
    jest
      .mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, {
          featureFlags: [
            {
              id: 'flag_1',
              key: 'mobile_admin',
              name: 'Mobile admin',
              description: 'Expose admin controls on mobile',
              isEnabled: true,
              enabledForPlans: ['enterprise'],
              enabledForOrganizations: ['org_1'],
              rolloutPercentage: '25',
              metadata: { owner: 'platform' },
              createdBy: 'user_1',
              updatedBy: null,
              createdAt: '2026-06-28T08:00:00.000Z',
            },
            { id: 'missing-key' },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'flag_1',
          key: 'mobile_admin',
          name: 'Mobile admin',
          description: null,
          isEnabled: false,
          enabledForPlans: [],
          enabledForOrganizations: [],
          rolloutPercentage: 0,
          metadata: {},
          createdBy: 'user_1',
          updatedBy: 'user_2',
        }),
      );

    await expect(listAdminFeatureFlags()).resolves.toEqual([
      expect.objectContaining({
        id: 'flag_1',
        key: 'mobile_admin',
        isEnabled: true,
        enabledForPlans: ['enterprise'],
        enabledForOrganizations: ['org_1'],
        rolloutPercentage: 25,
        metadata: { owner: 'platform' },
      }),
    ]);

    await expect(
      updateAdminFeatureFlag({ id: 'flag_1', isEnabled: false, rolloutPercentage: 0 }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'flag_1',
        isEnabled: false,
        rolloutPercentage: 0,
      }),
    );

    expect(jest.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe(
      'https://tasks.example.com/api/admin/feature-flags',
    );
    const [url, updateInit] = jest.mocked(globalThis.fetch).mock.calls[1] ?? [];
    expect(url).toBe('https://tasks.example.com/api/admin/feature-flags/flag_1');
    expect(updateInit).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(updateInit?.body))).toEqual({
      isEnabled: false,
      rolloutPercentage: 0,
    });
  });

  it('loads realtime health diagnostics', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        services: {
          redis: {
            ready: false,
            mode: 'in_memory_fallback',
          },
          livekit: {
            ready: false,
            url: null,
            missing: ['LIVEKIT_URL', 'LIVEKIT_API_KEY'],
          },
        },
        stats: {
          channels: '3',
          rooms: 4,
          activeCalls: '1',
          readStates: 9,
        },
      }),
    );

    await expect(getAdminRealtimeHealth()).resolves.toEqual({
      services: {
        redis: {
          ready: false,
          mode: 'in_memory_fallback',
        },
        livekit: {
          ready: false,
          url: null,
          missing: ['LIVEKIT_URL', 'LIVEKIT_API_KEY'],
        },
      },
      stats: {
        channels: 3,
        rooms: 4,
        activeCalls: 1,
        readStates: 9,
      },
    });

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/admin/realtime-health');
  });

  it('lists system audit logs', async () => {
    jest.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, {
        auditLogs: [
          {
            id: 'sys_1',
            action: 'system.registration_policy_updated',
            resourceType: 'system_setting',
            resourceId: 'registration_policy',
            organizationId: null,
            changes: { mode: { from: 'allow_registration', to: 'invite_only' } },
            metadata: null,
            ipAddress: '127.0.0.1',
            createdAt: '2026-06-28T08:00:00.000Z',
            user: {
              id: 'user_1',
              name: 'Ada',
              email: 'ada@example.com',
              image: null,
            },
          },
          { id: 'missing-action' },
        ],
      }),
    );

    await expect(listSystemAuditLogs({ limit: 25 })).resolves.toEqual([
      expect.objectContaining({
        id: 'sys_1',
        action: 'system.registration_policy_updated',
        resourceType: 'system_setting',
        resourceId: 'registration_policy',
        ipAddress: '127.0.0.1',
      }),
    ]);

    const [url] = jest.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://tasks.example.com/api/admin/audit-logs?limit=25');
  });
});
