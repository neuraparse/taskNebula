import { configureApi } from '@/api/client';
import {
  invalidateIssueDerivedQueries,
  invalidateWorkspaceIntegrationQueries,
  qk,
} from './queries';

describe('mobile query invalidation helpers', () => {
  it('namespaces every query key factory by the active self-hosted server', () => {
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: 'authjs.session-token=abc' });
    const factories = qk as unknown as Record<string, (...args: string[]) => readonly unknown[]>;

    for (const [name, makeKey] of Object.entries(factories)) {
      const key = makeKey('sample', 'sample', 'sample');

      expect(Array.isArray(key)).toBe(true);
      expect(key[0]).toBe('https://tasks.example.com');
      expect(key.length).toBeGreaterThanOrEqual(2);
      expect(name).toBeTruthy();
    }
  });

  it('invalidates issue-derived query families only for the active self-hosted server', () => {
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: 'authjs.session-token=abc' });
    const invalidateQueries = jest.fn();

    invalidateIssueDerivedQueries({ invalidateQueries });

    const [{ predicate }] = invalidateQueries.mock.calls[0] ?? [];
    expect(typeof predicate).toBe('function');
    expect(predicate({ queryKey: ['https://tasks.example.com', 'issues', {}] })).toBe(true);
    expect(
      predicate({ queryKey: ['https://tasks.example.com', 'project', 'demo', 'sprints'] }),
    ).toBe(true);
    expect(
      predicate({ queryKey: ['https://tasks.example.com', 'recentActivities', 'org_1'] }),
    ).toBe(true);
    expect(predicate({ queryKey: ['https://other.example.com', 'issues', {}] })).toBe(false);
    expect(predicate({ queryKey: ['https://tasks.example.com', 'docs', 'pages'] })).toBe(false);
  });

  it('invalidates workspace integration queries only for the active self-hosted server', () => {
    configureApi({ baseUrl: 'https://tasks.example.com', cookie: 'authjs.session-token=abc' });
    const invalidateQueries = jest.fn();

    invalidateWorkspaceIntegrationQueries({ invalidateQueries });

    const [{ predicate }] = invalidateQueries.mock.calls[0] ?? [];
    expect(typeof predicate).toBe('function');
    expect(
      predicate({ queryKey: ['https://tasks.example.com', 'workspaceIntegrations', 'org_1'] }),
    ).toBe(true);
    expect(
      predicate({ queryKey: ['https://other.example.com', 'workspaceIntegrations', 'org_1'] }),
    ).toBe(false);
    expect(
      predicate({ queryKey: ['https://tasks.example.com', 'workspaceCommunications', 'org_1'] }),
    ).toBe(false);
  });
});
