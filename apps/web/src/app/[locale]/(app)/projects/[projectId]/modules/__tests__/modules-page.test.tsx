import { Suspense } from 'react';
import { act, render, screen } from '@testing-library/react';
import ModulesPage from '../page';
import { useModules, type ProjectModule, type UseModulesResult } from '@/lib/modules/use-modules';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';

async function renderPage(projectId: string) {
  let result: ReturnType<typeof render> | undefined;
  await act(async () => {
    result = render(
      <Suspense fallback={<div>fallback</div>}>
        <ModulesPage params={Promise.resolve({ projectId })} />
      </Suspense>
    );
  });
  return result!;
}

jest.mock('@/lib/modules/use-modules', () => ({
  useModules: jest.fn(),
}));

jest.mock('@/lib/hooks/use-project-permissions', () => ({
  useProjectPermissions: jest.fn(),
}));

jest.mock('@/components/modules/module-create-dialog', () => ({
  ModuleCreateDialog: () => null,
}));

const mockUseModules = useModules as jest.MockedFunction<typeof useModules>;
const mockUseProjectPermissions = useProjectPermissions as jest.MockedFunction<
  typeof useProjectPermissions
>;

function mockPermissions(canAdministerProject: boolean) {
  mockUseProjectPermissions.mockReturnValue({
    permissions: {
      canAdministerProject,
      isSuperAdmin: false,
      isOrgOwner: false,
      isOrgAdmin: false,
    },
    isLoading: false,
    error: null,
  } as ReturnType<typeof useProjectPermissions>);
}

function moduleFixture(overrides: Partial<ProjectModule> = {}): ProjectModule {
  return {
    id: 'm1',
    projectId: 'p1',
    name: 'Billing',
    description: 'Billing module',
    status: 'in_progress',
    memberIds: [],
    targetDate: null,
    ...overrides,
  };
}

function mockModules(modules: ProjectModule[]) {
  const fallback = modules[0] ?? moduleFixture();
  mockUseModules.mockReturnValue({
    modules,
    isLoading: false,
    createModule: jest.fn(async () => fallback),
    updateModule: jest.fn(async () => fallback),
    removeModule: jest.fn(async () => undefined),
  } satisfies UseModulesResult);
}

describe('ModulesPage (smoke)', () => {
  beforeEach(() => {
    mockUseModules.mockReset();
    mockUseProjectPermissions.mockReset();
    mockPermissions(true);
  });

  it('renders the empty state when no modules exist', async () => {
    mockModules([]);

    await renderPage('p1');

    expect(screen.getByRole('heading', { name: /modules/i })).toBeInTheDocument();
    expect(
      screen.getByText(/no modules yet\. create one to group related work/i)
    ).toBeInTheDocument();
  });

  it('hides module creation for read-only users', async () => {
    mockPermissions(false);
    mockModules([]);

    await renderPage('p1');

    expect(
      screen.getByText(/no modules have been created for this project yet/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create module/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new module/i })).not.toBeInTheDocument();
  });

  it('renders module cards when data is present', async () => {
    mockModules([moduleFixture()]);

    await renderPage('p1');

    expect(screen.getByText('Billing')).toBeInTheDocument();
  });
});
