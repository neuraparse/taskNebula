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
    updateAvailable: false,
    releaseUrl: null,
    publishedAt: null,
    notes: null,
    checkedAt: null,
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
        'You are running v0.4.0. Review the release notes and update when convenient.'
      )
    ).toBeInTheDocument();
  });

  it('renders a View update button only when onView is provided', async () => {
    mockData(info({ latest: '0.5.0', updateAvailable: true }));
    const onView = jest.fn();
    render(<VersionUpdateBanner onView={onView} />);

    const button = await screen.findByRole('button', { name: 'View update' });
    await userEvent.setup().click(button);
    expect(onView).toHaveBeenCalledTimes(1);
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
