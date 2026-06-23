import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCreateDocumentPage,
  useDocumentAttachments,
  useDocumentPage,
  useDocumentPages,
  useDocumentRevisions,
  useUpdateDocumentPage,
} from '../use-docs';
import type { ApiResponseError } from '@/lib/client-api-errors';

const fetchMock = jest.fn();

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('use-docs hooks', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('useDocumentPage', () => {
    it('is disabled when pageId is null and does not fetch', async () => {
      const { result } = renderHook(() => useDocumentPage(null), {
        wrapper: createWrapper(createQueryClient()),
      });

      await Promise.resolve();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('fetches a single document page by id', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'page-1', title: 'Design doc' }),
      });

      const { result } = renderHook(() => useDocumentPage('page-1'), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.data?.id).toBe('page-1');
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/docs/pages/page-1');
    });

    it('surfaces an error when the page response is not ok', async () => {
      fetchMock.mockResolvedValue({ ok: false });

      const { result } = renderHook(() => useDocumentPage('page-1'), {
        wrapper: createWrapper(createQueryClient()),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.message).toBe('Failed to fetch document page');
    });
  });

  describe('useDocumentPages', () => {
    it('fetches document pages with filters and returns the response shape', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          space: { id: 'space-1', name: 'Engineering' },
          permissions: { canBrowse: true, canCreate: true, canEdit: true, canDelete: false },
          pages: [{ id: 'page-1', title: 'Design doc' }],
        }),
      });

      const { result } = renderHook(
        () =>
          useDocumentPages({
            spaceId: 'space-1',
            organizationId: 'org-1',
            projectId: 'project-1',
          }),
        { wrapper: createWrapper(createQueryClient()) }
      );

      await waitFor(() => {
        expect(result.current.data?.pages).toHaveLength(1);
      });

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/docs/pages?spaceId=space-1&organizationId=org-1&projectId=project-1'
      );
    });
  });

  describe('lazy detail hooks', () => {
    it('does not fetch revisions while disabled', async () => {
      const { result } = renderHook(() => useDocumentRevisions('page-1', { enabled: false }), {
        wrapper: createWrapper(createQueryClient()),
      });

      await Promise.resolve();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('does not fetch attachments while disabled', async () => {
      const { result } = renderHook(() => useDocumentAttachments('page-1', { enabled: false }), {
        wrapper: createWrapper(createQueryClient()),
      });

      await Promise.resolve();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('useCreateDocumentPage', () => {
    it('POSTs the new page payload to /api/docs/pages', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'page-1', title: 'New page' }),
      });

      const { result } = renderHook(() => useCreateDocumentPage(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await act(async () => {
        await result.current.mutateAsync({
          title: 'New page',
          spaceId: 'space-1',
          organizationId: 'org-1',
        });
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/docs/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New page',
          spaceId: 'space-1',
          organizationId: 'org-1',
        }),
      });
    });

    it('throws the error message from the API when creation fails', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Title already taken' }),
      });

      const { result } = renderHook(() => useCreateDocumentPage(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({ title: 'Dup' });
        })
      ).rejects.toThrow('Title already taken');
    });

    it('preserves API status on permission failures', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'You do not have permission to create pages in this space' }),
      });

      const { result } = renderHook(() => useCreateDocumentPage(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({ title: 'Blocked' });
        })
      ).rejects.toMatchObject({
        status: 403,
        message: 'You do not have permission to create pages in this space',
      } satisfies Partial<ApiResponseError>);
    });
  });

  describe('useUpdateDocumentPage', () => {
    it('PATCHes the page endpoint with the provided data', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'page-1', title: 'Renamed' }),
      });

      const { result } = renderHook(() => useUpdateDocumentPage(), {
        wrapper: createWrapper(createQueryClient()),
      });

      await act(async () => {
        await result.current.mutateAsync({
          pageId: 'page-1',
          data: {
            title: 'Renamed',
            expectedRevision: 3,
          },
        });
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/docs/pages/page-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Renamed',
          expectedRevision: 3,
        }),
      });
    });
  });
});
