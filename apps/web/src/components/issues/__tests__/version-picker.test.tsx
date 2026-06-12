import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectVersion } from '@/lib/hooks/use-issue-versions';

const useProjectVersionsMock = jest.fn();
jest.mock('@/lib/hooks/use-issue-versions', () => ({
  useProjectVersions: (projectId: string | null) => useProjectVersionsMock(projectId),
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
});

describe('VersionPicker', () => {
  it('shows a placeholder when nothing is selected', () => {
    render(
      <VersionPicker projectId="project-1" value={[]} onChange={jest.fn()} placeholder="None" />
    );

    expect(screen.getByRole('combobox')).toHaveTextContent('None');
  });

  it('lists unreleased versions before released ones and hides unselected archived', async () => {
    const user = userEvent.setup();

    render(<VersionPicker projectId="project-1" value={[]} onChange={jest.fn()} />);

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

    render(<VersionPicker projectId="project-1" value={[v1]} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('1.1.0'));

    expect(onChange).toHaveBeenCalledWith(['v1', 'v2']);
  });

  it('removes an already-selected version on click', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<VersionPicker projectId="project-1" value={[v1, v2]} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    const options = await screen.findAllByRole('option');
    const released = options.find((o) => o.textContent?.includes('1.0.0'));
    await user.click(released as HTMLElement);

    expect(onChange).toHaveBeenCalledWith(['v2']);
  });

  it('keeps a selected archived version in the option list', async () => {
    const user = userEvent.setup();

    render(<VersionPicker projectId="project-1" value={[vArchived]} onChange={jest.fn()} />);

    await user.click(screen.getByRole('combobox'));

    const options = await screen.findAllByRole('option');
    expect(options.some((o) => o.textContent?.includes('0.9.0'))).toBe(true);
  });
});
