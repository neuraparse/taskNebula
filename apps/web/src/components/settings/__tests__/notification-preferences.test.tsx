import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { NotificationPreferences } from '@/components/settings/notification-preferences';

// ----- Mocks --------------------------------------------------------------

jest.mock('@/lib/hooks/use-organization', () => ({
  useOrganization: () => ({ currentOrganizationId: 'org-test' }),
}));

const toastMock = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

// ----- Types & defaults (kept local to avoid coupling to component) -------

type Preferences = {
  userId?: string;
  organizationId: string;
  enableInApp: boolean;
  enableEmail: boolean;
  digestFrequency: 'none' | 'daily' | 'weekly';
  emailOnAssigned: boolean;
  emailOnMentioned: boolean;
  emailOnCommented: boolean;
  emailOnStatusChanged: boolean;
  emailOnIssueCreated: boolean;
  emailOnSprintStarted: boolean;
  emailOnSprintCompleted: boolean;
  inAppOnAssigned: boolean;
  inAppOnMentioned: boolean;
  inAppOnCommented: boolean;
  inAppOnStatusChanged: boolean;
  inAppOnIssueCreated: boolean;
  inAppOnSprintStarted: boolean;
  inAppOnSprintCompleted: boolean;
  doNotDisturb: boolean;
  doNotDisturbStart: string | null;
  doNotDisturbEnd: string | null;
};

const DEFAULTS: Omit<Preferences, 'organizationId'> = {
  enableInApp: true,
  enableEmail: true,
  digestFrequency: 'none',
  emailOnAssigned: true,
  emailOnMentioned: true,
  emailOnCommented: false,
  emailOnStatusChanged: false,
  emailOnIssueCreated: false,
  emailOnSprintStarted: false,
  emailOnSprintCompleted: false,
  inAppOnAssigned: true,
  inAppOnMentioned: true,
  inAppOnCommented: true,
  inAppOnStatusChanged: true,
  inAppOnIssueCreated: true,
  inAppOnSprintStarted: true,
  inAppOnSprintCompleted: true,
  doNotDisturb: false,
  doNotDisturbStart: null,
  doNotDisturbEnd: null,
};

// ----- Helpers ------------------------------------------------------------

function buildJsonResponse(body: unknown, init: { status?: number; ok?: boolean } = {}) {
  const status = init.status ?? 200;
  const ok = init.ok ?? status < 400;
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

type FetchSpy = jest.SpiedFunction<typeof fetch>;

function countPosts(spy: FetchSpy): number {
  return spy.mock.calls.filter((call) => {
    const init = call[1] as RequestInit | undefined;
    return (init?.method || 'GET').toUpperCase() === 'POST';
  }).length;
}

function findPostCall(
  spy: FetchSpy
): [RequestInfo | URL, RequestInit | undefined] | undefined {
  const call = spy.mock.calls.find((c) => {
    const init = c[1] as RequestInit | undefined;
    return (init?.method || 'GET').toUpperCase() === 'POST';
  });
  return call as
    | [RequestInfo | URL, RequestInit | undefined]
    | undefined;
}

function installFetchMock(
  initialPreferences: Preferences = { organizationId: 'org-test', ...DEFAULTS },
  options: { postShouldReject?: boolean; postStatus?: number } = {}
): FetchSpy {
  const spy = jest.spyOn(global, 'fetch') as unknown as FetchSpy;
  spy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method || 'GET').toUpperCase();
    if (method === 'GET') {
      return Promise.resolve(
        buildJsonResponse({ preferences: initialPreferences })
      );
    }
    // POST
    if (options.postShouldReject) {
      return Promise.resolve(
        buildJsonResponse(
          { error: 'Internal server error' },
          { status: options.postStatus ?? 500 }
        )
      );
    }
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    return Promise.resolve(buildJsonResponse({ preferences: body }));
  });
  return spy;
}

// ----- Test lifecycle -----------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  toastMock.mockClear();
  // jsdom does not implement fetch; establish a property so spyOn can replace it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = jest.fn(() => Promise.resolve(buildJsonResponse({})));
  // Radix Select / Popper relies on Pointer Events APIs jsdom does not ship.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(HTMLElement.prototype as any).hasPointerCapture) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (HTMLElement.prototype as any).hasPointerCapture = () => false;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(HTMLElement.prototype as any).releasePointerCapture) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (HTMLElement.prototype as any).releasePointerCapture = () => {};
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(HTMLElement.prototype as any).setPointerCapture) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (HTMLElement.prototype as any).setPointerCapture = () => {};
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(HTMLElement.prototype as any).scrollIntoView) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (HTMLElement.prototype as any).scrollIntoView = () => {};
  }
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (global as any).fetch;
});

// ----- Scenarios ----------------------------------------------------------

