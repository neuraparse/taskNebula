import { Suspense } from 'react';
import { act, render, screen } from '@testing-library/react';
import ModulesPage from '../page';
import { useModules } from '@/lib/modules/use-modules';

async function renderPage(projectId: string) {
  let result: ReturnType<typeof render> | undefined;
  await act(async () => {
    result = render(
      <Suspense fallback={<div>fallback</div>}>
        <ModulesPage params={Promise.resolve({ projectId })} />
      </Suspense>,
    );
  });
  return result!;
}

jest.mock('@/lib/modules/use-modules', () => ({
  useModules: jest.fn(),
}));

jest.mock('@/components/modules/module-create-dialog', () => ({
  ModuleCreateDialog: () => null,
}));

const mockUseModules = useModules as jest.MockedFunction<typeof useModules>;

describe('ModulesPage (smoke)', () => {
  beforeEach(() => {
    mockUseModules.mockReset();
  });

  it('renders the empty state when no modules exist', async () => {
    mockUseModules.mockReturnValue({
      modules: [],
      isLoading: false,
      createModule: jest.fn(),
      updateModule: jest.fn(),
      removeModule: jest.fn(),
    } as any);

    await renderPage('p1');

    expect(screen.getByRole('heading', { name: /modules/i })).toBeInTheDocument();
    expect(
      screen.getByText(/no modules yet\. create one to group related work/i),
    ).toBeInTheDocument();
  });

  it('renders module cards when data is present', async () => {
    mockUseModules.mockReturnValue({
      modules: [
        {
          id: 'm1',
          projectId: 'p1',
          name: 'Billing',
          description: 'Billing module',
          status: 'in_progress',
          memberIds: [],
          targetDate: null,
        },
      ],
      isLoading: false,
      createModule: jest.fn(),
      updateModule: jest.fn(),
      removeModule: jest.fn(),
    } as any);

    await renderPage('p1');

    expect(screen.getByText('Billing')).toBeInTheDocument();
  });
});
