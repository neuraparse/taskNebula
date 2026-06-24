import { render, screen } from '@testing-library/react';

import { TemplatesGrid } from '../templates-grid';
import type { WorkItemTemplate } from '@/lib/templates/registry';
import { useTemplatesList, useInstantiateTemplate, useDeleteTemplate } from '../use-templates';

// Mock the react-query hooks so we control what `TemplatesGrid` sees.
jest.mock('../use-templates', () => ({
  useTemplatesList: jest.fn(),
  useInstantiateTemplate: jest.fn(),
  useDeleteTemplate: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

const mockUseTemplatesList = useTemplatesList as jest.MockedFunction<typeof useTemplatesList>;
const mockUseInstantiateTemplate = useInstantiateTemplate as jest.MockedFunction<
  typeof useInstantiateTemplate
>;
const mockUseDeleteTemplate = useDeleteTemplate as jest.MockedFunction<typeof useDeleteTemplate>;

function emptyMutation() {
  return {
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
  } as unknown as ReturnType<typeof useInstantiateTemplate>;
}

describe('TemplatesGrid', () => {
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
    mockUseInstantiateTemplate.mockReturnValue(emptyMutation());
    mockUseDeleteTemplate.mockReturnValue(emptyMutation());
  });

  it('renders a template card when the list hook resolves with data', () => {
    mockUseTemplatesList.mockReturnValue({
      data: {
        templates: [
          {
            id: 'tpl-1',
            organizationId: 'org-1',
            name: 'Quarterly planning workspace',
            description: 'Bootstrap a project with planning rituals.',
            category: 'general',
            icon: null,
            color: null,
            kind: 'project',
            payload: {},
            usageCount: 0,
            isPublic: false,
            isVerified: false,
            createdBy: 'user-1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        canAdminister: false,
        adminOrganizationIds: [],
        memberOrganizationIds: ['org-1'],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useTemplatesList>);

    render(<TemplatesGrid templates={[]} />);

    expect(screen.getByText('Quarterly planning workspace')).toBeInTheDocument();
  });

  it('shows the empty state when no templates match the current filter', () => {
    mockUseTemplatesList.mockReturnValue({
      data: {
        templates: [],
        canAdminister: false,
        adminOrganizationIds: [],
        memberOrganizationIds: [],
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useTemplatesList>);

    // Registry fallback is normally populated, so explicitly override it to
    // an empty array to exercise the "nothing to show" path.
    const emptyRegistry: WorkItemTemplate[] = [];
    render(<TemplatesGrid templates={emptyRegistry} />);

    expect(screen.getByText('No templates match')).toBeInTheDocument();
  });
});
