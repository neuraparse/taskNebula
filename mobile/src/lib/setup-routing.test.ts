import { contentIntentFromSetupResult } from './setup-routing';

describe('setup routing', () => {
  it('uses the setup nextPath when it points at content on the configured server', () => {
    expect(
      contentIntentFromSetupResult(
        {
          success: true,
          nextPath: '/settings/import?source=plane&projectId=project_1',
          startMode: 'import',
          import: { source: 'jira', projectId: 'legacy_project', projectKey: 'OLD' },
        },
        'https://tasks.example.com',
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'screen',
        serverUrl: 'https://tasks.example.com',
        screen: 'ImportSettings',
        importSource: 'plane',
        importProjectId: 'project_1',
      }),
    );
  });

  it('maps blank setup dashboard redirects through the content deep-link parser', () => {
    expect(
      contentIntentFromSetupResult(
        { success: true, nextPath: '/dashboard', startMode: 'blank' },
        'https://tasks.example.com',
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'tab',
        serverUrl: 'https://tasks.example.com',
        tab: 'Dashboard',
      }),
    );
  });

  it('falls back to the legacy import payload when nextPath is unavailable', () => {
    expect(
      contentIntentFromSetupResult(
        {
          success: true,
          startMode: 'import',
          import: { source: 'github', projectId: 'project_2', projectKey: 'GH' },
        },
        'https://tasks.example.com',
      ),
    ).toEqual({
      kind: 'screen',
      rawUrl: 'https://tasks.example.com/settings/import?source=github&projectId=project_2',
      serverUrl: 'https://tasks.example.com',
      screen: 'ImportSettings',
      importSource: 'github',
      importProjectId: 'project_2',
    });
  });

  it('rejects setup redirects outside the configured server', () => {
    expect(
      contentIntentFromSetupResult(
        {
          success: true,
          nextPath: 'https://evil.example.com/settings/import?source=plane&projectId=project_1',
        },
        'https://tasks.example.com',
      ),
    ).toBeNull();
  });
});
