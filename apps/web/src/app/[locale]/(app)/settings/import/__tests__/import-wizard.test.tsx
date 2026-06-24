import { render, screen } from '@testing-library/react';
import { ImportWizard } from '../import-wizard';

let searchParamsValue = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsValue,
}));

describe('ImportWizard', () => {
  beforeEach(() => {
    searchParamsValue = new URLSearchParams();
  });

  it('opens the Plane CSV bridge from setup query parameters', () => {
    searchParamsValue = new URLSearchParams('source=plane&projectId=project-1');

    render(
      <ImportWizard
        workspaceId="org-1"
        projects={[{ id: 'project-1', key: 'MIG', name: 'Migration backlog' }]}
      />
    );

    expect(screen.getByText(/importing from plane/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /target project/i })).toHaveTextContent(
      /MIG.*Migration backlog/i
    );
    expect(screen.getByLabelText(/plane csv export/i)).toBeInTheDocument();
  });
});
