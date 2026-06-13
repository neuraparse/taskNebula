import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DueDatePicker, isPastDue } from '../due-date-picker';

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
});

describe('isPastDue', () => {
  const now = new Date(2026, 5, 12, 10, 0, 0); // June 12, 2026 10:00 local

  it('is false while the due day is still running', () => {
    expect(isPastDue(new Date(2026, 5, 12, 0, 0, 0), now)).toBe(false);
  });

  it('is true once the due day has fully elapsed', () => {
    expect(isPastDue(new Date(2026, 5, 11, 23, 0, 0), now)).toBe(true);
  });

  it('is false for future dates', () => {
    expect(isPastDue(new Date(2026, 5, 13, 0, 0, 0), now)).toBe(false);
  });

  it('is false for unparseable input', () => {
    expect(isPastDue('not-a-date', now)).toBe(false);
  });
});

describe('DueDatePicker', () => {
  it('shows the empty-state label when no due date is set', () => {
    render(<DueDatePicker value={null} onChange={jest.fn()} />);

    expect(screen.getByText('Set due date')).toBeInTheDocument();
  });

  it('marks past dates as overdue', () => {
    render(<DueDatePicker value="2020-01-01T12:00:00.000Z" onChange={jest.fn()} />);

    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('does not mark future dates as overdue', () => {
    render(<DueDatePicker value="2099-01-01T12:00:00.000Z" onChange={jest.fn()} />);

    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
  });

  it('clears the due date via the clear action', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<DueDatePicker value="2020-01-01T12:00:00.000Z" onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Due date' }));
    await user.click(await screen.findByText('Clear due date'));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('emits a noon-UTC ISO datetime when a date is picked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(<DueDatePicker value={null} onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Due date' }));
    const input = await screen.findByLabelText('Due date', { selector: 'input' });
    // userEvent.type doesn't drive native date inputs reliably in JSDOM;
    // fireEvent-style change via paste keeps the test honest enough.
    await user.click(input);
    await user.paste('2026-07-01');

    // Fallback for environments where paste doesn't populate date inputs.
    if (onChange.mock.calls.length === 0) {
      const { fireEvent } = await import('@testing-library/react');
      fireEvent.change(input, { target: { value: '2026-07-01' } });
    }

    expect(onChange).toHaveBeenCalledWith('2026-07-01T12:00:00.000Z');
  });
});
