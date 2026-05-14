import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { ProjectsClient } from '../projects-client';
import { useProjects, useCreateProject } from '@/lib/hooks/use-projects';
import { useTeamspaces } from '@/lib/hooks/use-teamspaces';
import { useOrganization } from '@/lib/hooks/use-organization';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('@/lib/hooks/use-projects', () => ({
  useProjects: jest.fn(),
  useCreateProject: jest.fn(),
}));

jest.mock('@/lib/hooks/use-teamspaces', () => ({
  useTeamspaces: jest.fn(),
}));

// Avoid real fetches for the organizations query inside the component.
const originalFetch = global.fetch;

const mockUseProjects = useProjects as jest.MockedFunction<typeof useProjects>;
const mockUseCreateProject = useCreateProject as jest.MockedFunction<
  typeof useCreateProject
>;
const mockUseTeamspaces = useTeamspaces as jest.MockedFunction<typeof useTeamspaces>;

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('ProjectsClient', () => {
  beforeAll(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ organizations: [] }),
      } as unknown as Response)
    ) as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    useOrganization.setState({
      currentOrganizationId: 'org-1',
      currentTeamId: null,
    });

    mockUseTeamspaces.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useTeamspaces>);

    mockUseCreateProject.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useCreateProject>);
  });

  it('renders a list of projects fetched from the API', () => {
    mockUseProjects.mockReturnValue({
      data: [
        {
          id: 'p-1',
          organizationId: 'org-1',
          key: 'ALPHA',
          name: 'Alpha Project',
          description: 'First project',
          status: 'active',
          settings: {},
          createdAt: '2026-01-01',
          updatedAt: '2026-01-02',
          issueCount: 5,
          sprintCount: 2,
          team: null,
        },
        {
          id: 'p-2',
          organizationId: 'org-1',
          key: 'BETA',
          name: 'Beta Project',
          description: null,
          status: 'active',
          settings: {},
          createdAt: '2026-01-03',
          updatedAt: '2026-01-04',
          issueCount: 0,
          sprintCount: 0,
          team: null,
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useProjects>);

    render(<ProjectsClient />, { wrapper: Wrapper });

    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.getByText('Beta Project')).toBeInTheDocument();
    expect(screen.getByText('ALPHA')).toBeInTheDocument();
    expect(screen.getByText('BETA')).toBeInTheDocument();
    expect(screen.getByText('2 active projects')).toBeInTheDocument();

    const alphaLink = screen.getByText('Alpha Project').closest('a');
    expect(alphaLink).toHaveAttribute('href', '/projects/alpha/views');
  });

  it('renders the empty state when no projects are returned', () => {
    mockUseProjects.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof useProjects>);

    render(<ProjectsClient />, { wrapper: Wrapper });

    expect(
      screen.getByText('No projects yet. Create your first to get started.')
    ).toBeInTheDocument();
    // Header shows "0 active projects"
    expect(screen.getByText('0 active projects')).toBeInTheDocument();
    // Empty-state CTA + header CTA both present
    const createButtons = screen.getAllByRole('button', { name: /create project/i });
    expect(createButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('shows the loading message while projects are loading', () => {
    mockUseProjects.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useProjects>);

    render(<ProjectsClient />, { wrapper: Wrapper });

    expect(screen.getByText('Loading projects...')).toBeInTheDocument();
  });
});
