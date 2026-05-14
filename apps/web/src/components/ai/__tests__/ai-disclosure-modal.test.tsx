/**
 * AiDisclosureModal — show-once logic tests.
 *
 * Verifies:
 *   1. Modal renders when the workspace has no acknowledgement for the
 *      current disclosure version.
 *   2. Modal does NOT render when the current version is already in the
 *      acknowledged set.
 *   3. Clicking "I understand" POSTs the acknowledgement and removes the
 *      modal from the DOM.
 */

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AiDisclosureModal } from '../ai-disclosure-modal';
import { DISCLOSURE_VERSION } from '@/config/ai-model-cards';

jest.mock('@/lib/hooks/use-organization', () => ({
  useOrganization: () => ({ currentOrganizationId: 'org-test' }),
}));

function renderWithClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AiDisclosureModal />
    </QueryClientProvider>
  );
}

describe('AiDisclosureModal', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('shows the modal when the current version is not acknowledged', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ acknowledgedVersions: [] }),
    }) as unknown as typeof fetch;

    renderWithClient();
    await waitFor(() => {
      expect(screen.getByTestId('ai-disclosure-modal')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/You are about to interact with AI/i)
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(DISCLOSURE_VERSION))).toBeInTheDocument();
  });

  it('does not render when the current version is already acknowledged', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ acknowledgedVersions: [DISCLOSURE_VERSION] }),
    }) as unknown as typeof fetch;

    renderWithClient();
    // Wait for query to settle, then assert absence.
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    // Modal must NOT appear once the version is in the acknowledged set.
    expect(screen.queryByTestId('ai-disclosure-modal')).not.toBeInTheDocument();
  });

  it('persists the acknowledgement on click and hides itself', async () => {
    const fetchMock = jest
      .fn()
      // GET — nothing acked
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ acknowledgedVersions: [] }),
      })
      // POST — accepted
      .mockResolvedValueOnce({ ok: true, status: 204 });

    global.fetch = fetchMock as unknown as typeof fetch;

    renderWithClient();
    const ack = await screen.findByTestId('ai-disclosure-ack');

    await act(async () => {
      fireEvent.click(ack);
    });

    // Second fetch call must be the POST to /api/ai/disclosures
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    const [, second] = fetchMock.mock.calls;
    expect(second[0]).toBe('/api/ai/disclosures');
    expect(second[1].method).toBe('POST');
    const body = JSON.parse(second[1].body);
    expect(body.version).toBe(DISCLOSURE_VERSION);
    expect(body.workspaceId).toBe('org-test');

    // Modal should be removed from the DOM after acknowledgement.
    await waitFor(() => {
      expect(screen.queryByTestId('ai-disclosure-modal')).not.toBeInTheDocument();
    });
  });

  it('renders only once per (workspace, user, version) — repeated mounts see acknowledged set', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ acknowledgedVersions: [DISCLOSURE_VERSION] }),
    }) as unknown as typeof fetch;

    const { unmount } = renderWithClient();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByTestId('ai-disclosure-modal')).not.toBeInTheDocument();
    unmount();

    // Re-render — modal must remain hidden, the per-version ledger is sticky.
    renderWithClient();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('ai-disclosure-modal')).not.toBeInTheDocument();
  });
});
