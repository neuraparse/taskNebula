import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import type { ProjectVersion } from '@/lib/hooks/use-issue-versions';

const useProjectVersionsMock = jest.fn();
const createVersionMutateAsyncMock = jest.fn();
const useCreateProjectVersionMock = jest.fn();
jest.mock('@/lib/hooks/use-issue-versions', () => ({
  useProjectVersions: (projectId: string | null) => useProjectVersionsMock(projectId),
  useCreateProjectVersion: () => useCreateProjectVersionMock(),
}));

const useProjectPermissionsMock = jest.fn();
jest.mock('@/lib/hooks/use-project-permissions', () => ({
  useProjectPermissions: (projectId: string | undefined) => useProjectPermissionsMock(projectId),
}));

import { VersionPicker } from '../version-picker';

function version(
  overrides: Partial<ProjectVersion> & { id: string; name: string }
): ProjectVersion {
  return {
    organizationId: 'org-1',
    projectId: 'project-1',
    description: null,
    status: 'unreleased',
    startDate: null,
    releaseDate: null,
    releasedAt: null,
    sortOrder: 0,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    createdBy: null,
    ...overrides,
  };
}

const v1 = version({ id: 'v1', name: '1.0.0', status: 'released', sortOrder: 0 });
const v2 = version({ id: 'v2', name: '1.1.0', status: 'unreleased', sortOrder: 1 });
const vArchived = version({ id: 'v3', name: '0.9.0', status: 'archived', sortOrder: 2 });

function permissions(overrides: Partial<Record<string, boolean>> = {}) {
  return {
    permissions: {
      isSuperAdmin: false,
      isOrgOwner: false,
      isOrgAdmin: false,
      canAdministerProject: true,
      ...overrides,
    },
    isLoading: false,
    error: null,
  };
}

