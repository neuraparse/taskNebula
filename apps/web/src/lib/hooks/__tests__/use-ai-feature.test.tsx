import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAiFeature } from '../use-ai-feature';

jest.mock('../use-organization', () => ({
  useOrganization: () => ({ currentOrganizationId: null }),
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = 'TestQueryClientWrapper';
  return Wrapper;
}

describe('useAiFeature (shim over useAiCapability)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('reports disabled when platformEnabled is false', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ platformEnabled: false, orgEnabled: false }),
    }) as any;

    const { result } = renderHook(() => useAiFeature(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.aiEnabled).toBe(false);
  });

  it('reports enabled when platformEnabled is true', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ platformEnabled: true, orgEnabled: false, canDraft: false }),
    }) as any;

    const { result } = renderHook(() => useAiFeature(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.aiEnabled).toBe(true));
  });

  it('treats fetch failure as disabled (safe default)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as any;
    const { result } = renderHook(() => useAiFeature(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.aiEnabled).toBe(false);
  });
});
