import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusPicker } from '../status-picker';

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
});

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const statuses = [
  { id: 'status-1', name: 'Todo', category: 'todo', color: '#64748b' },
  { id: 'status-2', name: 'In Progress', category: 'in_progress', color: '#3b82f6' },
  { id: 'status-3', name: 'Done', category: 'done', color: '#10b981' },
];

function mockFetchOk() {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ statuses }),
  } as Response);
}

describe('StatusPicker', () => {
  it('shows a placeholder while no value is selected', async () => {
    mockFetchOk();
    render(<StatusPicker projectId="project-1" value="" onChange={jest.fn()} />);

    // Wait for fetch to complete so the button is enabled
    await waitFor(() => {
      expect(screen.getByRole('combobox')).not.toBeDisabled();
    });

    expect(screen.getByRole('combobox')).toHaveTextContent('Select status...');
  });

  it('renders the selected status name once loaded', async () => {
    mockFetchOk();
    render(
      <StatusPicker projectId="project-1" value="status-2" onChange={jest.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('In Progress');
    });
  });

  it('emits the selected status id when an option is chosen', async () => {
    mockFetchOk();
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(
      <StatusPicker projectId="project-1" value="status-1" onChange={onChange} />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox')).not.toBeDisabled();
    });

    await user.click(screen.getByRole('combobox'));

    const option = await screen.findByRole('option', { name: /done/i });
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith('status-3');
  });

  it('stays disabled while loading', () => {
    // fetch never resolves in this test
    fetchMock.mockImplementation(() => new Promise(() => {}));
    render(<StatusPicker projectId="project-1" value="" onChange={jest.fn()} />);

    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
