import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateSprintModal } from '../create-sprint-modal';
import { useCreateSprint, useSprints } from '@/lib/hooks/use-sprints';

jest.mock('@/lib/hooks/use-sprints', () => ({
  useCreateSprint: jest.fn(),
  useSprints: jest.fn(),
}));

const mockUseCreateSprint = useCreateSprint as jest.MockedFunction<typeof useCreateSprint>;
const mockUseSprints = useSprints as jest.MockedFunction<typeof useSprints>;

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('CreateSprintModal', () => {
  const mutateAsync = jest.fn();
  const onOpenChange = jest.fn();

  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mutateAsync.mockReset();

    mockUseSprints.mockReturnValue({
      data: [{ id: 'sprint-1' }, { id: 'sprint-2' }],
      isLoading: false,
    } as unknown as ReturnType<typeof useSprints>);

    mockUseCreateSprint.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateSprint>);
  });

  it('renders the Create Sprint title and description when open', () => {
    render(
      <Wrapper>
        <CreateSprintModal projectId="project-1" open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    expect(screen.getByRole('heading', { name: 'Create Sprint' })).toBeInTheDocument();
    expect(
      screen.getByText('Organize work into a time-boxed iteration.')
    ).toBeInTheDocument();
  });

  it('auto-populates default name based on existing sprint count', async () => {
    render(
      <Wrapper>
        <CreateSprintModal projectId="project-1" open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    const nameInput = screen.getByLabelText(/Sprint Name/i) as HTMLInputElement;
    await waitFor(() => {
      expect(nameInput.value).toBe('Sprint 3');
    });
  });

  it('shows a validation error when name is empty', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <CreateSprintModal projectId="project-1" open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    const nameInput = screen.getByLabelText(/Sprint Name/i) as HTMLInputElement;
    await waitFor(() => {
      expect(nameInput.value).toBe('Sprint 3');
    });

    await user.clear(nameInput);
    // Remove the HTML5 required constraint so jsdom does not block submission
    nameInput.removeAttribute('required');

    await user.click(screen.getByRole('button', { name: /Create Sprint/i }));

    expect(await screen.findByText('Please fill in all required fields')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('shows "End date must be after start date" when end is before start', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <CreateSprintModal projectId="project-1" open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    const startInput = screen.getByLabelText(/Start Date/i) as HTMLInputElement;
    const endInput = screen.getByLabelText(/End Date/i) as HTMLInputElement;

    await waitFor(() => {
      expect(startInput.value).not.toBe('');
    });

    await user.clear(startInput);
    await user.type(startInput, '2026-05-10');
    await user.clear(endInput);
    await user.type(endInput, '2026-05-01');

    // HTML5 validation (min= / required) would block submit in jsdom;
    // remove those attributes so our custom validation branch runs.
    startInput.removeAttribute('required');
    endInput.removeAttribute('required');
    endInput.removeAttribute('min');

    await user.click(screen.getByRole('button', { name: /Create Sprint/i }));

    expect(await screen.findByText('End date must be after start date')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('shows duration error when sprint is longer than 90 days', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <CreateSprintModal projectId="project-1" open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    const startInput = screen.getByLabelText(/Start Date/i) as HTMLInputElement;
    const endInput = screen.getByLabelText(/End Date/i) as HTMLInputElement;

    await waitFor(() => {
      expect(startInput.value).not.toBe('');
    });

    await user.clear(startInput);
    await user.type(startInput, '2026-01-01');
    await user.clear(endInput);
    await user.type(endInput, '2026-12-01');

    await user.click(screen.getByRole('button', { name: /Create Sprint/i }));

    expect(
      await screen.findByText('Sprint duration must be between 1 and 90 days')
    ).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('submits trimmed values, Date instances, and then closes the modal', async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue({ id: 'sprint-3' });

    render(
      <Wrapper>
        <CreateSprintModal projectId="project-1" open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    const nameInput = screen.getByLabelText(/Sprint Name/i) as HTMLInputElement;
    const goalInput = screen.getByLabelText(/Sprint Goal/i) as HTMLTextAreaElement;
    const startInput = screen.getByLabelText(/Start Date/i) as HTMLInputElement;
    const endInput = screen.getByLabelText(/End Date/i) as HTMLInputElement;

    await waitFor(() => {
      expect(nameInput.value).toBe('Sprint 3');
    });

    await user.clear(nameInput);
    await user.type(nameInput, '  Release 26  ');
    await user.type(goalInput, '  Ship the thing  ');
    await user.clear(startInput);
    await user.type(startInput, '2026-05-01');
    await user.clear(endInput);
    await user.type(endInput, '2026-05-15');

    await user.click(screen.getByRole('button', { name: /Create Sprint/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });

    const payload = mutateAsync.mock.calls[0][0];
    expect(payload.projectId).toBe('project-1');
    expect(payload.name).toBe('Release 26');
    expect(payload.goal).toBe('Ship the thing');
    expect(payload.startDate).toBeInstanceOf(Date);
    expect(payload.endDate).toBeInstanceOf(Date);
    expect(payload.startDate.toISOString().slice(0, 10)).toBe('2026-05-01');
    expect(payload.endDate.toISOString().slice(0, 10)).toBe('2026-05-15');

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <CreateSprintModal projectId="project-1" open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables the Create button while the mutation is pending', () => {
    mockUseCreateSprint.mockReturnValue({
      mutateAsync,
      isPending: true,
    } as unknown as ReturnType<typeof useCreateSprint>);

    render(
      <Wrapper>
        <CreateSprintModal projectId="project-1" open={true} onOpenChange={onOpenChange} />
      </Wrapper>
    );

    const submitButton = screen.getByRole('button', { name: /Create Sprint/i });
    expect(submitButton).toBeDisabled();
  });
});
