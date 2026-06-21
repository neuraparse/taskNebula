import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { VersionInfo } from '@/lib/hooks/use-version-info';

// next-intl is mocked globally in jest.setup.js.

const useVersionPollMock = jest.fn();
jest.mock('@/lib/hooks/use-version-poll', () => ({
  useVersionPoll: () => useVersionPollMock(),
}));

import { VersionUpdateBanner } from '../version-update-banner';

const DISMISS_STORAGE_KEY = 'tasknebula-update-banner-dismissed';

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

function mockData(data: VersionInfo | undefined) {
  useVersionPollMock.mockReturnValue({ data });
}

beforeEach(() => {
  useVersionPollMock.mockReset();
  window.localStorage.clear();
});

describe('VersionUpdateBanner', () => {
  it('renders nothing while there is no version data', () => {
    mockData(undefined);
    const { container } = render(<VersionUpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no update is available', async () => {
    mockData(info({ latest: '0.4.0', updateAvailable: false }));
    const { container } = render(<VersionUpdateBanner />);
    // Allow the hydration effect to run.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows the banner when an update is available', async () => {
    mockData(info({ latest: '0.5.0', updateAvailable: true }));
    render(<VersionUpdateBanner />);

    expect(await screen.findByText('TaskNebula v0.5.0 is available')).toBeInTheDocument();
    expect(
      screen.getByText(
        'You are running v0.4.0. Open Admin > Updates for release notes and Docker update commands.'
      )
    ).toBeInTheDocument();
  });

  it('shows a Docker Hub-specific banner when only the image tag is newer', async () => {
    const base = info();
    mockData(
      info({
        latest: '0.5.0',
        releaseUpdateAvailable: false,
        updateAvailable: true,
        image: {
          ...base.image,
          latestTag: '0.5.0',
          updateAvailable: true,
        },
      })
    );
    render(<VersionUpdateBanner />);

    expect(await screen.findByText('Docker image v0.5.0 is available')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Docker Hub published neuraparse/tasknebula:v0.5.0. You are running v0.4.0; open Admin > Updates to pull and restart.'
      )
    ).toBeInTheDocument();
  });

  it('renders an Updates link by default', async () => {
    mockData(info({ latest: '0.5.0', updateAvailable: true }));
    render(<VersionUpdateBanner />);

    const link = await screen.findByRole('link', { name: 'Open updates' });
    expect(link).toHaveAttribute('href', '/admin?tab=updates');
  });

  it('calls onView instead of rendering a link when provided', async () => {
    mockData(info({ latest: '0.5.0', updateAvailable: true }));
    const onView = jest.fn();
    render(<VersionUpdateBanner onView={onView} />);

    const button = await screen.findByRole('button', { name: 'Open updates' });
    await userEvent.setup().click(button);
    expect(onView).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: 'Open updates' })).not.toBeInTheDocument();
  });

  it('persists the dismissed version to localStorage and hides the banner', async () => {
    const user = userEvent.setup();
    mockData(info({ latest: '0.5.0', updateAvailable: true }));
    render(<VersionUpdateBanner />);

    await screen.findByText('TaskNebula v0.5.0 is available');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(window.localStorage.getItem(DISMISS_STORAGE_KEY)).toBe('0.5.0');
    await waitFor(() =>
      expect(screen.queryByText('TaskNebula v0.5.0 is available')).not.toBeInTheDocument()
    );
  });

  it('stays hidden for a version that was already dismissed', async () => {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, '0.5.0');
    mockData(info({ latest: '0.5.0', updateAvailable: true }));
    const { container } = render(<VersionUpdateBanner />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('re-appears for a newer version even after a prior dismissal', async () => {
    // The previous release (0.5.0) was dismissed; 0.6.0 is keyed separately.
    window.localStorage.setItem(DISMISS_STORAGE_KEY, '0.5.0');
    mockData(info({ latest: '0.6.0', updateAvailable: true }));
    render(<VersionUpdateBanner />);

    expect(await screen.findByText('TaskNebula v0.6.0 is available')).toBeInTheDocument();
  });
});
