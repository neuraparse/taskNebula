import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateIssueModal } from '../create-issue-modal';
import { useCreateIssue } from '@/lib/hooks/use-issues';

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/lib/hooks/use-issues', () => ({
  useCreateIssue: jest.fn(),
}));

const mockUseCreateIssue = useCreateIssue as jest.MockedFunction<typeof useCreateIssue>;

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('CreateIssueModal', () => {
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

    mockUseCreateIssue.mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateIssue>);
  });

  it('renders the title, description, and required fields when open', () => {
    render(
      <Wrapper>
        <CreateIssueModal open={true} onOpenChange={onOpenChange} projectId="project-1" />
      </Wrapper>
    );

    expect(screen.getByRole('heading', { name: 'Create New Issue' })).toBeInTheDocument();
    expect(
      screen.getByText('Add a new issue to your project. Fill in the details below.')
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
  });

  it('disables the Create Issue submit button when title is empty', () => {
    render(
      <Wrapper>
        <CreateIssueModal open={true} onOpenChange={onOpenChange} projectId="project-1" />
      </Wrapper>
    );

    const submit = screen.getByRole('button', { name: /Create Issue/i });
    expect(submit).toBeDisabled();
  });

  it('submits the trimmed payload and closes the modal on success', async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue({ id: 'issue-1' });

    render(
      <Wrapper>
        <CreateIssueModal
          open={true}
          onOpenChange={onOpenChange}
          projectId="project-1"
          sprintId="sprint-1"
        />
      </Wrapper>
    );

    await user.type(screen.getByLabelText(/Title/), '  Investigate flaky test  ');
    await user.type(screen.getByLabelText(/Description/), '  Add retries  ');

    await user.click(screen.getByRole('button', { name: /Create Issue/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(mutateAsync).toHaveBeenCalledWith({
      title: 'Investigate flaky test',
      description: 'Add retries',
      type: 'task',
      priority: 'medium',
      projectId: 'project-1',
      sprintId: 'sprint-1',
    });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('keeps the modal open and logs an error when the mutation rejects', async () => {
    const user = userEvent.setup();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mutateAsync.mockRejectedValue(new Error('boom'));

    render(
      <Wrapper>
        <CreateIssueModal open={true} onOpenChange={onOpenChange} projectId="project-1" />
      </Wrapper>
    );

    await user.type(screen.getByLabelText(/Title/), 'Broken thing');
    await user.click(screen.getByRole('button', { name: /Create Issue/i }));

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Failed to create issue:', expect.any(Error));
    });

    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    consoleError.mockRestore();
  });

  it('calls onOpenChange(false) when Cancel is clicked', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <CreateIssueModal open={true} onOpenChange={onOpenChange} projectId="project-1" />
      </Wrapper>
    );

    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables both Cancel and Create buttons while the mutation is pending', () => {
    mockUseCreateIssue.mockReturnValue({
      mutateAsync,
      isPending: true,
    } as unknown as ReturnType<typeof useCreateIssue>);

    render(
      <Wrapper>
        <CreateIssueModal open={true} onOpenChange={onOpenChange} projectId="project-1" />
      </Wrapper>
    );

    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Create Issue/i })).toBeDisabled();
  });
});