/** The picker uses useQueryClient — renders need a provider. */
function renderPicker(ui: ReactElement, client?: QueryClient) {
  const queryClient = client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
  if (!(Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView) {
    (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
  }
});

beforeEach(() => {
  useProjectVersionsMock.mockReset();
  useProjectVersionsMock.mockReturnValue({
    data: [v1, v2, vArchived],
    isLoading: false,
  });
  createVersionMutateAsyncMock.mockReset();
  useCreateProjectVersionMock.mockReset();
  useCreateProjectVersionMock.mockReturnValue({
    mutateAsync: createVersionMutateAsyncMock,
    isPending: false,
  });
  useProjectPermissionsMock.mockReset();
  useProjectPermissionsMock.mockReturnValue(permissions());
});

describe('VersionPicker', () => {
  it('shows a placeholder when nothing is selected', () => {
    renderPicker(
      <VersionPicker projectId="project-1" value={[]} onChange={jest.fn()} placeholder="None" />
    );

    expect(screen.getByRole('combobox')).toHaveTextContent('None');
  });

  it('lists unreleased versions before released ones and hides unselected archived', async () => {
    const user = userEvent.setup();

    renderPicker(<VersionPicker projectId="project-1" value={[]} onChange={jest.fn()} />);

    await user.click(screen.getByRole('combobox'));

    const options = await screen.findAllByRole('option');
    const names = options.map((o) => o.textContent ?? '');
    const unreleasedIdx = names.findIndex((n) => n.includes('1.1.0'));
    const releasedIdx = names.findIndex((n) => n.includes('1.0.0'));

    expect(unreleasedIdx).toBeGreaterThanOrEqual(0);
    expect(releasedIdx).toBeGreaterThanOrEqual(0);
    expect(unreleasedIdx).toBeLessThan(releasedIdx);
    expect(names.some((n) => n.includes('0.9.0'))).toBe(false);
  });

  it('adds a version to the selection on click', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    renderPicker(<VersionPicker projectId="project-1" value={[v1]} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('1.1.0'));

    expect(onChange).toHaveBeenCalledWith(['v1', 'v2']);
  });

  it('removes an already-selected version on click', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    renderPicker(<VersionPicker projectId="project-1" value={[v1, v2]} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    const options = await screen.findAllByRole('option');
    const released = options.find((o) => o.textContent?.includes('1.0.0'));
    await user.click(released as HTMLElement);

    expect(onChange).toHaveBeenCalledWith(['v2']);
  });

  it('keeps a selected archived version in the option list', async () => {
    const user = userEvent.setup();

    renderPicker(<VersionPicker projectId="project-1" value={[vArchived]} onChange={jest.fn()} />);

    await user.click(screen.getByRole('combobox'));

    const options = await screen.findAllByRole('option');
    expect(options.some((o) => o.textContent?.includes('0.9.0'))).toBe(true);
  });

  describe('inline create', () => {
    it('creates from an unmatched query, selects the new id, and announces it', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      createVersionMutateAsyncMock.mockResolvedValue(version({ id: 'v9', name: '2.0.0' }));

      renderPicker(<VersionPicker projectId="project-1" value={[v1]} onChange={onChange} />);

      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByPlaceholderText('Search versions…'), '2.0.0');
      await user.click(await screen.findByText('Create "2.0.0"'));

      expect(createVersionMutateAsyncMock).toHaveBeenCalledWith({
        projectId: 'project-1',
        name: '2.0.0',
      });
      expect(onChange).toHaveBeenCalledWith(['v1', 'v9']);
      expect(await screen.findByRole('status')).toHaveTextContent('Version "2.0.0" created');
    });

    it('is reachable with the keyboard (Enter on the highlighted row)', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      createVersionMutateAsyncMock.mockResolvedValue(version({ id: 'v9', name: '2.0.0' }));

      renderPicker(<VersionPicker projectId="project-1" value={[]} onChange={onChange} />);

      await user.click(screen.getByRole('combobox'));
      // No version matches "2.0.0" → the create row is the only (highlighted) item.
      await user.type(screen.getByPlaceholderText('Search versions…'), '2.0.0');
      await screen.findByText('Create "2.0.0"');
      await user.keyboard('{Enter}');

      expect(createVersionMutateAsyncMock).toHaveBeenCalledWith({
        projectId: 'project-1',
        name: '2.0.0',
      });
      expect(onChange).toHaveBeenCalledWith(['v9']);
    });

    it('suppresses the create row on an exact match, even a hidden archived one', async () => {
      const user = userEvent.setup();

      renderPicker(<VersionPicker projectId="project-1" value={[]} onChange={jest.fn()} />);

      await user.click(screen.getByRole('combobox'));
      // 0.9.0 exists but is archived (hidden from the list) — POST would 409.
      await user.type(screen.getByPlaceholderText('Search versions…'), '0.9.0');

      expect(screen.queryByText('Create "0.9.0"')).not.toBeInTheDocument();
      expect(screen.getByText('No versions found')).toBeInTheDocument();
    });

    it('hides the create row from members without project-admin rights', async () => {
      const user = userEvent.setup();
      useProjectPermissionsMock.mockReturnValue(permissions({ canAdministerProject: false }));

      renderPicker(<VersionPicker projectId="project-1" value={[]} onChange={jest.fn()} />);

      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByPlaceholderText('Search versions…'), '2.0.0');

      expect(screen.queryByText('Create "2.0.0"')).not.toBeInTheDocument();
    });

    it('shows a quiet inline error on 409 when the duplicate is not in the cache', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      createVersionMutateAsyncMock.mockRejectedValue(
        Object.assign(new Error('Version name already in use'), { status: 409 })
      );

      renderPicker(<VersionPicker projectId="project-1" value={[]} onChange={onChange} />);

      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByPlaceholderText('Search versions…'), '2.0.0');
      await user.click(await screen.findByText('Create "2.0.0"'));

      expect(await screen.findByRole('alert')).toHaveTextContent('Version "2.0.0" already exists');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('selects the existing version on 409 when the duplicate is already cached', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      createVersionMutateAsyncMock.mockRejectedValue(
        Object.assign(new Error('Version name already in use'), { status: 409 })
      );

      // The duplicate lives in the query cache (post-invalidate read path),
      // but not in the rendered option list.
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      client.setQueryData(
        ['project-versions', 'project-1'],
        [v1, v2, vArchived, version({ id: 'v8', name: '1.0.0-rc' })].map((v) => ({
          ...v,
          issueCount: 0,
          doneIssueCount: 0,
        }))
      );

      renderPicker(<VersionPicker projectId="project-1" value={[]} onChange={onChange} />, client);

      await user.click(screen.getByRole('combobox'));
      // Case-differing query: no exact match locally, but the server 409s.
      await user.type(screen.getByPlaceholderText('Search versions…'), '1.0.0-RC');
      await user.click(await screen.findByText('Create "1.0.0-RC"'));

      expect(onChange).toHaveBeenCalledWith(['v8']);
      expect(await screen.findByRole('status')).toHaveTextContent(
        'Version "1.0.0-RC" already exists'
      );
    });

    it('shows a quiet inline error on 403', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      createVersionMutateAsyncMock.mockRejectedValue(
        Object.assign(new Error('Forbidden'), { status: 403 })
      );

      renderPicker(<VersionPicker projectId="project-1" value={[]} onChange={onChange} />);

      await user.click(screen.getByRole('combobox'));
      await user.type(screen.getByPlaceholderText('Search versions…'), '2.0.0');
      await user.click(await screen.findByText('Create "2.0.0"'));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "You don't have permission to create versions"
      );
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
