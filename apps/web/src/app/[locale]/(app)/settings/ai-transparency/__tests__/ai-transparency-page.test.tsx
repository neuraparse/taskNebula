import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/auth/permissions', () => ({
  hasPermission: jest.fn(),
}));

jest.mock('../ai-transparency-client', () => ({
  AiTransparencyClient: () => <div data-testid="ai-transparency-client" />,
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

jest.mock('drizzle-orm', () => ({
  and: jest.fn((...conditions: unknown[]) => ({ conditions })),
  eq: jest.fn((left: unknown, right: unknown) => ({ left, right })),
}));

jest.mock('@tasknebula/db', () => {
  const limit = jest.fn();
  return {
    __mockLimit: limit,
    db: {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit,
          })),
        })),
      })),
    },
    organizationMembers: {
      organizationId: 'organizationMembers.organizationId',
      userId: 'organizationMembers.userId',
      status: 'organizationMembers.status',
    },
  };
});

describe('AiTransparencyPage permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const authModule = jest.requireMock('@/auth') as { auth: jest.Mock };
    const permissionsModule = jest.requireMock('@/lib/auth/permissions') as {
      hasPermission: jest.Mock;
    };
    const dbModule = jest.requireMock('@tasknebula/db') as { __mockLimit: jest.Mock };

    authModule.auth.mockResolvedValue({ user: { id: 'user-1' } });
    permissionsModule.hasPermission.mockResolvedValue(true);
    dbModule.__mockLimit.mockResolvedValue([{ organizationId: 'org-1' }]);
  });

  async function renderPage() {
    const { default: AiTransparencyPage } = await import('../page');
    const element = await AiTransparencyPage();
    return render(element as ReactElement);
  }

  it('renders the transparency client for users with org settings permission', async () => {
    await renderPage();

    expect(screen.getByTestId('ai-transparency-client')).toBeInTheDocument();
  });

  it('redirects anonymous users to signin', async () => {
    const authModule = jest.requireMock('@/auth') as { auth: jest.Mock };
    authModule.auth.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow(
      'redirect:/auth/signin?callbackUrl=/settings/ai-transparency'
    );
  });

  it('redirects users without org settings permission', async () => {
    const permissionsModule = jest.requireMock('@/lib/auth/permissions') as {
      hasPermission: jest.Mock;
    };
    permissionsModule.hasPermission.mockResolvedValue(false);

    await expect(renderPage()).rejects.toThrow('redirect:/dashboard?error=insufficient-permission');
  });
});
