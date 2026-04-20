import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardFiltersBar, DEFAULT_BOARD_FILTERS, type BoardFilters } from '../board-filters';

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
});

function baseFilters(overrides: Partial<BoardFilters> = {}): BoardFilters {
  return { ...DEFAULT_BOARD_FILTERS, ...overrides };
}

describe('BoardFiltersBar', () => {
  it('shows a plain issue count when no filters are active', () => {
    render(
      <BoardFiltersBar
        filters={baseFilters()}
        onFiltersChange={jest.fn()}
        issueCount={10}
        filteredCount={10}
      />
    );

    expect(screen.getByText('10 issues')).toBeInTheDocument();
  });

  it('shows filtered/total count when counts differ', () => {
    render(
      <BoardFiltersBar
        filters={baseFilters({ search: 'bug' })}
        onFiltersChange={jest.fn()}
        issueCount={10}
        filteredCount={3}
      />
    );

    expect(screen.getByText('3/10')).toBeInTheDocument();
    expect(screen.getByText('"bug"')).toBeInTheDocument();
  });

  it('renders active priority badge and active filter count', () => {
    render(
      <BoardFiltersBar
        filters={baseFilters({ priority: ['high'] })}
        onFiltersChange={jest.fn()}
        issueCount={5}
        filteredCount={2}
      />
    );

    expect(screen.getByText('high')).toBeInTheDocument();
    // The filter button shows a count badge of 1
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('clears all filters when Clear text button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <BoardFiltersBar
        filters={baseFilters({ search: 'thing', priority: ['high'] })}
        onFiltersChange={onChange}
        issueCount={4}
        filteredCount={1}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_BOARD_FILTERS);
  });

  it('opens a search input and emits search term changes', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <BoardFiltersBar
        filters={baseFilters()}
        onFiltersChange={onChange}
        issueCount={4}
        filteredCount={4}
      />
    );

    // First button is the search toggle (icon only)
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);

    const input = await screen.findByPlaceholderText('Search issues...');
    await user.type(input, 'a');

    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_BOARD_FILTERS,
      search: 'a',
    });
  });
});
