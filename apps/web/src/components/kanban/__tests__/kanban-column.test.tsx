import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { KanbanColumn } from '../kanban-column';

jest.mock('@/components/issues/create-issue-modal', () => ({
  CreateIssueModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-issue-modal" /> : null,
}));

function renderWithDnd(ui: React.ReactElement) {
  return render(<DndContext>{ui}</DndContext>);
}

describe('KanbanColumn', () => {
  const column = {
    id: 'status-1',
    name: 'In Progress',
    color: '#3b82f6',
    category: 'in_progress',
  };

  it('renders the column name and issue count', () => {
    renderWithDnd(
      <KanbanColumn column={column} issueCount={4} projectId="project-1">
        <div data-testid="issue-child">first</div>
      </KanbanColumn>
    );

    expect(screen.getByRole('heading', { name: 'In Progress' })).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('issues')).toBeInTheDocument();
  });

  it('renders child issue cards inside the column', () => {
    renderWithDnd(
      <KanbanColumn column={column} issueCount={1} projectId="project-1">
        <div data-testid="issue-child">card-content</div>
      </KanbanColumn>
    );

    expect(screen.getByTestId('issue-child')).toHaveTextContent('card-content');
  });

  it('renders an Add issue footer action', () => {
    renderWithDnd(
      <KanbanColumn column={column} issueCount={0} projectId="project-1">
        <div />
      </KanbanColumn>
    );

    expect(screen.getByRole('button', { name: /add issue/i })).toBeInTheDocument();
  });

  it('falls back to backlog styling for unknown categories', () => {
    renderWithDnd(
      <KanbanColumn
        column={{ ...column, category: 'does-not-exist' }}
        issueCount={2}
        projectId="project-1"
      >
        <div />
      </KanbanColumn>
    );

    expect(screen.getByRole('heading', { name: 'In Progress' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