describe('NotificationPreferences', () => {
  it('shows a loading placeholder while the initial GET is pending', async () => {
    // Make fetch never resolve in this test.
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(() => new Promise(() => {}));

    renderWithProviders(<NotificationPreferences />);

    expect(
      screen.getByText(/Loading notification settings/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('hydrates defaults from GET (email on, commented off, mentioned on; Recommended chip visible)', async () => {
    installFetchMock();

    renderWithProviders(<NotificationPreferences />);

    const emailMaster = await screen.findByRole('switch', {
      name: /toggle email notifications/i,
    });
    expect(emailMaster).toHaveAttribute('data-state', 'checked');

    // The label text appears in both the email and in-app sections; use getAllByRole.
    const allCommented = screen.getAllByRole('switch', {
      name: /comments on watched issues/i,
    });
    expect(allCommented.length).toBeGreaterThanOrEqual(2);
    // Email section is rendered first — its emailOnCommented default is false.
    expect(allCommented[0]).toHaveAttribute('data-state', 'unchecked');

    const mentions = screen.getAllByRole('switch', { name: /mentions/i });
    expect(mentions[0]).toHaveAttribute('data-state', 'checked');

    expect(screen.getAllByText(/Recommended/i).length).toBeGreaterThanOrEqual(1);
  });

  it('hydration does NOT auto-save (regression test for save-loop bug)', async () => {
    const spy = installFetchMock();

    renderWithProviders(<NotificationPreferences />);

    await screen.findByRole('switch', {
      name: /toggle email notifications/i,
    });

    // Only 1 call at this point (the GET).
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual(
      expect.stringContaining('/api/notification-preferences?organizationId=')
    );

    // Advance past the debounce; no POST should fire from hydration.
    jest.advanceTimersByTime(400);
    await Promise.resolve();
    await Promise.resolve();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('toggling a switch triggers exactly one POST after debounce', async () => {
    const spy = installFetchMock();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    renderWithProviders(<NotificationPreferences />);

    const commented = (
      await screen.findAllByRole('switch', {
        name: /comments on watched issues/i,
      })
    )[0];

    await user.click(commented);

    // Before debounce elapses: still only the initial GET.
    expect(countPosts(spy)).toBe(0);

    jest.advanceTimersByTime(400);
    await waitFor(() => expect(countPosts(spy)).toBe(1));

    const postCall = findPostCall(spy);
    expect(postCall![0]).toBe('/api/notification-preferences');
    const postInit = postCall![1] as RequestInit;
    expect(postInit.method).toBe('POST');
    const body = JSON.parse(String(postInit.body));
    expect(body.emailOnCommented).toBe(true);
  });

  it('rapid toggles within debounce window are coalesced to one POST with the final value', async () => {
    const spy = installFetchMock();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    renderWithProviders(<NotificationPreferences />);

    const commented = (
      await screen.findAllByRole('switch', {
        name: /comments on watched issues/i,
      })
    )[0];

    // Click twice within 100ms — unchecked -> checked -> unchecked.
    await user.click(commented);
    jest.advanceTimersByTime(50);
    await user.click(commented);

    // Still no POST yet.
    expect(countPosts(spy)).toBe(0);

    jest.advanceTimersByTime(400);
    await waitFor(() => expect(countPosts(spy)).toBe(1));

    const postInit = findPostCall(spy)![1] as RequestInit;
    const body = JSON.parse(String(postInit.body));
    // Two toggles -> final value matches the original default (false).
    expect(body.emailOnCommented).toBe(false);
  });

  it('shows Saving chip during POST, then Saved briefly after success', async () => {
    // Custom mock to hold POST resolution so we can observe the "Saving" state.
    let resolvePost: ((value: Response) => void) | null = null;
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const method = (init?.method || 'GET').toUpperCase();
        if (method === 'GET') {
          return Promise.resolve(
            buildJsonResponse({
              preferences: { organizationId: 'org-test', ...DEFAULTS },
            })
          );
        }
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        return new Promise<Response>((resolve) => {
          resolvePost = () => resolve(buildJsonResponse({ preferences: body }));
        });
      });

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderWithProviders(<NotificationPreferences />);

    const commented = (
      await screen.findAllByRole('switch', {
        name: /comments on watched issues/i,
      })
    )[0];

    // No "Saving" chip initially.
    expect(screen.queryByText(/Saving/i)).not.toBeInTheDocument();

    await user.click(commented);
    jest.advanceTimersByTime(400);

    // POST has been fired — Saving should appear.
    await waitFor(() => {
      expect(screen.getByText(/Saving/i)).toBeInTheDocument();
    });

    // Resolve POST.
    resolvePost!({} as unknown as Response);
    await waitFor(() => {
      expect(screen.queryByText(/Saving/i)).not.toBeInTheDocument();
    });
    // "Saved" appears briefly.
    await waitFor(() => {
      expect(screen.getByText(/Saved/i)).toBeInTheDocument();
    });

    // Cleanup so fetchSpy doesn't leak.
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("shows Couldn't save and fires a destructive toast on POST failure", async () => {
    installFetchMock(undefined, { postShouldReject: true, postStatus: 500 });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    renderWithProviders(<NotificationPreferences />);

    const commented = (
      await screen.findAllByRole('switch', {
        name: /comments on watched issues/i,
      })
    )[0];

    await user.click(commented);
    jest.advanceTimersByTime(400);

    await waitFor(() => {
      expect(screen.getByText(/Couldn.?t save/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/^Saved$/i)).not.toBeInTheDocument();
    expect(toastMock).toHaveBeenCalled();
    const call = toastMock.mock.calls[toastMock.mock.calls.length - 1][0];
    expect(call.variant).toBe('destructive');
  });

  it('toggling DND on reveals two time inputs defaulting to 22:00 and 08:00', async () => {
    installFetchMock();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    renderWithProviders(<NotificationPreferences />);

    const dnd = await screen.findByRole('switch', {
      name: /toggle do not disturb/i,
    });

    // No time inputs initially.
    expect(document.querySelectorAll('input[type="time"]').length).toBe(0);

    await user.click(dnd);

    const timeInputs = await waitFor(() => {
      const inputs = document.querySelectorAll('input[type="time"]');
      expect(inputs.length).toBe(2);
      return inputs;
    });

    const values = Array.from(timeInputs).map(
      (el) => (el as HTMLInputElement).value
    );
    expect(values).toEqual(['22:00', '08:00']);
  });

  it('does not crash or error the API when doNotDisturb times are null on hydrate and another field is toggled', async () => {
    const initial: Preferences = {
      organizationId: 'org-test',
      ...DEFAULTS,
      doNotDisturb: false,
      doNotDisturbStart: null,
      doNotDisturbEnd: null,
    };
    const spy = installFetchMock(initial);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    renderWithProviders(<NotificationPreferences />);

    const commented = (
      await screen.findAllByRole('switch', {
        name: /comments on watched issues/i,
      })
    )[0];

    await user.click(commented);
    jest.advanceTimersByTime(400);

    await waitFor(() => expect(countPosts(spy)).toBe(1));

    const postInit = findPostCall(spy)![1] as RequestInit;
    const body = JSON.parse(String(postInit.body));

    // Null (or omitted) is acceptable per the updated server contract.
    if ('doNotDisturbStart' in body) {
      expect(body.doNotDisturbStart).toBeNull();
    }
    if ('doNotDisturbEnd' in body) {
      expect(body.doNotDisturbEnd).toBeNull();
    }
    // And of course the toggled field was persisted.
    expect(body.emailOnCommented).toBe(true);
  });

  it('updating digest to daily posts digestFrequency:"daily" and reveals the 08:00 helper note', async () => {
    const spy = installFetchMock();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    renderWithProviders(<NotificationPreferences />);

    await screen.findByRole('switch', {
      name: /toggle email notifications/i,
    });

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    const dailyOption = await screen.findByRole('option', { name: /daily/i });
    await user.click(dailyOption);

    jest.advanceTimersByTime(400);
    await waitFor(() => expect(countPosts(spy)).toBe(1));

    const postInit = findPostCall(spy)![1] as RequestInit;
    const body = JSON.parse(String(postInit.body));
    expect(body.digestFrequency).toBe('daily');

    expect(screen.getByText(/08:00/)).toBeInTheDocument();
  });

  it('disables email-event switches when the Email master is toggled off', async () => {
    installFetchMock();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    renderWithProviders(<NotificationPreferences />);

    const emailMaster = await screen.findByRole('switch', {
      name: /toggle email notifications/i,
    });

    // Before toggling, the email-event switches are enabled.
    const commentedBefore = screen.getAllByRole('switch', {
      name: /comments on watched issues/i,
    })[0];
    expect(commentedBefore).not.toBeDisabled();

    await user.click(emailMaster);

    await waitFor(() => {
      expect(emailMaster).toHaveAttribute('data-state', 'unchecked');
    });

    // After toggling off, every email-event switch is disabled.
    const emailEventLabels = [
      /assigned to you/i,
      /mentions/i,
      /comments on watched issues/i,
      /status changes/i,
      /new issues/i,
      /sprint starts/i,
      /sprint completes/i,
    ];
    for (const label of emailEventLabels) {
      const matches = screen.getAllByRole('switch', { name: label });
      // First match is the email section, second is in-app.
      expect(matches[0]).toBeDisabled();
    }
  });
});
