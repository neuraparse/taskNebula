import { fireEvent, render, screen } from '@testing-library/react';
import { DocsGettingStarted } from '../docs-getting-started';

describe('DocsGettingStarted', () => {
  it('renders clear creation guidance for an empty space', () => {
    render(
      <DocsGettingStarted
        canCreate
        hasPages={false}
        scopeLabel="Organization wiki"
        spaceName="Team Wiki"
      />
    );

    expect(screen.getByText('Create your first note')).toBeInTheDocument();
    expect(screen.getByText(/Root note/i)).toBeInTheDocument();
    expect(screen.getByText(/Autosave/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new page/i })).toBeInTheDocument();
  });

  it('calls the create action when the CTA is pressed', () => {
    const onCreatePage = jest.fn();

    render(
      <DocsGettingStarted
        canCreate
        hasPages
        scopeLabel="Project docs"
        spaceName="Demo Project Docs"
        onCreatePage={onCreatePage}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /new page/i }));
    expect(onCreatePage).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Sub-notes/i)).toBeInTheDocument();
  });

  it('shows read-only guidance when creation is disabled', () => {
    render(
      <DocsGettingStarted
        canCreate={false}
        hasPages={false}
        scopeLabel="Organization wiki"
        spaceName="Team Wiki"
      />
    );

    expect(screen.queryByRole('button', { name: /new page/i })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
