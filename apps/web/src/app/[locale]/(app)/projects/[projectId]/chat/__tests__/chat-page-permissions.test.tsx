import { render, screen } from '@testing-library/react';
import ProjectChatPage from '../page';
import { auth } from '@/auth';
import { ChatAccessError, getProjectChatContext } from '@/lib/chat/server';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/chat/server', () => {
  class MockChatAccessError extends Error {
    status: number;

    constructor(message: string, status = 403) {
      super(message);
      this.name = 'ChatAccessError';
      this.status = status;
    }
  }

  return {
    ChatAccessError: MockChatAccessError,
    getProjectChatContext: jest.fn(),
  };
});

jest.mock('@/components/chat/chat-shell', () => ({
  ChatShell: ({ projectId }: { projectId: string }) => (
    <div data-testid="chat-shell">{projectId}</div>
  ),
}));

jest.mock('@/components/projects/project-access-denied', () => ({
  ProjectAccessDenied: () => <div data-testid="project-access-denied" />,
}));

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockGetProjectChatContext = getProjectChatContext as jest.MockedFunction<
  typeof getProjectChatContext
>;

describe('ProjectChatPage permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as Awaited<ReturnType<typeof auth>>);
  });

  it('renders the chat shell when the user can view project chat', async () => {
    mockGetProjectChatContext.mockResolvedValue({ canView: true } as never);

    render(await ProjectChatPage({ params: Promise.resolve({ projectId: 'PRJ' }) }));

    expect(screen.getByTestId('chat-shell')).toHaveTextContent('PRJ');
    expect(screen.queryByTestId('project-access-denied')).not.toBeInTheDocument();
  });

  it('renders access denied instead of the chat shell when chat view is denied', async () => {
    mockGetProjectChatContext.mockResolvedValue({ canView: false } as never);

    render(await ProjectChatPage({ params: Promise.resolve({ projectId: 'PRJ' }) }));

    expect(screen.getByTestId('project-access-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-shell')).not.toBeInTheDocument();
  });

  it('renders access denied for chat permission errors', async () => {
    mockGetProjectChatContext.mockRejectedValue(
      new ChatAccessError('You do not have permission to view project chat.', 403)
    );

    render(await ProjectChatPage({ params: Promise.resolve({ projectId: 'PRJ' }) }));

    expect(screen.getByTestId('project-access-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-shell')).not.toBeInTheDocument();
  });
});
