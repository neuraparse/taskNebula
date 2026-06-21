import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { VersionInfo } from '@/lib/hooks/use-version-info';

// next-intl + scrollIntoView are handled by jest.setup.js.

const useVersionInfoMock = jest.fn();
const useRefreshVersionInfoMock = jest.fn();
const useStartSelfUpdateMock = jest.fn();
jest.mock('@/lib/hooks/use-version-info', () => ({
  useVersionInfo: () => useVersionInfoMock(),
  useRefreshVersionInfo: () => useRefreshVersionInfoMock(),
  useStartSelfUpdate: () => useStartSelfUpdateMock(),
}));

const toastMock = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { VersionPanel } from '../version-panel';

function info(overrides: Partial<VersionInfo> = {}): VersionInfo {
  return {
    current: '0.4.0',
    latest: null,
    releaseUpdateAvailable: false,
    updateAvailable: false,
    releaseUrl: null,
    publishedAt: null,
    notes: null,
    checkedAt: null,
    image: {
      repository: 'neuraparse/tasknebula',
      latestTag: null,
      latestTagUrl: null,
      latestPushedAt: null,
      latestDigest: null,
      latestSizeBytes: null,
      updateAvailable: false,
      checkedAt: null,
    },
    checkDisabled: false,
    ...overrides,
  };
}

function mockQuery(overrides: Partial<{ data: VersionInfo; isLoading: boolean; error: unknown }>) {
  useVersionInfoMock.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    ...overrides,
  });
}

const mutate = jest.fn();
const startMutate = jest.fn();
function mockRefresh(overrides: Partial<{ isPending: boolean }> = {}) {
  useRefreshVersionInfoMock.mockReturnValue({
    mutate,
    isPending: false,
    ...overrides,
  });
}

function mockStartUpdate(overrides: Partial<{ isPending: boolean }> = {}) {
  useStartSelfUpdateMock.mockReturnValue({
    mutate: startMutate,
    isPending: false,
    ...overrides,
  });
}

beforeEach(() => {
  useVersionInfoMock.mockReset();
  useRefreshVersionInfoMock.mockReset();
  useStartSelfUpdateMock.mockReset();
  toastMock.mockReset();
  mutate.mockReset();
  startMutate.mockReset();
  mockRefresh();
  mockStartUpdate();
});

