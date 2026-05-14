import { Suspense } from 'react';
import { act, render } from '@testing-library/react';
import ProjectViewsPage from '../page';

jest.mock('@/components/issues/project-views-shell', () => ({
  ProjectViewsShell: ({ projectId }: { projectId: string }) => (
    <div data-testid="project-views-shell">shell:{projectId}</div>
  ),
}));

async function renderPage(projectId: string) {
  let result: ReturnType<typeof render> | undefined;
  await act(async () => {
    result = render(
      <Suspense fallback={<div>fallback</div>}>
        <ProjectViewsPage params={Promise.resolve({ projectId })} />
      </Suspense>,
    );
  });
  return result!;
}

describe('ProjectViewsPage (smoke)', () => {
  it('renders the shell with the resolved projectId', async () => {
    const { findByTestId } = await renderPage('proj-123');

    const shell = await findByTestId('project-views-shell');
    expect(shell.textContent).toBe('shell:proj-123');
  });

  it('renders when given a different projectId (empty id treated as string)', async () => {
    const { findByTestId } = await renderPage('');

    const shell = await findByTestId('project-views-shell');
    expect(shell.textContent).toBe('shell:');
  });
});
