import { fireEvent, render, screen } from '@testing-library/react';
import { DocsGettingStarted } from '../docs-getting-started';

describe('DocsGettingStarted', () => {
  it('renders the empty-space message when no pages exist', () => {
    render(
      <DocsGettingStarted
        canCreate
        hasPages={false}
        scopeLabel="Organization wiki"
        spaceName="Team Wiki"
      />
    );

    expect(screen.getByText(/No pages yet in this space\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create page/i })).toBeInTheDocument();
  });

  it('prompts to pick a page when the space already has content', () => {
    render(
      <DocsGettingStarted
        canCreate
        hasPages
        scopeLabel="Project docs"
        spaceName="Demo Project Docs"
      />
    );

    expect(screen.getByText(/Select a page from the sidebar/i)).toBeInTheDocument();
  });

  it('calls the create action when the CTA is pressed', () => {
    const onCreatePage = jest.fn();

    render(
      <DocsGettingStarted
        canCreate
        hasPages={false}
        scopeLabel="Project docs"
        spaceName="Demo Project Docs"
        onCreatePage={onCreatePage}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /create page/i }));
    expect(onCreatePage).toHaveBeenCalledTimes(1);
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

    expect(screen.queryByRole('button', { name: /create page/i })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });
});