describe('VersionPanel', () => {
  it('renders a loading state while the query is in flight', () => {
    mockQuery({ isLoading: true });
    render(<VersionPanel />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders the query error message', () => {
    mockQuery({ error: new Error('Super admin access required') });
    render(<VersionPanel />);
    expect(screen.getByText('Super admin access required')).toBeInTheDocument();
  });

  it('shows current and latest versions with the up-to-date status when current === latest', () => {
    mockQuery({ data: info({ latest: '0.4.0', updateAvailable: false }) });
    render(<VersionPanel />);

    // Both current and latest render as v-prefixed chips.
    const chips = screen.getAllByText('v0.4.0');
    expect(chips.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Up to date')).toBeInTheDocument();
  });

  it('shows the update-available status and how-to-update commands', () => {
    mockQuery({
      data: info({ latest: '0.5.0', updateAvailable: true, notes: 'New stuff' }),
    });
    render(<VersionPanel />);

    expect(screen.getByText('Update available')).toBeInTheDocument();
    expect(screen.getByText('v0.5.0')).toBeInTheDocument();
    expect(screen.getByText('Release notes')).toBeInTheDocument();
    expect(screen.getByText('New stuff')).toBeInTheDocument();
    expect(screen.getByText(/docker compose pull/)).toBeInTheDocument();
    expect(screen.getByText('Self-update')).toBeInTheDocument();
  });

  it('requires acknowledgement before starting an available self-update', async () => {
    const user = userEvent.setup();
    mockQuery({
      data: info({
        latest: '0.5.0',
        updateAvailable: true,
        image: {
          repository: 'neuraparse/tasknebula',
          latestTag: '0.5.0',
          latestTagUrl: 'https://hub.docker.com/r/neuraparse/tasknebula/tags?name=0.5.0',
          latestPushedAt: '2026-06-20T02:13:49.101Z',
          latestDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          latestSizeBytes: 123456789,
          updateAvailable: true,
          checkedAt: '2026-06-20T02:14:00.000Z',
        },
        selfUpdate: {
          enabled: true,
          available: true,
          mode: 'external-webhook',
          blockedReason: null,
          targetVersion: '0.5.0',
          repository: 'neuraparse/tasknebula',
          digest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          webhookConfigured: true,
          manualCommands: 'docker compose pull web',
          job: null,
        },
      }),
    });
    render(<VersionPanel />);

    const startButton = screen.getByRole('button', { name: /Start update to v0.5.0/i });
    expect(startButton).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /I have reviewed the release notes/i }));
    expect(startButton).toBeEnabled();

    await user.click(startButton);
    expect(startMutate).toHaveBeenCalledWith('0.5.0', expect.any(Object));
  });

  it('keeps manual commands visible when self-update is disabled', () => {
    mockQuery({
      data: info({
        latest: '0.5.0',
        updateAvailable: true,
        selfUpdate: {
          enabled: false,
          available: false,
          mode: 'manual',
          blockedReason: 'disabled',
          targetVersion: '0.5.0',
          repository: 'neuraparse/tasknebula',
          digest: null,
          webhookConfigured: false,
          manualCommands: 'docker compose pull web',
          job: null,
        },
      }),
    });
    render(<VersionPanel />);

    expect(screen.getByText('Manual only')).toBeInTheDocument();
    expect(screen.getAllByText(/docker compose pull/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: /Start update/i })).not.toBeInTheDocument();
  });

  it('shows Docker Hub image metadata when available', () => {
    mockQuery({
      data: info({
        latest: '0.5.0',
        updateAvailable: true,
        image: {
          repository: 'neuraparse/tasknebula',
          latestTag: '0.5.0',
          latestTagUrl: 'https://hub.docker.com/r/neuraparse/tasknebula/tags?name=0.5.0',
          latestPushedAt: '2026-06-20T02:13:49.101Z',
          latestDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          latestSizeBytes: 123456789,
          updateAvailable: true,
          checkedAt: '2026-06-20T02:14:00.000Z',
        },
      }),
    });
    render(<VersionPanel />);

    expect(screen.getByText('Docker image')).toBeInTheDocument();
    expect(screen.getAllByText('neuraparse/tasknebula').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Image update available')).toBeInTheDocument();
    expect(screen.getByText('117.7 MB')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View Docker tag/i })).toHaveAttribute(
      'href',
      'https://hub.docker.com/r/neuraparse/tasknebula/tags?name=0.5.0'
    );
  });

  it('renders a View release link only over an https release URL', () => {
    mockQuery({
      data: info({
        latest: '0.5.0',
        updateAvailable: true,
        releaseUrl: 'https://github.com/neuraparse/taskNebula/releases/tag/v0.5.0',
      }),
    });
    render(<VersionPanel />);

    const link = screen.getByRole('link', { name: /View release on GitHub/i });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/neuraparse/taskNebula/releases/tag/v0.5.0'
    );
  });

  it('does not render the View release link for a non-https URL', () => {
    mockQuery({
      data: info({
        latest: '0.5.0',
        updateAvailable: true,
        releaseUrl: 'javascript:alert(1)' as unknown as string,
      }),
    });
    render(<VersionPanel />);

    expect(screen.queryByRole('link', { name: /View release/i })).not.toBeInTheDocument();
  });

  it('shows the checks-disabled state and disables the Check now button', () => {
    mockQuery({ data: info({ checkDisabled: true }) });
    render(<VersionPanel />);

    expect(screen.getByText('Checks disabled')).toBeInTheDocument();
    expect(screen.getByText(/Update checks are disabled/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Check now/i })).toBeDisabled();
  });

  it('hints when no release has been checked yet', () => {
    mockQuery({ data: info({ latest: null, checkDisabled: false }) });
    render(<VersionPanel />);

    expect(screen.getByText(/No release information yet/)).toBeInTheDocument();
    expect(screen.getByText('Not checked yet')).toBeInTheDocument();
  });

  it('triggers a refresh when Check now is clicked', async () => {
    const user = userEvent.setup();
    mockQuery({ data: info({ latest: '0.4.0' }) });
    render(<VersionPanel />);

    await user.click(screen.getByRole('button', { name: /Check now/i }));

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('toasts an update-available message when the refresh finds a newer version', async () => {
    const user = userEvent.setup();
    mockQuery({ data: info({ latest: '0.4.0' }) });
    // Drive the mutation's onSuccess callback directly.
    mutate.mockImplementation((_vars, opts) => {
      opts?.onSuccess?.(info({ latest: '0.5.0', updateAvailable: true }));
    });
    render(<VersionPanel />);

    await user.click(screen.getByRole('button', { name: /Check now/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Update available',
        description: 'TaskNebula v0.5.0 is ready to install.',
      })
    );
  });

  it('toasts an up-to-date message when the refresh finds no newer version', async () => {
    const user = userEvent.setup();
    mockQuery({ data: info({ latest: '0.4.0' }) });
    mutate.mockImplementation((_vars, opts) => {
      opts?.onSuccess?.(info({ latest: '0.4.0', updateAvailable: false }));
    });
    render(<VersionPanel />);

    await user.click(screen.getByRole('button', { name: /Check now/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Up to date',
        description: 'You are running the latest version.',
      })
    );
  });

  it('toasts a destructive error when the refresh fails', async () => {
    const user = userEvent.setup();
    mockQuery({ data: info({ latest: '0.4.0' }) });
    mutate.mockImplementation((_vars, opts) => {
      opts?.onError?.(new Error('Could not reach GitHub'));
    });
    render(<VersionPanel />);

    await user.click(screen.getByRole('button', { name: /Check now/i }));

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Check failed',
        description: 'Could not reach GitHub',
        variant: 'destructive',
      })
    );
  });

  it('shows a checking state and disabled button while a refresh is pending', () => {
    mockQuery({ data: info({ latest: '0.4.0' }) });
    mockRefresh({ isPending: true });
    render(<VersionPanel />);

    const button = screen.getByRole('button', { name: /Checking…/i });
    expect(button).toBeDisabled();
  });
});
