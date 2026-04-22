import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAiCapability } from '../use-ai-capability';

jest.mock('../use-organization', () => ({
  useOrganization: () => ({ currentOrganizationId: 'org-1' }),
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = 'QC';
  return Wrapper;
}

describe('useAiCapability', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns DISABLED when fetch fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as any;
    const { result } = renderHook(() => useAiCapability(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.platformEnabled).toBe(false);
    expect(result.current.canDraft).toBe(false);
    expect(result.current.canRunAgents).toBe(false);
    expect(result.current.llm.configured).toBe(false);
  });

  it('surfaces platformEnabled + assistantEnabled + canDraft when all green', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        platformEnabled: true,
        llm: { provider: 'anthropic', model: 'claude-sonnet-4-6', configured: true, source: 'workspace' },
        assistantEnabled: true,
        canDraft: true,
        agentsEnabled: false,
        canRunAgents: false,
      }),
    }) as any;

    const { result } = renderHook(() => useAiCapability(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.canDraft).toBe(true));
    expect(result.current.platformEnabled).toBe(true);
    expect(result.current.assistantEnabled).toBe(true);
    expect(result.current.canRunAgents).toBe(false);
    expect(result.current.llm.provider).toBe('anthropic');
    expect(result.current.llm.source).toBe('workspace');
  });

  it('treats platformEnabled=false as completely disabled downstream', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        platformEnabled: false,
        llm: { provider: 'native', model: '', configured: false, source: null },
        assistantEnabled: false,
        canDraft: false,
        agentsEnabled: false,
        canRunAgents: false,
      }),
    }) as any;

    const { result } = renderHook(() => useAiCapability(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.platformEnabled).toBe(false);
    expect(result.current.canDraft).toBe(false);
  });

  it('calls /api/ai/capability with the current organizationId', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        platformEnabled: true,
        llm: { provider: 'openai', model: 'gpt-4o-mini', configured: true, source: 'platform' },
        assistantEnabled: true,
        canDraft: true,
        agentsEnabled: false,
        canRunAgents: false,
      }),
    });
    global.fetch = fetchMock as any;

    const { result } = renderHook(() => useAiCapability(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.canDraft).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('organizationId=org-1')
    );
  });
});
