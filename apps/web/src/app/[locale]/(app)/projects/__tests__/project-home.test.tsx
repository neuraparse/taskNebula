import { isValidElement, type ReactElement } from 'react';
import { ProjectViewsShell } from '@/components/issues/project-views-shell';
import ProjectPage from '../[projectId]/page';

jest.mock('@/components/issues/project-views-shell', () => ({
  ProjectViewsShell: jest.fn(() => null),
}));

describe('ProjectPage', () => {
  beforeEach(() => {
    jest.mocked(ProjectViewsShell).mockClear();
  });

  it('renders the project views shell at /projects/:id', async () => {
    const result = await ProjectPage({ params: Promise.resolve({ projectId: 'alpha' }) });

    expect(isValidElement(result)).toBe(true);
    expect((result as ReactElement<{ projectId: string }>).type).toBe(ProjectViewsShell);
    expect((result as ReactElement<{ projectId: string }>).props.projectId).toBe('alpha');
  });

  it('preserves the project key/id exactly in the shell props', async () => {
    const result = await ProjectPage({ params: Promise.resolve({ projectId: 'TN-CORE' }) });

    expect((result as ReactElement<{ projectId: string }>).props.projectId).toBe('TN-CORE');
  });
});
