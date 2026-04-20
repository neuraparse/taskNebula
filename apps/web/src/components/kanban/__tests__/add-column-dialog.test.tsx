import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddColumnDialog } from '../add-column-dialog';

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
});

describe('AddColumnDialog', () => {
  it('does not render dialog content when closed', () => {
    render(
      <AddColumnDialog open={false} onOpenChange={jest.fn()} projectId="project-1" />
    );

    expect(screen.queryByText('Add Column')).not.toBeInTheDocument();
  });

  it('renders title and description when open', () => {
    render(
      <AddColumnDialog open onOpenChange={jest.fn()} projectId="project-1" />
    );

    expect(screen.getByText('Add Column')).toBeInTheDocument();
    expect(
      screen.getByText(/create a new column for your board/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Column Name')).toBeInTheDocument();
  });

  it('disables the submit button when required fields are empty', () => {
    render(
      <AddColumnDialog open onOpenChange={jest.fn()} projectId="project-1" />
    );

    expect(screen.getByRole('button', { name: /create column/i })).toBeDisabled();
  });

  it('invokes onOpenChange when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();

    render(
      <AddColumnDialog open onOpenChange={onOpenChange} projectId="project-1" />
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps submit disabled with only a name and no category', async () => {
    const user = userEvent.setup();

    render(
      <AddColumnDialog open onOpenChange={jest.fn()} projectId="project-1" />
    );

    await user.type(screen.getByLabelText('Column Name'), 'Ready for QA');
    expect(screen.getByRole('button', { name: /create column/i })).toBeDisabled();
  });
});
